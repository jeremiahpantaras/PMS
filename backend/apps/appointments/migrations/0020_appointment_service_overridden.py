from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('appointments', '0019_rename_block_appts_prac_date_idx_block_appoi_practit_35b2d6_idx'),
    ]

    operations = [
        migrations.AddField(
            model_name='appointment',
            name='service_overridden',
            field=models.BooleanField(
                default=False,
                help_text='True when a practitioner/admin has manually changed the consultation type on a portal booking.',
            ),
        ),
    ]
