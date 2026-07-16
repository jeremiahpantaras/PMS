from django.db import models
from django.core.exceptions import ValidationError
from apps.common.models import TimeStampedModel, SoftDeleteModel
from apps.common.encryption import FieldEncryptor
import json


class ClinicalTemplate(TimeStampedModel, SoftDeleteModel):
    """
    Reusable clinical note templates with versioning support.
    
    Architecture Decisions:
    - JSON structure allows dynamic form rendering on frontend
    - Versioning ensures historical notes remain intact
    - Clinic-scoped to prevent cross-clinic access
    - Archived templates are soft-deleted but remain in DB for audit
    """
    
    CATEGORY_CHOICES = [
        ('INITIAL', 'Initial Assessment'),
        ('FOLLOW_UP', 'Follow-up Note'),
        ('PROGRESS', 'Progress Note'),
        ('DISCHARGE', 'Discharge Summary'),
        ('SOAP', 'SOAP Note'),
        ('CUSTOM', 'Custom Template'),
    ]
    
    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='clinical_templates',
        help_text='Template is scoped to this clinic'
    )
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_clinical_templates_v2'  # ✅ CHANGED: Unique related_name
    )
    
    # Template metadata
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    discipline = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='Practitioner discipline this template is designed for'
    )
    clinic_branch = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='branch_clinical_templates',
        help_text='Specific branch this template is for. Null means all locations.'
    )
    
    # Template structure as JSON schema
    # Example: See TEMPLATE_STRUCTURE_EXAMPLE below
    structure = models.JSONField(
        default=dict,
        help_text='JSON schema defining form fields and sections'
    )
    
    # Versioning
    version = models.PositiveIntegerField(default=1)
    parent_template = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='versions',
        help_text='Reference to original template if this is a new version'
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    is_archived = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'clinical_templates'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['clinic', 'is_active', 'is_archived']),
            models.Index(fields=['category']),
            models.Index(fields=['parent_template', 'version']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['clinic', 'name', 'version'],
                name='unique_template_version_per_clinic'
            )
        ]
    
    def __str__(self):
        return f"{self.name} v{self.version} - {self.clinic.name}"
    
    def clean(self):
        """Validate template structure"""
        if not self.structure:
            raise ValidationError('Template structure cannot be empty')
        
        # Validate JSON structure has required keys
        required_keys = ['sections']
        if not all(key in self.structure for key in required_keys):
            raise ValidationError('Template structure must contain "sections" key')
    
    def create_new_version(self, user):
        """
        Create a new version of this template.
        Original template remains unchanged for historical notes.
        """
        new_version = ClinicalTemplate.objects.create(
            clinic=self.clinic,
            created_by=user,
            name=self.name,
            description=self.description,
            category=self.category,
            discipline=self.discipline,
            clinic_branch=self.clinic_branch,
            structure=self.structure.copy(),
            version=self.version + 1,
            parent_template=self.parent_template or self,
            is_active=True
        )
        
        # Optionally deactivate old version
        self.is_active = False
        self.save(update_fields=['is_active'])
        
        return new_version


