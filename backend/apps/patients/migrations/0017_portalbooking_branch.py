from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0016_alter_patient_emergency_contact_phone_and_more'),
        ('clinics', '0014_alter_clinic_phone_alter_location_phone'),
    ]

    operations = [
        migrations.AddField(
            model_name='portalbooking',
            name='branch',
            field=models.ForeignKey(
                'clinics.Clinic',
                on_delete=django.db.models.deletion.SET_NULL,
                null=True,
                blank=True,
                related_name='portal_bookings',
                help_text='The specific branch the patient selected when booking.',
            ),
        ),
    ]
