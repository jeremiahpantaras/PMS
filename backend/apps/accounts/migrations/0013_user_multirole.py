"""
Migration: Multi-Role User Support
===================================
1. Adds `roles` JSONField to User — stores the full list of role slugs,
   e.g. ['ADMIN', 'PRACTITIONER'].
2. Data migration: populates `roles` from the existing single `role` field
   for every existing user so no one loses access.
3. Creates the UserRoleChangeLog audit table.
"""

from django.db import migrations, models
import django.utils.timezone


def populate_roles_from_role(apps, schema_editor):
    """Seed the new `roles` list from the existing single `role` field."""
    User = apps.get_model('accounts', 'User')
    for user in User.objects.all():
        if not user.roles:
            user.roles = [user.role] if user.role else ['STAFF']
            user.save(update_fields=['roles'])


def reverse_populate(apps, schema_editor):
    # Rolling back: clear the roles list (role field is unchanged).
    User = apps.get_model('accounts', 'User')
    User.objects.all().update(roles=[])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0012_normalize_user_emails_lowercase'),
    ]

    operations = [
        # ── 1. Add `roles` field ──────────────────────────────────────────
        migrations.AddField(
            model_name='user',
            name='roles',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text=(
                    'All roles assigned to this user. '
                    'The highest-priority entry drives the `role` field.'
                ),
            ),
        ),

        # ── 2. Seed roles from existing role field ────────────────────────
        migrations.RunPython(populate_roles_from_role, reverse_populate),

        # ── 3. UserRoleChangeLog audit table ─────────────────────────────
        migrations.CreateModel(
            name='UserRoleChangeLog',
            fields=[
                ('id',                models.AutoField(primary_key=True, serialize=False)),
                ('target_user_id',    models.IntegerField(db_index=True)),
                ('target_user_email', models.CharField(max_length=255)),
                ('changed_by_id',     models.IntegerField(null=True, db_index=True)),
                ('changed_by_email',  models.CharField(max_length=255, blank=True)),
                ('action',            models.CharField(
                    max_length=10,
                    choices=[('add', 'Role Added'), ('remove', 'Role Removed')],
                )),
                ('role',         models.CharField(max_length=20)),
                ('roles_before', models.JSONField(default=list)),
                ('roles_after',  models.JSONField(default=list)),
                ('timestamp',    models.DateTimeField(
                    default=django.utils.timezone.now,
                    db_index=True,
                )),
            ],
            options={
                'db_table': 'user_role_change_log',
                'ordering': ['-timestamp'],
            },
        ),
    ]
