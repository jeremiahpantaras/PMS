from django.db import models
from django.db.models import Q
from apps.common.models import TimeStampedModel, SoftDeleteModel
from apps.common.validators import validate_ph_phone
import re


def generate_branch_code(clinic_name: str, sequence: int) -> str:
    slug = re.sub(r"\s+", "", clinic_name)
    slug = re.sub(r"[^A-Za-z0-9]", "", slug)
    return f"{slug}-{sequence:04d}"


class Clinic(TimeStampedModel, SoftDeleteModel):
    """Main clinic/practice with support for multiple branches"""

    parent_clinic = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='branches',
        help_text='Parent clinic if this is a branch'
    )

    name         = models.CharField(max_length=200)
    branch_code  = models.CharField(
        max_length=100, unique=True,
        help_text='Auto-generated unique branch identifier',
        blank=True, null=True
    )
    slug = models.SlugField(
        max_length=200, unique=True,
        help_text='Public URL slug for this clinic branch (e.g. cebu-clinic)',
        blank=True, null=True
    )
    email        = models.EmailField(blank=True)
    phone        = models.CharField(max_length=15, blank=True, validators=[validate_ph_phone])
    address      = models.TextField(blank=True)
    city         = models.CharField(max_length=200, blank=True)
    province     = models.CharField(max_length=200, blank=True)
    postal_code  = models.CharField(max_length=10, blank=True)

    tin                      = models.CharField(max_length=50, blank=True, verbose_name='TIN')
    philhealth_accreditation = models.CharField(max_length=100, blank=True)

    custom_location = models.CharField(
        max_length=500, blank=True,
        help_text='Manual free-text location when standard search fails'
    )
    latitude  = models.DecimalField(max_digits=9,  decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)

    logo    = models.ImageField(upload_to='clinic_logos/', null=True, blank=True)
    website = models.URLField(blank=True)
    timezone = models.CharField(max_length=50, default='Asia/Manila')

    is_main_branch = models.BooleanField(default=True, help_text='Is this the main clinic?')
    is_active      = models.BooleanField(default=True)

    # ── NEW: tracks whether admin has completed the clinic profile setup ──────
    setup_complete = models.BooleanField(
        default=False,
        help_text='True once the admin has completed the initial clinic profile setup.'
    )

    # ── Notification preferences ──────────────────────────────────────────────
    email_notifications_enabled = models.BooleanField(
        default=True,
        help_text='Master switch: when False, NO automated or manual emails are sent.'
    )
    sms_notifications_enabled = models.BooleanField(
        default=False,
        help_text='Master switch for SMS notifications (placeholder — not yet active).'
    )

    subscription_plan = models.CharField(
        max_length=20,
        choices=[
            ('TRIAL', 'Trial'),
            ('BASIC', 'Basic'),
            ('PROFESSIONAL', 'Professional'),
            ('ENTERPRISE', 'Enterprise'),
        ],
        default='TRIAL'
    )
    subscription_expires = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'clinics'
        ordering = ['name']
        indexes = [
            models.Index(fields=['parent_clinic', 'is_active']),
            models.Index(fields=['branch_code']),
        ]

    def __str__(self):
        if self.parent_clinic:
            return f"{self.parent_clinic.name} - {self.name}"
        return self.name

    def save(self, *args, **kwargs):
        if not self.branch_code:
            if self.parent_clinic:
                root_clinic    = self.parent_clinic
                root_name      = root_clinic.name
                existing_count = Clinic.objects.filter(
                    Q(id=root_clinic.id) | Q(parent_clinic=root_clinic)
                ).count()
                sequence = existing_count + 1
                code = generate_branch_code(root_name, sequence)
                while Clinic.objects.filter(branch_code=code).exists():
                    sequence += 1
                    code = generate_branch_code(root_name, sequence)
            else:
                root_name      = self.name
                existing_count = Clinic.objects.filter(
                    branch_code__startswith=re.sub(r"\s+", "", re.sub(r"[^A-Za-z0-9\s]", "", root_name))
                ).count()
                sequence = existing_count + 1
                code = generate_branch_code(root_name, sequence)
                while Clinic.objects.filter(branch_code=code).exists():
                    sequence += 1
                    code = generate_branch_code(root_name, sequence)

            self.branch_code = code

        if not self.slug:
            from django.utils.text import slugify
            base_slug = slugify(self.name)
            # If name is empty or slugifies to empty string, fallback to branch_code or generic
            if not base_slug:
                base_slug = self.branch_code.lower() if self.branch_code else 'clinic'
            
            slug = base_slug
            sequence = 1
            while Clinic.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{sequence}"
                sequence += 1
            self.slug = slug

        super().save(*args, **kwargs)

    @property
    def is_branch(self):
        return self.parent_clinic is not None

    @property
    def main_clinic(self):
        if self.parent_clinic:
            return self.parent_clinic.main_clinic if self.parent_clinic.parent_clinic else self.parent_clinic
        return self

    def get_all_branches(self):
        if self.is_branch:
            return self.parent_clinic.get_all_branches()
        return Clinic.objects.filter(
            Q(id=self.id) | Q(parent_clinic=self)
        ).filter(is_deleted=False, is_active=True)


