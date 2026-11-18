from django.contrib.auth.hashers import check_password, make_password
from django.conf import settings
from django.db import models
from django.utils.crypto import salted_hmac


class UserManager(models.Manager):
    def get_by_natural_key(self, login):
        return self.get(login=login)

    def create_user(self, login, name, role='staff', password=None, **extra_fields):
        if not login:
            raise ValueError('A login is required.')
        if not password:
            raise ValueError('A password is required.')
        if role not in User.Role.values:
            raise ValueError('Role must be owner or staff.')

        user = self.model(
            login=login.strip(),
            name=name.strip(),
            role=role,
            password=make_password(password),
            **extra_fields,
        )
        user.save(using=self._db)
        return user

    def create_superuser(self, login, name, role='owner', password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        if extra_fields['is_staff'] is not True or extra_fields['is_superuser'] is not True:
            raise ValueError('A superuser must have is_staff=True and is_superuser=True.')
        return self.create_user(login, name, role, password, **extra_fields)


class User(models.Model):
    class Role(models.TextChoices):
        OWNER = 'owner', 'Owner'
        STAFF = 'staff', 'Staff'

    password = models.CharField(max_length=128, db_column='password_hash')
    name = models.CharField(max_length=150)
    login = models.CharField(max_length=150, unique=True)
    role = models.CharField(max_length=5, choices=Role.choices, default=Role.STAFF)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    USERNAME_FIELD = 'login'
    REQUIRED_FIELDS = ['name']

    objects = UserManager()

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.name

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def check_password(self, raw_password):
        return check_password(raw_password, self.password)

    def set_password(self, raw_password):
        self.password = make_password(raw_password)
        self._password = raw_password

    def get_username(self):
        return self.login

    def get_full_name(self):
        return self.name

    def get_short_name(self):
        return self.name

    def has_perm(self, perm, obj=None):
        return self.is_active and self.is_superuser

    def has_module_perms(self, app_label):
        return self.is_active and self.is_superuser

    def get_session_auth_hash(self):
        return salted_hmac(
            'django.contrib.auth.models.AbstractBaseUser.get_session_auth_hash',
            self.password,
            secret=settings.SECRET_KEY,
            algorithm='sha256',
        ).hexdigest()

    def get_session_auth_fallback_hash(self):
        for secret in settings.SECRET_KEY_FALLBACKS:
            yield salted_hmac(
                'django.contrib.auth.models.AbstractBaseUser.get_session_auth_hash',
                self.password,
                secret=secret,
                algorithm='sha256',
            ).hexdigest()


class Product(models.Model):
    name = models.CharField(max_length=200)
    barcode = models.CharField(max_length=100, unique=True)
    sell_price = models.PositiveBigIntegerField()
    buy_price = models.PositiveBigIntegerField()
    stock_qty = models.PositiveIntegerField(default=0)
    min_stock = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'products'
        ordering = ['name', 'id']

    def __str__(self):
        return self.name


class Sale(models.Model):
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='sales')
    total_amount = models.PositiveBigIntegerField()
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sales'
        ordering = ['-created_at', '-id']


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='sale_items')
    quantity = models.PositiveIntegerField()
    unit_price = models.PositiveBigIntegerField()
    buy_price = models.PositiveBigIntegerField()

    class Meta:
        db_table = 'sale_items'


class Payment(models.Model):
    class Method(models.TextChoices):
        CASH = 'cash', 'Cash'
        CARD = 'card', 'Card'

    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='payments')
    method = models.CharField(max_length=4, choices=Method.choices)
    # Negative amounts represent refunds of money that was already paid.
    amount = models.BigIntegerField()
    paid_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payments'
        ordering = ['paid_at', 'id']


class ReturnRecord(models.Model):
    sale_item = models.ForeignKey(
        SaleItem,
        on_delete=models.CASCADE,
        related_name='returns',
    )
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='returns')
    quantity = models.PositiveIntegerField()
    refund_amount = models.PositiveBigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'returns'
        ordering = ['-created_at', '-id']


class Restock(models.Model):
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='restocks')
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'restocks'
        ordering = ['-created_at', '-id']


class RestockItem(models.Model):
    restock = models.ForeignKey(Restock, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='restock_items')
    quantity = models.PositiveIntegerField()
    buy_price = models.PositiveBigIntegerField()

    class Meta:
        db_table = 'restock_items'
