import re
import os

base_dir = '/Users/jeremiahpantaras/Downloads/PMS/frontend/src'

def fix_file(filepath, replacements):
    with open(filepath, 'r') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(filepath, 'w') as f:
        f.write(content)

# 1. src/types/appointment.ts
fix_file(f'{base_dir}/types/appointment.ts', [
    (
        "  has_invoice:      boolean; // Whether this appointment has an invoice",
        "  has_invoice:      boolean; // Whether this appointment has an invoice\n  confirmation_sent?: boolean;\n  rebook_followup_sent?: boolean;"
    )
])

# 2. src/types/clinicalTemplate.ts
fix_file(f'{base_dir}/types/clinicalTemplate.ts', [
    (
        "  appointment_practitioner?: string | null;",
        "  appointment_practitioner?: string | null;\n  patient_case?: number | null;\n  patient_case_id?: number | null;"
    )
])

# 3. src/features/setup/types/staff.types.ts
fix_file(f'{base_dir}/features/setup/types/staff.types.ts', [
    (
        "  permission_group_name?: string | null;",
        "  permission_group_name?: string | null;\n  manager_branches?: any[];\n  manager_branches_ids?: any[];"
    )
])

# 4. AppointmentView.tsx
fix_file(f'{base_dir}/features/appointments/components/AppointmentView.tsx', [
    (
        "confirmationSent",
        "confirmation_sent"
    ),
    (
        "rebookFollowupSent",
        "rebook_followup_sent"
    ),
    (
        "setLinkedCaseId(appointment.id, String(created.id))",
        "setLinkedCaseId(String(appointment.id), String(created.id))"
    ),
    (
        "selectedCase.createdAt",
        "selectedCase.created_at"
    )
])

# 5. BranchConsentFormModal.tsx
fix_file(f'{base_dir}/features/clinic-setup/components/BranchConsentFormModal.tsx', [
    (
        "const isOwner = user?.roles?.includes('OWNER') || user?.role === 'OWNER';",
        "const isOwner = user?.roles?.includes('OWNER' as UserRole) || user?.role === 'OWNER';"
    ),
    (
        "const isManager = user?.roles?.includes('MANAGER') || user?.role === 'MANAGER';",
        "const isManager = user?.roles?.includes('MANAGER' as UserRole) || user?.role === 'MANAGER';"
    )
])

# 6. PatientCasesNotesPage.tsx
fix_file(f'{base_dir}/features/patients/PatientCasesNotesPage.tsx', [
    (
        "patient_case_id:",
        "patient_case:"
    ),
    (
        "primary_practitioner_name",
        "primaryPractitionerName"
    ),
    (
        "referred_by",
        "referredBy"
    )
])

# 7. PatientCasesPage.tsx
fix_file(f'{base_dir}/features/patients/PatientCasesPage.tsx', [
    ("patient_case_id:", "patient_case:")
])

# 8. PatientClinicalNotesPage.tsx
fix_file(f'{base_dir}/features/patients/PatientClinicalNotesPage.tsx', [
    ("patient_case_id:", "patient_case:")
])

# 9. PatientUnassignedNotesPage.tsx
fix_file(f'{base_dir}/features/patients/PatientUnassignedNotesPage.tsx', [
    ("import React, { useState, useMemo } from 'react';", "import React, { useState, useEffect, useMemo } from 'react';"),
    ("patient_case_id:", "patient_case:")
])

# 10. AgeingDebtsReport.tsx
fix_file(f'{base_dir}/features/reports/pages/financials/AgeingDebtsReport.tsx', [
    (
        "export const AgeingDebtsReport: React.FC = () => {",
        "export const AgeingDebtsReport: React.FC = () => {\n" +
        "const STATUS_COLORS: Record<string, string> = {\n" +
        "  DRAFT: 'bg-gray-100 text-gray-800',\n" +
        "  PENDING: 'bg-yellow-100 text-yellow-800',\n" +
        "  PARTIALLY_PAID: 'bg-blue-100 text-blue-800',\n" +
        "  PAID: 'bg-green-100 text-green-800',\n" +
        "  OVERDUE: 'bg-red-100 text-red-800',\n" +
        "  CANCELLED: 'bg-gray-100 text-gray-800',\n" +
        "};"
    ),
    (
        "// entry.patient_name.toLowerCase().includes(searchLower) ||",
        "entry.patient_name.toLowerCase().includes(searchLower) ||"
    ),
    (
        "// entry.invoice_number.toLowerCase().includes(searchLower)",
        "entry.invoice_number.toLowerCase().includes(searchLower)"
    ),
    (
        "  const statusTotals = {",
        "  const currentOutstanding = filteredData.reduce((sum, entry) => sum + (entry.total_amount - entry.paid_amount), 0);\n  const statusTotals = {"
    ),
    (
        "AgeingDebtItem | null",
        "any | null"
    )
])

# 11. CreateStaffAccountModal.tsx
fix_file(f'{base_dir}/features/setup/components/modals/CreateStaffAccountModal.tsx', [
    ("member.manager_branches_ids", "member.manager_branches")
])

# 12. AddAgeingDebtModal.tsx
fix_file(f'{base_dir}/features/reports/pages/financials/components/AddAgeingDebtModal.tsx', [
    ("const AddAgeingDebtModal: React.FC<AddAgeingDebtModalProps> = ({", "const [patientSearch, setPatientSearch] = useState('');\nconst AddAgeingDebtModal: React.FC<AddAgeingDebtModalProps> = ({")
])

print("Finished fixing files again")
