import uuid
import secrets
from django.conf import settings
from django.db import models
from django.utils import timezone


class GatewayDevice(models.Model):
    """
    Represents a physical Android device acting as an SMS gateway node.
    Each device has a unique identifier (set at registration) and a unique
    cryptographic token used to authenticate API requests.
    """
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('SUSPENDED', 'Suspended'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(
        max_length=255,
        help_text="Friendly name for this device (e.g. 'Clinic A - Samsung A55')"
    )
    device_identifier = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        default=uuid.uuid4,
        help_text="Unique identifier supplied by the Android app (e.g. ANDROID-GATEWAY-001 or Android device UUID)"
    )
    phone_number = models.CharField(
        max_length=20, blank=True,
        help_text="The SIM phone number on this device (E.164)"
    )
    # The token is stored in plain text because we need to compare it on every
    # request. In a higher-security environment this could be hashed.
    device_token = models.CharField(
        max_length=128, unique=True, db_index=True,
        help_text="Secret token used by the device to authenticate with the API — never expose in list views"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    is_active = models.BooleanField(default=True)
    last_seen_at = models.DateTimeField(null=True, blank=True, help_text="Last time the device polled or sent a heartbeat")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} / {self.device_identifier} ({self.status})"

    class Meta:
        ordering = ['name']

    @staticmethod
    def generate_token():
        """Generate a cryptographically secure 64-character hex token."""
        return secrets.token_hex(32)  # 256 bits of randomness

    def is_online(self):
        """
        Derive online status from last_seen_at.
        A device is considered online if it sent a heartbeat or poll within
        GATEWAY_HEARTBEAT_TIMEOUT_SECONDS (default: 120 seconds).
        """
        if not self.last_seen_at:
            return False
        timeout = getattr(settings, 'GATEWAY_HEARTBEAT_TIMEOUT_SECONDS', 120)
        return (timezone.now() - self.last_seen_at).total_seconds() <= timeout

    def touch(self):
        """Update last_seen_at to now (called on heartbeat or queue poll)."""
        self.last_seen_at = timezone.now()
        self.save(update_fields=['last_seen_at', 'updated_at'])


class Provider(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, help_text="Internal name for the provider configuration")
    provider_type = models.CharField(max_length=50, help_text="Identifier for the provider integration (e.g., LOCAL, SMPP, HTTP)")
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.provider_type})"


class WebhookEvent(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSED', 'Processed'),
        ('FAILED', 'Failed'),
        ('IGNORED', 'Ignored'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider = models.ForeignKey(Provider, on_delete=models.SET_NULL, null=True, blank=True)
    gateway_device = models.ForeignKey(GatewayDevice, on_delete=models.SET_NULL, null=True, blank=True)
    event_type = models.CharField(max_length=100)
    raw_payload = models.JSONField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    received_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Webhook {self.event_type} - {self.status}"
