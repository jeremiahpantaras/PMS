from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('clinics', '0017_alter_cliniccommunicationsettings_booking_confirmation_method_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='ClinicConsentForm',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('title', models.CharField(default='Patient Consent Form', help_text='Display title for this consent form', max_length=255)),
                ('header_content', models.TextField(blank=True, default='', help_text='HTML content for the consent form header')),
                ('body_content', models.TextField(blank=True, default='', help_text='HTML content for the consent form body/terms')),
                ('is_active', models.BooleanField(default=False, help_text='Only one consent form can be active per clinic')),
                ('clinic', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='consent_forms', to='clinics.clinic')),
            ],
            options={
                'db_table': 'clinic_consent_forms',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='clinicconsentform',
            index=models.Index(fields=['clinic', 'is_active'], name='clinic_cons_clinic__idx'),
        ),
    ]