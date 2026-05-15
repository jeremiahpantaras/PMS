from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone
from apps.common.models import TimeStampedModel, SoftDeleteModel
from apps.common.validators import validate_ph_phone

# ── RBAC Feature Keys ─────────────────────────────────────────────────────────
FEATURE_KEYS = [
    'dashboard',
    'appointments',
    'calendar',
    'diary',
    'clinical_notes',
    'client_cases',
    'patients',
    'reports',
    'inventory',
    'invoices',
    'billing',
    'subscriptions',
    # 'setup' kept for sidebar lock-icon; page access is always granted.
    'setup',
    'staff_management',
    'permissions',
    'settings',
    'documents',
    'outcome_measures',
    'contacts',
    'communication',
    # Granular Setup card permissions — each controls one card inside /setup
    'setup_practice',
    'setup_items',
    'setup_users',
    'setup_account',
    'setup_communication',
    # Granular Manage card permissions — each controls one card inside /manage
    'manage_administration',
    'manage_clinical',
    'manage_communications',
    # Granular Report card permissions — each controls one card inside /reports
    'reports_administration',
    'reports_clinic',
    'reports_financial',
    'reports_performance',
]

# Default permission matrices for each role template
DEFAULT_PERMISSIONS = {
    'OWNER': {key: 'edit' for key in FEATURE_KEYS},
    'MANAGER': {
        'dashboard': 'edit',
        'appointments': 'edit',
        'calendar': 'edit',
        'diary': 'edit',
        'clinical_notes': 'edit',
        'client_cases': 'edit',
        'patients': 'edit',
        'reports': 'edit',
        'inventory': 'edit',
        'invoices': 'edit',
        'billing': 'edit',
        'subscriptions': 'view',
        'setup': 'view',
        'staff_management': 'edit',
        'permissions': 'view',
        'settings': 'view',
        'documents': 'edit',
        'outcome_measures': 'edit',
        'contacts': 'edit',
        'communication': 'edit',
        # Granular setup card permissions
        'setup_practice':      'edit',
        'setup_items':         'edit',
        'setup_users':         'edit',
        'setup_account':       'view',
        'setup_communication': 'edit',
        # Granular manage card permissions
        'manage_administration': 'edit',
        'manage_clinical':       'edit',
        'manage_communications': 'edit',
        # Granular report card permissions
        'reports_administration': 'edit',
        'reports_clinic':         'edit',
        'reports_financial':      'edit',
        'reports_performance':    'edit',
    },
    'FRONTDESK': {
        'dashboard': 'view',
        'appointments': 'edit',
        'calendar': 'edit',
        'diary': 'edit',
        'clinical_notes': 'view',
        'client_cases': 'view',
        'patients': 'edit',
        'reports': 'view',
        'inventory': 'view',
        'invoices': 'edit',
        'billing': 'view',
        'subscriptions': 'none',
        'setup': 'none',
        'staff_management': 'none',
        'permissions': 'none',
        'settings': 'none',
        'documents': 'view',
        'outcome_measures': 'view',
        'contacts': 'edit',
        'communication': 'edit',
        # Granular setup card permissions
        'setup_practice':      'view',
        'setup_items':         'view',
        'setup_users':         'none',
        'setup_account':       'none',
        'setup_communication': 'view',
        # Granular manage card permissions
        'manage_administration': 'view',
        'manage_clinical':       'view',
        'manage_communications': 'edit',
        # Granular report card permissions
        'reports_administration': 'edit',
        'reports_clinic':         'view',
        'reports_financial':      'edit',
        'reports_performance':    'view',
    },
    'PRACTITIONER': {
        'dashboard': 'view',
        'appointments': 'edit',
        'calendar': 'edit',
        'diary': 'edit',
        'clinical_notes': 'edit',
        'client_cases': 'edit',
        'patients': 'edit',
        'reports': 'view',
        'inventory': 'view',
        'invoices': 'view',
        'billing': 'none',
        'subscriptions': 'none',
        'setup': 'none',
        'staff_management': 'none',
        'permissions': 'none',
        'settings': 'none',
        'documents': 'edit',
        'outcome_measures': 'edit',
        'contacts': 'edit',
        'communication': 'view',
        # Granular setup card permissions
        'setup_practice':      'view',
        'setup_items':         'none',
        'setup_users':         'none',
        'setup_account':       'none',
        'setup_communication': 'view',
        # Granular manage card permissions
        'manage_administration': 'none',
        'manage_clinical':       'edit',
        'manage_communications': 'view',
        # Granular report card permissions
        'reports_administration': 'none',
        'reports_clinic':         'edit',
        'reports_financial':      'none',
        'reports_performance':    'view',
    },
}

