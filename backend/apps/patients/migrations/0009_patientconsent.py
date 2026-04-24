from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0008_patient_last_checkin_sent_at_patient_last_visit_date'),
    ]

    operations = [
        migrations.CreateModel(
            name='PatientConsent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True, db_index=True)),
                ('full_name', models.CharField(max_length=255)),
                ('email', models.EmailField(max_length=254)),
                ('consent_text', models.TextField()),
                ('signature', models.TextField()),
                ('patient', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='consents', to='patients.patient')),
                ('portal_link', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='consents', to='patients.portallink')),
            ],
            options={
                'db_table': 'patient_consents',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='patientconsent',
            index=models.Index(fields=['portal_link', 'email'], name='patient_cons_portal__f54593_idx'),
        ),
        migrations.AddIndex(
            model_name='patientconsent',
            index=models.Index(fields=['patient', 'created_at'], name='patient_cons_patient_0cb527_idx'),
        ),
    ]
