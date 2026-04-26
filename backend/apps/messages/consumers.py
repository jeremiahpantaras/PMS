import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time 1-on-1 messaging.

    URL pattern:  ws/messages/<conversation_id>/
    Group name:   conversation_<conversation_id>

    Each authenticated user also joins a personal group:
        user_<user_id>
    so they receive notifications even when not in a chat window.
    """

    # ── Connection ────────────────────────────────────────────────────────

    async def connect(self):
        self.user = self.scope.get('user')

        # Reject unauthenticated connections
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group      = f'conversation_{self.conversation_id}'
        self.user_group      = f'user_{self.user.pk}'

        # Verify the user is a participant of this conversation
        is_participant = await self._is_participant()
        if not is_participant:
            await self.close(code=4003)
            return

        # Join conversation group AND personal group
        await self.channel_layer.group_add(self.room_group,  self.channel_name)
        await self.channel_layer.group_add(self.user_group,  self.channel_name)

        subprotocol = 'bearer' if 'bearer' in self.scope.get('subprotocols', []) else None
        await self.accept(subprotocol=subprotocol)
        logger.debug('WS connect: user=%s conversation=%s', self.user.pk, self.conversation_id)

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group'):
            await self.channel_layer.group_discard(self.room_group, self.channel_name)
        if hasattr(self, 'user_group'):
            await self.channel_layer.group_discard(self.user_group, self.channel_name)
        logger.info(f'WS disconnect: user={getattr(self.user, "pk", "?")} code={close_code}')

    # ── Receive from WebSocket client ─────────────────────────────────────

    async def receive(self, text_data):
        try:
            data    = json.loads(text_data)
            action  = data.get('action')

            if action == 'send_message':
                await self._handle_send(data)
            elif action == 'mark_read':
                await self._handle_mark_read()
            elif action == 'typing':
                await self._handle_typing(data)
            else:
                await self.send_json({'error': f'Unknown action: {action}'})

        except json.JSONDecodeError:
            await self.send_json({'error': 'Invalid JSON'})
        except Exception as exc:
            logger.exception(f'WS receive error: {exc}')
            await self.send_json({'error': 'Internal server error'})

    # ── Action handlers ───────────────────────────────────────────────────

    async def _handle_send(self, data):
        body = (data.get('body') or '').strip()
        if not body:
            await self.send_json({'error': 'Message body is required.'})
            return

        message = await self._save_message(body)
        if message is None:
            await self.send_json({'error': 'Failed to save message.'})
            return

        payload = {
            'type':    'chat_message',        # maps to chat_message() handler below
            'message': {
                'id':            message['id'],
                'conversation':  int(self.conversation_id),
                'sender_id':     self.user.pk,
                'sender_name':   self.user.get_full_name(),
                'sender_avatar': message['sender_avatar'],
                'body':          body,
                'is_edited':     False,
                'created_at':    message['created_at'],
            },
        }
        # Broadcast to all participants in the room
        await self.channel_layer.group_send(self.room_group, payload)

    async def _handle_mark_read(self):
        await self._update_last_read()
        await self.send_json({'type': 'marked_read', 'conversation': int(self.conversation_id)})

    async def _handle_typing(self, data):
        await self.channel_layer.group_send(self.room_group, {
            'type':    'typing_indicator',
            'user_id': self.user.pk,
            'name':    self.user.get_full_name(),
            'is_typing': bool(data.get('is_typing', False)),
        })

    # ── Group message handlers (called by channel layer) ──────────────────

    async def chat_message(self, event):
        """Receive broadcast from group and forward to WebSocket client."""
        await self.send_json({'type': 'chat_message', 'message': event['message']})

    async def typing_indicator(self, event):
        if event['user_id'] != self.user.pk:
            await self.send_json({
                'type':      'typing',
                'user_id':   event['user_id'],
                'name':      event['name'],
                'is_typing': event['is_typing'],
            })

    # ── DB helpers (sync → async) ─────────────────────────────────────────

    @database_sync_to_async
    def _is_participant(self):
        from .models import ConversationParticipant
        return ConversationParticipant.objects.filter(
            conversation_id=self.conversation_id,
            user=self.user,
        ).exists()

    @database_sync_to_async
    def _save_message(self, body):
        from .models import Conversation, Message
        from django.utils import timezone

        try:
            conversation = Conversation.objects.get(
                pk=self.conversation_id,
                is_deleted=False,
            )
            msg = Message.objects.create(
                conversation=conversation,
                sender=self.user,
                body=body,
            )
            # Bump conversation updated_at for ordering
            conversation.updated_at = timezone.now()
            conversation.save(update_fields=['updated_at'])

            avatar_url = None
            if self.user.avatar:
                try:
                    avatar_url = self.user.avatar.url
                except Exception:
                    pass

            return {
                'id':           msg.pk,
                'created_at':   msg.created_at.isoformat(),
                'sender_avatar': avatar_url,
            }
        except Conversation.DoesNotExist:
            return None

    @database_sync_to_async
    def _update_last_read(self):
        from .models import ConversationParticipant
        ConversationParticipant.objects.filter(
            conversation_id=self.conversation_id,
            user=self.user,
        ).update(last_read_at=timezone.now())

    # ── Utility ───────────────────────────────────────────────────────────

    async def send_json(self, content):
        await self.send(text_data=json.dumps(content, default=str))


# ── Presence consumer (personal channel) ─────────────────────────────────────

class PresenceConsumer(AsyncWebsocketConsumer):
    """
    Lightweight consumer connected at ws/presence/ .
    Pushes unread-count badges and new-message notifications
    to users who are NOT currently in a chat window.
    """

    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.user_group = f'user_{self.user.pk}'
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        subprotocol = 'bearer' if 'bearer' in self.scope.get('subprotocols', []) else None
        await self.accept(subprotocol=subprotocol)

    async def disconnect(self, close_code):
        if hasattr(self, 'user_group'):
            await self.channel_layer.group_discard(self.user_group, self.channel_name)

    # Forward any group message directly to the client
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({'type': 'chat_message', 'message': event['message']}, default=str))

    async def receive(self, text_data=None, bytes_data=None):
        pass   # presence consumer is receive-only from server side