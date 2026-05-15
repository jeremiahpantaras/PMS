"""
Migration: make emergency contact fields optional at the database level.

Emergency contact is now only required for minor patients (age < 18).
The business rule is enforced in the serializer's validate() method;
adult patients may legitimately have blank emergency contact fields.
"""

import apps.common.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0018_normalize_patient_emails_lowercase'),
    ]

    operations = [
        migrations.AlterField(
            model_name='patient',
            name='emergency_contact_name',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AlterField(
            model_name='patient',
            name='emergency_contact_phone',
            field=models.CharField(
                blank=True,
                max_length=15,
                validators=[apps.common.validators.validate_ph_phone],
            ),
        ),
        migrations.AlterField(
            model_name='patient',
            name='emergency_contact_relationship',
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
