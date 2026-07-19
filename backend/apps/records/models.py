from django.db import models
from apps.common.models import TimeStampedModel, SoftDeleteModel


class ClinicalNote(TimeStampedModel, SoftDeleteModel):
    """Clinical notes for patient visits"""
    
    NOTE_TYPE_CHOICES = [
        ('SOAP', 'SOAP Note'),
        ('PROGRESS', 'Progress Note'),
        ('INITIAL', 'Initial Evaluation'),
        ('DISCHARGE', 'Discharge Summary'),
    ]
    
    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.CASCADE,
        related_name='clinical_notes'
    )
    appointment = models.OneToOneField(
        'appointments.Appointment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='clinical_note'
    )
    practitioner = models.ForeignKey(
        'clinics.Practitioner',
        on_delete=models.CASCADE,
        related_name='clinical_notes'
    )
    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='clinical_notes'
    )
    
    note_type = models.CharField(max_length=20, choices=NOTE_TYPE_CHOICES, default='SOAP')
    date = models.DateField()
    
    # SOAP Format
    subjective = models.TextField(blank=True, help_text='Patient reported symptoms')
    objective = models.TextField(blank=True, help_text='Clinical observations')
    assessment = models.TextField(blank=True, help_text='Clinical assessment/diagnosis')
    plan = models.TextField(blank=True, help_text='Treatment plan')
    
    # Additional fields
    vital_signs = models.JSONField(default=dict, blank=True)
    diagnosis_codes = models.JSONField(default=list, blank=True, help_text='ICD-10 codes')
    treatment_codes = models.JSONField(default=list, blank=True)
    
    # Rich text content
    content = models.TextField(blank=True, help_text='Full note content (HTML)')
    
    # Status
    is_signed = models.BooleanField(default=False)
    signed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'clinical_notes'
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['patient', 'date']),
            models.Index(fields=['practitioner', 'date']),
            models.Index(fields=['clinic', 'date']),
        ]
    
    def __str__(self):
        return f"{self.patient.get_full_name()} - {self.date} - {self.get_note_type_display()}"


class NoteTemplate(TimeStampedModel):
    """Reusable templates for clinical notes"""
    
    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='note_templates'
    )
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_templates'
    )
    
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    note_type = models.CharField(max_length=20, choices=ClinicalNote.NOTE_TYPE_CHOICES)
    
    # Template content
    subjective_template = models.TextField(blank=True)
    objective_template = models.TextField(blank=True)
    assessment_template = models.TextField(blank=True)
    plan_template = models.TextField(blank=True)
    
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'note_templates'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class OutcomeMeasure(TimeStampedModel):
    """Track patient outcome measures over time"""
    
    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.CASCADE,
        related_name='outcome_measures'
    )
    practitioner = models.ForeignKey(
        'clinics.Practitioner',
        on_delete=models.CASCADE,
        related_name='outcome_measures'
    )
    
    measure_name = models.CharField(max_length=200, help_text='e.g., Pain Scale, ROM, etc.')
    date = models.DateField()
    score = models.DecimalField(max_digits=10, decimal_places=2)
    max_score = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'outcome_measures'
        ordering = ['-date']
        indexes = [
            models.Index(fields=['patient', 'measure_name', 'date']),
        ]
    
    def __str__(self):
        return f"{self.patient.get_full_name()} - {self.measure_name} - {self.date}"


class Attachment(TimeStampedModel, SoftDeleteModel):
    """File attachments for clinical records"""
    
    ATTACHMENT_TYPE_CHOICES = [
        ('IMAGE', 'Image'),
        ('DOCUMENT', 'Document'),
        ('XRAY', 'X-Ray'),
        ('LAB', 'Lab Result'),
        ('OTHER', 'Other'),
    ]
    
    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    clinical_note = models.ForeignKey(
        ClinicalNote,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='attachments'
    )
    uploaded_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_attachments'
    )
    
    file = models.FileField(upload_to='attachments/')
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=20, choices=ATTACHMENT_TYPE_CHOICES)
    file_size = models.IntegerField(help_text='File size in bytes')
    description = models.TextField(blank=True)
    
    class Meta:
        db_table = 'clinical_attachments'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.file_name} - {self.patient.get_full_name()}"


class CaseDocument(TimeStampedModel, SoftDeleteModel):
    """
    Documents organized by patient case — generated PDFs, letters,
    reports, uploads, and attachments.

    Architecture Decisions:
    - Replaces the limited Attachment model for case-level document management
    - source_type + source_id enable polymorphic linking to clinical notes, letters, etc.
    - Uses the default Django storage backend (FileSystem dev / Cloudinary prod)
    """

    CATEGORY_CHOICES = [
        ('CLINICAL_NOTE', 'Clinical Note'),
        ('LETTER', 'Letter'),
        ('REPORT', 'Report'),
        ('LAB_RESULT', 'Lab Result'),
        ('IMAGING', 'Imaging'),
        ('REFERRAL', 'Referral'),
        ('INSURANCE', 'Insurance'),
        ('ATTACHMENT', 'Attachment'),
        ('OTHER', 'Other'),
    ]

    SOURCE_TYPE_CHOICES = [
        ('UPLOAD', 'Manual Upload'),
        ('CLINICAL_NOTE', 'Clinical Note'),
        ('LETTER', 'Letter'),
        ('REPORT', 'Report'),
    ]

    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.CASCADE,
        related_name='case_documents',
    )
    patient_case = models.ForeignKey(
        'patients.PatientCase',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='documents',
    )
    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='case_documents',
    )
    uploaded_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_case_documents',
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        default='OTHER',
    )

    # Source tracking (polymorphic-like reference without GenericFK)
    source_type = models.CharField(
        max_length=20,
        choices=SOURCE_TYPE_CHOICES,
        default='UPLOAD',
    )
    source_id = models.IntegerField(
        null=True,
        blank=True,
        help_text='PK of the source record (ClinicalNote, Letter, etc.)',
    )

    # File
    file = models.FileField(upload_to='case_documents/')
    file_name = models.CharField(max_length=255)
    file_size = models.IntegerField(default=0, help_text='File size in bytes')
    mime_type = models.CharField(max_length=100, default='application/octet-stream')

    # Versioning
    version = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = 'case_documents'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['patient', 'patient_case', '-created_at']),
            models.Index(fields=['clinic', 'category']),
            models.Index(fields=['source_type', 'source_id']),
        ]

    def __str__(self):
        return f"{self.title} — {self.patient.get_full_name()}"