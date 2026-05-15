"""
Data migration: normalize all existing Clinic email addresses to lowercase.
"""
from django.db import migrations


def normalize_clinic_emails(apps, schema_editor):
    Clinic = apps.get_model('clinics', 'Clinic')
    for clinic in Clinic.objects.exclude(email=''):
        normalized = clinic.email.strip().lower()
        if clinic.email != normalized:
            clinic.email = normalized
            clinic.save(update_fields=['email'])


def reverse_normalize_clinic_emails(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('clinics', '0014_alter_clinic_phone_alter_location_phone'),
    ]

    operations = [
        migrations.RunPython(
            normalize_clinic_emails,
            reverse_normalize_clinic_emails,
        ),
    ]
