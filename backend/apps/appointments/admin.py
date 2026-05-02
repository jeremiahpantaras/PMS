from django.contrib import admin
from .models import Appointment, PractitionerSchedule, AppointmentReminder, BlockAppointment, CalendarNote


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display    = ('id', 'patient', 'practitioner', 'clinic', 'date', 'start_time', 'status', 'arrival_status', 'created_at')
    list_filter     = ('status', 'arrival_status', 'clinic', 'date')
    search_fields   = ('patient__first_name', 'patient__last_name', 'practitioner__user__last_name', 'notes')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy  = 'date'


@admin.register(PractitionerSchedule)
class PractitionerScheduleAdmin(admin.ModelAdmin):
    list_display  = ('practitioner', 'location', 'weekday', 'start_time', 'end_time', 'is_available')
    list_filter   = ('weekday', 'is_available')
    search_fields = ('practitioner__user__first_name', 'practitioner__user__last_name')


@admin.register(AppointmentReminder)
class AppointmentReminderAdmin(admin.ModelAdmin):
    list_display    = ('appointment', 'reminder_type', 'sent_at', 'is_successful')
    list_filter     = ('reminder_type', 'is_successful')
    readonly_fields = ('sent_at',)


@admin.register(BlockAppointment)
class BlockAppointmentAdmin(admin.ModelAdmin):
    list_display    = ('event_name', 'clinic', 'date', 'start_time', 'end_time', 'created_by', 'created_at')
    list_filter     = ('clinic', 'date', 'visibility_type')
    search_fields   = ('event_name', 'notes')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(CalendarNote)
class CalendarNoteAdmin(admin.ModelAdmin):
    list_display    = ('clinic', 'date', 'start_time', 'end_time', 'created_by', 'created_at')
    list_filter     = ('clinic', 'date')
    search_fields   = ('message',)
    readonly_fields = ('created_at', 'updated_at')