class Practitioner(TimeStampedModel, SoftDeleteModel):
    """Healthcare practitioners associated with clinics"""

    user = models.OneToOneField(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='practitioner_profile'
    )
    clinic = models.ForeignKey(
        Clinic,
        on_delete=models.CASCADE,
        related_name='practitioners'
    )

    license_number           = models.CharField(max_length=100)
    specialization           = models.CharField(max_length=200)
    discipline                = models.CharField(max_length=50, choices=[
        ('OCCUPATIONAL_THERAPY', 'Occupational Therapy'),
        ('SPEECH_LANGUAGE_PATHOLOGIST', 'Speech Language Pathologist'),
        ('PHYSICAL_THERAPY', 'Physical Therapy'),
        ('OSTEOPATHY', 'Osteopathy'),
        ('DENTISTRY', 'Dentistry'),
        ('MD_GENERAL_PRACTITIONER', 'MD: General Practitioner'),
    ], default='OCCUPATIONAL_THERAPY')
    prc_license              = models.CharField(max_length=100, blank=True, verbose_name='PRC License')
    philhealth_accreditation = models.CharField(max_length=100, blank=True)

    consultation_fee     = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    bio                  = models.TextField(blank=True)
    is_accepting_patients = models.BooleanField(default=True)

    # ── Practitioner Availability ──────────────────────────────────────────────
    DUTY_DAY_CHOICES = [
        ('Mon', 'Monday'),
        ('Tue', 'Tuesday'),
        ('Wed', 'Wednesday'),
        ('Thu', 'Thursday'),
        ('Fri', 'Friday'),
        ('Sat', 'Saturday'),
        ('Sun', 'Sunday'),
    ]

    duty_days = models.JSONField(
        default=list,
        help_text='List of duty days, e.g. ["Mon", "Tue", "Wed"]'
    )
    duty_start_time = models.TimeField(
        default='08:00',
        help_text='Duty start time (legacy – superseded by duty_schedule)'
    )
    duty_end_time = models.TimeField(
        default='17:00',
        help_text='Duty end time (legacy – superseded by duty_schedule)'
    )
    lunch_start_time = models.TimeField(
        default='12:00',
        help_text='Lunch break start time'
    )
    lunch_end_time = models.TimeField(
        default='13:00',
        help_text='Lunch break end time'
    )
    # Split-shift schedule: {"Mon": [{"start":"08:00","end":"11:00"}, ...], ...}
    # When set, overrides duty_start_time / duty_end_time.
    duty_schedule = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text='Per-day list of {start, end} blocks for split-shift support'
    )

    class Meta:
        db_table = 'practitioners'
        ordering = ['user__last_name', 'user__first_name']

    def __str__(self):
        return f"Dr. {self.user.get_full_name()}"

    @property
    def availability(self):
        """Return availability as a dict for API responses."""
        return {
            'duty_days': self.duty_days or ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            'duty_start_time': self.duty_start_time.strftime('%H:%M') if self.duty_start_time else '08:00',
            'duty_end_time': self.duty_end_time.strftime('%H:%M') if self.duty_end_time else '17:00',
            'lunch_start_time': self.lunch_start_time.strftime('%H:%M') if self.lunch_start_time else '12:00',
            'lunch_end_time': self.lunch_end_time.strftime('%H:%M') if self.lunch_end_time else '13:00',
            'duty_schedule': self.duty_schedule,  # None when not using split shifts
        }


class Location(TimeStampedModel, SoftDeleteModel):
    """Multiple clinic locations"""

    clinic = models.ForeignKey(
        Clinic,
        on_delete=models.CASCADE,
        related_name='locations'
    )

    name        = models.CharField(max_length=200)
    address     = models.TextField()
    city        = models.CharField(max_length=100)
    province    = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=10)
    phone       = models.CharField(max_length=15, validators=[validate_ph_phone])

    is_primary = models.BooleanField(default=False)
    is_active  = models.BooleanField(default=True)

    class Meta:
        db_table = 'clinic_locations'
        ordering = ['-is_primary', 'name']

    def __str__(self):
        return f"{self.clinic.name} - {self.name}"


# ── Clinic Communication Settings ─────────────────────────────────────────────

