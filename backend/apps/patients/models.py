from django.db import models
from django.utils.crypto import get_random_string
from apps.common.models import TimeStampedModel, SoftDeleteModel
from apps.common.validators import validate_international_phone


class Patient(TimeStampedModel, SoftDeleteModel):
    """Patient demographic and contact information"""

    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]

    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='patients'
    )

    home_branch = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='home_patients',
        help_text='The specific clinic branch this patient belongs to.'
    )

    first_name  = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    last_name   = models.CharField(max_length=100)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)

    email       = models.EmailField()  # required — enforced at serializer and model level
    phone       = models.CharField(max_length=15, validators=[validate_international_phone])
    address     = models.TextField(blank=True)
    barangay    = models.CharField(max_length=100, blank=True)
    city        = models.CharField(max_length=100, blank=True)
    province    = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=10, blank=True)

    # Emergency contact is required only for minor patients (< 18 years old);
    # blank=True allows adult records without an emergency contact.
    emergency_contact_name         = models.CharField(max_length=200, blank=True)
    emergency_contact_phone        = models.CharField(max_length=15, blank=True, validators=[validate_international_phone])
    emergency_contact_relationship = models.CharField(max_length=100, blank=True)

    philhealth_number = models.CharField(max_length=50, blank=True)
    hmo_provider      = models.CharField(max_length=200, blank=True)
    hmo_number        = models.CharField(max_length=100, blank=True)

    medical_conditions = models.TextField(blank=True)
    allergies          = models.TextField(blank=True)
    medications        = models.TextField(blank=True)

    patient_number = models.CharField(max_length=50, unique=True, editable=False)
    avatar         = models.ImageField(upload_to='patient_avatars/', null=True, blank=True)
    is_active      = models.BooleanField(default=True)

    # Notification Settings
    send_email_notifications = models.BooleanField(
        default=True,
        help_text='Send email notifications automatically for appointment reminders.',
    )
    sms_notifications_enabled = models.BooleanField(
        default=True,
        help_text='Send SMS notifications for appointment reminders (when SMS is enabled).',
    )
    allow_push_notifications = models.BooleanField(
        default=False,
        help_text='Allow push notifications for updates and reminders.',
    )
    data_sharing_preferences = models.JSONField(
        default=dict,
        blank=True,
        help_text='Patient preferences for data sharing with third parties.',
    )
    
    # ── Billing & Account ─────────────────────────────────────────────────────
    account_notes = models.TextField(
        blank=True,
        default='',
        help_text='Internal notes regarding the patient\'s overall account and billing status.',
    )

    # ── Communication workflow fields ─────────────────────────────────────────
    last_visit_date = models.DateField(
        null=True,
        blank=True,
        help_text='Date of the patient\'s most recent completed appointment.',
    )
    last_checkin_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Last time an inactive-patient wellness check-in was sent.',
    )

    # Archive fields
    is_archived = models.BooleanField(
        default=False,
        db_index=True,
        help_text='Archived patients are hidden from the active client list and diary.',
    )
    archived_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Timestamp when the patient was archived.',
    )
    archived_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='archived_patients',
        help_text='Staff member who archived this patient.',
    )
    # Merge fields (Patient Identity Management)
    is_merged = models.BooleanField(
        default=False,
        db_index=True,
        help_text='Indicates this duplicate patient was merged into a primary patient.',
    )
    merged_into = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='merged_duplicates',
        help_text='The primary patient this duplicate was merged into.'
    )
    merged_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Timestamp when the patient was merged.',
    )
    merged_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='merged_patients',
        help_text='Staff member who performed the merge.',
    )
    class Meta:
        db_table = 'patients'
        ordering = ['last_name', 'first_name']
        indexes = [
            models.Index(fields=['clinic', 'last_name', 'first_name']),
            models.Index(fields=['patient_number']),
            models.Index(fields=['clinic', 'is_archived'], name='patient_clinic_archived_idx'),
        ]

    def __str__(self):
        return f"{self.get_full_name()} ({self.patient_number})"

    def get_full_name(self):
        middle = f" {self.middle_name} " if self.middle_name else " "
        return f"{self.first_name}{middle}{self.last_name}"

    def archive(self, archived_by_user):
        """Archive this patient — hides them and their appointments from the diary."""
        from django.utils import timezone
        self.is_archived = True
        self.archived_at = timezone.now()
        self.archived_by = archived_by_user
        self.save(update_fields=['is_archived', 'archived_at', 'archived_by'])

    def restore(self):
        """Restore an archived patient — makes them and their appointments visible again."""
        self.is_archived = False
        self.archived_at = None
        self.archived_by = None
        self.save(update_fields=['is_archived', 'archived_at', 'archived_by'])

    def save(self, *args, **kwargs):
        if not self.patient_number:
            from django.utils import timezone
            date_str   = timezone.now().strftime('%Y%m%d')
            last_patient = Patient.objects.filter(
                patient_number__startswith=date_str
            ).order_by('patient_number').last()

            if last_patient:
                last_num = int(last_patient.patient_number.split('-')[1])
                new_num  = last_num + 1
            else:
                new_num = 1

            self.patient_number = f"{date_str}-{new_num:04d}"

        super().save(*args, **kwargs)


