"""
Automated Patient Communication Workflow Service.

Orchestrates:
  1. Booking confirmations   (immediate on create)
  2. Recurring confirmations (includes full schedule)
  3. Appointment reminders   (Y/N reply)
  4. DNA / decline follow-ups (reschedule link)
  5. No-rebook follow-ups    (delayed outreach)
  6. Inactive patient check-ins
"""
import logging
import os
from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from apps.common.email_utils import log_rendered_logos
from apps.clinics.models import ClinicCommunicationSettings
from apps.notifications.models import CommunicationLog

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_clinic_logo_url(clinic) -> str | None:
    import os
    if not clinic.logo:
        return None
    if hasattr(clinic.logo, 'url'):
        try:
            url = clinic.logo.url
            if url.startswith('http'):
                return url
            backend_url = getattr(
                settings, 'BACKEND_URL',
                os.environ.get('BACKEND_URL', 'http://localhost:8000'),
            )
            return f"{backend_url.rstrip('/')}{url}"
        except Exception:
            return None
    return None


def _get_portal_booking_url(clinic) -> str:
    """Build the branch-specific patient portal booking URL."""
    base = getattr(settings, 'PORTAL_BASE_URL', 'https://portal.mespms.com')
    slug = clinic.slug if clinic.slug else (clinic.branch_code or 'default')
    return f"{base}/book/{slug}"


def _should_send(clinic, patient, channel: str) -> bool:
    """Check master switches at clinic and patient level."""
    main_clinic = clinic.main_clinic

    if channel in ('EMAIL', 'BOTH'):
        if not main_clinic.email_notifications_enabled:
            return False
        if not getattr(patient, 'send_email_notifications', True):
            return False

    if channel in ('SMS', 'BOTH'):
        if not main_clinic.sms_notifications_enabled:
            return False
        if not getattr(patient, 'sms_notifications_enabled', False):
            return False

    return True


def _log_communication(
    *,
    clinic,
    patient=None,
    appointment=None,
    comm_type: str,
    channel: str,
    recipient: str,
    subject: str = '',
    body_preview: str = '',
    status: str = 'SENT',
    error_message: str = '',
) -> CommunicationLog:
    return CommunicationLog.objects.create(
        clinic=clinic.main_clinic,
        patient=patient,
        appointment=appointment,
        comm_type=comm_type,
        channel=channel,
        recipient=recipient,
        subject=subject,
        body_preview=body_preview[:500],
        status=status,
        error_message=error_message,
    )


def _send_email(*, recipient, subject, template_prefix, context, clinic,
                patient=None, appointment=None, comm_type: str) -> tuple[bool, str]:
    """Render and send an email, log it."""
    try:
        text = render_to_string(f'appointments/email/{template_prefix}.txt', context)
        html = render_to_string(f'appointments/email/{template_prefix}.html', context)
    except Exception as e:
        msg = f"Template render error ({template_prefix}): {e}"
        logger.error(msg)
        _log_communication(
            clinic=clinic, patient=patient, appointment=appointment,
            comm_type=comm_type, channel='EMAIL', recipient=recipient,
            subject=subject, status='FAILED', error_message=msg,
        )
        return False, msg

    try:
        email = EmailMultiAlternatives(
            subject=subject,
            body=text,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient],
            reply_to=[getattr(clinic, 'email', settings.DEFAULT_FROM_EMAIL)],
        )
        email.attach_alternative(html, 'text/html')
        email.send(fail_silently=False)

        _log_communication(
            clinic=clinic, patient=patient, appointment=appointment,
            comm_type=comm_type, channel='EMAIL', recipient=recipient,
            subject=subject, body_preview=text, status='SENT',
        )
        logger.info("Email sent → %s [%s] to %s", comm_type, template_prefix, recipient)
        log_rendered_logos(html, context.get('clinic_logo_url'), f"CommService: {comm_type}", recipient)
        return True, ''
    except Exception as e:
        msg = f"SMTP error ({template_prefix}): {e}"
        logger.error(msg)
        _log_communication(
            clinic=clinic, patient=patient, appointment=appointment,
            comm_type=comm_type, channel='EMAIL', recipient=recipient,
            subject=subject, status='FAILED', error_message=msg,
        )
        return False, msg