class ClinicalNote(TimeStampedModel, SoftDeleteModel):
    """
    Individual clinical notes created from templates.
    
    Architecture Decisions:
    - Content is encrypted at field level for HIPAA compliance
    - Template reference is FK but content is independent (clone pattern)
    - Version tracking ensures audit trail
    - One-to-one with Appointment for easy navigation
    """
    
    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.CASCADE,
        related_name='clinical_notes_v2'
    )
    practitioner = models.ForeignKey(
        'clinics.Practitioner',
        on_delete=models.CASCADE,
        related_name='clinical_notes_v2'
    )
    appointment = models.ForeignKey(
        'appointments.Appointment',
        on_delete=models.CASCADE,  # Delete notes if appointment is deleted
        related_name='clinical_notes_v2'
    )
    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='clinical_notes_v2'
    )

    # Case assignment (optional - notes can exist without a case)
    patient_case = models.ForeignKey(
        'patients.PatientCase',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='clinical_notes'
    )

    # Template reference (historical, does not affect content)
    template = models.ForeignKey(
        ClinicalTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notes',
        help_text='Reference to template used (for audit only)'
    )
    template_version = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Snapshot of template version at creation'
    )
    
    # Encrypted content (cloned from template structure)
    # This is the actual clinical data entered by practitioner
    encrypted_content = models.TextField(
        blank=True,  # ✅ ADDED: Allow blank for new notes
        default='',  # ✅ ADDED: Default empty string
        help_text='AES encrypted JSON content'
    )
    
    # Metadata
    date = models.DateField()
    note_type = models.CharField(max_length=20, default='CLINICAL')
    
    # Status
    is_signed = models.BooleanField(default=False)
    signed_at = models.DateTimeField(null=True, blank=True)
    
    # Draft support
    is_draft = models.BooleanField(default=True)
    last_autosave = models.DateTimeField(null=True, blank=True)

    # Chart annotation stroke data (non-encrypted, structural doodle JSON)
    # Format: { "<field_id>": { "chart_type": "body|head|spine", "doodle_data": [...strokes] } }
    chart_annotation_data = models.JSONField(null=True, blank=True)
    
    # Level 2 Audit History
    version_number = models.PositiveIntegerField(default=1)
    amendment_reason = models.TextField(blank=True, default='')
    
    class Meta:
        db_table = 'clinical_notes_v2'
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['patient', 'date']),
            models.Index(fields=['practitioner', 'date']),
            models.Index(fields=['clinic', 'date']),
            models.Index(fields=['is_draft', 'is_signed']),
            models.Index(fields=['appointment']),
            models.Index(fields=['patient_case']),
        ]
    
    def __str__(self):
        return f"{self.patient.get_full_name()} - {self.date}"
    
    @property
    def content(self):
        """Decrypt and return content as dict"""
        if not self.encrypted_content:
            return {}
        return FieldEncryptor.decrypt(self.encrypted_content)
    
    def set_content(self, content_dict):
        """Encrypt and save content"""
        self.encrypted_content = FieldEncryptor.encrypt(content_dict)
    
    def sign_note(self, user):
        """Sign and lock the clinical note"""
        if self.practitioner.user != user:
            raise ValidationError('Only the assigned practitioner can sign this note')
        
        from django.utils import timezone
        self.is_signed = True
        self.is_draft = False
        self.signed_at = timezone.now()
        self.save(update_fields=['is_signed', 'is_draft', 'signed_at'])


class ClinicalNoteVersion(TimeStampedModel):
    """
    Immutable snapshots of ClinicalNotes for Level 2 Audit History.
    """
    clinical_note = models.ForeignKey(
        ClinicalNote,
        on_delete=models.CASCADE,
        related_name='versions'
    )
    version_number = models.PositiveIntegerField()
    encrypted_content = models.TextField(
        blank=True,
        default='',
        help_text='AES encrypted JSON content snapshot'
    )
    chart_annotation_data = models.JSONField(null=True, blank=True)
    amendment_reason = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_clinical_note_versions'
    )

    class Meta:
        db_table = 'clinical_note_versions'
        ordering = ['-version_number']
        indexes = [
            models.Index(fields=['clinical_note', 'version_number']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['clinical_note', 'version_number'],
                name='unique_note_version'
            )
        ]

    def __str__(self):
        return f"Version {self.version_number} of {self.clinical_note}"
    
    @property
    def content(self):
        """Decrypt and return content as dict"""
        if not self.encrypted_content:
            return {}
        return FieldEncryptor.decrypt(self.encrypted_content)


