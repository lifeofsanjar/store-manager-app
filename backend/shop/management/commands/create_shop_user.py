from getpass import getpass

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Create an owner or staff login for the shop.'

    def add_arguments(self, parser):
        parser.add_argument('--login', required=True)
        parser.add_argument('--name', required=True)
        parser.add_argument('--role', choices=['owner', 'staff'], required=True)

    def handle(self, *args, **options):
        User = get_user_model()
        login = options['login'].strip()
        name = options['name'].strip()
        if not login or not name:
            raise CommandError('Login and name cannot be empty.')
        if User.objects.filter(login=login).exists():
            raise CommandError('That login is already in use.')

        password = getpass('Password: ')
        confirmation = getpass('Confirm password: ')
        if not password or password != confirmation:
            raise CommandError('Passwords are empty or do not match.')

        candidate = User(login=login, name=name, role=options['role'])
        try:
            validate_password(password, user=candidate)
        except ValidationError as error:
            raise CommandError(str(error)) from error

        User.objects.create_user(
            login=login,
            name=name,
            role=options['role'],
            password=password,
        )
        self.stdout.write(self.style.SUCCESS(f"Created {options['role']} user '{login}'."))
