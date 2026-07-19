from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from .serializers import (
    ClinicalNoteSerializer, NoteTemplateSerializer,
    OutcomeMeasureSerializer, AttachmentSerializer,
    CaseDocumentSerializer
)
from .models import ClinicalNote, NoteTemplate, OutcomeMeasure, Attachment, CaseDocument


class ClinicalNoteViewSet(viewsets.ModelViewSet):
    """CRUD operations for clinical notes"""
    
    queryset = ClinicalNote.objects.filter(is_deleted=False).select_related(
        'patient', 'practitioner__user', 'appointment', 'clinic'
    )
    serializer_class = ClinicalNoteSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['patient', 'practitioner', 'clinic', 'note_type', 'date', 'is_signed']
    search_fields = ['patient__first_name', 'patient__last_name', 'subjective', 'assessment']
    ordering_fields = ['date', 'created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return self.queryset
        return self.queryset.filter(clinic=user.clinic)
    
    @action(detail=True, methods=['post'])
    def sign(self, request, pk=None):
        """Sign a clinical note"""
        note = self.get_object()
        if note.practitioner.user != request.user and not request.user.is_admin:
            return Response(
                {'error': 'Only the practitioner can sign this note'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        note.is_signed = True
        note.signed_at = timezone.now()
        note.save()
        return Response({'status': 'note signed'})


class NoteTemplateViewSet(viewsets.ModelViewSet):
    """CRUD operations for note templates"""
    
    queryset = NoteTemplate.objects.all().select_related('clinic', 'created_by')
    serializer_class = NoteTemplateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['clinic', 'note_type', 'is_active']
    search_fields = ['name', 'description']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return self.queryset
        return self.queryset.filter(clinic=user.clinic)


class OutcomeMeasureViewSet(viewsets.ModelViewSet):
    """CRUD operations for outcome measures"""
    
    queryset = OutcomeMeasure.objects.all().select_related('patient', 'practitioner__user')
    serializer_class = OutcomeMeasureSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['patient', 'practitioner', 'measure_name', 'date']
    ordering_fields = ['date', 'score']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return self.queryset
        return self.queryset.filter(patient__clinic=user.clinic)
    
    @action(detail=False, methods=['get'])
    def trends(self, request):
        """Get outcome measure trends for a patient"""
        patient_id = request.query_params.get('patient')
        measure_name = request.query_params.get('measure_name')
        
        if not patient_id or not measure_name:
            return Response(
                {'error': 'patient and measure_name parameters are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        measures = self.get_queryset().filter(
            patient_id=patient_id,
            measure_name=measure_name
        ).order_by('date')
        
        serializer = self.get_serializer(measures, many=True)
        return Response(serializer.data)


class AttachmentViewSet(viewsets.ModelViewSet):
    """CRUD operations for clinical attachments"""
    
    queryset = Attachment.objects.filter(is_deleted=False).select_related(
        'patient', 'clinical_note', 'uploaded_by'
    )
    serializer_class = AttachmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['patient', 'clinical_note', 'file_type']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return self.queryset
        return self.queryset.filter(patient__clinic=user.clinic)
    
    def perform_create(self, serializer):
        # Set file size and uploaded_by
        file = self.request.FILES.get('file')
        serializer.save(
            uploaded_by=self.request.user,
            file_size=file.size if file else 0
        )


class CaseDocumentViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for CaseDocuments (letters, clinical notes, uploads).
    """

    queryset = CaseDocument.objects.filter(is_deleted=False).select_related(
        'patient', 'patient_case', 'clinic', 'uploaded_by'
    )
    serializer_class = CaseDocumentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['patient', 'patient_case', 'category', 'source_type']
    search_fields = ['title', 'description', 'file_name']
    ordering_fields = ['created_at', 'category']

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset.filter(clinic=user.clinic)
        return qs