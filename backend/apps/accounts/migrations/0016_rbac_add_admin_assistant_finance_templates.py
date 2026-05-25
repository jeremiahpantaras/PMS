"""
Migration: Expand PermissionGroup.role_template choices to include
ADMIN_ASSISTANT and FINANCE, then seed the two new system template groups
for every existing clinic and re-sync user permission_group assignments.
"""

from django.db import migrations, models


# ── Permission defaults (self-contained copy so migration stays portable) ─────

FEATURE_KEYS = [
    'dashboard', 'appointments', 'calendar', 'diary', 'clinical_notes',
    'client_cases', 'patients', 'reports', 'inventory', 'invoices',
    'billing', 'subscriptions', 'setup', 'staff_management', 'permissions',
    'settings', 'documents', 'outcome_measures', 'contacts', 'communication',
    'setup_practice', 'setup_items', 'setup_users', 'setup_account',
    'setup_communication', 'manage_administration', 'manage_clinical',
    'manage_communications', 'reports_administration', 'reports_clinic',
    'reports_financial', 'reports_performance',
]

ADMIN_ASSISTANT_PERMISSIONS = {
    'dashboard': 'edit', 'appointments': 'edit', 'calendar': 'edit',
    'diary': 'edit', 'clinical_notes': 'edit', 'client_cases': 'edit',
    'patients': 'edit', 'reports': 'edit', 'inventory': 'edit',
    'invoices': 'edit', 'billing': 'edit', 'subscriptions': 'view',
    'setup': 'view', 'staff_management': 'edit', 'permissions': 'view',
    'settings': 'view', 'documents': 'edit', 'outcome_measures': 'edit',
    'contacts': 'edit', 'communication': 'edit',
    'setup_practice': 'edit', 'setup_items': 'edit', 'setup_users': 'edit',
    'setup_account': 'view', 'setup_communication': 'edit',
    'manage_administration': 'edit', 'manage_clinical': 'edit',
    'manage_communications': 'edit',
    'reports_administration': 'edit', 'reports_clinic': 'edit',
    'reports_financial': 'edit', 'reports_performance': 'edit',
}

FINANCE_PERMISSIONS = {
    'dashboard': 'view', 'appointments': 'view', 'calendar': 'view',
    'diary': 'none', 'clinical_notes': 'none', 'client_cases': 'none',
    'patients': 'view', 'reports': 'view', 'inventory': 'view',
    'invoices': 'edit', 'billing': 'edit', 'subscriptions': 'none',
    'setup': 'none', 'staff_management': 'none', 'permissions': 'none',
    'settings': 'none', 'documents': 'none', 'outcome_measures': 'none',
    'contacts': 'view', 'communication': 'view',
    'setup_practice': 'none', 'setup_items': 'none', 'setup_users': 'none',
    'setup_account': 'none', 'setup_communication': 'none',
    'manage_administration': 'edit', 'manage_clinical': 'none',
    'manage_communications': 'none',
    'reports_administration': 'view', 'reports_clinic': 'none',
    'reports_financial': 'edit', 'reports_performance': 'view',
}

# New templates to seed — (role_template, display_name, permissions_dict)
NEW_TEMPLATES = [
    ('ADMIN_ASSISTANT', 'Admin Assistant', ADMIN_ASSISTANT_PERMISSIONS),
    ('FINANCE',         'Finance',         FINANCE_PERMISSIONS),
]

# Role → template mapping used for user re-sync
# Priority order follows ROLE_PRIORITY = ['ADMIN','ADMIN_ASSISTANT','PRACTITIONER','STAFF','FINANCE']
ROLE_TO_TEMPLATE = {
    'ADMIN':           'ADMIN_ASSISTANT',
    'ADMIN_ASSISTANT': 'ADMIN_ASSISTANT',
    'PRACTITIONER':    'PRACTITIONER',
    'STAFF':           'FRONTDESK',
    'FINANCE':         'FINANCE',
}

ROLE_PRIORITY = ['ADMIN', 'ADMIN_ASSISTANT', 'PRACTITIONER', 'STAFF', 'FINANCE']


def seed_new_templates(apps, schema_editor):
    """Create Admin Assistant and Finance system template groups for every clinic."""
    Clinic = apps.get_model('clinics', 'Clinic')
    PermissionGroup = apps.get_model('accounts', 'PermissionGroup')
    FeaturePermission = apps.get_model('accounts', 'FeaturePermission')

    for clinic in Clinic.objects.filter(is_main_branch=True, is_deleted=False):
        for template_key, template_name, perms in NEW_TEMPLATES:
            if PermissionGroup.objects.filter(clinic=clinic, name=template_name).exists():
                continue
            group = PermissionGroup.objects.create(
                clinic=clinic,
                name=template_name,
                description=f'Default {template_name} permission group.',
                role_template=template_key,
                is_protected=False,
                is_system_template=True,
            )
            for feature_key, access_level in perms.items():
                FeaturePermission.objects.create(
                    group=group,
                    feature_key=feature_key,
                    access_level=access_level,
                )


def sync_user_permission_groups(apps, schema_editor):
    """
    Re-assign permission_group for every user based on their current roles.
    Highest-priority role in ROLE_PRIORITY wins.
    """
    User = apps.get_model('accounts', 'User')
    PermissionGroup = apps.get_model('accounts', 'PermissionGroup')

    for user in User.objects.filter(is_deleted=False, clinic__isnull=False):
        clinic = user.clinic
        # Walk to main clinic if necessary
        main_clinic = clinic if getattr(clinic, 'is_main_branch', True) else getattr(clinic, 'parent_clinic', clinic)

        roles = user.roles or ([user.role] if user.role else [])
        target_group = None

        for role in ROLE_PRIORITY:
            if role not in roles:
                continue
            template = ROLE_TO_TEMPLATE.get(role)
            if not template:
                continue
            group = PermissionGroup.objects.filter(
                clinic=main_clinic,
                role_template=template,
                is_system_template=True,
            ).first()
            if group:
                target_group = group
                break

        if target_group and user.permission_group_id != target_group.pk:
            User.objects.filter(pk=user.pk).update(permission_group=target_group)


def reverse_new_templates(apps, schema_editor):
    """Remove the two new system template groups added by this migration."""
    PermissionGroup = apps.get_model('accounts', 'PermissionGroup')
    PermissionGroup.objects.filter(
        role_template__in=['ADMIN_ASSISTANT', 'FINANCE'],
        is_system_template=True,
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0015_alter_user_role'),
        ('clinics', '0001_initial'),
    ]

    operations = [
        # 1. Expand role_template choices on PermissionGroup
        migrations.AlterField(
            model_name='permissiongroup',
            name='role_template',
            field=models.CharField(
                choices=[
                    ('OWNER',           'Owner'),
                    ('MANAGER',         'Manager'),
                    ('ADMIN_ASSISTANT',  'Admin Assistant'),
                    ('FRONTDESK',       'Frontdesk'),
                    ('PRACTITIONER',    'Practitioner'),
                    ('FINANCE',         'Finance'),
                    ('CUSTOM',          'Custom'),
                ],
                default='CUSTOM',
                help_text='Starting template used to seed default permissions.',
                max_length=20,
            ),
        ),

        # 2. Seed new ADMIN_ASSISTANT and FINANCE system template groups
        migrations.RunPython(seed_new_templates, reverse_code=reverse_new_templates),

        # 3. Re-sync user permission_group assignments based on their roles
        migrations.RunPython(sync_user_permission_groups, reverse_code=migrations.RunPython.noop),
    ]
