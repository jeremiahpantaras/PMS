from rest_framework import serializers
from .models import ClinicalNote, NoteTemplate, OutcomeMeasure, Attachment, CaseDocument


class ClinicalNoteSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.get_full_name', read_only=True)
    practitioner_name = serializers.CharField(source='practitioner.user.get_full_name', read_only=True)
    
    class Meta:
        model = ClinicalNote
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'signed_at']


class NoteTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = NoteTemplate
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class OutcomeMeasureSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.get_full_name', read_only=True)
    practitioner_name = serializers.CharField(source='practitioner.user.get_full_name', read_only=True)
    percentage = serializers.SerializerMethodField()
    
    class Meta:
        model = OutcomeMeasure
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_percentage(self, obj):
        if obj.max_score and obj.max_score > 0:
            return round((obj.score / obj.max_score) * 100, 2)
        return None


class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    patient_name = serializers.CharField(source='patient.get_full_name', read_only=True)
    
    class Meta:
        model = Attachment
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'file_size']


class CaseDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    patient_name = serializers.CharField(source='patient.get_full_name', read_only=True)
    case_title = serializers.CharField(source='patient_case.title', read_only=True, default=None)

    class Meta:
        model = CaseDocument
        fields = [
            'id', 'patient', 'patient_name', 'patient_case', 'case_title',
            'clinic', 'uploaded_by', 'uploaded_by_name',
            'title', 'description', 'category',
            'source_type', 'source_id',
            'file', 'file_name', 'file_size', 'mime_type',
            'version', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'clinic', 'uploaded_by', 'file_size', 'version', 'created_at', 'updated_at']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user:
            validated_data['clinic'] = request.user.clinic
            validated_data['uploaded_by'] = request.user
            
        file_obj = validated_data.get('file')
        if file_obj:
            validated_data['file_size'] = file_obj.size
            if not validated_data.get('file_name'):
                validated_data['file_name'] = file_obj.name
            
        return super().create(validated_data)