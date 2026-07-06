"""
Reusable email utilities for the PMS.
Centralises booking-confirmation and new-client-welcome emails.
"""
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
import os
import logging

logger = logging.getLogger(__name__)


def _get_clinic_logo_url(clinic) -> str | None:
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
                os.environ.get('BACKEND_URL', 'https://malasakit-webservice.onrender.com'),
            )
            return f"{backend_url.rstrip('/')}{url}"
        except Exception:
            return None
    return None

def log_rendered_logos(html_content: str, clinic_logo_url: str | None, email_type: str, recipient: str):
    """Log whether the Malasakit and Clinic logos were successfully rendered in the email HTML."""
    has_malasakit = 'malasakit-logo.png' in html_content
    has_clinic = False
    if clinic_logo_url and clinic_logo_url in html_content:
        has_clinic = True
    
    logger.info(
        f"[{email_type}] Logos rendered for {recipient} -> "
        f"Malasakit: {'YES' if has_malasakit else 'NO'} | "
        f"Clinic: {'YES' if has_clinic else 'NO'} (URL: {clinic_logo_url})"
    )



# ── Booking confirmation email ────────────────────────────────────────────────

def send_booking_confirmation_email(booking) -> tuple[bool, str]:
    """
    Send a booking-confirmation email to the patient who just booked
    through the patient portal.

    Returns (success, error_message).
    """
    recipient_email = booking.patient_email
    if not recipient_email:
        msg = f"Portal booking #{booking.reference_number} has no email — skipping confirmation."
        logger.warning(msg)
        return False, msg

    clinic = booking.portal_link.clinic

    _notif_clinic = getattr(clinic, 'main_clinic', clinic)
    if not getattr(_notif_clinic, 'email_notifications_enabled', True):
        msg = f"Clinic {_notif_clinic.id} has email notifications disabled — skipping booking confirmation for #{booking.reference_number}."
        logger.info(msg)
        return False, msg

    practitioner_name = ''
    if booking.practitioner and booking.practitioner.user:
        practitioner_name = booking.practitioner.user.get_full_name()

    service_name = booking.service.name if booking.service else 'General Consultation'

    context = {
        'patient_first_name': booking.patient_first_name,
        'appointment_date':   booking.appointment_date.strftime('%A, %d %B %Y'),
        'appointment_time':   booking.appointment_time.strftime('%I:%M %p'),
        'service_name':       service_name,
        'practitioner_name':  practitioner_name,
        'clinic_name':        clinic.name,
        'clinic_phone':       getattr(clinic, 'phone', ''),
        'clinic_address':     getattr(clinic, 'address', ''),
        'clinic_email':       getattr(clinic, 'email', settings.DEFAULT_FROM_EMAIL),
        'clinic_logo_url':    _get_clinic_logo_url(clinic),
        'notes':              booking.notes or '',
        'reference_number':   booking.reference_number,
    }

    try:
        subject = (
            f"Booking Confirmed – {context['appointment_date']} "
            f"at {context['appointment_time']} | {clinic.name}"
        )
        text_content = render_to_string('appointments/email/booking_confirmation.txt', context)
        html_content = render_to_string('appointments/email/booking_confirmation.html', context)
    except Exception as e:
        msg = f"Template render error for booking #{booking.reference_number}: {e}"
        logger.error(msg)
        return False, msg

    try:
        msg_obj = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient_email],
            reply_to=[context['clinic_email']],
        )
        msg_obj.attach_alternative(html_content, 'text/html')
        msg_obj.send(fail_silently=False)

        logger.info(
            "Booking confirmation sent → booking=%s email=%s",
            booking.reference_number, recipient_email,
        )
        log_rendered_logos(html_content, context.get('clinic_logo_url'), 'Booking Confirmation', recipient_email)
        return True, ''
    except Exception as e:
        error_msg = f"SMTP error for booking confirmation #{booking.reference_number}: {e}"
        logger.error(error_msg)
        return False, error_msg


# ── New-client welcome email ──────────────────────────────────────────────────

def send_new_client_welcome_email(patient) -> tuple[bool, str]:
    """
    Send a welcome email to a newly created patient.

    Returns (success, error_message).
    """
    recipient_email = getattr(patient, 'email', None)
    if not recipient_email:
        msg = f"Patient {patient.id} has no email — skipping welcome email."
        logger.warning(msg)
        return False, msg

    if not patient.send_email_notifications:
        msg = f"Patient {patient.id} has email notifications disabled — skipping welcome."
        logger.info(msg)
        return False, msg

    clinic = patient.clinic

    _notif_clinic = getattr(clinic, 'main_clinic', clinic)
    if not getattr(_notif_clinic, 'email_notifications_enabled', True):
        msg = f"Clinic {_notif_clinic.id} has email notifications disabled — skipping welcome email for patient {patient.id}."
        logger.info(msg)
        return False, msg

    context = {
        'patient_first_name': patient.first_name,
        'patient_full_name':  patient.get_full_name(),
        'patient_number':     patient.patient_number,
        'clinic_name':        clinic.name,
        'clinic_phone':       getattr(clinic, 'phone', ''),
        'clinic_address':     getattr(clinic, 'address', ''),
        'clinic_email':       getattr(clinic, 'email', settings.DEFAULT_FROM_EMAIL),
        'clinic_logo_url':    _get_clinic_logo_url(clinic),
    }

    try:
        subject = f"Welcome to {clinic.name}!"
        text_content = render_to_string('appointments/email/new_client_welcome.txt', context)
        html_content = render_to_string('appointments/email/new_client_welcome.html', context)
    except Exception as e:
        msg = f"Template render error for welcome email, patient {patient.id}: {e}"
        logger.error(msg)
        return False, msg

    try:
        msg_obj = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient_email],
            reply_to=[context['clinic_email']],
        )
        msg_obj.attach_alternative(html_content, 'text/html')
        msg_obj.send(fail_silently=False)

        logger.info(
            "Welcome email sent → patient=%s (%s) email=%s",
            patient.id, patient.patient_number, recipient_email,
        )
        log_rendered_logos(html_content, context.get('clinic_logo_url'), 'New Client Welcome', recipient_email)
        return True, ''
    except Exception as e:
        error_msg = f"SMTP error for welcome email, patient {patient.id}: {e}"
        logger.error(error_msg)
        return False, error_msg