class IntakeForm(TimeStampedModel):
    """Patient intake form responses"""

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name='intake_forms'
    )
    completed_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='completed_intake_forms'
    )

    chief_complaint      = models.TextField()
    complaint_onset      = models.CharField(max_length=200)
    past_medical_history = models.TextField(blank=True)
    surgical_history     = models.TextField(blank=True)
    family_history       = models.TextField(blank=True)
    social_history       = models.TextField(blank=True)
    system_review        = models.JSONField(default=dict, blank=True)
    consent_given        = models.BooleanField(default=False)
    consent_date         = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'patient_intake_forms'
        ordering = ['-created_at']

    def __str__(self):
        return f"Intake Form - {self.patient.get_full_name()} - {self.created_at.date()}"


# Patient Portal Models

def generate_portal_token():
    return get_random_string(32)


class ServiceCategory(TimeStampedModel, SoftDeleteModel):
    """Groups portal services (e.g. 'Remedial Massage')."""

    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='portal_service_categories',
    )
    name        = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    sort_order  = models.PositiveIntegerField(default=0)
    is_active   = models.BooleanField(default=True)

    class Meta:
        db_table = 'portal_service_categories'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f"{self.clinic.name} — {self.name}"


class PortalService(TimeStampedModel, SoftDeleteModel):
    """A bookable service shown on the patient portal."""

    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='portal_services',
    )
    category = models.ForeignKey(
        ServiceCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='portal_services',
    )

    name             = models.CharField(max_length=200)
    description      = models.TextField(blank=True)
    duration_minutes = models.PositiveIntegerField(default=60)
    price            = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    image            = models.ImageField(upload_to='portal_service_images/', null=True, blank=True)
    is_active        = models.BooleanField(default=True)
    sort_order       = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'portal_services'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f"{self.clinic.name} — {self.name}"


class PortalLink(TimeStampedModel):
    """Unique shareable booking portal link for a clinic."""

    clinic = models.OneToOneField(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='portal_link',
    )
    token = models.CharField(
        max_length=64,
        unique=True,
        default=generate_portal_token,
    )
    heading     = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    is_active   = models.BooleanField(default=True)

    class Meta:
        db_table = 'portal_links'

    def __str__(self):
        return f"Portal — {self.clinic.name} ({self.token})"

    def regenerate_token(self):
        self.token = generate_portal_token()
        self.save(update_fields=['token'])

    @classmethod
    def get_or_create_for_clinic(cls, clinic):
        obj, created = cls.objects.get_or_create(clinic=clinic)
        return obj, created


