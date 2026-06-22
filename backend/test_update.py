import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from apps.accounts.models import User
from apps.clinics.models import Clinic, Practitioner
from django.db import transaction

with transaction.atomic():
    clinic = Clinic.objects.first()
    
    # 1. Create a user with PRACTITIONER role
    user = User.objects.create(email="test_prac1@example.com", first_name="Test", last_name="Prac", role="PRACTITIONER", roles=["PRACTITIONER"], clinic=clinic)
    user.set_password("password")
    user.save()
    
    prac = Practitioner.objects.create(user=user, clinic=clinic, duty_days=["Mon", "Tue"], duty_start_time="08:00", duty_end_time="17:00")
    
    old_effective_roles = user.get_effective_roles()
    
    # 2. Update user to remove PRACTITIONER role
    user.roles = ["STAFF"]
    user.save()
    
    user.refresh_from_db()
    new_roles = user.get_effective_roles()
    
    had_practitioner = 'PRACTITIONER' in old_effective_roles
    has_practitioner = 'PRACTITIONER' in new_roles
    
    print(f"old_effective_roles: {old_effective_roles}")
    print(f"new_roles: {new_roles}")
    print(f"had_practitioner: {had_practitioner}")
    print(f"has_practitioner: {has_practitioner}")
    
    if not has_practitioner and had_practitioner:
        print("CONDITION MET! execute_practitioner_removal should be called.")
        from apps.accounts.services.practitioner_deactivation import execute_practitioner_removal
        res = execute_practitioner_removal(user.id, user)
        print(f"Result: {res}")
    else:
        print("CONDITION NOT MET!")
