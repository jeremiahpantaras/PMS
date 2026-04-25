from rest_framework import serializers
from .models import Clinic, Practitioner, Location
from apps.common.validators import normalize_ph_phone, validate_ph_phone
from django.core.exceptions import ValidationError as DjangoValidationError
import logging

logger = logging.getLogger(__name__)


class ClinicBranchSerializer(serializers.ModelSerializer):
    """Lightweight serializer for clinic branches"""

    is_branch   = serializers.BooleanField(read_only=True)
    parent_name = serializers.CharField(source='parent_clinic.name', read_only=True)

    class Meta:
        model  = Clinic
        fields = [
            'id', 'name', 'branch_code', 'is_main_branch', 'is_branch',
            'parent_clinic', 'parent_name', 'is_active', 'city', 'province',
            'email', 'phone', 'address', 'postal_code', 'website', 'tin',
            'custom_location', 'latitude', 'longitude',
            'email_notifications_enabled', 'sms_notifications_enabled',
        ]
        read_only_fields = ['id', 'branch_code', 'is_branch', 'parent_name']


class ClinicSerializer(serializers.ModelSerializer):
    branches         = ClinicBranchSerializer(many=True, read_only=True)
    is_branch        = serializers.BooleanField(read_only=True)
    main_clinic_name = serializers.CharField(source='main_clinic.name', read_only=True)
    logo_url         = serializers.SerializerMethodField()

    class Meta:
        model  = Clinic
        fields = '__all__'
        read_only_fields = [
            'id', 'branch_code', 'created_at', 'updated_at',
            'is_branch', 'main_clinic_name',
        ]

    def get_logo_url(self, obj) -> str | None:
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None



class ClinicProfileSetupSerializer(serializers.ModelSerializer):
    """
    Used exclusively for the initial clinic profile setup.
    - name, email, phone are required.
    - At least one of: address+city+province OR custom_location must be provided.
    - latitude/longitude are optional (set when map pin is placed).
    - timezone, tin, philhealth_accreditation are managed elsewhere.
    """

    email       = serializers.EmailField(required=True)
    phone       = serializers.CharField(max_length=20)
    remove_logo = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model  = Clinic
        fields = [
            'name', 'email', 'phone',
            'address', 'city', 'province', 'postal_code',
            'custom_location',
            'latitude', 'longitude',
            'website', 'logo', 'remove_logo',
            'email_notifications_enabled', 'sms_notifications_enabled',
        ]

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Clinic name cannot be blank.")
        return value.strip()

    def validate_email(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Clinic email is required.")
        return value.lower().strip()

    def validate_phone(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Clinic phone number is required.")
        try:
            validate_ph_phone(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.message)
        return normalize_ph_phone(value)

    def validate(self, attrs):
        has_standard  = attrs.get('address', '').strip() and attrs.get('city', '').strip() and attrs.get('province', '').strip()
        has_custom    = attrs.get('custom_location', '').strip()
        if not has_standard and not has_custom:
            raise serializers.ValidationError(
                "Provide a street address + city + province, or enter a custom location."
            )
        return attrs

    def update(self, instance, validated_data):
        remove_logo = validated_data.pop('remove_logo', False)
        if remove_logo and instance.logo:
            instance.logo.delete(save=True)

        new_name = validated_data.get('name')
        if new_name and new_name != instance.name:
            old_name = instance.name
            old_prefix = old_name + ' - '
            branches = Clinic.objects.filter(parent_clinic=instance)
            for branch in branches:
                if branch.name.startswith(old_prefix):
                    suffix = branch.name[len(old_prefix):]
                    branch.name = new_name + ' - ' + suffix
                else:
                    branch.name = new_name
                branch.save(update_fields=['name'])
            logger.info(f"Updated clinic name '{old_name}' -> '{new_name}' for {branches.count()} branches")

        return super().update(instance, validated_data)



class PractitionerSerializer(serializers.ModelSerializer):
    user_name  = serializers.CharField(source='user.get_full_name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    availability = serializers.SerializerMethodField()

    class Meta:
        model  = Practitioner
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_availability(self, obj):
        return obj.availability

    def validate_duty_days(self, value):
        valid_days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        if not isinstance(value, list):
            raise serializers.ValidationError("duty_days must be a list.")
        for day in value:
            if day not in valid_days:
                raise serializers.ValidationError(f"Invalid day: {day}. Must be one of {valid_days}")
        return value

    def validate(self, attrs):
        duty_start = attrs.get('duty_start_time') or (self.instance.duty_start_time if self.instance else None)
        duty_end = attrs.get('duty_end_time') or (self.instance.duty_end_time if self.instance else None)
        lunch_start = attrs.get('lunch_start_time') or (self.instance.lunch_start_time if self.instance else None)
        lunch_end = attrs.get('lunch_end_time') or (self.instance.lunch_end_time if self.instance else None)

        if duty_start and duty_end:
            if duty_start >= duty_end:
                raise serializers.ValidationError({
                    'duty_end_time': 'Duty end time must be after duty start time.'
                })

        if lunch_start and lunch_end and duty_start and duty_end:
            if lunch_start >= lunch_end:
                raise serializers.ValidationError({
                    'lunch_end_time': 'Lunch end time must be after lunch start time.'
                })
            if not (duty_start <= lunch_start and lunch_end <= duty_end):
                raise serializers.ValidationError({
                    'lunch_start_time': 'Lunch must be within duty hours.'
                })

        return attrs


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Location
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']