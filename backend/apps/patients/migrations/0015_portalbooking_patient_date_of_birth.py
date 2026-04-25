from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0014_clientformrequest_accepted_at_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='portalbooking',
            name='patient_date_of_birth',
            field=models.DateField(
                blank=True,
                null=True,
                help_text='Date of birth collected during portal booking.',
            ),
        ),
    ]
