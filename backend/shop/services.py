from collections import defaultdict

from django.db import IntegrityError, transaction
from django.db.models import Sum

from .models import Payment, Product, Restock, RestockItem, ReturnRecord, Sale, SaleItem


class BusinessRuleError(ValueError):
    """Raised when an operation would violate a store business rule."""


def sale_refund_total(sale):
    total = ReturnRecord.objects.filter(sale_item__sale=sale).aggregate(
        total=Sum('refund_amount'),
    )['total']
    return total or 0


def sale_paid_total(sale):
    return sum(sale.payments.values_list('amount', flat=True))


def sale_debt(sale):
    return sale.total_amount - sale_refund_total(sale) - sale_paid_total(sale)


@transaction.atomic
def create_sale(*, user, items, payment_choice, note=''):
    if not items:
        raise BusinessRuleError('At least one item is required.')
    if payment_choice not in {'cash', 'card', 'debt'}:
        raise BusinessRuleError('Payment choice must be cash, card, or debt.')

    requested_qty = defaultdict(int)
    for item in items:
        if item['quantity'] <= 0:
            raise BusinessRuleError('Item quantities must be greater than zero.')
        requested_qty[item['product_id']] += item['quantity']

    products = {
        product.pk: product
        for product in Product.objects.select_for_update().filter(
            pk__in=requested_qty,
            is_active=True,
        )
    }
    if len(products) != len(requested_qty):
        raise BusinessRuleError('One or more products are unavailable.')

    for product_id, quantity in requested_qty.items():
        if products[product_id].stock_qty < quantity:
            raise BusinessRuleError(
                f'Insufficient stock for product {products[product_id].name}.'
            )

    sale_lines = []
    total_amount = 0
    for item in items:
        product = products[item['product_id']]
        unit_price = item.get('unit_price', product.sell_price)
        if unit_price < 0:
            raise BusinessRuleError('Unit price cannot be negative.')
        total_amount += unit_price * item['quantity']
        sale_lines.append((product, item['quantity'], unit_price, product.buy_price))

    note = note.strip()
    if payment_choice == 'debt' and not note:
        raise BusinessRuleError('Customer name and phone are required for a debt sale.')

    sale = Sale.objects.create(user=user, total_amount=total_amount, note=note)
    SaleItem.objects.bulk_create([
        SaleItem(
            sale=sale,
            product=product,
            quantity=quantity,
            unit_price=unit_price,
            buy_price=buy_price,
        )
        for product, quantity, unit_price, buy_price in sale_lines
    ])

    for product_id, quantity in requested_qty.items():
        product = products[product_id]
        product.stock_qty -= quantity
        product.save(update_fields=['stock_qty'])

    if payment_choice in {'cash', 'card'}:
        Payment.objects.create(sale=sale, method=payment_choice, amount=total_amount)

    return sale


@transaction.atomic
def add_payment(*, sale_id, method, amount):
    if method not in Payment.Method.values:
        raise BusinessRuleError('Payment method must be cash or card.')
    if amount <= 0:
        raise BusinessRuleError('Payment amount must be greater than zero.')

    sale = Sale.objects.select_for_update().get(pk=sale_id)
    debt = sale_debt(sale)
    if debt <= 0:
        raise BusinessRuleError('This sale has no outstanding debt.')
    if amount > debt:
        raise BusinessRuleError('Payment cannot exceed the outstanding debt.')

    return Payment.objects.create(sale=sale, method=method, amount=amount)


def _record_refund_payments(sale, amount):
    payment_rows = list(sale.payments.order_by('-paid_at', '-id'))
    net_by_method = {
        method: sum(payment.amount for payment in payment_rows if payment.method == method)
        for method in Payment.Method.values
    }
    method_order = []
    for payment in payment_rows:
        if payment.amount > 0 and payment.method not in method_order:
            method_order.append(payment.method)

    remaining = amount
    for method in method_order:
        allocation = min(max(net_by_method[method], 0), remaining)
        if allocation:
            Payment.objects.create(sale=sale, method=method, amount=-allocation)
            remaining -= allocation
        if not remaining:
            return

    if remaining:
        raise BusinessRuleError('Refund exceeds the sale amount paid.')


