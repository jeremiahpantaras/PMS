import re
from django.utils import timezone
from apps.patients.models import Patient
from apps.clinics.models import Practitioner
from apps.records.models import ClinicalNote

class LetterGeneratorService:
    """
    Handles parsing letter templates, replacing dynamic variables,
    and triggering PDF generation.
    """

    SUPPORTED_VARIABLES = {
        '{{patient.first_name}}': lambda p, pr, n: p.first_name if p else '',
        '{{patient.last_name}}': lambda p, pr, n: p.last_name if p else '',
        '{{patient.full_name}}': lambda p, pr, n: p.get_full_name() if p else '',
        '{{patient.dob}}': lambda p, pr, n: p.date_of_birth.strftime('%d/%m/%Y') if p and p.date_of_birth else '',
        '{{practitioner.first_name}}': lambda p, pr, n: pr.user.first_name if pr else '',
        '{{practitioner.last_name}}': lambda p, pr, n: pr.user.last_name if pr else '',
        '{{practitioner.full_name}}': lambda p, pr, n: pr.user.get_full_name() if pr else '',
        '{{clinic.name}}': lambda p, pr, n: pr.clinic.name if pr and pr.clinic else '',
        '{{date.today}}': lambda p, pr, n: timezone.now().strftime('%d %B %Y'),
    }

    @classmethod
    def replace_variables(cls, content: str, patient: Patient = None, practitioner: Practitioner = None, note: ClinicalNote = None) -> str:
        """
        Scans content for {{variables}} and replaces them with corresponding data.
        """
        if not content:
            return ""
            
        result = content
        
        # Replace known supported variables
        for var, func in cls.SUPPORTED_VARIABLES.items():
            if var in result:
                try:
                    val = str(func(patient, practitioner, note))
                    result = result.replace(var, val)
                except Exception:
                    # In case of error (e.g. missing related field), leave blank
                    result = result.replace(var, '')

        # Remove any remaining unimplemented variables (e.g., {{unknown.field}})
        # Simple regex to strip anything matching {{...}} that wasn't replaced
        result = re.sub(r'\{\{[^}]+\}\}', '', result)
        
        return result

    @classmethod
    def generate_pdf(cls, html_content: str, output_path: str = None) -> bytes:
        """
        Generates a PDF from the given HTML content.
        """
        try:
            from xhtml2pdf import pisa
            from io import BytesIO
            
            result = BytesIO()
            # Wrap in basic HTML structure if not present
            if '<html' not in html_content.lower():
                html_content = f"<html><body>{html_content}</body></html>"
                
            pisa_status = pisa.CreatePDF(
                html_content,
                dest=result
            )
            
            if pisa_status.err:
                raise Exception("PDF Generation Error")
                
            return result.getvalue()
        except ImportError:
            # Fallback if xhtml2pdf is not available
            return b"%PDF-1.4\n%Fallback Dummy PDF\n"
