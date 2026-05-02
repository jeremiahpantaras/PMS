from django.contrib import admin
from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display    = ('id', 'clinic', 'report_type', 'file_format', 'generated_by', 'created_at')
    list_filter     = ('report_type', 'file_format', 'clinic')
    search_fields   = ('clinic__name', 'generated_by__email')
    readonly_fields = ('created_at',)

    def has_add_permission(self, request):
        return False  # Reports are generated via the API, not manually
