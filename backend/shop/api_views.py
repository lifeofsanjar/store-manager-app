from datetime import datetime, time, timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.db.models import F, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import TOKEN_SALT
from .models import Product, ReturnRecord, Sale, SaleItem
from .permissions import IsOwner
from .serializers import (
    LoginSerializer,
    PaymentCreateSerializer,
    ProductSerializer,
    RestockCreateSerializer,
    ReturnCreateSerializer,
    SaleCreateSerializer,
    StockCountSerializer,
    serialize_return,
    serialize_sale,
)
from .services import (
    BusinessRuleError,
    add_payment,
    create_restock,
    create_sale,
    return_sale_item,
    sale_debt,
    set_stock_count,
)

_DUMMY_PASSWORD_HASH = make_password('store-manager-placeholder-account-password')


def business_error_response(error):
    return Response({'detail': str(error)}, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        login = serializer.validated_data['login']
        user = get_user_model().objects.filter(login=login, is_active=True).first()
        password = serializer.validated_data['password']
        if user is None:
            check_password(password, _DUMMY_PASSWORD_HASH)
        if user is None or not user.check_password(password):
            return Response(
                {'detail': 'Invalid login or password.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.core import signing

        token = signing.dumps({'user_id': user.pk}, salt=TOKEN_SALT)
        return Response({
            'access_token': token,
            'token_type': 'Bearer',
            'expires_in': settings.ACCESS_TOKEN_MAX_AGE_SECONDS,
            'user': {'id': user.pk, 'name': user.name, 'login': user.login, 'role': user.role},
        })


class ProductListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        products = Product.objects.filter(is_active=True)
        barcode = request.query_params.get('barcode', '').strip()
        query = request.query_params.get('q', '').strip()
        if barcode:
            products = products.filter(barcode__iexact=barcode)
        elif query:
            products = products.filter(name__icontains=query) | products.filter(
                barcode__icontains=query,
            )
        return Response(ProductSerializer(products.distinct(), many=True).data)


class SaleCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SaleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            sale = create_sale(user=request.user, **serializer.validated_data)
        except BusinessRuleError as error:
            return business_error_response(error)
        return Response(serialize_sale(sale, sale_debt(sale)), status=status.HTTP_201_CREATED)


class TodaySalesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        sales = (
            Sale.objects.filter(created_at__date=today)
            .select_related('user')
            .prefetch_related('items__product', 'items__returns', 'payments')
        )
        return Response([
            serialize_sale(sale, sale_debt(sale))
            for sale in sales
        ])


class SaleDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, sale_id):
        sale = get_object_or_404(
            Sale.objects.select_related('user').prefetch_related(
                'items__product', 'items__returns', 'payments',
            ),
            pk=sale_id,
        )
        return Response(serialize_sale(sale, sale_debt(sale)))


class PaymentCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, sale_id):
        serializer = PaymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not Sale.objects.filter(pk=sale_id).exists():
            return Response({'detail': 'Sale not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            payment = add_payment(sale_id=sale_id, **serializer.validated_data)
        except BusinessRuleError as error:
            return business_error_response(error)
        return Response({
            'id': payment.pk,
            'sale_id': payment.sale_id,
            'method': payment.method,
            'amount': payment.amount,
            'paid_at': payment.paid_at,
        }, status=status.HTTP_201_CREATED)


class DebtListView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        sales = (
            Sale.objects.select_related('user')
            .prefetch_related('items__returns', 'payments')
            .order_by('created_at', 'id')
        )
        debts = []
        for sale in sales:
            outstanding = sale_debt(sale)
            if outstanding > 0:
                debts.append({
                    'sale_id': sale.pk,
                    'created_at': sale.created_at,
                    'unpaid_amount': outstanding,
                    'note': sale.note,
                })
        return Response(debts)


class ReturnCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ReturnCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sale_item_id = serializer.validated_data.pop('sale_item_id')
        try:
            return_record = return_sale_item(
                sale_item_id=sale_item_id,
                user=request.user,
                **serializer.validated_data,
            )
        except SaleItem.DoesNotExist:
            return Response({'detail': 'Sale item not found.'}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleError as error:
            return business_error_response(error)
        return Response(serialize_return(return_record), status=status.HTTP_201_CREATED)


class RestockCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = RestockCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            restock = create_restock(user=request.user, **serializer.validated_data)
        except BusinessRuleError as error:
            return business_error_response(error)
        return Response({
            'id': restock.pk,
            'user_id': restock.user_id,
            'note': restock.note,
            'created_at': restock.created_at,
        }, status=status.HTTP_201_CREATED)


class StockCountView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, product_id):
        serializer = StockCountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        price_fields = {'buy_price', 'sell_price'} & serializer.validated_data.keys()
        if price_fields and request.user.role != 'owner':
            return Response(
                {'detail': 'Only the owner can change product prices.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not Product.objects.filter(pk=product_id).exists():
            return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            product = set_stock_count(
                product_id=product_id,
                **serializer.validated_data,
            )
        except BusinessRuleError as error:
            return business_error_response(error)
        return Response(ProductSerializer(product).data)


class LowStockListView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        products = Product.objects.filter(
            is_active=True,
            stock_qty__lt=F('min_stock'),
        ).order_by('stock_qty', 'name')
        return Response(ProductSerializer(products, many=True).data)


class StatisticsView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        period = request.query_params.get('period', 'day')
        local_today = timezone.localdate()
        if period == 'day':
            start_date = local_today
        elif period == 'week':
            start_date = local_today - timedelta(days=local_today.weekday())
        elif period == 'month':
            start_date = local_today.replace(day=1)
        else:
            raise ValidationError({'period': 'Choose day, week, or month.'})

        end_date = local_today + timedelta(days=1)
        start_at = timezone.make_aware(datetime.combine(start_date, time.min))
        end_at = timezone.make_aware(datetime.combine(end_date, time.min))
        sales = list(Sale.objects.filter(created_at__gte=start_at, created_at__lt=end_at))
        sale_ids = [sale.pk for sale in sales]

        refunds = ReturnRecord.objects.filter(
            sale_item__sale_id__in=sale_ids,
        ).aggregate(total=Sum('refund_amount'))['total'] or 0
        items = list(SaleItem.objects.filter(sale_id__in=sale_ids).select_related('product').annotate(
            returned_quantity=Sum('returns__quantity'),
        ))
        profit = sum(
            (item.unit_price - item.buy_price)
            * (item.quantity - (item.returned_quantity or 0))
            for item in items
        )
        products = {}
        units_sold = 0
        for item in items:
            sold_quantity = item.quantity - (item.returned_quantity or 0)
            if sold_quantity <= 0:
                continue
            units_sold += sold_quantity
            product = products.setdefault(item.product_id, {
                'product_id': item.product_id,
                'product_name': item.product.name,
                'barcode': item.product.barcode,
                'quantity': 0,
                'revenue': 0,
            })
            product['quantity'] += sold_quantity
            product['revenue'] += sold_quantity * item.unit_price
        gross_sales = sum(sale.total_amount for sale in sales)
        top_products = sorted(
            products.values(),
            key=lambda product: (-product['quantity'], -product['revenue'], product['product_name']),
        )[:5]
        return Response({
            'period': period,
            'from': start_date,
            'through': local_today,
            'sales_total': gross_sales - refunds,
            'profit': profit,
            'sales_count': len(sales),
            'units_sold': units_sold,
            'top_products': top_products,
        })
