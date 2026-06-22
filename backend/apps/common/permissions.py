from rest_framework.permissions import BasePermission


class IsAdminOrStaffOnly(BasePermission):
    """
    Denies access to users with ONLY the PRACTITIONER role.
    Allows users who have ADMIN, STAFF, or ADMIN_ASSISTANT in their roles list.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        effective = request.user.get_effective_roles()
        return bool({'ADMIN', 'STAFF', 'ADMIN_ASSISTANT'} & set(effective))


class IsAdminOnly(BasePermission):
    """Only users with the ADMIN role may proceed."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return 'ADMIN' in request.user.get_effective_roles()


class IsNotReadOnly(BasePermission):
    """
    Blocks state-changing requests (POST/PUT/PATCH/DELETE) for users whose
    ONLY role is READ_ONLY.  Safe methods (GET/HEAD/OPTIONS) are always allowed.

    Attach to any ViewSet that must enforce read-only restrictions:
        permission_classes = [IsAuthenticated, IsNotReadOnly]
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Safe methods are always allowed for READ_ONLY users
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        effective = request.user.get_effective_roles()
        # Block if the user's ONLY role is READ_ONLY
        if effective == ['READ_ONLY'] or set(effective) == {'READ_ONLY'}:
            return False
        return True


class HasRoleIn(BasePermission):
    """
    Allow access only if the user has at least one of the roles listed in
    ``view.rbac_allowed_roles``.

    Usage:
        class MyViewSet(viewsets.ModelViewSet):
            permission_classes  = [IsAuthenticated, HasRoleIn]
            rbac_allowed_roles  = ['ADMIN', 'ADMIN_ASSISTANT']
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        allowed   = set(getattr(view, 'rbac_allowed_roles', []))
        effective = set(request.user.get_effective_roles())
        return bool(effective & allowed)


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
