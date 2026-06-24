from django.core.management.base import BaseCommand
from django.db import transaction
from apps.patients.models import Patient
from apps.appointments.models import Appointment

class Command(BaseCommand):
    help = 'Backfills home_branch for existing patients based on their earliest appointment.'

    def handle(self, *args, **options):
        patients = Patient.objects.filter(is_deleted=False, home_branch__isnull=True)
        total = patients.count()
        self.stdout.write(self.style.WARNING(f"Found {total} active patients without a home_branch."))

        updated_count = 0
        skipped_count = 0

        with transaction.atomic():
            for patient in patients:
                # Get the earliest appointment for this patient
                first_appt = Appointment.objects.filter(
                    patient=patient,
                    is_deleted=False
                ).order_by('date', 'start_time').first()

                if first_appt and first_appt.clinic:
                    patient.home_branch = first_appt.clinic
                    patient.save(update_fields=['home_branch'])
                    updated_count += 1
                else:
                    # If no appointment, leave NULL
                    skipped_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Done! Updated {updated_count} patients. Skipped {skipped_count} patients (no appointments found)."
        ))
