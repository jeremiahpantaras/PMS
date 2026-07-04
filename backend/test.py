import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.clinical_templates.models import ClinicalNote

notes = ClinicalNote.objects.order_by('-created_at')[:3]
for n in notes:
    print(f"ID: {n.id}")
    print(f"Encrypted Content: {n.encrypted_content}")
    print(f"Decrypted Content: {n.content}")
    print("---")
