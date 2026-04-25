from django.core.management import call_command
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


def send_reminders_cron():
    """
    Called daily at 8:00 AM by django-crontab.
    Sends both email and SMS reminders for tomorrow's appointments.
    """
    logger.info("Cron: send_reminders_cron started")
    try:
        call_command('send_appointment_reminders')
        logger.info("Cron: send_reminders_cron completed successfully")
    except Exception as e:
        logger.error("Cron: send_reminders_cron failed — %s", str(e))
        raise


def send_communication_reminders_cron():
    """
    Called daily at 8:00 AM by django-crontab.
    Sends Y/N appointment reminders via the new communication workflow.
    Uses clinic-configurable reminder_hours_before setting.
    """
    logger.info("Cron: send_communication_reminders_cron started")
    try:
        call_command('send_communication_reminders')
        logger.info("Cron: send_communication_reminders_cron completed")
    except Exception as e:
        logger.error("Cron: send_communication_reminders_cron failed — %s", str(e))
        raise


def send_dna_followups_cron():
    """
    Called every 2 hours by django-crontab.
    Sends DNA follow-ups for appointments marked as DNA/NO_SHOW.
    """
    logger.info("Cron: send_dna_followups_cron started")
    try:
        call_command('send_dna_followups')
        logger.info("Cron: send_dna_followups_cron completed")
    except Exception as e:
        logger.error("Cron: send_dna_followups_cron failed — %s", str(e))
        raise


def send_rebook_followups_cron():
    """
    Called daily at 10:00 AM by django-crontab.
    Sends no-rebook follow-ups for patients who haven't rebooked
    after X days (configurable per clinic).
    """
    logger.info("Cron: send_rebook_followups_cron started")
    try:
        call_command('send_rebook_followups')
        logger.info("Cron: send_rebook_followups_cron completed")
    except Exception as e:
        logger.error("Cron: send_rebook_followups_cron failed — %s", str(e))
        raise


def send_inactive_checkins_cron():
    """
    Called weekly on Monday at 9:00 AM.
    Sends wellness check-ins to patients who haven't visited in X months.
    """
    logger.info("Cron: send_inactive_checkins_cron started")
    try:
        call_command('send_inactive_checkins')
        logger.info("Cron: send_inactive_checkins_cron completed")
    except Exception as e:
        logger.error("Cron: send_inactive_checkins_cron failed — %s", str(e))
        raise


def expire_subscriptions():
    """
    Called every hour by django-crontab.
    Expires active subscriptions that have already passed end_date.
    """
    logger.info("Cron: expire_subscriptions started")
    try:
        from apps.subscriptions.models import Subscription

        stale_subs = Subscription.objects.filter(
            status=Subscription.STATUS_ACTIVE,
            end_date__lt=timezone.now(),
        )
        expired_count = stale_subs.count()
        for sub in stale_subs:
            sub.expire()
        logger.info("Cron: expire_subscriptions completed (%s expired)", expired_count)
    except Exception as e:
        logger.error("Cron: expire_subscriptions failed — %s", str(e))
        raise


def rotate_passwords_cron():
    """
    Called daily at 2:00 AM by django-crontab.
    Rotates passwords for users with weekly / monthly / yearly schedules that are due.
    """
    logger.info("Cron: rotate_passwords_cron started")
    try:
        call_command('rotate_passwords')
        logger.info("Cron: rotate_passwords_cron completed")
    except Exception as e:
        logger.error("Cron: rotate_passwords_cron failed — %s", str(e))
        raise