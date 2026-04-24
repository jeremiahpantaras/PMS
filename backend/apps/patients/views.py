from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.utils import timezone
from apps.clinics.services.models import Service as ClinicService
from .models import (
    Patient, IntakeForm,
    ServiceCategory, PortalService,
    PortalLink, PortalBooking,
    PatientConsent,
)
from .serializers import (
    PatientSerializer, IntakeFormSerializer,
    ServiceCategorySerializer, PortalServiceSerializer,
    PortalLinkPublicSerializer, PortalLinkAdminSerializer,
    PortalBookingCreateSerializer, PortalBookingResponseSerializer,
    PatientConsentSerializer, PublicPatientConsentCreateSerializer,
)
import logging

logger = logging.getLogger(__name__)


# ─── Helper ───────────────────────────────────────────────────────────────────

def _confirm_portal_booking(booking, confirmed_by_user):
    """
    When a PortalBooking is CONFIRMED:
      1. Find or create a Patient record.
      2. Find or create a proper Appointment in the diary.
      3. Link the appointment back to the booking.
    """
    from datetime import datetime, timedelta
    from apps.appointments.models import Appointment

    clinic = booking.portal_link.clinic

    # ── 1. Find or create Patient ─────────────────────────────────────────
    patient = None

    if booking.patient_email:
        patient = Patient.objects.filter(
            clinic=clinic,
            email__iexact=booking.patient_email,
            is_deleted=False,
        ).first()

    if patient is None:
        patient = Patient.objects.filter(
            clinic=clinic,
            first_name__iexact=booking.patient_first_name,
            last_name__iexact=booking.patient_last_name,
            phone=booking.patient_phone,
            is_deleted=False,
        ).first()

    if patient is None:
        patient = Patient.objects.create(
            clinic=clinic,
            first_name=booking.patient_first_name,
            last_name=booking.patient_last_name,
            date_of_birth='2000-01-01',
            gender='O',
            email=booking.patient_email or '',
            phone=booking.patient_phone,
            address='',
            city=clinic.city or '',
            province=clinic.province or '',
            emergency_contact_name='',
            emergency_contact_phone='',
            emergency_contact_relationship='',
            is_active=True,
        )
        logger.info(
            f"Patient created from portal booking #{booking.reference_number}: "
            f"{patient.get_full_name()} ({patient.patient_number})"
        )

    # ── 2. Find or create Appointment ─────────────────────────────────────
    if booking.appointment_id:
        return patient, booking.appointment

    appointment = Appointment.objects.filter(
        clinic=clinic,
        patient=patient,
        date=booking.appointment_date,
        start_time=booking.appointment_time,
        is_deleted=False,
    ).first()

    if appointment is None:
        duration = booking.service.duration_minutes if booking.service else 60
        start_dt = datetime.combine(booking.appointment_date, booking.appointment_time)
        end_dt   = start_dt + timedelta(minutes=duration)

        appointment = Appointment.objects.create(
            clinic=clinic,
            patient=patient,
            practitioner=booking.practitioner,
            appointment_type='INITIAL',
            status='CONFIRMED',
            date=booking.appointment_date,
            start_time=booking.appointment_time,
            end_time=end_dt.time(),
            duration_minutes=duration,
            chief_complaint=booking.notes or '',
            notes=f'Created from portal booking #{booking.reference_number}',
            # confirmed_by_user may be None for auto-confirms
            created_by=confirmed_by_user,
            updated_by=confirmed_by_user,
        )
        logger.info(
            f"Appointment #{appointment.id} created from portal booking "
            f"#{booking.reference_number} for {patient.get_full_name()}"
        )

    # ── 3. Link appointment back to booking ───────────────────────────────
    booking.appointment = appointment
    booking.save(update_fields=['appointment'])

    return patient, appointment



# ─── Patient Pagination ───────────────────────────────────────────────────────

class PatientPagination(PageNumberPagination):
    page_size            = 10
    page_size_query_param = 'page_size'
    max_page_size        = 100


# ─── Patient ViewSet ──────────────────────────────────────────────────────────

