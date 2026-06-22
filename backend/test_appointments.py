import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from apps.appointments.models import Appointment
from django.utils import timezone

today = timezone.now().date()
now_time = timezone.localtime().time()

print("ALL UPCOMING APPOINTMENTS:")
qs = Appointment.objects.filter(date__gte=today, is_deleted=False)
for apt in qs:
    print(f"ID: {apt.id}, Date: {apt.date}, Time: {apt.start_time}, Status: {apt.status}, PracID: {apt.practitioner_id}")

print("===================")
from apps.clinics.models import Practitioner
from apps.accounts.models import User
for p in Practitioner.objects.all():
    print(f"Prac {p.id}: User {p.user_id}, is_deleted={p.is_deleted}")

