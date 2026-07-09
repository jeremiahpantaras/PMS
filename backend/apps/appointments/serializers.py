from apps.clinics import models
from rest_framework import serializers
from .models import Appointment, PractitionerSchedule, AppointmentReminder, BlockAppointment, CalendarNote
from apps.clinics.services.models import Service
from apps.accounts.models import User


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name      = serializers.CharField(source='patient.get_full_name', read_only=True)
    practitioner_name = serializers.CharField(source='practitioner.user.get_full_name', read_only=True, allow_null=True)
    practitioner_avatar = serializers.SerializerMethodField()
    location_name     = serializers.CharField(source='location.name', read_only=True, allow_null=True)
    created_by_name   = serializers.CharField(source='created_by.get_full_name', read_only=True, allow_null=True)
    updated_by_name   = serializers.CharField(source='updated_by.get_full_name', read_only=True, allow_null=True)

    service_name     = serializers.CharField(source='service.name',             read_only=True, allow_null=True)
    service_color    = serializers.CharField(source='service.color_hex',        read_only=True, allow_null=True)
    service_duration = serializers.IntegerField(source='service.duration_minutes', read_only=True, allow_null=True)

    # ── Expose the branch_id consistently ────────────────────────────────────
    branch_id = serializers.SerializerMethodField()

    # Include arrival_status and arrival_time in the response
    arrival_status = serializers.CharField(read_only=True)
    arrival_time   = serializers.DateTimeField(read_only=True)

    # ── DNA follow-up tracking ────────────────────────────────────────────────
    dna_followup_sent    = serializers.BooleanField(read_only=True)
    dna_followup_sent_at = serializers.DateTimeField(read_only=True, allow_null=True)

    # ── Has invoice ───────────────────────────────────────────────────────────
    has_invoice = serializers.SerializerMethodField()

    class Meta:
        model  = Appointment
        fields = [
            'id', 'clinic', 'branch_id', 'patient', 'patient_name',
            'practitioner', 'practitioner_name', 'practitioner_avatar',
            'location', 'location_name',
            'service', 'service_name', 'service_color', 'service_duration',
            'appointment_type',
            'status', 'arrival_status', 'arrival_time',
            'date', 'start_time', 'end_time', 'duration_minutes',
            'chief_complaint', 'notes', 'patient_notes',
            'reminder_sent', 'reminder_sent_at', 'has_invoice',
            'confirmation_sent', 'confirmation_sent_at', 'confirmation_status',
            'patient_reply', 'patient_reply_at',
            'dna_followup_sent', 'dna_followup_sent_at',
            'created_by', 'created_by_name',
            'updated_by', 'updated_by_name',
            'cancelled_by', 'cancellation_reason', 'cancelled_at',
            'booking_source',
            'service_overridden',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'branch_id', 'patient_name', 'practitioner_name', 'practitioner_avatar', 'location_name',
            'service_name', 'service_color', 'service_duration',
            'created_by_name', 'updated_by_name', 'has_invoice',
            'created_at', 'updated_at',
        ]

    def get_has_invoice(self, obj) -> bool:
        """Check if this appointment has a non-deleted invoice.
        Uses _active_invoices prefetch when available to avoid N+1 queries.
        """
        active_invoices = getattr(obj, '_active_invoices', None)
        if active_invoices is not None:
            return len(active_invoices) > 0
        return obj.billing_invoices.filter(is_deleted=False).exists()

    def get_practitioner_avatar(self, obj) -> str | None:
        """Get practitioner avatar URL from user model with full absolute URL."""
        if obj.practitioner and obj.practitioner.user:
            user = obj.practitioner.user
            avatar = getattr(user, 'avatar', None)
            if avatar:
                request = self.context.get('request')
                if request:
                    if hasattr(avatar, 'url'):
                        return request.build_absolute_uri(avatar.url)
                    return str(avatar)
        return None

    def get_branch_id(self, obj) -> int | None:
        """
        Canonical branch_id for this appointment.
        Priority: practitioner's clinic_branch_id → appointment's clinic_id
        """
        if obj.practitioner:
            branch_id = getattr(obj.practitioner.user, 'clinic_branch_id', None)
            if branch_id:
                return branch_id
        return obj.clinic_id

    def validate(self, data):
        practitioner = data.get('practitioner') or (self.instance.practitioner if self.instance else None)
        service      = data.get('service')      or (self.instance.service      if self.instance else None)

        # ── Auto-set clinic from practitioner's branch ────────────────────────
        if practitioner:
            branch_id = getattr(practitioner.user, 'clinic_branch_id', None)
            if branch_id:
                from apps.clinics.models import Clinic
                try:
                    data['clinic'] = Clinic.objects.get(pk=branch_id)
                except Clinic.DoesNotExist:
                    pass

        # Auto-fill duration from service
        if service and 'duration_minutes' not in data:
            data['duration_minutes'] = service.duration_minutes

        # Validate service belongs to the same clinic group
        request = self.context.get('request')
        if service and request:
            clinic = data.get('clinic') or (self.instance.clinic if self.instance else None)
            if clinic:
                from apps.clinics.models import Clinic as ClinicModel
                main = clinic.main_clinic
                all_branch_ids = list(
                    ClinicModel.objects.filter(
                        models.Q(id=main.id) | models.Q(parent_clinic=main)
                    ).values_list('id', flat=True)
                )
                if service.clinic_id not in all_branch_ids:
                    raise serializers.ValidationError(
                        {'service': 'This service does not belong to your clinic.'}
                    )
        return data