def _send_sms(*, recipient_phone, body, clinic,
              patient=None, appointment=None, comm_type: str) -> tuple[bool, str]:
    """Send an SMS via Twilio and log it."""
    from apps.appointments.sms_service import _normalize_phone

    to_number = _normalize_phone(recipient_phone)
    if not to_number:
        msg = f"Cannot normalize phone '{recipient_phone}'."
        _log_communication(
            clinic=clinic, patient=patient, appointment=appointment,
            comm_type=comm_type, channel='SMS', recipient=recipient_phone,
            body_preview=body, status='FAILED', error_message=msg,
        )
        return False, msg

    if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_FROM_NUMBER]):
        msg = "Twilio credentials not configured."
        _log_communication(
            clinic=clinic, patient=patient, appointment=appointment,
            comm_type=comm_type, channel='SMS', recipient=to_number,
            body_preview=body, status='FAILED', error_message=msg,
        )
        return False, msg

    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        message = client.messages.create(body=body, from_=settings.TWILIO_FROM_NUMBER, to=to_number)

        _log_communication(
            clinic=clinic, patient=patient, appointment=appointment,
            comm_type=comm_type, channel='SMS', recipient=to_number,
            body_preview=body, status='SENT',
        )
        logger.info("SMS sent → %s to %s sid=%s", comm_type, to_number, message.sid)
        return True, ''
    except Exception as e:
        msg = f"Twilio error: {e}"
        logger.error(msg)
        _log_communication(
            clinic=clinic, patient=patient, appointment=appointment,
            comm_type=comm_type, channel='SMS', recipient=to_number,
            body_preview=body, status='FAILED', error_message=msg,
        )
        return False, msg


def _dispatch(*, channel: str, clinic, patient, appointment=None,
              comm_type: str,
              email_subject: str, email_template: str, email_context: dict,
              sms_body: str) -> dict:
    """Send via the configured channel(s) and return result dict."""
    result = {'email': {'success': False, 'message': ''}, 'sms': {'success': False, 'message': ''}}

    if channel in ('EMAIL', 'BOTH') and patient.email:
        ok, msg = _send_email(
            recipient=patient.email,
            subject=email_subject,
            template_prefix=email_template,
            context=email_context,
            clinic=clinic,
            patient=patient,
            appointment=appointment,
            comm_type=comm_type,
        )
        result['email'] = {'success': ok, 'message': msg}

    if channel in ('SMS', 'BOTH') and getattr(patient, 'phone', ''):
        ok, msg = _send_sms(
            recipient_phone=patient.phone,
            body=sms_body,
            clinic=clinic,
            patient=patient,
            appointment=appointment,
            comm_type=comm_type,
        )
        result['sms'] = {'success': ok, 'message': msg}

    return result


# ─────────────────────────────────────────────────────────────────────────────
# 1. BOOKING CONFIRMATION
# ─────────────────────────────────────────────────────────────────────────────

