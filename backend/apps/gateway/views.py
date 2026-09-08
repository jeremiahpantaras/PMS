"""
gateway/views.py

All gateway-facing API views.

Authentication contract:
  - DeviceRegisterView   : uses GATEWAY_REGISTRATION_SECRET (server-to-server, one-time)
  - All other views      : GatewayDeviceAuthentication (Bearer <device_token>) + IsActiveGatewayDevice
"""
import logging
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .authentication import GatewayDeviceAuthentication, IsActiveGatewayDevice
from .models import GatewayDevice, WebhookEvent
from .serializers import (
    DeviceRegistrationSerializer,
    DeviceRegistrationResponseSerializer,
    DevicePublicSerializer,
)
from apps.smsgateway.models import SMSMessage, DeliveryEvent, InboundSMS
from django.db import models
import phonenumbers

logger = logging.getLogger(__name__)


# ==============================================================================
# DEVICE REGISTRATION
# ==============================================================================

class DeviceRegisterView(APIView):
    """
    POST /api/gateway/devices/register/

    Register a physical Android gateway device.
    Protected by GATEWAY_REGISTRATION_SECRET (shared server-side secret),
    separate from the per-device token that this endpoint generates.

    Authentication: X-Registration-Secret header
    Permission:     None (public but secret-protected)

    Idempotent: if device_identifier already exists, returns the existing
    device record WITHOUT rotating the token.
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        # 1. Verify registration secret
        registration_secret = request.headers.get('X-Registration-Secret', '')
        expected_secret = settings.GATEWAY_REGISTRATION_SECRET
        if not registration_secret or registration_secret != expected_secret:
            logger.warning("DeviceRegisterView: unauthorized registration attempt from %s", request.META.get('REMOTE_ADDR'))
            return Response({"error": "Invalid registration secret."}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = DeviceRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        device_identifier = serializer.validated_data['device_identifier']
        device_name = serializer.validated_data['device_name']
        phone_number = serializer.validated_data.get('phone_number', '')

        # 2. Idempotency — return existing device without token rotation
        try:
            device = GatewayDevice.objects.get(device_identifier=device_identifier)
            logger.info("DeviceRegisterView: device '%s' already exists — returning existing record", device_identifier)
            # Return existing device WITHOUT the token (token already issued)
            return Response(
                DevicePublicSerializer(device).data,
                status=status.HTTP_200_OK
            )
        except GatewayDevice.DoesNotExist:
            pass

        # 3. Create new device with a fresh cryptographic token
        token = GatewayDevice.generate_token()
        device = GatewayDevice.objects.create(
            device_identifier=device_identifier,
            name=device_name,
            phone_number=phone_number,
            device_token=token,
            status='ACTIVE',
            is_active=True,
        )
        logger.info("DeviceRegisterView: registered new device '%s' (id=%s)", device_identifier, device.id)

        # Return token ONLY on initial registration
        response_data = DeviceRegistrationResponseSerializer(device).data
        return Response(response_data, status=status.HTTP_201_CREATED)


# ==============================================================================
# DEVICE HEARTBEAT
# ==============================================================================

class DeviceHeartbeatView(APIView):
    """
    POST /api/gateway/devices/heartbeat/

    Called periodically by the Android app to signal the device is online.
    Updates last_seen_at on the GatewayDevice record.

    Authentication: Bearer <device_token>
    """
    authentication_classes = [GatewayDeviceAuthentication]
    permission_classes = [IsActiveGatewayDevice]

    def post(self, request, *args, **kwargs):
        device = request.gateway_device
        device.touch()
        logger.info("DeviceHeartbeatView: heartbeat from '%s'", device.device_identifier)
        return Response({
            "device_id": str(device.id),
            "device_identifier": device.device_identifier,
            "status": "online",
            "is_online": device.is_online(),
            "last_seen_at": device.last_seen_at,
        }, status=status.HTTP_200_OK)


# ==============================================================================
# GATEWAY QUEUE
# ==============================================================================

class GatewayQueueView(APIView):
    """
    GET /api/gateway/queue/

    Polled by the Android gateway device to claim QUEUED messages.

    Authentication: Bearer <device_token>

    UNASSIGNED MESSAGE POLICY (Chunk 2):
    Messages with gateway_device=NULL are visible to any authenticated active device.
    This allows the system to work before device-level routing is configured.
    In a future chunk, explicit device assignment routing can be added.

    Race condition protection:
    Uses SELECT FOR UPDATE SKIP LOCKED + atomic SENDING transition, so concurrent
    polls from different devices cannot claim the same message.

    After claiming, last_seen_at is updated (implicit heartbeat).
    """
    authentication_classes = [GatewayDeviceAuthentication]
    permission_classes = [IsActiveGatewayDevice]

    def get(self, request, *args, **kwargs):
        device = request.gateway_device

        with transaction.atomic():
            # Fetch messages assigned to this device OR unassigned (NULL)
            queued_messages = SMSMessage.objects.select_for_update(skip_locked=True).filter(
                status=SMSMessage.STATUS_QUEUED
            ).filter(
                models.Q(gateway_device=device) | models.Q(gateway_device__isnull=True)
            ).filter(
                models.Q(scheduled_time__isnull=True) | models.Q(scheduled_time__lte=timezone.now())
            ).order_by('created_at')[:50]

            message_list = list(queued_messages)
            message_ids = [m.id for m in message_list]

            # Atomically claim: assign device + transition to SENDING
            SMSMessage.objects.filter(id__in=message_ids).update(
                status=SMSMessage.STATUS_SENDING,
                gateway_device=device,
                updated_at=timezone.now()
            )

        # Implicit heartbeat — polling counts as activity
        device.touch()

        logger.info(
            "GatewayQueueView: device '%s' claimed %s message(s)",
            device.device_identifier, len(message_list)
        )

        messages_data = [
            {
                "id": str(msg.id),
                "recipient": msg.recipient_number,
                "body": msg.body,
            }
            for msg in message_list
        ]

        return Response({"messages": messages_data}, status=status.HTTP_200_OK)


# ==============================================================================
# DELIVERY WEBHOOK
# ==============================================================================

class WebhookDeliveryView(APIView):
    """
    POST /api/gateway/webhooks/delivery/

    Receives delivery status updates from the Android gateway device.

    Authentication: Bearer <device_token>

    Ownership check: a device can only update SMS messages it was assigned.
    Cross-device updates return 403 Forbidden.

    Payload:
        message_id  — SMSMessage UUID returned by /queue/
        status      — SENT / DELIVERED / FAILED / UNDELIVERED
        event_id    — unique ID for this event (idempotency key)
        description — optional human-readable detail
    """
    authentication_classes = [GatewayDeviceAuthentication]
    permission_classes = [IsActiveGatewayDevice]

    def post(self, request, *args, **kwargs):
        device = request.gateway_device
        payload = request.data
        message_id = payload.get('message_id')
        new_status = payload.get('status')
        event_id = payload.get('event_id')

        if not message_id or not new_status:
            return Response(
                {"error": "Missing required fields: message_id, status"},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Idempotency — reject already-processed event_ids
            if event_id and WebhookEvent.objects.filter(
                raw_payload__event_id=event_id, status='PROCESSED'
            ).exists():
                return Response({"message": "Already processed"}, status=status.HTTP_200_OK)

            webhook_event = WebhookEvent.objects.create(
                event_type='delivery_receipt',
                raw_payload=payload,
                gateway_device=device,
                status='PENDING'
            )

            # Look up SMSMessage by UUID
            try:
                sms_message = SMSMessage.objects.get(id=message_id)
            except (SMSMessage.DoesNotExist, Exception):
                # Fallback: try provider_message_id
                try:
                    sms_message = SMSMessage.objects.get(provider_message_id=message_id)
                except SMSMessage.DoesNotExist:
                    webhook_event.status = 'FAILED'
                    webhook_event.save()
                    logger.warning("WebhookDeliveryView: message_id %s not found", message_id)
                    return Response({"error": "Message not found"}, status=status.HTTP_200_OK)

            # Ownership check — prevent Device A from modifying Device B's SMS
            if sms_message.gateway_device_id and sms_message.gateway_device_id != device.id:
                webhook_event.status = 'FAILED'
                webhook_event.save()
                logger.warning(
                    "WebhookDeliveryView: device '%s' attempted to update SMS %s owned by device '%s'",
                    device.device_identifier, message_id,
                    sms_message.gateway_device.device_identifier if sms_message.gateway_device else 'unknown'
                )
                return Response(
                    {"error": "Forbidden: this message was not assigned to your device."},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Idempotency — reject duplicate state transition
            if sms_message.status == new_status and sms_message.delivery_events.filter(status=new_status).exists():
                webhook_event.status = 'IGNORED'
                webhook_event.save()
                return Response({"message": "Duplicate state transition ignored"}, status=status.HTTP_200_OK)

            # Record delivery event
            DeliveryEvent.objects.create(
                message=sms_message,
                status=new_status,
                description=payload.get('description', ''),
                provider_timestamp=timezone.now()
            )

            # Update SMSMessage status using model helpers
            if new_status == SMSMessage.STATUS_DELIVERED:
                sms_message.mark_delivered()
            elif new_status == SMSMessage.STATUS_SENT:
                sms_message.mark_sent()
            elif new_status in [SMSMessage.STATUS_FAILED, SMSMessage.STATUS_UNDELIVERED]:
                sms_message.mark_failed(reason=payload.get('description', 'Gateway reported failure'))
            else:
                sms_message.status = new_status
                sms_message.save(update_fields=['status', 'updated_at'])

            webhook_event.status = 'PROCESSED'
            webhook_event.save()

            logger.info(
                "WebhookDeliveryView: device '%s' updated SMS %s → %s",
                device.device_identifier, message_id, new_status
            )
            return Response({"message": "Webhook processed successfully"}, status=status.HTTP_200_OK)


# ==============================================================================
# INBOUND WEBHOOK
# ==============================================================================

class WebhookInboundView(APIView):
    """
    POST /api/gateway/webhooks/inbound/

    Receives inbound SMS messages captured by the Android gateway device.

    Authentication: Bearer <device_token>

    The authenticated device is recorded as the gateway_device on the
    InboundSMS record for traceability.

    Payload:
        message_id — unique ID from the device (idempotency key)
        sender     — sender phone number
        recipient  — gateway SIM phone number
        message    — SMS body text
    """
    authentication_classes = [GatewayDeviceAuthentication]
    permission_classes = [IsActiveGatewayDevice]

    def post(self, request, *args, **kwargs):
        device = request.gateway_device
        payload = request.data
        provider_message_id = payload.get('message_id')
        sender = payload.get('sender')
        recipient = payload.get('recipient')
        body = payload.get('message')

        if not all([provider_message_id, sender, recipient, body]):
            return Response(
                {"error": "Missing required fields: message_id, sender, recipient, message"},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Idempotency
            if InboundSMS.objects.filter(provider_message_id=provider_message_id).exists():
                return Response({"message": "Already processed"}, status=status.HTTP_200_OK)

            # Normalize sender to E.164 (PH region)
            try:
                parsed = phonenumbers.parse(sender, "PH")
                if phonenumbers.is_valid_number(parsed):
                    sender = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
            except Exception:
                pass

            InboundSMS.objects.create(
                sender_number=sender,
                recipient_number=recipient,
                body=body,
                gateway_device=device,
                provider_message_id=provider_message_id,
                processed_status='PENDING',
                received_at=timezone.now()
            )

            logger.info(
                "WebhookInboundView: device '%s' received inbound SMS from %s (msg_id=%s)",
                device.device_identifier, sender, provider_message_id
            )
            return Response({"message": "Inbound message received"}, status=status.HTTP_200_OK)
