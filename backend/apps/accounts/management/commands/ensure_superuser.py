"""
Management command: ensure_superuser
-------------------------------------
Idempotently creates the platform superuser from environment variables.
Safe to run on every deploy — exits silently if the superuser already exists.

Environment variables (required in production):
    DJANGO_SUPERUSER_EMAIL    – e.g. admin@malasakit.com
    DJANGO_SUPERUSER_PASSWORD – strong password

Usage:
    python manage.py ensure_superuser
"""

import os
import logging

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)
User = get_user_model()


class Command(BaseCommand):
    help = "Idempotently create the platform superuser from environment variables."

    def handle(self, *args, **options):
        email    = os.getenv("DJANGO_SUPERUSER_EMAIL", "").strip()
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD", "").strip()

        if not email or not password:
            self.stderr.write(
                self.style.WARNING(
                    "ensure_superuser: DJANGO_SUPERUSER_EMAIL or "
                    "DJANGO_SUPERUSER_PASSWORD not set — skipping."
                )
            )
            return

        if User.objects.filter(email=email).exists():
            self.stdout.write(
                self.style.SUCCESS(f"ensure_superuser: superuser '{email}' already exists — skipping.")
            )
            return

        User.objects.create_superuser(
            email=email,
            password=password,
            first_name=os.getenv("DJANGO_SUPERUSER_FIRST_NAME", "Malasakit"),
            last_name=os.getenv("DJANGO_SUPERUSER_LAST_NAME", "Admin"),
        )
        self.stdout.write(self.style.SUCCESS(f"ensure_superuser: superuser '{email}' created successfully."))
        logger.info("ensure_superuser: created superuser %s", email)
