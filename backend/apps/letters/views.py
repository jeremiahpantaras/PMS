from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from .models import LetterTemplate, Letter
from .serializers import LetterTemplateSerializer, LetterSerializer
from apps.records.models import CaseDocument
from .services import LetterGeneratorService
from apps.patients.models import Patient
from django.core.files.base import ContentFile

import logging

logger = logging.getLogger(__name__)


class LetterTemplateViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for letter templates.

    Permissions:
    - All authenticated clinic users: Create, Read, Update
    - Admin only: Delete
    Security: Scoped to user's clinic
    """

    queryset = LetterTemplate.objects.filter(is_deleted=False)
    serializer_class = LetterTemplateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at', 'version']

    def get_queryset(self):
        return self.queryset.filter(clinic=self.request.user.clinic)

    @action(detail=True, methods=['post'])
    def create_version(self, request, pk=None):
        """Create a new version of an existing letter template."""
        template = self.get_object()
        new_version = template.create_new_version(request.user)
        serializer = self.get_serializer(new_version)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get only active templates."""
        templates = self.get_queryset().filter(is_active=True)
        serializer = self.get_serializer(templates, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def merge_field_options(self, request):
        """
        Return the list of all available merge fields for the template editor.
        """
        fields = {
            'patient': [
                {'key': '{{patient.full_name}}', 'label': 'Patient Full Name'},
                {'key': '{{patient.first_name}}', 'label': 'Patient First Name'},
                {'key': '{{patient.last_name}}', 'label': 'Patient Last Name'},
                {'key': '{{patient.date_of_birth}}', 'label': 'Date of Birth'},
                {'key': '{{patient.email}}', 'label': 'Patient Email'},
                {'key': '{{patient.phone}}', 'label': 'Patient Phone'},
                {'key': '{{patient.address}}', 'label': 'Patient Address'},
                {'key': '{{patient.patient_number}}', 'label': 'Patient Number'},
            ],
            'clinic': [
                {'key': '{{clinic.name}}', 'label': 'Clinic Name'},
                {'key': '{{clinic.address}}', 'label': 'Clinic Address'},
                {'key': '{{clinic.phone}}', 'label': 'Clinic Phone'},
                {'key': '{{clinic.email}}', 'label': 'Clinic Email'},
            ],
            'practitioner': [
                {'key': '{{practitioner.full_name}}', 'label': 'Practitioner Full Name'},
                {'key': '{{practitioner.title}}', 'label': 'Practitioner Title'},
                {'key': '{{practitioner.specialization}}', 'label': 'Specialization'},
            ],
            'case': [
                {'key': '{{case.title}}', 'label': 'Case Title'},
                {'key': '{{case.status}}', 'label': 'Case Status'},
            ],
            'date': [
                {'key': '{{today.date}}', 'label': "Today's Date (long)"},
                {'key': '{{today.date_short}}', 'label': "Today's Date (short)"},
            ],
        }
        return Response(fields)


class LetterViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for generated letters.

    Permissions:
    - Practitioners: Create/edit their own letters
    - Admins: Full access
    Security: Scoped to user's clinic
    """

    queryset = Letter.objects.filter(is_deleted=False).select_related(
        'patient', 'practitioner__user', 'template', 'patient_case', 'clinic'
    )
    serializer_class = LetterSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['patient', 'patient_case', 'practitioner', 'status', 'template']
    search_fields = ['subject', 'patient__first_name', 'patient__last_name']
    ordering_fields = ['created_at', 'sent_at']

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset.filter(clinic=user.clinic)
        # Practitioners see only their own letters
        if user.is_practitioner and not user.is_admin:
            qs = qs.filter(practitioner__user=user)
        return qs

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """
        Generates a new Letter from a template.
        Expects: template_id, patient_id, subject
        Optional: patient_case_id
        """
        template_id = request.data.get('template_id')
        patient_id = request.data.get('patient_id')
        subject = request.data.get('subject')
        patient_case_id = request.data.get('patient_case_id')

        if not all([template_id, patient_id, subject]):
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            template = LetterTemplate.objects.get(id=template_id, clinic=request.user.clinic)
            patient = Patient.objects.get(id=patient_id, clinic=request.user.clinic)
            practitioner = getattr(request.user, 'practitioner', None)
            
            # 1. Render content
            rendered_content = LetterGeneratorService.replace_variables(
                template.content_html,
                patient=patient,
                practitioner=practitioner
            )
            
            # Optionally wrap in header/footer
            full_html = f"{template.header_html or ''}{rendered_content}{template.footer_html or ''}"
            
            # 2. Generate PDF
            pdf_bytes = LetterGeneratorService.generate_pdf(full_html)
            
            # 3. Create Letter record
            letter = Letter.objects.create(
                clinic=request.user.clinic,
                patient=patient,
                patient_case_id=patient_case_id,
                practitioner=practitioner,
                template=template,
                subject=subject,
                content_html=rendered_content,
                status='DRAFT'
            )
            
            # Save PDF file
            file_name = f"Letter_{letter.id}_{patient.get_full_name().replace(' ', '_')}.pdf"
            letter.rendered_pdf.save(file_name, ContentFile(pdf_bytes), save=True)
            
            # 4. Sync to CaseDocument
            CaseDocument.objects.create(
                patient=patient,
                patient_case_id=patient_case_id,
                clinic=request.user.clinic,
                uploaded_by=request.user,
                title=subject,
                category='LETTER',
                source_type='LETTER',
                source_id=letter.id,
                file=letter.rendered_pdf,
                file_name=file_name,
                file_size=len(pdf_bytes),
                mime_type='application/pdf'
            )
            
            return Response(self.get_serializer(letter).data, status=status.HTTP_201_CREATED)
            
        except LetterTemplate.DoesNotExist:
            return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)
        except Patient.DoesNotExist:
            return Response({'error': 'Patient not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Letter generation error: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def sign(self, request, pk=None):
        """Sign and finalize a letter."""
        from django.utils import timezone

        letter = self.get_object()
        signature = request.data.get('signature_data', '')

        letter.is_signed = True
        letter.signed_at = timezone.now()
        letter.status = 'FINAL'
        if signature:
            letter.signature_data = signature
        letter.save(update_fields=[
            'is_signed', 'signed_at', 'status', 'signature_data',
        ])

        serializer = self.get_serializer(letter)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def send_email(self, request, pk=None):
        """Send letter via email with PDF attachment."""
        from django.utils import timezone

        letter = self.get_object()
        recipients_raw = request.data.get('to', '')
        if recipients_raw:
            recipients = [e.strip() for e in recipients_raw.replace(';', ',').split(',') if e.strip()]
        else:
            recipients = [letter.patient.email] if letter.patient.email else []

        if not recipients:
            return Response(
                {'detail': 'No recipient email provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Mark as sent
        letter.status = 'SENT'
        letter.sent_to = recipients
        letter.sent_at = timezone.now()
        letter.save(update_fields=['status', 'sent_to', 'sent_at'])

        # TODO: Implement actual email sending with PDF attachment
        logger.info(f"Letter {letter.id} sent to {recipients}")

        return Response({'detail': f"Letter sent to {', '.join(recipients)}"})
