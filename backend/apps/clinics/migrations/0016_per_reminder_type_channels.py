from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clinics', '0015_normalize_clinic_emails_lowercase'),
    ]

    operations = [
        # New per-type channel fields
        migrations.AddField(
            model_name='cliniccommunicationsettings',
            name='cancellation_method',
            field=models.CharField(
                choices=[('EMAIL', 'Email Only'), ('SMS', 'SMS Only'), ('BOTH', 'Email & SMS')],
                default='SMS',
                help_text='Channel for appointment cancellation notices.',
                max_length=5,
            ),
        ),
        migrations.AddField(
            model_name='cliniccommunicationsettings',
            name='dna_followup_method',
            field=models.CharField(
                choices=[('EMAIL', 'Email Only'), ('SMS', 'SMS Only'), ('BOTH', 'Email & SMS')],
                default='SMS',
                help_text='Channel for DNA / did-not-attend follow-ups.',
                max_length=5,
            ),
        ),
        migrations.AddField(
            model_name='cliniccommunicationsettings',
            name='rebook_followup_method',
            field=models.CharField(
                choices=[('EMAIL', 'Email Only'), ('SMS', 'SMS Only'), ('BOTH', 'Email & SMS')],
                default='EMAIL',
                help_text='Channel for no-rebook delayed follow-ups.',
                max_length=5,
            ),
        ),
        migrations.AddField(
            model_name='cliniccommunicationsettings',
            name='inactive_checkin_method',
            field=models.CharField(
                choices=[('EMAIL', 'Email Only'), ('SMS', 'SMS Only'), ('BOTH', 'Email & SMS')],
                default='EMAIL',
                help_text='Channel for inactive patient wellness check-ins.',
                max_length=5,
            ),
        ),
        migrations.AddField(
            model_name='cliniccommunicationsettings',
            name='profile_creation_method',
            field=models.CharField(
                choices=[('EMAIL', 'Email Only'), ('SMS', 'SMS Only'), ('BOTH', 'Email & SMS')],
                default='EMAIL',
                help_text='Channel for new patient profile creation notifications.',
                max_length=5,
            ),
        ),
        # New feature toggles
        migrations.AddField(
            model_name='cliniccommunicationsettings',
            name='cancellation_enabled',
            field=models.BooleanField(
                default=True,
                help_text='Send notification when an appointment is cancelled.',
            ),
        ),
        migrations.AddField(
            model_name='cliniccommunicationsettings',
            name='profile_creation_enabled',
            field=models.BooleanField(
                default=True,
                help_text='Send notification when a new patient profile is created.',
            ),
        ),
    ]
