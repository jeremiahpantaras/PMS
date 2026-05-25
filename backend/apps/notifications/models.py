from django.db import models
from apps.common.models import TimeStampedModel


class Notification(TimeStampedModel):
    """
    Clinic-wide notification.

    ONE record per notification per clinic.  Every active user in that clinic
    sees the same notification.  Per-user read status is tracked via the
    NotificationRead join table.

    Covers:
      - NEW_BOOKING   : fired when a patient books an appointment
      - DAILY_SUMMARY : fired once per day per clinic branch
    """

    NOTIFICATION_TYPE_CHOICES = [
        ('NEW_BOOKING',   'New Appointment Booking'),
        ('DAILY_SUMMARY', 'Daily Appointments Summary'),
    ]

    # ── Scoping — clinic-wide, NOT per-user ───────────────────────────────────
    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='notifications',
        help_text='The root/main clinic this notification belongs to.',
    )

    notification_type = models.CharField(
        max_length=30,
        choices=NOTIFICATION_TYPE_CHOICES,
        db_index=True,
    )

    title    = models.CharField(max_length=200)
    message  = models.TextField()
    link_url = models.CharField(max_length=500, blank=True)

    # Optional FK — for NEW_BOOKING
    appointment = models.ForeignKey(
        'appointments.Appointment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications',
    )

    # The specific branch this notification concerns (display purposes)
    clinic_branch = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='branch_notifications',
    )

    class Meta:
        db_table   = 'notifications'
        ordering   = ['-created_at']
        indexes    = [
            models.Index(fields=['clinic', 'created_at']),
            models.Index(fields=['notification_type', 'created_at']),
        ]

    def __str__(self):
        return f"[{self.notification_type}] {self.title} — clinic {self.clinic_id}"


class NotificationRead(models.Model):
    """
    Per-user read receipt for a clinic-wide notification.
    A row means the user HAS read that notification.
    No row → unread.
    """

    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name='reads',
    )
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='notification_reads',
    )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table         = 'notification_reads'
        unique_together  = [('notification', 'user')]
        indexes          = [
            models.Index(fields=['user', 'notification']),
        ]

    def __str__(self):
        return f"User {self.user_id} read notification {self.notification_id}"


class EmailLog(TimeStampedModel):
    """Log of emails sent"""

    recipient_email = models.EmailField()
    subject         = models.CharField(max_length=500)
    body            = models.TextField()

    is_sent       = models.BooleanField(default=False)
    sent_at       = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    related_model = models.CharField(max_length=100, blank=True)
    related_id    = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'email_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"Email to {self.recipient_email} - {self.subject}"


class SMSLog(TimeStampedModel):
    """Log of SMS sent"""

    recipient_phone = models.CharField(max_length=15)
    message         = models.TextField()

    is_sent       = models.BooleanField(default=False)
    sent_at       = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    provider            = models.CharField(max_length=50,  blank=True)
    provider_message_id = models.CharField(max_length=100, blank=True)

    related_model = models.CharField(max_length=100, blank=True)
    related_id    = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'sms_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"SMS to {self.recipient_phone}"


