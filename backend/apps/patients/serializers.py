from rest_framework import serializers
from apps.clinics.services.models import Service as ClinicService
from .models import (
    Patient, IntakeForm,
    ServiceCategory, PortalService,
    PortalLink, PortalBooking, PatientConsent,
    ClientFormRequest,
)


class PatientSerializer(serializers.ModelSerializer):
    full_name       = serializers.CharField(source='get_full_name', read_only=True)
    age             = serializers.SerializerMethodField()
    archived_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = Patient
        fields = '__all__'
        read_only_fields = [
            'id', 'patient_number', 'created_at', 'updated_at',
            # Archive fields are set server-side via the archive/restore actions
            'is_archived', 'archived_at', 'archived_by',
        ]

    def get_age(self, obj):
        from datetime import date
        today = date.today()
        return today.year - obj.date_of_birth.year - (
            (today.month, today.day) < (obj.date_of_birth.month, obj.date_of_birth.day)
        )

    def get_archived_by_name(self, obj) -> str | None:
        if obj.archived_by:
            return obj.archived_by.get_full_name()
        return None


class IntakeFormSerializer(serializers.ModelSerializer):
    patient_name      = serializers.CharField(source='patient.get_full_name', read_only=True)
    completed_by_name = serializers.CharField(source='completed_by.get_full_name', read_only=True)

    class Meta:
        model  = IntakeForm
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


# ─── Portal serializers ───────────────────────────────────────────────────────

class ServiceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model  = ServiceCategory
        fields = ['id', 'name', 'description', 'is_active']


class PortalServiceSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    image_url     = serializers.SerializerMethodField()

    class Meta:
        model  = PortalService
        fields = [
            'id', 'name', 'description', 'duration_minutes',
            'price', 'image_url', 'is_active',
            'category', 'category_name',
        ]

    def get_image_url(self, obj) -> str | None:
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None


class PortalPractitionerSerializer(serializers.Serializer):
    """
    Serializes practitioner data for the public portal response.
    Includes branch_id so the frontend can filter by selected branch.
    """
    id             = serializers.SerializerMethodField()
    full_name      = serializers.SerializerMethodField()
    title          = serializers.SerializerMethodField()
    specialization = serializers.SerializerMethodField()
    position       = serializers.SerializerMethodField()
    occupation     = serializers.SerializerMethodField()
    discipline     = serializers.SerializerMethodField()
    bio            = serializers.SerializerMethodField()
    avatar_url     = serializers.SerializerMethodField()
    branch_id      = serializers.SerializerMethodField()   # ← critical field
    availability    = serializers.SerializerMethodField() # ← NEW
    services        = serializers.SerializerMethodField() # ← NEW: assigned services

    def get_id(self, obj):
        return obj.id

    def get_full_name(self, obj):
        return obj.user.get_full_name()

    def get_title(self, obj):
        # title lives on User (from staff.types: TitleType)
        return getattr(obj.user, 'title', None)

    def get_specialization(self, obj):
        return obj.specialization or ''

    def get_position(self, obj):
        return getattr(obj.user, 'position', None)

    def get_occupation(self, obj):
        # occupation == position for display purposes
        return getattr(obj.user, 'position', None) or ''

    def get_discipline(self, obj):
        return getattr(obj.user, 'discipline', None)

    def get_bio(self, obj):
        return getattr(obj, 'bio', '') or ''

    def get_avatar_url(self, obj):
        request = self.context.get('request')
        avatar  = obj.user.avatar
        if avatar and request:
            return request.build_absolute_uri(avatar.url)
        return None

    def get_branch_id(self, obj):
        """
        User.clinic_branch_id = the branch the staff member belongs to.
        This is what the frontend filters on when a branch is selected.
        Falls back to Practitioner.clinic_id if clinic_branch is not set.
        """
        branch_id = obj.user.clinic_branch_id
        if branch_id is not None:
            return branch_id
        # Fallback: use the practitioner's own clinic FK
        return obj.clinic_id

    def get_availability(self, obj):
        """Return practitioner availability for booking restrictions."""
        return obj.availability

    def get_services(self, obj):
        """Return list of services assigned to this practitioner."""
        return [
            {'id': svc.id, 'name': svc.name}
            for svc in getattr(obj, 'prefetched_services', obj.services.filter(is_deleted=False, is_active=True))
        ]


