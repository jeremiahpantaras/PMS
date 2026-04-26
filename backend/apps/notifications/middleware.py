"""
JWT Auth middleware for the notifications WebSocket.

Delegates to apps.common.ws_auth — see that module for the full
implementation and the security rationale for using the
Sec-WebSocket-Protocol header instead of URL query params.
"""
from apps.common.ws_auth import JWTAuthMiddleware, JWTAuthMiddlewareStack  # noqa: F401


@database_sync_to_async
def get_user_from_token(token_str: str):
    try:
        from rest_framework_simplejwt.tokens import UntypedToken
        from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
        from django.contrib.auth import get_user_model

        User = get_user_model()
        UntypedToken(token_str)  # validates signature + expiry

        from rest_framework_simplejwt.state import token_backend
        data    = token_backend.decode(token_str, verify=True)
        user_id = data.get('user_id')
        return User.objects.get(id=user_id)

    except Exception as exc:
        logger.debug('NotificationJWTMiddleware: invalid token — %s', exc)
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Drop-in middleware that authenticates WebSocket connections via JWT.
    """

    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        params       = parse_qs(query_string)
        token_list   = params.get('token', [])

        token_str = token_list[0] if token_list else None

        if not token_str:
            headers = dict(scope.get('headers', []))
            protocol_header = headers.get(b'sec-websocket-protocol', b'').decode()
            if protocol_header:
                parts = [p.strip() for p in protocol_header.split(',')]
                for part in parts:
                    if part and part.lower() != 'bearer':
                        token_str = part
                        break

        scope['user'] = (
            await get_user_from_token(token_str)
            if token_str
            else AnonymousUser()
        )

        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)