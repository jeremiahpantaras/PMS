from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from apps.common.models import TimeStampedModel, SoftDeleteModel
from apps.common.validators import validate_ph_phone


class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication"""
    
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
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

    # Staff position/title (e.g., "Clinic Desk", "Office Manager")
    position = models.CharField(max_length=200, blank=True)
    
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
    
    def __str__(self):
        return f"{self.get_full_name()} ({self.email})"
    
    @property
    def is_admin(self):
        return self.role == 'ADMIN'
    
    @property
    def is_practitioner(self):
        return self.role == 'PRACTITIONER'
    
    @property
    def is_staff_member(self):
        return self.role == 'STAFF'
    
    @property
    def needs_password_change(self):
        """Check if user needs to change password"""
        return not self.password_changed


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