# Generated migration for Communication Records Hub
# Extends CommunicationLog and adds CommunicationReply, CommunicationAttachment

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clinics', '0013_cliniccommunicationsettings'),
        ('notifications', '0005_communicationlog'),
    ]

    operations = [
        # ── Add new comm_type choices (no schema change needed, just docs) ───────
        # ── Extend CommunicationLog ───────────────────────────────────────────────
        migrations.AlterField(
            model_name='communicationlog',
            name='comm_type',
            field=models.CharField(
                choices=[
                    ('BOOKING_CONFIRMATION',    'Booking Confirmation'),
                    ('RECURRING_CONFIRMATION',  'Recurring Booking Confirmation'),
                    ('APPOINTMENT_REMINDER',    'Appointment Reminder'),
                    ('DNA_FOLLOWUP',            'DNA / Decline Follow-up'),
                    ('REBOOK_FOLLOWUP',         'No-Rebook Follow-up'),
                    ('INACTIVE_CHECKIN',        'Inactive Patient Check-in'),
                    ('CANCELLATION_NOTICE',     'Cancellation Notice'),
                    ('CLINICAL_NOTE',           'Clinical Note Email'),
                    ('OTP_VERIFICATION',        'OTP Verification'),
                    ('PASSWORD_RESET',          'Password Reset'),
                    ('INVOICE_EMAIL',           'Invoice Email'),
                    ('RESCHEDULE_FOLLOWUP',     'Reschedule Follow-up'),
                    ('SYSTEM_NOTIFICATION',     'System Notification'),
                ],
                db_index=True,
                max_length=30,
            ),
        ),
        migrations.AlterField(
            model_name='communicationlog',
            name='status',
            field=models.CharField(
                choices=[
                    ('QUEUED',    'Queued'),
                    ('SENT',      'Sent'),
                    ('DELIVERED', 'Delivered'),
                    ('OPENED',    'Opened'),
                    ('REPLIED',   'Replied'),
                    ('FAILED',    'Failed'),
                    ('BOUNCED',   'Bounced'),
                    ('PENDING',   'Pending'),
                ],
                default='SENT',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='communicationlog',
            name='practitioner',
            field=models.ForeignKey(
                blank=True,
                help_text='Practitioner associated with this communication (if any)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='communication_logs',
                to='clinics.practitioner',
            ),
        ),
        migrations.AddField(
            model_name='communicationlog',
            name='full_body',
            field=models.TextField(blank=True, help_text='Complete message body for detail view'),
        ),
        migrations.AddField(
            model_name='communicationlog',
            name='delivered_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='communicationlog',
            name='opened_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='communicationlog',
            name='bounced_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='communicationlog',
            name='message_id',
            field=models.CharField(blank=True, db_index=True, max_length=200),
        ),
        migrations.AddIndex(
            model_name='communicationlog',
            index=models.Index(fields=['status', 'created_at'], name='communicati_status_crat_idx'),
        ),
        migrations.AddIndex(
            model_name='communicationlog',
            index=models.Index(fields=['clinic', 'status'], name='communicati_clinic_stat_idx'),
        ),

        # ── CommunicationReply ────────────────────────────────────────────────────
        migrations.CreateModel(
            name='CommunicationReply',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('sender_type', models.CharField(
                    choices=[('PATIENT', 'Patient'), ('STAFF', 'Staff'), ('SYSTEM', 'System')],
                    default='PATIENT',
                    max_length=10,
                )),
                ('sender_name', models.CharField(blank=True, max_length=200)),
                ('message', models.TextField()),
                ('communication_log', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='replies',
                    to='notifications.communicationlog',
                )),
            ],
            options={
                'db_table': 'communication_replies',
                'ordering': ['created_at'],
            },
        ),

        # ── CommunicationAttachment ───────────────────────────────────────────────
        migrations.CreateModel(
            name='CommunicationAttachment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('file_name', models.CharField(max_length=255)),
                ('file_url', models.TextField(blank=True)),
                ('attachment_type', models.CharField(
                    choices=[
                        ('PDF',      'PDF Document'),
                        ('IMAGE',    'Image'),
                        ('INVOICE',  'Invoice PDF'),
                        ('CLINICAL', 'Clinical Note PDF'),
                        ('OTHER',    'Other'),
                    ],
                    default='OTHER',
                    max_length=10,
                )),
                ('file_size_bytes', models.IntegerField(blank=True, null=True)),
                ('communication_log', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='attachments',
                    to='notifications.communicationlog',
                )),
            ],
            options={
                'db_table': 'communication_attachments',
                'ordering': ['created_at'],
            },
        ),
    ]
