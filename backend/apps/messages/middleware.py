"""
JWT Auth middleware for the messages / presence WebSocket.

Delegates to apps.common.ws_auth — see that module for the full
implementation and the security rationale for using the
Sec-WebSocket-Protocol header instead of URL query params.
"""
from apps.common.ws_auth import JWTAuthMiddleware, JWTAuthMiddlewareStack  # noqa: F401