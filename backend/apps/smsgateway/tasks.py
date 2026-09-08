import logging
from celery import shared_task
from django.utils import timezone
from apps.smsgateway.models import SMSMessage

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def dispatch_sms_task(self, message_id):
    """
    Celery task: transition SMS from QUEUED → SENDING.

    IMPORTANT: This task does NOT send the SMS itself.
    The physical Android gateway device is responsible for the actual SMS transmission.
    This task's role is to mark the message as SENDING so the gateway queue
    can serve it to the Android device when it next polls.

    The Android device will:
      1. Poll GET /api/gateway/queue/ to claim QUEUED messages
      2. Send the SMS via the physical SIM
      3. POST /api/gateway/webhooks/delivery/ with the result (SENT / FAILED)
    """
    try:
        sms_message = SMSMessage.objects.get(id=message_id)
    except SMSMessage.DoesNotExist:
        logger.error("dispatch_sms_task: SMSMessage %s not found — skipping", message_id)
        return

    # Idempotency guard — only act on QUEUED messages
    if sms_message.status not in [SMSMessage.STATUS_QUEUED]:
        logger.info(
            "dispatch_sms_task: SMSMessage %s is already %s — skipping",
            message_id, sms_message.status
        )
        return

    try:
        # We do NOT transition to SENDING here.
        # GatewayQueueView is responsible for atomically claiming QUEUED messages.
        # This task just acts as an event hook in case we need to push notifications.
        logger.info("dispatch_sms_task: SMSMessage %s is QUEUED and ready for gateway pickup", message_id)

    except Exception as exc:
        if self.request.retries < self.max_retries:
            countdown = 60 * (self.request.retries + 1)  # 60s, 120s, 180s
            logger.warning(
                "dispatch_sms_task: failed for %s (attempt %s/%s) — retrying in %ss: %s",
                message_id, self.request.retries + 1, self.max_retries, countdown, exc
            )
            raise self.retry(exc=exc, countdown=countdown)
        else:
            sms_message.mark_failed(reason=f"Max retries exceeded. Last error: {str(exc)}")
            logger.error(
                "dispatch_sms_task: SMSMessage %s permanently FAILED after %s retries: %s",
                message_id, self.max_retries, exc
            )

@shared_task
def requeue_stale_sms_task():
    """
    Finds SMS messages that have been stuck in SENDING state for > 10 minutes
    (meaning the gateway device claimed them but crashed or lost internet before
    reporting SENT/FAILED). Reverts them to QUEUED so another device can claim them.
    """
    stale_threshold = timezone.now() - timezone.timedelta(minutes=10)
    stale_messages = SMSMessage.objects.filter(
        status=SMSMessage.STATUS_SENDING,
        updated_at__lt=stale_threshold
    )
    
    count = stale_messages.count()
    if count > 0:
        stale_messages.update(
            status=SMSMessage.STATUS_QUEUED,
            gateway_device=None,
            updated_at=timezone.now()
        )
        logger.warning("requeue_stale_sms_task: Requeued %s stale SMS messages", count)
    return count

