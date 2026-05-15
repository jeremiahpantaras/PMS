"""
Data migration: normalize all existing Contact email addresses to lowercase.
"""
from django.db import migrations


def normalize_contact_emails(apps, schema_editor):
    Contact = apps.get_model('contacts', 'Contact')
    for contact in Contact.objects.exclude(email__isnull=True).exclude(email=''):
        normalized = contact.email.strip().lower()
        if contact.email != normalized:
            contact.email = normalized
            contact.save(update_fields=['email'])


def reverse_normalize_contact_emails(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('contacts', '0002_alter_contact_contact_type'),
    ]

    operations = [
        migrations.RunPython(
            normalize_contact_emails,
            reverse_normalize_contact_emails,
        ),
    ]