class PortalClinicServiceSerializer(serializers.ModelSerializer):
    image_url     = serializers.SerializerMethodField()
    category      = serializers.SerializerMethodField()
    category_name = serializers.SerializerMethodField()
    assigned_practitioner_ids = serializers.SerializerMethodField()
    sort_order    = serializers.IntegerField()

    class Meta:
        model  = ClinicService
        fields = [
            'id', 'name', 'description', 'duration_minutes',
            'price', 'image_url', 'is_active',
            'category', 'category_name', 'color_hex', 'sort_order',
            'assigned_practitioner_ids',
        ]

    def get_image_url(self, obj) -> str | None:
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None

    def get_category(self, obj):
        return None

    def get_category_name(self, obj):
        return None

    def get_assigned_practitioner_ids(self, obj) -> list:
        # Returns empty list when no specific practitioners are assigned (= any practitioner)
        return list(
            getattr(obj, 'prefetched_assigned', obj.assigned_practitioners.values_list('id', flat=True))
        )


class PortalBranchSerializer(serializers.Serializer):
    id              = serializers.IntegerField()
    name            = serializers.CharField()
    address         = serializers.SerializerMethodField()
    city            = serializers.CharField()
    province        = serializers.CharField()
    phone           = serializers.SerializerMethodField()
    email           = serializers.SerializerMethodField()
    is_main_branch  = serializers.BooleanField()
    latitude        = serializers.DecimalField(max_digits=9,  decimal_places=6, allow_null=True)
    longitude       = serializers.DecimalField(max_digits=10, decimal_places=6, allow_null=True)
    custom_location = serializers.CharField(allow_blank=True, default='')

    def get_address(self, obj) -> str:
        # Return only the street address — city/province shown separately
        return obj.address or ''

    def get_phone(self, obj) -> str:
        return obj.phone or ''

    def get_email(self, obj) -> str:
        return obj.email or ''


class PortalLinkPublicSerializer(serializers.ModelSerializer):
    clinic_name    = serializers.CharField(source='clinic.name',   read_only=True)
    clinic_logo    = serializers.SerializerMethodField()
    clinic_address = serializers.SerializerMethodField()
    clinic_phone   = serializers.CharField(source='clinic.phone',  read_only=True)
    clinic_email   = serializers.EmailField(source='clinic.email', read_only=True)
    branches       = serializers.SerializerMethodField()   # ← NEW
    categories     = serializers.SerializerMethodField()
    practitioners  = serializers.SerializerMethodField()

    class Meta:
        model  = PortalLink
        fields = [
            'token', 'heading', 'description',
            'clinic_name', 'clinic_logo', 'clinic_address',
            'clinic_phone', 'clinic_email',
            'branches',       # ← NEW
            'categories', 'practitioners',
        ]

    def get_clinic_logo(self, obj) -> str | None:
        request = self.context.get('request')
        if obj.clinic.logo and request:
            return request.build_absolute_uri(obj.clinic.logo.url)
        return None

    def get_clinic_address(self, obj) -> str:
        c     = obj.clinic
        parts = [c.address, c.city, c.province, c.postal_code]
        return ', '.join(p for p in parts if p)

    def get_branches(self, obj):
        """Return main clinic + all active sub-branches as selectable portal branches."""
        from django.db.models import Q
        from apps.clinics.models import Clinic

        main_clinic = obj.clinic  # portal_link.clinic is always the main clinic
        all_branches = Clinic.objects.filter(
            Q(id=main_clinic.id) | Q(parent_clinic=main_clinic)
        ).filter(is_deleted=False, is_active=True).order_by('-is_main_branch', 'name')

        return PortalBranchSerializer(all_branches, many=True).data

    def get_categories(self, obj):
        services = ClinicService.objects.filter(
            clinic=obj.clinic,
            is_active=True,
            show_in_portal=True,
            is_deleted=False,
        ).prefetch_related('assigned_practitioners').order_by('name')

        if not services.exists():
            return []

        # Attach prefetched M2M as a list of ids for the serializer
        services_list = list(services)
        for svc in services_list:
            svc.prefetched_assigned = list(svc.assigned_practitioners.values_list('id', flat=True))

        serialized = PortalClinicServiceSerializer(
            services_list, many=True, context=self.context
        ).data

        return [
            {
                'id':          None,
                'name':        'Our Services',
                'description': '',
                'services':    serialized,
            }
        ]

    def get_practitioners(self, obj):
        """
        Return ALL active practitioners across all branches of this clinic's
        main clinic family — the frontend filters by branch_id client-side.
        Also prepend the 'Any Available' pseudo-entry.
        """
        from apps.clinics.models import Practitioner

        main_clinic    = obj.clinic.main_clinic
        all_branch_ids = list(
            main_clinic.get_all_branches().values_list('id', flat=True)
        )

        practitioners = Practitioner.objects.filter(
            clinic_id__in=all_branch_ids,
            user__is_active=True,
            user__is_deleted=False,
        ).select_related(
            'user',
            'user__clinic_branch',  # ← ensures clinic_branch_id is loaded, not lazy-fetched
            'clinic',
        ).prefetch_related('services')  # ← NEW: prefetch assigned services

        # Prepend "Any Available" pseudo-entry
        any_available = {
            'id':             None,
            'full_name':      'Any Available',
            'title':          None,
            'specialization': '',
            'position':       None,
            'occupation':     '',
            'discipline':     None,
            'bio':            '',
            'avatar_url':     None,
            'branch_id':      None,
            'services':       [],
        }

        # Attach prefetched services for use in get_services()
        practitioners_list = list(practitioners)
        for p in practitioners_list:
            p.prefetched_services = list(p.services.filter(is_deleted=False, is_active=True))

        serialized = PortalPractitionerSerializer(
            practitioners_list,
            many=True,
            context=self.context,
        ).data

        return [any_available] + list(serialized)



