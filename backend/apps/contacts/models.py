from django.db import models
from apps.common.models import TimeStampedModel
from apps.clinics.models import Clinic


class Contact(TimeStampedModel):
    CONTACT_TYPE_CHOICES = [
        ('DOCTOR',       'Doctor'),
        ('PRACTITIONER', 'Practitioner'),
        ('CLINIC',       'Clinic'),
        ('LABORATORY',   'Laboratory'),
        ('PHARMACY',     'Pharmacy'),
        ('SUPPLIER',     'Supplier'),   # ← added
        ('OTHER',        'Other'),
    ]

    clinic = models.ForeignKey(
        Clinic,
        on_delete=models.CASCADE,
        related_name='contacts'
    )
    
    # Contact Information
    contact_number = models.CharField(max_length=20, unique=True, editable=False)
    contact_type = models.CharField(max_length=20, choices=CONTACT_TYPE_CHOICES, default='OTHER')
    custom_contact_type = models.CharField(max_length=100, blank=True, default='')
    
    # Personal/Organization Info
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, null=True)
    organization_name = models.CharField(max_length=255, blank=True, null=True)  # For clinics/labs
    
    # Professional Info
    specialty = models.CharField(max_length=100, blank=True, null=True)
    license_number = models.CharField(max_length=50, blank=True, null=True)
    
    # Contact Details
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20)
    alternative_phone = models.CharField(max_length=20, blank=True, null=True)
    
    # Address
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    province = models.CharField(max_length=100, blank=True, null=True)
    postal_code = models.CharField(max_length=20, blank=True, null=True)
    
    # Additional Info
    notes = models.TextField(blank=True, null=True)
    website = models.URLField(blank=True, null=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    is_preferred = models.BooleanField(default=False)  # Preferred referral contact

    class Meta:
        db_table = 'contacts'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['clinic', 'is_active']),
            models.Index(fields=['contact_type']),
        ]

    @property
    def display_contact_type(self):
        """Returns custom_contact_type when type is OTHER, otherwise the human label."""
        if self.contact_type == 'OTHER' and self.custom_contact_type:
            return self.custom_contact_type
        return self.get_contact_type_display()

    def __str__(self):
        return f"{self.full_name} - {self.display_contact_type}"

    @property
    def full_name(self):
        if self.middle_name:
            return f"{self.first_name} {self.middle_name} {self.last_name}"
        return f"{self.first_name} {self.last_name}"

    def save(self, *args, **kwargs):
        if not self.contact_number:
            # Generate unique contact number
            last_contact = Contact.objects.filter(clinic=self.clinic).order_by('-id').first()
            if last_contact and last_contact.contact_number:
                last_number = int(last_contact.contact_number.split('-')[1])
                new_number = last_number + 1
            else:
                new_number = 1
            self.contact_number = f"CNT-{new_number:04d}"
        super().save(*args, **kwargs)