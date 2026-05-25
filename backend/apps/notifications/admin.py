from django.contrib import admin
from .models import (
    Notification, NotificationRead, EmailLog, SMSLog,
    CommunicationLog, CommunicationReply, CommunicationAttachment,
)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display  = ['id', 'clinic', 'notification_type', 'title', 'clinic_branch', 'created_at']
    list_filter   = ['notification_type', 'clinic', 'created_at']
    search_fields = ['title', 'message']
    readonly_fields = ['created_at']


@admin.register(NotificationRead)
class NotificationReadAdmin(admin.ModelAdmin):
    list_display  = ['id', 'notification', 'user', 'read_at']
    list_filter   = ['read_at']
    raw_id_fields = ['notification', 'user']


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ['id', 'recipient_email', 'subject', 'is_sent', 'sent_at']
    list_filter  = ['is_sent']


@admin.register(SMSLog)
class SMSLogAdmin(admin.ModelAdmin):
    list_display = ['id', 'recipient_phone', 'is_sent', 'provider', 'sent_at']
    list_filter  = ['is_sent', 'provider']


@admin.register(CommunicationLog)
class CommunicationLogAdmin(admin.ModelAdmin):
    list_display   = ['id', 'comm_type', 'channel', 'status', 'recipient', 'patient', 'clinic', 'created_at']
    list_filter    = ['comm_type', 'channel', 'status', 'created_at']
    search_fields  = ['recipient', 'subject', 'patient__first_name', 'patient__last_name']
    raw_id_fields  = ['patient', 'appointment', 'practitioner', 'clinic']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(CommunicationReply)
class CommunicationReplyAdmin(admin.ModelAdmin):
    list_display  = ['id', 'communication_log', 'sender_type', 'sender_name', 'created_at']
    list_filter   = ['sender_type', 'created_at']
    raw_id_fields = ['communication_log']
    readonly_fields = ['created_at']


@admin.register(CommunicationAttachment)
class CommunicationAttachmentAdmin(admin.ModelAdmin):
    list_display  = ['id', 'communication_log', 'file_name', 'attachment_type', 'file_size_bytes', 'created_at']
    list_filter   = ['attachment_type', 'created_at']
    raw_id_fields = ['communication_log']
    readonly_fields = ['created_at']