class PortalBooking(TimeStampedModel):
    """Booking submitted through the patient portal."""

    STATUS_CHOICES = [
        ('PENDING',   'Pending Review'),
        ('CONFIRMED', 'Confirmed'),
        ('CANCELLED', 'Cancelled'),
        ('COMPLETED', 'Completed'),
    ]

    portal_link = models.ForeignKey(
        PortalLink,
        on_delete=models.CASCADE,
        related_name='bookings',
    )
    service = models.ForeignKey(
        'clinic_services.Service',
        on_delete=models.SET_NULL,
        null=True,
        related_name='portal_bookings',
    )
    practitioner = models.ForeignKey(
        'clinics.Practitioner',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='portal_bookings',
    )
    branch = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='portal_bookings',
        help_text='The specific branch the patient selected when booking.',
    )
    appointment = models.OneToOneField(
        'appointments.Appointment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='portal_booking',
    )

    patient_first_name = models.CharField(max_length=100)
    patient_last_name  = models.CharField(max_length=100)
    patient_email      = models.EmailField()
    patient_phone      = models.CharField(max_length=20)
    patient_date_of_birth = models.DateField(
        null=True,
        blank=True,
        help_text='Date of birth collected during portal booking.',
    )
    notes              = models.TextField(blank=True)

    # Minor & Extended Fields
    patient_emergency_contact_name  = models.CharField(max_length=200, blank=True)
    patient_emergency_contact_phone = models.CharField(max_length=15, blank=True)
    patient_address_street          = models.TextField(blank=True)
    patient_address_barangay        = models.CharField(max_length=100, blank=True)
    patient_address_city            = models.CharField(max_length=100, blank=True)
    patient_address_province        = models.CharField(max_length=100, blank=True)

    appointment_date = models.DateField()
    appointment_time = models.TimeField()

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING',
        db_index=True,
    )
    reference_number = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        editable=False,
    )

    class Meta:
        db_table = 'portal_bookings'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['portal_link', 'status']),
            models.Index(fields=['appointment_date', 'appointment_time']),
        ]

    def __str__(self):
        return (
            f"{self.patient_first_name} {self.patient_last_name} — "
            f"{self.service} @ {self.appointment_date} {self.appointment_time}"
        )

    def save(self, *args, **kwargs):
        if not self.reference_number:
            from django.utils import timezone
            prefix = timezone.now().strftime('%Y%m%d')
            suffix = get_random_string(6).upper()
            self.reference_number = f"BK-{prefix}-{suffix}"
        super().save(*args, **kwargs)


class PatientConsent(TimeStampedModel):
    """Stores legally required privacy consent with e-signature."""

    CONSENT_FORM = 'CONSENT_FORM'
    TYPE_CHOICES = [
        (CONSENT_FORM, 'Data Privacy Consent Form'),
    ]

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name='consents',
        null=True,
        blank=True,
    )
    portal_link = models.ForeignKey(
        PortalLink,
        on_delete=models.SET_NULL,
        related_name='consents',
        null=True,
        blank=True,
    )
    type = models.CharField(
        max_length=50,
        choices=TYPE_CHOICES,
        default=CONSENT_FORM,
    )
    full_name = models.CharField(max_length=255)
    email = models.EmailField()
    consent_text = models.TextField()
    signature = models.TextField()  # base64 PNG

    class Meta:
        db_table = 'patient_consents'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['portal_link', 'email']),
            models.Index(fields=['patient', 'created_at']),
        ]

    def __str__(self):
        return f"{self.full_name} Consent"


import uuid as _uuid


class ClientFormRequest(TimeStampedModel):
    """
    Secure, single-use token that lets a patient complete their own profile
    details through a public link emailed to them by staff.
    """

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name='client_form_requests',
    )
    token = models.UUIDField(
        default=_uuid.uuid4,
        unique=True,
        editable=False,
        db_index=True,
    )
    expires_at   = models.DateTimeField()
    is_completed = models.BooleanField(default=False, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    accepted_terms   = models.BooleanField(default=False)
    accepted_privacy = models.BooleanField(default=False)
    accepted_at      = models.DateTimeField(null=True, blank=True)
    sent_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_client_form_requests',
    )

    class Meta:
        db_table = 'client_form_requests'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['patient', 'is_completed']),
        ]

    def __str__(self):
        return f"ClientFormRequest({self.patient.get_full_name()}, completed={self.is_completed})"

    @property
    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at


