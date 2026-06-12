from django.db import migrations, models


def create_data_privacy_documents(apps, schema_editor):
    """
    Back-fill PatientConsentDocument records for all existing PatientConsent
    records that don't already have a corresponding DATA_PRIVACY_CONSENT
    document. This ensures historical consent records appear in the unified
    documents list immediately.
    """
    PatientConsent = apps.get_model('patients', 'PatientConsent')
    PatientConsentDocument = apps.get_model('patients', 'PatientConsentDocument')

    consents = PatientConsent.objects.filter(
        patient__isnull=False,
    ).select_related('patient', 'patient__clinic')

    created_count = 0
    for consent in consents:
        # Skip if a DATA_PRIVACY_CONSENT document already exists for this patient
        if PatientConsentDocument.objects.filter(
            patient=consent.patient,
            type='DATA_PRIVACY_CONSENT',
        ).exists():
            continue

        PatientConsentDocument.objects.create(
            patient=consent.patient,
            clinic=consent.patient.clinic,
            type='DATA_PRIVACY_CONSENT',
            title='Data Privacy Consent Form',
            header_snapshot='',
            body_snapshot=consent.consent_text,
            signature=consent.signature,
            signed_at=consent.created_at,
            signer_full_name=consent.full_name,
            signer_email=consent.email,
        )
        created_count += 1

    if created_count:
        print(f'\n  → Created {created_count} Data Privacy consent document(s) from existing records.')


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0026_rename_patient_con_patient__idx_patient_con_patient_ec0cac_idx_and_more'),
    ]

    operations = [
        # 1. Schema change: add DATA_PRIVACY_CONSENT to type choices
        migrations.AlterField(
            model_name='patientconsentdocument',
            name='type',
            field=models.CharField(
                choices=[
                    ('CLINIC_CONSENT', 'Clinic Consent Form'),
                    ('DATA_PRIVACY_CONSENT', 'Data Privacy Consent Form'),
                ],
                default='CLINIC_CONSENT',
                max_length=50,
            ),
        ),
        # 2. Data migration: back-fill document records for existing consents
        migrations.RunPython(
            create_data_privacy_documents,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
