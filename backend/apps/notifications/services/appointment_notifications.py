"""
Appointment-specific notification logic — clinic-wide.

  notify_new_booking(appointment)
    → diary Appointment created/confirmed → ONE notification for the whole clinic

  notify_new_portal_booking(portal_booking)
    → PortalBooking submitted via patient portal → ONE notification for the whole clinic

  send_daily_summary()
    → scheduled job → ONE DAILY_SUMMARY per clinic branch
"""
import logging
from django.utils import timezone

from apps.notifications.services.notification_service import create_notification

logger = logging.getLogger(__name__)


def _format_time(dt):
    """Return '2:30 PM' style string from a time or datetime."""
    if dt is None:
        return '—'
    try:
        return dt.strftime('%-I:%M %p')
    except ValueError:
        return dt.strftime('%I:%M %p')  # Windows fallback


# ─── 1. Diary Appointment Notification ───────────────────────────────────────

def notify_new_booking(appointment) -> None:
    """
    Fire when a diary Appointment is created or confirmed.
    Creates ONE clinic-wide notification — all users in the clinic see it.
    """
    try:
        branch       = appointment.clinic
        patient      = appointment.patient
        appt_time    = _format_time(appointment.start_time)
        patient_name = (
            f"{patient.first_name} {patient.last_name}"
            if patient else "Unknown Patient"
        )

        title   = f"New Booking: {patient_name}"
        message = (
            f"{patient_name} has a diary appointment on "
            f"{appointment.date.strftime('%B %d, %Y')} at {appt_time}."
        )
        link_url = f"/diary?date={appointment.date.strftime('%Y-%m-%d')}&appointment={appointment.id}"

        create_notification(
            clinic=branch,
            notification_type='NEW_BOOKING',
            title=title,
            message=message,
            link_url=link_url,
            appointment=appointment,
            patient=patient,
            practitioner=appointment.practitioner,
            clinic_branch=branch,
        )

        logger.info(
            "notify_new_booking: created clinic-wide notification for appointment %s",
            appointment.id,
        )

    except Exception as exc:
        logger.exception(
            "notify_new_booking failed for appointment %s: %s",
            getattr(appointment, 'id', '?'), exc,
        )


# ─── 2. Portal Booking Notification ──────────────────────────────────────────

def notify_new_portal_booking(portal_booking) -> None:
    """
    Fire immediately when a patient submits a booking via the patient portal.
    Creates ONE clinic-wide notification.
    """
    try:
        branch = portal_booking.portal_link.clinic

        patient_name = (
            f"{portal_booking.patient_first_name} {portal_booking.patient_last_name}"
        ).strip() or "Unknown Patient"

        appt_date = portal_booking.appointment_date
        appt_time = portal_booking.appointment_time

        try:
            time_str = appt_time.strftime('%-I:%M %p')
        except (ValueError, AttributeError):
            time_str = appt_time.strftime('%I:%M %p') if appt_time else '—'

        service_name = portal_booking.service.name if portal_booking.service else 'General Consultation'

        title = f"New Portal Booking: {patient_name}"
        message = (
            f"{patient_name} submitted a portal booking for "
            f"{service_name} on "
            f"{appt_date.strftime('%B %d, %Y')} at {time_str}. "
            f"Reference: #{portal_booking.reference_number}"
        )
        link_url = f"/diary?date={appt_date.strftime('%Y-%m-%d')}"

        create_notification(
            clinic=branch,
            notification_type='ONLINE_BOOKING',
            title=title,
            message=message,
            link_url=link_url,
            appointment=None,
            practitioner=portal_booking.practitioner,
            clinic_branch=portal_booking.branch or branch,
        )

        logger.info(
            "notify_new_portal_booking: created clinic-wide notification for portal booking #%s",
            portal_booking.reference_number,
        )

    except Exception as exc:
        logger.exception(
            "notify_new_portal_booking failed for portal_booking %s: %s",
            getattr(portal_booking, 'id', '?'), exc,
        )


# ─── 2b. New Client Notification ─────────────────────────────────────────────

def notify_new_client(patient) -> None:
    """
    Fire when a new Patient is registered in the clinic.
    Creates ONE clinic-wide notification.
    """
    try:
        branch = patient.clinic

        patient_name = patient.get_full_name() or "Unknown Patient"
        title = f"New Client: {patient_name}"
        message = f"{patient_name} was registered as a new client."
        link_url = f"/patients/{patient.id}"

        create_notification(
            clinic=branch,
            notification_type='NEW_CLIENT',
            title=title,
            message=message,
            link_url=link_url,
            patient=patient,
            clinic_branch=branch,
        )

        logger.info(
            "notify_new_client: created clinic-wide notification for patient %s",
            patient.id,
        )

    except Exception as exc:
        logger.exception(
            "notify_new_client failed for patient %s: %s",
            getattr(patient, 'id', '?'), exc,
        )


# ─── 3. Daily Summary Notification ───────────────────────────────────────────

def send_daily_summary() -> None:
    """
    Called once per day (via tasks.py / cron).
    For every active clinic branch, creates ONE DAILY_SUMMARY notification
    visible to all users in the clinic.
    """
    from apps.appointments.models import Appointment
    from apps.clinics.models import Clinic

    today     = timezone.localdate()
    today_str = today.strftime('%B %d, %Y')
    branches  = Clinic.objects.filter(is_active=True, is_deleted=False)
    total_sent = 0

    for branch in branches:
        appointments = (
            Appointment.objects
            .filter(
                clinic=branch,
                date=today,
                status__in=['CONFIRMED', 'PENDING', 'SCHEDULED'],
                is_deleted=False,
            )
            .select_related('patient')
            .order_by('start_time')
        )

        count = appointments.count()

        if count == 0:
            title   = f"No Appointments Today — {branch.name}"
            message = f"There are no appointments scheduled for {branch.name} on {today_str}."
        else:
            lines = [
                f"  • {_format_time(appt.start_time)} — "
                f"{appt.patient.first_name} {appt.patient.last_name}"
                for appt in appointments
            ]
            title   = f"{count} Appointment{'s' if count != 1 else ''} Today — {branch.name}"
            message = (
                f"{branch.name} has {count} appointment{'s' if count != 1 else ''} "
                f"on {today_str}:\n" + "\n".join(lines)
            )

        link_url = f"/diary?date={today.strftime('%Y-%m-%d')}"

        create_notification(
            clinic=branch,
            notification_type='DAILY_SUMMARY',
            title=title,
            message=message,
            link_url=link_url,
            clinic_branch=branch,
        )

        total_sent += 1

        logger.info(
            "send_daily_summary: branch '%s' — %d appts, 1 clinic-wide notification created",
            branch.name, count,
        )

    logger.info("send_daily_summary: total clinic-wide notifications created = %d", total_sent)