from django.db import models
from apps.common.models import TimeStampedModel, SoftDeleteModel


# ═══════════════════════════════════════════════════════════════════════
# Letter Templates
# ═══════════════════════════════════════════════════════════════════════

class LetterTemplate(TimeStampedModel, SoftDeleteModel):
    """
    Reusable letter templates with rich-text HTML content and merge fields.

    Architecture Decisions:
    - Separate from ClinicalTemplate (JSON schema forms vs HTML documents)
    - Clinic-scoped for multi-tenancy
    - Versioned via clone-on-edit pattern
    - Merge fields resolved at render time, not stored
    """

    CATEGORY_CHOICES = [
        ('REFERRAL', 'Referral Letter'),
        ('REPORT', 'Clinical Report'),
        ('GENERAL', 'General Letter'),
        ('MEDICAL_CERT', 'Medical Certificate'),
        ('CUSTOM', 'Custom'),
    ]

    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='letter_templates',
        help_text='Template is scoped to this clinic',
    )
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_letter_templates',
    )

    # Metadata
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        default='GENERAL',
    )

    # Content
    content_html = models.TextField(
        help_text='Rich-text HTML body with merge-field placeholders e.g. {{patient.full_name}}',
    )
    header_html = models.TextField(
        blank=True,
        default='',
        help_text='Custom header HTML override. Empty = use clinic defaults.',
    )
    footer_html = models.TextField(
        blank=True,
        default='',
        help_text='Custom footer HTML override. Empty = use clinic defaults.',
    )

    # Branding options
    include_logo = models.BooleanField(default=True)
    include_signature = models.BooleanField(default=True)

    # Merge-field metadata (informational — aids the frontend picker)
    merge_fields = models.JSONField(
        default=list,
        blank=True,
        help_text='List of available merge field keys for this template',
    )

    # Versioning
    version = models.PositiveIntegerField(default=1)
    parent_template = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='versions',
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'letter_templates'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['clinic', 'is_active']),
            models.Index(fields=['category']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['clinic', 'name', 'version'],
                name='unique_letter_template_version_per_clinic',
            )
        ]

    def __str__(self):
        return f"{self.name} v{self.version} — {self.clinic.name}"

    def create_new_version(self, user):
        """Clone this template as a new version."""
        new = LetterTemplate.objects.create(
            clinic=self.clinic,
            created_by=user,
            name=self.name,
            description=self.description,
            category=self.category,
            content_html=self.content_html,
            header_html=self.header_html,
            footer_html=self.footer_html,
            include_logo=self.include_logo,
            include_signature=self.include_signature,
            merge_fields=list(self.merge_fields),
            version=self.version + 1,
            parent_template=self.parent_template or self,
            is_active=True,
        )
        self.is_active = False
        self.save(update_fields=['is_active'])
        return new


# ═══════════════════════════════════════════════════════════════════════
# Generated Letters
# ═══════════════════════════════════════════════════════════════════════

class Letter(TimeStampedModel, SoftDeleteModel):
    """
    A letter generated from a LetterTemplate, bound to a patient and optionally
    to a case/appointment.

    Architecture Decisions:
    - Content is stored as rendered HTML (merge fields already resolved)
    - PDF is generated server-side and cached in `rendered_pdf`
    - Follows the same signing/emailing pattern as ClinicalNote
    """

    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('FINAL', 'Final'),
        ('SENT', 'Sent'),
    ]

    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.CASCADE,
        related_name='letters',
    )
    patient_case = models.ForeignKey(
        'patients.PatientCase',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='letters',
    )
    appointment = models.ForeignKey(
        'appointments.Appointment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='letters',
    )
    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='letters',
    )
    practitioner = models.ForeignKey(
        'clinics.Practitioner',
        on_delete=models.SET_NULL,
        null=True,
        related_name='letters',
    )
    template = models.ForeignKey(
        LetterTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='letters',
        help_text='Source template (audit reference only)',
    )

    # Content
    subject = models.CharField(max_length=255)
    content_html = models.TextField(
        help_text='Final rendered HTML with merge fields resolved',
    )
    rendered_pdf = models.FileField(
        upload_to='letters/pdfs/',
        null=True,
        blank=True,
        help_text='Cached PDF version of this letter',
    )

    # Status
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='DRAFT',
    )
    is_signed = models.BooleanField(default=False)
    signed_at = models.DateTimeField(null=True, blank=True)
    signature_data = models.TextField(
        blank=True,
        default='',
        help_text='Base64-encoded PNG digital signature',
    )

    # Email tracking
    sent_to = models.JSONField(
        default=list,
        blank=True,
        help_text='List of recipient email addresses',
    )
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'letters'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['patient', '-created_at']),
            models.Index(fields=['patient_case', '-created_at']),
            models.Index(fields=['clinic', '-created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.subject} — {self.patient.get_full_name()}"
