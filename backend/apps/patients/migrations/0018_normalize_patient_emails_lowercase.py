"""
Data migration: normalize all existing Patient and PortalBooking email addresses
to lowercase.
"""
from django.db import migrations


def normalize_patient_emails(apps, schema_editor):
    Patient = apps.get_model('patients', 'Patient')
    for patient in Patient.objects.exclude(email=''):
        normalized = patient.email.strip().lower()
        if patient.email != normalized:
            patient.email = normalized
            patient.save(update_fields=['email'])


def reverse_normalize_patient_emails(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0017_portalbooking_branch'),
    ]

    operations = [
        migrations.RunPython(
            normalize_patient_emails,
            reverse_normalize_patient_emails,
        ),
    ]