def send_booking_confirmation(appointment) -> dict:
    """Send immediate booking confirmation after appointment creation."""
    patient = appointment.patient
    clinic  = appointment.clinic
    settings_obj = ClinicCommunicationSettings.get_for_clinic(clinic)

    if not settings_obj.booking_confirmations_enabled:
        return {'skipped': True, 'reason': 'Booking confirmations disabled'}

    channel = settings_obj.booking_confirmation_method
    if not _should_send(clinic, patient, channel):
        return {'skipped': True, 'reason': 'Notifications disabled at clinic/patient level'}

    practitioner_name = (
        appointment.practitioner.user.get_full_name()
        if appointment.practitioner and appointment.practitioner.user
        else 'Your practitioner'
    )
    location_name = appointment.location.name if appointment.location else clinic.name
    service_name  = appointment.service.name if appointment.service else appointment.get_appointment_type_display()

    context = {
        'patient_first_name':  patient.first_name,
        'patient_full_name':   patient.get_full_name(),
        'appointment_date':    appointment.date.strftime('%A, %d %B %Y'),
        'appointment_time':    appointment.start_time.strftime('%I:%M %p'),
        'service_name':        service_name,
        'practitioner_name':   practitioner_name,
        'location_name':       location_name,
        'clinic_name':         clinic.name,
        'clinic_phone':        getattr(clinic, 'phone', ''),
        'clinic_email':        getattr(clinic, 'email', settings.DEFAULT_FROM_EMAIL),
        'clinic_logo_url':     _get_clinic_logo_url(clinic),
        'duration_minutes':    appointment.duration_minutes,
        'booking_reference':   f"APT-{appointment.id:06d}",
    }

    sms_body = (
        f"Hi {patient.first_name}! Your appointment is confirmed.\n\n"
        f"📅 {context['appointment_date']}\n"
        f"⏰ {context['appointment_time']}\n"
        f"👤 {practitioner_name}\n"
        f"📍 {location_name}\n"
        f"🏥 {service_name}\n\n"
        f"Ref: {context['booking_reference']}\n"
        f"– {clinic.name}"
    )

    result = _dispatch(
        channel=channel, clinic=clinic, patient=patient, appointment=appointment,
        comm_type='BOOKING_CONFIRMATION',
        email_subject=f"Appointment Confirmed – {context['appointment_date']} | {clinic.name}",
        email_template='booking_confirmation',
        email_context=context,
        sms_body=sms_body,
    )

    appointment.confirmation_sent = True
    appointment.confirmation_sent_at = timezone.now()
    appointment.save(update_fields=['confirmation_sent', 'confirmation_sent_at'])

    return result


# ─────────────────────────────────────────────────────────────────────────────
# 2. RECURRING BOOKING CONFIRMATION
# ─────────────────────────────────────────────────────────────────────────────

def send_recurring_booking_confirmation(appointments: list) -> dict:
    """
    Send confirmation for a series of recurring appointments.
    Includes the full schedule list.
    """
    if not appointments:
        return {'skipped': True, 'reason': 'No appointments'}

    first   = appointments[0]
    patient = first.patient
    clinic  = first.clinic
    settings_obj = ClinicCommunicationSettings.get_for_clinic(clinic)

    if not settings_obj.booking_confirmations_enabled:
        return {'skipped': True, 'reason': 'Booking confirmations disabled'}

    channel = settings_obj.booking_confirmation_method
    if not _should_send(clinic, patient, channel):
        return {'skipped': True, 'reason': 'Notifications disabled'}

    practitioner_name = (
        first.practitioner.user.get_full_name()
        if first.practitioner and first.practitioner.user
        else 'Your practitioner'
    )
    location_name = first.location.name if first.location else clinic.name
    service_name  = first.service.name if first.service else first.get_appointment_type_display()

    schedule_list = [
        f"• {apt.date.strftime('%B %d, %Y')} – {apt.start_time.strftime('%I:%M %p')}"
        for apt in appointments
    ]

    context = {
        'patient_first_name':  patient.first_name,
        'patient_full_name':   patient.get_full_name(),
        'appointment_date':    first.date.strftime('%A, %d %B %Y'),
        'appointment_time':    first.start_time.strftime('%I:%M %p'),
        'service_name':        service_name,
        'practitioner_name':   practitioner_name,
        'location_name':       location_name,
        'clinic_name':         clinic.name,
        'clinic_phone':        getattr(clinic, 'phone', ''),
        'clinic_email':        getattr(clinic, 'email', settings.DEFAULT_FROM_EMAIL),
        'clinic_logo_url':     _get_clinic_logo_url(clinic),
        'total_appointments':  len(appointments),
        'schedule_list':       schedule_list,
        'schedule_list_text':  '\n'.join(schedule_list),
    }

    sms_lines = [
        f"Hi {patient.first_name}! Your recurring appointments are confirmed.",
        "",
        "Upcoming Recurring Appointments:",
    ] + schedule_list[:5]  # Limit SMS to 5 entries
    if len(schedule_list) > 5:
        sms_lines.append(f"  ... and {len(schedule_list) - 5} more")
    sms_lines += ["", f"– {clinic.name}"]

    result = _dispatch(
        channel=channel, clinic=clinic, patient=patient, appointment=first,
        comm_type='RECURRING_CONFIRMATION',
        email_subject=f"Recurring Appointments Confirmed ({len(appointments)} sessions) | {clinic.name}",
        email_template='recurring_confirmation',
        email_context=context,
        sms_body='\n'.join(sms_lines),
    )

    for apt in appointments:
        apt.confirmation_sent = True
        apt.confirmation_sent_at = timezone.now()
        apt.save(update_fields=['confirmation_sent', 'confirmation_sent_at'])

    return result


