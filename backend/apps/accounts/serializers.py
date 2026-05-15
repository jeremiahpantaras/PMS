from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
import logging
from .models import User, Role, Permission, PermissionGroup, FeaturePermission, FEATURE_KEYS, ROLE_PRIORITY, _union_permissions
from apps.clinics.models import Practitioner
from apps.common.validators import normalize_ph_phone, validate_ph_phone
from django.core.exceptions import ValidationError as DjangoValidationError

logger = logging.getLogger(__name__)


# ── RBAC Serializers ──────────────────────────────────────────────────────────

class FeaturePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = FeaturePermission
        fields = ['id', 'feature_key', 'access_level']


class PermissionGroupSerializer(serializers.ModelSerializer):
    feature_permissions = FeaturePermissionSerializer(many=True, read_only=True)
    member_count        = serializers.SerializerMethodField()
    permissions_map     = serializers.SerializerMethodField()

    class Meta:
        model  = PermissionGroup
        fields = [
            'id', 'name', 'description', 'role_template',
            'is_protected', 'is_system_template',
            'clinic', 'feature_permissions', 'permissions_map',
            'member_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_system_template']

    def get_member_count(self, obj) -> int:
        return obj.users.filter(is_deleted=False).count()

    def get_permissions_map(self, obj) -> dict:
        """Return a flat {feature_key: access_level} dict for UI consumption."""
        return obj.get_permissions_dict()


