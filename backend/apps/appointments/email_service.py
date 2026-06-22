from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.utils import timezone
import logging
import os

from apps.common.email_utils import log_rendered_logos

logger = logging.getLogger(__name__)


def get_clinic_logo_url(clinic) -> str | None:
    """Get the clinic logo URL for use in emails."""
    if not clinic.logo:
        return None
    if hasattr(clinic.logo, 'url'):
        try:
            url = clinic.logo.url
            # Cloudinary / absolute URLs are already usable
            if url.startswith('http'):
                return url
            # Local storage: build an absolute URL so email clients can fetch it
            backend_url = getattr(
                settings, 'BACKEND_URL',
                os.environ.get('BACKEND_URL', 'http://localhost:8000'),
            )
            return f"{backend_url.rstrip('/')}{url}"
        except Exception:
            return None
    return None


def send_appointment_reminder_email(appointment) -> tuple[bool, str]:
    """
    Send a reminder email to the patient for their upcoming appointment.
    Returns: (success: bool, error_message: str)
    """
    patient = appointment.patient
    clinic  = appointment.clinic

    recipient_email = getattr(patient, 'email', None)
    if not recipient_email:
        msg = f"Patient {patient.id} has no email address — skipping reminder."
        logger.warning(msg)
        return False, msg

    if appointment.reminder_sent:
        msg = f"Reminder already sent for appointment {appointment.id} — skipping."
        logger.info(msg)
        return False, msg

    _notif_clinic = getattr(clinic, 'main_clinic', clinic)
    if not getattr(_notif_clinic, 'email_notifications_enabled', True):
        msg = f"Clinic {_notif_clinic.id} has email notifications disabled — skipping reminder for appointment {appointment.id}."
        logger.info(msg)
        return False, msg

    practitioner_name = (
        appointment.practitioner.user.get_full_name()
        if appointment.practitioner and appointment.practitioner.user
        else 'Your practitioner'
    )
    location_name = (
        appointment.location.name
        if appointment.location
        else clinic.name
    )

    context = {
        'patient_first_name':  patient.first_name,
        'patient_full_name':   patient.get_full_name(),
        'appointment_date':    appointment.date.strftime('%A, %d %B %Y'),
        'appointment_time':    appointment.start_time.strftime('%I:%M %p'),
        'appointment_type':    appointment.get_appointment_type_display(),
        'practitioner_name':   practitioner_name,
        'location_name':       location_name,
        'clinic_name':         clinic.name,
        'clinic_phone':        getattr(clinic, 'phone', ''),
        'clinic_address':      getattr(clinic, 'address', ''),
        'clinic_email':        getattr(clinic, 'email', settings.DEFAULT_FROM_EMAIL),
        'clinic_logo_url':     get_clinic_logo_url(clinic),
        'chief_complaint':     appointment.chief_complaint or '',
        'notes_for_patient':   appointment.patient_notes or '',
        'appointment_id':      appointment.id,
    }

    try:
        subject      = (
            f"Appointment Reminder – {context['appointment_date']} "
            f"at {context['appointment_time']} | {clinic.name}"
        )
        text_content = render_to_string('appointments/email/reminder.txt',  context)
        html_content = render_to_string('appointments/email/reminder.html', context)
    except Exception as e:
        msg = f"Template render error for appointment {appointment.id}: {e}"
        logger.error(msg)
        return False, msg

    try:
        msg_obj = EmailMultiAlternatives(
            subject    = subject,
            body       = text_content,
            from_email = settings.DEFAULT_FROM_EMAIL,
            to         = [recipient_email],
            reply_to   = [context['clinic_email']],
        )
        msg_obj.attach_alternative(html_content, 'text/html')
        msg_obj.send(fail_silently=False)

        appointment.reminder_sent    = True
        appointment.reminder_sent_at = timezone.now()
        appointment.save(update_fields=['reminder_sent', 'reminder_sent_at'])

        from apps.appointments.models import AppointmentReminder
        AppointmentReminder.objects.create(
            appointment   = appointment,
            reminder_type = 'EMAIL',
            is_successful = True,
            error_message = '',
        )

        logger.info(
            "Reminder sent → appointment_id=%s patient=%s email=%s",
            appointment.id, patient.id, recipient_email,
        )
        log_rendered_logos(html_content, context.get('clinic_logo_url'), 'Appointment Reminder', recipient_email)
        return True, ''

    except Exception as e:
        error_msg = f"SMTP error for appointment {appointment.id}: {e}"
        logger.error(error_msg)
        try:
            from apps.appointments.models import AppointmentReminder
            AppointmentReminder.objects.create(
                appointment   = appointment,
                reminder_type = 'EMAIL',
                is_successful = False,
                error_message = str(e),
            )
        except Exception:
            pass
        return False, error_msg