# ─────────────────────────────────────────────────────────────────────────────
# 3. APPOINTMENT REMINDER (with Y/N)
# ─────────────────────────────────────────────────────────────────────────────

def send_appointment_reminder_with_reply(appointment) -> dict:
    """Send a reminder that asks the patient to reply Y/N, with clickable email buttons."""
    patient = appointment.patient
    clinic  = appointment.clinic
    settings_obj = ClinicCommunicationSettings.get_for_clinic(clinic)

    if not settings_obj.reminders_enabled:
        return {'skipped': True, 'reason': 'Reminders disabled'}

    if appointment.reminder_sent:
        return {'skipped': True, 'reason': 'Reminder already sent'}

    channel = settings_obj.reminder_method
    if not _should_send(clinic, patient, channel):
        return {'skipped': True, 'reason': 'Notifications disabled'}

    practitioner_name = (
        appointment.practitioner.user.get_full_name()
        if appointment.practitioner and appointment.practitioner.user
        else 'Your practitioner'
    )
    location_name = appointment.location.name if appointment.location else clinic.name

    frontend_base = getattr(settings, 'FRONTEND_URL', 'https://app.mespms.com')

    # ── Generate confirm token for email button ───────────────────────────────
    confirm_url = ''
    try:
        from apps.appointments.models import AppointmentConfirmToken
        # Invalidate old unused confirm tokens for this appointment
        AppointmentConfirmToken.objects.filter(
            appointment=appointment, is_used=False,
        ).update(is_used=True, used_at=timezone.now())
        confirm_token = AppointmentConfirmToken.objects.create(appointment=appointment)
        confirm_url = f"{frontend_base.rstrip('/')}/confirm/{confirm_token.token}"
    except Exception as e:
        logger.warning("Could not create AppointmentConfirmToken for appt #%s: %s", appointment.id, e)

    # ── Generate rebooking token for "Cannot Attend" button ───────────────────
    reschedule_url = ''
    try:
        from apps.appointments.models import RebookingLink
        rebooking_link_obj = RebookingLink.objects.create(
            patient=patient,
            appointment=appointment,
        )
        reschedule_url = f"{frontend_base.rstrip('/')}/rebook/{rebooking_link_obj.token}"
    except Exception as e:
        logger.warning("Could not create RebookingLink for appt #%s: %s", appointment.id, e)

    context = {
        'patient_first_name':  patient.first_name,
        'patient_full_name':   patient.get_full_name(),
        'appointment_date':    appointment.date.strftime('%A, %d %B %Y'),
        'appointment_time':    appointment.start_time.strftime('%I:%M %p'),
        'appointment_type':    appointment.service.name if appointment.service else appointment.get_appointment_type_display(),
        'practitioner_name':   practitioner_name,
        'location_name':       location_name,
        'clinic_name':         clinic.name,
        'clinic_phone':        getattr(clinic, 'phone', ''),
        'clinic_email':        getattr(clinic, 'email', settings.DEFAULT_FROM_EMAIL),
        'clinic_logo_url':     _get_clinic_logo_url(clinic),
        'confirm_url':         confirm_url,
        'reschedule_url':      reschedule_url,
    }

    sms_body = (
        f"Hi {patient.first_name}!\n\n"
        f"📅 Reminder: You have an appointment on "
        f"{context['appointment_date']} at {context['appointment_time']}.\n\n"
        f"With: {practitioner_name}\n"
        f"At: {location_name}\n\n"
        f"Reply Y to confirm or N if unable to attend.\n\n"
        f"– {clinic.name}"
    )

    result = _dispatch(
        channel=channel, clinic=clinic, patient=patient, appointment=appointment,
        comm_type='APPOINTMENT_REMINDER',
        email_subject=f"Appointment Reminder – {context['appointment_date']} | {clinic.name}",
        email_template='reminder_yn',
        email_context=context,
        sms_body=sms_body,
    )

    appointment.reminder_sent = True
    appointment.reminder_sent_at = timezone.now()
    appointment.save(update_fields=['reminder_sent', 'reminder_sent_at'])

    return result


