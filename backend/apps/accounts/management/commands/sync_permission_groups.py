"""
Management command: sync_permission_groups

Re-derives and assigns the correct system PermissionGroup for every user
based on their current roles list, using the same priority logic as
derive_permission_group_for_roles() in accounts/models.py.

Usage:
    python manage.py sync_permission_groups            # dry-run output
    python manage.py sync_permission_groups --apply    # commit changes

Safe to re-run at any time — skips users whose group is already correct.
"""

from django.core.management.base import BaseCommand
from apps.accounts.models import User, derive_permission_group_for_roles


class Command(BaseCommand):
    help = (
        'Sync permission_group for all active users based on their clinical roles. '
        'Use --apply to commit changes (default is dry-run).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--apply',
            action='store_true',
            default=False,
            help='Commit changes to the database. Without this flag the command runs in dry-run mode.',
        )

    def handle(self, *args, **options):
        apply = options['apply']
        dry_run = not apply

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY-RUN mode — no changes will be saved. Pass --apply to commit.'))

        users = (
            User.objects.filter(is_deleted=False, clinic__isnull=False)
            .select_related('clinic', 'permission_group')
        )

        total = users.count()
        updated = 0
        skipped_no_group = 0
        already_correct = 0

        for user in users:
            roles = user.get_effective_roles()
            target_group = derive_permission_group_for_roles(roles, user.clinic)

            if target_group is None:
                skipped_no_group += 1
                self.stdout.write(
                    f'  SKIP (no system group found) — {user.email}  roles={roles}'
                )
                continue

            if user.permission_group_id == target_group.pk:
                already_correct += 1
                continue

            old_name = user.permission_group.name if user.permission_group_id else 'None'
            self.stdout.write(
                f'  UPDATE — {user.email}  {old_name} → {target_group.name}  (roles={roles})'
            )

            if not dry_run:
                User.objects.filter(pk=user.pk).update(permission_group=target_group)
            updated += 1

        mode = 'Would update' if dry_run else 'Updated'
        self.stdout.write(
            self.style.SUCCESS(
                f'\nDone. {mode} {updated}/{total} users. '
                f'Already correct: {already_correct}. '
                f'No system group found: {skipped_no_group}.'
            )
        )
