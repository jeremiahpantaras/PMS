from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.utils import timezone
from apps.clinics.services.models import Service as ClinicService
from .models import (
    Patient, IntakeForm,
    ServiceCategory, PortalService,
    PortalLink, PortalBooking,
    PatientConsent,
    ClientFormRequest,
)
from .serializers import (
    PatientSerializer, IntakeFormSerializer,
    ServiceCategorySerializer, PortalServiceSerializer,
    PortalLinkPublicSerializer, PortalLinkAdminSerializer,
    PortalBookingCreateSerializer, PortalBookingResponseSerializer,
    PatientConsentSerializer, PatientConsentCreateSerializer,
    PublicPatientConsentCreateSerializer,
    ClientFormRequestSerializer,
    PublicClientFormVerifySerializer, PublicClientFormSubmitSerializer,
)
import logging
import traceback
from apps.common.validators import normalize_ph_phone

logger = logging.getLogger(__name__)


# ─── Helper ───────────────────────────────────────────────────────────────────

def _confirm_portal_booking(booking, confirmed_by_user):
    """
    When a PortalBooking is CONFIRMED:
      1. Find or create a Patient record.
      2. Find or create a proper Appointment in the diary.
      3. Link the appointment back to the booking.
    """
    from datetime import datetime, timedelta
    from apps.appointments.models import Appointment

    # Use the specific branch the patient selected; fall back to the portal's main clinic.
    try:
        clinic = booking.branch or booking.portal_link.clinic
    except Exception:
        clinic = booking.portal_link.clinic

    # Normalize phone to +63XXXXXXXXXX (13 chars) so it fits Patient.phone max_length=15
    normalized_phone = normalize_ph_phone(booking.patient_phone) if booking.patient_phone else ''

    # ── 1. Find or create Patient ─────────────────────────────────────────
    patient = None

    if booking.patient_email:
        patient = Patient.objects.filter(
            clinic=clinic,
            email__iexact=booking.patient_email,
            is_deleted=False,
        ).first()

    if patient is None:
        patient = Patient.objects.filter(
            clinic=clinic,
            first_name__iexact=booking.patient_first_name,
            last_name__iexact=booking.patient_last_name,
            is_deleted=False,
        ).first()

    if patient is None:
        patient = Patient.objects.create(
            clinic=clinic,
            first_name=booking.patient_first_name,
            last_name=booking.patient_last_name,
            date_of_birth=booking.patient_date_of_birth or '2000-01-01',
            gender='O',
            email=booking.patient_email or '',
            phone=normalized_phone,
            address='',
            city=clinic.city or '',
            province=clinic.province or '',
            emergency_contact_name='',
            emergency_contact_phone='',
            emergency_contact_relationship='',
            is_active=True,
        )
        logger.info(
            f"Patient created from portal booking #{booking.reference_number}: "
            f"{patient.get_full_name()} ({patient.patient_number})"
        )

    # ── 2. Find or create Appointment ─────────────────────────────────────
    if booking.appointment_id:
        return patient, booking.appointment

    appointment = Appointment.objects.filter(
        clinic=clinic,
        patient=patient,
        date=booking.appointment_date,
        start_time=booking.appointment_time,
        is_deleted=False,
    ).first()

    if appointment is None:
        duration = booking.service.duration_minutes if booking.service else 60
        start_dt = datetime.combine(booking.appointment_date, booking.appointment_time)
        end_dt   = start_dt + timedelta(minutes=duration)

        appointment = Appointment.objects.create(
            clinic=clinic,
            patient=patient,
            practitioner=booking.practitioner,
            service=booking.service,
            appointment_type='INITIAL',
            status='CONFIRMED',
            date=booking.appointment_date,
            start_time=booking.appointment_time,
            end_time=end_dt.time(),
            duration_minutes=duration,
            chief_complaint=booking.notes or '',
            notes=f'Created from portal booking #{booking.reference_number}',
            # confirmed_by_user may be None for auto-confirms
            created_by=confirmed_by_user,
            updated_by=confirmed_by_user,
        )
        logger.info(
            f"Appointment #{appointment.id} created from portal booking "
            f"#{booking.reference_number} for {patient.get_full_name()}"
        )

    # ── 3. Link appointment back to booking ───────────────────────────────
    booking.appointment = appointment
    booking.save(update_fields=['appointment'])

    return patient, appointment



# ─── Patient Pagination ───────────────────────────────────────────────────────

class PatientPagination(PageNumberPagination):
    page_size            = 10
    page_size_query_param = 'page_size'
    max_page_size        = 100