# ── Multi-Role Helpers ────────────────────────────────────────────────────────

# Role precedence used to derive the "primary" role field when a user has
# multiple roles (highest priority wins).
ROLE_PRIORITY = ['ADMIN', 'PRACTITIONER', 'STAFF']

# Default permission matrix per role — used for union-based access when a user
# has no explicit PermissionGroup assigned but holds multiple roles.
ROLE_DEFAULT_PERMISSIONS = {
    'ADMIN':        {key: 'edit' for key in FEATURE_KEYS},
    'PRACTITIONER': DEFAULT_PERMISSIONS['PRACTITIONER'],
    'STAFF':        DEFAULT_PERMISSIONS['FRONTDESK'],
}

ACCESS_LEVELS = {'none': 0, 'view': 1, 'edit': 2}
REVERSE_ACCESS = {v: k for k, v in ACCESS_LEVELS.items()}


def _union_permissions(roles: list) -> dict:
    """
    Return a {feature_key: access_level} dict that is the union (max level)
    of all default permission matrices for the given roles.
    """
    result = {key: 0 for key in FEATURE_KEYS}
    for role in roles:
        matrix = ROLE_DEFAULT_PERMISSIONS.get(role, {})
        for key in FEATURE_KEYS:
            level = ACCESS_LEVELS.get(matrix.get(key, 'none'), 0)
            if level > result[key]:
                result[key] = level
    return {key: REVERSE_ACCESS[v] for key, v in result.items()}


# ── RBAC Models ───────────────────────────────────────────────────────────────

class PermissionGroup(TimeStampedModel):
    """
    A clinic-specific permission group that defines a set of feature-level
    access levels. Acts as both a reusable template and actual assignment target.
    """
    TEMPLATE_CHOICES = [
        ('OWNER',        'Owner'),
        ('MANAGER',      'Manager'),
        ('FRONTDESK',    'Frontdesk'),
        ('PRACTITIONER', 'Practitioner'),
        ('CUSTOM',       'Custom'),
    ]

    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='permission_groups',
        help_text='The clinic this permission group belongs to.',
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    role_template = models.CharField(
        max_length=20,
        choices=TEMPLATE_CHOICES,
        default='CUSTOM',
        help_text='Starting template used to seed default permissions.',
    )
    is_protected = models.BooleanField(
        default=False,
        help_text='Protected groups (e.g. Owner) cannot be deleted.',
    )
    is_system_template = models.BooleanField(
        default=False,
        help_text='System-seeded defaults; one per clinic per role template.',
    )

    class Meta:
        db_table = 'permission_groups'
        unique_together = [('clinic', 'name')]
        ordering = ['role_template', 'name']

    def __str__(self):
        return f"{self.name} ({self.clinic.name})"

    def get_permission(self, feature_key: str) -> str:
        """Return the access level for a feature, defaulting to 'none'."""
        try:
            return self.feature_permissions.get(feature_key=feature_key).access_level
        except FeaturePermission.DoesNotExist:
            return 'none'

    def get_permissions_dict(self) -> dict:
        """Return {feature_key: access_level} for ALL known features.
        Features without an explicit FeaturePermission record default to 'none'.
        """
        existing = {
            fp.feature_key: fp.access_level
            for fp in self.feature_permissions.all()
        }
        return {key: existing.get(key, 'none') for key in FEATURE_KEYS}


class FeaturePermission(models.Model):
    """
    A single feature → access_level mapping within a PermissionGroup.
    """
    ACCESS_CHOICES = [
        ('none', 'No Access'),
        ('view', 'View'),
        ('edit', 'Edit'),
    ]

    group = models.ForeignKey(
        PermissionGroup,
        on_delete=models.CASCADE,
        related_name='feature_permissions',
    )
    feature_key = models.CharField(
        max_length=100,
        help_text='One of the FEATURE_KEYS constants.',
    )
    access_level = models.CharField(
        max_length=10,
        choices=ACCESS_CHOICES,
        default='none',
    )

    class Meta:
        db_table = 'feature_permissions'
        unique_together = [('group', 'feature_key')]

    def __str__(self):
        return f"{self.group.name} | {self.feature_key} → {self.access_level}"


