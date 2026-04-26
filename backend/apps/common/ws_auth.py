"""
Shared JWT WebSocket authentication middleware for Django Channels.

SECURITY: tokens are read from the Sec-WebSocket-Protocol subprotocol
header rather than the URL query string.

Why?
  URL query params appear verbatim in server access logs, browser history,
  and Referrer headers — all of which can leak to third parties.
  Browsers cannot set custom HTTP headers on WebSocket upgrades, but they
  CAN pass values via the second argument to new WebSocket():

      new WebSocket(url, ['bearer', '<access_token>'])

  The browser sends:
      Sec-WebSocket-Protocol: bearer, <access_token>

  The server reads the token from that header (never from the URL).
  The server echoes back 'bearer' in the accept so the browser sees
  ws.protocol === 'bearer'.

DEBUG fallback:
  In DEBUG=True the middleware still accepts the legacy ?token= query
  param so dev tooling (wscat, Postman) continues to work.
"""

import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.conf import settings
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger(__name__)


@database_sync_to_async
def _get_user_from_token(token_str: str):
    """Validate a JWT access token and return the associated User, or AnonymousUser."""
    try:
        from rest_framework_simplejwt.tokens import AccessToken
        from django.contrib.auth import get_user_model

        User = get_user_model()
        token = AccessToken(token_str)          # validates signature & expiry
        return User.objects.get(
            pk=token['user_id'],
            is_active=True,
            is_deleted=False,
        )
    except Exception as exc:
        logger.debug('WS JWT auth failed: %s', type(exc).__name__)
        return AnonymousUser()


def _extract_token(scope: dict) -> str | None:
    """
    Extract the JWT from the WebSocket handshake.

    Priority:
      1. Sec-WebSocket-Protocol header  →  new WebSocket(url, ['bearer', '<token>'])
         (preferred — never written to access logs)
      2. ?token= query string param
         (only in DEBUG mode — for dev tooling like wscat / Postman)
    """
    # ── 1. Subprotocol header (production-safe) ──────────────────────────────
    headers = dict(scope.get('headers', []))
    proto_header = headers.get(b'sec-websocket-protocol', b'').decode('ascii', errors='ignore')
    if proto_header:
        # Browser sends: "bearer, eyJhbGci..."  (comma-separated list)
        parts = [p.strip() for p in proto_header.split(',')]
        for part in parts:
            if part and part.lower() != 'bearer':
                return part     # first non-'bearer' segment is the JWT

    # ── 2. Query-string fallback (dev only) ───────────────────────────────────
    if settings.DEBUG:
        qs = scope.get('query_string', b'').decode('utf-8', errors='ignore')
        params = parse_qs(qs)
        token_list = params.get('token', [])
        if token_list:
            logger.debug('WS: token read from query-string (DEBUG mode only)')
            return token_list[0]

    return None


class JWTAuthMiddleware(BaseMiddleware):
    """
    Single, shared JWT middleware for all WebSocket consumers.
    Populates scope['user'] before the consumer sees the connection.
    """

    async def __call__(self, scope, receive, send):
        if scope['type'] == 'websocket':
            token = _extract_token(scope)
            scope['user'] = (
                await _get_user_from_token(token)
                if token
                else AnonymousUser()
            )
        return await super().__call__(scope, receive, send)


# Compatibility alias kept so any existing import of JWTAuthMiddlewareStack
# from either middleware module continues to work without changes.
def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)
