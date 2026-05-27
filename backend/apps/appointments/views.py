from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Q, Prefetch
from datetime import datetime, timedelta
import pytz
from .models import Appointment, PractitionerSchedule, AppointmentReminder, BlockAppointment, RebookingLink, CalendarNote, AppointmentConfirmToken
from .serializers import (
    AppointmentSerializer,
    AppointmentEditSerializer,
    AppointmentCancelSerializer,
    PractitionerScheduleSerializer,
    AppointmentReminderSerializer,
    AppointmentPrintSerializer,
    BlockAppointmentSerializer,
    BlockAppointmentCreateSerializer,
    CalendarNoteSerializer,
)
from apps.patients.models import PortalBooking
from apps.clinics.models import Clinic
from apps.billing.models import Invoice
from apps.appointments.email_service import (
    send_appointment_reminder_email,
    send_appointment_cancellation_email,
    send_bulk_reminders,
)
from apps.appointments.sms_service import send_appointment_reminder_sms
from apps.appointments.reminder_service import send_all_reminders, send_bulk_all_reminders
from apps.appointments.filters import AppointmentFilter
from apps.appointments.calendar_events import emit_calendar_event, get_main_clinic_id
from django.core.cache import cache

import logging
logger = logging.getLogger(__name__)


class AppointmentViewSet(viewsets.ModelViewSet):
    """CRUD operations for appointments"""

    queryset = Appointment.objects.filter(is_deleted=False).select_related(
        'patient',
        'practitioner__user',
        'practitioner__user__clinic_branch',  # avoids extra query for branch_id / avatar
        'service',                             # avoids extra queries for service_name/color/duration
        'location',
        'clinic',
        'created_by',
        'updated_by',
        'cancelled_by',
    ).prefetch_related(
        # Prefetch only non-deleted invoices (just the id) to resolve has_invoice without N+1
        Prefetch(
            'billing_invoices',
            queryset=Invoice.objects.filter(is_deleted=False).only('id'),
            to_attr='_active_invoices',
        ),
    )
    serializer_class   = AppointmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ['patient', 'practitioner', 'status', 'date', 'appointment_type']
    search_fields      = ['patient__first_name', 'patient__last_name', 'chief_complaint']
    ordering_fields    = ['date', 'start_time', 'created_at']

    # ── Queryset ──────────────────────────────────────────────────────────────
    def get_queryset(self):
        user     = self.request.user
        queryset = self.queryset

        if not user.clinic:
            return queryset.none()

        main_clinic    = user.clinic.main_clinic
        all_branch_ids = list(
            main_clinic.get_all_branches().values_list('id', flat=True)
        )
        queryset = queryset.filter(clinic_id__in=all_branch_ids)

        # Exclude archived patients
        queryset = queryset.filter(patient__is_archived=False)

        # Filter by specific clinic branch
        clinic_branch_param = self.request.query_params.get('clinic_branch')
        if clinic_branch_param:
            try:
                branch_id = int(clinic_branch_param)
                if branch_id in all_branch_ids:
                    queryset = queryset.filter(clinic_id=branch_id)
                else:
                    return queryset.none()
            except (ValueError, TypeError):
                pass

        # Filter by practitioner
        practitioner_param = self.request.query_params.get('practitioner')
        if practitioner_param:
            try:
                queryset = queryset.filter(practitioner_id=int(practitioner_param))
            except (ValueError, TypeError):
                pass

        # Filter by date range
        start_date = (
            self.request.query_params.get('start_date') or
            self.request.query_params.get('date_from')
        )
        end_date = (
            self.request.query_params.get('end_date') or
            self.request.query_params.get('date_to')
        )
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)

        return queryset

    # ── Audit hooks ───────────────────────────────────────────────────────────
    def perform_create(self, serializer):
        appointment = serializer.save(created_by=self.request.user, updated_by=self.request.user)

        # ── Trigger booking confirmation (non-blocking) ───────────────────
        try:
            from apps.notifications.services.communication_service import send_booking_confirmation
            send_booking_confirmation(appointment)
        except Exception as e:
            logger.warning("Booking confirmation failed for appt #%s: %s", appointment.id, e)

        # ── Broadcast real-time calendar event ───────────────────────────
        try:
            main_clinic_id = get_main_clinic_id(self.request.user)
            if main_clinic_id:
                data = AppointmentSerializer(appointment, context={'request': self.request}).data
                emit_calendar_event(main_clinic_id, 'APPOINTMENT_CREATED', dict(data))
        except Exception as exc:
            logger.warning('Calendar WS emit failed for appt #%s: %s', appointment.id, exc)

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        appointment = serializer.save(updated_by=self.request.user)

        # ── Trigger DNA follow-up when status changes to DNA/NO_SHOW ──────
        new_status = appointment.status
        if new_status in ('DNA', 'NO_SHOW') and old_status not in ('DNA', 'NO_SHOW'):
            try:
                from apps.notifications.services.communication_service import send_dna_followup
                send_dna_followup(appointment)
            except Exception as e:
                logger.warning("DNA follow-up failed for appt #%s: %s", appointment.id, e)

        # ── Update patient last_visit_date when completed ─────────────────
        if new_status == 'COMPLETED' and old_status != 'COMPLETED':
            try:
                patient = appointment.patient
                patient.last_visit_date = appointment.date
                patient.save(update_fields=['last_visit_date'])
            except Exception as e:
                logger.warning("Failed to update last_visit_date for patient: %s", e)

        # ── Broadcast real-time calendar event ───────────────────────────
        try:
            main_clinic_id = get_main_clinic_id(self.request.user)
            if main_clinic_id:
                data = AppointmentSerializer(appointment, context={'request': self.request}).data
                emit_calendar_event(main_clinic_id, 'APPOINTMENT_UPDATED', dict(data))
        except Exception as exc:
            logger.warning('Calendar WS emit failed for appt #%s: %s', appointment.id, exc)

    # ── NEW: Partial edit action (restricted fields only) ─────────────────────
    @action(detail=True, methods=['patch'], url_path='edit')
    def edit(self, request, pk=None):
        appointment = self.get_object()

        if appointment.status in ('CANCELLED', 'COMPLETED'):
            return Response(
                {'detail': 'Cannot edit a cancelled or completed appointment.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── service added to editable fields ────────────────────────────────
        allowed_fields = {'practitioner', 'service', 'chief_complaint', 'notes', 'patient_notes', 'arrival_status'}
        filtered_data  = {k: v for k, v in request.data.items() if k in allowed_fields}

        if not filtered_data:
            return Response(
                {'detail': 'No editable fields provided. '
                           'Allowed: practitioner, service, chief_complaint, notes, patient_notes, arrival_status'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Handle arrival_status change - set arrival_time when status is 'ARRIVED'
        new_arrival_status = filtered_data.get('arrival_status')
        if new_arrival_status == 'ARRIVED' and appointment.arrival_status != 'ARRIVED':
            # Setting arrival to ARRIVED - capture the timestamp
            appointment.arrival_time = timezone.now()
        elif new_arrival_status and new_arrival_status != 'ARRIVED':
            # Changing away from ARRIVED - clear the timestamp
            appointment.arrival_time = None

        serializer = AppointmentEditSerializer(appointment, data=filtered_data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        # Save appointment with updated arrival_time if set
        if new_arrival_status == 'ARRIVED' and appointment.arrival_status != 'ARRIVED':
            serializer.save(updated_by=request.user)
            appointment.arrival_time = timezone.now()
            appointment.save(update_fields=['arrival_time', 'updated_at'])
        else:
            serializer.save(updated_by=request.user)

        # Refresh from DB so related objects (service, practitioner) reflect
        # the newly-committed FK values — not the stale in-memory cache.
        appointment.refresh_from_db()

        full_serializer = AppointmentSerializer(appointment, context={'request': request})

        # ── Broadcast real-time calendar event ───────────────────────────
        try:
            main_clinic_id = get_main_clinic_id(request.user)
            if main_clinic_id:
                emit_calendar_event(main_clinic_id, 'APPOINTMENT_UPDATED', dict(full_serializer.data))
        except Exception as exc:
            logger.warning('Calendar WS emit failed for appt #%s: %s', appointment.id, exc)

        return Response(full_serializer.data, status=status.HTTP_200_OK)

    # ── ENHANCED: Cancel with reason + email ─────────────────────────────────
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        POST /api/appointments/{id}/cancel/
        Body: { "cancellation_reason": "..." }

        - Validates reason is present & non-empty.
        - Sets status=CANCELLED, records cancelled_by / cancelled_at.
        - Sends cancellation email to the patient (non-blocking — failure
          is logged and returned as a warning, not an error).
        """
        appointment = self.get_object()

        if appointment.status == 'CANCELLED':
            return Response(
                {'detail': 'Appointment is already cancelled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate payload
        cancel_serializer = AppointmentCancelSerializer(data=request.data)
        cancel_serializer.is_valid(raise_exception=True)
        reason = cancel_serializer.validated_data['cancellation_reason']

        # Apply cancellation
        appointment.status              = 'CANCELLED'
        appointment.cancelled_by        = request.user
        appointment.cancellation_reason = reason
        appointment.cancelled_at        = timezone.now()
        appointment.updated_by          = request.user
        appointment.save(update_fields=[
            'status', 'cancelled_by', 'cancellation_reason',
            'cancelled_at', 'updated_by', 'updated_at',
        ])

        logger.info(
            "Appointment #%s CANCELLED by %s. Reason: %s",
            appointment.id,
            request.user.email,
            reason,
        )

        # ── Send cancellation email (non-blocking) ────────────────────────
        email_sent    = False
        email_warning = None

        patient_email = getattr(appointment.patient, 'email', None)
        if patient_email:
            ok, err = send_appointment_cancellation_email(appointment, reason)
            email_sent = ok
            if not ok:
                email_warning = err
                logger.warning(
                    "Cancellation email failed for appointment #%s: %s",
                    appointment.id, err,
                )
        else:
            email_warning = 'Patient has no email address — cancellation email not sent.'

        # Return full updated appointment
        full_serializer = AppointmentSerializer(
            appointment,
            context={'request': request},
        )
        response_data = full_serializer.data
        response_data['email_sent']    = email_sent
        if email_warning:
            response_data['email_warning'] = email_warning

        # ── Broadcast real-time calendar event ───────────────────────────
        try:
            main_clinic_id = get_main_clinic_id(request.user)
            if main_clinic_id:
                emit_calendar_event(main_clinic_id, 'APPOINTMENT_UPDATED', dict(full_serializer.data))
        except Exception as exc:
            logger.warning('Calendar WS emit failed for appt #%s (cancel): %s', appointment.id, exc)

        return Response(response_data, status=status.HTTP_200_OK)

    # ── BULK CANCEL: Cancel multiple appointments ────────────────────────────────
    @action(detail=False, methods=['post'], url_path='bulk_cancel')
    def bulk_cancel(self, request):
        """
        POST /api/appointments/bulk_cancel/
        Body: { "appointment_ids": [1, 2, 3], "cancellation_reason": "..." }

        Cancels multiple appointments at once with the same reason.
        Sends cancellation emails to each patient (non-blocking).
        """
        appointment_ids = request.data.get('appointment_ids', [])
        reason = request.data.get('cancellation_reason', '').strip()

        if not appointment_ids:
            return Response(
                {'detail': 'appointment_ids is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get all appointments that can be cancelled (not already cancelled)
        appointments = self.queryset.filter(
            id__in=appointment_ids,
        ).select_related('patient', 'practitioner__user')

        cancelled_count = 0
        failed_count = 0
        results = []

        for apt in appointments:
            if apt.status == 'CANCELLED':
                results.append({
                    'appointment_id': apt.id,
                    'success': False,
                    'error': 'Already cancelled',
                })
                failed_count += 1
                continue

            # Apply cancellation
            apt.status = 'CANCELLED'
            apt.cancelled_by = request.user
            apt.cancellation_reason = reason
            apt.cancelled_at = timezone.now()
            apt.updated_by = request.user
            apt.save(update_fields=[
                'status', 'cancelled_by', 'cancellation_reason',
                'cancelled_at', 'updated_by', 'updated_at',
            ])

            logger.info(
                "Appointment #%s CANCELLED by %s (bulk). Reason: %s",
                apt.id, request.user.email, reason,
            )

            # Send cancellation email (non-blocking)
            email_sent = False
            patient_email = getattr(apt.patient, 'email', None)
            if patient_email:
                ok, err = send_appointment_cancellation_email(apt, reason)
                email_sent = ok
                if not ok:
                    logger.warning(
                        "Cancellation email failed for appointment #%s: %s",
                        apt.id, err,
                    )

            results.append({
                'appointment_id': apt.id,
                'success': True,
                'email_sent': email_sent,
            })
            cancelled_count += 1

            # ── Broadcast real-time calendar event ───────────────────────
            try:
                main_clinic_id = get_main_clinic_id(request.user)
                if main_clinic_id:
                    apt_data = AppointmentSerializer(apt, context={'request': request}).data
                    emit_calendar_event(main_clinic_id, 'APPOINTMENT_UPDATED', dict(apt_data))
            except Exception as exc:
                logger.warning('Calendar WS emit failed for bulk-cancel appt #%s: %s', apt.id, exc)

        # Handle IDs that weren't found
        found_ids = {r['appointment_id'] for r in results}
        for apt_id in appointment_ids:
            if apt_id not in found_ids:
                results.append({
                    'appointment_id': apt_id,
                    'success': False,
                    'error': 'Appointment not found or access denied',
                })
                failed_count += 1

        return Response({
            'cancelled_count': cancelled_count,
            'failed_count': failed_count,
            'results': results,
        }, status=status.HTTP_200_OK)

    # ── Portal bookings (existing) ────────────────────────────────────────────
    @action(detail=False, methods=['get'])
    def portal_bookings(self, request):
        user = request.user

        if not user.clinic:
            return Response([])

        main_clinic    = user.clinic.main_clinic
        all_branch_ids = list(
            main_clinic.get_all_branches().values_list('id', flat=True)
        )

        qs = PortalBooking.objects.filter(
            portal_link__clinic_id__in=all_branch_ids,
            status='PENDING',
        ).select_related(
            'service',
            'practitioner__user__clinic_branch',
            'portal_link__clinic',
        )

        start_date = request.query_params.get('start_date')
        end_date   = request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(appointment_date__gte=start_date)
        if end_date:
            qs = qs.filter(appointment_date__lte=end_date)

        # ── clinic_branch filter REMOVED ──────────────────────────────────────
        # Portal bookings link to the MAIN clinic via portal_link — branch filtering
        # is handled client-side using practitioner_branch_id in the response payload.

        # Practitioner filter (still useful for practitioner-specific diary views)
        practitioner_id = request.query_params.get('practitioner')
        if practitioner_id:
            try:
                qs = qs.filter(practitioner_id=int(practitioner_id))
            except (ValueError, TypeError):
                pass

        data = []
        for booking in qs:
            duration = booking.service.duration_minutes if booking.service else 60
            start_dt = datetime.combine(booking.appointment_date, booking.appointment_time)
            end_dt   = start_dt + timedelta(minutes=duration)

            practitioner_branch_id = None
            if booking.practitioner and booking.practitioner.user.clinic_branch_id:
                practitioner_branch_id = booking.practitioner.user.clinic_branch_id

            portal_clinic_id = (
                booking.portal_link.clinic.id
                if booking.portal_link and booking.portal_link.clinic
                else None
            )

            data.append({
                'id':                     booking.id,
                'type':                   'portal_booking',
                'reference_number':       booking.reference_number,
                'patient_name':           f"{booking.patient_first_name} {booking.patient_last_name}",
                'patient_email':          booking.patient_email,
                'patient_phone':          booking.patient_phone,
                'service_name':           booking.service.name if booking.service else '',
                'service_id':             booking.service_id,
                'practitioner_id':        booking.practitioner_id,
                'practitioner_name':      (
                    booking.practitioner.user.get_full_name()
                    if booking.practitioner else 'Any Available'
                ),
                'practitioner_branch_id': practitioner_branch_id,
                'portal_clinic_id':       portal_clinic_id,
                'date':                   booking.appointment_date.isoformat(),
                'start_time':             booking.appointment_time.strftime('%H:%M'),
                'end_time':               end_dt.time().strftime('%H:%M'),
                'duration_minutes':       duration,
                'status':                 booking.status,
                'notes':                  booking.notes,
            })

        return Response(data)

    @action(detail=False, methods=['patch'], url_path='portal_bookings/(?P<booking_id>[^/.]+)/update')
    def update_portal_booking(self, request, booking_id=None):
        from django.shortcuts import get_object_or_404
        booking    = get_object_or_404(PortalBooking, pk=booking_id)
        new_status = request.data.get('status')

        allowed = ['CONFIRMED', 'CANCELLED']
        if new_status not in allowed:
            return Response(
                {'detail': f'status must be one of: {", ".join(allowed)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = new_status
        booking.save(update_fields=['status'])
        return Response({'id': booking.id, 'status': booking.status})

    # ── Status transitions (existing) ────────────────────────────────────────
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        appointment        = self.get_object()
        appointment.status = 'CONFIRMED'
        appointment.updated_by = request.user
        appointment.save(update_fields=['status', 'updated_by', 'updated_at'])
        self._emit_appointment_update(request, appointment)
        return Response({'status': 'appointment confirmed'})

    @action(detail=True, methods=['post'])
    def check_in(self, request, pk=None):
        appointment        = self.get_object()
        appointment.status = 'CHECKED_IN'
        appointment.updated_by = request.user
        appointment.save(update_fields=['status', 'updated_by', 'updated_at'])
        self._emit_appointment_update(request, appointment)
        return Response({'status': 'patient checked in'})

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        appointment        = self.get_object()
        appointment.status = 'IN_PROGRESS'
        appointment.updated_by = request.user
        appointment.save(update_fields=['status', 'updated_by', 'updated_at'])
        self._emit_appointment_update(request, appointment)
        return Response({'status': 'appointment started'})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        appointment        = self.get_object()
        appointment.status = 'COMPLETED'
        appointment.updated_by = request.user
        appointment.save(update_fields=['status', 'updated_by', 'updated_at'])
        self._emit_appointment_update(request, appointment)
        return Response({'status': 'appointment completed'})

    def _emit_appointment_update(self, request, appointment):
        """Helper to broadcast APPOINTMENT_UPDATED without repeating try/except boilerplate."""
        try:
            main_clinic_id = get_main_clinic_id(request.user)
            if main_clinic_id:
                data = AppointmentSerializer(appointment, context={'request': request}).data
                emit_calendar_event(main_clinic_id, 'APPOINTMENT_UPDATED', dict(data))
        except Exception as exc:
            logger.warning('Calendar WS emit failed for appt #%s: %s', appointment.id, exc)

    def perform_destroy(self, instance):
        """Emit APPOINTMENT_DELETED before soft-deleting the appointment."""
        try:
            main_clinic_id = get_main_clinic_id(self.request.user)
            if main_clinic_id:
                emit_calendar_event(
                    main_clinic_id,
                    'APPOINTMENT_DELETED',
                    {'id': instance.id, 'clinic': instance.clinic_id},
                )
        except Exception as exc:
            logger.warning('Calendar WS emit failed for appt delete #%s: %s', instance.id, exc)
        super().perform_destroy(instance)

    # ── Available slots (existing) ────────────────────────────────────────────
    @action(detail=False, methods=['get'])
    def available_slots(self, request):
        from datetime import date as date_type, time, timedelta
        from apps.clinics.models import Practitioner

        CLINIC_START = 6 * 60
        CLINIC_END   = 21 * 60

        practitioner_id = request.query_params.get('practitioner')
        date_str        = request.query_params.get('date')
        service_id      = request.query_params.get('service')

        if not date_str:
            return Response(
                {'error': 'date parameter is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

        weekday = target_date.weekday()

        def time_to_minutes(t):
            return t.hour * 60 + t.minute

        def minutes_to_time(m):
            return time(m // 60, m % 60)

        candidate_slots: list = []

        if practitioner_id:
            try:
                practitioner = Practitioner.objects.get(pk=practitioner_id)
            except Practitioner.DoesNotExist:
                return Response({'error': 'Practitioner not found.'}, status=404)

            schedules = PractitionerSchedule.objects.filter(
                practitioner=practitioner,
                weekday=weekday,
                is_available=True,
            )
            if schedules.exists():
                for sched in schedules:
                    start_min = max(time_to_minutes(sched.start_time), CLINIC_START)
                    end_min   = min(time_to_minutes(sched.end_time),   CLINIC_END)
                    m = start_min
                    while m + 15 <= end_min:
                        candidate_slots.append(minutes_to_time(m))
                        m += 15
            else:
                m = CLINIC_START
                while m + 15 <= CLINIC_END:
                    candidate_slots.append(minutes_to_time(m))
                    m += 15
        else:
            m = CLINIC_START
            while m + 15 <= CLINIC_END:
                candidate_slots.append(minutes_to_time(m))
                m += 15

        duration = 15
        if service_id:
            try:
                from apps.clinics.models import ClinicService
                svc      = ClinicService.objects.get(pk=service_id)
                duration = svc.duration_minutes
            except Exception:
                pass

        booked_qs = Appointment.objects.filter(
            date=target_date,
            status__in=['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'],
            is_deleted=False,
        )
        if practitioner_id:
            booked_qs = booked_qs.filter(practitioner_id=practitioner_id)

        booked_ranges = [(a.start_time, a.end_time) for a in booked_qs]

        available: list[str] = []
        for slot_time in candidate_slots:
            slot_start = time_to_minutes(slot_time)
            slot_end   = slot_start + duration

            if slot_end > CLINIC_END:
                continue

            overlaps = any(
                slot_start < time_to_minutes(end) and slot_end > time_to_minutes(start)
                for start, end in booked_ranges
            )
            if not overlaps:
                available.append(f"{slot_time.hour:02d}:{slot_time.minute:02d}")

        return Response({'slots': available})

    # ── Check availability for recurring appointments ───────────────────────────
    @action(detail=False, methods=['post'], url_path='check_recurring_availability')
    def check_recurring_availability(self, request):
        """
        POST /api/appointments/check_recurring_availability/
        Body: {
            practitioner_id: number,
            dates: ["2024-01-15", "2024-01-22", ...],  // List of dates to check
            start_time: "09:00",  // Time to check (HH:MM format)
            duration_minutes: 60
        }
        Returns: {
            slots: [
                { date: "2024-01-15", day_name: "Monday", time: "09:00", status: "AVAILABLE" | "BOOKED" },
                ...
            ]
        }
        """
        from datetime import time, timedelta
        
        practitioner_id = request.data.get('practitioner_id')
        dates = request.data.get('dates', [])  # List of date strings
        start_time_str = request.data.get('start_time')
        duration = request.data.get('duration_minutes', 60)
        
        if not dates:
            return Response({'error': 'dates parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not start_time_str:
            return Response({'error': 'start_time parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Parse start time
        try:
            start_time_obj = datetime.strptime(start_time_str, '%H:%M').time()
        except ValueError:
            return Response({'error': 'Invalid time format. Use HH:MM.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Calculate end time
        start_minutes = start_time_obj.hour * 60 + start_time_obj.minute
        end_minutes = start_minutes + duration
        end_time_obj = time(end_minutes // 60, end_minutes % 60)
        
        # Day names mapping
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        
        # Build the queryset filter
        booked_qs = Appointment.objects.filter(
            status__in=['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'],
            is_deleted=False,
        )
        
        # Filter by practitioner if provided (handle None, 0, and valid IDs)
        if practitioner_id is not None:
            try:
                booked_qs = booked_qs.filter(practitioner_id=int(practitioner_id))
            except (ValueError, TypeError):
                pass  # If invalid, don't filter by practitioner
        
        slots = []
        
        for date_str in dates:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                continue
            
            weekday = target_date.weekday()
            day_name = day_names[weekday]
            
            # Check if there's a conflicting appointment on this date/time
            conflicting = booked_qs.filter(
                date=target_date,
            )
            
            logger.info(
                f"Checking availability for date={date_str}, start_time={start_minutes}, end_time={end_minutes}, "
                f"practitioner_id={practitioner_id}, found {conflicting.count()} appointments on that date"
            )
            
            is_booked = False
            for apt in conflicting:
                # Check for time overlap
                apt_start_min = apt.start_time.hour * 60 + apt.start_time.minute
                apt_end_min = apt.end_time.hour * 60 + apt.end_time.minute
                
                logger.info(
                    f"Existing appointment: id={apt.id}, start={apt_start_min}, end={apt_end_min}, "
                    f"practitioner={apt.practitioner_id}"
                )
                
                # Check if our time slot overlaps with existing appointment
                # Two time slots overlap if: start1 < end2 AND end1 > start2
                if start_minutes < apt_end_min and end_minutes > apt_start_min:
                    logger.info(f"OVERLAP DETECTED! new: {start_minutes}-{end_minutes}, existing: {apt_start_min}-{apt_end_min}")
                    is_booked = True
                    break
            
            slots.append({
                'date': date_str,
                'day_name': day_name,
                'time': start_time_str,
                'status': 'BOOKED' if is_booked else 'AVAILABLE'
            })
        
        return Response({'slots': slots})

    # ── Create recurring appointments ─────────────────────────────────────────────
    @action(detail=False, methods=['post'], url_path='create_recurring')
    def create_recurring(self, request):
        """
        POST /api/appointments/create_recurring/
        Body: {
            service_id: number,
            duration_minutes: number,
            frequency: "WEEKLY" | "MONTHLY" | "YEARLY",
            repetitions: number,
            selected_days: number[],  // 0=Monday, 6=Sunday
            start_date: "2024-01-15",  // Start date for recurring
            practitioner_id: number | null,
            start_time: "09:00",  // HH:MM format
            patient_id: number,
            clinic_id: number
        }
        Returns: {
            created: number,  // Number of appointments created
            appointments: [Appointment, ...]
        }
        """
        from datetime import time, timedelta, date
        from apps.clinics.models import Practitioner
        from apps.patients.models import Patient
        from apps.clinics.services.models import Service
        
        service_id = request.data.get('service_id')
        duration_minutes = request.data.get('duration_minutes', 60)
        frequency = request.data.get('frequency', 'WEEKLY')
        repetitions = request.data.get('repetitions', 4)
        selected_days = request.data.get('selected_days', [])
        start_date_str = request.data.get('start_date')
        practitioner_id = request.data.get('practitioner_id')
        start_time_str = request.data.get('start_time')
        patient_id = request.data.get('patient_id')
        clinic_id = request.data.get('clinic_id')
        
        # Validation
        if not all([service_id, start_date_str, start_time_str, patient_id, clinic_id]):
            return Response(
                {'error': 'service_id, start_date, start_time, patient_id, and clinic_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Parse start date
        try:
            start_date_obj = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Parse start time
        try:
            start_time_obj = datetime.strptime(start_time_str, '%H:%M').time()
        except ValueError:
            return Response(
                {'error': 'Invalid time format. Use HH:MM.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Calculate end time
        start_minutes = start_time_obj.hour * 60 + start_time_obj.minute
        end_minutes = start_minutes + duration_minutes
        end_time_obj = time(end_minutes // 60, end_minutes % 60)
        
        # Get related objects
        try:
            patient = Patient.objects.get(pk=patient_id)
        except Patient.DoesNotExist:
            return Response(
                {'error': 'Patient not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            clinic = Clinic.objects.get(pk=clinic_id)
        except Clinic.DoesNotExist:
            return Response(
                {'error': 'Clinic not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        practitioner = None
        if practitioner_id:
            try:
                practitioner = Practitioner.objects.get(pk=practitioner_id)
            except Practitioner.DoesNotExist:
                pass
        
        service = None
        if service_id:
            try:
                service = Service.objects.get(pk=service_id)
            except Service.DoesNotExist:
                pass
        
        # Generate dates based on frequency and selected days
        generated_dates = []
        current_date = start_date_obj
        
        # Map frontend day values (0=Monday, 6=Sunday) to Python weekday (0=Monday, 6=Sunday)
        # They're the same, so we can use directly
        
        if frequency == 'WEEKLY':
            # For weekly, find the next date that matches one of the selected days
            # Start from start_date and find dates up to 52 weeks ahead
            max_weeks = min(repetitions * 2, 52)  # Safety limit
            for week in range(max_weeks):
                for day_offset in range(7):
                    check_date = start_date_obj + timedelta(weeks=week, days=day_offset)
                    if check_date.weekday() in selected_days:
                        if len(generated_dates) < repetitions:
                            generated_dates.append(check_date)
                if len(generated_dates) >= repetitions:
                    break
        elif frequency == 'MONTHLY':
            # For monthly, find the same day of month for each selected day
            from dateutil.relativedelta import relativedelta
            for i in range(repetitions):
                check_date = start_date_obj + relativedelta(months=i)
                if check_date.weekday() in selected_days:
                    generated_dates.append(check_date)
        elif frequency == 'YEARLY':
            # For yearly
            for i in range(min(repetitions, 5)):  # Limit yearly to 5 years
                check_date = start_date_obj.replace(year=start_date_obj.year + i)
                if check_date.weekday() in selected_days:
                    generated_dates.append(check_date)
        
        # Create appointments
        created_appointments = []
        # Resolve clinic group once for efficient emits
        main_clinic_id = get_main_clinic_id(request.user)
        for appt_date in generated_dates:
            appointment = Appointment.objects.create(
                clinic=clinic,
                patient=patient,
                practitioner=practitioner,
                service=service,
                appointment_type=service.name if service else 'INITIAL',
                status='SCHEDULED',
                date=appt_date,
                start_time=start_time_obj,
                end_time=end_time_obj,
                duration_minutes=duration_minutes,
                chief_complaint=service.name if service else '',
                created_by=request.user,
                updated_by=request.user,
            )
            created_appointments.append(appointment)
            # Emit a lightweight calendar event for this new appointment so
            # connected clients update instantly without a full refetch.
            try:
                if main_clinic_id:
                    data = AppointmentSerializer(appointment, context={'request': request}).data
                    emit_calendar_event(main_clinic_id, 'APPOINTMENT_CREATED', dict(data))
            except Exception:
                logger.exception('Failed to emit APPOINTMENT_CREATED for recurring appt #%s', getattr(appointment, 'id', '?'))
        
        # Serialize the created appointments
        serializer = AppointmentSerializer(created_appointments, many=True, context={'request': request})
        
        return Response({
            'created': len(created_appointments),
            'appointments': serializer.data
        })

    # ── Practitioners list (existing) ─────────────────────────────────────────
    @action(detail=False, methods=['get'])
    def practitioners(self, request):
        from apps.clinics.models import Practitioner

        user = request.user
        if not user.clinic:
            return Response({'practitioners': []})

        main_clinic    = user.clinic.main_clinic
        clinic_branch_param = request.query_params.get('clinic_branch', '')

        cache_key = f'practitioners_{main_clinic.id}_{clinic_branch_param}'
        cached    = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        all_branch_ids = list(
            main_clinic.get_all_branches().values_list('id', flat=True)
        )

        base_qs = Practitioner.objects.filter(
            clinic_id__in=all_branch_ids,
            user__is_active=True,
            user__is_deleted=False,
        ).select_related('user', 'clinic', 'user__clinic_branch')

        if clinic_branch_param:
            try:
                branch_id = int(clinic_branch_param)
            except ValueError:
                return Response({'practitioners': []})

            base_qs = base_qs.filter(
                Q(user__clinic_branch_id=branch_id) |
                Q(clinic_id=branch_id, user__clinic_branch__isnull=True) |
                # Admin+Practitioner users have no branch restriction — they should
                # appear in every branch view so they can be selected as a practitioner
                # regardless of which branch tab the admin is viewing.
                Q(user__clinic_branch__isnull=True, user__roles__contains=['ADMIN'])
            )

        practitioners_data = [
            {
                'id':                 p.id,
                'name':               p.user.get_full_name(),
                'email':              p.user.email,
                'specialization':     p.specialization or None,
                'clinic_id':          p.clinic_id,
                'clinic_name':        p.clinic.name if p.clinic else None,
                'clinic_branch_id':   p.user.clinic_branch_id,
                'clinic_branch_name': p.user.clinic_branch.name
                                      if p.user.clinic_branch else None,
                'availability':       p.availability,
                'role':               'PRACTITIONER',
                'roles':              list(p.user.roles) if p.user.roles else ['PRACTITIONER'],
            }
            for p in base_qs
        ]

        # ── Also include STAFF users so they appear in the diary filter ──
        from apps.accounts.models import User as UserModel
        # Use roles__contains to correctly match multi-role users who have STAFF
        # in their roles array, rather than relying only on the primary `role` field.
        staff_qs = UserModel.objects.filter(
            clinic_id__in=all_branch_ids,
            roles__contains=['STAFF'],
            is_active=True,
            is_deleted=False,
        ).exclude(
            # Exclude users already listed as PRACTITIONERs to avoid duplicates
            roles__contains=['PRACTITIONER'],
        ).select_related('clinic_branch', 'clinic')

        if clinic_branch_param:
            try:
                branch_id = int(clinic_branch_param)
            except ValueError:
                branch_id = None
            if branch_id:
                staff_qs = staff_qs.filter(
                    Q(clinic_branch_id=branch_id) |
                    Q(clinic_id=branch_id, clinic_branch__isnull=True)
                )

        default_days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        for staff_user in staff_qs:
            practitioners_data.append({
                # Use negative user id to avoid collision with Practitioner ids
                'id':                 f'staff-{staff_user.id}',
                'user_id':            staff_user.id,
                'name':               staff_user.get_full_name(),
                'email':              staff_user.email,
                'specialization':     None,
                'clinic_id':          staff_user.clinic_id,
                'clinic_name':        staff_user.clinic.name if staff_user.clinic else None,
                'clinic_branch_id':   staff_user.clinic_branch_id,
                'clinic_branch_name': staff_user.clinic_branch.name
                                      if staff_user.clinic_branch else None,
                'availability': {
                    'duty_days':        staff_user.duty_days or default_days,
                    'duty_start_time':  '08:00',
                    'duty_end_time':    '17:00',
                    'lunch_start_time': staff_user.lunch_start_time or '12:00',
                    'lunch_end_time':   staff_user.lunch_end_time or '13:00',
                    'duty_schedule':    staff_user.duty_schedule,
                },
                'role':  'STAFF',
                'roles': list(staff_user.roles) if staff_user.roles else ['STAFF'],
            })

        result = {'practitioners': practitioners_data}
        cache.set(cache_key, result, timeout=300)  # 5-minute cache
        return Response(result)

    # ── Reminders (existing) ──────────────────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='send_reminder')
    def send_reminder(self, request, pk=None):
        appointment = self.get_object()

        if appointment.status not in ['SCHEDULED', 'CONFIRMED']:
            return Response(
                {'detail': 'Reminders can only be sent for Scheduled or Confirmed appointments.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        channel = request.data.get('channel', 'both').lower()
        if channel not in ['email', 'sms', 'both']:
            return Response(
                {'detail': "channel must be 'email', 'sms', or 'both'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        appointment.reminder_sent = False
        appointment.save(update_fields=['reminder_sent'])

        result = {}

        if channel in ['email', 'both']:
            if not getattr(appointment.patient, 'email', None):
                result['email'] = {'success': False, 'message': 'Patient has no email address on file.'}
            else:
                ok, msg = send_appointment_reminder_email(appointment)
                result['email'] = {'success': ok, 'message': msg or 'Sent successfully.'}

        if channel in ['sms', 'both']:
            ok, msg = send_appointment_reminder_sms(appointment)
            result['sms'] = {'success': ok, 'message': msg or 'Sent successfully.'}

        any_success = any(v.get('success') for v in result.values())
        return Response(
            result,
            status=status.HTTP_200_OK if any_success else status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    @action(detail=False, methods=['post'], url_path='send_bulk_reminders')
    def send_bulk_reminders_action(self, request):
        if not request.user.is_admin:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        date_str = request.data.get('date')
        channel  = request.data.get('channel', 'both').lower()

        if channel not in ['email', 'sms', 'both']:
            return Response(
                {'detail': "channel must be 'email', 'sms', or 'both'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if date_str:
            try:
                from datetime import datetime
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'detail': 'Invalid date format. Use YYYY-MM-DD.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            from datetime import timedelta
            target_date = timezone.now().date() + timedelta(days=1)

        user   = request.user
        clinic = user.clinic
        if not clinic:
            return Response({'detail': 'User has no clinic.'}, status=400)

        main_clinic    = clinic.main_clinic
        all_branch_ids = list(main_clinic.get_all_branches().values_list('id', flat=True))

        qs = Appointment.objects.filter(
            clinic_id__in=all_branch_ids,
            date=target_date,
            status__in=['SCHEDULED', 'CONFIRMED'],
            reminder_sent=False,
            is_deleted=False,
        ).select_related('patient', 'practitioner__user', 'clinic', 'location')

        if channel == 'both':
            summary = send_bulk_all_reminders(qs)
        elif channel == 'email':
            raw     = send_bulk_reminders(qs)
            summary = {'email': raw}
        else:
            from apps.appointments.sms_service import send_bulk_sms_reminders
            raw     = send_bulk_sms_reminders(qs)
            summary = {'sms': raw}

        return Response({'target_date': str(target_date), 'channel': channel, **summary})

    # ── Today's Arrivals ─────────────────────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='today-arrivals')
    def today_arrivals(self, request):
        """
        GET /api/appointments/today-arrivals/
        Returns appointments with arrival_status='ARRIVED' for today.
        Uses Philippine timezone (UTC+8) to determine today's date.
        """
        user = request.user
        if not user.clinic:
            return Response([])

        main_clinic    = user.clinic.main_clinic
        all_branch_ids = list(
            main_clinic.get_all_branches().values_list('id', flat=True)
        )

        # Get today's date in Philippine timezone (UTC+8)
        # This ensures consistency with the frontend's Philippine date
        import pytz
        ph_tz = pytz.timezone('Asia/Manila')
        today = datetime.now(ph_tz).date()

        # Query appointments with ARRIVED status for today
        appointments = Appointment.objects.filter(
            clinic_id__in=all_branch_ids,
            is_deleted=False,
            patient__is_archived=False,
            date=today,
            arrival_status='ARRIVED',
        ).select_related(
            'patient', 'practitioner__user', 'clinic', 'service'
        ).order_by('start_time')

        # Serialize the data
        serializer = AppointmentSerializer(appointments, many=True, context={'request': request})
        return Response(serializer.data)


# ── Other ViewSets (unchanged) ────────────────────────────────────────────────

class PractitionerScheduleViewSet(viewsets.ModelViewSet):
    queryset           = PractitionerSchedule.objects.all().select_related('practitioner__user', 'location')
    serializer_class   = PractitionerScheduleSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ['practitioner', 'location', 'weekday', 'is_available']

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return self.queryset
        return self.queryset.filter(practitioner__clinic=user.clinic)


class AppointmentReminderViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = AppointmentReminder.objects.all().select_related('appointment')
    serializer_class   = AppointmentReminderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ['appointment', 'reminder_type', 'is_successful']

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return self.queryset
        return self.queryset.filter(appointment__clinic=user.clinic)


class AppointmentPrintViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = AppointmentPrintSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_class    = AppointmentFilter
    ordering_fields    = ['date', 'start_time', 'patient__last_name', 'status']
    ordering           = ['date', 'start_time']
    search_fields      = ['patient__first_name', 'patient__last_name', 'patient__patient_number']

    def get_queryset(self):
        user = self.request.user
        if not user.clinic:
            return Appointment.objects.none()

        main_clinic    = user.clinic.main_clinic
        all_branch_ids = list(
            main_clinic.get_all_branches().values_list('id', flat=True)
        )

        return (
            Appointment.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                patient__is_archived=False,
            )
            .select_related('patient', 'practitioner__user', 'clinic', 'location')
        )

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        qs = self.filter_queryset(self.get_queryset())

        from django.db.models import Count
        counts = (
            qs.values('status')
            .annotate(count=Count('id'))
            .order_by('status')
        )
        total = qs.count()

        return Response({
            'total':    total,
            'by_status': {row['status']: row['count'] for row in counts},
        })


# ── Block Appointment ViewSet ────────────────────────────────────────────────────

class BlockAppointmentViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Block Appointments (events that block time slots).
    
    - All authenticated users can create, view, update, and delete block appointments.
    - Users only see events they have access to (visibility_type='ALL' or they're in visible_to_users).
    - Creators always see their own events regardless of visibility settings.
    """

    queryset = BlockAppointment.objects.filter(is_deleted=False).select_related(
        'clinic', 'created_by'
    ).prefetch_related('visible_to_users')
    serializer_class = BlockAppointmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['clinic', 'date']
    ordering_fields = ['date', 'start_time', 'created_at']
    ordering = ['-date', '-start_time']

    def get_queryset(self):
        """
        Filter queryset to show only events the user has access to:
        1. Events with visibility_type='ALL'
        2. Events where user is in visible_to_users
        3. Events created by the user (creator always sees their events)
        Also filtered by clinic branches the user has access to.
        """
        from django.db.models import Q
        user = self.request.user

        if not user.clinic:
            return self.queryset.none()

        main_clinic = user.clinic.main_clinic
        all_branch_ids = list(
            main_clinic.get_all_branches().values_list('id', flat=True)
        )

        # Base filter: clinic branches
        queryset = self.queryset.filter(clinic_id__in=all_branch_ids)

        # Uniform visibility filter — applies to ALL roles including Admin/Staff.
        # Visibility rules are determined by visibility_type, not by user role:
        #   ALL      → visible to every user
        #   SELECTED → visible only to users in visible_to_users
        #   SELF     → visible only to the creator
        queryset = queryset.filter(
            Q(visibility_type='ALL') |
            Q(visibility_type='SELECTED', visible_to_users=user) |
            Q(visibility_type='SELF', created_by=user)
        ).distinct()

        # Filter by specific clinic branch
        clinic_branch_param = self.request.query_params.get('clinic_branch')
        if clinic_branch_param:
            try:
                branch_id = int(clinic_branch_param)
                if branch_id in all_branch_ids:
                    queryset = queryset.filter(clinic_id=branch_id)
                else:
                    return self.queryset.none()
            except (ValueError, TypeError):
                pass

        # Filter by date range
        start_date = self.request.query_params.get('start_date') or \
                     self.request.query_params.get('date_from')
        end_date = self.request.query_params.get('end_date') or \
                   self.request.query_params.get('date_to')

        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)

        return queryset

    def get_serializer_class(self):
        """Use different serializers for create/update vs retrieve"""
        if self.action in ['create', 'update']:
            return BlockAppointmentCreateSerializer
        return BlockAppointmentSerializer

    def perform_create(self, serializer):
        """Set created_by and broadcast BLOCK_CREATED event."""
        block = serializer.save(created_by=self.request.user)
        try:
            main_clinic_id = get_main_clinic_id(self.request.user)
            if main_clinic_id:
                data = BlockAppointmentSerializer(block, context={'request': self.request}).data
                emit_calendar_event(main_clinic_id, 'BLOCK_CREATED', dict(data))
        except Exception as exc:
            logger.warning('Calendar WS emit failed for block #%s: %s', block.id, exc)

    def perform_update(self, serializer):
        """Set modified_by and broadcast BLOCK_UPDATED event."""
        block = serializer.save(modified_by=self.request.user)
        try:
            main_clinic_id = get_main_clinic_id(self.request.user)
            if main_clinic_id:
                data = BlockAppointmentSerializer(block, context={'request': self.request}).data
                emit_calendar_event(main_clinic_id, 'BLOCK_UPDATED', dict(data))
        except Exception as exc:
            logger.warning('Calendar WS emit failed for block #%s: %s', block.id, exc)

    def perform_destroy(self, instance):
        """Emit BLOCK_DELETED before soft-deleting the block appointment."""
        try:
            main_clinic_id = get_main_clinic_id(self.request.user)
            if main_clinic_id:
                emit_calendar_event(
                    main_clinic_id,
                    'BLOCK_DELETED',
                    {'id': instance.id, 'clinic': instance.clinic_id},
                )
        except Exception as exc:
            logger.warning('Calendar WS emit failed for block delete #%s: %s', instance.id, exc)
        super().perform_destroy(instance)

    # ── Custom action: Get block appointments for calendar ───────────────────────
    @action(detail=False, methods=['get'], url_path='calendar')
    def calendar_events(self, request):
        """
        Get block appointments formatted for calendar display.
        Query params: start_date, end_date, clinic_branch
        """
        queryset = self.filter_queryset(self.get_queryset())
        serializer = BlockAppointmentSerializer(queryset, many=True)
        return Response(serializer.data)


# ── Calendar Note ViewSet ─────────────────────────────────────────────────────

class CalendarNoteViewSet(viewsets.ModelViewSet):
    """CRUD for lightweight calendar sticky notes."""

    serializer_class   = CalendarNoteSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ['clinic', 'date']

    def get_queryset(self):
        user = self.request.user
        if not user.clinic:
            return CalendarNote.objects.none()

        main_clinic    = user.clinic.main_clinic
        all_branch_ids = list(main_clinic.get_all_branches().values_list('id', flat=True))
        qs = CalendarNote.objects.filter(clinic_id__in=all_branch_ids)

        start_date = (
            self.request.query_params.get('start_date') or
            self.request.query_params.get('date_from')
        )
        end_date = (
            self.request.query_params.get('end_date') or
            self.request.query_params.get('date_to')
        )
        if start_date:
            qs = qs.filter(date__gte=start_date)
        if end_date:
            qs = qs.filter(date__lte=end_date)

        clinic_branch_param = self.request.query_params.get('clinic_branch')
        if clinic_branch_param:
            try:
                branch_id = int(clinic_branch_param)
                if branch_id in all_branch_ids:
                    qs = qs.filter(clinic_id=branch_id)
                else:
                    return CalendarNote.objects.none()
            except (ValueError, TypeError):
                pass

        practitioner_param = self.request.query_params.get('practitioner')
        if practitioner_param:
            try:
                practitioner_id = int(practitioner_param)
                qs = qs.filter(
                    Q(practitioner_id=practitioner_id) | Q(practitioner__isnull=True)
                )
            except (ValueError, TypeError):
                pass

        return qs

    def perform_create(self, serializer):
        note = serializer.save(created_by=self.request.user, modified_by=self.request.user)
        try:
            main_clinic_id = get_main_clinic_id(self.request.user)
            if main_clinic_id:
                data = CalendarNoteSerializer(note).data
                emit_calendar_event(main_clinic_id, 'NOTE_CREATED', dict(data))
        except Exception as exc:
            logger.warning('Calendar WS emit failed for note #%s: %s', note.id, exc)

    def perform_update(self, serializer):
        note = serializer.save(modified_by=self.request.user)
        try:
            main_clinic_id = get_main_clinic_id(self.request.user)
            if main_clinic_id:
                data = CalendarNoteSerializer(note).data
                emit_calendar_event(main_clinic_id, 'NOTE_UPDATED', dict(data))
        except Exception as exc:
            logger.warning('Calendar WS emit failed for note #%s: %s', note.id, exc)

    def perform_destroy(self, instance):
        try:
            main_clinic_id = get_main_clinic_id(self.request.user)
            if main_clinic_id:
                emit_calendar_event(
                    main_clinic_id,
                    'NOTE_DELETED',
                    {'id': instance.id, 'clinic': instance.clinic_id},
                )
        except Exception as exc:
            logger.warning('Calendar WS emit failed for note delete #%s: %s', instance.id, exc)
        instance.delete()


# ── Public Rebooking Views (no auth required) ─────────────────────────────────

class PublicRebookingLinkView(APIView):
    """
    GET  /api/appointments/rebook/<uuid:token>/  — validate token & return prefill data
    POST /api/appointments/rebook/<uuid:token>/  — submit rebooking
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def _get_valid_link(self, token):
        """Return RebookingLink or None if invalid."""
        try:
            link = RebookingLink.objects.select_related(
                'patient', 'appointment__practitioner__user',
                'appointment__clinic', 'appointment__service',
            ).get(token=token)
        except RebookingLink.DoesNotExist:
            return None, Response(
                {'detail': 'Invalid rebooking link.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if link.is_used:
            return None, Response(
                {'detail': 'This rebooking link has already been used.', 'code': 'used'},
                status=status.HTTP_410_GONE,
            )
        if link.is_expired:
            return None, Response(
                {'detail': 'This rebooking link has expired.', 'code': 'expired'},
                status=status.HTTP_410_GONE,
            )
        return link, None

    def get(self, request, token):
        link, err = self._get_valid_link(token)
        if err:
            return err

        appt = link.appointment
        return Response({
            'patient_first_name': link.patient.first_name,
            'service_name':       appt.service.name if appt.service else appt.appointment_type,
            'practitioner_name':  (
                appt.practitioner.user.get_full_name()
                if appt.practitioner else 'Any Available'
            ),
            'clinic_name':        appt.clinic.name if appt.clinic else '',
            'original_date':      str(appt.date),
            'original_start_time': appt.start_time.strftime('%H:%M'),
            'expires_at':         link.expires_at.isoformat(),
        })

    def post(self, request, token):
        link, err = self._get_valid_link(token)
        if err:
            return err

        date_str       = request.data.get('date', '').strip()
        start_time_str = request.data.get('start_time', '').strip()
        end_time_str   = request.data.get('end_time', '').strip()

        if not date_str or not start_time_str or not end_time_str:
            return Response(
                {'detail': 'date, start_time, and end_time are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            new_date       = datetime.strptime(date_str, '%Y-%m-%d').date()
            new_start_time = datetime.strptime(start_time_str, '%H:%M').time()
            new_end_time   = datetime.strptime(end_time_str, '%H:%M').time()
        except ValueError:
            return Response(
                {'detail': 'Invalid date/time format. Use YYYY-MM-DD and HH:MM.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        original = link.appointment
        duration = (
            original.duration_minutes
            if original.duration_minutes
            else int((datetime.combine(new_date, new_end_time) -
                      datetime.combine(new_date, new_start_time)).total_seconds() // 60)
        )

        new_appt = Appointment.objects.create(
            clinic=original.clinic,
            patient=link.patient,
            practitioner=original.practitioner,
            service=original.service,
            appointment_type=original.appointment_type,
            status='SCHEDULED',
            date=new_date,
            start_time=new_start_time,
            end_time=new_end_time,
            duration_minutes=duration,
            chief_complaint=original.chief_complaint or '',
            notes=f'Rebooked via secure link (original appt #{original.id})',
        )

        # Emit calendar event so clients see the rebook instantly.
        try:
            main_clinic_id = new_appt.clinic.main_clinic.id if new_appt.clinic and new_appt.clinic.main_clinic else None
            if main_clinic_id:
                data = AppointmentSerializer(new_appt, context={'request': request}).data
                emit_calendar_event(main_clinic_id, 'APPOINTMENT_CREATED', dict(data))
        except Exception:
            logger.exception('Failed to emit APPOINTMENT_CREATED for rebooked appt #%s', getattr(new_appt, 'id', '?'))

        link.is_used = True
        link.used_at = timezone.now()
        link.new_appointment = new_appt
        link.save(update_fields=['is_used', 'used_at', 'new_appointment'])

        return Response({
            'detail': 'Appointment successfully booked!',
            'appointment_id': new_appt.id,
            'date': str(new_appt.date),
            'start_time': new_appt.start_time.strftime('%H:%M'),
            'end_time': new_appt.end_time.strftime('%H:%M'),
        }, status=status.HTTP_201_CREATED)


class PublicAppointmentConfirmView(APIView):
    """
    POST /api/appointments/confirm-email/<uuid:token>/

    Called by the frontend /confirm/<token> page (no auth required).
    Validates the one-time confirm token and marks the appointment CONFIRMED.
    Logs the confirmation in CommunicationLog.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, token):
        try:
            ct = AppointmentConfirmToken.objects.select_related(
                'appointment__patient',
                'appointment__clinic',
            ).get(token=token)
        except AppointmentConfirmToken.DoesNotExist:
            return Response(
                {'detail': 'Invalid confirmation token.', 'code': 'invalid'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if ct.is_used:
            return Response(
                {'detail': 'This confirmation link has already been used.', 'code': 'used'},
                status=status.HTTP_410_GONE,
            )

        if ct.is_expired:
            return Response(
                {'detail': 'This confirmation link has expired.', 'code': 'expired'},
                status=status.HTTP_410_GONE,
            )

        appt = ct.appointment

        # Mark token used
        ct.is_used = True
        ct.used_at = timezone.now()
        ct.save(update_fields=['is_used', 'used_at'])

        # Confirm the appointment
        if appt.status == 'SCHEDULED':
            appt.status = 'CONFIRMED'
        appt.confirmation_status = 'CONFIRMED'
        appt.patient_reply = 'Y'
        appt.patient_reply_at = timezone.now()
        appt.save(update_fields=[
            'status', 'confirmation_status', 'patient_reply', 'patient_reply_at',
        ])

        # Update the most recent APPOINTMENT_REMINDER communication log for this appointment
        try:
            from apps.notifications.models import CommunicationLog
            CommunicationLog.objects.filter(
                appointment=appt,
                comm_type='APPOINTMENT_REMINDER',
                status='SENT',
            ).order_by('-created_at').update(
                status='REPLIED',
                patient_reply='Y',
                replied_at=timezone.now(),
            )
        except Exception as e:
            logger.warning('Failed to update CommunicationLog for confirm token #%s: %s', ct.id, e)

        logger.info(
            'Appointment #%s confirmed via email link by patient %s',
            appt.id, appt.patient_id,
        )

        return Response({
            'detail': 'Your appointment has been confirmed!',
            'appointment_id': appt.id,
            'appointment_date': str(appt.date),
            'appointment_time': appt.start_time.strftime('%H:%M'),
            'clinic_name': appt.clinic.name if appt.clinic else '',
            'patient_name': appt.patient.get_full_name() if appt.patient else '',
        }, status=status.HTTP_200_OK)