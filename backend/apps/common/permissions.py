from rest_framework.permissions import BasePermission


class IsAdminOrStaffOnly(BasePermission):
    """
    Denies access to users with ONLY the PRACTITIONER role.
    Allows users who have ADMIN or STAFF in their roles list.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        effective = request.user.get_effective_roles()
        return bool({'ADMIN', 'STAFF'} & set(effective))


class IsAdminOnly(BasePermission):
    """Only users with the ADMIN role may proceed."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return 'ADMIN' in request.user.get_effective_roles()


class HasFeaturePermission(BasePermission):
    """
    Dynamic permission class for RBAC feature-level access.

    Usage in a ViewSet:
        permission_classes = [IsAuthenticated, HasFeaturePermission]
        rbac_feature   = 'appointments'   # required
        rbac_min_level = 'view'           # optional, defaults to 'view'

    For write operations (POST/PUT/PATCH/DELETE), min_level is automatically
    elevated to 'edit'.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        feature   = getattr(view, 'rbac_feature', None)
        min_level = getattr(view, 'rbac_min_level', 'view')

        if not feature:
            # No feature declared — fall through (no RBAC restriction)
            return True

        # Elevate to 'edit' for state-changing methods
        if request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
            min_level = 'edit'

        return request.user.has_feature_permission(feature, min_level)
