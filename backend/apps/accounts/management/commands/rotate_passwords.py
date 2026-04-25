from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Rotate passwords for users whose rotation schedule is due.'

    def handle(self, *args, **options):
        # Deferred imports to avoid circular-import issues at module load time
        from apps.accounts.models import User
        from apps.accounts.services.password_service import PasswordService
        from apps.accounts.services.email_service import EmailService

        now = timezone.now()

        # Build a map of rotation → timedelta threshold
        thresholds = {
            'weekly':  timedelta(days=7),
            'monthly': timedelta(days=30),
            'yearly':  timedelta(days=365),
        }

        rotated = 0
        failed = 0

        for rotation_key, delta in thresholds.items():
            due_cutoff = now - delta
            # Users with this rotation schedule whose last change is overdue
            # (or who have never had their password changed via this system).
            candidates = User.objects.filter(
                is_active=True,
                is_deleted=False,
                password_rotation=rotation_key,
            ).filter(
                # last_password_change is null OR older than the threshold
                last_password_change__isnull=True,
            ) | User.objects.filter(
                is_active=True,
                is_deleted=False,
                password_rotation=rotation_key,
                last_password_change__lte=due_cutoff,
            )

            for user in candidates.distinct():
                try:
                    new_password = PasswordService.reset_password(user)
                    EmailService.send_password_rotation_email(
                        user_email=user.email,
                        user_name=user.get_full_name(),
                        new_password=new_password,
                    )
                    rotated += 1
                    logger.info(
                        f"[rotate_passwords] Rotated password for {user.email} "
                        f"(rotation={rotation_key})"
                    )
                except Exception as exc:
                    failed += 1
                    logger.error(
                        f"[rotate_passwords] Failed for {user.email}: {exc}"
                    )

        summary = f"Password rotation complete: {rotated} rotated, {failed} failed."
        self.stdout.write(self.style.SUCCESS(summary))
        logger.info(summary)