class CommunicationLog(TimeStampedModel):
    """
    Unified log for all automated patient communications.
    Tracks confirmations, reminders, DNA follow-ups, rebook follow-ups,
    inactive check-ins, and patient replies.
    Extended for the Communication Records Hub with full delivery tracking,
    open tracking, reply threads, and attachment support.
    """

    COMM_TYPE_CHOICES = [
        ('BOOKING_CONFIRMATION',    'Booking Confirmation'),
        ('RECURRING_CONFIRMATION',  'Recurring Booking Confirmation'),
        ('APPOINTMENT_REMINDER',    'Appointment Reminder'),
        ('DNA_FOLLOWUP',            'DNA / Decline Follow-up'),
        ('REBOOK_FOLLOWUP',         'No-Rebook Follow-up'),
        ('INACTIVE_CHECKIN',        'Inactive Patient Check-in'),
        ('CANCELLATION_NOTICE',     'Cancellation Notice'),
        ('CLINICAL_NOTE',           'Clinical Note Email'),
        ('OTP_VERIFICATION',        'OTP Verification'),
        ('PASSWORD_RESET',          'Password Reset'),
        ('INVOICE_EMAIL',           'Invoice Email'),
        ('RESCHEDULE_FOLLOWUP',     'Reschedule Follow-up'),
        ('SYSTEM_NOTIFICATION',     'System Notification'),
    ]

    CHANNEL_CHOICES = [
        ('EMAIL', 'Email'),
        ('SMS',   'SMS'),
    ]

    STATUS_CHOICES = [
        ('QUEUED',    'Queued'),
        ('SENT',      'Sent'),
        ('DELIVERED', 'Delivered'),
        ('OPENED',    'Opened'),
        ('REPLIED',   'Replied'),
        ('FAILED',    'Failed'),
        ('BOUNCED',   'Bounced'),
        ('PENDING',   'Pending'),
    ]

    clinic = models.ForeignKey(
        'clinics.Clinic',
        on_delete=models.CASCADE,
        related_name='communication_logs',
    )
    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.CASCADE,
        related_name='communication_logs',
        null=True,
        blank=True,
    )
    appointment = models.ForeignKey(
        'appointments.Appointment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='communication_logs',
    )
    practitioner = models.ForeignKey(
        'clinics.Practitioner',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='communication_logs',
        help_text='Practitioner associated with this communication (if any)',
    )

    comm_type = models.CharField(max_length=30, choices=COMM_TYPE_CHOICES, db_index=True)
    channel   = models.CharField(max_length=5,  choices=CHANNEL_CHOICES)
    status    = models.CharField(max_length=10, choices=STATUS_CHOICES, default='SENT')

    recipient       = models.CharField(max_length=200, help_text='Email or phone number')
    subject         = models.CharField(max_length=500, blank=True)
    body_preview    = models.TextField(blank=True, help_text='First 500 chars of message body')
    full_body       = models.TextField(blank=True, help_text='Complete message body for detail view')
    error_message   = models.TextField(blank=True)
    patient_reply   = models.CharField(max_length=10, blank=True, help_text='Y or N')
    replied_at      = models.DateTimeField(null=True, blank=True)

    # Delivery tracking timestamps
    delivered_at    = models.DateTimeField(null=True, blank=True)
    opened_at       = models.DateTimeField(null=True, blank=True)
    bounced_at      = models.DateTimeField(null=True, blank=True)

    # External message tracking ID (e.g. email provider message ID)
    message_id      = models.CharField(max_length=200, blank=True, db_index=True)

    class Meta:
        db_table = 'communication_logs'
        ordering = ['-created_at']
        indexes  = [
            models.Index(fields=['clinic', 'comm_type', 'created_at']),
            models.Index(fields=['patient', 'comm_type']),
            models.Index(fields=['appointment', 'comm_type']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['clinic', 'status']),
        ]

    def __str__(self):
        return f"[{self.comm_type}] {self.channel} → {self.recipient} ({self.status})"


class CommunicationReply(TimeStampedModel):
    """
    Tracks reply threads on a communication log entry.
    Supports patient replies and staff responses.
    """

    SENDER_TYPE_CHOICES = [
        ('PATIENT', 'Patient'),
        ('STAFF',   'Staff'),
        ('SYSTEM',  'System'),
    ]

    communication_log = models.ForeignKey(
        CommunicationLog,
        on_delete=models.CASCADE,
        related_name='replies',
    )
    sender_type = models.CharField(max_length=10, choices=SENDER_TYPE_CHOICES, default='PATIENT')
    sender_name = models.CharField(max_length=200, blank=True)
    message     = models.TextField()

    class Meta:
        db_table = 'communication_replies'
        ordering = ['created_at']

    def __str__(self):
        return f"Reply by {self.sender_type} on log {self.communication_log_id}"


class CommunicationAttachment(TimeStampedModel):
    """
    Tracks file attachments sent with a communication.
    Supports PDF invoices, clinical notes, and uploaded files.
    """

    ATTACHMENT_TYPE_CHOICES = [
        ('PDF',      'PDF Document'),
        ('IMAGE',    'Image'),
        ('INVOICE',  'Invoice PDF'),
        ('CLINICAL', 'Clinical Note PDF'),
        ('OTHER',    'Other'),
    ]

    communication_log   = models.ForeignKey(
        CommunicationLog,
        on_delete=models.CASCADE,
        related_name='attachments',
    )
    file_name       = models.CharField(max_length=255)
    file_url        = models.TextField(blank=True)
    attachment_type = models.CharField(
        max_length=10, choices=ATTACHMENT_TYPE_CHOICES, default='OTHER',
    )
    file_size_bytes = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'communication_attachments'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.file_name} (log {self.communication_log_id})"