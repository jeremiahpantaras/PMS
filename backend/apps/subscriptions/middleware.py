import logging

from django.core.cache import cache
from django.http import JsonResponse
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

logger = logging.getLogger(__name__)

# Paths that never require an active subscription
EXEMPT_PATHS = [
    '/api/auth/',
    '/api/subscription/',
    '/admin/',
]

# Cache TTL in seconds — short enough to react to webhook activations promptly
_CACHE_TTL = 60


class SubscriptionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.jwt_authenticator = JWTAuthentication()

    def _resolve_user(self, request):
        if getattr(request, 'user', None) and request.user.is_authenticated:
            return request.user

        try:
            auth_result = self.jwt_authenticator.authenticate(request)
        except (AuthenticationFailed, InvalidToken, TokenError):
            return None
        except Exception:
            return None

        if auth_result is None:
            return None

        user, _ = auth_result
        return user

    def _is_subscription_active(self, user) -> bool:
        """
        Returns True if the user's subscription is active.
        Result is cached per-user for _CACHE_TTL seconds to minimise DB hits.
        Cache is invalidated by Subscription.expire() / activate_from_webhook() etc.
        """
        cache_key = f'sub_active_{user.pk}'
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            subscription = user.subscription
        except AttributeError:
            # No subscription row — treat as inactive
            cache.set(cache_key, False, _CACHE_TTL)
            return False

        active = subscription.is_active()
        cache.set(cache_key, active, _CACHE_TTL)
        return active

    def __call__(self, request):
        if not request.path.startswith('/api/'):
            return self.get_response(request)

        if any(request.path.startswith(path) for path in EXEMPT_PATHS):
            return self.get_response(request)

        user = self._resolve_user(request)
        if user and not self._is_subscription_active(user):
            return JsonResponse(
                {
                    'error': 'Subscription expired',
                    'message': 'Your subscription has expired. Please subscribe to continue.',
                    'redirect': '/setup/account/subscription',
                },
                status=403,
            )

        return self.get_response(request)

