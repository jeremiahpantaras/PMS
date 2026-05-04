from django.apps import AppConfig


class AppointmentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.appointments'

    def ready(self):
        # Register the post_save signal that broadcasts occupancy updates.
        from django.db.models.signals import post_save
        from .models import Appointment
        from .signals import broadcast_occupancy_on_status_change

        post_save.connect(broadcast_occupancy_on_status_change, sender=Appointment)
