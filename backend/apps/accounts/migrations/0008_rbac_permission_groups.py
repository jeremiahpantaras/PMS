"""
Migration: Add PermissionGroup, FeaturePermission, and User.permission_group FK.
Also seeds default permission groups for every existing clinic.
"""

from django.db import migrations, models
import django.db.models.deletion

# Feature keys mirrored here so the migration is self-contained
FEATURE_KEYS = [
    'dashboard', 'appointments', 'calendar', 'diary', 'clinical_notes',
    'client_cases', 'patients', 'reports', 'inventory', 'invoices',
    'billing', 'subscriptions', 'setup', 'staff_management', 'permissions',
    'settings', 'documents', 'outcome_measures', 'contacts', 'communication',
]

DEFAULT_PERMISSIONS = {
    'OWNER': {key: 'edit' for key in FEATURE_KEYS},
    'MANAGER': {
        'dashboard': 'edit', 'appointments': 'edit', 'calendar': 'edit',
        'diary': 'edit', 'clinical_notes': 'edit', 'client_cases': 'edit',
        'patients': 'edit', 'reports': 'edit', 'inventory': 'edit',
        'invoices': 'edit', 'billing': 'edit', 'subscriptions': 'view',
        'setup': 'view', 'staff_management': 'edit', 'permissions': 'view',
        'settings': 'view', 'documents': 'edit', 'outcome_measures': 'edit',
        'contacts': 'edit', 'communication': 'edit',
    },
    'FRONTDESK': {
        'dashboard': 'view', 'appointments': 'edit', 'calendar': 'edit',
        'diary': 'edit', 'clinical_notes': 'view', 'client_cases': 'view',
        'patients': 'edit', 'reports': 'view', 'inventory': 'view',
        'invoices': 'edit', 'billing': 'view', 'subscriptions': 'none',
        'setup': 'none', 'staff_management': 'none', 'permissions': 'none',
        'settings': 'none', 'documents': 'view', 'outcome_measures': 'view',
        'contacts': 'edit', 'communication': 'edit',
    },
    'PRACTITIONER': {
        'dashboard': 'view', 'appointments': 'edit', 'calendar': 'edit',
        'diary': 'edit', 'clinical_notes': 'edit', 'client_cases': 'edit',
        'patients': 'edit', 'reports': 'view', 'inventory': 'view',
        'invoices': 'view', 'billing': 'none', 'subscriptions': 'none',
        'setup': 'none', 'staff_management': 'none', 'permissions': 'none',
        'settings': 'none', 'documents': 'edit', 'outcome_measures': 'edit',
        'contacts': 'edit', 'communication': 'view',
    },
}

TEMPLATE_NAMES = {
    'OWNER':        'Owner',
    'MANAGER':      'Manager',
    'FRONTDESK':    'Frontdesk',
    'PRACTITIONER': 'Practitioner',
}


def seed_default_groups(apps, schema_editor):
    """Create default PermissionGroups for every existing main clinic."""
    Clinic = apps.get_model('clinics', 'Clinic')
    PermissionGroup = apps.get_model('accounts', 'PermissionGroup')
    FeaturePermission = apps.get_model('accounts', 'FeaturePermission')

    main_clinics = Clinic.objects.filter(is_main_branch=True, is_deleted=False)

    for clinic in main_clinics:
        for template_key, template_name in TEMPLATE_NAMES.items():
            # Idempotent: skip if already exists
            if PermissionGroup.objects.filter(clinic=clinic, name=template_name).exists():
                continue

            group = PermissionGroup.objects.create(
                clinic=clinic,
                name=template_name,
                description=f'Default {template_name} permission group.',
                role_template=template_key,
                is_protected=(template_key == 'OWNER'),
                is_system_template=True,
            )

            perms = DEFAULT_PERMISSIONS.get(template_key, {})
            for feature_key, access_level in perms.items():
                FeaturePermission.objects.create(
                    group=group,
                    feature_key=feature_key,
                    access_level=access_level,
                )


def assign_default_groups(apps, schema_editor):
    """
    Assign default permission groups to existing users based on their role.
    ADMIN   → Owner group
    STAFF   → Frontdesk group
    PRACTITIONER → Practitioner group
    """
    User = apps.get_model('accounts', 'User')
    PermissionGroup = apps.get_model('accounts', 'PermissionGroup')

    role_to_template = {
        'ADMIN':        'Owner',
        'STAFF':        'Frontdesk',
        'PRACTITIONER': 'Practitioner',
    }

    for user in User.objects.filter(is_deleted=False, clinic__isnull=False):
        template_name = role_to_template.get(user.role)
        if not template_name:
            continue
        try:
            # Find group in the user's main clinic
            clinic = user.clinic
            # Walk up to main clinic if needed
            main_clinic = clinic if clinic.is_main_branch else getattr(clinic, 'parent_clinic', clinic)
            group = PermissionGroup.objects.filter(
                clinic=main_clinic,
                name=template_name,
                is_system_template=True,
            ).first()
            if group:
                User.objects.filter(pk=user.pk).update(permission_group=group)
        except Exception:
            pass  # Non-critical — leave null if anything goes wrong


def remove_default_groups(apps, schema_editor):
    PermissionGroup = apps.get_model('accounts', 'PermissionGroup')
    PermissionGroup.objects.filter(is_system_template=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_user_discipline'),
        ('clinics', '0001_initial'),
    ]

    operations = [
        # 1. Create PermissionGroup table
        migrations.CreateModel(
            name='PermissionGroup',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True)),
                ('role_template', models.CharField(
                    choices=[
                        ('OWNER', 'Owner'),
                        ('MANAGER', 'Manager'),
                        ('FRONTDESK', 'Frontdesk'),
                        ('PRACTITIONER', 'Practitioner'),
                        ('CUSTOM', 'Custom'),
                    ],
                    default='CUSTOM',
                    max_length=20,
                )),
                ('is_protected', models.BooleanField(default=False)),
                ('is_system_template', models.BooleanField(default=False)),
                ('clinic', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='permission_groups',
                    to='clinics.clinic',
                )),
            ],
            options={
                'db_table': 'permission_groups',
                'ordering': ['role_template', 'name'],
                'unique_together': {('clinic', 'name')},
            },
        ),

        # 2. Create FeaturePermission table
        migrations.CreateModel(
            name='FeaturePermission',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ('feature_key', models.CharField(max_length=100)),
                ('access_level', models.CharField(
                    choices=[
                        ('none', 'No Access'),
                        ('view', 'View'),
                        ('edit', 'Edit'),
                    ],
                    default='none',
                    max_length=10,
                )),
                ('group', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='feature_permissions',
                    to='accounts.permissiongroup',
                )),
            ],
            options={
                'db_table': 'feature_permissions',
                'unique_together': {('group', 'feature_key')},
            },
        ),

        # 3. Add permission_group FK to User
        migrations.AddField(
            model_name='user',
            name='permission_group',
            field=models.ForeignKey(
                blank=True,
                help_text='RBAC permission group assigned to this user.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='users',
                to='accounts.permissiongroup',
            ),
        ),

        # 4. Seed default groups for existing clinics
        migrations.RunPython(seed_default_groups, reverse_code=remove_default_groups),

        # 5. Assign default groups to existing users
        migrations.RunPython(assign_default_groups, migrations.RunPython.noop),
    ]
