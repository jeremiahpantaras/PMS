from django.contrib import admin
from .models import PatientConsent


@admin.register(PatientConsent)
class PatientConsentAdmin(admin.ModelAdmin):
	list_display = ('id', 'full_name', 'email', 'patient', 'portal_link', 'created_at')
	search_fields = ('full_name', 'email', 'patient__first_name', 'patient__last_name')
	list_filter = ('created_at', 'portal_link__clinic')
