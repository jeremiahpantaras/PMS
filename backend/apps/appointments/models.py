import uuid
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta
from apps.common.models import TimeStampedModel, SoftDeleteModel


class Appointment(TimeStampedModel, SoftDeleteModel):
    """Patient appointments with practitioners"""

    STATUS_CHOICES = [
        ('SCHEDULED',   'Scheduled'),
        ('CONFIRMED',   'Confirmed'),
        ('CHECKED_IN',  'Checked In'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED',   'Completed'),
        ('CANCELLED',   'Cancelled'),
        ('NO_SHOW',     'No Show'),
        ('ARRIVED',     'Arrived'),
        ('DNA',         'Did Not Arrive'),
    ]

    # ── Arrival status for tracking practitioner arrival ────────────────────────
    ARRIVAL_STATUS_CHOICES = [
        ('NO_STATUS', 'No Status'),
        ('ARRIVED',   'Arrived'),
        ('DNA',       'Did Not Arrive'),
    ]

    arrival_status = models.CharField(
        max_length=20,
        choices=ARRIVAL_STATUS_CHOICES,
        default='NO_STATUS',
        blank=True,
        help_text='Tracks whether the practitioner has arrived for the appointment'
    )

    arrival_time = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Timestamp when the practitioner marked arrival'
    )

    # ── Keep for legacy / fallback but no longer the primary type mechanism ──
    APPOINTMENT_TYPE_CHOICES = [
        ('INITIAL',   'Initial Consultation'),
        ('FOLLOW_UP', 'Follow-up'),
        ('THERAPY',   'Therapy Session'),
        ('ASSESSMENT','Assessment'),
    ]

    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='appointments',
        help_text='Specific clinic branch for this appointment'
    )
    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.CASCADE,
        related_name='appointments'
    )
    practitioner = models.ForeignKey(
        'clinics.Practitioner',
        on_delete=models.CASCADE,
        related_name='appointments',
        null=True,
        blank=True,
    )
    location = models.ForeignKey(
        'clinics.Location',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='appointments'
    )

    # ── NEW: link to a clinic Service (the "appointment type") ───────────────
    service = models.ForeignKey(
        'clinic_services.Service',   # ← use the app label from apps.py
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='appointments',
        help_text='Clinic service this appointment is for (replaces hardcoded type)',
    )

    # Legacy type — kept for backward-compat; auto-populated from service when possible
    appointment_type = models.CharField(
        max_length=20,
        choices=APPOINTMENT_TYPE_CHOICES,
        default='INITIAL',
        blank=True,
    )

    status           = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SCHEDULED')
    date             = models.DateField()
    start_time       = models.TimeField()
    end_time         = models.TimeField()
    duration_minutes = models.IntegerField(default=60)

    chief_complaint = models.TextField(blank=True)
    notes           = models.TextField(blank=True, help_text='Internal notes')
    patient_notes   = models.TextField(blank=True, help_text='Notes from patient')

    reminder_sent    = models.BooleanField(default=False)
    reminder_sent_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='appointments_created'
    )
    updated_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='appointments_updated'
    )
    cancelled_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='cancelled_appointments'
    )
    cancellation_reason = models.TextField(blank=True)
    cancelled_at        = models.DateTimeField(null=True, blank=True)

    # ── Communication workflow fields ─────────────────────────────────────────
    CONFIRMATION_STATUS_CHOICES = [
        ('PENDING',   'Pending'),
        ('CONFIRMED', 'Confirmed'),
        ('DECLINED',  'Declined'),
    ]

    confirmation_sent    = models.BooleanField(default=False)
    confirmation_sent_at = models.DateTimeField(null=True, blank=True)
    confirmation_status  = models.CharField(
        max_length=10,
        choices=CONFIRMATION_STATUS_CHOICES,
        default='PENDING',
        blank=True,
    )
    patient_reply        = models.CharField(
        max_length=10,
        blank=True,
        help_text='Y or N reply from patient via SMS.',
    )
    patient_reply_at     = models.DateTimeField(null=True, blank=True)
    dna_followup_sent    = models.BooleanField(default=False)
    dna_followup_sent_at = models.DateTimeField(null=True, blank=True)
    rebook_followup_sent    = models.BooleanField(default=False)
    rebook_followup_sent_at = models.DateTimeField(null=True, blank=True)

    # ── Recurring group identifier ────────────────────────────────────────────
    recurring_group_id = models.CharField(
        max_length=50,
        blank=True,
        help_text='Shared ID linking appointments in the same recurring series.',
    )

    class Meta:
        db_table = 'appointments'
        ordering = ['-date', '-start_time']
        indexes = [
            models.Index(fields=['clinic', 'date', 'status']),
            models.Index(fields=['practitioner', 'date']),
            models.Index(fields=['patient', 'date']),
            models.Index(fields=['service', 'date']),   # NEW
        ]

    def __str__(self):
        service_label = self.service.name if self.service else self.appointment_type
        return f"{self.patient.get_full_name()} — {service_label} @ {self.date} {self.start_time}"

    def save(self, *args, **kwargs):
        # Auto-populate duration from service if not explicitly set
        if self.service and not self.duration_minutes:
            self.duration_minutes = self.service.duration_minutes
        super().save(*args, **kwargs)

    def clean(self):
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValidationError('End time must be after start time')

        if self.practitioner and self.date and self.start_time and self.end_time:
            overlapping = Appointment.objects.filter(
                practitioner=self.practitioner,
                date=self.date,
                status__in=['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS']
            ).exclude(pk=self.pk)

            for apt in overlapping:
                if self.start_time < apt.end_time and self.end_time > apt.start_time:
                    raise ValidationError('This appointment overlaps with an existing appointment')


