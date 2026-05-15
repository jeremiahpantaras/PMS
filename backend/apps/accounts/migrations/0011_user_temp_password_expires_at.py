from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_add_must_change_password'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='temp_password_expires_at',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text=(
                    'Expiry timestamp for system-issued temporary credentials. '
                    'Null means no TTL is enforced.'
                ),
            ),
        ),
    ]