@transaction.atomic
def return_sale_item(*, sale_item_id, user, quantity):
    if quantity <= 0:
        raise BusinessRuleError('Return quantity must be greater than zero.')

    sale_item = (
        SaleItem.objects.select_for_update()
        .select_related('sale', 'product')
        .get(pk=sale_item_id)
    )
    already_returned = sum(sale_item.returns.values_list('quantity', flat=True))
    available_qty = sale_item.quantity - already_returned
    if quantity > available_qty:
        raise BusinessRuleError('Return quantity exceeds the remaining sold quantity.')

    debt_before_return = max(sale_debt(sale_item.sale), 0)
    refund_amount = quantity * sale_item.unit_price
    refund_due = max(refund_amount - debt_before_return, 0)
    return_record = ReturnRecord.objects.create(
        sale_item=sale_item,
        user=user,
        quantity=quantity,
        refund_amount=refund_amount,
    )

    product = Product.objects.select_for_update().get(pk=sale_item.product_id)
    product.stock_qty += quantity
    product.save(update_fields=['stock_qty'])

    if refund_due:
        _record_refund_payments(sale_item.sale, refund_due)

    return return_record


@transaction.atomic
def create_restock(*, user, items, note=''):
    if not items:
        raise BusinessRuleError('At least one item is required.')

    for item in items:
        has_product_id = 'product_id' in item
        has_new_product = 'new_product' in item
        if has_product_id == has_new_product:
            raise BusinessRuleError('Each restock item must select or define one product.')
        if item['quantity'] <= 0:
            raise BusinessRuleError('Restock quantities must be greater than zero.')
        if item['buy_price'] < 0:
            raise BusinessRuleError('Buying price cannot be negative.')

    requested_ids = {item['product_id'] for item in items if 'product_id' in item}
    products = {
        product.pk: product
        for product in Product.objects.select_for_update().filter(pk__in=requested_ids)
    }
    if len(products) != len(requested_ids):
        raise BusinessRuleError('One or more products were not found.')

    resolved_items = []
    for item in items:
        if 'product_id' in item:
            product = products[item['product_id']]
        else:
            data = item['new_product']
            try:
                with transaction.atomic():
                    product = Product.objects.create(
                        name=data['name'].strip(),
                        barcode=data['barcode'].strip(),
                        sell_price=data['sell_price'],
                        buy_price=item['buy_price'],
                        min_stock=data.get('min_stock', 0),
                    )
            except IntegrityError as error:
                raise BusinessRuleError('Product barcode is already in use.') from error
            products[product.pk] = product
        resolved_items.append((item, product))

    restock = Restock.objects.create(user=user, note=note.strip())
    RestockItem.objects.bulk_create([
        RestockItem(
            restock=restock,
            product=product,
            quantity=item['quantity'],
            buy_price=item['buy_price'],
        )
        for item, product in resolved_items
    ])

    for item, product in resolved_items:
        product.stock_qty += item['quantity']
        product.buy_price = item['buy_price']
        product.save(update_fields=['stock_qty', 'buy_price'])

    return restock


@transaction.atomic
def set_stock_count(*, product_id, stock_qty, buy_price=None, sell_price=None):
    if stock_qty < 0:
        raise BusinessRuleError('Stock quantity cannot be negative.')
    product = Product.objects.select_for_update().get(pk=product_id)
    product.stock_qty = stock_qty
    update_fields = ['stock_qty']
    if buy_price is not None:
        product.buy_price = buy_price
        update_fields.append('buy_price')
    if sell_price is not None:
        product.sell_price = sell_price
        update_fields.append('sell_price')
    product.save(update_fields=update_fields)
    return product