class PractitionerSchedule(TimeStampedModel):
    """Practitioner working hours and availability"""
    
    WEEKDAY_CHOICES = [
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
        (6, 'Sunday'),
    ]
    
    practitioner = models.ForeignKey(
        'clinics.Practitioner',
        on_delete=models.CASCADE,
        related_name='schedules'
    )
    location = models.ForeignKey(
        'clinics.Location',
        on_delete=models.CASCADE,
        related_name='practitioner_schedules'
    )
    
    weekday = models.IntegerField(choices=WEEKDAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_available = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'practitioner_schedules'
        ordering = ['weekday', 'start_time']
        unique_together = ['practitioner', 'location', 'weekday', 'start_time']
    
    def __str__(self):
        return f"{self.practitioner} - {self.get_weekday_display()} {self.start_time}-{self.end_time}"


class AppointmentReminder(TimeStampedModel):
    """Track appointment reminders sent"""
    
    REMINDER_TYPE_CHOICES = [
        ('EMAIL', 'Email'),
        ('SMS', 'SMS'),
        ('BOTH', 'Email & SMS'),
    ]
    
    appointment = models.ForeignKey(
        Appointment,
        on_delete=models.CASCADE,
        related_name='reminders'
    )
    
    reminder_type = models.CharField(max_length=10, choices=REMINDER_TYPE_CHOICES)
    sent_at = models.DateTimeField(auto_now_add=True)
    is_successful = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    
    class Meta:
        db_table = 'appointment_reminders'
        ordering = ['-sent_at']
    
    def __str__(self):
        return f"Reminder for {self.appointment} - {self.get_reminder_type_display()}"


# ── Block Appointment (Events) ─────────────────────────────────────────────────

class BlockAppointment(TimeStampedModel, SoftDeleteModel):
    """
    Block Appointments are special events that block time slots in the clinic schedule.
    Examples: Staff Meeting, Clinic Holiday, Team Training, Maintenance Schedule.
    All authenticated users can create/edit/delete block appointments.
    Visibility can be controlled per-event (All Users or Selected Users).
    """

    EVENT_TYPE_CHOICES = [
        ('BLOCK', 'Blocked Schedule'),
    ]

    VISIBILITY_TYPE_CHOICES = [
        ('ALL', 'All Users'),
        ('SELECTED', 'Selected Users'),
        ('SELF', 'Myself Only'),
    ]

    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='block_appointments',
        help_text='Clinic/branch this block event belongs to'
    )

    event_name = models.CharField(
        max_length=200,
        help_text='Name/title of the blocked event (e.g., Staff Meeting)'
    )

    event_type = models.CharField(
        max_length=20,
        choices=EVENT_TYPE_CHOICES,
        default='BLOCK',
        editable=False
    )

    date = models.DateField(help_text='Date of the blocked event')

    start_time = models.TimeField(help_text='Start time of the blocked period')

    end_time = models.TimeField(help_text='End time of the blocked period')

    notes = models.TextField(
        blank=True,
        help_text='Optional notes about the blocked event'
    )

    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='block_appointments_created',
        help_text='User who created this block appointment'
    )

    modified_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='block_appointments_modified',
        help_text='User who last modified this block appointment'
    )

    # ── Visibility Control Fields ────────────────────────────────────────────────
    visibility_type = models.CharField(
        max_length=15,
        choices=VISIBILITY_TYPE_CHOICES,
        default='ALL',
        help_text='Controls who can see this block appointment'
    )

    visible_to_users = models.ManyToManyField(
        'accounts.User',
        blank=True,
        related_name='visible_block_appointments',
        help_text='Users who can see this block (only applies when visibility_type=SELECTED)'
    )

    class Meta:
        db_table = 'block_appointments'
        ordering = ['-date', '-start_time']
        indexes = [
            models.Index(fields=['clinic', 'date']),
            models.Index(fields=['date']),
        ]

    def __str__(self):
        return f"{self.event_name} - {self.date} {self.start_time} to {self.end_time}"

    def clean(self):
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValidationError('End time must be after start time')


# ── Rebooking Link ────────────────────────────────────────────────────────────

def _default_rebooking_expires():
    return timezone.now() + timedelta(hours=72)


class RebookingLink(TimeStampedModel):
    """
    Secure one-time rebooking link sent to patients after a DNA/decline.

    The token is a UUID; the link expires after 72 hours and becomes invalid
    once used.  The frontend page at /rebook/{token} prefills appointment
    details (read-only) and lets the patient choose a new date/time.
    """

    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.CASCADE,
        related_name='rebooking_links',
    )
    appointment = models.ForeignKey(
        Appointment,
        on_delete=models.CASCADE,
        related_name='rebooking_links',
        help_text='The original missed/declined appointment this link relates to.',
    )
    token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        editable=False,
    )
    expires_at = models.DateTimeField(default=_default_rebooking_expires)
    is_used = models.BooleanField(
        default=False,
        help_text='True once the patient has used this link to rebook.',
    )
    used_at = models.DateTimeField(null=True, blank=True)
    new_appointment = models.ForeignKey(
        Appointment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_from_rebooking_links',
        help_text='The new appointment created when the patient used this link.',
    )

    class Meta:
        db_table = 'rebooking_links'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['patient', 'is_used']),
        ]

    def __str__(self):
        return f"RebookingLink {self.token} — patient {self.patient_id}"

    @property
    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    @property
    def is_valid(self) -> bool:
        return not self.is_used and not self.is_expired