from django.contrib import admin
from .models import GatewayDevice, Provider, WebhookEvent


@admin.register(GatewayDevice)
class GatewayDeviceAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'device_identifier', 'phone_number',
        'status', 'is_active', 'online_status', 'last_seen_at', 'created_at'
    )
    list_filter = ('status', 'is_active')
    search_fields = ('name', 'device_identifier', 'phone_number')
    readonly_fields = ('id', 'created_at', 'updated_at', 'last_seen_at')
    ordering = ('name',)

    # Exclude device_token from default fieldsets — admins should not see it in plain text
    exclude = ('device_token',)

    def online_status(self, obj):
        return '🟢 Online' if obj.is_online() else '🔴 Offline'
    online_status.short_description = 'Online'

    def get_fieldsets(self, request, obj=None):
        """Show device_token only in the detail view, not in list."""
        fieldsets = super().get_fieldsets(request, obj)
        return fieldsets


@admin.register(Provider)
class ProviderAdmin(admin.ModelAdmin):
    list_display = ('name', 'provider_type', 'is_active', 'created_at')
    list_filter = ('is_active', 'provider_type')
    search_fields = ('name',)
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(WebhookEvent)
class WebhookEventAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'status', 'gateway_device', 'received_at')
    list_filter = ('status', 'event_type')
    search_fields = ('event_type',)
    readonly_fields = ('id', 'received_at', 'raw_payload')
    ordering = ('-received_at',)
