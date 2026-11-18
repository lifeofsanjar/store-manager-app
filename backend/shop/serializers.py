from rest_framework import serializers

from .models import Payment, Product, ReturnRecord, Sale, SaleItem


class LoginSerializer(serializers.Serializer):
    login = serializers.CharField(max_length=150, trim_whitespace=True)
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'barcode', 'sell_price', 'buy_price',
            'stock_qty', 'min_stock', 'is_active',
        ]
        read_only_fields = fields


class SaleItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.IntegerField(min_value=0, required=False)


class SaleCreateSerializer(serializers.Serializer):
    items = SaleItemInputSerializer(many=True, allow_empty=False)
    payment_choice = serializers.ChoiceField(choices=['cash', 'card', 'debt'])
    note = serializers.CharField(allow_blank=True, required=False, default='')


class PaymentCreateSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=Payment.Method.choices)
    amount = serializers.IntegerField(min_value=1)


class ReturnCreateSerializer(serializers.Serializer):
    sale_item_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


class NewProductSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    barcode = serializers.CharField(max_length=100)
    sell_price = serializers.IntegerField(min_value=0)
    min_stock = serializers.IntegerField(min_value=0, required=False, default=0)


class RestockItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1, required=False)
    new_product = NewProductSerializer(required=False)
    quantity = serializers.IntegerField(min_value=1)
    buy_price = serializers.IntegerField(min_value=0)

    def validate(self, attrs):
        if ('product_id' in attrs) == ('new_product' in attrs):
            raise serializers.ValidationError(
                'Provide either product_id or new_product, but not both.',
            )
        if 'new_product' in attrs:
            attrs['new_product']['name'] = attrs['new_product']['name'].strip()
            attrs['new_product']['barcode'] = attrs['new_product']['barcode'].strip()
            if not attrs['new_product']['name'] or not attrs['new_product']['barcode']:
                raise serializers.ValidationError('Product name and barcode are required.')
        return attrs


class RestockCreateSerializer(serializers.Serializer):
    items = RestockItemInputSerializer(many=True, allow_empty=False)
    note = serializers.CharField(allow_blank=True, required=False, default='')


class StockCountSerializer(serializers.Serializer):
    stock_qty = serializers.IntegerField(min_value=0)
    buy_price = serializers.IntegerField(min_value=0, required=False)
    sell_price = serializers.IntegerField(min_value=0, required=False)


def serialize_sale_item(item):
    returned_qty = sum(item.returns.values_list('quantity', flat=True))
    return {
        'id': item.pk,
        'product_id': item.product_id,
        'product_name': item.product.name,
        'barcode': item.product.barcode,
        'quantity': item.quantity,
        'returned_quantity': returned_qty,
        'remaining_quantity': item.quantity - returned_qty,
        'unit_price': item.unit_price,
        'buy_price': item.buy_price,
    }


def serialize_sale(sale, debt):
    return {
        'id': sale.pk,
        'user_id': sale.user_id,
        'staff_name': sale.user.name,
        'total_amount': sale.total_amount,
        'note': sale.note,
        'created_at': sale.created_at,
        'debt': debt,
        'items': [serialize_sale_item(item) for item in sale.items.select_related('product')],
    }


def serialize_return(return_record):
    return {
        'id': return_record.pk,
        'sale_item_id': return_record.sale_item_id,
        'user_id': return_record.user_id,
        'quantity': return_record.quantity,
        'refund_amount': return_record.refund_amount,
        'created_at': return_record.created_at,
    }