class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.filter(is_deleted=False).select_related(
        'clinic', 'archived_by'
    )
    serializer_class   = PatientSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = PatientPagination
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ['clinic', 'gender', 'is_active', 'is_archived']
    search_fields      = ['first_name', 'last_name', 'patient_number', 'phone', 'email']
    ordering_fields    = ['last_name', 'created_at']

    def get_queryset(self):
        user = self.request.user
        qs   = self.queryset

        # Scope to clinic
        if user.is_admin:
            base_qs = qs.filter(clinic=user.clinic)
        else:
            base_qs = qs.filter(clinic=user.clinic) if user.clinic else qs.none()

        # ── Default: exclude archived patients unless explicitly requested ──
        # Pass ?include_archived=true  → return ALL (active + archived)
        # Pass ?archived=true          → return ONLY archived
        # Default (no param)           → return ONLY active (not archived)
        include_archived = self.request.query_params.get('include_archived', 'false').lower()
        only_archived    = self.request.query_params.get('archived', 'false').lower()

        if only_archived == 'true':
            base_qs = base_qs.filter(is_archived=True)
        elif include_archived != 'true':
            base_qs = base_qs.filter(is_archived=False)

        return base_qs

    def perform_create(self, serializer):
        patient = serializer.save()
        # Send welcome email in the background (fire-and-forget)
        try:
            from apps.common.email_utils import send_new_client_welcome_email
            send_new_client_welcome_email(patient)
        except Exception as e:
            logger.warning(f"Welcome email failed for patient {patient.id}: {e}")

    @action(detail=True, methods=['get'])
    def intake_forms(self, request, pk=None):
        patient    = self.get_object()
        forms      = patient.intake_forms.all()
        serializer = IntakeFormSerializer(forms, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='consents')
    def consents(self, request, pk=None):
        patient = self.get_object()
        consents = PatientConsent.objects.filter(
            patient=patient,
            patient__clinic=request.user.clinic,
        ).order_by('-created_at')
        serializer = PatientConsentSerializer(consents, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='archive')
    def archive(self, request, pk=None):
        """
        POST /api/patients/{id}/archive/
        Archives a patient — hides them and their appointments from the diary.
        Any authenticated user can archive.
        """
        patient = self.get_object()

        if patient.is_archived:
            return Response(
                {'detail': 'Patient is already archived.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        patient.archive(archived_by_user=request.user)

        logger.info(
            f"Patient #{patient.patient_number} ({patient.get_full_name()}) "
            f"archived by {request.user.email}"
        )

        return Response(
            {
                'detail':      f'{patient.get_full_name()} has been archived.',
                'patient_id':  patient.id,
                'is_archived': True,
                'archived_at': patient.archived_at,
                'archived_by': request.user.get_full_name(),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        """
        POST /api/patients/{id}/restore/
        Restores an archived patient — makes them and their appointments visible again.
        Any authenticated user can restore.
        """
        # get_object() by default uses get_queryset() which excludes archived —
        # we need to fetch directly so archived patients are reachable.
        patient = get_object_or_404(
            Patient,
            pk=pk,
            clinic=request.user.clinic,
            is_deleted=False,
        )

        if not patient.is_archived:
            return Response(
                {'detail': 'Patient is not archived.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        patient.restore()

        logger.info(
            f"Patient #{patient.patient_number} ({patient.get_full_name()}) "
            f"restored by {request.user.email}"
        )

        return Response(
            {
                'detail':      f'{patient.get_full_name()} has been restored.',
                'patient_id':  patient.id,
                'is_archived': False,
            },
            status=status.HTTP_200_OK,
        )


# ─── Intake Form ViewSet ──────────────────────────────────────────────────────

class IntakeFormViewSet(viewsets.ModelViewSet):
    queryset           = IntakeForm.objects.all().select_related('patient', 'completed_by')
    serializer_class   = IntakeFormSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ['patient', 'completed_by']

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return self.queryset
        return self.queryset.filter(patient__clinic=user.clinic)


# ─── Portal Service Management (admin) ───────────────────────────────────────

class ServiceCategoryViewSet(viewsets.ModelViewSet):
    queryset           = ServiceCategory.objects.filter(is_deleted=False)
    serializer_class   = ServiceCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields   = ['is_active']
    search_fields      = ['name']

    def get_queryset(self):
        return self.queryset.filter(clinic=self.request.user.clinic)

    def perform_create(self, serializer):
        serializer.save(clinic=self.request.user.clinic)


class PortalServiceViewSet(viewsets.ModelViewSet):
    queryset           = PortalService.objects.filter(is_deleted=False).select_related('category', 'clinic')
    serializer_class   = PortalServiceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields   = ['is_active', 'category']
    search_fields      = ['name', 'description']

    def get_queryset(self):
        return self.queryset.filter(clinic=self.request.user.clinic)

    def perform_create(self, serializer):
        serializer.save(clinic=self.request.user.clinic)


# ─── Portal Link management (admin) ──────────────────────────────────────────

class PortalLinkViewSet(viewsets.ModelViewSet):
    queryset           = PortalLink.objects.select_related('clinic')
    serializer_class   = PortalLinkAdminSerializer
    permission_classes = [IsAuthenticated]
    http_method_names  = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        main_clinic = self.request.user.clinic.main_clinic
        return self.queryset.filter(clinic=main_clinic)

    def list(self, request, *args, **kwargs):
        main_clinic = request.user.clinic.main_clinic
        portal_link, created = PortalLink.get_or_create_for_clinic(main_clinic)
        if created:
            logger.info(f"Portal link auto-created for clinic: {main_clinic.name}")
        serializer = self.get_serializer(portal_link, context={'request': request})
        return Response([serializer.data])

    def retrieve(self, request, *args, **kwargs):
        instance   = self.get_object()
        serializer = self.get_serializer(instance, context={'request': request})
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        instance   = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=True, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        logger.info(
            f"Portal link updated for clinic: {instance.clinic.name} "
            f"by {request.user.email}"
        )
        return Response(serializer.data)


# ─── Portal Booking management (admin) ───────────────────────────────────────

class PortalBookingAdminViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PortalBooking.objects.select_related(
        'portal_link__clinic', 'service', 'practitioner__user'
    )
    serializer_class   = PortalBookingResponseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields   = ['status']
    ordering_fields    = ['appointment_date', 'created_at']

    def get_queryset(self):
        user = self.request.user
        if not user.clinic:
            return self.queryset.none()
        main_clinic    = user.clinic.main_clinic
        all_branch_ids = list(
            main_clinic.get_all_branches().values_list('id', flat=True)
        )
        return self.queryset.filter(portal_link__clinic_id__in=all_branch_ids)

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        booking    = self.get_object()
        new_status = request.data.get('status')
        allowed    = [s[0] for s in PortalBooking.STATUS_CHOICES]

        if new_status not in allowed:
            return Response(
                {'status': f'Must be one of: {", ".join(allowed)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = new_status
        booking.save(update_fields=['status', 'updated_at'])

        result = {'id': booking.id, 'status': booking.status}

        if new_status == 'CONFIRMED':
            try:
                patient, appointment = _confirm_portal_booking(booking, request.user)
                result['patient_id']     = patient.id
                result['patient_number'] = patient.patient_number
                result['patient_name']   = patient.get_full_name()
                result['appointment_id'] = appointment.id if appointment else None
                logger.info(
                    f"Portal booking #{booking.reference_number} confirmed. "
                    f"Patient: {patient.patient_number}, "
                    f"Appointment: {appointment.id if appointment else 'N/A'}"
                )
            except Exception as e:
                logger.error(f"Failed to create patient/appointment from portal booking: {e}")
                result['warning'] = 'Booking confirmed but failed to auto-create patient record.'

        return Response(result)


# ─── Public Portal endpoints (no auth) ───────────────────────────────────────

class PublicPortalView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token: str):
        portal_link = get_object_or_404(PortalLink, token=token, is_active=True)
        serializer  = PortalLinkPublicSerializer(portal_link, context={'request': request})
        return Response(serializer.data)


class PublicPortalBookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, token: str):
        portal_link = get_object_or_404(PortalLink, token=token, is_active=True)

        serializer = PortalBookingCreateSerializer(
            data=request.data,
            context={'request': request, 'portal_link': portal_link},
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # ── Validate practitioner is assigned to the service (if service restricts) ──
        validated  = serializer.validated_data
        service_obj = validated.get('service')
        prac_obj    = validated.get('practitioner')
        consent_id  = validated.get('consent_id')

        consent = None
        if consent_id:
            consent = PatientConsent.objects.filter(
                id=consent_id,
                portal_link=portal_link,
            ).first()
            if not consent:
                return Response(
                    {'detail': 'Consent record not found or invalid.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if service_obj and prac_obj:
            assigned_ids = list(service_obj.assigned_practitioners.values_list('id', flat=True))
            if assigned_ids and prac_obj.id not in assigned_ids:
                return Response(
                    {'detail': 'The selected practitioner does not offer this service.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        booking = serializer.save(portal_link=portal_link)

        # ── Auto-confirm: skip PENDING, immediately create patient + appointment ──
        try:
            # Set status to CONFIRMED right away
            booking.status = 'CONFIRMED'
            booking.save(update_fields=['status', 'updated_at'])

            # Create patient + diary appointment
            patient, _appointment = _confirm_portal_booking(booking, confirmed_by_user=None)

            if consent and consent.patient_id is None:
                consent.patient = patient
                consent.save(update_fields=['patient', 'updated_at'])

            logger.info(
                f"Portal booking #{booking.reference_number} auto-confirmed "
                f"for clinic '{portal_link.clinic.name}'"
            )

            # Send booking confirmation email
            try:
                from apps.common.email_utils import send_booking_confirmation_email
                send_booking_confirmation_email(booking)
            except Exception as email_err:
                logger.warning(
                    f"Booking confirmation email failed for #{booking.reference_number}: {email_err}"
                )
        except Exception as e:
            logger.error(f"Auto-confirm failed for portal booking #{booking.reference_number}: {e}")
            # Still return success to the patient — staff can confirm manually if needed

        response_serializer = PortalBookingResponseSerializer(
            booking, context={'request': request}
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class PublicPortalConsentCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, token: str):
        portal_link = get_object_or_404(PortalLink, token=token, is_active=True)

        serializer = PublicPatientConsentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        consent = serializer.save(portal_link=portal_link)
        return Response(
            PublicPatientConsentCreateSerializer(consent).data,
            status=status.HTTP_201_CREATED,
        )


class PublicAvailableSlotsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token: str):
        portal_link = get_object_or_404(PortalLink, token=token, is_active=True)

        service_id      = request.query_params.get('service')
        date_str        = request.query_params.get('date')
        practitioner_id = request.query_params.get('practitioner')

        if not service_id or not date_str:
            return Response(
                {'detail': 'service and date query params are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = get_object_or_404(
            ClinicService,
            pk=service_id,
            clinic=portal_link.clinic,
            is_active=True,
            show_in_portal=True,
        )

        from datetime import time, date as date_type, timedelta, datetime
        from apps.appointments.models import Appointment
        from apps.appointments.models import PractitionerSchedule
        from apps.appointments.models import BlockAppointment
        from apps.clinics.models import Practitioner

        try:
            target_date = date_type.fromisoformat(date_str)
        except ValueError:
            return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

        if target_date < date_type.today():
            return Response({'detail': 'Cannot book a past date.'}, status=400)

        duration     = service.duration_minutes
        CLINIC_START = 6 * 60
        CLINIC_END   = 21 * 60

        # ── Practitioner availability ──────────────────────────────────────────
        practitioner_obj = None
        practitioner_availability = None
        if practitioner_id:
            try:
                practitioner_obj = Practitioner.objects.select_related('user').get(
                    id=practitioner_id,
                    is_deleted=False,
                    user__is_active=True,
                )
                practitioner_availability = practitioner_obj.availability
            except Practitioner.DoesNotExist:
                pass

        # Map weekday (0=Mon) to duty day string
        WEEKDAY_MAP = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        target_weekday = WEEKDAY_MAP[target_date.weekday()]

        # Parse lunch break (always used)
        def parse_mins(t: str) -> int:
            h, m = t.split(':')
            return int(h) * 60 + int(m)

        # ── Build candidate time blocks from duty schedule ─────────────────────
        # Each block = (start_min, end_min).  Lunch is removed from each block.
        candidate_blocks: list[tuple[int, int]] = []

        if practitioner_availability and practitioner_availability.get('duty_days'):
            duty_days = practitioner_availability.get('duty_days', [])
            if target_weekday not in duty_days:
                return Response({'date': date_str, 'slots': []})

            duty_schedule = practitioner_availability.get('duty_schedule')
            lunch_start_min = parse_mins(practitioner_availability.get('lunch_start_time', '12:00'))
            lunch_end_min   = parse_mins(practitioner_availability.get('lunch_end_time', '13:00'))

            if duty_schedule and target_weekday in duty_schedule:
                # Split-shift: multiple blocks for this day
                for block in duty_schedule[target_weekday]:
                    b_start = parse_mins(block['start'])
                    b_end   = parse_mins(block['end'])
                    # Remove lunch from each block by splitting if needed
                    if b_end <= lunch_start_min or b_start >= lunch_end_min:
                        # Block entirely outside lunch — keep whole
                        candidate_blocks.append((b_start, b_end))
                    else:
                        # Block overlaps lunch — split
                        if b_start < lunch_start_min:
                            candidate_blocks.append((b_start, lunch_start_min))
                        if b_end > lunch_end_min:
                            candidate_blocks.append((lunch_end_min, b_end))
            else:
                # Legacy single-block duty hours
                duty_start_min = parse_mins(practitioner_availability.get('duty_start_time', '08:00'))
                duty_end_min   = parse_mins(practitioner_availability.get('duty_end_time', '17:00'))
                if duty_end_min <= lunch_start_min or duty_start_min >= lunch_end_min:
                    candidate_blocks.append((duty_start_min, duty_end_min))
                else:
                    if duty_start_min < lunch_start_min:
                        candidate_blocks.append((duty_start_min, lunch_start_min))
                    if duty_end_min > lunch_end_min:
                        candidate_blocks.append((lunch_end_min, duty_end_min))
        else:
            # No practitioner / no duty days config: full clinic hours
            LUNCH_START = 12 * 60
            LUNCH_END   = 13 * 60
            candidate_blocks.append((CLINIC_START, LUNCH_START))
            candidate_blocks.append((LUNCH_END, CLINIC_END))

        # Generate 30-min candidate slots from all blocks
        def time_to_minutes(t):
            return t.hour * 60 + t.minute

        def minutes_to_time(m):
            return time(m // 60, m % 60)

        SLOT_INTERVAL = 15  # minutes between slots
        candidate_slots = []
        for (b_start, b_end) in candidate_blocks:
            m = b_start
            # Only generate a slot if the full service duration fits within this block
            while m + duration <= b_end:
                candidate_slots.append(minutes_to_time(m))
                m += SLOT_INTERVAL

        weekday         = target_date.weekday()

        booked_ranges = []

        diary_qs = Appointment.objects.filter(
            date=target_date,
            clinic=portal_link.clinic,
            status__in=['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'],
            is_deleted=False,
            # ✅ Exclude archived patients' appointments from slot-availability too
            patient__is_archived=False,
        )
        if practitioner_id:
            diary_qs = diary_qs.filter(practitioner_id=practitioner_id)

        for appt in diary_qs:
            booked_ranges.append((
                time_to_minutes(appt.start_time),
                time_to_minutes(appt.end_time),
            ))

        portal_qs = PortalBooking.objects.filter(
            portal_link=portal_link,
            appointment_date=target_date,
            status__in=['PENDING', 'CONFIRMED'],
        )
        if practitioner_id:
            portal_qs = portal_qs.filter(practitioner_id=practitioner_id)

        for booking in portal_qs:
            booking_start            = time_to_minutes(booking.appointment_time)
            booking_service_duration = (
                booking.service.duration_minutes if booking.service else duration
            )
            booking_end = booking_start + booking_service_duration
            booked_ranges.append((booking_start, booking_end))

        # Add block appointments to blocked ranges
        block_qs = BlockAppointment.objects.filter(
            clinic=portal_link.clinic,
            date=target_date,
        )

        for block in block_qs:
            block_start = time_to_minutes(block.start_time)
            block_end   = time_to_minutes(block.end_time)
            booked_ranges.append((block_start, block_end))

        available = []
        for slot_time in candidate_slots:
            slot_start = time_to_minutes(slot_time)
            slot_end   = slot_start + duration

            if slot_end > CLINIC_END:
                continue

            overlaps = any(
                slot_start < booked_end and slot_end > booked_start
                for booked_start, booked_end in booked_ranges
            )
            if not overlaps:
                available.append(f"{slot_time.hour:02d}:{slot_time.minute:02d}")

        return Response({'date': date_str, 'slots': available})


class PortalBookingDiaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')

        if not date_from or not date_to:
            return Response(
                {'detail': 'date_from and date_to are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bookings = PortalBooking.objects.filter(
            portal_link__clinic=request.user.clinic,
            appointment_date__gte=date_from,
            appointment_date__lte=date_to,
            status='PENDING',
        ).select_related('service', 'practitioner__user')

        practitioner_id = request.query_params.get('practitioner')
        if practitioner_id:
            bookings = bookings.filter(practitioner_id=practitioner_id)

        clinic_branch = request.query_params.get('clinic_branch')
        if clinic_branch:
            bookings = bookings.filter(portal_link__clinic_id=clinic_branch)

        from datetime import datetime, timedelta
        data = []
        for b in bookings:
            duration = b.service.duration_minutes if b.service else 60
            start_dt = datetime.combine(b.appointment_date, b.appointment_time)
            end_dt   = start_dt + timedelta(minutes=duration)

            data.append({
                'id':               b.id,
                'reference_number': b.reference_number,
                'status':           b.status,
                'patient_name':     f"{b.patient_first_name} {b.patient_last_name}",
                'patient_phone':    b.patient_phone,
                'patient_email':    b.patient_email,
                'service_name':     b.service.name if b.service else '—',
                'practitioner_id':  b.practitioner_id,
                'practitioner_name': (
                    b.practitioner.user.get_full_name() if b.practitioner else 'Any Available'
                ),
                'date':             b.appointment_date.strftime('%Y-%m-%d'),
                'start_time':       b.appointment_time.strftime('%H:%M'),
                'end_time':         end_dt.strftime('%H:%M'),
                'duration_minutes': duration,
                'notes':            b.notes,
            })

        return Response(data)