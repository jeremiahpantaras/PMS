from django.conf import settings
from django.utils import timezone
import logging
import re

logger = logging.getLogger(__name__)


def _normalize_phone(phone: str) -> str | None:
    """
    Ensure the phone number is in E.164 format.
    Assumes the database already stores valid international numbers,
    but performs a safe fallback parse just in case.
    """
    if not phone:
        return None

    try:
        import phonenumbers
        parsed = phonenumbers.parse(phone, "PH")
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception as e:
        logger.warning(f"Could not parse phone number '{phone}' in sms_service: {e}")
        
    return phone if phone.startswith('+') else None


def send_appointment_reminder_sms(appointment) -> tuple[bool, str]:
    """
    Send a reminder SMS to the patient for their upcoming appointment using the integrated SMS Gateway.

    Returns:
        (success: bool, error_message: str)
    """
    # ── Guard: SMS must be enabled ────────────────────────────────────────────
    if not getattr(settings, 'SMS_REMINDERS_ENABLED', True):
        msg = "SMS reminders are disabled (SMS_REMINDERS_ENABLED=False)."
        logger.info(msg)
        return False, msg

    patient = appointment.patient
    clinic  = appointment.clinic

    # ── Guard: Clinic master SMS switch ───────────────────────────────────────
    if not getattr(clinic, 'sms_notifications_enabled', False):
        msg = f"SMS reminders are disabled globally for clinic {clinic.id}."
        logger.info(msg)
        return False, msg

    # ── Guard: Patient SMS opt-in switch ──────────────────────────────────────
    if not getattr(patient, 'sms_notifications_enabled', False):
        msg = f"Patient {patient.id} has opted out of SMS notifications."
        logger.info(msg)
        return False, msg

    # ── Guard: patient must have a phone number ───────────────────────────────
    raw_phone = getattr(patient, 'phone', None) or getattr(patient, 'contact_number', None)
    if not raw_phone:
        msg = f"Patient {patient.id} has no phone number — skipping SMS reminder."
        logger.warning(msg)
        return False, msg

    # ── Normalize phone number ────────────────────────────────────────────────
    to_number = _normalize_phone(raw_phone)
    if not to_number:
        msg = f"Patient {patient.id} phone '{raw_phone}' could not be normalized to E.164."
        logger.warning(msg)
        return False, msg

    practitioner_name = (
        appointment.practitioner.user.get_full_name()
        if appointment.practitioner and appointment.practitioner.user
        else 'your practitioner'
    )
    location_name = (
        appointment.location.name
        if appointment.location
        else clinic.name
    )

    # ── Generate action tokens for SMS links ──────────────────────────────────
    frontend_base = getattr(settings, 'FRONTEND_URL', 'https://app.mespms.com').rstrip('/')
    confirm_url = ''
    cancel_url = ''
    rebook_url = ''

    try:
        from apps.appointments.models import AppointmentConfirmToken, AppointmentCancelToken, RebookingLink

        # 1. Confirm Token
        AppointmentConfirmToken.objects.filter(
            appointment=appointment, is_used=False
        ).update(is_used=True, used_at=timezone.now())
        confirm_token = AppointmentConfirmToken.objects.create(appointment=appointment)
        confirm_url = f"{frontend_base}/confirm/{confirm_token.token}"

        # 2. Cancel Token
        AppointmentCancelToken.objects.filter(
            appointment=appointment, is_used=False
        ).update(is_used=True, used_at=timezone.now())
        cancel_token = AppointmentCancelToken.objects.create(appointment=appointment)
        cancel_url = f"{frontend_base}/cancel/{cancel_token.token}"

        # 3. Rebook Token
        RebookingLink.objects.filter(
            appointment=appointment, is_used=False
        ).update(is_used=True, used_at=timezone.now())
        rebook_token = RebookingLink.objects.create(patient=patient, appointment=appointment)
        rebook_url = f"{frontend_base}/rebook/{rebook_token.token}"
    except Exception as e:
        logger.warning("Could not create SMS tokens for appt #%s: %s", appointment.id, e)

    context = {
        'patient_first_name':  patient.first_name,
        'patient_full_name':   patient.get_full_name(),
        'appointment_date':    appointment.date.strftime('%a, %b %d %Y'),
        'appointment_time':    appointment.start_time.strftime('%I:%M %p'),
        'practitioner_name':   practitioner_name,
        'location_name':       location_name,
        'clinic_name':         clinic.name,
        'confirm_url':         confirm_url,
        'cancel_url':          cancel_url,
        'rebook_url':          rebook_url,
    }

    try:
        from django.template.loader import render_to_string
        body = render_to_string('appointments/sms/reminder.txt', context).strip()
    except Exception as e:
        msg = f"SMS Template render error for appointment {appointment.id}: {e}"
        logger.error(msg)
        return False, msg

    # ── Queue SMS via SMSGateway ──────────────────────────────────────────────
    try:
        from apps.smsgateway.models import SMSMessage
        from apps.smsgateway.tasks import dispatch_sms_task

        sms_message = SMSMessage.objects.create(
            recipient_number=to_number,
            body=body,
            status=SMSMessage.STATUS_QUEUED
        )
        
        try:
            dispatch_sms_task.delay(str(sms_message.id))
        except Exception as e:
            # Silently pass if Celery/Redis is not running in production to save money.
            # The message is safely queued in the DB for the Android app to pick up!
            pass

        # ── Log to AppointmentReminder ────────────────────────────────────────
        from apps.appointments.models import AppointmentReminder
        AppointmentReminder.objects.create(
            appointment   = appointment,
            reminder_type = 'SMS',
            is_successful = True,
            error_message = '',
        )

        try:
            from apps.notifications.models import CommunicationLog
            from apps.notifications.services.notification_service import broadcast_communication_log_updated
            new_log = CommunicationLog.objects.create(
                clinic=clinic,
                patient=patient,
                appointment=appointment,
                practitioner=appointment.practitioner,
                comm_type='APPOINTMENT_REMINDER',
                channel='SMS',
                status='SENT',
                recipient=to_number,
                subject='SMS Appointment Reminder',
                body_preview=body[:2000] if body else '',
                full_body=body,
            )
            broadcast_communication_log_updated(new_log)
        except Exception as comm_e:
            logger.warning("Failed to create CommunicationLog in sms_service: %s", comm_e)

        logger.info(
            "SMS reminder queued → appointment_id=%s patient=%s phone=%s sms_id=%s",
            appointment.id, patient.id, to_number, sms_message.id,
        )
        return True, ''

    except Exception as e:
        error_msg = f"SMS Gateway error for appointment {appointment.id}: {e}"
        logger.error(error_msg)

        # ── Log failed attempt ────────────────────────────────────────────────
        try:
            from apps.appointments.models import AppointmentReminder
            AppointmentReminder.objects.create(
                appointment   = appointment,
                reminder_type = 'SMS',
                is_successful = False,
                error_message = str(e),
            )
        except Exception:
            pass

        return False, error_msg


def send_bulk_sms_reminders(appointments_qs) -> dict:
    """
    Send SMS reminders for a queryset of appointments.

    Returns a summary dict: { sent, skipped, failed, errors }
    """
    summary = {'sent': 0, 'skipped': 0, 'failed': 0, 'errors': []}

    for appointment in appointments_qs:
        success, message = send_appointment_reminder_sms(appointment)
        if success:
            summary['sent'] += 1
        elif any(
            phrase in message.lower()
            for phrase in ['no phone', 'disabled', 'not configured', 'could not be normalized']
        ):
            summary['skipped'] += 1
        else:
            summary['failed'] += 1
            summary['errors'].append({
                'appointment_id': appointment.id,
                'error': message,
            })

    return summary