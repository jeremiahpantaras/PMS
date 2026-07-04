import os
import django
import sys
import json
from rest_framework.test import APIRequestFactory, force_authenticate

# Set up Django environment
sys.path.append('/Users/jeremiahpantaras/Downloads/PMS/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.clinical_templates.views import ClinicalNoteViewSet
from apps.users.models import CustomUser

def run_test():
    user = CustomUser.objects.filter(is_superuser=True).first()
    if not user:
        user = CustomUser.objects.first()
        
    print(f"Testing with user: {user.email}")
    
    payload = {
        "patient": 6,
        "template": 1,
        "date": "2026-07-10",
        "appointment": 26,
        "content": {
            "test_field": "hello world"
        }
    }
    
    factory = APIRequestFactory()
    request = factory.post('/api/clinical-templates/notes/', data=json.dumps(payload), content_type='application/json')
    force_authenticate(request, user=user)
    
    view = ClinicalNoteViewSet.as_view({'post': 'create'})
    
    print("--- SENDING REQUEST ---")
    response = view(request)
    print("--- RESPONSE ---")
    print(response.status_code)
    print(response.data)

if __name__ == '__main__':
    run_test()