class PatientCase(TimeStampedModel):
    """Patient clinical cases for organizing clinical notes."""

    STATUS_CHOICES = [
        ('OPEN', 'Active'),
        ('DISCHARGED', 'Discharged'),
    ]

    PAYER_CHOICES = [
        ('PRIVATE', 'Private Pay'),
        ('HMO', 'HMO'),
        ('INSURANCE', 'Insurance'),
        ('CORPORATE', 'Corporate'),
    ]

    SOURCE_CHOICES = [
        ('MANUAL', 'Manual'),
        ('PACKAGE', 'Prepaid Package'),
        ('HMO', 'HMO Approval'),
    ]

    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.CASCADE,
        related_name='cases'
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')
    primary_practitioner = models.ForeignKey(
        'clinics.Practitioner',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='patient_cases'
    )
    payer = models.CharField(
        max_length=20,
        choices=PAYER_CHOICES,
        blank=True,
        default='',
        help_text='Insurance or payment type for this case.'
    )
    approved_sessions = models.IntegerField(
        null=True,
        blank=True,
        help_text='Maximum number of approved sessions for this case. Null = unlimited.'
    )
    alert_notes = models.TextField(
        blank=True,
        default='',
        help_text='Persistent alert notes visible across all sessions for this case.'
    )
    referred_by = models.CharField(max_length=200, blank=True, default='')
    referral_info = models.TextField(blank=True, default='')
    
    session_source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='MANUAL')
    completed_sessions = models.IntegerField(default=0, help_text='Total used sessions based on invoices.')
    is_unlimited = models.BooleanField(default=False, help_text='True if the allocation has no session limit.')
    is_archived = models.BooleanField(default=False, help_text='True if the case is soft-deleted.')

    # Package Billing Fields
    package_invoice = models.ForeignKey(
        'billing.Invoice',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='package_cases',
        help_text='The designated Package Invoice for financial tracking.'
    )
    package_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text='Total cost of the package.')
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text='Total amount paid for this package.')

    class Meta:
        db_table = 'patient_cases'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['patient', 'status']),
            models.Index(fields=['patient', '-created_at']),
        ]

    def __str__(self):
        return f"{self.title} - {self.patient.get_full_name()}"

    @property
    def outstanding_balance(self):
        """Returns the outstanding balance for the package."""
        return max(0, self.package_cost - self.amount_paid)

    @property
    def package_status(self):
        """Returns the financial status of the package."""
        if self.session_source != 'PACKAGE':
            return None
        if self.package_cost <= 0:
            return 'PAID'  # Free package or cost not set
        if self.amount_paid >= self.package_cost:
            return 'PAID'
        if self.amount_paid > 0:
            return 'PARTIALLY_PAID'
        return 'UNPAID'



    @property
    def remaining_sessions(self):
        if self.is_unlimited or self.approved_sessions is None:
            return None
        return max(0, self.approved_sessions - self.completed_sessions)


class SessionConsumptionLog(TimeStampedModel):
    """
    Complete audit trail for session consumption.
    A session is considered USED ONLY when an invoice is successfully generated.
    """
    ACTION_CHOICES = [
        ('USED', 'Used'),
        ('ADDED', 'Added'),
        ('REMOVED', 'Removed'),
        ('RESET', 'Reset'),
        ('UNLIMITED_SET', 'Set to Unlimited'),
    ]

    patient_case = models.ForeignKey(
        PatientCase,
        on_delete=models.CASCADE,
        related_name='consumption_logs'
    )
    appointment = models.ForeignKey(
        'appointments.Appointment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='session_logs'
    )
    invoice = models.ForeignKey(
        'billing.Invoice',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='session_logs'
    )
    practitioner = models.ForeignKey(
        'clinics.Practitioner',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='session_logs'
    )
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text='User who triggered the action'
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    reason = models.TextField(blank=True, help_text='Reason for manual adjustments or consumption notes')

    class Meta:
        db_table = 'session_consumption_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['patient_case', 'action']),
        ]

    def __str__(self):
        return f"[{self.action}] Case {self.patient_case_id}"


class PatientCaseSessionLog(TimeStampedModel):
    """Audit log for changes to a patient case's session allocation limits."""
    
    ACTION_CHOICES = [
        ('ADDED_SESSIONS', 'Added Sessions'),
        ('REMOVED_SESSIONS', 'Removed Sessions'),
        ('REMOVED_LIMIT', 'Removed Limit'),
    ]

    patient_case = models.ForeignKey(
        PatientCase,
        on_delete=models.CASCADE,
        related_name='session_logs'
    )
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text='User who made the change'
    )
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    amount = models.IntegerField(
        null=True, 
        blank=True,
        help_text='Number of sessions added or removed. Null if limit was removed.'
    )
    previous_limit = models.IntegerField(
        null=True, 
        blank=True,
        help_text='The approved_sessions limit before this action'
    )
    new_limit = models.IntegerField(
        null=True, 
        blank=True,
        help_text='The approved_sessions limit after this action'
    )

    class Meta:
        db_table = 'patient_case_session_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.action}] Case {self.patient_case_id} by User {self.user_id}"


