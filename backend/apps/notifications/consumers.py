import json
import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for real-time notification push.

    Each authenticated user joins their own private group:
        notifications_<user_id>

    The notification service pushes to ALL users in a clinic
    by iterating their individual groups.
    """

    async def connect(self):
        self.user = self.scope.get('user', AnonymousUser())

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.group_name = f'notifications_{self.user.id}'

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )
        # Echo the agreed subprotocol so the browser handshake completes cleanly.
        # When the client uses the subprotocol transport (production), 'bearer'
        # is in scope['subprotocols']. When using the legacy query-string path
        # (DEBUG / dev tooling) there is no proposed subprotocol.
        subprotocol = 'bearer' if 'bearer' in self.scope.get('subprotocols', []) else None
        await self.accept(subprotocol=subprotocol)

        logger.debug(
            '[WS:notifications] user %s connected to group %s',
            self.user.id, self.group_name,
        )

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )
        logger.debug(
            '[WS:notifications] user %s disconnected (code=%s)',
            getattr(self.user, 'id', '?'), close_code,
        )

    async def receive_json(self, content, **kwargs):
        """Handle incoming messages — currently just keepalive pings."""
        msg_type = content.get('type', '')

        if msg_type == 'ping':
            await self.send_json({'type': 'pong'})

    # ── Handler for notification.new events ───────────────────────────────────
    async def notification_new(self, event):
        """Called by channel layer group_send when a new notification is created."""
        await self.send_json({
            'type': 'notification.new',
            'notification': event['notification'],
        })

    # ── Handler for permissions_updated events ────────────────────────────────
    async def permissions_updated(self, event):
        """
        Called by channel layer group_send when an admin changes the
        permission group of this user (or updates the group's permissions).

        Sends a lightweight signal to the browser — no permission payload.
        The frontend reacts by calling /auth/me/ once to refresh its store.
        """
        await self.send_json({
            'type': 'permissions.updated',
            'user_id': event.get('user_id'),
        })