# ── NEW: Restricted edit serializer ──────────────────────────────────────────
class AppointmentEditSerializer(serializers.ModelSerializer):
    """
    Allows editing only the permitted fields on an existing appointment.
    updated_by is set in the view, not from the request body.

    Writable: practitioner, service, chief_complaint, notes,
              patient_notes, arrival_status.
    Read-only extras returned in response: service_name, service_color,
    service_duration, practitioner_name, updated_by_name, updated_at.
    """
    practitioner_name = serializers.SerializerMethodField(read_only=True)
    updated_by_name   = serializers.SerializerMethodField(read_only=True)
    updated_at        = serializers.DateTimeField(read_only=True)

    # ── Service read-only derived fields (returned after save) ─────────────
    service_name     = serializers.CharField(
        source='service.name', read_only=True, allow_null=True
    )
    service_color    = serializers.CharField(
        source='service.color_hex', read_only=True, allow_null=True
    )
    service_duration = serializers.IntegerField(
        source='service.duration_minutes', read_only=True, allow_null=True
    )

    class Meta:
        model  = Appointment
        fields = [
            'id',
            # ── writable ──────────────────────────────────────────────────
            'practitioner',
            'service',
            'chief_complaint',
            'notes',
            'patient_notes',
            'arrival_status',
            # ── read-only derived ─────────────────────────────────────────
            'practitioner_name',
            'service_name',
            'service_color',
            'service_duration',
            'service_overridden',
            'updated_by',
            'updated_by_name',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'practitioner_name',
            'service_name',
            'service_color',
            'service_duration',
            'service_overridden',
            'updated_by',
            'updated_by_name',
            'updated_at',
        ]

    def get_practitioner_name(self, obj):
        if obj.practitioner and obj.practitioner.user:
            return obj.practitioner.user.get_full_name()
        return 'Unassigned'

    def get_updated_by_name(self, obj):
        return obj.updated_by.get_full_name() if obj.updated_by else None


# ── NEW: Cancel appointment serializer ───────────────────────────────────────
class AppointmentCancelSerializer(serializers.Serializer):
    """
    Validates the cancellation payload.
    cancellation_reason is optional.
    """
    cancellation_reason = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=1000,
        default='',
    )


class PractitionerScheduleSerializer(serializers.ModelSerializer):
    practitioner_name = serializers.CharField(
        source='practitioner.user.get_full_name', read_only=True
    )
    location_name = serializers.CharField(source='location.name', read_only=True)
    weekday_display = serializers.CharField(source='get_weekday_display', read_only=True)

    class Meta:
        model  = PractitionerSchedule
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class AppointmentReminderSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AppointmentReminder
        fields = '__all__'
        read_only_fields = ['id', 'sent_at']


