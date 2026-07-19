from rest_framework import serializers
from .models import LetterTemplate, Letter


class LetterTemplateSerializer(serializers.ModelSerializer):
    """Serializer for letter templates."""

    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True
    )

    class Meta:
        model = LetterTemplate
        fields = [
            'id', 'clinic', 'created_by', 'created_by_name',
            'name', 'description', 'category',
            'content_html', 'header_html', 'footer_html',
            'include_logo', 'include_signature',
            'merge_fields', 'version', 'parent_template',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'clinic', 'created_by', 'version',
            'created_at', 'updated_at',
        ]

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user:
            validated_data['clinic'] = request.user.clinic
            validated_data['created_by'] = request.user
        return super().create(validated_data)


class LetterSerializer(serializers.ModelSerializer):
    """Serializer for generated letters."""

    patient_name = serializers.CharField(
        source='patient.get_full_name', read_only=True
    )
    practitioner_name = serializers.SerializerMethodField()
    template_name = serializers.CharField(
        source='template.name', read_only=True, default=None
    )
    case_title = serializers.CharField(
        source='patient_case.title', read_only=True, default=None
    )

    class Meta:
        model = Letter
        fields = [
            'id', 'patient', 'patient_name',
            'patient_case', 'case_title',
            'appointment', 'clinic',
            'practitioner', 'practitioner_name',
            'template', 'template_name',
            'subject', 'content_html', 'rendered_pdf',
            'status', 'is_signed', 'signed_at', 'signature_data',
            'sent_to', 'sent_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'clinic', 'rendered_pdf',
            'signed_at', 'sent_at',
            'created_at', 'updated_at',
        ]

    def get_practitioner_name(self, obj):
        if obj.practitioner and obj.practitioner.user:
            return obj.practitioner.user.get_full_name()
        return None

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user:
            validated_data['clinic'] = request.user.clinic
            # Auto-populate practitioner from user's profile
            if not validated_data.get('practitioner'):
                if hasattr(request.user, 'practitioner_profile'):
                    validated_data['practitioner'] = request.user.practitioner_profile
        return super().create(validated_data)
