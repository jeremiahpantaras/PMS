"""
Practitioner Role Removal — Impact Assessment & Cleanup Service

This module handles the controlled deactivation workflow when the PRACTITIONER
role is removed from a user.  It calculates the impact (counts of future
operational data) and atomically removes future scheduling records while
preserving all historical data.

Usage:
    from apps.accounts.services.practitioner_deactivation import (
        get_practitioner_removal_impact,
        execute_practitioner_removal,
    )

    impact = get_practitioner_removal_impact(user_id=42)
    # → { 'future_appointments': 5, 'future_blockouts': 2, ... }

    result = execute_practitioner_removal(user_id=42, performed_by=admin_user)
    # → atomically deletes future operational data, soft-deletes profile
"""

import logging
from datetime import date

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)

# ── Statuses that represent "active / future" appointments ────────────────────
# Completed, Cancelled, No-Show, DNA appointments are historical and NEVER
# touched by this workflow.
_ACTIVE_APPOINTMENT_STATUSES = [
    'SCHEDULED',
    'CONFIRMED',
    'CHECKED_IN',
]


def _get_practitioner_for_user(user_id: int):
    """
    Return the active (non-soft-deleted) Practitioner profile for a user,
    or None if no active profile exists.
    """
    from apps.clinics.models import Practitioner
    try:
        return Practitioner.objects.get(user_id=user_id, is_deleted=False)
    except Practitioner.DoesNotExist:
        return None


def get_practitioner_removal_impact(user_id: int) -> dict:
    """
    Calculate the impact of removing the PRACTITIONER role from a user.

    Returns a dict with counts of future operational data that would be
    deleted, plus the practitioner profile ID.

    Returns:
        {
            'practitioner_id': int | None,
            'future_appointments': int,
            'future_blockouts': int,
            'future_calendar_events': int,
            'has_impact': bool,
        }
    """
    from apps.appointments.models import (
        Appointment,
        BlockAppointment,
        CalendarNote,
    )

    practitioner = _get_practitioner_for_user(user_id)
    if practitioner is None:
        return {
            'practitioner_id': None,
            'future_appointments': 0,
            'future_blockouts': 0,
            'future_calendar_events': 0,
            'has_impact': False,
        }

    today = date.today()
    now_time = timezone.localtime().time()

    future_condition = Q(date__gt=today) | Q(date=today, start_time__gt=now_time)

    future_appointments = Appointment.objects.filter(
        future_condition,
        practitioner=practitioner,
        status__in=_ACTIVE_APPOINTMENT_STATUSES,
        is_deleted=False,
    ).count()

    future_blockouts = BlockAppointment.objects.filter(
        future_condition,
        practitioner=practitioner,
        is_deleted=False,
    ).count()

    future_calendar_events = CalendarNote.objects.filter(
        future_condition,
        practitioner=practitioner,
    ).count()

    has_impact = (
        future_appointments > 0
        or future_blockouts > 0
        or future_calendar_events > 0
    )

    return {
        'practitioner_id': practitioner.id,
        'future_appointments': future_appointments,
        'future_blockouts': future_blockouts,
        'future_calendar_events': future_calendar_events,
        'has_impact': has_impact,
    }


