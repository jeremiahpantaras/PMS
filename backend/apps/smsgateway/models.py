import uuid
import logging
from django.db import models
from apps.gateway.models import Provider, GatewayDevice

logger = logging.getLogger(__name__)


class SMSTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    content = models.TextField(help_text="Template content supporting variables like {{ name }}")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class SMSMessage(models.Model):
    STATUS_QUEUED = 'QUEUED'
    STATUS_SENDING = 'SENDING'
    STATUS_SENT = 'SENT'
    STATUS_DELIVERED = 'DELIVERED'
    STATUS_FAILED = 'FAILED'
    STATUS_UNDELIVERED = 'UNDELIVERED'
    STATUS_CANCELLED = 'CANCELLED'

    STATUS_CHOICES = [
        (STATUS_QUEUED, 'Queued'),          # Accepted by API, waiting for a gateway to pick it up
        (STATUS_SENDING, 'Sending'),        # Claimed by a gateway device, being transmitted
        (STATUS_SENT, 'Sent'),              # Confirmed submitted to the carrier
        (STATUS_DELIVERED, 'Delivered'),    # Delivery receipt confirmed
        (STATUS_FAILED, 'Failed'),          # Terminal failure, no more retries
        (STATUS_UNDELIVERED, 'Undelivered'),# Carrier could not deliver
        (STATUS_CANCELLED, 'Cancelled'),    # Manually cancelled
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient_number = models.CharField(max_length=20, help_text="E.164 formatted number, e.g. +639XXXXXXXXX")
    sender_id = models.CharField(max_length=50, blank=True, null=True)
    body = models.TextField()

    # Provider/device assignment
    provider = models.ForeignKey(Provider, on_delete=models.SET_NULL, null=True, blank=True)
    gateway_device = models.ForeignKey(
        GatewayDevice, on_delete=models.SET_NULL, null=True, blank=True,
        help_text="The gateway device that claimed and sent this message"
    )

    provider_message_id = models.CharField(max_length=255, blank=True, null=True, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_QUEUED)
    failure_reason = models.TextField(blank=True)

    # Retry tracking
    retry_count = models.PositiveSmallIntegerField(default=0, help_text="Number of send attempts made")
    max_retries = models.PositiveSmallIntegerField(default=3, help_text="Maximum allowed retries before terminal failure")

    scheduled_time = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"SMS to {self.recipient_number} [{self.status}]"

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'scheduled_time']),
            models.Index(fields=['recipient_number']),
        ]

    def mark_sending(self, gateway_device=None):
        """Atomically transition from QUEUED to SENDING."""
        self.status = self.STATUS_SENDING
        self.retry_count += 1
        if gateway_device:
            self.gateway_device = gateway_device
        self.save(update_fields=['status', 'retry_count', 'gateway_device', 'updated_at'])
        logger.info("SMS %s marked SENDING (attempt %s)", self.id, self.retry_count)

    def mark_sent(self, provider_message_id=None):
        from django.utils import timezone
        self.status = self.STATUS_SENT
        self.sent_at = timezone.now()
        if provider_message_id:
            self.provider_message_id = provider_message_id
        self.save(update_fields=['status', 'sent_at', 'provider_message_id', 'updated_at'])
        logger.info("SMS %s marked SENT", self.id)

    def mark_delivered(self):
        from django.utils import timezone
        self.status = self.STATUS_DELIVERED
        self.delivered_at = timezone.now()
        self.save(update_fields=['status', 'delivered_at', 'updated_at'])
        logger.info("SMS %s marked DELIVERED", self.id)

    def mark_failed(self, reason=''):
        from django.utils import timezone
        self.status = self.STATUS_FAILED
        self.failure_reason = reason
        self.failed_at = timezone.now()
        self.save(update_fields=['status', 'failure_reason', 'failed_at', 'updated_at'])
        logger.warning("SMS %s marked FAILED: %s", self.id, reason)


class DeliveryEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(SMSMessage, on_delete=models.CASCADE, related_name='delivery_events')
    status = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    provider_timestamp = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Event for {self.message.id}: {self.status}"


class InboundSMS(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSED', 'Processed'),
        ('FAILED', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender_number = models.CharField(max_length=20)
    recipient_number = models.CharField(max_length=20)
    body = models.TextField()
    provider = models.ForeignKey(Provider, on_delete=models.SET_NULL, null=True, blank=True)
    gateway_device = models.ForeignKey(GatewayDevice, on_delete=models.SET_NULL, null=True, blank=True)
    provider_message_id = models.CharField(max_length=255, db_index=True)
    processed_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    received_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Inbound from {self.sender_number}: {self.body[:40]}"

    class Meta:
        ordering = ['-received_at']
