"""
Core low-level service for creating clinic-wide Notification records.
After creation, pushes the notification to ALL active users in the clinic
via their individual WebSocket channels.

✅ ONE notification record per clinic — WebSocket push to ALL clinic users
"""
import logging
from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from apps.notifications.models import Notification

logger = logging.getLogger(__name__)
User = get_user_model()


def _get_main_clinic(clinic):
    """Resolve to the root/main clinic."""
    if clinic.parent_clinic_id:
        return clinic.parent_clinic
    return clinic


def _push_to_all_clinic_users(notification: Notification) -> None:
    """
    Push the notification via WebSocket to every active user in the clinic.
    Each user has their own private channel group: notifications_<user_id>
    """
    try:
        from channels.layers import get_channel_layer
        from apps.notifications.serializers import NotificationSerializer

        channel_layer = get_channel_layer()
        if channel_layer is None:
            logger.warning('Channel layer is None — WebSocket push skipped')
            return

        # Serialize WITHOUT request context — is_read will default to False
        # which is correct: it's a brand-new notification, nobody has read it yet
        payload = NotificationSerializer(notification).data
        # Force is_read=False and read_at=None for the broadcast
        payload['is_read'] = False
        payload['read_at'] = None

        main_clinic = notification.clinic

        # Get all active, non-deleted users that belong to this clinic family
        from django.db.models import Q
        all_branch_ids = list(
            main_clinic.get_all_branches().values_list('id', flat=True)
        )

        users = User.objects.filter(
            is_active=True,
            is_deleted=False,
            clinic_id__in=all_branch_ids,
        ).values_list('id', flat=True)

        for user_id in users:
            async_to_sync(channel_layer.group_send)(
                f'notifications_{user_id}',
                {
                    'type': 'notification.new',
                    'notification': payload,
                }
            )

        logger.debug(
            'Notification %s pushed to %d users in clinic %s via WebSocket',
            notification.id, len(users), main_clinic.id
        )

    except Exception as exc:
        logger.exception('_push_to_all_clinic_users failed: %s', exc)


def create_notification(
    *,
    clinic,
    notification_type: str,
    title: str,
    message: str,
    link_url: str = '',
    appointment=None,
    patient=None,
    practitioner=None,
    clinic_branch=None,
) -> Notification:
    """
    Create a single clinic-wide Notification and push it to all clinic users.

    Args:
        clinic:            The clinic (branch or main) — will be resolved to main clinic.
        notification_type: 'NEW_BOOKING' or 'DAILY_SUMMARY'
        title:             Notification title
        message:           Notification body
        link_url:          Frontend route to navigate to
        appointment:       Optional Appointment FK
        clinic_branch:     Optional — which branch this concerns (for display)
    """
    main_clinic = _get_main_clinic(clinic)

    notification = Notification.objects.create(
        clinic=main_clinic,
        notification_type=notification_type,
        title=title,
        message=message,
        link_url=link_url,
        appointment=appointment,
        patient=patient,
        practitioner=practitioner,
        clinic_branch=clinic_branch,
    )

    _push_to_all_clinic_users(notification)

    return notification


def broadcast_communication_log_updated(comm_log) -> None:
    """
    Broadcasts a CommunicationLog update (e.g. status change to REPLIED) 
    via WebSocket to all active users in the clinic.
    """
    try:
        from channels.layers import get_channel_layer
        from apps.notifications.serializers import CommunicationLogSerializer

        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        payload = CommunicationLogSerializer(comm_log).data
        main_clinic = _get_main_clinic(comm_log.clinic)

        all_branch_ids = list(
            main_clinic.get_all_branches().values_list('id', flat=True)
        )

        users = User.objects.filter(
            is_active=True,
            is_deleted=False,
            clinic_id__in=all_branch_ids,
        ).values_list('id', flat=True)

        for user_id in users:
            async_to_sync(channel_layer.group_send)(
                f'notifications_{user_id}',
                {
                    'type': 'communication.updated',
                    'communication_log': payload,
                }
            )

        logger.debug(
            'CommunicationLog %s pushed to %d users in clinic %s via WebSocket',
            comm_log.id, len(users), main_clinic.id
        )

    except Exception as exc:
        logger.exception('broadcast_communication_log_updated failed: %s', exc)