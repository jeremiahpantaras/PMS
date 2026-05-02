from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering        = ['-created_at']
    list_display    = ('email', 'first_name', 'last_name', 'role', 'clinic', 'is_active', 'is_staff', 'date_joined')
    list_filter     = ('role', 'is_active', 'is_staff', 'is_superuser', 'clinic')
    search_fields   = ('email', 'first_name', 'last_name', 'phone')
    readonly_fields = ('date_joined', 'last_login', 'created_at', 'updated_at')

    # Replace username-based fieldsets with email-based ones
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal info'), {'fields': ('first_name', 'last_name', 'phone', 'avatar', 'position', 'discipline')}),
        (_('Clinic'), {'fields': ('clinic', 'clinic_branch')}),
        (_('Role & Permissions'), {'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        (_('Password Rotation'), {'fields': ('password_rotation', 'last_password_change', 'password_changed')}),
        (_('Availability'), {'fields': ('duty_days', 'lunch_start_time', 'lunch_end_time', 'duty_schedule')}),
        (_('Important dates'), {'fields': ('last_login', 'date_joined', 'created_at', 'updated_at')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'role', 'password1', 'password2'),
        }),
    )