class ClinicConsentForm(TimeStampedModel):
    """
    Clinic-owned customizable consent form.
    Each clinic can have one active consent form at a time.
    Content is stored as HTML for rich text support.
    """

    clinic = models.OneToOneField(
        Clinic,
        on_delete=models.CASCADE,
        related_name='consent_form',
    )
    title = models.CharField(
        max_length=255,
        default='Patient Consent Form',
        help_text='Display title for this consent form',
    )
    header_content = models.TextField(
        blank=True,
        default='',
        help_text='HTML content for the consent form header',
    )
    body_content = models.TextField(
        blank=True,
        default='',
        help_text='HTML content for the consent form body/terms',
    )
    is_active = models.BooleanField(
        default=False,
        help_text='If true, this branch requires this consent form to be signed',
    )
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_consent_forms',
        help_text='User who initially created the form'
    )
    updated_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_consent_forms',
        help_text='User who last modified the form'
    )

    class Meta:
        db_table = 'clinic_consent_forms'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['clinic', 'is_active']),
        ]

    def __str__(self):
        status = 'ACTIVE' if self.is_active else 'INACTIVE'
        return f"{self.clinic.name} - {self.title} ({status})"


class ClinicCommunicationSettings(TimeStampedModel):
    """
    Per-clinic configuration for the automated communication workflow.
    One-to-one with the main/root Clinic.
    """

    CHANNEL_CHOICES = [
        ('EMAIL', 'Email Only'),
        ('SMS',   'SMS Only'),
        ('BOTH',  'Email & SMS'),
    ]

    clinic = models.OneToOneField(
        Clinic,
        on_delete=models.CASCADE,
        related_name='communication_settings',
    )

    # ── Per-reminder-type channel preferences ────────────────────────────────
    booking_confirmation_method = models.CharField(
        max_length=5,
        choices=CHANNEL_CHOICES,
        default='EMAIL',
        help_text='Channel for booking confirmations.',
    )
    reminder_method = models.CharField(
        max_length=5,
        choices=CHANNEL_CHOICES,
        default='EMAIL',
        help_text='Channel for appointment reminders.',
    )
    cancellation_method = models.CharField(
        max_length=5,
        choices=CHANNEL_CHOICES,
        default='SMS',
        help_text='Channel for appointment cancellation notices.',
    )
    dna_followup_method = models.CharField(
        max_length=5,
        choices=CHANNEL_CHOICES,
        default='SMS',
        help_text='Channel for DNA / did-not-attend follow-ups.',
    )
    rebook_followup_method = models.CharField(
        max_length=5,
        choices=CHANNEL_CHOICES,
        default='EMAIL',
        help_text='Channel for no-rebook delayed follow-ups.',
    )
    inactive_checkin_method = models.CharField(
        max_length=5,
        choices=CHANNEL_CHOICES,
        default='EMAIL',
        help_text='Channel for inactive patient wellness check-ins.',
    )
    profile_creation_method = models.CharField(
        max_length=5,
        choices=CHANNEL_CHOICES,
        default='EMAIL',
        help_text='Channel for new patient profile creation notifications.',
    )

    # ── Reminder timing (hours before appointment) ────────────────────────────
    reminder_hours_before = models.PositiveIntegerField(
        default=24,
        help_text='Send reminder this many hours before the appointment.',
    )

    # ── No-rebook follow-up delay (days) ──────────────────────────────────────
    no_rebook_followup_days = models.PositiveIntegerField(
        default=30,
        help_text='Days to wait after DNA/decline before sending rebook follow-up.',
    )

    # ── Inactive patient threshold (months) ───────────────────────────────────
    inactive_patient_months = models.PositiveIntegerField(
        default=3,
        help_text='Months of inactivity before sending wellness check-in.',
    )

    # ── Feature toggles ──────────────────────────────────────────────────────
    booking_confirmations_enabled = models.BooleanField(
        default=True,
        help_text='Send booking confirmation upon appointment creation.',
    )
    reminders_enabled = models.BooleanField(
        default=True,
        help_text='Send appointment reminders.',
    )
    cancellation_enabled = models.BooleanField(
        default=True,
        help_text='Send notification when an appointment is cancelled.',
    )
    dna_followup_enabled = models.BooleanField(
        default=True,
        help_text='Send follow-up after DNA / patient declines.',
    )
    dna_followup_delay_hours = models.PositiveIntegerField(
        default=0,
        help_text='Hours to wait after DNA before sending follow-up (0 = immediate).',
    )
    rebook_followup_enabled = models.BooleanField(
        default=True,
        help_text='Send delayed rebook follow-up if patient hasn\'t rescheduled.',
    )
    inactive_checkin_enabled = models.BooleanField(
        default=True,
        help_text='Send wellness check-in to inactive patients.',
    )
    profile_creation_enabled = models.BooleanField(
        default=True,
        help_text='Send notification when a new patient profile is created.',
    )

    class Meta:
        db_table = 'clinic_communication_settings'
        verbose_name_plural = 'Clinic communication settings'

    def __str__(self):
        return f"CommSettings — {self.clinic.name}"

    @classmethod
    def get_for_clinic(cls, clinic):
        """Get or create settings for the main/root clinic."""
        main = clinic.main_clinic
        obj, _ = cls.objects.get_or_create(clinic=main)
        return obj