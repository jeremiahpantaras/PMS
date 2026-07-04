from apps.clinical_templates.serializers import ClinicalNoteSerializer
from apps.patients.models import Patient
from apps.appointments.models import Appointment
from apps.clinical_templates.models import ClinicalTemplate
from apps.clinics.models import Clinic, Practitioner

clinic = Clinic.objects.first()
practitioner = Practitioner.objects.first()
patient = Patient.objects.first()
template = ClinicalTemplate.objects.first()
appointment = Appointment.objects.first()

print(f"Using template {template.id}")

data = {
    "patient": patient.id,
    "practitioner": practitioner.id,
    "clinic": clinic.id,
    "appointment": appointment.id,
    "template": template.id,
    "date": "2026-07-04",
    "content": {"text_1": "Hello world!"}
}

class DummyUser:
    is_staff = True
    is_admin = True
    clinic = clinic
    
class DummyRequest:
    user = DummyUser()

serializer = ClinicalNoteSerializer(data=data, context={'request': DummyRequest()})
if serializer.is_valid():
    print("Serializer is valid.")
    print("Validated data:", serializer.validated_data)
    instance = serializer.save()
    print("Saved instance encrypted_content:", instance.encrypted_content)
    print("Saved instance content:", instance.content)
else:
    print("Errors:", serializer.errors)