# ── NEW: Cancellation email ───────────────────────────────────────────────────

def send_appointment_cancellation_email(appointment, cancellation_reason: str) -> tuple[bool, str]:
    """
    Send a cancellation notification email to the patient.

    Called after the appointment status has already been set to CANCELLED.
    Returns: (success: bool, error_message: str)
    """
    patient = appointment.patient
    clinic  = appointment.clinic

    # ── Guard: patient must have an email ────────────────────────────────
    recipient_email = getattr(patient, 'email', None)
    if not recipient_email:
        msg = f"Patient {patient.id} has no email — cancellation email skipped."
        logger.warning(msg)
        return False, msg

    # ── Build context ─────────────────────────────────────────────────────
    practitioner_name = (
        appointment.practitioner.user.get_full_name()
        if appointment.practitioner and appointment.practitioner.user
        else 'Your practitioner'
    )
    location_name = (
        appointment.location.name
        if appointment.location
        else clinic.name
    )
    cancelled_by_name = (
        appointment.cancelled_by.get_full_name()
        if appointment.cancelled_by
        else 'The clinic'
    )

    context = {
        'patient_first_name':   patient.first_name,
        'patient_full_name':    patient.get_full_name(),
        'appointment_date':     appointment.date.strftime('%A, %d %B %Y'),
        'appointment_time':     appointment.start_time.strftime('%I:%M %p'),
        'appointment_type':     appointment.get_appointment_type_display(),
        'practitioner_name':    practitioner_name,
        'location_name':        location_name,
        'clinic_name':          clinic.name,
        'clinic_phone':         getattr(clinic, 'phone', ''),
        'clinic_address':       getattr(clinic, 'address', ''),
        'clinic_email':         getattr(clinic, 'email', settings.DEFAULT_FROM_EMAIL),
        'clinic_logo_url':      get_clinic_logo_url(clinic),
        'cancellation_reason':  cancellation_reason,
        'cancelled_by_name':    cancelled_by_name,
        'cancelled_at':         appointment.cancelled_at.strftime('%A, %d %B %Y at %I:%M %p')
                                if appointment.cancelled_at else '',
        'appointment_id':       appointment.id,
    }

    # ── Render templates ──────────────────────────────────────────────────
    try:
        subject = (
            f"Appointment Cancelled – {context['appointment_date']} "
            f"at {context['appointment_time']} | {clinic.name}"
        )
        text_content = render_to_string('appointments/email/cancellation.txt', context)
        html_content = render_to_string('appointments/email/cancellation.html', context)
    except Exception as e:
        msg = f"Cancellation template render error for appointment {appointment.id}: {e}"
        logger.error(msg)
        return False, msg

    # ── Send ──────────────────────────────────────────────────────────────
    try:
        msg_obj = EmailMultiAlternatives(
            subject    = subject,
            body       = text_content,
            from_email = settings.DEFAULT_FROM_EMAIL,
            to         = [recipient_email],
            reply_to   = [context['clinic_email']],
        )
        msg_obj.attach_alternative(html_content, 'text/html')
        msg_obj.send(fail_silently=False)

        logger.info(
            "Cancellation email sent → appointment_id=%s patient=%s email=%s",
            appointment.id, patient.id, recipient_email,
        )
        log_rendered_logos(html_content, context.get('clinic_logo_url'), 'Appointment Cancellation', recipient_email)
        return True, ''

    except Exception as e:
        error_msg = f"Cancellation SMTP error for appointment {appointment.id}: {e}"
        logger.error(error_msg)
        return False, error_msg


def send_bulk_reminders(appointments_qs) -> dict:
    """
    Send reminders for a queryset of appointments.
    Returns a summary dict: { sent, skipped, failed, errors }
    """
    summary = {'sent': 0, 'skipped': 0, 'failed': 0, 'errors': []}

    for appointment in appointments_qs:
        success, message = send_appointment_reminder_email(appointment)
        if success:
            summary['sent'] += 1
        elif 'already sent' in message or 'no email' in message.lower():
            summary['skipped'] += 1
        else:
            summary['failed'] += 1
            summary['errors'].append({'appointment_id': appointment.id, 'error': message})

    return summary