class AppointmentPrintSerializer(serializers.ModelSerializer):
    """
    Flat, print-friendly serializer for the Print Appointments feature.
    """
    patient_full_name        = serializers.CharField(source='patient.get_full_name', read_only=True)
    patient_number           = serializers.CharField(source='patient.patient_number', read_only=True)
    patient_phone            = serializers.CharField(source='patient.phone',          read_only=True)
    patient_email            = serializers.CharField(source='patient.email',          read_only=True)
    practitioner_name        = serializers.SerializerMethodField()
    clinic_name              = serializers.CharField(source='clinic.name',            read_only=True)
    clinic_branch_code       = serializers.CharField(source='clinic.branch_code',     read_only=True)
    location_name            = serializers.SerializerMethodField()
    appointment_type_display = serializers.CharField(
        source='get_appointment_type_display', read_only=True
    )
    status_display           = serializers.CharField(source='get_status_display',     read_only=True)
    duration_label           = serializers.SerializerMethodField()

    class Meta:
        model  = Appointment
        fields = [
            'id',
            'date',
            'start_time',
            'end_time',
            'duration_minutes',
            'duration_label',
            'status',
            'status_display',
            'appointment_type',
            'appointment_type_display',
            'patient_full_name',
            'patient_number',
            'patient_phone',
            'patient_email',
            'practitioner_name',
            'clinic_name',
            'clinic_branch_code',
            'location_name',
            'chief_complaint',
            'notes',
            'reminder_sent',
        ]

    def get_practitioner_name(self, obj) -> str:
        if obj.practitioner and obj.practitioner.user:
            return obj.practitioner.user.get_full_name()
        return 'Unassigned'

    def get_location_name(self, obj) -> str:
        if obj.location:
            return obj.location.name
        return obj.clinic.name if obj.clinic else ''

    def get_duration_label(self, obj) -> str:
        mins = obj.duration_minutes or 0
        if mins < 60:
            return f"{mins}min"
        hours, remainder = divmod(mins, 60)
        return f"{hours}h {remainder}min" if remainder else f"{hours}h"


# ── Block Appointment Serializer ─────────────────────────────────────────────────

class BlockAppointmentSerializer(serializers.ModelSerializer):
    """Serializer for Block Appointments (events that block time slots)"""
    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True,
        allow_null=True
    )
    modified_by_name = serializers.CharField(
        source='modified_by.get_full_name',
        read_only=True,
        allow_null=True
    )
    clinic_name = serializers.CharField(source='clinic.name', read_only=True, allow_null=True)
    clinic_branch_id = serializers.IntegerField(source='clinic.id', read_only=True, allow_null=True)
    clinic_branch_name = serializers.CharField(source='clinic.name', read_only=True, allow_null=True)
    
    # Visibility fields
    visible_to_user_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        source='visible_to_users',
        queryset=User.objects.all(),
        required=False,
        allow_empty=True
    )
    visible_to_user_names = serializers.SerializerMethodField()
    participant_practitioner_ids = serializers.SerializerMethodField()

    class Meta:
        model = BlockAppointment
        fields = [
            'id',
            'clinic',
            'clinic_name',
            'clinic_branch_id',
            'clinic_branch_name',
            'practitioner_id',
            'event_name',
            'event_type',
            'date',
            'start_time',
            'end_time',
            'notes',
            'created_by',
            'created_by_name',
            'modified_by',
            'modified_by_name',
            'visibility_type',
            'visible_to_user_ids',
            'visible_to_user_names',
            'participant_practitioner_ids',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'event_type', 'created_by_name', 'modified_by_name',
            'visible_to_user_names', 'participant_practitioner_ids',
            'created_at', 'updated_at',
        ]

    def get_visible_to_user_names(self, obj):
        """Get names of users who can see this block"""
        return [user.get_full_name() for user in obj.visible_to_users.all()]

    def get_participant_practitioner_ids(self, obj):
        """Map visible_to_users (User IDs) → Practitioner IDs.

        The participant selector works with User IDs but the calendar columns
        filter by Practitioner IDs.  This bridging field lets the frontend
        check whether a practitioner column should display a block event
        because the practitioner's user is in the participant list.
        """
        from apps.clinics.models import Practitioner
        user_ids = obj.visible_to_users.values_list('id', flat=True)
        if not user_ids:
            return []
        return list(
            Practitioner.objects.filter(
                user_id__in=user_ids,
                is_deleted=False,
            ).values_list('id', flat=True)
        )

    def validate(self, data):
        start_time = data.get('start_time')
        end_time = data.get('end_time')

        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError({
                'end_time': 'End time must be after start time'
            })

        # Validate visibility - if SELECTED, must have at least one user
        visibility_type = data.get('visibility_type', 'ALL')
        visible_to_users = data.get('visible_to_users', [])
        
        if visibility_type == 'SELECTED' and not visible_to_users:
            raise serializers.ValidationError({
                'visible_to_user_ids': 'Select at least one user when visibility type is "Selected Users"'
            })

        return data


class BlockAppointmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating Block Appointments - used in POST/PUT requests"""
    
    visible_to_user_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        source='visible_to_users',
        queryset=User.objects.all(),
        required=False,
        allow_empty=True
    )

    class Meta:
        model = BlockAppointment
        fields = [
            'clinic',
            'practitioner',
            'event_name',
            'date',
            'start_time',
            'end_time',
            'notes',
            'visibility_type',
            'visible_to_user_ids',
        ]

    def validate(self, data):
        start_time = data.get('start_time')
        end_time = data.get('end_time')

        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError({
                'end_time': 'End time must be after start time'
            })

        # Validate visibility - if SELECTED, must have at least one user
        visibility_type = data.get('visibility_type', 'ALL')
        visible_to_users = data.get('visible_to_users', [])
        
        if visibility_type == 'SELECTED' and not visible_to_users:
            raise serializers.ValidationError({
                'visible_to_user_ids': 'Select at least one user when visibility type is "Selected Users"'
            })

        return data

    def create(self, validated_data):
        """Create block appointment and properly set visible_to_users M2M field"""
        visible_to_users = validated_data.pop('visible_to_users', [])
        visibility_type = validated_data.get('visibility_type', 'ALL')
        request = self.context.get('request')
        creator = getattr(request, 'user', None)
        
        instance = BlockAppointment.objects.create(**validated_data)
        
        # Handle visibility based on type
        if visibility_type == 'SELF':
            # Myself Only — store only the creator.
            if creator and creator.is_authenticated:
                instance.visible_to_users.set([creator])
            else:
                instance.visible_to_users.clear()
        elif visibility_type == 'SELECTED':
            # Selected Users — always include creator plus selected users.
            users_to_set = list(visible_to_users) if visible_to_users else []
            if creator and creator.is_authenticated:
                users_to_set.append(creator)

            # Deduplicate by user id before persisting.
            unique_users = {user.id: user for user in users_to_set if getattr(user, 'id', None)}
            instance.visible_to_users.set(unique_users.values())
        else:
            # ALL — visible to everyone; no need to track individual users.
            instance.visible_to_users.clear()

        return instance

    def update(self, instance, validated_data):
        """Update block appointment and properly set visible_to_users M2M field"""
        visible_to_users = validated_data.pop('visible_to_users', None)
        visibility_type = validated_data.get('visibility_type', instance.visibility_type)
        request = self.context.get('request')
        request_user = getattr(request, 'user', None)
        creator = instance.created_by or request_user

        # Update all other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()

        # Handle visibility based on type
        if visibility_type == 'SELF':
            # Myself Only — keep only the creator.
            if creator and getattr(creator, 'is_authenticated', False):
                instance.visible_to_users.set([creator])
            else:
                instance.visible_to_users.clear()
        elif visibility_type == 'SELECTED':
            # Selected Users — enforce creator inclusion and keep user edits.
            users_to_set = list(visible_to_users) if visible_to_users is not None else list(instance.visible_to_users.all())
            if creator and getattr(creator, 'is_authenticated', False):
                users_to_set.append(creator)

            # Deduplicate by user id before persisting.
            unique_users = {user.id: user for user in users_to_set if getattr(user, 'id', None)}
            instance.visible_to_users.set(unique_users.values())
        else:
            # ALL — visible to everyone; no need to track individual users.
            instance.visible_to_users.clear()


# ── Calendar Note Serializer ──────────────────────────────────────────────────

class CalendarNoteSerializer(serializers.ModelSerializer):
    created_by_name  = serializers.SerializerMethodField()
    modified_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = CalendarNote
        fields = [
            'id', 'clinic',
            'date', 'start_time', 'end_time',
            'message',
            'practitioner',
            'created_by', 'created_by_name',
            'modified_by', 'modified_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'created_by', 'modified_by',
            'created_at', 'updated_at',
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.email
        return None

    def get_modified_by_name(self, obj):
        if obj.modified_by:
            return obj.modified_by.get_full_name() or obj.modified_by.email
        return None

        return instance