"""
Celery tasks for the appointments app.

Scheduled via CELERY_BEAT_SCHEDULE in settings.py:
  - send_appointment_reminders_task: daily at 8:00 AM Asia/Manila (00:00 UTC)
"""
import logging
from celery import shared_task
from django.core.management import call_command

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name='apps.appointments.tasks.send_appointment_reminders_task',
    autoretry_for=(Exception,),
    retry_backoff=60,
    max_retries=3,
)
def send_appointment_reminders_task(self):
    """
    Send email-only appointment reminders for tomorrow's appointments.
    Runs daily at 8:00 AM Asia/Manila via Celery Beat.
    Duplicate prevention is handled inside the management command via
    the `reminder_sent` flag on each Appointment record.
    """
    logger.info("Celery: send_appointment_reminders_task started")
    try:
        call_command('send_appointment_reminders', email_only=True)
        logger.info("Celery: send_appointment_reminders_task completed successfully")
    except Exception as exc:
        logger.error("Celery: send_appointment_reminders_task failed — %s", exc)
        raise self.retry(exc=exc)
