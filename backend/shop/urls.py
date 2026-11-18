from django.urls import path

from .api_views import (
    DebtListView,
    LoginView,
    LowStockListView,
    PaymentCreateView,
    ProductListView,
    RestockCreateView,
    ReturnCreateView,
    SaleCreateView,
    SaleDetailView,
    StatisticsView,
    StockCountView,
    TodaySalesView,
)

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='login'),
    path('products/', ProductListView.as_view(), name='product-list'),
    path('products/<int:product_id>/stock/', StockCountView.as_view(), name='product-stock'),
    path('sales/', SaleCreateView.as_view(), name='sale-create'),
    path('sales/today/', TodaySalesView.as_view(), name='today-sales'),
    path('sales/debts/', DebtListView.as_view(), name='debt-list'),
    path('sales/<int:sale_id>/', SaleDetailView.as_view(), name='sale-detail'),
    path('sales/<int:sale_id>/payments/', PaymentCreateView.as_view(), name='payment-create'),
    path('returns/', ReturnCreateView.as_view(), name='return-create'),
    path('restocks/', RestockCreateView.as_view(), name='restock-create'),
    path('statistics/', StatisticsView.as_view(), name='statistics'),
    path('low-stock/', LowStockListView.as_view(), name='low-stock'),
]