class PermissionGroupWriteSerializer(serializers.ModelSerializer):
    """Used for create/update — accepts `permissions` as a dict."""
    permissions = serializers.DictField(
        child=serializers.ChoiceField(choices=['none', 'view', 'edit']),
        required=False,
        write_only=True,
    )

    class Meta:
        model  = PermissionGroup
        fields = ['name', 'description', 'role_template', 'is_protected', 'clinic', 'permissions']

    def validate_permissions(self, value):
        invalid = [k for k in value if k not in FEATURE_KEYS]
        if invalid:
            raise serializers.ValidationError(
                f"Unknown feature keys: {invalid}. Valid keys: {FEATURE_KEYS}"
            )
        return value

    def create(self, validated_data):
        permissions = validated_data.pop('permissions', {})
        group = PermissionGroup.objects.create(**validated_data)
        for feature_key, access_level in permissions.items():
            FeaturePermission.objects.create(
                group=group,
                feature_key=feature_key,
                access_level=access_level,
            )
        return group

    def update(self, instance, validated_data):
        permissions = validated_data.pop('permissions', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if permissions is not None:
            # Atomically replace ALL feature permissions so stale records
            # from previous saves can never linger.
            with transaction.atomic():
                instance.feature_permissions.all().delete()
                FeaturePermission.objects.bulk_create([
                    FeaturePermission(
                        group=instance,
                        feature_key=feature_key,
                        access_level=access_level,
                    )
                    for feature_key, access_level in permissions.items()
                ])
        return instance


class UserSerializer(serializers.ModelSerializer):
    password               = serializers.CharField(write_only=True, required=False, validators=[validate_password])
    needs_password_change  = serializers.BooleanField(read_only=True)
    clinic_branch_name     = serializers.SerializerMethodField()
    avatar_url             = serializers.SerializerMethodField()
    phone                  = serializers.CharField(max_length=20, required=False, allow_blank=True)

    # ── NEW: expose whether the admin has completed clinic setup ──────────────
    clinic_setup_complete  = serializers.SerializerMethodField()

    # ── RBAC: permission group + flat permissions map ─────────────────────────
    permission_group_name  = serializers.SerializerMethodField()
    permissions_map        = serializers.SerializerMethodField()

    # ── Multi-Role: writable list of role slugs ───────────────────────────────
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=[r for r, _ in User.ROLE_CHOICES]),
        required=False,
        allow_empty=False,
        help_text='All roles assigned to this user. Must contain at least one entry.',
    )

    # ── Practitioner availability fields ─────────────────────────────────────────
    duty_days        = serializers.ListField(child=serializers.CharField(), required=False)
    duty_start_time  = serializers.CharField(required=False, allow_blank=True)
    duty_end_time    = serializers.CharField(required=False, allow_blank=True)
    lunch_start_time = serializers.CharField(required=False, allow_blank=True)
    lunch_end_time   = serializers.CharField(required=False, allow_blank=True)
    # Split-shift schedule (both PRACTITIONER and STAFF)
    duty_schedule    = serializers.JSONField(required=False, allow_null=True)

    # ── Position and discipline ──────────────────────────────────────────────
    position         = serializers.CharField(required=False, allow_blank=True)
    discipline       = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model  = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'role', 'roles', 'phone',
            'avatar', 'avatar_url', 'is_active', 'clinic', 'clinic_branch', 'clinic_branch_name',
            'created_at', 'password', 'password_changed', 'needs_password_change',
            'must_change_password',
            'clinic_setup_complete',
            'password_rotation', 'last_password_change',
            # RBAC
            'permission_group', 'permission_group_name', 'permissions_map',
            # Position (for all staff)
            'position',
            # Availability fields (legacy single block)
            'duty_days', 'duty_start_time', 'duty_end_time', 'lunch_start_time', 'lunch_end_time',
            # Split-shift schedule
            'duty_schedule',
            # Discipline (for PRACTITIONER)
            'discipline',
        ]
        read_only_fields = ['id', 'created_at', 'password_changed', 'must_change_password']

    def get_permission_group_name(self, obj) -> str | None:
        if obj.permission_group_id:
            return obj.permission_group.name
        return None

    def get_permissions_map(self, obj) -> dict:
        """
        Return a flat {feature_key: access_level} dict.

        Resolution order:
        1. ADMIN in roles → all 'edit'.
        2. permission_group assigned → use the group's explicit matrix.
        3. Fallback → union of DEFAULT_PERMISSIONS across all assigned roles.
        """
        effective_roles = obj.get_effective_roles()
        if 'ADMIN' in effective_roles:
            return {key: 'edit' for key in FEATURE_KEYS}
        if obj.permission_group_id:
            return obj.permission_group.get_permissions_dict()
        # Union fallback
        return _union_permissions(effective_roles)

    def get_avatar_url(self, obj) -> str | None:
        """Return the full URL for the avatar image."""
        request = self.context.get('request')
        if not obj.avatar:
            return None

        # Cloudinary already returns an absolute URL; local storage returns /media/...
        avatar_url = obj.avatar.url
        if request:
            return request.build_absolute_uri(avatar_url)
        return avatar_url

    def get_clinic_branch_name(self, obj) -> str | None:
        if obj.clinic_branch:
            return obj.clinic_branch.name
        return None

    def get_clinic_setup_complete(self, obj) -> bool:
        """
        Returns True if the user's main clinic has completed setup.
        Non-admin users always see True (they don't do setup).
        """
        if not obj.is_admin:
            return True
        if obj.clinic:
            return obj.clinic.main_clinic.setup_complete
        return False

    def to_representation(self, instance):
        """Add practitioner/staff availability, discipline, and practitioner_id to the serialized output."""
        data = super().to_representation(instance)
        effective_roles = instance.get_effective_roles()

        if 'PRACTITIONER' in effective_roles:
            try:
                practitioner = instance.practitioner_profile
                if practitioner and not practitioner.is_deleted:
                    data['practitioner_id']  = practitioner.id
                    data['duty_days']        = practitioner.duty_days or ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
                    data['duty_start_time']  = practitioner.duty_start_time.strftime('%H:%M') if practitioner.duty_start_time else '08:00'
                    data['duty_end_time']    = practitioner.duty_end_time.strftime('%H:%M') if practitioner.duty_end_time else '17:00'
                    data['lunch_start_time'] = practitioner.lunch_start_time.strftime('%H:%M') if practitioner.lunch_start_time else '12:00'
                    data['lunch_end_time']   = practitioner.lunch_end_time.strftime('%H:%M') if practitioner.lunch_end_time else '13:00'
                    data['duty_schedule']    = practitioner.duty_schedule
                    data['discipline']       = practitioner.discipline or 'OCCUPATIONAL_THERAPY'
                else:
                    # Profile missing or soft-deleted — surface whatever is stored on the User model
                    # so the frontend always gets a non-empty discipline for prefill.
                    data['discipline'] = instance.discipline or 'OCCUPATIONAL_THERAPY'
            except Exception as exc:
                logger.warning(
                    "UserSerializer.to_representation: could not load practitioner profile for user %s: %s",
                    instance.pk, exc,
                )
                # Graceful fallback: use the User-level discipline field so the
                # frontend is never handed an empty string for an ADMIN+PRACTITIONER.
                data['discipline'] = instance.discipline or 'OCCUPATIONAL_THERAPY'
        elif 'STAFF' in effective_roles:
            # Expose Staff availability stored directly on the User model
            data['duty_days']        = instance.duty_days or []
            data['duty_start_time']  = ''
            data['duty_end_time']    = ''
            data['lunch_start_time'] = instance.lunch_start_time or '12:00'
            data['lunch_end_time']   = instance.lunch_end_time or '13:00'
            data['duty_schedule']    = instance.duty_schedule
            data['discipline']       = instance.discipline or ''
        return data

    def validate_email(self, value):
        """Normalize email to lowercase for consistent storage and lookups."""
        return value.strip().lower()

    def validate_clinic_branch(self, value):
        if value is None:
            return value
        request = self.context.get('request')
        if request and request.user and request.user.clinic:
            main_clinic = request.user.clinic.main_clinic
            if value.id != main_clinic.id and value.parent_clinic_id != main_clinic.id:
                raise serializers.ValidationError(
                    "The selected branch does not belong to your clinic."
                )
        return value

    def _validate_duty_schedule(self, schedule):
        """Validate duty_schedule structure and check for overlaps."""
        valid_days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        if not isinstance(schedule, dict):
            raise serializers.ValidationError(
                {'duty_schedule': 'duty_schedule must be an object mapping day names to lists of blocks.'}
            )
        for day, blocks in schedule.items():
            if day not in valid_days:
                raise serializers.ValidationError(
                    {'duty_schedule': f'Invalid day key: {day}. Must be one of {valid_days}.'}
                )
            if not isinstance(blocks, list):
                raise serializers.ValidationError(
                    {'duty_schedule': f'Blocks for {day} must be a list.'}
                )
            sorted_blocks = sorted(blocks, key=lambda b: b.get('start', ''))
            for i, block in enumerate(sorted_blocks):
                if 'start' not in block or 'end' not in block:
                    raise serializers.ValidationError(
                        {'duty_schedule': f'Each block in {day} must have "start" and "end" keys.'}
                    )
                if block['start'] >= block['end']:
                    raise serializers.ValidationError(
                        {'duty_schedule': f'{day}: block start ({block["start"]}) must be before end ({block["end"]}).'}
                    )
                if i > 0:
                    prev = sorted_blocks[i - 1]
                    if block['start'] < prev['end']:
                        raise serializers.ValidationError(
                            {'duty_schedule': f'{day}: overlapping blocks ({prev["start"]}–{prev["end"]} and {block["start"]}–{block["end"]}).'}
                        )

    def validate(self, attrs):
        duty_schedule = attrs.get('duty_schedule')
        if duty_schedule is not None:
            self._validate_duty_schedule(duty_schedule)

        duty_days = attrs.get('duty_days')
        if duty_days is not None:
            valid_days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            if not isinstance(duty_days, list):
                raise serializers.ValidationError({"duty_days": "duty_days must be a list."})
            for day in duty_days:
                if day not in valid_days:
                    raise serializers.ValidationError(
                        {"duty_days": f"Invalid day: {day}. Must be one of {valid_days}"}
                    )

        # Only validate legacy single-block times when duty_schedule is NOT provided
        if not duty_schedule:
            duty_start  = attrs.get('duty_start_time')
            duty_end    = attrs.get('duty_end_time')
            lunch_start = attrs.get('lunch_start_time')
            lunch_end   = attrs.get('lunch_end_time')

            if duty_start and duty_end:
                if duty_start >= duty_end:
                    raise serializers.ValidationError({
                        'duty_end_time': 'Duty end time must be after duty start time.'
                    })

            if lunch_start and lunch_end:
                if lunch_start >= lunch_end:
                    raise serializers.ValidationError({
                        'lunch_end_time': 'Lunch end time must be after lunch start time.'
                    })

        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        # Ensure roles is set; derive from role if absent.
        roles = validated_data.get('roles')
        role  = validated_data.get('role', 'STAFF')
        if not roles:
            validated_data['roles'] = [role]

        # Pop fields that do not exist on the User model (Practitioner handles them)
        for field in ['duty_start_time', 'duty_end_time']:
            validated_data.pop(field, None)

        # duty_days, lunch_start_time, lunch_end_time, duty_schedule are columns on User
        # so they stay in validated_data and are set directly.

        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)

        # Fields that live on the Practitioner model (not User) — pull them out
        practitioner_only_fields = ['duty_start_time', 'duty_end_time', 'discipline']
        practitioner_data = {}
        for field in practitioner_only_fields:
            if field in validated_data:
                practitioner_data[field] = validated_data.pop(field)

        # duty_days, lunch_*, duty_schedule live on User for STAFF and on Practitioner for PRACTITIONER
        shared_availability = {}
        for field in ['duty_days', 'lunch_start_time', 'lunch_end_time', 'duty_schedule']:
            if field in validated_data:
                shared_availability[field] = validated_data.pop(field)

        # Determine effective roles BEFORE calling instance.save(), because the
        # User.save() override normalises instance.role to the highest-priority
        # entry in instance.roles (e.g. ADMIN beats PRACTITIONER).  Using
        # instance.role *after* save would therefore always resolve to 'ADMIN'
        # for Admin+Practitioner users, preventing their schedule from syncing.
        incoming_roles = validated_data.get('roles', None)
        effective_roles_after = (
            incoming_roles
            if isinstance(incoming_roles, list) and incoming_roles
            else instance.get_effective_roles()
        )

        # Update User fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Store availability on User for STAFF-only users (not combined with PRACTITIONER)
        if 'STAFF' in effective_roles_after and 'PRACTITIONER' not in effective_roles_after:
            for field, value in shared_availability.items():
                setattr(instance, field, value)
            if 'discipline' in practitioner_data:
                instance.discipline = practitioner_data['discipline']

        if password:
            instance.set_password(password)
            instance.password_changed = True
        instance.save()

        # Sync Practitioner availability fields when PRACTITIONER is in effective roles.
        # This handles pure-PRACTITIONER AND Admin+Practitioner users correctly.
        if 'PRACTITIONER' in effective_roles_after:
            try:
                practitioner = instance.practitioner_profile
                if practitioner and not practitioner.is_deleted:
                    import json
                    update_data = {}
                    if 'duty_days' in shared_availability:
                        duty_days = shared_availability['duty_days']
                        if isinstance(duty_days, str):
                            try:
                                duty_days = json.loads(duty_days)
                            except (json.JSONDecodeError, ValueError):
                                duty_days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
                        update_data['duty_days'] = duty_days
                    if 'duty_start_time' in practitioner_data:
                        update_data['duty_start_time'] = practitioner_data['duty_start_time']
                    if 'duty_end_time' in practitioner_data:
                        update_data['duty_end_time'] = practitioner_data['duty_end_time']
                    for f in ['lunch_start_time', 'lunch_end_time', 'duty_schedule']:
                        if f in shared_availability:
                            update_data[f] = shared_availability[f]
                    if 'discipline' in practitioner_data:
                        # Only overwrite when a non-empty value is provided so that
                        # an empty-string payload (caused by a frontend prefill miss)
                        # does not silently erase a previously saved discipline.
                        incoming_discipline = practitioner_data['discipline']
                        if incoming_discipline:
                            update_data['discipline'] = incoming_discipline
                        else:
                            # Fall back to keep existing value; use default only if
                            # the practitioner record itself has no discipline yet.
                            if not practitioner.discipline:
                                update_data['discipline'] = 'OCCUPATIONAL_THERAPY'

                    if update_data:
                        Practitioner.objects.filter(pk=practitioner.pk).update(**update_data)
                        # Mirror discipline on the User model so to_representation always
                        # has a fallback even when the practitioner reverse accessor fails.
                        if 'discipline' in update_data:
                            User.objects.filter(pk=instance.pk).update(
                                discipline=update_data['discipline']
                            )
                        instance.__dict__.pop('practitioner_profile', None)
            except Exception as exc:
                logger.warning(
                    "UserSerializer.update: could not sync practitioner profile for user %s: %s",
                    instance.pk, exc,
                )

        return instance


