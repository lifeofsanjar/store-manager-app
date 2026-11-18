from django.test import TestCase
from rest_framework.test import APIClient

from .models import Payment, Product, ReturnRecord, Sale, SaleItem
from .services import (
    BusinessRuleError,
    add_payment,
    create_restock,
    create_sale,
    return_sale_item,
    sale_debt,
    set_stock_count,
)


class StoreTransactionTests(TestCase):
    def setUp(self):
        self.owner = self._make_user('owner', 'owner')
        self.staff = self._make_user('staff', 'staff')
        self.product = Product.objects.create(
            name='Non',
            barcode='1000001',
            sell_price=1000,
            buy_price=600,
            stock_qty=10,
            min_stock=2,
        )

    @staticmethod
    def _make_user(login, role):
        from .models import User

        return User.objects.create_user(
            login=login,
            name=login.title(),
            role=role,
            password='correct-horse-battery-staple',
        )

    def test_sale_uses_custom_price_copies_buy_price_and_reduces_stock(self):
        sale = create_sale(
            user=self.staff,
            items=[{'product_id': self.product.pk, 'quantity': 2, 'unit_price': 900}],
            payment_choice='cash',
        )

        item = sale.items.get()
        self.product.refresh_from_db()
        self.assertEqual(sale.total_amount, 1800)
        self.assertEqual(item.unit_price, 900)
        self.assertEqual(item.buy_price, 600)
        self.assertEqual(self.product.stock_qty, 8)
        self.assertEqual(sale_debt(sale), 0)
        self.assertEqual(sale.payments.get().amount, 1800)

    def test_debt_sale_requires_customer_note_and_tracks_balance(self):
        with self.assertRaises(BusinessRuleError):
            create_sale(
                user=self.staff,
                items=[{'product_id': self.product.pk, 'quantity': 1}],
                payment_choice='debt',
            )

        sale = create_sale(
            user=self.staff,
            items=[{'product_id': self.product.pk, 'quantity': 2}],
            payment_choice='debt',
            note='Ali, +998 90 000 00 00',
        )
        self.assertEqual(sale_debt(sale), 2000)

        add_payment(sale_id=sale.pk, method='cash', amount=700)
        self.assertEqual(sale_debt(sale), 1300)
        with self.assertRaises(BusinessRuleError):
            add_payment(sale_id=sale.pk, method='card', amount=1301)

    def test_return_of_paid_item_restores_stock_records_refund_and_limits_quantity(self):
        sale = create_sale(
            user=self.staff,
            items=[{'product_id': self.product.pk, 'quantity': 2}],
            payment_choice='card',
        )
        item = sale.items.get()

        returned = return_sale_item(
            sale_item_id=item.pk,
            user=self.staff,
            quantity=1,
        )
        self.product.refresh_from_db()
        self.assertEqual(returned.refund_amount, 1000)
        self.assertEqual(self.product.stock_qty, 9)
        self.assertEqual(sale_debt(sale), 0)
        self.assertEqual(
            sale.payments.order_by('-id').first().amount,
            -1000,
        )
        self.assertEqual(sale.payments.order_by('-id').first().method, 'card')

        with self.assertRaises(BusinessRuleError):
            return_sale_item(
                sale_item_id=item.pk,
                user=self.staff,
                quantity=2,
            )
        self.assertEqual(ReturnRecord.objects.filter(sale_item=item).count(), 1)

    def test_return_reduces_debt_before_refunding_paid_amount(self):
        sale = create_sale(
            user=self.staff,
            items=[{'product_id': self.product.pk, 'quantity': 2}],
            payment_choice='debt',
            note='Ali, +998 90 000 00 00',
        )
        add_payment(sale_id=sale.pk, method='cash', amount=500)
        item = sale.items.get()

        return_sale_item(sale_item_id=item.pk, user=self.staff, quantity=1)

        self.assertEqual(sale_debt(sale), 500)
        self.assertEqual(sale.payments.count(), 1)

    def test_refund_uses_original_payment_methods_in_reverse_order(self):
        sale = create_sale(
            user=self.staff,
            items=[{'product_id': self.product.pk, 'quantity': 2}],
            payment_choice='debt',
            note='Ali, +998 90 000 00 00',
        )
        add_payment(sale_id=sale.pk, method='cash', amount=1000)
        add_payment(sale_id=sale.pk, method='card', amount=1000)
        item = sale.items.get()

        return_sale_item(sale_item_id=item.pk, user=self.staff, quantity=1)

        refund = sale.payments.order_by('-id').first()
        self.assertEqual((refund.method, refund.amount), ('card', -1000))
        self.assertEqual(sale_debt(sale), 0)

    def test_restock_updates_quantity_and_latest_buy_price(self):
        restock = create_restock(
            user=self.staff,
            items=[
                {'product_id': self.product.pk, 'quantity': 3, 'buy_price': 650},
                {'product_id': self.product.pk, 'quantity': 2, 'buy_price': 700},
            ],
        )
        self.product.refresh_from_db()

        self.assertEqual(restock.items.count(), 2)
        self.assertEqual(self.product.stock_qty, 15)
        self.assertEqual(self.product.buy_price, 700)

    def test_restock_can_create_a_product_from_initial_stock_details(self):
        restock = create_restock(
            user=self.staff,
            items=[{
                'new_product': {
                    'name': 'Choy',
                    'barcode': '1000002',
                    'sell_price': 5000,
                    'min_stock': 3,
                },
                'quantity': 6,
                'buy_price': 3500,
            }],
        )
        product = Product.objects.get(barcode='1000002')

        self.assertEqual(restock.items.get().product_id, product.pk)
        self.assertEqual(product.stock_qty, 6)
        self.assertEqual(product.sell_price, 5000)
        self.assertEqual(product.buy_price, 3500)
        self.assertEqual(product.min_stock, 3)

    def test_stock_count_can_be_set_directly_but_not_negative(self):
        updated = set_stock_count(product_id=self.product.pk, stock_qty=4)
        self.assertEqual(updated.stock_qty, 4)
        with self.assertRaises(BusinessRuleError):
            set_stock_count(product_id=self.product.pk, stock_qty=-1)

    def test_failed_sale_does_not_create_partial_records_or_change_stock(self):
        self.product.stock_qty = 1
        self.product.save(update_fields=['stock_qty'])

        with self.assertRaises(BusinessRuleError):
            create_sale(
                user=self.staff,
                items=[{'product_id': self.product.pk, 'quantity': 2}],
                payment_choice='cash',
            )

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_qty, 1)
        self.assertEqual(Sale.objects.count(), 0)
        self.assertEqual(SaleItem.objects.count(), 0)
        self.assertEqual(Payment.objects.count(), 0)


