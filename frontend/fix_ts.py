import re
import os

def fix_file(filepath, replacements):
    with open(filepath, 'r') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(filepath, 'w') as f:
        f.write(content)

base_dir = '/Users/jeremiahpantaras/Downloads/PMS/frontend/src'

fix_file(f'{base_dir}/features/appointments/components/AppointmentView.tsx', [
    ("setEditPayer(e.target.value)", "setEditPayer(e.target.value as PatientCasePayer)"),
    ("ApiPatientCase", "PatientCase"),
    ("setLinkedCaseId(appointment.id, created.id)", "setLinkedCaseId(appointment.id, String(created.id))"),
    ("selectedCase.createdAt", "selectedCase.created_at"),
    ("confirmation_sent", "confirmationSent"),
    ("rebook_followup_sent", "rebookFollowupSent")
])

fix_file(f'{base_dir}/features/appointments/components/RebookCalendar.tsx', [
    ("import { CalendarDays, Clock, Coffee, AlertCircle } from 'lucide-react';", "import { CalendarDays, Clock, AlertCircle } from 'lucide-react';"),
    ("const DAY_MAP: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };\n", "")
])

