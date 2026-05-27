from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('appointments', '0017_calendarnote_practitioner'),
        ('clinics', '__first__'),
    ]

    operations = [
        migrations.AddField(
            model_name='blockappointment',
            name='practitioner',
            field=models.ForeignKey(
                blank=True,
                help_text='Practitioner this block belongs to. Null = clinic-wide block visible in all columns.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='block_appointments',
                to='clinics.practitioner',
            ),
        ),
        migrations.AddIndex(
            model_name='blockappointment',
            index=models.Index(fields=['practitioner', 'date'], name='block_appts_prac_date_idx'),
        ),
    ]
