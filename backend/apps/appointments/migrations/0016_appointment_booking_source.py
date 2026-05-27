from django.db import migrations, models


def backfill_portal_booking_source(apps, schema_editor):
    """Set booking_source='portal' for appointments created from portal bookings."""
    Appointment = apps.get_model('appointments', 'Appointment')
    Appointment.objects.filter(
        notes__startswith='Created from portal booking'
    ).update(booking_source='portal')


class Migration(migrations.Migration):

    dependencies = [
        ('appointments', '0015_appointmentconfirmtoken'),
    ]

    operations = [
        migrations.AddField(
            model_name='appointment',
            name='booking_source',
            field=models.CharField(
                blank=True,
                choices=[
                    ('portal',       'Patient Portal'),
                    ('staff',        'Staff'),
                    ('admin',        'Admin'),
                    ('practitioner', 'Practitioner'),
                ],
                default='staff',
                help_text='How this appointment was originally booked',
                max_length=20,
            ),
        ),
        migrations.RunPython(
            backfill_portal_booking_source,
            migrations.RunPython.noop,
        ),
    ]
