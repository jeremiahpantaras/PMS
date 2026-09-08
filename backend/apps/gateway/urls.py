from django.urls import path
from .views import (
    DeviceRegisterView,
    DeviceHeartbeatView,
    GatewayQueueView,
    WebhookDeliveryView,
    WebhookInboundView,
)

app_name = 'gateway'

urlpatterns = [
    # Device lifecycle
    path('devices/register/', DeviceRegisterView.as_view(), name='device-register'),
    path('devices/heartbeat/', DeviceHeartbeatView.as_view(), name='device-heartbeat'),

    # Gateway operations (require per-device Bearer token)
    path('queue/', GatewayQueueView.as_view(), name='gateway-queue'),
    path('webhooks/delivery/', WebhookDeliveryView.as_view(), name='webhook-delivery'),
    path('webhooks/inbound/', WebhookInboundView.as_view(), name='webhook-inbound'),
]
