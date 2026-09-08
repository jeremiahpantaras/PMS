"""
gateway/authentication.py

Custom DRF authentication class for physical Android gateway devices.

Usage:
    Devices authenticate with a Bearer token in the Authorization header:
        Authorization: Bearer <device_token>

    Views using this class receive request.gateway_device populated with
    the authenticated GatewayDevice instance.

    To use in a view:
        authentication_classes = [GatewayDeviceAuthentication]
        permission_classes = [IsActiveGatewayDevice]
"""
import logging
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission
from .models import GatewayDevice

logger = logging.getLogger(__name__)


def _extract_bearer_token(request):
    """
    Extract the token value from an Authorization: Bearer <token> header.
    Returns the token string or None if the header is absent/malformed.
    """
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:].strip()
    return None


class GatewayDeviceAuthentication(BaseAuthentication):
    """
    DRF authentication class for physical Android gateway devices.

    Authenticates requests using a per-device Bearer token stored in
    GatewayDevice.device_token.

    On success:
        - request.user is set to AnonymousUser (gateway devices are not Django users)
        - request.auth is set to the GatewayDevice instance
        - request.gateway_device is set to the GatewayDevice instance (convenience attribute)

    On failure:
        - Returns None (no credentials present) → DRF proceeds to next authenticator
        - Raises AuthenticationFailed (invalid/unknown token) → 401
    """

    def authenticate(self, request):
        token = _extract_bearer_token(request)
        if not token:
            return None  # No bearer token — let DRF try other authenticators

        try:
            device = GatewayDevice.objects.get(device_token=token)
        except GatewayDevice.DoesNotExist:
            raise AuthenticationFailed("Invalid device token.")

        # Attach device to request for convenient access in views
        request.gateway_device = device
        # Return (user, auth) tuple — device is not a Django user
        return (None, device)

    def authenticate_header(self, request):
        return 'Bearer realm="gateway"'


class IsActiveGatewayDevice(BasePermission):
    """
    DRF permission class for gateway device endpoints.

    Grants access only if:
    1. The request was authenticated via GatewayDeviceAuthentication
    2. The device has is_active=True and status='ACTIVE'

    Returns 403 Forbidden for inactive/suspended devices.
    """
    message = "This gateway device is inactive or suspended."

    def has_permission(self, request, view):
        device = getattr(request, 'gateway_device', None)
        if device is None:
            return False
        return device.is_active and device.status == GatewayDevice.STATUS_CHOICES[0][0]
