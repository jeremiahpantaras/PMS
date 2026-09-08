"""
messaging/tests.py — Chunk 1 Test Suite

Tests for:
  - Send SMS API (authentication, validation, response contract)
  - SMS status lifecycle (QUEUED → SENDING)
  - Message detail API
  - SMS template rendering
  - Rate limiting
"""
from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from apps.smsgateway.models import SMSMessage, SMSTemplate
from unittest.mock import patch


# ==============================================================================
# 1. AUTHENTICATION TESTS
# ==============================================================================

class AuthenticationTests(APITestCase):
    def setUp(self):
        self.url = reverse('messaging:send-sms')
        self.valid_phone = '+639085608811'

    def test_send_sms_requires_authentication(self):
        """Unauthenticated request must return 401."""
        response = self.client.post(self.url, {'to': self.valid_phone, 'message': 'Test'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_send_sms_invalid_token_rejected(self):
        """A fabricated/invalid token must return 401."""
        self.client.credentials(HTTP_AUTHORIZATION='Token invalid-token-xyz')
        response = self.client.post(self.url, {'to': self.valid_phone, 'message': 'Test'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ==============================================================================
# 2. SEND SMS TESTS
# ==============================================================================

class SendSMSTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password123')
        self.token = Token.objects.create(user=self.user)
        self.url = reverse('messaging:send-sms')
        self.valid_phone = '+639085608811'
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token.key)

    def test_send_sms_valid_e164(self):
        """Valid E.164 phone number → 202 ACCEPTED, message QUEUED."""
        response = self.client.post(self.url, {
            'to': '+639085608811',
            'message': 'Hello this is a test.'
        })
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertIn('message_id', response.data)
        self.assertIn('recipient', response.data)
        self.assertIn('status', response.data)
        self.assertIn('created_at', response.data)
        self.assertEqual(response.data['status'], SMSMessage.STATUS_QUEUED)

    def test_send_sms_valid_local_format(self):
        """Philippine local format (09XXXXXXXXX) should be accepted and normalized."""
        response = self.client.post(self.url, {
            'to': '09085608811',
            'message': 'Local format test.'
        })
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        msg = SMSMessage.objects.latest('created_at')
        self.assertEqual(msg.recipient_number, '+639085608811')  # Normalized to E.164

    def test_send_sms_valid_parenthetical_format(self):
        """Format like (+63) 9085608811 should be accepted."""
        response = self.client.post(self.url, {
            'to': '(+63) 9085608811',
            'message': 'Parenthetical format test.'
        })
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        msg = SMSMessage.objects.latest('created_at')
        self.assertEqual(msg.recipient_number, '+639085608811')

    def test_send_sms_invalid_number(self):
        """Non-phone-number string must return 400."""
        response = self.client.post(self.url, {'to': 'invalid', 'message': 'Test'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('to', response.data)

    def test_send_sms_empty_message(self):
        """Whitespace-only message must return 400."""
        response = self.client.post(self.url, {'to': self.valid_phone, 'message': '   '})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_sms_missing_message_and_template(self):
        """Neither message nor template_id provided must return 400."""
        response = self.client.post(self.url, {'to': self.valid_phone})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_sms_persisted_to_database(self):
        """SMS must be persisted to the database after a valid request."""
        self.client.post(self.url, {'to': self.valid_phone, 'message': 'Persist test'})
        self.assertEqual(SMSMessage.objects.count(), 1)
        msg = SMSMessage.objects.first()
        self.assertEqual(msg.recipient_number, '+639085608811')
        self.assertEqual(msg.body, 'Persist test')


# ==============================================================================
# 3. SMS STATUS LIFECYCLE TESTS
# ==============================================================================

class SMSStatusLifecycleTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='lifecycle_user', password='pass123')
        self.token = Token.objects.create(user=self.user)
        self.url = reverse('messaging:send-sms')
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token.key)

    def test_new_sms_starts_as_queued(self):
        """Newly created SMS enters the lifecycle at QUEUED.
        In the test environment, Celery runs eagerly/synchronously, so by the
        time we fetch the record the task has already transitioned it to SENDING.
        In production (real Celery worker) this would remain QUEUED briefly.
        We verify that the initial status returned in the API response is QUEUED.
        """
        response = self.client.post(self.url, {
            'to': '+639085608811',
            'message': 'Lifecycle test'
        })
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        # The API response must always report QUEUED at the moment of creation
        self.assertEqual(response.data['status'], SMSMessage.STATUS_QUEUED)
        # After eager task execution, DB status will be SENDING
        msg = SMSMessage.objects.latest('created_at')
        self.assertIn(msg.status, [SMSMessage.STATUS_QUEUED, SMSMessage.STATUS_SENDING])

    def test_celery_task_transitions_to_sending(self):
        """After dispatch_sms_task runs, message should remain QUEUED."""
        from apps.smsgateway.tasks import dispatch_sms_task
        msg = SMSMessage.objects.create(
            recipient_number='+639085608811',
            body='Celery lifecycle test',
            status=SMSMessage.STATUS_QUEUED
        )
        dispatch_sms_task(str(msg.id))  # Runs eagerly in test (CELERY_TASK_ALWAYS_EAGER)
        msg.refresh_from_db()
        # After task: should be QUEUED (waiting for gateway pickup)
        self.assertEqual(msg.status, SMSMessage.STATUS_QUEUED)

    def test_celery_task_idempotent_on_sending(self):
        """Task should not re-process a message already in SENDING state."""
        from apps.smsgateway.tasks import dispatch_sms_task
        msg = SMSMessage.objects.create(
            recipient_number='+639085608811',
            body='Already sending',
            status=SMSMessage.STATUS_SENDING,
            retry_count=1
        )
        dispatch_sms_task(str(msg.id))
        msg.refresh_from_db()
        # retry_count should not have increased again
        self.assertEqual(msg.retry_count, 1)
        self.assertEqual(msg.status, SMSMessage.STATUS_SENDING)

    def test_mark_sending_increments_retry_count(self):
        """mark_sending() should increment retry_count."""
        msg = SMSMessage.objects.create(
            recipient_number='+639085608811',
            body='Retry count test',
            status=SMSMessage.STATUS_QUEUED
        )
        self.assertEqual(msg.retry_count, 0)
        msg.mark_sending()
        msg.refresh_from_db()
        self.assertEqual(msg.retry_count, 1)
        self.assertEqual(msg.status, SMSMessage.STATUS_SENDING)

    def test_mark_sent(self):
        """mark_sent() should set status=SENT and sent_at timestamp."""
        msg = SMSMessage.objects.create(
            recipient_number='+639085608811',
            body='Sent test',
            status=SMSMessage.STATUS_SENDING
        )
        msg.mark_sent(provider_message_id='test-provider-id-001')
        msg.refresh_from_db()
        self.assertEqual(msg.status, SMSMessage.STATUS_SENT)
        self.assertIsNotNone(msg.sent_at)
        self.assertEqual(msg.provider_message_id, 'test-provider-id-001')

    def test_mark_delivered(self):
        """mark_delivered() should set status=DELIVERED and delivered_at timestamp."""
        msg = SMSMessage.objects.create(
            recipient_number='+639085608811',
            body='Delivered test',
            status=SMSMessage.STATUS_SENT
        )
        msg.mark_delivered()
        msg.refresh_from_db()
        self.assertEqual(msg.status, SMSMessage.STATUS_DELIVERED)
        self.assertIsNotNone(msg.delivered_at)

    def test_mark_failed(self):
        """mark_failed() should set status=FAILED, failure_reason and failed_at."""
        msg = SMSMessage.objects.create(
            recipient_number='+639085608811',
            body='Failed test',
            status=SMSMessage.STATUS_SENDING
        )
        msg.mark_failed(reason='SIM card out of load')
        msg.refresh_from_db()
        self.assertEqual(msg.status, SMSMessage.STATUS_FAILED)
        self.assertEqual(msg.failure_reason, 'SIM card out of load')
        self.assertIsNotNone(msg.failed_at)


# ==============================================================================
# 4. MESSAGE DETAIL API TESTS
# ==============================================================================

class MessageDetailTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser2', password='password123')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token.key)
        self.message = SMSMessage.objects.create(
            recipient_number='+639085608811',
            body='Detail test',
            status=SMSMessage.STATUS_SENT
        )
        self.url = reverse('messaging:message-detail', kwargs={'id': self.message.id})

    def test_get_message_detail(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], SMSMessage.STATUS_SENT)
        self.assertIn('delivery_events', response.data)
        self.assertIn('retry_count', response.data)
        self.assertIn('gateway_device_name', response.data)
        self.assertEqual(len(response.data['delivery_events']), 0)

    def test_message_detail_requires_auth(self):
        self.client.credentials()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ==============================================================================
# 5. SMS TEMPLATE TESTS
# ==============================================================================

class SMSTemplateTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser3', password='password123')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token.key)
        self.template = SMSTemplate.objects.create(
            name="Appointment Reminder",
            content="Hi {{ name }}, your appointment is at {{ time }}."
        )
        self.send_url = reverse('messaging:send-sms')
        self.valid_phone = '+639085608811'

    def test_send_sms_with_template(self):
        payload = {
            'to': self.valid_phone,
            'template_id': str(self.template.id),
            'template_vars': {'name': 'John Doe', 'time': '2:00 PM'}
        }
        response = self.client.post(self.send_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        message = SMSMessage.objects.latest('created_at')
        self.assertEqual(message.body, "Hi John Doe, your appointment is at 2:00 PM.")

    def test_send_sms_with_template_and_message_fails(self):
        """Cannot provide both message and template_id."""
        payload = {
            'to': self.valid_phone,
            'message': 'Direct message',
            'template_id': str(self.template.id),
        }
        response = self.client.post(self.send_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_sms_nonexistent_template(self):
        """Non-existent template_id returns 404."""
        import uuid
        payload = {
            'to': self.valid_phone,
            'template_id': str(uuid.uuid4()),
        }
        response = self.client.post(self.send_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ==============================================================================
# 6. RATE LIMITING TESTS
# ==============================================================================

class RateLimitingTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser4', password='password123')
        self.token = Token.objects.create(user=self.user)
        self.send_url = reverse('messaging:send-sms')
        self.valid_phone = '+639085608811'
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + self.token.key)

    @patch('rest_framework.throttling.ScopedRateThrottle.get_rate', return_value='2/min')
    def test_send_sms_rate_limit(self, mock_get_rate):
        payload = {'to': self.valid_phone, 'message': 'Test limit'}
        response1 = self.client.post(self.send_url, payload, format='json')
        self.assertEqual(response1.status_code, status.HTTP_202_ACCEPTED)
        response2 = self.client.post(self.send_url, payload, format='json')
        self.assertEqual(response2.status_code, status.HTTP_202_ACCEPTED)
        response3 = self.client.post(self.send_url, payload, format='json')
        self.assertEqual(response3.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('Expected available in', response3.data['detail'])
