# Generated migration — PayMongo integration fields

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('subscriptions', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Add paymongo_checkout_id to Subscription
        migrations.AddField(
            model_name='subscription',
            name='paymongo_checkout_id',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        # Audit log model for every processed webhook event
        migrations.CreateModel(
            name='PayMongoPaymentLog',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                ('event_type', models.CharField(max_length=100)),
                ('checkout_id', models.CharField(blank=True, default='', max_length=100)),
                ('payment_id', models.CharField(blank=True, default='', max_length=100)),
                ('amount', models.IntegerField(default=0)),
                ('currency', models.CharField(default='PHP', max_length=10)),
                ('raw_payload', models.JSONField(default=dict)),
                ('processed_at', models.DateTimeField(auto_now_add=True)),
                (
                    'user',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='paymongo_logs',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'ordering': ['-processed_at'],
            },
        ),
    ]
