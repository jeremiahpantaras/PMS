from django.contrib import admin
from .models import ClinicalNote, NoteTemplate, OutcomeMeasure, Attachment


@admin.register(ClinicalNote)
class ClinicalNoteAdmin(admin.ModelAdmin):
    list_display    = ('patient', 'practitioner', 'clinic', 'note_type', 'date', 'is_signed', 'created_at')
    list_filter     = ('note_type', 'is_signed', 'clinic', 'date')
    search_fields   = ('patient__first_name', 'patient__last_name', 'practitioner__user__last_name')
    readonly_fields = ('created_at', 'updated_at', 'signed_at')
    date_hierarchy  = 'date'


@admin.register(NoteTemplate)
class NoteTemplateAdmin(admin.ModelAdmin):
    list_display  = ('name', 'clinic', 'note_type', 'is_active', 'created_at')
    list_filter   = ('note_type', 'is_active', 'clinic')
    search_fields = ('name',)


@admin.register(OutcomeMeasure)
class OutcomeMeasureAdmin(admin.ModelAdmin):
    list_display    = ('patient', 'practitioner', 'measure_name', 'date', 'score', 'created_at')
    list_filter     = ('measure_name',)
    search_fields   = ('patient__first_name', 'patient__last_name', 'measure_name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display    = ('patient', 'file_name', 'file_type', 'uploaded_by', 'created_at')
    list_filter     = ('file_type',)
    search_fields   = ('file_name', 'patient__first_name', 'patient__last_name')
    readonly_fields = ('created_at',)
