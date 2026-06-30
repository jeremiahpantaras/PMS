import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User, PermissionGroup
from apps.clinics.models import Clinic, Practitioner
from apps.patients.models import Patient, PortalBooking
from apps.appointments.models import Appointment

from apps.notifications.models import Notification
from datetime import date, time

def run_test():
    # 1. Setup a test clinic
    clinic = Clinic.objects.first()
    if not clinic:
        clinic = Clinic.objects.create(name='Test Clinic')
        
    practitioner = Practitioner.objects.first()
    
    # Clear existing notifications for test
    Notification.objects.all().delete()
    
    # 2. Test New Patient
    print("Creating Patient...")
    patient = Patient.objects.create(
        clinic=clinic,
        first_name='Test',
        last_name='Patient',
        email='testpatient@example.com',
        date_of_birth=date(1990, 1, 1)
    )
    
    if Notification.objects.filter(notification_type='NEW_CLIENT', patient=patient).exists():
        print("✅ NEW_CLIENT notification created successfully.")
    else:
        print("❌ Failed to create NEW_CLIENT notification.")
        
    # 3. Test New Appointment
    print("Creating Appointment...")
    appointment = Appointment.objects.create(
        clinic=clinic,
        patient=patient,
        practitioner=practitioner,
        date=date.today(),
        start_time=time(9, 0),
        end_time=time(10, 0),
        status='SCHEDULED'
    )
    
    if Notification.objects.filter(notification_type='NEW_BOOKING', appointment=appointment).exists():
        print("✅ NEW_BOOKING notification created successfully.")
    else:
        print("❌ Failed to create NEW_BOOKING notification.")
        
    # 4. Test Portal Booking
    print("Creating Portal Booking...")
    from apps.patients.models import PortalLink
    portal_link = PortalLink.objects.first()
    if not portal_link:
        portal_link = PortalLink.objects.create(clinic=clinic, name='Main Link')
        
    portal_booking = PortalBooking.objects.create(
        portal_link=portal_link,
        patient_first_name='Portal',
        patient_last_name='User',
        patient_email='portal@example.com',
        appointment_date=date.today(),
        appointment_time=time(14, 0),
        practitioner=practitioner
    )
    
    if Notification.objects.filter(notification_type='ONLINE_BOOKING').exists():
        print("✅ ONLINE_BOOKING notification created successfully.")
    else:
        print("❌ Failed to create ONLINE_BOOKING notification.")

if __name__ == '__main__':
    run_test()
