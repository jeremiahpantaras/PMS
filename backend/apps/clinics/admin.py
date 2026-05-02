from django.contrib import admin
from .models import Clinic, Practitioner, Location


class BranchInline(admin.TabularInline):
    model  = Clinic
    fk_name = 'parent_clinic'
    extra  = 0
    fields = ('name', 'branch_code', 'city', 'is_active')
    show_change_link = True


@admin.register(Clinic)
class ClinicAdmin(admin.ModelAdmin):
    list_display    = ('name', 'branch_code', 'parent_clinic', 'subscription_plan', 'is_main_branch', 'is_active', 'setup_complete', 'created_at')
    list_filter     = ('subscription_plan', 'is_main_branch', 'is_active', 'setup_complete')
    search_fields   = ('name', 'branch_code', 'email', 'phone', 'city')
    readonly_fields = ('branch_code', 'created_at', 'updated_at')
    inlines         = [BranchInline]
    fieldsets = (
        (None, {'fields': ('parent_clinic', 'name', 'branch_code', 'is_main_branch', 'is_active', 'setup_complete')}),
        ('Contact', {'fields': ('email', 'phone', 'website')}),
        ('Address', {'fields': ('address', 'city', 'province', 'postal_code', 'custom_location', 'latitude', 'longitude')}),
        ('Compliance', {'fields': ('tin', 'philhealth_accreditation')}),
        ('Subscription', {'fields': ('subscription_plan', 'subscription_expires')}),
        ('Notifications', {'fields': ('email_notifications_enabled', 'sms_notifications_enabled')}),
        ('Branding', {'fields': ('logo', 'timezone')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )


@admin.register(Practitioner)
class PractitionerAdmin(admin.ModelAdmin):
    list_display    = ('__str__', 'clinic', 'discipline', 'specialization', 'license_number', 'is_accepting_patients')
    list_filter     = ('discipline', 'is_accepting_patients', 'clinic')
    search_fields   = ('user__email', 'user__first_name', 'user__last_name', 'license_number', 'prc_license')
    autocomplete_fields = ('user',)


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display  = ('name', 'clinic', 'is_active')
    list_filter   = ('is_active', 'clinic')
    search_fields = ('name', 'clinic__name')