# ─────────────────────────────────────────────────────────────────────────────
# 4. DNA / DECLINE FOLLOW-UP
# ─────────────────────────────────────────────────────────────────────────────

def send_dna_followup(appointment) -> dict:
    """
    Send follow-up message after patient replies N or is marked DNA.
    Generates a patient-specific secure rebooking token link (24-hour expiry,
    one-time use) and includes it in the email/SMS.
    """
    patient = appointment.patient
    clinic  = appointment.clinic
    settings_obj = ClinicCommunicationSettings.get_for_clinic(clinic)

    logger.info(f"[DNA_FOLLOWUP] Starting for appointment #{appointment.id}, patient {patient.email}, clinic {clinic.id}")

    if not settings_obj.dna_followup_enabled:
        logger.warning(f"[DNA_FOLLOWUP] Skipped: dna_followup_enabled=False for clinic {clinic.id}")
        return {'skipped': True, 'reason': 'DNA follow-up disabled'}

    if appointment.dna_followup_sent:
        logger.warning(f"[DNA_FOLLOWUP] Skipped: dna_followup_sent=True for appointment #{appointment.id}")
        return {'skipped': True, 'reason': 'DNA follow-up already sent'}

    channel = settings_obj.dna_followup_method
    logger.info(f"[DNA_FOLLOWUP] Channel: {channel}, clinic email_notifications_enabled: {clinic.email_notifications_enabled}, patient.send_email_notifications: {getattr(patient, 'send_email_notifications', 'NOT_SET')}")

    if not _should_send(clinic, patient, channel):
        if channel == 'SMS' and _should_send(clinic, patient, 'EMAIL'):
            logger.warning(f"[DNA_FOLLOWUP] SMS disabled, falling back to EMAIL for clinic {clinic.id}, patient {patient.id}")
            channel = 'EMAIL'
        else:
            logger.warning(f"[DNA_FOLLOWUP] Skipped: _should_send=False for clinic {clinic.id}, patient {patient.id}")
            return {'skipped': True, 'reason': 'Notifications disabled'}

    # ── Generate secure rebooking token ────────────────────────────────────
    from apps.appointments.models import RebookingLink
    rebooking_link_obj = RebookingLink.objects.create(
        patient=patient,
        appointment=appointment,
    )
    frontend_base = getattr(settings, 'FRONTEND_URL', 'https://app.mespms.com')
    booking_url = f"{frontend_base.rstrip('/')}/rebook/{rebooking_link_obj.token}"

    context = {
        'patient_first_name': patient.first_name,
        'clinic_name':        clinic.name,
        'clinic_phone':       getattr(clinic, 'phone', ''),
        'clinic_email':       getattr(clinic, 'email', settings.DEFAULT_FROM_EMAIL),
        'clinic_logo_url':    _get_clinic_logo_url(clinic),
        'booking_url':        booking_url,
        'appointment_date':   appointment.date.strftime('%A, %d %B %Y'),
        'appointment_time':   appointment.start_time.strftime('%I:%M %p'),
    }

    sms_body = (
        f"Hi {patient.first_name},\n\n"
        f"Thanks for letting us know. We understand plans change.\n\n"
        f"To reschedule your appointment, please click:\n"
        f"{booking_url}\n\n"
        f"(Link expires in 24 hours)\n"
        f"– {clinic.name}"
    )

    result = _dispatch(
        channel=channel, clinic=clinic, patient=patient, appointment=appointment,
        comm_type='DNA_FOLLOWUP',
        email_subject=f"Reschedule Your Appointment | {clinic.name}",
        email_template='dna_followup',
        email_context=context,
        sms_body=sms_body,
    )

    logger.info(f"[DNA_FOLLOWUP] Dispatch result: {result}")

    appointment.dna_followup_sent = True
    appointment.dna_followup_sent_at = timezone.now()
    appointment.save(update_fields=['dna_followup_sent', 'dna_followup_sent_at'])

    logger.info(f"[DNA_FOLLOWUP] Completed for appointment #{appointment.id}, marked as sent")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# 5. NO-REBOOK DELAYED FOLLOW-UP