class ClinicalNoteAuditLog(TimeStampedModel):
    """
    Audit trail for clinical note modifications.
    
    Architecture: Immutable log for compliance and security.
    """
    
    ACTION_CHOICES = [
        ('CREATED', 'Note Created'),
        ('UPDATED', 'Note Updated'),
        ('SIGNED', 'Note Signed'),
        ('VIEWED', 'Note Viewed'),
        ('DELETED', 'Note Deleted'),
        ('EMAILED', 'Note Emailed'),
    ]
    
    clinical_note = models.ForeignKey(
        ClinicalNote,
        on_delete=models.CASCADE,
        related_name='audit_logs'
    )
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='clinical_note_audits_v2'  # ✅ CHANGED: Unique related_name
    )
    
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    changes = models.JSONField(
        default=dict,
        blank=True,
        help_text='Snapshot of changes made (encrypted fields logged as "ENCRYPTED")'
    )
    
    class Meta:
        db_table = 'clinical_note_audit_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['clinical_note', 'action', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.action} - {self.clinical_note} by {self.user}"


# ============================================
# EXAMPLE TEMPLATE STRUCTURE (JSON Schema)
# ============================================

TEMPLATE_STRUCTURE_EXAMPLE = {
    "version": "1.0",
    "sections": [
        {
            "id": "subjective",
            "title": "Subjective",
            "description": "Patient-reported symptoms and history",
            "order": 1,
            "fields": [
                {
                    "id": "chief_complaint",
                    "type": "textarea",
                    "label": "Chief Complaint",
                    "placeholder": "Patient's main concern...",
                    "required": True,
                    "rows": 3
                },
                {
                    "id": "pain_level",
                    "type": "pain_scale",
                    "label": "Pain Level (0-10)",
                    "required": True,
                    "min": 0,
                    "max": 10
                },
                {
                    "id": "symptoms_duration",
                    "type": "select",
                    "label": "Duration of Symptoms",
                    "required": True,
                    "options": [
                        {"value": "acute", "label": "Acute (< 6 weeks)"},
                        {"value": "subacute", "label": "Subacute (6-12 weeks)"},
                        {"value": "chronic", "label": "Chronic (> 12 weeks)"}
                    ]
                }
            ]
        },
        {
            "id": "objective",
            "title": "Objective",
            "description": "Clinical observations and measurements",
            "order": 2,
            "fields": [
                {
                    "id": "rom_assessment",
                    "type": "nested_group",
                    "label": "Range of Motion Assessment",
                    "fields": [
                        {
                            "id": "rom_flexion",
                            "type": "number",
                            "label": "Flexion (degrees)",
                            "min": 0,
                            "max": 180
                        },
                        {
                            "id": "rom_extension",
                            "type": "number",
                            "label": "Extension (degrees)",
                            "min": 0,
                            "max": 180
                        }
                    ]
                },
                {
                    "id": "vital_signs",
                    "type": "checkbox_group",
                    "label": "Vital Signs",
                    "options": [
                        {"value": "bp_normal", "label": "Blood Pressure Normal"},
                        {"value": "temp_normal", "label": "Temperature Normal"},
                        {"value": "pulse_normal", "label": "Pulse Normal"}
                    ]
                }
            ]
        },
        {
            "id": "assessment",
            "title": "Assessment",
            "description": "Clinical diagnosis and impression",
            "order": 3,
            "fields": [
                {
                    "id": "diagnosis",
                    "type": "textarea",
                    "label": "Primary Diagnosis",
                    "required": True,
                    "rows": 2
                },
                {
                    "id": "icd10_codes",
                    "type": "tags",
                    "label": "ICD-10 Codes",
                    "placeholder": "Type and press Enter..."
                }
            ]
        },
        {
            "id": "plan",
            "title": "Plan",
            "description": "Treatment plan and recommendations",
            "order": 4,
            "fields": [
                {
                    "id": "treatment_plan",
                    "type": "rich_text",
                    "label": "Treatment Plan",
                    "required": True
                },
                {
                    "id": "follow_up",
                    "type": "date",
                    "label": "Follow-up Date",
                    "required": False
                }
            ]
        }
    ]
}