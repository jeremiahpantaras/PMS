"""
Signals for the accounts app.

Auto-creates default PermissionGroups when a new main-branch Clinic is created,
so every clinic always has Owner / Manager / Frontdesk / Practitioner groups ready.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='clinics.Clinic')
def create_default_permission_groups(sender, instance, created, **kwargs):
    """Seed the four default permission groups for every new main-branch clinic."""
    if not created:
        return
    if not getattr(instance, 'is_main_branch', False):
        return

    # Import here to avoid circular imports at module load time
    from apps.accounts.models import PermissionGroup, FeaturePermission, DEFAULT_PERMISSIONS

    TEMPLATE_NAMES = {
        'OWNER':           'Owner',
        'ADMIN_ASSISTANT': 'Admin Assistant',
        'FRONTDESK':       'Frontdesk',
        'PRACTITIONER':    'Practitioner',
        'FINANCE':         'Finance',
    }

    for template_key, template_name in TEMPLATE_NAMES.items():
        if PermissionGroup.objects.filter(clinic=instance, name=template_name).exists():
            continue

        group = PermissionGroup.objects.create(
            clinic=instance,
            name=template_name,
            description=f'Default {template_name} permission group.',
            role_template=template_key,
            is_protected=(template_key == 'OWNER'),
            is_system_template=True,
        )

        for feature_key, access_level in DEFAULT_PERMISSIONS.get(template_key, {}).items():
            FeaturePermission.objects.create(
                group=group,
                feature_key=feature_key,
                access_level=access_level,
            )
