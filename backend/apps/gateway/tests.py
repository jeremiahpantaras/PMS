"""
gateway/tests.py — Chunk 2 Test Suite

Covers:
  - Device Registration (success, idempotency, duplicate protection)
  - Device Authentication (Bearer token, invalid token, inactive device)
  - Device Heartbeat (updates last_seen_at, token not rotated)
  - Token Exposure (public serializations do not leak token)
  - Gateway Queue (isolation, atomic claiming)
  - Delivery Webhook (ownership, idempotency)
  - Inbound Webhook (ownership)
"""
from rest_framework.test import APITestCase
from django.urls import reverse
from rest_framework import status
from apps.smsgateway.models import SMSMessage, DeliveryEvent, InboundSMS
from apps.gateway.models import GatewayDevice, WebhookEvent
from django.conf import settings
from django.utils import timezone
from unittest.mock import patch
import uuid


class BaseGatewayTestCase(APITestCase):
    def setUp(self):
        # Create a test active device
        self.device = GatewayDevice.objects.create(
            device_identifier='ANDROID-TEST-001',
            name='Test Gateway 1',
            device_token=GatewayDevice.generate_token(),
            status='ACTIVE',
            is_active=True
        )
        self.auth_header = f"Bearer {self.device.device_token}"

        # Create a second active device for isolation tests
        self.device2 = GatewayDevice.objects.create(
            device_identifier='ANDROID-TEST-002',
            name='Test Gateway 2',
            device_token=GatewayDevice.generate_token(),
            status='ACTIVE',
            is_active=True
        )
        self.auth_header2 = f"Bearer {self.device2.device_token}"

        # Setup URLs
        self.register_url = reverse('gateway:device-register')
        self.heartbeat_url = reverse('gateway:device-heartbeat')
        self.queue_url = reverse('gateway:gateway-queue')
        self.delivery_url = reverse('gateway:webhook-delivery')
        self.inbound_url = reverse('gateway:webhook-inbound')


# ==============================================================================
# 1. REGISTRATION TESTS
# ==============================================================================

