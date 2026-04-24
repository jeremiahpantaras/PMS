from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PatientViewSet, IntakeFormViewSet, PortalBookingDiaryView,
    ServiceCategoryViewSet, PortalServiceViewSet,    # ✅ PortalServiceViewSet
    PortalLinkViewSet, PortalBookingAdminViewSet,
    PublicPortalView, PublicPortalBookView, PublicAvailableSlotsView,
    PublicPortalConsentCreateView,
)

router = DefaultRouter()
router.register(r'patients',           PatientViewSet,           basename='patient')
router.register(r'intake-forms',       IntakeFormViewSet,        basename='intake-form')
router.register(r'service-categories', ServiceCategoryViewSet,   basename='service-category')
router.register(r'portal-services',    PortalServiceViewSet,     basename='portal-service')  # ✅
router.register(r'portal-links',       PortalLinkViewSet,        basename='portal-link')
router.register(r'portal-bookings',    PortalBookingAdminViewSet, basename='portal-booking')

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
        'public/portal/<str:token>/slots/',
        PublicAvailableSlotsView.as_view(),
        name='public-portal-slots',
    ),
    path('portal-bookings/diary/', PortalBookingDiaryView.as_view(), name='portal-bookings-diary'),
]