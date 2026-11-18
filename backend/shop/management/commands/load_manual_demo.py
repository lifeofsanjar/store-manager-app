from datetime import datetime, time, timedelta

from django.contrib.admin.models import LogEntry
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from shop.models import Payment, Product, Restock, ReturnRecord, Sale, User
from shop.services import add_payment, create_restock, create_sale, return_sale_item


DEMO_PRODUCTS = [
    {'name': 'Non (buxanka)', 'sell_price': 4500, 'buy_price': 3000, 'min_stock': 10, 'quantity': 40},
    {'name': 'Sut 1 litr', 'sell_price': 11000, 'buy_price': 8500, 'min_stock': 8, 'quantity': 18},
    {'name': 'Tuxum (10 dona)', 'sell_price': 19000, 'buy_price': 15000, 'min_stock': 8, 'quantity': 20},
    {'name': 'Guruch 1 kg', 'sell_price': 17000, 'buy_price': 13500, 'min_stock': 6, 'quantity': 20},
    {'name': 'Shakar 1 kg', 'sell_price': 13000, 'buy_price': 10000, 'min_stock': 8, 'quantity': 18},
    {'name': 'Choy 100 g', 'sell_price': 9000, 'buy_price': 6800, 'min_stock': 5, 'quantity': 12},
    {'name': 'Yog‘ 1 litr', 'sell_price': 19000, 'buy_price': 15500, 'min_stock': 5, 'quantity': 9},
    {'name': 'Makaron 500 g', 'sell_price': 8000, 'buy_price': 5900, 'min_stock': 6, 'quantity': 3},
]


class Command(BaseCommand):
    help = 'Clear store demo data and load realistic records for manual walkthroughs.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Required confirmation: deletes products, sales, returns, payments, restocks, and admin log entries.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not options['clear']:
            raise CommandError('This command clears existing store data. Re-run with --clear to confirm.')

        staff = User.objects.filter(role=User.Role.STAFF, is_active=True).order_by('id').first()
        if staff is None:
            raise CommandError('Create an active staff account first; user accounts are preserved by this command.')

        # Retain owner, staff, and Django admin accounts so the app remains accessible.
        ReturnRecord.objects.all().delete()
        Payment.objects.all().delete()
        Sale.objects.all().delete()
        Restock.objects.all().delete()
        Product.objects.all().delete()
        LogEntry.objects.all().delete()

        initial_receipt_items = []
        for index, item in enumerate(DEMO_PRODUCTS, start=1):
            initial_receipt_items.append({
                'new_product': {
                    'name': item['name'],
                    'barcode': f'47800000010{index:02d}',
                    'sell_price': item['sell_price'],
                    'min_stock': item['min_stock'],
                },
                'quantity': item['quantity'],
                'buy_price': item['buy_price'],
            })

        initial_restock = create_restock(
            user=staff,
            items=initial_receipt_items,
            note='Namoyish: boshlang‘ich tovar qabul qilish',
        )
        self._set_date(initial_restock, days_ago=14, hour=9)

        products_by_name = {product.name: product for product in Product.objects.all()}
        bread = products_by_name['Non (buxanka)']
        milk = products_by_name['Sut 1 litr']
        eggs = products_by_name['Tuxum (10 dona)']
        rice = products_by_name['Guruch 1 kg']
        sugar = products_by_name['Shakar 1 kg']
        tea = products_by_name['Choy 100 g']
        oil = products_by_name['Yog‘ 1 litr']
        pasta = products_by_name['Makaron 500 g']

        top_up = create_restock(
            user=staff,
            items=[
                {'product_id': tea.pk, 'quantity': 3, 'buy_price': tea.buy_price},
                {'product_id': pasta.pk, 'quantity': 4, 'buy_price': pasta.buy_price},
            ],
            note='Namoyish: kam qolgan tovarlarni qayta to‘ldirish',
        )
        self._set_date(top_up, days_ago=2, hour=8)

        def sale(days_ago, hour, items, payment_choice='cash', note=''):
            record = create_sale(
                user=staff,
                items=items,
                payment_choice=payment_choice,
                note=note,
            )
            self._set_date(record, days_ago=days_ago, hour=hour)
            Payment.objects.filter(sale=record).update(paid_at=self._date(days_ago, hour))
            return record

        today_cash = sale(0, 9, [
            {'product_id': bread.pk, 'quantity': 3, 'unit_price': 4000},
            {'product_id': milk.pk, 'quantity': 2},
        ])
        today_card = sale(0, 11, [
            {'product_id': milk.pk, 'quantity': 3},
            {'product_id': eggs.pk, 'quantity': 2},
            {'product_id': tea.pk, 'quantity': 1},
        ], payment_choice='card')
        today_debt = sale(0, 13, [
            {'product_id': rice.pk, 'quantity': 1},
            {'product_id': oil.pk, 'quantity': 1},
        ], payment_choice='debt', note='Jamshid Karimov · +998901234567')
        add_payment(sale_id=today_debt.pk, method=Payment.Method.CASH, amount=12000)

        yesterday = sale(1, 10, [
            {'product_id': rice.pk, 'quantity': 2},
            {'product_id': bread.pk, 'quantity': 2},
        ])
        recent_card = sale(2, 15, [
            {'product_id': milk.pk, 'quantity': 2},
            {'product_id': tea.pk, 'quantity': 3},
        ], payment_choice='card')
        historical_debt = sale(8, 12, [
            {'product_id': rice.pk, 'quantity': 1},
            {'product_id': sugar.pk, 'quantity': 2},
        ], payment_choice='debt', note='Madina Qodirova · +998907654321')
        last_month = sale(25, 14, [
            {'product_id': oil.pk, 'quantity': 2},
            {'product_id': sugar.pk, 'quantity': 3},
        ])
        older_sale = sale(3, 16, [
            {'product_id': eggs.pk, 'quantity': 3},
            {'product_id': pasta.pk, 'quantity': 2},
        ])

        return_item = today_card.items.get(product=eggs)
        returned = return_sale_item(sale_item_id=return_item.pk, user=staff, quantity=1)
        ReturnRecord.objects.filter(pk=returned.pk).update(created_at=self._date(0, 11, 30))
        Payment.objects.filter(sale=today_card).update(paid_at=self._date(0, 11, 30))
        add_payment(sale_id=historical_debt.pk, method=Payment.Method.CARD, amount=10000)
        Payment.objects.filter(sale=historical_debt).update(paid_at=self._date(8, 12))

        self.stdout.write(self.style.SUCCESS(
            'Loaded demo data: 8 products, 8 sales across today and recent dates, 2 restocks, '
            'one partial return, and two partially paid debt sales.'
        ))
        self.stdout.write('Existing owner, staff, and Django admin logins were preserved.')

    @staticmethod
    def _date(days_ago, hour, minute=0):
        local_day = timezone.localdate() - timedelta(days=days_ago)
        local_time = timezone.make_aware(datetime.combine(local_day, time(hour, minute)))
        return local_time

    def _set_date(self, record, days_ago, hour):
        record.__class__.objects.filter(pk=record.pk).update(
            created_at=self._date(days_ago, hour),
        )
