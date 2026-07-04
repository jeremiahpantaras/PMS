from rest_framework import serializers
from .models import ClinicalTemplate, ClinicalNote, ClinicalNoteAuditLog
from django.utils import timezone
from django.db import models
from apps.appointments.models import Appointment


class ClinicalTemplateSerializer(serializers.ModelSerializer):
    """Serializer for clinical templates"""
    
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    is_latest_version = serializers.SerializerMethodField()
    clinic_branch_name = serializers.CharField(source='clinic_branch.name', read_only=True, default=None)
    
    class Meta:
        model = ClinicalTemplate
        fields = [
            'id', 'clinic', 'created_by', 'created_by_name',
            'name', 'description', 'category', 'discipline',
            'clinic_branch', 'clinic_branch_name', 'structure',
            'version', 'parent_template', 'is_active', 'is_archived',
            'is_latest_version', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'version',
            'clinic',       # ✅ ADD - set automatically from request.user
            'created_by',   # ✅ ADD - set automatically from request.user
        ]
    
    def get_is_latest_version(self, obj):
        """Check if this is the latest version of the template"""
        if not obj.parent_template:
            # Check if there are newer versions
            return not ClinicalTemplate.objects.filter(
                parent_template=obj
            ).exists()
        
        # If this has a parent, check if any sibling versions are newer
        latest = ClinicalTemplate.objects.filter(
            parent_template=obj.parent_template
        ).order_by('-version').first()
        
        return latest.id == obj.id if latest else True
    
    def validate_structure(self, value):
        """Validate template structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError('Structure must be a JSON object')
        
        if 'sections' not in value:
            raise serializers.ValidationError('Structure must contain "sections" key')
        
        if not isinstance(value['sections'], list):
            raise serializers.ValidationError('Sections must be an array')
        
        return value
    
    def create(self, validated_data):
        """Auto-set clinic from request user"""
        request = self.context.get('request')
        if request and request.user:
            validated_data['clinic'] = request.user.clinic
            validated_data['created_by'] = request.user
        
        return super().create(validated_data)


class ClinicalNoteSerializer(serializers.ModelSerializer):
    """
    Serializer for clinical notes with automatic encryption/decryption.
    
    Architecture Decision:
    - 'content' field is virtual (not stored directly)
    - Encryption happens transparently in to_representation/create/update
    """
    
    patient_name = serializers.CharField(source='patient.get_full_name', read_only=True)
    practitioner_name = serializers.CharField(source='practitioner.user.get_full_name', read_only=True)
    practitioner_avatar = serializers.SerializerMethodField()
    template_name = serializers.CharField(source='template.name', read_only=True)
    content = serializers.JSONField(write_only=True, required=False, allow_null=True, default={})  # Accepts plain JSON, encrypts internally
    decrypted_content = serializers.SerializerMethodField()
    
    # Include appointment details in the response
    appointment_date = serializers.DateField(source='appointment.date', read_only=True)
    appointment_time = serializers.TimeField(source='appointment.start_time', read_only=True)
    appointment_service = serializers.CharField(source='appointment.service_name', read_only=True)
    appointment_practitioner = serializers.CharField(source='appointment.practitioner_name', read_only=True)
    
    class Meta:
        model = ClinicalNote
        fields = [
            'id', 'patient', 'patient_name', 'practitioner', 'practitioner_name', 'practitioner_avatar',
            'appointment', 'appointment_date', 'appointment_time', 'appointment_service', 'appointment_practitioner',
            'clinic', 'template', 'template_name', 'template_version', 'patient_case',
            'date', 'note_type', 'is_signed', 'signed_at', 'is_draft', 'last_autosave',
            'content', 'decrypted_content', 'chart_annotation_data', 'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'content': {'required': False, 'allow_null': True, 'default': {}},
            'patient': {'required': True},
            'practitioner': {'required': False},  # Not required - can be derived from appointment
            'clinic': {'required': False},  # Not required - can be derived from appointment
            'appointment': {'required': True},  # Required - each note must be linked to an appointment
            'template': {'required': True},
            'date': {'required': True},
            'patient_case': {'required': False, 'allow_null': True},
        }
        read_only_fields = [
            'id', 'signed_at', 'last_autosave', 'created_at', 'updated_at',
            'template_version', 'is_signed'
        ]
    
    def get_practitioner_avatar(self, obj) -> str | None:
        """Get practitioner avatar URL from user model."""
        if obj.practitioner and obj.practitioner.user:
            user = obj.practitioner.user
            avatar = getattr(user, 'avatar', None)
            if avatar:
                request = self.context.get('request')
                if request and hasattr(avatar, 'url'):
                    return request.build_absolute_uri(avatar.url)
                elif hasattr(avatar, 'url'):
                    return avatar.url
                return str(avatar)
        return None

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f'[ClinicalNote] Response: {representation}')
        return representation
    
    def validate(self, attrs):
        """Auto-populate clinic and practitioner from appointment if not provided"""
        request = self.context.get('request')
        
        # Get the appointment - could be an ID or object
        appointment = attrs.get('appointment')
        
        # If appointment is just an ID, fetch the actual object
        if appointment and isinstance(appointment, int):
            from apps.appointments.models import Appointment
            try:
                appointment = Appointment.objects.get(pk=appointment)
                print(f'[ClinicalNoteSerializer] Fetched appointment: {appointment.id}, clinic: {appointment.clinic}')
            except Appointment.DoesNotExist:
                print('[ClinicalNoteSerializer] Appointment not found!')
                pass
        
        if not appointment and getattr(self.instance, 'appointment', None):
            appointment = self.instance.appointment
            
        if appointment:
            # Check if a clinical note already exists for this appointment
            existing_note = ClinicalNote.objects.filter(
                appointment=appointment,
                is_deleted=False
            ).exists()
            
            # If creating a new note (not updating) and note already exists for this appointment
            if not self.instance and existing_note:
                raise serializers.ValidationError(
                    {'detail': 'A clinical note already exists for this appointment. Please edit the existing note instead.'}
                )

            # If it's an ID, fetch the object
            if isinstance(appointment, int) or isinstance(appointment, str):
                try:
                    appointment = Appointment.objects.get(id=appointment)
                except Appointment.DoesNotExist:
                    raise serializers.ValidationError({'appointment': 'Invalid appointment ID'})
            
            # Auto-populate practitioner if missing
            if not attrs.get('practitioner') and hasattr(appointment, 'practitioner'):
                attrs['practitioner'] = appointment.practitioner
            # Auto-populate clinic from appointment if missing
            if not attrs.get('clinic') and hasattr(appointment, 'clinic'):
                attrs['clinic'] = appointment.clinic
            # Auto-populate patient from appointment if not provided
            if not attrs.get('patient') and hasattr(appointment, 'patient'):
                attrs['patient'] = appointment.patient
            # Auto-populate date from appointment if not provided
            if not attrs.get('date') and hasattr(appointment, 'date'):
                attrs['date'] = appointment.date
        
        if request and request.user:
            # Auto-set clinic from user if still not set
            if not attrs.get('clinic') and hasattr(request.user, 'clinic'):
                attrs['clinic'] = request.user.clinic
            # All clinical notes are final - no draft status needed
            if 'is_draft' not in attrs:
                attrs['is_draft'] = False
            # Auto-set note_type to 'CLINICAL' if not provided
            if 'note_type' not in attrs:
                attrs['note_type'] = 'CLINICAL'
            # Auto-set template_version from template
            if attrs.get('template') and not attrs.get('template_version'):
                attrs['template_version'] = attrs['template'].version
        
        # Determine if content was explicitly provided in this request
        has_content = False
        final_content = None
        
        if 'content' in attrs:
            final_content = attrs.pop('content') # Remove from attrs to avoid DRF internal issues
            has_content = True
        elif hasattr(self, 'initial_data') and 'content' in self.initial_data:
            final_content = self.initial_data['content']
            has_content = True

        validated = super().validate(attrs)
        
        # Only inject extracted_content if it was actually provided!
        # This prevents PATCH requests (like assign to case) from overwriting with {}
        if has_content:
            import json
            try:
                # Deep copy by JSON serialize/deserialize
                final_content = json.loads(json.dumps(final_content))
            except Exception:
                pass
            validated['extracted_content'] = final_content if final_content is not None else {}
            
        return validated
    
    def get_decrypted_content(self, obj):
        """Return decrypted content (only if user has permission)"""
        request = self.context.get('request')
        
        # Security check: Only return content to authorized users
        if request and request.user:
            # Allow practitioner, admins, or same-clinic staff
            if (obj.practitioner.user == request.user or 
                request.user.is_admin or 
                (request.user.clinic == obj.clinic and request.user.is_staff)):
                return obj.content
        
        return None
    
    def _apply_content(self, instance, content):
        """Helper to apply content payload uniformly across create and update"""
        if content is not None:
            cleaned_content, chart_annotation_data = self._extract_chart_annotations(content)
            instance.set_content(cleaned_content)
            instance.last_autosave = timezone.now()
            
            # Explicitly set chart annotation data, even if empty dict, 
            # so that it clears out removed strokes.
            if chart_annotation_data or chart_annotation_data == {}:
                instance.chart_annotation_data = chart_annotation_data

    def create(self, validated_data):
        """Create note with encrypted content"""
        # Pop the content that we safely extracted in validate()
        content = validated_data.pop('extracted_content', {})
        # Also pop 'content' just in case DRF left it there
        validated_data.pop('content', None)
        
        print(f'\n{"="*60}')
        print(f'[CREATE TRACE] Step 5: Inside create()')
        print(f'[CREATE TRACE]   content type={type(content).__name__}')
        if isinstance(content, dict):
            print(f'[CREATE TRACE]   content keys={list(content.keys())}')
            print(f'[CREATE TRACE]   content key count={len(content)}')
            for k, v in content.items():
                vtype = type(v).__name__
                vpreview = repr(v)[:100] if not isinstance(v, dict) else f'dict with keys {list(v.keys())}'
                print(f'[CREATE TRACE]   content["{k}"] = ({vtype}) {vpreview}')
        else:
            print(f'[CREATE TRACE]   content value={repr(content)[:200]}')
        print(f'{"="*60}\n')
        
        # Auto-populate fields from appointment if not set
        appointment = validated_data.get('appointment')
        if appointment:
            # Fetch the appointment object if it's not already loaded
            if hasattr(appointment, 'practitioner'):
                # Already loaded
                if not validated_data.get('practitioner'):
                    validated_data['practitioner'] = appointment.practitioner
                if not validated_data.get('clinic'):
                    validated_data['clinic'] = appointment.clinic
                if not validated_data.get('patient'):
                    validated_data['patient'] = appointment.patient
                if not validated_data.get('date'):
                    validated_data['date'] = appointment.date
            else:
                # Need to fetch from database
                try:
                    appt = Appointment.objects.select_related('practitioner', 'clinic', 'patient').get(pk=appointment)
                    if not validated_data.get('practitioner'):
                        validated_data['practitioner'] = appt.practitioner
                    if not validated_data.get('clinic'):
                        validated_data['clinic'] = appt.clinic
                    if not validated_data.get('patient'):
                        validated_data['patient'] = appt.patient
                    if not validated_data.get('date'):
                        validated_data['date'] = appt.date
                except Appointment.DoesNotExist:
                    pass
        
        # Auto-populate fields from request user
        request = self.context.get('request')
        if request and request.user:
            # Ensure clinic is set from user
            if not validated_data.get('clinic') and hasattr(request.user, 'clinic'):
                validated_data['clinic'] = request.user.clinic
            # Set template_version from template
            template = validated_data.get('template')
            if template and not validated_data.get('template_version'):
                validated_data['template_version'] = template.version

        # Create instance
        instance = ClinicalNote(**validated_data)

        # Apply unified content assignment logic
        self._apply_content(instance, content)

        print(f'[CREATE TRACE] Step 6: After _apply_content()')
        print(f'[CREATE TRACE]   instance.encrypted_content length={len(instance.encrypted_content) if instance.encrypted_content else 0}')
        print(f'[CREATE TRACE]   instance.chart_annotation_data={instance.chart_annotation_data}')

        instance.save()

        # ---------------------------------------------------------
        # CLINICAL NOTE PERSISTENCE AUDIT
        # ---------------------------------------------------------
        saved_note = ClinicalNote.objects.get(pk=instance.pk)
        
        submitted_keys = set(content.keys()) if content else set()
        saved_content = saved_note.content
        saved_keys = set(saved_content.keys()) if saved_content else set()
        
        missing_keys = submitted_keys - saved_keys
        
        print(f'\n{"="*60}')
        print(f'[CREATE TRACE] Step 7: Database Verification')
        print(f'[CREATE TRACE]   Submitted keys: {submitted_keys}')
        print(f'[CREATE TRACE]   Saved content keys: {saved_keys}')
        print(f'[CREATE TRACE]   Missing keys: {missing_keys}')
        print(f'[CREATE TRACE]   saved_note.encrypted_content length: {len(saved_note.encrypted_content) if saved_note.encrypted_content else 0}')
        print(f'[CREATE TRACE]   saved_note.chart_annotation_data: {saved_note.chart_annotation_data}')
        
        content_persisted = (len(missing_keys) == 0 and len(submitted_keys) > 0)
        
        if content_persisted:
            print(f'[CREATE TRACE]   ✓ ALL CONTENT PERSISTED ({len(saved_keys)} fields)')
        else:
            print(f'[CREATE TRACE]   ✗ CONTENT NOT PERSISTED')
            print(f'[CREATE TRACE]   submitted {len(submitted_keys)} keys, saved {len(saved_keys)} keys')
        print(f'{"="*60}\n')
        # ---------------------------------------------------------

        # Log creation
        self._create_audit_log(instance, 'CREATED')

        return instance

    def update(self, instance, validated_data):
        """Update note with encrypted content"""
        # Pop the content that we safely extracted in validate()
        content = validated_data.pop('extracted_content', None)
        # Also pop 'content' just in case DRF left it there
        validated_data.pop('content', None)

        # Prevent editing signed notes
        if instance.is_signed:
            raise serializers.ValidationError('Cannot edit a signed clinical note')

        # Update fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Apply unified content assignment logic
        self._apply_content(instance, content)

        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"[ClinicalNote Edit] Before Save: instance.encrypted_content={instance.encrypted_content}")

        instance.save()

        logger.info(f"[ClinicalNote Edit] After Save: instance.encrypted_content={instance.encrypted_content}")
        
        # Database Reload
        saved_note = ClinicalNote.objects.get(pk=instance.pk)
        logger.info(f"[ClinicalNote Edit] Database Reload: content={saved_note.content}")

        # Log update
        self._create_audit_log(instance, 'UPDATED')

        return instance

    def _extract_chart_annotations(self, content: dict) -> tuple[dict, dict]:
        """
        Separate chart doodle strokes from main content.

        For each field whose value is a dict containing 'doodle_data':
        - Keep only 'canvas_image' (base64 PNG) in the encrypted content dict.
        - Collect { chart_type, doodle_data } into chart_annotation_data.

        Returns (cleaned_content, chart_annotation_data).
        """
        chart_annotation_data: dict = {}
        cleaned: dict = {}

        for field_id, val in content.items():
            if isinstance(val, dict) and 'doodle_data' in val:
                chart_annotation_data[field_id] = {
                    'chart_type': val.get('chart_type', 'body'),
                    'doodle_data': val.get('doodle_data', []),
                }
                # Store only the composited image in encrypted content
                cleaned[field_id] = val.get('canvas_image', None)
            else:
                cleaned[field_id] = val

        return cleaned, chart_annotation_data

    def _create_audit_log(self, instance, action):
        """Create audit log entry"""
        request = self.context.get('request')
        ClinicalNoteAuditLog.objects.create(
            clinical_note=instance,
            user=request.user if request else None,
            action=action,
            ip_address=self._get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '') if request else ''
        )

    def _get_client_ip(self, request):
        """Extract client IP from request"""
        if not request:
            return None
        
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return request.META.get('REMOTE_ADDR')


class ClinicalNoteAuditLogSerializer(serializers.ModelSerializer):
    """Serializer for audit logs"""
    
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = ClinicalNoteAuditLog
        fields = '__all__'
        read_only_fields = '__all__'