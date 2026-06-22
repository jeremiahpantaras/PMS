import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.appointments.models import Appointment
from apps.patients.models import Patient
from apps.clinics.models import Clinic, Practitioner
from django.contrib.auth import get_user_model
from datetime import date, time

User = get_user_model()
clinic = Clinic.objects.first()
user = User.objects.first()
patient = Patient.objects.first()

if not patient:
    patient = Patient.objects.create(first_name="Test", last_name="Patient", email="test@example.com", phone="1234567890", clinic=clinic)

practitioner = Practitioner.objects.first()

if not practitioner:
    practitioner = Practitioner.objects.create(user=user, clinic=clinic)

# Create an appointment
apt = Appointment.objects.create(
    clinic=clinic,
    patient=patient,
    practitioner=practitioner,
    date=date(2030, 1, 1),
    start_time=time(10, 0),
    end_time=time(11, 0),
    status='SCHEDULED',
)

print(f"Created appointment {apt.id}")

qs = Appointment.objects.filter(id=apt.id)
deleted, _ = qs.delete()

print(f"Deleted return: {deleted}")

# Check if it still exists in db
exists = Appointment.objects.filter(id=apt.id).exists()
print(f"Exists using filter: {exists}")

# Try to get using raw sql
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute(f"SELECT is_deleted FROM appointments WHERE id = {apt.id}")
    row = cursor.fetchone()
    print(f"Row from db: {row}")

