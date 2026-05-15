"""
Data migration: normalize all existing User email addresses to lowercase.

Resolves the case-sensitive email login issue by ensuring every stored email
is lowercase, which matches the new save() override on the User model and the
EmailBackend.authenticate() normalization.

Any duplicate-after-lowercasing emails are resolved by deactivating the newer
account (higher pk) and appending +dup<id> to avoid a unique constraint error.
This is a safety net — duplicates should be rare in practice.
"""
import logging

from django.db import migrations

logger = logging.getLogger(__name__)


def normalize_user_emails(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    seen = {}
    # Process in ascending pk order so the oldest account wins.
    for user in User.objects.order_by('pk'):
        normalized = user.email.strip().lower()
        if normalized in seen:
            # Duplicate after normalization — mark as inactive and mangle email to satisfy UNIQUE.
            logger.warning(
                "Duplicate email after normalization: original=%s, normalized=%s (pk=%s). "
                "Deactivating and mangling email to resolve duplicate.",
                user.email, normalized, user.pk,
            )
            user.email = f"{normalized.replace('@', f'+dup{user.pk}@')}"
            user.is_active = False
        else:
            user.email = normalized
            seen[normalized] = user.pk
        user.save(update_fields=['email', 'is_active'])


def reverse_normalize_user_emails(apps, schema_editor):
    # Normalization is irreversible — emails were potentially mixed-case before.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_user_temp_password_expires_at'),
    ]

    operations = [
        migrations.RunPython(
            normalize_user_emails,
            reverse_normalize_user_emails,
        ),
    ]