# ── User Manager ──────────────────────────────────────────────────────────────

class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication"""
    
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        # normalize_email only lowercases the domain; lower() covers the local part too.
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'ADMIN')
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser, TimeStampedModel, SoftDeleteModel):
    """Custom User model with role-based access control"""
    
    ROLE_CHOICES = [
        ('ADMIN', 'Administrator'),
        ('PRACTITIONER', 'Practitioner'),
        ('STAFF', 'Staff'),
    ]
    
    username = None  # Remove username field
    email = models.EmailField(unique=True, db_index=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='STAFF')
    phone = models.CharField(max_length=15, blank=True, validators=[validate_ph_phone])
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    # Password change tracking
    password_changed = models.BooleanField(default=False)

    # Mandatory first-login password change flag
    # Set to True when a temporary password is issued (admin registration / forced reset).
    # Must be cleared by the user completing the ChangePasswordPage flow.
    must_change_password = models.BooleanField(
        default=False,
        help_text='Forces the user to set a new password before accessing the application.'
    )

    # Password rotation schedule
    ROTATION_CHOICES = [
        ('none',    'None'),
        ('weekly',  'Weekly'),
        ('monthly', 'Monthly'),
        ('yearly',  'Yearly'),
    ]
    password_rotation    = models.CharField(
        max_length=10, choices=ROTATION_CHOICES, default='none',
        help_text='Automatic password rotation schedule'
    )
    last_password_change = models.DateTimeField(
        null=True, blank=True,
        help_text='Timestamp of the last password change'
    )

    # Temporary credential expiry — set when a system-generated password is issued.
    # Login is rejected (and admin must reset the account) if this timestamp passes
    # before the user completes the mandatory first-login password change.
    temp_password_expires_at = models.DateTimeField(
        null=True, blank=True,
        help_text='Expiry timestamp for system-issued temporary credentials. '
                  'Null means no TTL is enforced.'
    )

    # Staff position/title (e.g., "Clinic Desk", "Office Manager")
    position = models.CharField(max_length=200, blank=True)

    # Discipline (for STAFF role — PRACTITIONERs use the Practitioner model)
    discipline = models.CharField(max_length=200, blank=True)

    # Clinic association (main clinic)
    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )

    # ✅ NEW: Specific branch assignment (optional — null means "all branches")
    clinic_branch = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='branch_users',
        help_text='Specific branch this staff/practitioner is assigned to. '
                  'Null means they work across all branches.'
    )

    # ── Availability (for STAFF role — PRACTITIONERs use the Practitioner model) ──
    duty_days = models.JSONField(
        default=list,
        blank=True,
        help_text='List of duty days for staff, e.g. ["Mon","Tue"]'
    )
    lunch_start_time = models.CharField(
        max_length=5, blank=True, default='12:00',
        help_text='Lunch start HH:MM'
    )
    lunch_end_time = models.CharField(
        max_length=5, blank=True, default='13:00',
        help_text='Lunch end HH:MM'
    )
    # Split-shift schedule: {"Mon": [{"start":"08:00","end":"11:00"}, ...], ...}
    duty_schedule = models.JSONField(
        null=True, blank=True, default=None,
        help_text='Per-day list of {start, end} blocks (Staff scheduling)'
    )

    # ── RBAC: Permission Group assignment ─────────────────────────────────────
    permission_group = models.ForeignKey(
        'accounts.PermissionGroup',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
        help_text='The RBAC permission group assigned to this user. '
                  'Overrides role-based defaults for feature-level access.',
    )

    # ── Multi-Role: ordered list of assigned roles ─────────────────────────
    # e.g. ["ADMIN", "PRACTITIONER"] — kept in sync with `role` (primary).
    roles = models.JSONField(
        default=list,
        blank=True,
        help_text='All roles assigned to this user. '
                  'The highest-priority entry drives the `role` field.'
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']
    
    objects = UserManager()
    
    class Meta:
        db_table = 'users'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
            models.Index(fields=['clinic_branch']),   # ✅ NEW index
        ]
    
    def save(self, *args, **kwargs):
        # Always persist email in lowercase to prevent case-sensitive duplicates.
        if self.email:
            self.email = self.email.strip().lower()

        # ── Multi-role sync ──────────────────────────────────────────────────
        # Ensure `roles` is a valid, deduplicated list.
        if not isinstance(self.roles, list):
            self.roles = [self.role] if self.role else []
        else:
            # Deduplicate while preserving priority order
            seen = set()
            cleaned = []
            for r in self.roles:
                if r in dict(self.ROLE_CHOICES) and r not in seen:
                    cleaned.append(r)
                    seen.add(r)
            self.roles = cleaned

        # If roles is empty, seed from the existing `role` field.
        if not self.roles and self.role:
            self.roles = [self.role]

        # Derive primary `role` from the highest-priority entry in `roles`.
        if self.roles:
            for priority_role in ROLE_PRIORITY:
                if priority_role in self.roles:
                    self.role = priority_role
                    break

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_full_name()} ({self.email})"
    
    @property
    def is_admin(self):
        return 'ADMIN' in (self.roles or [self.role])

    @property
    def is_owner(self):
        """Alias for is_admin — ADMIN role maps to the Owner permission template."""
        return self.is_admin

    @property
    def is_practitioner(self):
        return 'PRACTITIONER' in (self.roles or [self.role])
    
    @property
    def is_staff_member(self):
        return 'STAFF' in (self.roles or [self.role])
    
    @property
    def needs_password_change(self):
        """Check if user needs to change password"""
        return not self.password_changed

    def get_effective_roles(self) -> list:
        """Return the canonical roles list, always non-empty."""
        r = self.roles or []
        if not r and self.role:
            return [self.role]
        return r

    def has_feature_permission(self, feature_key: str, required_level: str = 'view') -> bool:
        """
        Check whether this user has at least `required_level` access to a feature.

        Access hierarchy: edit > view > none

        Resolution order:
        1. ADMIN in roles → always grant.
        2. permission_group assigned → use the group's explicit matrix.
        3. Fallback → union of DEFAULT_PERMISSIONS across all assigned roles.
        """
        effective_roles = self.get_effective_roles()

        if 'ADMIN' in effective_roles:
            return True

        levels = ACCESS_LEVELS
        required = levels.get(required_level, 1)

        if self.permission_group_id:
            actual = levels.get(self.permission_group.get_permission(feature_key), 0)
            return actual >= required

        # No explicit group — union across role defaults
        if not effective_roles:
            return False
        union_map = _union_permissions(effective_roles)
        actual = levels.get(union_map.get(feature_key, 'none'), 0)
        return actual >= required

    def can_view(self, feature_key: str) -> bool:
        return self.has_feature_permission(feature_key, 'view')

    def can_edit(self, feature_key: str) -> bool:
        return self.has_feature_permission(feature_key, 'edit')


class Permission(TimeStampedModel):
    """Custom permissions for fine-grained access control"""
    
    name = models.CharField(max_length=100, unique=True)
    codename = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    
    class Meta:
        db_table = 'permissions'
    
    def __str__(self):
        return self.name


class Role(TimeStampedModel):
    """Role model for grouping permissions"""
    
    name = models.CharField(max_length=50, unique=True)
    permissions = models.ManyToManyField(Permission, related_name='roles')
    description = models.TextField(blank=True)
    
    class Meta:
        db_table = 'roles'
    
    def __str__(self):
        return self.name


# ── Audit: Role Change Log ────────────────────────────────────────────────────

class UserRoleChangeLog(models.Model):
    """
    Immutable audit record for every role assignment change.

    Written whenever an admin adds or removes a role from a user.
    Stored separately to keep the audit trail even if the user is deleted.
    """
    ACTION_CHOICES = [
        ('add',    'Role Added'),
        ('remove', 'Role Removed'),
    ]

    target_user_id    = models.IntegerField(db_index=True)
    target_user_email = models.CharField(max_length=255)
    changed_by_id     = models.IntegerField(null=True, db_index=True)
    changed_by_email  = models.CharField(max_length=255, blank=True)
    action            = models.CharField(max_length=10, choices=ACTION_CHOICES)
    role              = models.CharField(max_length=20)
    roles_before      = models.JSONField(default=list)
    roles_after       = models.JSONField(default=list)
    timestamp         = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = 'user_role_change_log'
        ordering = ['-timestamp']

    def __str__(self):
        return (
            f"[{self.timestamp:%Y-%m-%d %H:%M}] "
            f"{self.action.upper()} {self.role} "
            f"for {self.target_user_email} by {self.changed_by_email}"
        )