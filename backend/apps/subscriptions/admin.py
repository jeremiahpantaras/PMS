from django.contrib import admin

from .models import PayMongoPaymentLog, Subscription


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'plan',
        'status',
        'is_trial',
        'paymongo_checkout_id',
        'start_date',
        'end_date',
        'updated_at',
    )
    list_filter = ('plan', 'status', 'is_trial')
    search_fields = ('user__email', 'user__first_name', 'user__last_name', 'paymongo_checkout_id')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(PayMongoPaymentLog)
class PayMongoPaymentLogAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'checkout_id', 'payment_id', 'amount', 'currency', 'user', 'processed_at')
    list_filter = ('event_type', 'currency')
    search_fields = ('checkout_id', 'payment_id', 'user__email')
    readonly_fields = ('processed_at', 'raw_payload')

    def has_add_permission(self, request):
        return False  # Logs are created only by webhooks

    def has_change_permission(self, request, obj=None):
        return False  # Immutable audit log

