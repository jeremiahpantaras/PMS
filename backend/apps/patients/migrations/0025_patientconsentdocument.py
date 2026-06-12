from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0024_make_address_fields_optional'),
        ('appointments', '0001_initial'),
        ('clinics', '0018_clinicconsentform'),
    ]

    operations = [
        migrations.CreateModel(
            name='PatientConsentDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('type', models.CharField(choices=[('CLINIC_CONSENT', 'Clinic Consent Form')], default='CLINIC_CONSENT', max_length=50)),
                ('title', models.CharField(default='Clinic Consent Form', max_length=255)),
                ('header_snapshot', models.TextField(blank=True, default='', help_text='HTML snapshot of the header content when signed')),
                ('body_snapshot', models.TextField(blank=True, default='', help_text='HTML snapshot of the body content when signed')),
                ('signature', models.TextField(help_text='base64 encoded PNG signature image')),
                ('signed_at', models.DateTimeField(help_text='Timestamp when the consent was signed')),
                ('consent_version', models.CharField(blank=True, default='', help_text='Version identifier of the consent form when signed', max_length=100)),
                ('ip_address', models.GenericIPAddressField(blank=True, help_text='IP address of the signer for audit purposes', null=True)),
                ('signer_full_name', models.CharField(max_length=255)),
                ('signer_email', models.EmailField(max_length=254)),
                ('appointment', models.ForeignKey(blank=True, help_text='Clinic service this appointment is for (replaces hardcoded type)', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='consent_documents', to='appointments.appointment')),
                ('clinic', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='consent_documents', to='clinics.clinic')),
                ('patient', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='consent_documents', to='patients.patient')),
            ],
            options={
                'db_table': 'patient_consent_documents',
                'ordering': ['-signed_at'],
            },
        ),
        migrations.AddIndex(
            model_name='patientconsentdocument',
            index=models.Index(fields=['patient', 'type'], name='patient_con_patient__idx'),
        ),
        migrations.AddIndex(
            model_name='patientconsentdocument',
            index=models.Index(fields=['clinic', 'signed_at'], name='patient_con_clinic__idx'),
        ),
        migrations.AddIndex(
            model_name='patientconsentdocument',
            index=models.Index(fields=['appointment'], name='patient_con_appoint_idx'),
        ),
    ]