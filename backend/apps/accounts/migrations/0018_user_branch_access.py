"""
0018_user_branch_access

Phase 4 — Branch Assignment Engine
-----------------------------------
1. Creates the `user_branch_access` table (UserBranchAccess model).
2. Seeds existing ADMIN_ASSISTANT users who already have a clinic_branch FK
   set into the new table so existing Manager->Branch relationships are
   preserved without any manual data entry.
"""
from django.db import migrations, models
import django.db.models.deletion


def seed_manager_branch_access(apps, schema_editor):
    """
    For every existing ADMIN_ASSISTANT user that already has a clinic_branch
    set, create a UserBranchAccess row so the new M2M table reflects reality
    immediately after the migration runs.
    """
    User = apps.get_model('accounts', 'User')
    UserBranchAccess = apps.get_model('accounts', 'UserBranchAccess')

    # JSONField contains-filter: pick users whose roles list includes ADMIN_ASSISTANT
    managers = User.objects.filter(
        is_deleted=False,
        clinic_branch__isnull=False,
        roles__contains=['ADMIN_ASSISTANT'],
    )

    to_create = []
    seen = set()
    for manager in managers:
        key = (manager.pk, manager.clinic_branch_id)
        if key not in seen:
            seen.add(key)
            to_create.append(
                UserBranchAccess(user_id=manager.pk, branch_id=manager.clinic_branch_id)
            )

    if to_create:
        UserBranchAccess.objects.bulk_create(to_create, ignore_conflicts=True)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0017_add_read_only_role'),
        ('clinics', '0001_initial'),
    ]

    operations = [
        # ── 1. Create the UserBranchAccess table ──────────────────────────────
        migrations.CreateModel(
            name='UserBranchAccess',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(
                    help_text='The user who has access to / manages this branch.',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='branch_accesses',
                    to='accounts.user',
                )),
                ('branch', models.ForeignKey(
                    help_text='The clinic branch the user can access.',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='user_branch_accesses',
                    to='clinics.clinic',
                )),
            ],
            options={
                'db_table': 'user_branch_access',
                'ordering': ['branch__name'],
                'unique_together': {('user', 'branch')},
            },
        ),

        # ── 2. Indexes ────────────────────────────────────────────────────────
        migrations.AddIndex(
            model_name='userbranchaccess',
            index=models.Index(fields=['user', 'branch'], name='uba_user_branch_idx'),
        ),
        migrations.AddIndex(
            model_name='userbranchaccess',
            index=models.Index(fields=['branch'], name='uba_branch_idx'),
        ),

        # ── 3. Data migration: seed existing ADMIN_ASSISTANT clinic_branch FKs ─
        migrations.RunPython(
            seed_manager_branch_access,
            migrations.RunPython.noop,
        ),
    ]
