from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from django.http import JsonResponse

from apps.accounts.views import AuthViewSet, UserViewSet, RoleViewSet, PermissionViewSet, PermissionGroupViewSet
from apps.clinics.views import ClinicViewSet, PractitionerViewSet, LocationViewSet, ClinicConsentFormViewSet
from apps.appointments.views import AppointmentViewSet, PractitionerScheduleViewSet, AppointmentReminderViewSet, BlockAppointmentViewSet, CalendarNoteViewSet, PublicRebookingLinkView, PublicRebookingSlotsView, PublicAppointmentConfirmView, TriggerRemindersWebhookView, PublicAppointmentCancelView
from apps.records.views import (
    ClinicalNoteViewSet, NoteTemplateViewSet, OutcomeMeasureViewSet,
    AttachmentViewSet, CaseDocumentViewSet
)
from apps.billing.views import (
    AgeingDebtEntryViewSet,
    InvoiceViewSet, InvoiceItemViewSet, PaymentViewSet,
    ServiceViewSet, InvoiceBatchViewSet, AppointmentPrintViewSet,
)
from apps.reports.views import ReportViewSet
from apps.integrations.views import PhilHealthClaimViewSet, HMOClaimViewSet
from apps.contacts.views import ContactViewSet
from apps.clinics.services.views import ServiceViewSet as ClinicServiceViewSet
from apps.notifications.views_webhook import SMSReplyWebhookView


def api_root(request):
    """Root endpoint - API health check"""
    return JsonResponse({
        'status': 'online',
        'message': 'Malasakit EMR API',
        'version': '1.0'
    })


router = DefaultRouter()
# Accounts
router.register(r'auth',              AuthViewSet,             basename='auth')
router.register(r'users',             UserViewSet,             basename='users')
router.register(r'roles',             RoleViewSet,             basename='roles')
router.register(r'permissions',       PermissionViewSet,       basename='permissions')
router.register(r'permission-groups', PermissionGroupViewSet,  basename='permission-groups')

# Clinics
router.register(r'clinics',         ClinicViewSet,         basename='clinics')
router.register(r'practitioners',   PractitionerViewSet,   basename='practitioners')
router.register(r'locations',       LocationViewSet,       basename='locations')
router.register(r'clinic-services', ClinicServiceViewSet,  basename='clinic-services')
router.register(r'clinic-consent-forms', ClinicConsentFormViewSet, basename='clinic-consent-forms')

# Contacts
router.register(r'contacts', ContactViewSet, basename='contacts')

# Appointments
router.register(r'appointments',           AppointmentViewSet,          basename='appointments')
router.register(r'practitioner-schedules', PractitionerScheduleViewSet, basename='practitioner-schedules')
router.register(r'appointment-reminders',  AppointmentReminderViewSet,  basename='appointment-reminders')
router.register(r'block-appointments',      BlockAppointmentViewSet,      basename='block-appointments')
router.register(r'calendar-notes',          CalendarNoteViewSet,          basename='calendar-notes')

# Records
router.register(r'clinical-notes',   ClinicalNoteViewSet,   basename='clinical-notes')
router.register(r'note-templates',   NoteTemplateViewSet,   basename='note-templates')
router.register(r'outcome-measures', OutcomeMeasureViewSet, basename='outcome-measures')
router.register(r'attachments',      AttachmentViewSet,     basename='attachments')
router.register(r'case-documents',   CaseDocumentViewSet,   basename='case-documents')

# Billing
router.register(r'ageing-debt-entries', AgeingDebtEntryViewSet, basename='ageing-debt-entries')
router.register(r'invoices',             InvoiceViewSet,          basename='invoices')
router.register(r'invoice-items',        InvoiceItemViewSet,      basename='invoice-items')
router.register(r'payments',             PaymentViewSet,          basename='payments')
router.register(r'services',             ServiceViewSet,          basename='services')
router.register(r'invoice-batches',      InvoiceBatchViewSet,     basename='invoice-batches')
router.register(r'appointments-print',   AppointmentPrintViewSet, basename='appointments-print')

# Reports
router.register(r'reports', ReportViewSet, basename='reports')

# Integrations
router.register(r'philhealth-claims', PhilHealthClaimViewSet, basename='philhealth-claims')
router.register(r'hmo-claims',        HMOClaimViewSet,        basename='hmo-claims')


urlpatterns = [
    path('', api_root, name='api-root'),
    path('admin/', admin.site.urls),
    # External Cron Webhook (Must be before router.urls to avoid pk resolution collision)
    path('api/appointments/trigger-reminders/', TriggerRemindersWebhookView.as_view(), name='trigger-reminders'),

    path('api/', include(router.urls)),

    path('api/', include('apps.patients.urls')),
    path('api/clinical-templates/', include('apps.clinical_templates.urls')),
    path('api/letters/', include('apps.letters.urls')),
    path('api/', include('apps.inventory.urls')),
    path('api/', include('apps.contacts.urls')),
    path('api/', include('apps.messages.urls')),
    path('api/', include('apps.notifications.urls')),
    path('api/subscription/', include('apps.subscriptions.urls')),

    path('api/auth/verify-token/', AuthViewSet.as_view({'post': 'verify_token'}), name='verify-token'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # SMS webhook (Twilio inbound)
    path('api/sms/reply-webhook/', SMSReplyWebhookView.as_view(), name='sms-reply-webhook'),

    # Public rebooking (no auth required)
    path('api/appointments/rebook/<uuid:token>/', PublicRebookingLinkView.as_view(), name='public-rebooking'),
    path('api/appointments/rebook/<uuid:token>/slots/', PublicRebookingSlotsView.as_view(), name='public-rebooking-slots'),

    # Public email confirmation/cancellation (no auth required)
    path('api/appointments/confirm-email/<uuid:token>/', PublicAppointmentConfirmView.as_view(), name='public-confirm-email'),
    path('api/appointments/cancel-email/<uuid:token>/', PublicAppointmentCancelView.as_view(), name='public-cancel-email'),

]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)