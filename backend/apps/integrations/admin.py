from django.contrib import admin
from .models import PhilHealthClaim, HMOClaim


@admin.register(PhilHealthClaim)
class PhilHealthClaimAdmin(admin.ModelAdmin):
    list_display    = ('claim_number', 'patient', 'clinic', 'status', 'claim_amount', 'approved_amount', 'claim_date')
    list_filter     = ('status', 'clinic', 'claim_date')
    search_fields   = ('claim_number', 'patient__first_name', 'patient__last_name', 'philhealth_number')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(HMOClaim)
class HMOClaimAdmin(admin.ModelAdmin):
    list_display    = ('claim_number', 'patient', 'clinic', 'hmo_provider', 'status', 'claim_amount', 'claim_date')
    list_filter     = ('status', 'hmo_provider', 'clinic')
    search_fields   = ('claim_number', 'patient__first_name', 'patient__last_name')
    readonly_fields = ('created_at', 'updated_at')
