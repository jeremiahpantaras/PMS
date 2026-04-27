import os
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.db import models
from django.utils import timezone


def _trial_days():
    return int(os.getenv('TRIAL_DAYS', 14))


def _subscription_days():
    return int(os.getenv('SUBSCRIPTION_DAYS', 30))


def default_trial_end_date():
    return timezone.now() + timedelta(days=_trial_days())


class Subscription(models.Model):
    PLAN_TRIAL = 'TRIAL'
    PLAN_MONTHLY = 'MONTHLY'
    PLAN_CHOICES = (
        (PLAN_TRIAL, 'Trial'),
        (PLAN_MONTHLY, 'Monthly'),
    )

    STATUS_ACTIVE = 'ACTIVE'
    STATUS_EXPIRED = 'EXPIRED'
    STATUS_CANCELLED = 'CANCELLED'
    STATUS_CHOICES = (
        (STATUS_ACTIVE, 'Active'),
        (STATUS_EXPIRED, 'Expired'),
        (STATUS_CANCELLED, 'Cancelled'),
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='subscription',
    )

    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default=PLAN_TRIAL)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)

    start_date = models.DateTimeField(default=timezone.now)
    end_date = models.DateTimeField(default=default_trial_end_date)
    is_trial = models.BooleanField(default=True)

    # PayMongo checkout session ID — tracks in-flight or completed checkout
    paymongo_checkout_id = models.CharField(max_length=100, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'end_date'], name='subs_status_end_idx'),
        ]

    def _invalidate_cache(self):
        cache.delete(f'sub_active_{self.user_id}')

    def is_active(self):
        return self.status == self.STATUS_ACTIVE and self.end_date >= timezone.now()

    def start_trial(self):
        now = timezone.now()
        self.plan = self.PLAN_TRIAL
        self.status = self.STATUS_ACTIVE
        self.is_trial = True
        self.start_date = now
        self.end_date = now + timedelta(days=_trial_days())
        self.save()
        self._invalidate_cache()

    def activate_monthly(self):
        now = timezone.now()
        self.plan = self.PLAN_MONTHLY
        self.status = self.STATUS_ACTIVE
        self.is_trial = False
        self.start_date = now
        self.end_date = now + timedelta(days=_subscription_days())
        self.save()
        self._invalidate_cache()

    def activate_from_webhook(self, checkout_id=''):
        """Activate/renew subscription from a verified PayMongo webhook."""
        now = timezone.now()
        self.plan = self.PLAN_MONTHLY
        self.status = self.STATUS_ACTIVE
        self.is_trial = False
        # Honour partial remaining time on renewal
        self.end_date = max(self.end_date, now) + timedelta(days=_subscription_days())
        self.start_date = now
        if checkout_id:
            self.paymongo_checkout_id = checkout_id
        self.save()
        self._invalidate_cache()

    def expire(self):
        self.status = self.STATUS_EXPIRED
        self.save(update_fields=['status', 'updated_at'])
        self._invalidate_cache()

    def __str__(self):
        return f"{self.user} - {self.plan} ({self.status})"


class PayMongoPaymentLog(models.Model):
    """Immutable audit log of every PayMongo webhook event processed."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='paymongo_logs',
    )
    event_type = models.CharField(max_length=100)
    checkout_id = models.CharField(max_length=100, blank=True, default='')
    payment_id = models.CharField(max_length=100, blank=True, default='')
    amount = models.IntegerField(default=0)  # centavos
    currency = models.CharField(max_length=10, default='PHP')
    raw_payload = models.JSONField(default=dict)
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-processed_at']

    def __str__(self):
        return f"{self.event_type} — {self.checkout_id} ({self.processed_at:%Y-%m-%d %H:%M})"
