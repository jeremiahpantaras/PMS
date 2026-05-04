"""
Utility for broadcasting live occupancy updates to connected clients via
Django Channels / Redis channel layer.

Called from the Appointment post_save signal after status changes that
affect occupancy (IN_PROGRESS, CHECKED_IN, COMPLETED, etc.).
"""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def _get_occupancy_group(main_clinic_id: int) -> str:
    return f'occupancy_{main_clinic_id}'


def _resolve_main_clinic_id_from_appt(appt) -> int | None:
    """Walk up to the root clinic from an Appointment's clinic FK."""
    try:
        clinic = appt.clinic
        if clinic is None:
            return None
        return clinic.main_clinic.id
    except Exception as exc:
        logger.warning(
            '[occupancy_events] failed to resolve main_clinic for appt %s: %s',
            getattr(appt, 'id', '?'), exc,
        )
        return None


def emit_occupancy_update(appt) -> None:
    """
    Broadcast an OCCUPANCY_UPDATE event for the given Appointment to all
    WebSocket clients subscribed to the clinic's occupancy channel group.

    Safe to call from synchronous Django code (signal handlers, DRF views).
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    main_clinic_id = _resolve_main_clinic_id_from_appt(appt)
    if main_clinic_id is None:
        return

    prac = getattr(appt, 'practitioner', None)
    if prac is None:
        return

    # Determine occupancy status
    occupied_statuses = {'IN_PROGRESS', 'CHECKED_IN', 'ARRIVED'}
    occupancy_status = 'occupied' if appt.status in occupied_statuses else 'available'

    patient_name = ''
    if appt.patient:
        try:
            patient_name = appt.patient.get_full_name()
        except Exception:
            pass

    service_name = ''
    if appt.service:
        try:
            service_name = appt.service.name
        except Exception:
            pass

    prac_name = ''
    if prac.user:
        try:
            prac_name = prac.user.get_full_name()
        except Exception:
            pass

    payload = {
        'type':            'OCCUPANCY_UPDATE',
        'practitioner_id': prac.id,
        'name':            prac_name,
        'status':          occupancy_status,
        'current_patient': patient_name if occupancy_status == 'occupied' else None,
        'start_time':      str(appt.start_time) if appt.start_time else None,
        'service':         service_name,
        'appointment_id':  appt.id,
        'appt_status':     appt.status,
    }

    group_name = _get_occupancy_group(main_clinic_id)

    try:
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type':    'occupancy_update',   # maps to OccupancyConsumer.occupancy_update()
                'payload': payload,
            },
        )
        logger.debug(
            '[occupancy_events] sent OCCUPANCY_UPDATE → group=%s prac=%s status=%s',
            group_name, prac.id, occupancy_status,
        )
    except Exception as exc:
        logger.warning('[occupancy_events] group_send failed: %s', exc)
