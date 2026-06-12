from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PatientViewSet, IntakeFormViewSet, PortalBookingDiaryView,
    ServiceCategoryViewSet, PortalServiceViewSet,
    PortalLinkViewSet, PortalBookingAdminViewSet,
    PublicPortalView, PublicPortalBookView, PublicAvailableSlotsView,
    PublicPortalConsentCreateView, PublicClinicConsentDocumentCreateView,
    PublicClinicConsentFormView,
    PublicClientFormView, PublicClientFormVerifyView, PublicClientFormSubmitView,
    PatientCaseViewSet,
)

router = DefaultRouter()
router.register(r'patients',           PatientViewSet,           basename='patient')
router.register(r'intake-forms',       IntakeFormViewSet,        basename='intake-form')
router.register(r'service-categories', ServiceCategoryViewSet,   basename='service-category')
router.register(r'portal-services',    PortalServiceViewSet,     basename='portal-service')
router.register(r'portal-links',       PortalLinkViewSet,        basename='portal-link')
router.register(r'portal-bookings',    PortalBookingAdminViewSet, basename='portal-booking')
router.register(r'patient-cases',      PatientCaseViewSet,       basename='patient-case')

urlpatterns = [
    path('', include(router.urls)),

    path(
        'public/portal/<str:token>/',
        PublicPortalView.as_view(),
        name='public-portal',
    ),
    path(
        'public/portal/<str:token>/book/',
        PublicPortalBookView.as_view(),
        name='public-portal-book',
    ),
    path(
        'public/portal/<str:token>/consent/',
        PublicPortalConsentCreateView.as_view(),
        name='public-portal-consent',
    ),
    path(
        'public/portal/<str:token>/clinic_consent/',
        PublicClinicConsentDocumentCreateView.as_view(),
        name='public-portal-clinic-consent',
    ),
    path(
        'public/portal/<str:token>/clinic_consent/form/',
        PublicClinicConsentFormView.as_view(),
        name='public-portal-clinic-consent-form',
    ),
    path(
        'public/portal/<str:token>/slots/',
        PublicAvailableSlotsView.as_view(),
        name='public-portal-slots',
    ),
    path('portal-bookings/diary/', PortalBookingDiaryView.as_view(), name='portal-bookings-diary'),

    # ── Public Client Form (token-gated, no auth) ─────────────────────────
    path(
        'public/client-form/<uuid:token>/',
        PublicClientFormView.as_view(),
        name='public-client-form',
    ),
    path(
        'public/client-form/<uuid:token>/verify/',
        PublicClientFormVerifyView.as_view(),
        name='public-client-form-verify',
    ),
    path(
        'public/client-form/<uuid:token>/submit/',
        PublicClientFormSubmitView.as_view(),
        name='public-client-form-submit',
    ),
]