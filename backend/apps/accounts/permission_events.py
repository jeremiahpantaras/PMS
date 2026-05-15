"""
Utility for notifying connected clients about RBAC permission changes.

Sends a lightweight WebSocket event to the affected user's private channel
group (notifications_<user_id>) — the same group already used by the
NotificationConsumer.  The payload contains only the event type and the
user ID; no permission data is transmitted over the wire.

The frontend receives the event and performs a single /auth/me/ refresh to
pick up the latest permissions_map.

Usage (from a Django view or serializer):

    from apps.accounts.permission_events import emit_permissions_updated
    emit_permissions_updated(user_id=target_user.pk)
"""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def emit_permissions_updated(user_id: int) -> None:
    """
    Emit a lightweight permissions_updated event to a single user.

    The event is delivered via the existing notifications_{user_id} channel
    group so no new WebSocket endpoint is required.

    Args:
        user_id: Primary key of the user whose permissions were changed.
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        # Channel layer is optional (e.g. in unit tests without Redis).
        logger.debug(
            '[permission_events] No channel layer configured — skipping push for user %s.',
            user_id,
        )
        return

    group_name = f'notifications_{user_id}'
    try:
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'permissions_updated',   # maps to handler method name (dot → underscore)
                'user_id': user_id,
            },
        )
        logger.debug(
            '[permission_events] permissions_updated sent to group %s', group_name,
        )
    except Exception as exc:
        # Non-fatal: the user will see updated permissions on next page reload.
        logger.warning(
            '[permission_events] Failed to emit to user %s: %s', user_id, exc,
        )
