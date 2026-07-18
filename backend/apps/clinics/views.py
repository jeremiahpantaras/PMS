from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from django.core.cache import cache
from .models import Clinic, Practitioner, Location, ClinicConsentForm
from .serializers import (
    ClinicSerializer,
    ClinicBranchSerializer,
    ClinicProfileSetupSerializer,
    PractitionerSerializer,
    LocationSerializer,
    ClinicConsentFormSerializer,
    ClinicConsentFormCreateSerializer,
)
from apps.common.permissions import IsAdminOrStaffOnly
import logging

logger = logging.getLogger(__name__)


class ClinicViewSet(viewsets.ModelViewSet):
    """CRUD operations for clinics"""

    queryset           = Clinic.objects.filter(is_deleted=False)
    serializer_class   = ClinicSerializer
    permission_classes = [IsAuthenticated, IsAdminOrStaffOnly]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter]
    search_fields      = ['name', 'city', 'province', 'branch_code']
    filterset_fields   = ['is_main_branch', 'parent_clinic']

    def get_permissions(self):
        # Read-only actions needed by all authenticated users (e.g. Diary branch tabs)
        if self.action in ('my_clinic', 'branches', 'list', 'retrieve'):
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            if user.clinic:
                main_clinic = user.clinic.main_clinic
                return self.queryset.filter(
                    Q(id=main_clinic.id) | Q(parent_clinic=main_clinic)
                )
            return self.queryset
        
        if user.is_manager:
            allowed_branches = list(user.branch_accesses.values_list('branch_id', flat=True))
            return self.queryset.filter(Q(id=user.clinic_id) | Q(id__in=allowed_branches))
            
        return self.queryset.filter(id=user.clinic_id) if user.clinic else self.queryset.none()

    def perform_update(self, serializer):
        # Save the updated clinic
        clinic = serializer.save()
        # Invalidate the cache so the updated branch appears immediately
        user = self.request.user
        if clinic.main_clinic:
            cache.delete(f'clinic_branches_{clinic.main_clinic.id}_user_{user.id}')
        else:
            cache.delete(f'clinic_branches_{clinic.id}_user_{user.id}')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_main_branch:
            return Response(
                {"detail": "Cannot delete the main clinic branch."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        main_clinic = instance.main_clinic
        user = self.request.user
        
        # Permanently delete all users specifically assigned to this branch
        from apps.accounts.models import User
        users_to_delete = User.objects.filter(clinic_branch=instance)
        for u in users_to_delete:
            u.delete()

        # Handle appointments: delete future, preserve past
        from apps.appointments.models import Appointment
        from django.utils import timezone
        
        now = timezone.now()
        today = now.date()
        
        # Hard delete future appointments
        future_appointments = Appointment.objects.filter(clinic=instance, date__gt=today)
        future_appointments.delete()

        # Reassign past/today appointments to the main clinic so they survive the CASCADE deletion
        past_appointments = Appointment.objects.filter(clinic=instance, date__lte=today)
        past_appointments.update(clinic=main_clinic)
            
        # Perform hard delete of the branch
        instance.delete()
        
        # Invalidate cache
        if main_clinic:
            cache.delete(f'clinic_branches_{main_clinic.id}_user_{user.id}')
        else:
            cache.delete(f'clinic_branches_{instance.id}_user_{user.id}')

    # ── GET /api/clinics/branches/ ────────────────────────────────────────────
    @action(detail=False, methods=['get'])
    def branches(self, request):
        user = request.user
        if not user.clinic:
            return Response({'branches': []})

        main_clinic = user.clinic.main_clinic
        cache_key   = f'clinic_branches_{main_clinic.id}_user_{user.id}'
        cached      = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        branches    = Clinic.objects.filter(
            Q(id=main_clinic.id) | Q(parent_clinic=main_clinic)
        ).filter(is_deleted=False, is_active=True).order_by('-is_main_branch', 'name')

        if not user.is_admin:
            if user.is_manager:
                allowed_branches = list(user.branch_accesses.values_list('branch_id', flat=True))
                branches = branches.filter(id__in=allowed_branches)
            else:
                branches = branches.filter(id=user.clinic_id)

        serializer = ClinicBranchSerializer(branches, many=True)
        result = {
            'branches':       serializer.data,
            'main_clinic_id': main_clinic.id,
        }
        cache.set(cache_key, result, timeout=300)  # 5-minute cache
        return Response(result)

    # ── POST /api/clinics/{id}/create_branch/ ────────────────────────────────
    @action(detail=True, methods=['post'])
    def create_branch(self, request, pk=None):
        main_clinic = self.get_object()

        if not request.user.is_admin or request.user.clinic.main_clinic.id != main_clinic.id:
            return Response(
                {'detail': 'Only clinic administrators can create branches.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if main_clinic.is_branch:
            return Response(
                {'detail': 'Cannot create a branch under another branch.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        branch_data = request.data.copy()
        branch_data['parent_clinic']        = main_clinic.id
        branch_data['is_main_branch']       = False
        branch_data['subscription_plan']    = main_clinic.subscription_plan
        branch_data['subscription_expires'] = main_clinic.subscription_expires

        serializer = ClinicSerializer(data=branch_data)
        if serializer.is_valid():
            serializer.save()
            # Invalidate branch cache for this clinic family (at least for the user making the change)
            cache.delete(f'clinic_branches_{main_clinic.id}_user_{request.user.id}')
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # ── PATCH /api/clinics/{id}/setup_profile/ ───────────────────────────────
    @action(
        detail=True,
        methods=['patch'],
        url_path='setup_profile',
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def setup_profile(self, request, pk=None):
        """
        Complete (or update) the initial clinic profile.
        Only the admin of the clinic may call this.
        Sets setup_complete = True on success.
        Accepts multipart/form-data (for logo upload) or JSON.
        """
        clinic = self.get_object()

        if not request.user.is_admin:
            return Response(
                {'detail': 'Only administrators can update the clinic profile.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if request.user.clinic.main_clinic.id != clinic.main_clinic.id:
            return Response(
                {'detail': 'You can only update your own clinic profile.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ClinicProfileSetupSerializer(
            clinic, data=request.data, partial=True,
            context={'request': request},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Save profile fields + mark setup complete
        serializer.save(setup_complete=True)

        # Invalidate branch cache since profile data is included in branch responses
        cache.delete(f'clinic_branches_{clinic.main_clinic.id}_user_{request.user.id}')

        logger.info(
            "Clinic profile setup completed for '%s' by %s",
            clinic.name, request.user.email,
        )

        # Return full clinic data so the frontend can update its store
        full = ClinicSerializer(clinic, context={'request': request})
        return Response(full.data, status=status.HTTP_200_OK)

    # ── GET /api/clinics/my_clinic/ ───────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='my_clinic')
    def my_clinic(self, request):
        """Return the main clinic record for the authenticated user."""
        if not request.user.clinic:
            return Response({'detail': 'No clinic associated.'}, status=status.HTTP_404_NOT_FOUND)

        clinic     = request.user.clinic.main_clinic
        serializer = ClinicSerializer(clinic, context={'request': request})
        return Response(serializer.data)

    # ── GET/PATCH /api/clinics/{id}/consent_form/ ─────────────────────────────
    @action(detail=True, methods=['get', 'patch'], url_path='consent_form')
    def consent_form(self, request, pk=None):
        """Manage the consent form strictly for this specific branch."""
        branch = self.get_object()

        # RBAC Check: Manager must have access to this branch
        user = request.user
        if not user.is_admin:
            if user.is_manager:
                allowed_branches = list(user.branch_accesses.values_list('branch_id', flat=True))
                if branch.id not in allowed_branches:
                    return Response({'detail': 'You do not have permission to manage this branch.'}, status=status.HTTP_403_FORBIDDEN)
            else:
                # Practitioners cannot edit consent forms
                if request.method != 'GET':
                    return Response({'detail': 'Practitioners cannot edit consent forms.'}, status=status.HTTP_403_FORBIDDEN)

        # GET Request
        if request.method == 'GET':
            try:
                consent = branch.consent_form
                return Response(ClinicConsentFormSerializer(consent).data)
            except ClinicConsentForm.DoesNotExist:
                return Response({}, status=status.HTTP_200_OK)

        # PATCH Request
        if request.method == 'PATCH':
            try:
                consent = branch.consent_form
                serializer = ClinicConsentFormCreateSerializer(consent, data=request.data, partial=True)
            except ClinicConsentForm.DoesNotExist:
                serializer = ClinicConsentFormCreateSerializer(data=request.data)
            
            if serializer.is_valid():
                save_kwargs = {
                    'clinic': branch,
                    'updated_by': request.user
                }
                if not getattr(serializer.instance, 'created_by_id', None):
                    save_kwargs['created_by'] = request.user
                
                serializer.save(**save_kwargs)
                return Response(ClinicConsentFormSerializer(serializer.instance).data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PractitionerViewSet(viewsets.ModelViewSet):
    queryset           = Practitioner.objects.filter(is_deleted=False).select_related('user', 'clinic')
    serializer_class   = PractitionerSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields   = ['clinic', 'is_accepting_patients']
    search_fields      = ['user__first_name', 'user__last_name', 'specialization']

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return self.queryset
        return self.queryset.filter(clinic=user.clinic)

    @action(detail=True, methods=['get'])
    def deletion_impact(self, request, pk=None):
        practitioner = self.get_object()
        from apps.appointments.models import Appointment
        from django.utils import timezone
        
        future_appointments_count = Appointment.objects.filter(
            practitioner=practitioner,
            date__gte=timezone.localdate(),
            status__in=['SCHEDULED', 'CONFIRMED', 'PENDING']
        ).count()
        
        return Response({
            "future_appointments": future_appointments_count
        })

    def perform_destroy(self, instance):
        from apps.appointments.models import Appointment
        from django.utils import timezone
        import uuid
        
        # 1. Cancel future appointments
        future_appointments = Appointment.objects.filter(
            practitioner=instance,
            date__gte=timezone.localdate(),
            status__in=['SCHEDULED', 'CONFIRMED', 'PENDING']
        )
        for appt in future_appointments:
            appt.status = 'CANCELLED'
            appt.cancellation_reason = 'Practitioner is no longer available.'
            appt.cancelled_at = timezone.now()
            appt.cancelled_by = self.request.user
            appt.save(update_fields=['status', 'cancellation_reason', 'cancelled_at', 'cancelled_by'])
            
        # 2. Release email uniqueness constraints by soft-deleting user & renaming email
        user = instance.user
        if user:
            # Generate a unique suffix so email can be reused
            unique_suffix = str(uuid.uuid4())[:8]
            old_email = user.email
            # Prepend 'deleted_{suffix}_' to the email to ensure uniqueness
            user.email = f"deleted_{unique_suffix}_{old_email}"[:254] # Ensure fits max length
            user.is_active = False
            user.save(update_fields=['email', 'is_active'])
            user.soft_delete()
            
        # 3. Soft-delete the Practitioner instance (avoids CASCADE dropping historical records)
        instance.soft_delete()


class LocationViewSet(viewsets.ModelViewSet):
    queryset           = Location.objects.filter(is_deleted=False)
    serializer_class   = LocationSerializer
    permission_classes = [IsAuthenticated, IsAdminOrStaffOnly]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ['clinic', 'is_active']

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return self.queryset
        return self.queryset.filter(clinic=user.clinic)


class ClinicConsentFormViewSet(viewsets.ModelViewSet):
    """
    Legacy CRUD operations for clinic consent forms.
    Retained for compatibility. Operates on the main clinic's consent form.
    """

    queryset = ClinicConsentForm.objects.all()
    serializer_class = ClinicConsentFormSerializer
    permission_classes = [IsAuthenticated, IsAdminOrStaffOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['clinic', 'is_active']

    def get_queryset(self):
        user = self.request.user
        if not user.clinic:
            return self.queryset.none()

        main_clinic = user.clinic.main_clinic
        all_branch_ids = list(main_clinic.get_all_branches().values_list('id', flat=True))
        return self.queryset.filter(clinic_id__in=all_branch_ids)

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ClinicConsentFormCreateSerializer
        return ClinicConsentFormSerializer

    def perform_create(self, serializer):
        user = self.request.user
        main_clinic = user.clinic.main_clinic
        serializer.save(clinic=main_clinic)

    @action(detail=False, methods=['get'], url_path='active')
    def active_consent(self, request):
        """Get the active consent form for the current user's clinic (Main Clinic fallback)."""
        user = request.user
        if not user.clinic:
            return Response({'detail': 'No clinic associated.'}, status=status.HTTP_404_NOT_FOUND)

        main_clinic = user.clinic.main_clinic
        consent = self.get_queryset().filter(clinic=main_clinic, is_active=True).first()

        if not consent:
            return Response({'detail': 'No active consent form found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(consent)
        return Response(serializer.data)