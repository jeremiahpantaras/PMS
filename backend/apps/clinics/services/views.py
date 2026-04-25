from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.core.cache import cache
from .models import Service
from .serializers import ServiceSerializer
import logging

logger = logging.getLogger(__name__)


class ServiceViewSet(viewsets.ModelViewSet):
    """
    CRUD for clinic services.
    Admin can create/edit/delete; all authenticated users can read.

    GET    /api/clinic-services/            — list
    POST   /api/clinic-services/            — create
    GET    /api/clinic-services/{id}/       — detail
    PATCH  /api/clinic-services/{id}/       — update
    DELETE /api/clinic-services/{id}/       — soft-delete
    PATCH  /api/clinic-services/{id}/toggle_active/  — toggle is_active
    GET    /api/clinic-services/portal_services/     — portal-visible only
    """

    serializer_class   = ServiceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ['is_active', 'show_in_portal']
    search_fields      = ['name', 'description']
    ordering_fields    = ['sort_order', 'name', 'price', 'created_at']

    def get_queryset(self):
        user = self.request.user
        qs   = Service.objects.filter(is_deleted=False).select_related('clinic').prefetch_related('assigned_practitioners')
        if user.clinic:
            return qs.filter(clinic=user.clinic)
        return qs.none()

    def list(self, request, *args, **kwargs):
        """Override list to add per-clinic caching (5 min)."""
        user = request.user
        clinic_id = user.clinic_id if user.clinic else None
        if clinic_id:
            cache_key = f'clinic_services_{clinic_id}'
            cached = cache.get(cache_key)
            if cached is not None:
                return Response(cached)

        response = super().list(request, *args, **kwargs)

        if clinic_id and response.status_code == 200:
            cache.set(f'clinic_services_{clinic_id}', response.data, timeout=300)

        return response

    def perform_create(self, serializer):
        practitioners = serializer.validated_data.pop('assigned_practitioners', [])
        service = serializer.save(clinic=self.request.user.clinic)
        service.assigned_practitioners.set(practitioners)
        cache.delete(f'clinic_services_{self.request.user.clinic_id}')

    def perform_update(self, serializer):
        practitioners = serializer.validated_data.pop('assigned_practitioners', None)
        service = serializer.save()
        if practitioners is not None:
            service.assigned_practitioners.set(practitioners)
        cache.delete(f'clinic_services_{self.request.user.clinic_id}')

    def destroy(self, request, *args, **kwargs):
        """Soft-delete instead of hard delete."""
        instance = self.get_object()
        instance.is_deleted = True
        instance.is_active  = False
        instance.save()
        cache.delete(f'clinic_services_{request.user.clinic_id}')
        logger.info(
            f"Service '{instance.name}' soft-deleted by {request.user.email}"
        )
        return Response(
            {'detail': f"Service '{instance.name}' has been removed."},
            status=status.HTTP_204_NO_CONTENT,
        )

    @action(detail=True, methods=['patch'], url_path='toggle_active')
    def toggle_active(self, request, pk=None):
        """Quick toggle for the is_active flag."""
        service = self.get_object()
        service.is_active = not service.is_active
        service.save(update_fields=['is_active'])
        cache.delete(f'clinic_services_{request.user.clinic_id}')
        return Response(
            {
                'id':        service.id,
                'is_active': service.is_active,
                'detail':    f"Service {'activated' if service.is_active else 'deactivated'}.",
            }
        )

    @action(detail=False, methods=['get'], url_path='portal_services')
    def portal_services(self, request):
        """Return only services visible in the patient portal."""
        qs = self.get_queryset().filter(is_active=True, show_in_portal=True)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

        """Soft-delete instead of hard delete."""
        instance = self.get_object()
        instance.is_deleted = True
        instance.is_active  = False
        instance.save()
        logger.info(
            f"Service '{instance.name}' soft-deleted by {request.user.email}"
        )
        return Response(
            {'detail': f"Service '{instance.name}' has been removed."},
            status=status.HTTP_204_NO_CONTENT,
        )

    @action(detail=True, methods=['patch'], url_path='toggle_active')
    def toggle_active(self, request, pk=None):
        """Quick toggle for the is_active flag."""
        service = self.get_object()
        service.is_active = not service.is_active
        service.save(update_fields=['is_active'])
        return Response(
            {
                'id':        service.id,
                'is_active': service.is_active,
                'detail':    f"Service {'activated' if service.is_active else 'deactivated'}.",
            }
        )

    @action(detail=False, methods=['get'], url_path='portal_services')
    def portal_services(self, request):
        """Return only services visible in the patient portal."""
        qs = self.get_queryset().filter(is_active=True, show_in_portal=True)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)