class ApiAccessTests(TestCase):
    def setUp(self):
        self.owner = StoreTransactionTests._make_user('api-owner', 'owner')
        self.staff = StoreTransactionTests._make_user('api-staff', 'staff')
        self.client = APIClient()

    def _login(self, user):
        response = self.client.post('/api/auth/login/', {
            'login': user.login,
            'password': 'correct-horse-battery-staple',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {response.data['access_token']}",
        )

    def test_login_returns_a_signed_token_and_staff_is_blocked_from_owner_views(self):
        self._login(self.staff)

        self.assertEqual(self.client.get('/api/statistics/').status_code, 403)
        self.assertEqual(self.client.get('/api/sales/debts/').status_code, 403)

    def test_owner_can_access_statistics_and_low_stock(self):
        product = Product.objects.create(
            name='Kam qolgan tovar',
            barcode='2000002',
            sell_price=700,
            buy_price=300,
            stock_qty=1,
            min_stock=2,
        )
        self._login(self.owner)

        for period in ['day', 'week', 'month']:
            self.assertEqual(self.client.get(f'/api/statistics/?period={period}').status_code, 200)
        low_stock = self.client.get('/api/low-stock/')
        self.assertEqual(low_stock.status_code, 200)
        self.assertEqual([row['id'] for row in low_stock.data], [product.pk])

    def test_product_lookup_matches_name_and_barcode(self):
        product = Product.objects.create(
            name='Mahsulot qidirish',
            barcode='2000003',
            sell_price=900,
            buy_price=450,
            stock_qty=5,
            min_stock=1,
        )
        self._login(self.staff)

        by_name = self.client.get('/api/products/?q=qidirish')
        by_barcode = self.client.get('/api/products/?barcode=2000003')

        self.assertEqual([row['id'] for row in by_name.data], [product.pk])
        self.assertEqual([row['id'] for row in by_barcode.data], [product.pk])

    def test_statistics_subtract_returns_from_sales_and_profit(self):
        product = Product.objects.create(
            name='Hisob mahsuloti',
            barcode='2000001',
            sell_price=1000,
            buy_price=600,
            stock_qty=4,
            min_stock=1,
        )
        sale = create_sale(
            user=self.staff,
            items=[{'product_id': product.pk, 'quantity': 2}],
            payment_choice='cash',
        )
        return_sale_item(
            sale_item_id=sale.items.get().pk,
            user=self.staff,
            quantity=1,
        )
        self._login(self.owner)

        response = self.client.get('/api/statistics/?period=day')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['sales_total'], 1000)
        self.assertEqual(response.data['profit'], 400)

    def test_staff_can_create_product_sell_it_and_return_it_through_api(self):
        self._login(self.staff)
        restock = self.client.post('/api/restocks/', {
            'items': [{
                'new_product': {
                    'name': 'Api mahsuloti',
                    'barcode': '3000001',
                    'sell_price': 2500,
                    'min_stock': 1,
                },
                'quantity': 4,
                'buy_price': 1500,
            }],
        }, format='json')
        self.assertEqual(restock.status_code, 201)
        product = Product.objects.get(barcode='3000001')

        sale = self.client.post('/api/sales/', {
            'items': [{'product_id': product.pk, 'quantity': 1}],
            'payment_choice': 'card',
        }, format='json')
        self.assertEqual(sale.status_code, 201)

        sale_item_id = sale.data['items'][0]['id']
        returned = self.client.post('/api/returns/', {
            'sale_item_id': sale_item_id,
            'quantity': 1,
        }, format='json')
        self.assertEqual(returned.status_code, 201)
        product.refresh_from_db()
        self.assertEqual(product.stock_qty, 4)
        self.assertEqual(sale.data['debt'], 0)
        payment = Sale.objects.get(pk=sale.data['id']).payments.order_by('-id').first()
        self.assertEqual((payment.method, payment.amount), ('card', -2500))

    def test_invalid_login_does_not_issue_a_token(self):
        response = self.client.post('/api/auth/login/', {
            'login': self.staff.login,
            'password': 'wrong-password',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertNotIn('access_token', response.data)