def execute_practitioner_removal(user_id: int, performed_by) -> dict:
    """
    Atomically remove future operational scheduling data and soft-delete the
    Practitioner profile.

    This function:
      1. Hard-deletes future appointments (date > today, active statuses)
      2. Hard-deletes future block appointments (date > today)
      3. Hard-deletes future calendar notes (date > today)
      4. Soft-deletes the Practitioner profile (is_deleted=True)
      5. Invalidates the practitioners cache

    Historical data (past appointments, completed/cancelled/no-show, clinical
    notes, invoices, etc.) is NEVER touched.

    Args:
        user_id:      ID of the user losing the PRACTITIONER role.
        performed_by: The User instance performing the removal (for audit).

    Returns:
        {
            'deleted_appointments': int,
            'deleted_blockouts': int,
            'deleted_calendar_events': int,
            'practitioner_soft_deleted': bool,
        }
    """
    from apps.appointments.models import (
        Appointment,
        BlockAppointment,
        CalendarNote,
    )
    from apps.clinics.models import Practitioner
    from apps.accounts.models import User

    practitioner = _get_practitioner_for_user(user_id)
    if practitioner is None:
        print(f">>> [practitioner_deactivation] NO ACTIVE PRACTITIONER PROFILE FOUND for user_id={user_id}. SKIPPING DELETION. <<<")
        logger.warning(
            'execute_practitioner_removal: no active Practitioner profile for user_id=%s',
            user_id,
        )
        return {
            'deleted_appointments': 0,
            'deleted_blockouts': 0,
            'deleted_calendar_events': 0,
            'practitioner_soft_deleted': False,
        }

    today = date.today()
    now_time = timezone.localtime().time()
    
    future_condition = Q(date__gt=today) | Q(date=today, start_time__gt=now_time)

    with transaction.atomic():
        # ── 1. Hard-delete future appointments ────────────────────────────
        future_apts_qs = Appointment.objects.filter(
            future_condition,
            practitioner=practitioner,
            status__in=_ACTIVE_APPOINTMENT_STATUSES,
            is_deleted=False,
        )
        future_apt_ids = list(future_apts_qs.values_list('id', 'date', 'status'))
        count_apts = len(future_apt_ids)
        print(f">>> [practitioner_deactivation] Future appointments found={count_apts} | IDs={future_apt_ids} <<<")
        logger.info(f"[PRACTITIONER REMOVAL] Future appointments found={count_apts}")
        
        deleted_appointments, _ = future_apts_qs.delete()
        print(f">>> [practitioner_deactivation] Future appointments deleted={deleted_appointments} <<<")
        logger.info(f"[PRACTITIONER REMOVAL] Future appointments deleted={deleted_appointments}")

        # ── 2. Hard-delete future block appointments ─────────────────────
        future_blocks_qs = BlockAppointment.objects.filter(
            future_condition,
            practitioner=practitioner,
            is_deleted=False,
        )
        future_block_ids = list(future_blocks_qs.values_list('id', 'date'))
        
        deleted_blockouts, _ = future_blocks_qs.delete()
        logger.info(f"[PRACTITIONER REMOVAL] Future blockouts deleted={deleted_blockouts}")

        # ── 3. Hard-delete future calendar notes ─────────────────────────
        future_notes_qs = CalendarNote.objects.filter(
            future_condition,
            practitioner=practitioner,
        )
        future_note_ids = list(future_notes_qs.values_list('id', 'date'))
        
        deleted_calendar_events, _ = future_notes_qs.delete()

        # ── 4. Soft-delete the Practitioner profile ──────────────────────
        Practitioner.objects.filter(pk=practitioner.pk).update(
            is_deleted=True,
            deleted_at=timezone.now(),
        )
        print(f">>> [practitioner_deactivation] Soft-deleted Practitioner profile id={practitioner.pk} <<<")
        logger.info(
            '[PRACTITIONER REMOVAL] Soft-deleted Practitioner profile id=%s for user_id=%s, '
            'user.roles was: %s',
            practitioner.pk, user_id, 
            # Re-fetch user to get updated roles
            User.objects.get(pk=user_id).roles if User.objects.filter(pk=user_id).exists() else 'N/A',
        )

        print(f">>> [practitioner_deactivation] COMPLETE. Deleted {deleted_appointments} apts, {deleted_blockouts} blocks, {deleted_calendar_events} notes. <<<")
        logger.info(
            '[PRACTITIONER REMOVAL] COMPLETE for user_id=%s (practitioner_id=%s) by %s: '
            'deleted %d future appointments, %d blockouts, %d calendar events',
            user_id,
            practitioner.pk,
            performed_by.email if performed_by else 'system',
            deleted_appointments,
            deleted_blockouts,
            deleted_calendar_events,
        )

    # ── 5. Invalidate practitioners cache (outside transaction) ──────────
    try:
        from apps.accounts.views import _invalidate_practitioners_cache
        user = User.objects.get(pk=user_id)
        _invalidate_practitioners_cache(user)
    except Exception:
        logger.exception(
            'execute_practitioner_removal: cache invalidation failed for user_id=%s',
            user_id,
        )

    return {
        'deleted_appointments': deleted_appointments,
        'deleted_blockouts': deleted_blockouts,
        'deleted_calendar_events': deleted_calendar_events,
        'practitioner_soft_deleted': True,
    }
