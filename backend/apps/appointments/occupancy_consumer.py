"""
OccupancyConsumer — real-time occupancy push via WebSocket.

Each authenticated user joins their organisation's occupancy channel group:
    occupancy_{main_clinic_id}

The backend broadcasts appointment status changes to this group via
occupancy_events.emit_occupancy_update() from a post_save signal.
This consumer forwards those broadcasts to the connected browser.

URL:  ws/occupancy/
Auth: JWT subprotocol (same as CalendarConsumer).
"""

import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger(__name__)


class OccupancyConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for real-time occupancy synchronisation."""

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def connect(self):
        self.user = self.scope.get('user', AnonymousUser())

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        occupancy_group = await self._resolve_occupancy_group()
        if not occupancy_group:
            await self.close(code=4002)
            return

        self.occupancy_group = occupancy_group

        await self.channel_layer.group_add(self.occupancy_group, self.channel_name)

        subprotocol = 'bearer' if 'bearer' in self.scope.get('subprotocols', []) else None
        await self.accept(subprotocol=subprotocol)

        logger.debug(
            '[WS:occupancy] user %s connected → group %s',
            self.user.id, self.occupancy_group,
        )

    async def disconnect(self, close_code):
        if hasattr(self, 'occupancy_group'):
            await self.channel_layer.group_discard(self.occupancy_group, self.channel_name)

        logger.debug(
            '[WS:occupancy] user %s disconnected (code=%s)',
            getattr(self.user, 'id', '?'), close_code,
        )

    async def receive_json(self, content, **kwargs):
        """Handle messages from the client — keepalive pings only."""
        if content.get('type') == 'ping':
            await self.send_json({'type': 'pong'})

    # ── Channel-layer event handler ───────────────────────────────────────────

    async def occupancy_update(self, event):
        """
        Called by the channel layer when occupancy_events.emit_occupancy_update()
        invokes group_send with type='occupancy_update'.
        Forwards the payload to the connected browser client.
        """
        await self.send_json(event['payload'])

    # ── Helpers ───────────────────────────────────────────────────────────────

    @database_sync_to_async
    def _resolve_occupancy_group(self) -> str | None:
        try:
            if not self.user.clinic_id:
                return None
            main_clinic = self.user.clinic.main_clinic
            return f'occupancy_{main_clinic.id}'
        except Exception as exc:
            logger.warning(
                '[WS:occupancy] failed to resolve group for user %s: %s',
                getattr(self.user, 'id', '?'), exc,
            )
            return None
