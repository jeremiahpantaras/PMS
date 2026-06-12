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
        return self.queryset.filter(id=user.clinic_id) if user.clinic else self.queryset.none()

    # ── GET /api/clinics/branches/ ────────────────────────────────────────────
    @action(detail=False, methods=['get'])
    def branches(self, request):
        user = request.user
        if not user.clinic:
            return Response({'branches': []})

        main_clinic = user.clinic.main_clinic
        cache_key   = f'clinic_branches_{main_clinic.id}'
        cached      = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        branches    = Clinic.objects.filter(
            Q(id=main_clinic.id) | Q(parent_clinic=main_clinic)
        ).filter(is_deleted=False, is_active=True).order_by('-is_main_branch', 'name')

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
            # Invalidate branch cache for this clinic family
            cache.delete(f'clinic_branches_{main_clinic.id}')
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
        cache.delete(f'clinic_branches_{clinic.main_clinic.id}')

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
    CRUD operations for clinic consent forms.
    Each clinic can have one active consent form at a time.
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
        """Get the active consent form for the current user's clinic."""
        user = request.user
        if not user.clinic:
            return Response({'detail': 'No clinic associated.'}, status=status.HTTP_404_NOT_FOUND)

        main_clinic = user.clinic.main_clinic
        consent = self.get_queryset().filter(clinic=main_clinic, is_active=True).first()

        if not consent:
            return Response({'detail': 'No active consent form found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(consent)
        return Response(serializer.data)