class PortalLinkAdminSerializer(serializers.ModelSerializer):
    portal_url = serializers.SerializerMethodField()

    class Meta:
        model  = PortalLink
        fields = [
            'id', 'clinic', 'token', 'heading',
            'description', 'is_active', 'portal_url',
            'created_at',
        ]
        read_only_fields = ['id', 'clinic', 'token', 'created_at']

    def get_portal_url(self, obj) -> str:
        request = self.context.get('request')
        if request:
            base = f"{request.scheme}://{request.get_host()}"
            return f"{base}/portal/{obj.token}/"
        return f"/portal/{obj.token}/"


class PortalBookingCreateSerializer(serializers.ModelSerializer):
    consent_id = serializers.IntegerField(write_only=True, required=True)

    class Meta:
        model  = PortalBooking
        fields = [
            'consent_id',
            'service', 'practitioner',
            'patient_first_name', 'patient_last_name',
            'patient_email', 'patient_phone', 'patient_date_of_birth',
            'notes', 'appointment_date', 'appointment_time',
        ]

    def create(self, validated_data):
        validated_data.pop('consent_id', None)
        return super().create(validated_data)

    def validate_service(self, value):
        if not value.is_active:
            raise serializers.ValidationError("This service is no longer available.")
        return value

    def validate(self, attrs):
        portal_link = self.context.get('portal_link')
        if portal_link and attrs.get('service'):
            if attrs['service'].clinic_id != portal_link.clinic_id:
                raise serializers.ValidationError(
                    {'service': 'Service does not belong to this clinic.'}
                )
        return attrs


class PortalBookingResponseSerializer(serializers.ModelSerializer):
    service_name                = serializers.CharField(source='service.name',               read_only=True)
    service_duration            = serializers.IntegerField(source='service.duration_minutes', read_only=True)
    service_price               = serializers.DecimalField(
        source='service.price', max_digits=10, decimal_places=2, read_only=True
    )
    practitioner_name           = serializers.SerializerMethodField()
    practitioner_specialization = serializers.SerializerMethodField()
    patient_id                 = serializers.SerializerMethodField()
    clinic_name                 = serializers.CharField(source='portal_link.clinic.name', read_only=True)
    branch_name                = serializers.SerializerMethodField()

    class Meta:
        model  = PortalBooking
        fields = [
            'id', 'reference_number', 'status',
            'patient_first_name', 'patient_last_name',
            'patient_email', 'patient_phone',
            'appointment_date', 'appointment_time',
            'notes',
            'service_name', 'service_duration', 'service_price',
            'practitioner_name', 'practitioner_specialization',
            'patient_id',
            'clinic_name', 'branch_name',
            'created_at',
        ]

    def get_practitioner_name(self, obj) -> str | None:
        return obj.practitioner.user.get_full_name() if obj.practitioner else None

    def get_practitioner_specialization(self, obj) -> str | None:
        return obj.practitioner.specialization if obj.practitioner else None

    def get_branch_name(self, obj) -> str | None:
        branch = getattr(obj.portal_link, 'branch', None)
        return branch.name if branch else None

    def get_patient_id(self, obj):
        if obj.appointment and obj.appointment.patient_id:
            return obj.appointment.patient_id
        return None


class PatientConsentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.get_full_name', read_only=True)
    clinic_name  = serializers.SerializerMethodField()

    class Meta:
        model = PatientConsent
        fields = [
            'id',
            'patient',
            'patient_name',
            'clinic_name',
            'portal_link',
            'type',
            'full_name',
            'email',
            'consent_text',
            'signature',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'patient_name', 'clinic_name']

    def get_clinic_name(self, obj) -> str | None:
        if obj.patient and obj.patient.clinic:
            return obj.patient.clinic.name
        return None


class PatientConsentCreateSerializer(serializers.ModelSerializer):
    """Used by authenticated clinic staff to create/update a patient consent."""

    class Meta:
        model = PatientConsent
        fields = ['full_name', 'email', 'consent_text', 'signature', 'type']

    def validate_signature(self, value: str):
        if not value or not value.strip():
            raise serializers.ValidationError('Signature is required.')
        return value


class PublicPatientConsentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientConsent
        fields = ['id', 'full_name', 'email', 'consent_text', 'signature', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_signature(self, value: str):
        if not value or not value.strip():
            raise serializers.ValidationError('Signature is required.')
        return value


# ─── Client Form Request serializers ─────────────────────────────────────────

class ClientFormRequestSerializer(serializers.ModelSerializer):
    patient_name   = serializers.CharField(source='patient.get_full_name', read_only=True)
    patient_email  = serializers.EmailField(source='patient.email', read_only=True)
    sent_by_name   = serializers.SerializerMethodField()
    is_expired     = serializers.BooleanField(read_only=True)

    class Meta:
        model  = ClientFormRequest
        fields = [
            'id', 'patient', 'patient_name', 'patient_email',
            'token', 'expires_at', 'is_completed', 'completed_at',
            'sent_by', 'sent_by_name', 'is_expired', 'created_at',
            'accepted_terms', 'accepted_privacy', 'accepted_at',
        ]
        read_only_fields = ['id', 'token', 'completed_at', 'created_at', 'accepted_at']

    def get_sent_by_name(self, obj):
        if obj.sent_by:
            return obj.sent_by.get_full_name()
        return None


class PublicClientFormVerifySerializer(serializers.Serializer):
    """Validates that the submitted email matches the token's patient."""
    email = serializers.EmailField()


class PublicClientFormSubmitSerializer(serializers.Serializer):
    """Patient-submitted profile data from the public form."""

    # ── Personal info ─────────────────────────────────────────────────────
    first_name      = serializers.CharField(max_length=100)
    last_name       = serializers.CharField(max_length=100)
    date_of_birth   = serializers.DateField()
    gender          = serializers.ChoiceField(choices=['M', 'F', 'O'])
    address         = serializers.CharField(max_length=500)
    province        = serializers.CharField(max_length=100)
    city            = serializers.CharField(max_length=100)
    postal_code     = serializers.CharField(max_length=10, required=False, allow_blank=True)

    # ── Emergency contact ─────────────────────────────────────────────────
    emergency_contact_name         = serializers.CharField(max_length=200)
    emergency_contact_phone        = serializers.CharField(max_length=15)
    emergency_contact_relationship = serializers.CharField(max_length=100)

    # ── Medical information ───────────────────────────────────────────────
    philhealth_number  = serializers.CharField(max_length=50,   required=False, allow_blank=True)
    medical_conditions = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    allergies          = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    medications        = serializers.CharField(max_length=2000, required=False, allow_blank=True)

    # ── Consent ───────────────────────────────────────────────────────────
    accepted_terms   = serializers.BooleanField()
    accepted_privacy = serializers.BooleanField()

    def validate(self, attrs):
        if not attrs.get('accepted_terms') or not attrs.get('accepted_privacy'):
            raise serializers.ValidationError(
                'You must accept the Terms & Conditions and Data Privacy Policy.'
            )
        return attrs