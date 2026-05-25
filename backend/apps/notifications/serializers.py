from rest_framework import serializers
from .models import (
    Notification, NotificationRead, EmailLog, SMSLog,
    CommunicationLog, CommunicationReply, CommunicationAttachment,
)
from apps.clinics.models import ClinicCommunicationSettings


class NotificationSerializer(serializers.ModelSerializer):
    """
    Serializes a clinic-wide Notification.
    `is_read` and `read_at` are computed per-request-user from the NotificationRead table.
    """

    notification_type_display = serializers.CharField(
        source='get_notification_type_display',
        read_only=True,
    )

    appointment_id     = serializers.IntegerField(source='appointment.id',   read_only=True, allow_null=True)
    clinic_branch_id   = serializers.IntegerField(source='clinic_branch.id', read_only=True, allow_null=True)
    clinic_branch_name = serializers.CharField(
        source='clinic_branch.name', read_only=True, allow_null=True,
    )

    # Computed per-user fields
    is_read = serializers.SerializerMethodField()
    read_at = serializers.SerializerMethodField()

    class Meta:
        model  = Notification
        fields = [
            'id',
            'notification_type',
            'notification_type_display',
            'title',
            'message',
            'link_url',
            'appointment_id',
            'clinic_branch_id',
            'clinic_branch_name',
            'is_read',
            'read_at',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def _get_read_map(self):
        """
        Returns a dict {notification_id: read_at} for the current user.
        Cached on the serializer context to avoid N+1 queries on list endpoints.
        """
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return {}

        # Cache on the request object for the duration of this response
        cache_key = '_notification_read_map'
        if not hasattr(request, cache_key):
            reads = NotificationRead.objects.filter(
                user=request.user
            ).values_list('notification_id', 'read_at')
            setattr(request, cache_key, dict(reads))

        return getattr(request, cache_key)

    def get_is_read(self, obj) -> bool:
        return obj.id in self._get_read_map()

    def get_read_at(self, obj):
        read_at = self._get_read_map().get(obj.id)
        if read_at:
            return read_at.isoformat()
        return None


class EmailLogSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EmailLog
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'sent_at']


class SMSLogSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SMSLog
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'sent_at']


class ClinicCommunicationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ClinicCommunicationSettings
        fields = [
            'id',
            # Per-reminder-type channel methods
            'booking_confirmation_method',
            'reminder_method',
            'cancellation_method',
            'dna_followup_method',
            'rebook_followup_method',
            'inactive_checkin_method',
            'profile_creation_method',
            # Timing
            'reminder_hours_before',
            'no_rebook_followup_days',
            'inactive_patient_months',
            # Feature toggles
            'booking_confirmations_enabled',
            'reminders_enabled',
            'cancellation_enabled',
            'dna_followup_enabled',
            'rebook_followup_enabled',
            'inactive_checkin_enabled',
            'profile_creation_enabled',
        ]
        read_only_fields = ['id']


class CommunicationReplySerializer(serializers.ModelSerializer):
    sender_type_display = serializers.CharField(source='get_sender_type_display', read_only=True)

    class Meta:
        model  = CommunicationReply
        fields = [
            'id',
            'communication_log',
            'sender_type',
            'sender_type_display',
            'sender_name',
            'message',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class CommunicationAttachmentSerializer(serializers.ModelSerializer):
    attachment_type_display = serializers.CharField(
        source='get_attachment_type_display', read_only=True,
    )

    class Meta:
        model  = CommunicationAttachment
        fields = [
            'id',
            'communication_log',
            'file_name',
            'file_url',
            'attachment_type',
            'attachment_type_display',
            'file_size_bytes',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class CommunicationLogSerializer(serializers.ModelSerializer):
    comm_type_display    = serializers.CharField(source='get_comm_type_display', read_only=True)
    channel_display      = serializers.CharField(source='get_channel_display',   read_only=True)
    status_display       = serializers.CharField(source='get_status_display',    read_only=True)
    patient_name         = serializers.SerializerMethodField()
    practitioner_name    = serializers.SerializerMethodField()
    reply_count          = serializers.SerializerMethodField()
    attachment_count     = serializers.SerializerMethodField()

    class Meta:
        model  = CommunicationLog
        fields = [
            'id',
            'clinic',
            'patient',
            'patient_name',
            'appointment',
            'practitioner',
            'practitioner_name',
            'comm_type',
            'comm_type_display',
            'channel',
            'channel_display',
            'status',
            'status_display',
            'recipient',
            'subject',
            'body_preview',
            'error_message',
            'patient_reply',
            'replied_at',
            'delivered_at',
            'opened_at',
            'bounced_at',
            'message_id',
            'reply_count',
            'attachment_count',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_patient_name(self, obj) -> str:
        if obj.patient:
            return obj.patient.get_full_name()
        return ''

    def get_practitioner_name(self, obj) -> str:
        if obj.practitioner and obj.practitioner.user:
            return obj.practitioner.user.get_full_name()
        return ''

    def get_reply_count(self, obj) -> int:
        return obj.replies.count()

    def get_attachment_count(self, obj) -> int:
        return obj.attachments.count()


class CommunicationLogDetailSerializer(CommunicationLogSerializer):
    """Full detail serializer — includes full_body, replies, and attachments."""
    replies     = CommunicationReplySerializer(many=True, read_only=True)
    attachments = CommunicationAttachmentSerializer(many=True, read_only=True)

    class Meta(CommunicationLogSerializer.Meta):
        fields = CommunicationLogSerializer.Meta.fields + [
            'full_body',
            'replies',
            'attachments',
        ]