# ─────────────────────────────────────────────────────────────────────────────

def send_rebook_followup(appointment) -> dict:
    """
    Send follow-up if patient hasn't rebooked X days after DNA/decline.
    """
    patient = appointment.patient
    clinic  = appointment.clinic
    settings_obj = ClinicCommunicationSettings.get_for_clinic(clinic)

    if not settings_obj.rebook_followup_enabled:
        return {'skipped': True, 'reason': 'Rebook follow-up disabled'}

    if appointment.rebook_followup_sent:
        return {'skipped': True, 'reason': 'Rebook follow-up already sent'}

    channel = settings_obj.rebook_followup_method
    if not _should_send(clinic, patient, channel):
        return {'skipped': True, 'reason': 'Notifications disabled'}

    booking_url = _get_portal_booking_url(clinic)

    context = {
        'patient_first_name': patient.first_name,
        'clinic_name':        clinic.name,
        'clinic_phone':       getattr(clinic, 'phone', ''),
        'clinic_email':       getattr(clinic, 'email', settings.DEFAULT_FROM_EMAIL),
        'clinic_logo_url':    _get_clinic_logo_url(clinic),
        'booking_url':        booking_url,
    }

    sms_body = (
        f"Hi {patient.first_name},\n\n"
        f"We noticed you haven't rescheduled your missed appointment.\n"
        f"Would you like to book again?\n\n"
        f"Book here: {booking_url}\n\n"
        f"– {clinic.name}"
    )

    result = _dispatch(
        channel=channel, clinic=clinic, patient=patient, appointment=appointment,
        comm_type='REBOOK_FOLLOWUP',
        email_subject=f"We'd Love to See You Again | {clinic.name}",
        email_template='rebook_followup',
        email_context=context,
        sms_body=sms_body,
    )

    appointment.rebook_followup_sent = True
    appointment.rebook_followup_sent_at = timezone.now()
    appointment.save(update_fields=['rebook_followup_sent', 'rebook_followup_sent_at'])

    return result


# ─────────────────────────────────────────────────────────────────────────────
# 6. INACTIVE PATIENT WELLNESS CHECK-IN
# ─────────────────────────────────────────────────────────────────────────────