class AdminRegistrationSerializer(serializers.Serializer):
    first_name   = serializers.CharField(max_length=150, required=True)
    last_name    = serializers.CharField(max_length=150, required=True)
    company_name = serializers.CharField(max_length=255, required=True)
    email        = serializers.EmailField(required=True)
    phone        = serializers.CharField(max_length=15, required=False, allow_blank=True)

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate_phone(self, value):
        if value:
            try:
                validate_ph_phone(value)
            except DjangoValidationError as e:
                raise serializers.ValidationError(e.message)
            return normalize_ph_phone(value)
        return value


class UserRegistrationSerializer(serializers.ModelSerializer):
    password         = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model  = User
        fields = ['email', 'first_name', 'last_name', 'password', 'password_confirm', 'role', 'phone']

    def validate_email(self, value):
        """Normalize email to lowercase for consistent storage and lookups."""
        return value.strip().lower()

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user     = User.objects.create(**validated_data)
        user.set_password(password)
        user.password_changed = True
        user.save()
        return user


class PasswordChangeSerializer(serializers.Serializer):
    old_password         = serializers.CharField(required=True, write_only=True)
    new_password         = serializers.CharField(required=True, write_only=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({"new_password": "Password fields didn't match."})
        return attrs

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Permission
        fields = '__all__'


class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)

    class Meta:
        model  = Role
        fields = '__all__'