# ─── Patient ViewSet ──────────────────────────────────────────────────────────

class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.filter(is_deleted=False).select_related(
        'clinic', 'archived_by'
    )
    serializer_class   = PatientSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = PatientPagination
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ['clinic', 'gender', 'is_active', 'is_archived']
    search_fields      = ['first_name', 'last_name', 'patient_number', 'phone', 'email']
    ordering_fields    = ['last_name', 'created_at']

    def get_queryset(self):
        user = self.request.user
        qs   = self.queryset

        # Scope to clinic
        if user.is_admin:
            base_qs = qs.filter(clinic=user.clinic)
        else:
            base_qs = qs.filter(clinic=user.clinic) if user.clinic else qs.none()

        # ── Default: exclude archived patients unless explicitly requested ──
        # Pass ?include_archived=true  → return ALL (active + archived)
        # Pass ?archived=true          → return ONLY archived
        # Default (no param)           → return ONLY active (not archived)
        include_archived = self.request.query_params.get('include_archived', 'false').lower()
        only_archived    = self.request.query_params.get('archived', 'false').lower()

        if only_archived == 'true':
            base_qs = base_qs.filter(is_archived=True)
        elif include_archived != 'true':
            base_qs = base_qs.filter(is_archived=False)

        return base_qs

    def perform_create(self, serializer):
        patient = serializer.save()
        # Send welcome email in the background (fire-and-forget)
        try:
            from apps.common.email_utils import send_new_client_welcome_email
            send_new_client_welcome_email(patient)
        except Exception as e:
            logger.warning(f"Welcome email failed for patient {patient.id}: {e}")

    @action(detail=True, methods=['get'])
    def intake_forms(self, request, pk=None):
        patient    = self.get_object()
        forms      = patient.intake_forms.all()
        serializer = IntakeFormSerializer(forms, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='consents')
    def consents(self, request, pk=None):
        patient = self.get_object()
        consents = PatientConsent.objects.filter(
            patient=patient,
            patient__clinic=request.user.clinic,
        ).order_by('-created_at')
        serializer = PatientConsentSerializer(consents, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='create_consent')
    def create_consent(self, request, pk=None):
        """
        POST /api/patients/{id}/create_consent/
        Creates or replaces the patient's consent form (1 per patient).
        """
        patient = self.get_object()

        serializer = PatientConsentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        consent, _created = PatientConsent.objects.update_or_create(
            patient=patient,
            type=serializer.validated_data.get('type', PatientConsent.CONSENT_FORM),
            defaults={
                'full_name':    serializer.validated_data['full_name'],
                'email':        serializer.validated_data['email'],
                'consent_text': serializer.validated_data['consent_text'],
                'signature':    serializer.validated_data['signature'],
            },
        )
        return Response(
            PatientConsentSerializer(consent).data,
            status=status.HTTP_201_CREATED if _created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='email_consent')
    def email_consent(self, request, pk=None):
        """
        POST /api/patients/{id}/email_consent/
        Send a consent form PDF to one or more recipients.
        Accepts multipart/form-data: to, subject, body, attachment (PDF).
        """
        from django.conf import settings
        from django.core.mail import EmailMessage
        import threading

        patient = self.get_object()
        clinic  = patient.clinic

        is_multipart = request.content_type and 'multipart/form-data' in request.content_type
        if is_multipart:
            to_raw  = request.POST.get('to', '')
            subject = request.POST.get('subject', '')
            body    = request.POST.get('body', '')
        else:
            to_raw  = request.data.get('to', '')
            subject = request.data.get('subject', '')
            body    = request.data.get('body', '')

        recipients = [e.strip() for e in to_raw.replace(';', ',').split(',') if e.strip()]
        if not recipients:
            return Response(
                {'detail': 'No recipient email address provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not subject:
            subject = f"Data Privacy Consent Form – {patient.get_full_name()}"
        if not body:
            body = (
                f"Dear {patient.get_full_name()},\n\n"
                f"Please find attached your signed Data Privacy Consent Form.\n\n"
                f"Best regards,\n{clinic.name if clinic else 'Clinic Team'}"
            )

        attachment_bytes = None
        patient_slug = patient.get_full_name().replace(' ', '-').lower()
        if is_multipart and 'attachment' in request.FILES:
            attachment_bytes = request.FILES['attachment'].read()

        def _send():
            try:
                email_msg = EmailMessage(
                    subject=subject,
                    body=body,
                    from_email=getattr(clinic, 'email', None) or settings.DEFAULT_FROM_EMAIL,
                    to=recipients,
                )
                if attachment_bytes:
                    email_msg.attach(
                        f"consent-form-{patient_slug}.pdf",
                        attachment_bytes,
                        'application/pdf',
                    )
                email_msg.send(fail_silently=True)
            except Exception:
                pass

        threading.Thread(target=_send, daemon=True).start()

        return Response({'detail': f"Consent form sent to {', '.join(recipients)}"})

    @action(detail=True, methods=['post'], url_path='send_client_form')
    def send_client_form(self, request, pk=None):
        """
        POST /api/patients/{id}/send_client_form/
        Generates a secure single-use token, persists a ClientFormRequest, and
        emails the patient a link to the public form.
        """
        from django.conf import settings as django_settings
        from django.core.mail import EmailMultiAlternatives
        from django.utils import timezone
        from datetime import timedelta
        import threading

        patient = self.get_object()
        clinic  = patient.clinic

        if not patient.email:
            return Response(
                {'detail': 'This patient has no email address on file.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Custom recipient from request body (optional) ──────────────────
        to_email = (request.data.get('to') or patient.email).strip()
        body_override = request.data.get('body', '').strip()

        # ── Create a fresh token valid for 72 hours ────────────────────────
        expires_at = timezone.now() + timedelta(hours=72)
        form_request = ClientFormRequest.objects.create(
            patient=patient,
            expires_at=expires_at,
            sent_by=request.user,
        )

        frontend_base = getattr(django_settings, 'FRONTEND_URL', 'http://localhost:5173')
        form_url = f"{frontend_base}/client-form/{form_request.token}"

        clinic_name = clinic.name if clinic else 'The Clinic'
        patient_name = patient.get_full_name()

        subject = f"Please Complete Your Client Form — {clinic_name}"

        plain_body = body_override or (
            f"Dear {patient_name},\n\n"
            f"We kindly ask you to complete this form prior to your booking so that "
            f"we can ensure we have all necessary information for your session.\n\n"
            f"Please click the link below to begin:\n{form_url}\n\n"
            f"This link expires in 72 hours and can only be used once.\n\n"
            f"Best regards,\n{clinic_name}"
        )

        html_body = f"""
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.07)">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0ea5e9,#2563eb);padding:32px 40px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">{clinic_name}</h1>
          <p style="margin:8px 0 0;color:#bae6fd;font-size:14px">Client Information Form</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:40px">
          <p style="margin:0 0 16px;font-size:16px;color:#374151">Dear <strong>{patient_name}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6">
            We kindly ask you to complete this form prior to your booking so that we can ensure
            we have all the necessary information for your session.
          </p>

          <!-- CTA Button -->
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px">
            <tr><td align="center" style="border-radius:10px;background:#0ea5e9">
              <a href="{form_url}"
                 style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px">
                Click Here To Start Filling Out
              </a>
            </td></tr>
          </table>

          <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;text-align:center">
            Or copy this link into your browser:
          </p>
          <p style="margin:0 0 32px;font-size:12px;color:#6b7280;text-align:center;word-break:break-all">
            <a href="{form_url}" style="color:#0ea5e9">{form_url}</a>
          </p>

          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;font-size:13px;color:#6b7280">
            <strong>Note:</strong> This link expires in <strong>72 hours</strong> and can only be used once.
            If you have any questions, please contact us directly.
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb">
          Best regards, <strong>{clinic_name}</strong>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

        def _send():
            try:
                msg = EmailMultiAlternatives(
                    subject=subject,
                    body=plain_body,
                    from_email=getattr(clinic, 'email', None) or django_settings.DEFAULT_FROM_EMAIL,
                    to=[to_email],
                )
                msg.attach_alternative(html_body, 'text/html')
                msg.send(fail_silently=True)
            except Exception:
                pass

        threading.Thread(target=_send, daemon=True).start()

        return Response(
            ClientFormRequestSerializer(form_request).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'], url_path='client_form_requests')
    def client_form_requests(self, request, pk=None):
        """GET /api/patients/{id}/client_form_requests/ — list form requests for a patient."""
        patient = self.get_object()
        qs = ClientFormRequest.objects.filter(patient=patient).order_by('-created_at')
        return Response(ClientFormRequestSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'], url_path='archive')
    def archive(self, request, pk=None):
        """
        POST /api/patients/{id}/archive/
        Archives a patient — hides them and their appointments from the diary.
        Any authenticated user can archive.
        """
        patient = self.get_object()

        if patient.is_archived:
            return Response(
                {'detail': 'Patient is already archived.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        patient.archive(archived_by_user=request.user)

        logger.info(
            f"Patient #{patient.patient_number} ({patient.get_full_name()}) "
            f"archived by {request.user.email}"
        )

        return Response(
            {
                'detail':      f'{patient.get_full_name()} has been archived.',
                'patient_id':  patient.id,
                'is_archived': True,
                'archived_at': patient.archived_at,
                'archived_by': request.user.get_full_name(),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        """
        POST /api/patients/{id}/restore/
        Restores an archived patient — makes them and their appointments visible again.
        Any authenticated user can restore.
        """
        # get_object() by default uses get_queryset() which excludes archived —
        # we need to fetch directly so archived patients are reachable.
        patient = get_object_or_404(
            Patient,
            pk=pk,
            clinic=request.user.clinic,
            is_deleted=False,
        )

        if not patient.is_archived:
            return Response(
                {'detail': 'Patient is not archived.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        patient.restore()

        logger.info(
            f"Patient #{patient.patient_number} ({patient.get_full_name()}) "
            f"restored by {request.user.email}"
        )

        return Response(
            {
                'detail':      f'{patient.get_full_name()} has been restored.',
                'patient_id':  patient.id,
                'is_archived': False,
            },
            status=status.HTTP_200_OK,
        )


# ─── Intake Form ViewSet ──────────────────────────────────────────────────────

class IntakeFormViewSet(viewsets.ModelViewSet):
    queryset           = IntakeForm.objects.all().select_related('patient', 'completed_by')
    serializer_class   = IntakeFormSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ['patient', 'completed_by']

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return self.queryset
        return self.queryset.filter(patient__clinic=user.clinic)


# ─── Portal Service Management (admin) ───────────────────────────────────────

class ServiceCategoryViewSet(viewsets.ModelViewSet):
    queryset           = ServiceCategory.objects.filter(is_deleted=False)
    serializer_class   = ServiceCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields   = ['is_active']
    search_fields      = ['name']

    def get_queryset(self):
        return self.queryset.filter(clinic=self.request.user.clinic)

    def perform_create(self, serializer):
        serializer.save(clinic=self.request.user.clinic)


class PortalServiceViewSet(viewsets.ModelViewSet):
    queryset           = PortalService.objects.filter(is_deleted=False).select_related('category', 'clinic')
    serializer_class   = PortalServiceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields   = ['is_active', 'category']
    search_fields      = ['name', 'description']

    def get_queryset(self):
        return self.queryset.filter(clinic=self.request.user.clinic)

    def perform_create(self, serializer):
        serializer.save(clinic=self.request.user.clinic)


# ─── Portal Link management (admin) ──────────────────────────────────────────

class PortalLinkViewSet(viewsets.ModelViewSet):
    queryset           = PortalLink.objects.select_related('clinic')
    serializer_class   = PortalLinkAdminSerializer
    permission_classes = [IsAuthenticated]
    http_method_names  = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        main_clinic = self.request.user.clinic.main_clinic
        return self.queryset.filter(clinic=main_clinic)

    def list(self, request, *args, **kwargs):
        main_clinic = request.user.clinic.main_clinic
        portal_link, created = PortalLink.get_or_create_for_clinic(main_clinic)
        if created:
            logger.info(f"Portal link auto-created for clinic: {main_clinic.name}")
        serializer = self.get_serializer(portal_link, context={'request': request})
        return Response([serializer.data])

    def retrieve(self, request, *args, **kwargs):
        instance   = self.get_object()
        serializer = self.get_serializer(instance, context={'request': request})
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        instance   = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=True, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        logger.info(
            f"Portal link updated for clinic: {instance.clinic.name} "
            f"by {request.user.email}"
        )
        return Response(serializer.data)


# ─── Portal Booking management (admin) ───────────────────────────────────────

class PortalBookingAdminViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PortalBooking.objects.select_related(
        'portal_link__clinic', 'service', 'practitioner__user'
    )
    serializer_class   = PortalBookingResponseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields   = ['status']
    ordering_fields    = ['appointment_date', 'created_at']

    def get_queryset(self):
        user = self.request.user
        if not user.clinic:
            return self.queryset.none()
        main_clinic    = user.clinic.main_clinic
        all_branch_ids = list(
            main_clinic.get_all_branches().values_list('id', flat=True)
        )
        return self.queryset.filter(portal_link__clinic_id__in=all_branch_ids)

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        booking    = self.get_object()
        new_status = request.data.get('status')
        allowed    = [s[0] for s in PortalBooking.STATUS_CHOICES]

        if new_status not in allowed:
            return Response(
                {'status': f'Must be one of: {", ".join(allowed)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = new_status
        booking.save(update_fields=['status', 'updated_at'])

        result = {'id': booking.id, 'status': booking.status}

        if new_status == 'CONFIRMED':
            try:
                patient, appointment = _confirm_portal_booking(booking, request.user)
                result['patient_id']     = patient.id
                result['patient_number'] = patient.patient_number
                result['patient_name']   = patient.get_full_name()
                result['appointment_id'] = appointment.id if appointment else None
                logger.info(
                    f"Portal booking #{booking.reference_number} confirmed. "
                    f"Patient: {patient.patient_number}, "
                    f"Appointment: {appointment.id if appointment else 'N/A'}"
                )
            except Exception as e:
                logger.error(f"Failed to create patient/appointment from portal booking: {e}")
                result['warning'] = 'Booking confirmed but failed to auto-create patient record.'

        return Response(result)


# ─── Public Portal endpoints (no auth) ───────────────────────────────────────

class PublicPortalView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token: str):
        portal_link = get_object_or_404(PortalLink, token=token, is_active=True)
        serializer  = PortalLinkPublicSerializer(portal_link, context={'request': request})
        return Response(serializer.data)


class PublicPortalBookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, token: str):
        portal_link = get_object_or_404(PortalLink, token=token, is_active=True)

        serializer = PortalBookingCreateSerializer(
            data=request.data,
            context={'request': request, 'portal_link': portal_link},
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # ── Validate practitioner is assigned to the service (if service restricts) ──
        validated  = serializer.validated_data
        service_obj = validated.get('service')
        prac_obj    = validated.get('practitioner')
        consent_id  = validated.get('consent_id')

        consent = None
        if consent_id:
            consent = PatientConsent.objects.filter(
                id=consent_id,
                portal_link=portal_link,
            ).first()
            if not consent:
                return Response(
                    {'detail': 'Consent record not found or invalid.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if service_obj and prac_obj:
            assigned_ids = list(service_obj.assigned_practitioners.values_list('id', flat=True))
            if assigned_ids and prac_obj.id not in assigned_ids:
                return Response(
                    {'detail': 'The selected practitioner does not offer this service.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        booking = serializer.save(portal_link=portal_link)

        # ── Auto-confirm: skip PENDING, immediately create patient + appointment ──
        try:
            # Set status to CONFIRMED right away
            booking.status = 'CONFIRMED'
            booking.save(update_fields=['status', 'updated_at'])

            # Create patient + diary appointment
            patient, _appointment = _confirm_portal_booking(booking, confirmed_by_user=None)

            if consent and consent.patient_id is None:
                consent.patient = patient
                consent.save(update_fields=['patient', 'updated_at'])

            logger.info(
                f"Portal booking #{booking.reference_number} auto-confirmed "
                f"for clinic '{portal_link.clinic.name}'"
            )

            # Send booking confirmation email
            try:
                from apps.common.email_utils import send_booking_confirmation_email
                send_booking_confirmation_email(booking)
            except Exception as email_err:
                logger.warning(
                    f"Booking confirmation email failed for #{booking.reference_number}: {email_err}"
                )
        except Exception as e:
            logger.error(
                f"Auto-confirm failed for portal booking #{booking.reference_number}: {e}\n"
                f"{traceback.format_exc()}"
            )

        response_serializer = PortalBookingResponseSerializer(
            booking, context={'request': request}
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class PublicPortalConsentCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, token: str):
        portal_link = get_object_or_404(PortalLink, token=token, is_active=True)

        serializer = PublicPatientConsentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        consent = serializer.save(portal_link=portal_link)
        return Response(
            PublicPatientConsentCreateSerializer(consent).data,
            status=status.HTTP_201_CREATED,
        )


class PublicAvailableSlotsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token: str):
        portal_link = get_object_or_404(PortalLink, token=token, is_active=True)

        service_id      = request.query_params.get('service')
        date_str        = request.query_params.get('date')
        practitioner_id = request.query_params.get('practitioner')

        if not service_id or not date_str:
            return Response(
                {'detail': 'service and date query params are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = get_object_or_404(
            ClinicService,
            pk=service_id,
            clinic=portal_link.clinic,
            is_active=True,
            show_in_portal=True,
        )

        from datetime import time, date as date_type, timedelta, datetime
        from apps.appointments.models import Appointment
        from apps.appointments.models import PractitionerSchedule
        from apps.appointments.models import BlockAppointment
        from apps.clinics.models import Practitioner

        try:
            target_date = date_type.fromisoformat(date_str)
        except ValueError:
            return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

        if target_date < date_type.today():
            return Response({'detail': 'Cannot book a past date.'}, status=400)

        duration     = service.duration_minutes
        CLINIC_START = 6 * 60
        CLINIC_END   = 21 * 60

        # ── Practitioner availability ──────────────────────────────────────────
        practitioner_obj = None
        practitioner_availability = None
        if practitioner_id:
            try:
                practitioner_obj = Practitioner.objects.select_related('user').get(
                    id=practitioner_id,
                    is_deleted=False,
                    user__is_active=True,
                )
                practitioner_availability = practitioner_obj.availability
            except Practitioner.DoesNotExist:
                pass

        # Map weekday (0=Mon) to duty day string
        WEEKDAY_MAP = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        target_weekday = WEEKDAY_MAP[target_date.weekday()]

        # Parse lunch break (always used)
        def parse_mins(t: str) -> int:
            h, m = t.split(':')
            return int(h) * 60 + int(m)

        # ── Build candidate time blocks from duty schedule ─────────────────────
        # Each block = (start_min, end_min).  Lunch is removed from each block.
        candidate_blocks: list[tuple[int, int]] = []

        if practitioner_availability and practitioner_availability.get('duty_days'):
            duty_days = practitioner_availability.get('duty_days', [])
            if target_weekday not in duty_days:
                return Response({'date': date_str, 'slots': []})

            duty_schedule = practitioner_availability.get('duty_schedule')
            lunch_start_min = parse_mins(practitioner_availability.get('lunch_start_time', '12:00'))
            lunch_end_min   = parse_mins(practitioner_availability.get('lunch_end_time', '13:00'))

            if duty_schedule and target_weekday in duty_schedule:
                # Split-shift: multiple blocks for this day
                for block in duty_schedule[target_weekday]:
                    b_start = parse_mins(block['start'])
                    b_end   = parse_mins(block['end'])
                    # Remove lunch from each block by splitting if needed
                    if b_end <= lunch_start_min or b_start >= lunch_end_min:
                        # Block entirely outside lunch — keep whole
                        candidate_blocks.append((b_start, b_end))
                    else:
                        # Block overlaps lunch — split
                        if b_start < lunch_start_min:
                            candidate_blocks.append((b_start, lunch_start_min))
                        if b_end > lunch_end_min:
                            candidate_blocks.append((lunch_end_min, b_end))
            else:
                # Legacy single-block duty hours
                duty_start_min = parse_mins(practitioner_availability.get('duty_start_time', '08:00'))
                duty_end_min   = parse_mins(practitioner_availability.get('duty_end_time', '17:00'))
                if duty_end_min <= lunch_start_min or duty_start_min >= lunch_end_min:
                    candidate_blocks.append((duty_start_min, duty_end_min))
                else:
                    if duty_start_min < lunch_start_min:
                        candidate_blocks.append((duty_start_min, lunch_start_min))
                    if duty_end_min > lunch_end_min:
                        candidate_blocks.append((lunch_end_min, duty_end_min))
        else:
            # No practitioner / no duty days config: full clinic hours
            LUNCH_START = 12 * 60
            LUNCH_END   = 13 * 60
            candidate_blocks.append((CLINIC_START, LUNCH_START))
            candidate_blocks.append((LUNCH_END, CLINIC_END))

        # Generate 30-min candidate slots from all blocks
        def time_to_minutes(t):
            return t.hour * 60 + t.minute

        def minutes_to_time(m):
            return time(m // 60, m % 60)

        SLOT_INTERVAL = 15  # minutes between slots
        candidate_slots = []
        for (b_start, b_end) in candidate_blocks:
            m = b_start
            # Only generate a slot if the full service duration fits within this block
            while m + duration <= b_end:
                candidate_slots.append(minutes_to_time(m))
                m += SLOT_INTERVAL

        weekday         = target_date.weekday()

        booked_ranges = []

        diary_qs = Appointment.objects.filter(
            date=target_date,
            clinic=portal_link.clinic,
            status__in=['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'],
            is_deleted=False,
            # ✅ Exclude archived patients' appointments from slot-availability too
            patient__is_archived=False,
        )
        if practitioner_id:
            diary_qs = diary_qs.filter(practitioner_id=practitioner_id)

        for appt in diary_qs:
            booked_ranges.append((
                time_to_minutes(appt.start_time),
                time_to_minutes(appt.end_time),
            ))

        portal_qs = PortalBooking.objects.filter(
            portal_link=portal_link,
            appointment_date=target_date,
            status__in=['PENDING', 'CONFIRMED'],
        )
        if practitioner_id:
            portal_qs = portal_qs.filter(practitioner_id=practitioner_id)

        for booking in portal_qs:
            booking_start            = time_to_minutes(booking.appointment_time)
            booking_service_duration = (
                booking.service.duration_minutes if booking.service else duration
            )
            booking_end = booking_start + booking_service_duration
            booked_ranges.append((booking_start, booking_end))

        # Add block appointments to blocked ranges
        block_qs = BlockAppointment.objects.filter(
            clinic=portal_link.clinic,
            date=target_date,
        )

        for block in block_qs:
            block_start = time_to_minutes(block.start_time)
            block_end   = time_to_minutes(block.end_time)
            booked_ranges.append((block_start, block_end))

        available = []
        for slot_time in candidate_slots:
            slot_start = time_to_minutes(slot_time)
            slot_end   = slot_start + duration

            if slot_end > CLINIC_END:
                continue

            overlaps = any(
                slot_start < booked_end and slot_end > booked_start
                for booked_start, booked_end in booked_ranges
            )
            if not overlaps:
                available.append(f"{slot_time.hour:02d}:{slot_time.minute:02d}")

        return Response({'date': date_str, 'slots': available})


class PortalBookingDiaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')

        if not date_from or not date_to:
            return Response(
                {'detail': 'date_from and date_to are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bookings = PortalBooking.objects.filter(
            portal_link__clinic=request.user.clinic,
            appointment_date__gte=date_from,
            appointment_date__lte=date_to,
            status='PENDING',
        ).select_related('service', 'practitioner__user')

        practitioner_id = request.query_params.get('practitioner')
        if practitioner_id:
            bookings = bookings.filter(practitioner_id=practitioner_id)

        clinic_branch = request.query_params.get('clinic_branch')
        if clinic_branch:
            bookings = bookings.filter(portal_link__clinic_id=clinic_branch)

        from datetime import datetime, timedelta
        data = []
        for b in bookings:
            duration = b.service.duration_minutes if b.service else 60
            start_dt = datetime.combine(b.appointment_date, b.appointment_time)
            end_dt   = start_dt + timedelta(minutes=duration)

            data.append({
                'id':               b.id,
                'reference_number': b.reference_number,
                'status':           b.status,
                'patient_name':     f"{b.patient_first_name} {b.patient_last_name}",
                'patient_phone':    b.patient_phone,
                'patient_email':    b.patient_email,
                'service_name':     b.service.name if b.service else '—',
                'practitioner_id':  b.practitioner_id,
                'practitioner_name': (
                    b.practitioner.user.get_full_name() if b.practitioner else 'Any Available'
                ),
                'date':             b.appointment_date.strftime('%Y-%m-%d'),
                'start_time':       b.appointment_time.strftime('%H:%M'),
                'end_time':         end_dt.strftime('%H:%M'),
                'duration_minutes': duration,
                'notes':            b.notes,
            })

        return Response(data)


# ─── Public Client Form endpoints (no auth) ───────────────────────────────────

class PublicClientFormView(APIView):
    """
    GET /api/public/client-form/{token}/
    Returns minimal info (clinic name, patient first name) so the email-verify
    page can display a friendly greeting — without leaking sensitive data.
    """
    permission_classes = [AllowAny]

    def get(self, request, token):
        from django.utils import timezone as tz

        try:
            form_request = ClientFormRequest.objects.select_related(
                'patient__clinic'
            ).get(token=token)
        except ClientFormRequest.DoesNotExist:
            return Response({'detail': 'Invalid or expired link.'}, status=status.HTTP_404_NOT_FOUND)

        if form_request.is_completed:
            return Response({'detail': 'This form has already been completed.'}, status=status.HTTP_410_GONE)

        if tz.now() > form_request.expires_at:
            return Response({'detail': 'This link has expired.'}, status=status.HTTP_410_GONE)

        patient     = form_request.patient
        clinic_name = patient.clinic.name if patient.clinic else 'The Clinic'

        return Response({
            'clinic_name':   clinic_name,
            'patient_first': patient.first_name,
            'expires_at':    form_request.expires_at,
        })


class PublicClientFormVerifyView(APIView):
    """
    POST /api/public/client-form/{token}/verify/
    Body: { "email": "patient@example.com" }
    If the email matches the patient linked to the token, returns the patient's
    current profile data for pre-filling the form.
    """
    permission_classes = [AllowAny]

    def post(self, request, token):
        from django.utils import timezone as tz

        serializer = PublicClientFormVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            form_request = ClientFormRequest.objects.select_related('patient').get(token=token)
        except ClientFormRequest.DoesNotExist:
            return Response({'detail': 'Invalid or expired link.'}, status=status.HTTP_404_NOT_FOUND)

        if form_request.is_completed:
            return Response({'detail': 'This form has already been completed.'}, status=status.HTTP_410_GONE)

        if tz.now() > form_request.expires_at:
            return Response({'detail': 'This link has expired.'}, status=status.HTTP_410_GONE)

        submitted_email = serializer.validated_data['email'].strip().lower()
        patient_email   = (form_request.patient.email or '').strip().lower()

        if submitted_email != patient_email:
            return Response(
                {'detail': 'The email address does not match our records.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        patient = form_request.patient
        return Response({
            'first_name':    patient.first_name,
            'last_name':     patient.last_name,
            'date_of_birth': patient.date_of_birth.isoformat() if patient.date_of_birth else '',
            'gender':        patient.gender,
            'address':       patient.address,
            'province':      patient.province,
            'city':          patient.city,
            'postal_code':   patient.postal_code,
            # Emergency contact
            'emergency_contact_name':         patient.emergency_contact_name,
            'emergency_contact_phone':        patient.emergency_contact_phone,
            'emergency_contact_relationship': patient.emergency_contact_relationship,
            # Medical info
            'philhealth_number':  patient.philhealth_number,
            'medical_conditions': patient.medical_conditions,
            'allergies':          patient.allergies,
            'medications':        patient.medications,
        })


class PublicClientFormSubmitView(APIView):
    """
    POST /api/public/client-form/{token}/submit/
    Validates the email and updates the patient record, then marks the token used.
    """
    permission_classes = [AllowAny]

    def post(self, request, token):
        from django.utils import timezone as tz

        try:
            form_request = ClientFormRequest.objects.select_related('patient').get(token=token)
        except ClientFormRequest.DoesNotExist:
            return Response({'detail': 'Invalid or expired link.'}, status=status.HTTP_404_NOT_FOUND)

        if form_request.is_completed:
            return Response({'detail': 'This form has already been completed.'}, status=status.HTTP_410_GONE)

        if tz.now() > form_request.expires_at:
            return Response({'detail': 'This link has expired.'}, status=status.HTTP_410_GONE)

        # Email re-verification on submit (prevents someone guessing the URL)
        submitted_email = (request.data.get('email') or '').strip().lower()
        patient_email   = (form_request.patient.email or '').strip().lower()
        if submitted_email != patient_email:
            return Response(
                {'detail': 'Email verification failed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PublicClientFormSubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data    = serializer.validated_data
        patient = form_request.patient

        # Update patient profile
        patient.first_name    = data['first_name']
        patient.last_name     = data['last_name']
        patient.date_of_birth = data['date_of_birth']
        patient.gender        = data['gender']
        patient.address       = data['address']
        patient.province      = data['province']
        patient.city          = data['city']
        if data.get('postal_code'):
            patient.postal_code = data['postal_code']
        # Emergency contact
        patient.emergency_contact_name         = data['emergency_contact_name']
        patient.emergency_contact_phone        = data['emergency_contact_phone']
        patient.emergency_contact_relationship = data['emergency_contact_relationship']
        # Medical info
        if data.get('philhealth_number'):
            patient.philhealth_number = data['philhealth_number']
        patient.medical_conditions = data.get('medical_conditions', '')
        patient.allergies          = data.get('allergies', '')
        patient.medications        = data.get('medications', '')
        patient.save(update_fields=[
            'first_name', 'last_name', 'date_of_birth', 'gender',
            'address', 'province', 'city', 'postal_code',
            'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
            'philhealth_number', 'medical_conditions', 'allergies', 'medications',
        ])

        # Mark token as used and record consent
        now = tz.now()
        form_request.is_completed  = True
        form_request.completed_at  = now
        form_request.accepted_terms   = data['accepted_terms']
        form_request.accepted_privacy = data['accepted_privacy']
        form_request.accepted_at      = now
        form_request.save(update_fields=[
            'is_completed', 'completed_at',
            'accepted_terms', 'accepted_privacy', 'accepted_at',
        ])

        return Response({'detail': 'Your information has been saved. Thank you!'})