class PatientConsentDocument(TimeStampedModel):
    """
    Legal audit record that preserves the exact content of a signed consent form.
    Stores a snapshot of the header and body content at signing time, preserving
    historical consent records even if the clinic updates their consent form later.
    Supports both Data Privacy Consent and Clinic Consent Form types.
    """

    TYPE_CLINIC_CONSENT = 'CLINIC_CONSENT'
    TYPE_DATA_PRIVACY   = 'DATA_PRIVACY_CONSENT'
    TYPE_CHOICES = [
        (TYPE_CLINIC_CONSENT, 'Clinic Consent Form'),
        (TYPE_DATA_PRIVACY,   'Data Privacy Consent Form'),
    ]

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name='consent_documents',
        null=True,
        blank=True,
    )
    appointment = models.ForeignKey(
        'appointments.Appointment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='consent_documents',
    )
    patient_case = models.ForeignKey(
        'patients.PatientCase',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='consent_documents',
    )
    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='consent_documents',
    )
    type = models.CharField(
        max_length=50,
        choices=TYPE_CHOICES,
        default=TYPE_CLINIC_CONSENT,
    )
    title = models.CharField(max_length=255, default='Clinic Consent Form')

    # Snapshots of the consent content at the time of signing
    header_snapshot = models.TextField(
        blank=True,
        default='',
        help_text='HTML snapshot of the header content when signed',
    )
    body_snapshot = models.TextField(
        blank=True,
        default='',
        help_text='HTML snapshot of the body content when signed',
    )

    # E-signature
    signature = models.TextField(
        help_text='base64 encoded PNG signature image',
    )
    signed_at = models.DateTimeField(
        help_text='Timestamp when the consent was signed',
    )

    # Consent version tracking
    consent_version = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='Version identifier of the consent form when signed',
    )

    # Optional: IP address for audit trail
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text='IP address of the signer for audit purposes',
    )

    # Patient info at time of signing (for records where patient FK may be null)
    signer_full_name = models.CharField(max_length=255)
    signer_email = models.EmailField()

    class Meta:
        db_table = 'patient_consent_documents'
        ordering = ['-signed_at']
        verbose_name = 'Patient Consent Document'
        verbose_name_plural = 'Patient Consent Documents'
        constraints = [
            models.UniqueConstraint(
                fields=['patient_case', 'type'],
                name='unique_consent_per_case_type',
                condition=models.Q(patient_case__isnull=False)
            )
        ]
        indexes = [
            models.Index(fields=['patient', 'type']),
            models.Index(fields=['clinic', 'signed_at']),
            models.Index(fields=['appointment']),
        ]

    def __str__(self):
        return f"{self.signer_full_name} - {self.title} ({self.signed_at.date()})"


class PatientMergeLog(TimeStampedModel):
    """
    Immutable audit log for patient merges (Phase 8).
    Records the exact details of the merge operation for historical traceability.
    """
    merge_id = models.CharField(max_length=50, unique=True, editable=False)
    
    primary_patient = models.ForeignKey(
        Patient,
        on_delete=models.DO_NOTHING,  # Preserve log even if patient is later hard deleted
        related_name='merges_as_primary',
        help_text='The patient that survived the merge.'
    )
    duplicate_patient = models.ForeignKey(
        Patient,
        on_delete=models.DO_NOTHING,
        related_name='merges_as_duplicate',
        help_text='The patient that was archived/merged.'
    )
    
    merged_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='patient_merges_performed'
    )
    
    reason = models.TextField(help_text='Reason for merging these profiles.', blank=True)
    
    relationships_transferred = models.JSONField(
        default=dict,
        blank=True,
        help_text='Detailed JSON map of all related IDs transferred. e.g. {"appointments": [1, 2], "cases": [5]}'
    )
    
    class Meta:
        db_table = 'patient_merge_logs'
        ordering = ['-created_at']
        
    def __str__(self):
        return f"Merge {self.merge_id}: {self.duplicate_patient_id} -> {self.primary_patient_id}"
    
    def save(self, *args, **kwargs):
        if not self.merge_id:
            from django.utils import timezone
            from django.utils.crypto import get_random_string
            date_str = timezone.now().strftime('%Y%m%d')
            suffix = get_random_string(8).upper()
            self.merge_id = f"MERGE-{date_str}-{suffix}"
        
        # Enforce immutability if already saved
        if self.pk is not None:
            raise ValueError("PatientMergeLog entries are immutable and cannot be modified.")
            
        super().save(*args, **kwargs)