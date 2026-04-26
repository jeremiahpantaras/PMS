import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import re_path, path

from apps.common.ws_auth import JWTAuthMiddleware
from apps.notifications.consumers import NotificationConsumer
from apps.messages.consumers import ChatConsumer, PresenceConsumer

websocket_urlpatterns = [
    path('ws/notifications/', NotificationConsumer.as_asgi()),
    re_path(r'^ws/messages/(?P<conversation_id>\d+)/$', ChatConsumer.as_asgi()),
    re_path(r'^ws/presence/$', PresenceConsumer.as_asgi()),
]

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    # Single shared JWT middleware wraps all WebSocket routes.
    'websocket': JWTAuthMiddleware(URLRouter(websocket_urlpatterns)),
})