def send_inactive_patient_checkin(patient, clinic) -> dict:
    """
    Send a wellness check-in to a patient who hasn't visited in X months.
    """
    settings_obj = ClinicCommunicationSettings.get_for_clinic(clinic)

    if not settings_obj.inactive_checkin_enabled:
        return {'skipped': True, 'reason': 'Inactive check-in disabled'}

    channel = settings_obj.inactive_checkin_method
    if not _should_send(clinic, patient, channel):
        return {'skipped': True, 'reason': 'Notifications disabled'}

    booking_url = _get_portal_booking_url(clinic)

    months_away = settings_obj.inactive_patient_months
    if patient.last_visit_date:
        delta = (timezone.now().date() - patient.last_visit_date).days
        months_away = delta // 30

    # Get last treatment info
    last_complaint = ''
    from apps.appointments.models import Appointment
    last_appt = (
        Appointment.objects
        .filter(patient=patient, status='COMPLETED', is_deleted=False)
        .order_by('-date')
        .first()
    )
    if last_appt and last_appt.chief_complaint:
        last_complaint = last_appt.chief_complaint

    context = {
        'patient_first_name': patient.first_name,
        'patient_full_name':  patient.get_full_name(),
        'clinic_name':        clinic.name,
        'clinic_phone':       getattr(clinic, 'phone', ''),
        'clinic_email':       getattr(clinic, 'email', settings.DEFAULT_FROM_EMAIL),
        'clinic_logo_url':    _get_clinic_logo_url(clinic),
        'booking_url':        booking_url,
        'months_away':        months_away,
        'last_condition':     last_complaint or 'your previous concern',
    }

    sms_body = (
        f"Hi {patient.first_name},\n\n"
        f"We hope you're doing well! It's been {months_away} months "
        f"since your last visit.\n\n"
        f"How have things been? If you'd like to schedule a visit, "
        f"book here:\n{booking_url}\n\n"
        f"Warm regards,\n{clinic.name} Team"
    )

    result = _dispatch(
        channel=channel, clinic=clinic, patient=patient,
        comm_type='INACTIVE_CHECKIN',
        email_subject=f"We've Been Thinking of You | {clinic.name}",
        email_template='inactive_checkin',
        email_context=context,
        sms_body=sms_body,
    )

    patient.last_checkin_sent_at = timezone.now()
    patient.save(update_fields=['last_checkin_sent_at'])

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Y/N REPLY HANDLER
# ─────────────────────────────────────────────────────────────────────────────

def handle_patient_reply(appointment, reply: str) -> dict:
    """
    Process a Y/N reply from a patient (via SMS webhook or future email link).
    """
    reply = reply.strip().upper()
    now = timezone.now()

    appointment.patient_reply = reply
    appointment.patient_reply_at = now

    if reply == 'Y':
        appointment.confirmation_status = 'CONFIRMED'
        if appointment.status == 'SCHEDULED':
            appointment.status = 'CONFIRMED'
        appointment.save(update_fields=[
            'patient_reply', 'patient_reply_at', 'confirmation_status', 'status',
        ])

        # Log the reply
        _log_communication(
            clinic=appointment.clinic,
            patient=appointment.patient,
            appointment=appointment,
            comm_type='APPOINTMENT_REMINDER',
            channel='SMS',
            recipient=getattr(appointment.patient, 'phone', ''),
            body_preview=f'Patient replied Y — confirmed',
            status='REPLIED',
        )

        return {'action': 'confirmed', 'status': appointment.status}

    elif reply == 'N':
        appointment.confirmation_status = 'DECLINED'
        appointment.save(update_fields=[
            'patient_reply', 'patient_reply_at', 'confirmation_status',
        ])

        _log_communication(
            clinic=appointment.clinic,
            patient=appointment.patient,
            appointment=appointment,
            comm_type='APPOINTMENT_REMINDER',
            channel='SMS',
            recipient=getattr(appointment.patient, 'phone', ''),
            body_preview=f'Patient replied N — declined',
            status='REPLIED',
        )

        # Trigger DNA follow-up
        send_dna_followup(appointment)

        return {'action': 'declined', 'dna_followup_sent': True}

    return {'action': 'unknown_reply', 'reply': reply}
