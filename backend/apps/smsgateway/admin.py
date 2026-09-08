from django.contrib import admin
from .models import SMSMessage, SMSTemplate, DeliveryEvent, InboundSMS


@admin.register(SMSMessage)
class SMSMessageAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'recipient_number', 'status', 'retry_count',
        'gateway_device', 'created_at', 'sent_at', 'failed_at'
    )
    list_filter = ('status',)
    search_fields = ('recipient_number', 'body', 'provider_message_id')
    readonly_fields = (
        'id', 'created_at', 'updated_at', 'sent_at', 'delivered_at', 'failed_at',
        'provider_message_id', 'gateway_device', 'retry_count'
    )
    ordering = ('-created_at',)
    list_per_page = 50


@admin.register(SMSTemplate)
class SMSTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at', 'updated_at')
    search_fields = ('name', 'content')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(DeliveryEvent)
class DeliveryEventAdmin(admin.ModelAdmin):
    list_display = ('message', 'status', 'created_at')
    list_filter = ('status',)
    readonly_fields = ('id', 'created_at')
    ordering = ('-created_at',)


@admin.register(InboundSMS)
class InboundSMSAdmin(admin.ModelAdmin):
    list_display = ('sender_number', 'recipient_number', 'body_preview', 'processed_status', 'received_at')
    list_filter = ('processed_status',)
    search_fields = ('sender_number', 'body')
    readonly_fields = ('id', 'received_at', 'created_at', 'updated_at')
    ordering = ('-received_at',)

    def body_preview(self, obj):
        return obj.body[:60] + '...' if len(obj.body) > 60 else obj.body
    body_preview.short_description = 'Body'
