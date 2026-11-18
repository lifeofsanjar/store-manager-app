from django.contrib import admin

from .models import Payment, Product, Restock, RestockItem, ReturnRecord, Sale, SaleItem, User
from .services import sale_debt


class ReadOnlyAdmin(admin.ModelAdmin):
    def get_readonly_fields(self, request, obj=None):
        return tuple(field.name for field in self.model._meta.concrete_fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    can_delete = False
    fields = ('product', 'quantity', 'unit_price', 'buy_price')
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class RestockItemInline(admin.TabularInline):
    model = RestockItem
    extra = 0
    can_delete = False
    fields = ('product', 'quantity', 'buy_price')
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Product)
class ProductAdmin(ReadOnlyAdmin):
    list_display = ('name', 'barcode', 'sell_price', 'buy_price', 'stock_qty', 'min_stock', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'barcode')
    ordering = ('name', 'id')


@admin.register(Sale)
class SaleAdmin(ReadOnlyAdmin):
    list_display = ('id', 'created_at', 'user', 'total_amount', 'debt_amount')
    list_select_related = ('user',)
    search_fields = ('id', 'note', 'user__name', 'user__login')
    inlines = (SaleItemInline,)

    @admin.display(description='Qoldiq qarz')
    def debt_amount(self, obj):
        return sale_debt(obj)


@admin.register(Restock)
class RestockAdmin(ReadOnlyAdmin):
    list_display = ('id', 'created_at', 'user', 'note')
    list_select_related = ('user',)
    search_fields = ('id', 'note', 'user__name', 'user__login')
    inlines = (RestockItemInline,)


@admin.register(SaleItem)
class SaleItemAdmin(ReadOnlyAdmin):
    list_display = ('id', 'sale', 'product', 'quantity', 'unit_price', 'buy_price')
    list_select_related = ('sale', 'product')
    search_fields = ('sale__id', 'product__name', 'product__barcode')


@admin.register(Payment)
class PaymentAdmin(ReadOnlyAdmin):
    list_display = ('id', 'sale', 'method', 'amount', 'paid_at')
    list_select_related = ('sale',)
    list_filter = ('method',)
    search_fields = ('sale__id',)


@admin.register(ReturnRecord)
class ReturnRecordAdmin(ReadOnlyAdmin):
    list_display = ('id', 'sale_item', 'user', 'quantity', 'refund_amount', 'created_at')
    list_select_related = ('sale_item', 'user')
    search_fields = ('sale_item__sale__id', 'sale_item__product__name', 'user__name')


@admin.register(User)
class UserAdmin(ReadOnlyAdmin):
    fields = ('login', 'name', 'role', 'is_active', 'is_staff', 'is_superuser')
    list_display = ('login', 'name', 'role', 'is_active', 'is_staff', 'is_superuser')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('login', 'name')
