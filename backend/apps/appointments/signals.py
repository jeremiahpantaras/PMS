"""
Signal handlers for the appointments app.
"""

import logging

logger = logging.getLogger(__name__)

# Status values that represent a meaningful occupancy state change.
_OCCUPANCY_STATUSES = frozenset({
    'SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'ARRIVED',
    'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'DNA',
})


def broadcast_occupancy_on_status_change(sender, instance, created, **kwargs):
    """
    post_save signal for Appointment.

    Broadcasts an OCCUPANCY_UPDATE over the clinic's WebSocket occupancy
    channel group whenever an appointment enters a status that affects the
    live occupancy view.

    Runs synchronously in the Django ORM thread; the actual channel-layer
    push is also sync (async_to_sync) so this is safe.
    """
    try:
        if instance.status not in _OCCUPANCY_STATUSES:
            return

        from .occupancy_events import emit_occupancy_update
        emit_occupancy_update(instance)
    except Exception as exc:
        # Never raise from a signal — log and continue.
        logger.warning(
            '[appointments.signals] broadcast_occupancy_on_status_change error '
            'for appt %s: %s',
            getattr(instance, 'id', '?'), exc,
        )
