from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.core.signing import BadSignature, SignatureExpired
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed


TOKEN_SALT = 'store-manager.access-token'


class SignedTokenAuthentication(BaseAuthentication):
    """Short-lived bearer tokens signed with Django's built-in signer."""

    keyword = b'Bearer'

    def authenticate(self, request):
        parts = get_authorization_header(request).split()
        if not parts:
            return None
        if parts[0].lower() != self.keyword.lower():
            return None
        if len(parts) != 2:
            raise AuthenticationFailed('Invalid authorization header.')

        try:
            payload = signing.loads(
                parts[1].decode('utf-8'),
                salt=TOKEN_SALT,
                max_age=settings.ACCESS_TOKEN_MAX_AGE_SECONDS,
            )
            user = get_user_model().objects.get(pk=payload['user_id'], is_active=True)
        except (BadSignature, SignatureExpired, UnicodeDecodeError, KeyError, TypeError):
            raise AuthenticationFailed('Invalid or expired access token.')
        except get_user_model().DoesNotExist:
            raise AuthenticationFailed('User is inactive or no longer exists.')

        return user, None

    def authenticate_header(self, request):
        return 'Bearer'