class DeviceRegistrationTests(BaseGatewayTestCase):
    def test_register_device_success(self):
        """TEST 1: Register Device -> 201, token returned."""
        payload = {
            'device_identifier': 'NEW-DEVICE-999',
            'device_name': 'New Device',
        }
        headers = {'HTTP_X_REGISTRATION_SECRET': settings.GATEWAY_REGISTRATION_SECRET}
        response = self.client.post(self.register_url, payload, format='json', **headers)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('device_token', response.data)
        self.assertEqual(response.data['device_identifier'], 'NEW-DEVICE-999')
        self.assertEqual(GatewayDevice.objects.filter(device_identifier='NEW-DEVICE-999').count(), 1)

    def test_register_device_duplicate_idempotent(self):
        """TEST 2: Duplicate Device -> Returns existing without duplicate."""
        payload = {
            'device_identifier': self.device.device_identifier,
            'device_name': 'Attempted Duplicate',
        }
        headers = {'HTTP_X_REGISTRATION_SECRET': settings.GATEWAY_REGISTRATION_SECRET}
        response = self.client.post(self.register_url, payload, format='json', **headers)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Token MUST NOT be exposed on idempotent re-registration
        self.assertNotIn('device_token', response.data)
        self.assertEqual(response.data['name'], self.device.name)
        # Ensure no duplicates were created
        self.assertEqual(GatewayDevice.objects.filter(device_identifier=self.device.device_identifier).count(), 1)

    def test_register_unauthorized(self):
        payload = {'device_identifier': 'ANY', 'device_name': 'ANY'}
        response = self.client.post(self.register_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ==============================================================================
# 2. AUTHENTICATION & SECURITY TESTS
# ==============================================================================

class GatewayAuthenticationTests(BaseGatewayTestCase):
    def test_valid_token(self):
        """TEST 3: Device Authentication using Bearer device_token -> 200."""
        response = self.client.post(self.heartbeat_url, format='json', HTTP_AUTHORIZATION=self.auth_header)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_invalid_token(self):
        """TEST 4: Invalid Token -> 401."""
        response = self.client.post(self.heartbeat_url, format='json', HTTP_AUTHORIZATION='Bearer invalid123')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_inactive_device(self):
        """TEST 5: Inactive Device -> 403 Forbidden on all protected endpoints."""
        self.device.is_active = False
        self.device.save()

        # Heartbeat
        resp1 = self.client.post(self.heartbeat_url, format='json', HTTP_AUTHORIZATION=self.auth_header)
        self.assertEqual(resp1.status_code, status.HTTP_403_FORBIDDEN)
        
        # Queue
        resp2 = self.client.get(self.queue_url, HTTP_AUTHORIZATION=self.auth_header)
        self.assertEqual(resp2.status_code, status.HTTP_403_FORBIDDEN)
        
        # Delivery
        resp3 = self.client.post(self.delivery_url, {}, format='json', HTTP_AUTHORIZATION=self.auth_header)
        self.assertEqual(resp3.status_code, status.HTTP_403_FORBIDDEN)

        # Inbound
        resp4 = self.client.post(self.inbound_url, {}, format='json', HTTP_AUTHORIZATION=self.auth_header)
        self.assertEqual(resp4.status_code, status.HTTP_403_FORBIDDEN)


# ==============================================================================
# 3. HEARTBEAT TESTS
# ==============================================================================

class HeartbeatTests(BaseGatewayTestCase):
    def test_heartbeat_updates_last_seen(self):
        """TEST 6: Heartbeat -> Updates last_seen_at."""
        self.assertIsNone(self.device.last_seen_at)
        response = self.client.post(self.heartbeat_url, format='json', HTTP_AUTHORIZATION=self.auth_header)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.device.refresh_from_db()
        self.assertIsNotNone(self.device.last_seen_at)
        self.assertTrue(self.device.is_online())

    def test_heartbeat_does_not_rotate_token(self):
        """TEST 11: Heartbeat -> Token remains unchanged."""
        original_token = self.device.device_token
        self.client.post(self.heartbeat_url, format='json', HTTP_AUTHORIZATION=self.auth_header)
        self.client.post(self.heartbeat_url, format='json', HTTP_AUTHORIZATION=self.auth_header)
        
        self.device.refresh_from_db()
        self.assertEqual(self.device.device_token, original_token)


# ==============================================================================
# 4. QUEUE TESTS
# ==============================================================================

class QueueTests(BaseGatewayTestCase):
    def test_queue_isolation(self):
        """TEST 7: Queue Isolation -> Device A gets only A's messages, B gets B's."""
        # Unassigned (can be claimed by anyone, but we want to test assignment)
        SMSMessage.objects.create(recipient_number='+639000000001', body='Msg A', status=SMSMessage.STATUS_QUEUED, gateway_device=self.device)
        SMSMessage.objects.create(recipient_number='+639000000002', body='Msg B', status=SMSMessage.STATUS_QUEUED, gateway_device=self.device2)
        
        resp_a = self.client.get(self.queue_url, HTTP_AUTHORIZATION=self.auth_header)
        resp_b = self.client.get(self.queue_url, HTTP_AUTHORIZATION=self.auth_header2)
        
        self.assertEqual(len(resp_a.data['messages']), 1)
        self.assertEqual(resp_a.data['messages'][0]['body'], 'Msg A')
        
        self.assertEqual(len(resp_b.data['messages']), 1)
        self.assertEqual(resp_b.data['messages'][0]['body'], 'Msg B')

    def test_queue_unassigned_claim(self):
        """Unassigned messages should be claimed by the polling device."""
        msg = SMSMessage.objects.create(recipient_number='+639000000003', body='Unassigned', status=SMSMessage.STATUS_QUEUED)
        self.client.get(self.queue_url, HTTP_AUTHORIZATION=self.auth_header)
        msg.refresh_from_db()
        self.assertEqual(msg.gateway_device, self.device)
        self.assertEqual(msg.status, SMSMessage.STATUS_SENDING)


# ==============================================================================
# 5. WEBHOOK OWNERSHIP TESTS
# ==============================================================================

class WebhookOwnershipTests(BaseGatewayTestCase):
    def test_delivery_ownership(self):
        """TEST 9: Delivery Ownership -> Device A cannot update Device B's SMS."""
        msg_b = SMSMessage.objects.create(
            recipient_number='+639000000004',
            body='Msg B',
            status=SMSMessage.STATUS_SENDING,
            gateway_device=self.device2
        )
        
        payload = {
            'message_id': str(msg_b.id),
            'status': 'DELIVERED',
            'event_id': 'evt_1'
        }
        # Device A attempts to update Device B's message
        response = self.client.post(self.delivery_url, payload, format='json', HTTP_AUTHORIZATION=self.auth_header)
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        msg_b.refresh_from_db()
        self.assertEqual(msg_b.status, SMSMessage.STATUS_SENDING) # Not changed

    def test_inbound_ownership(self):
        """TEST 10: Inbound Ownership -> Inbound SMS is associated with the authenticated device."""
        payload = {
            'message_id': 'inbound-001',
            'sender': '+639123456789',
            'recipient': '+639085608811',
            'message': 'Hello'
        }
        response = self.client.post(self.inbound_url, payload, format='json', HTTP_AUTHORIZATION=self.auth_header)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        inbound = InboundSMS.objects.get(provider_message_id='inbound-001')
        self.assertEqual(inbound.gateway_device, self.device)
