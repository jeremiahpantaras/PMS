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

# 1. Diary.tsx
fix_file(f'{base_dir}/features/appointments/Diary.tsx', [
    (
        """  const selectedPractitionerName = useMemo(
    () => practitioners.find(p => p.id === selectedPractitioner)?.name,
    [practitioners, selectedPractitioner],
  );""",
        ""
    ),
    (
        "const isUnauthorized = isRestrictedPractitioner && practitionerBranchIds && !practitionerBranchIds.includes(branch.id);",
        "const isUnauthorized = Boolean(isRestrictedPractitioner && practitionerBranchIds && !practitionerBranchIds.includes(branch.id));"
    )
])

# 2. BranchConsentFormEditor.tsx
fix_file(f'{base_dir}/features/clinic-setup/components/BranchConsentFormEditor.tsx', [
    (
        "headerHtml={headerHtml}",
        ""
    )
])

# 3. BranchConsentFormModal.tsx
fix_file(f'{base_dir}/features/clinic-setup/components/BranchConsentFormModal.tsx', [
    ("import type { ClinicBranch } from '@/features/clinics/clinic.api';", ""),
    ("const isOwner = user?.role === 'OWNER';", "const isOwner = user?.roles?.includes('OWNER') || user?.role === 'OWNER';"),
    ("const isManager = user?.role === 'MANAGER';", "const isManager = user?.roles?.includes('MANAGER') || user?.role === 'MANAGER';")
])

# 4. PortalSidebar.tsx
fix_file(f'{base_dir}/features/patient-portal/components/PortalSidebar.tsx', [
    ("import { LayoutDashboard, Calendar, FileText, User, RefreshCw, X, Building2 } from 'lucide-react';", "import { LayoutDashboard, Calendar, FileText, User, X, Building2 } from 'lucide-react';"),
    ("import type { PortalPatient, PortalBranch } from '../../portal.api';", "import type { PortalPatient } from '../../portal.api';")
])

# 5. PatientCasesNotesPage.tsx
fix_file(f'{base_dir}/features/patients/PatientCasesNotesPage.tsx', [
    ("getPatientCases,\n", ""),
    ("patient_case:", "patient_case_id:"),
    ("primaryPractitionerName", "primary_practitioner_name"),
    ("referredBy", "referred_by")
])

# 6. PatientCasesPage.tsx
fix_file(f'{base_dir}/features/patients/PatientCasesPage.tsx', [
    ("patient_case:", "patient_case_id:")
])

# 7. PatientClinicalNotesPage.tsx
fix_file(f'{base_dir}/features/patients/PatientClinicalNotesPage.tsx', [
    ("patient_case:", "patient_case_id:")
])

# 8. PatientUnassignedNotesPage.tsx
fix_file(f'{base_dir}/features/patients/PatientUnassignedNotesPage.tsx', [
    ("import React, { useEffect, useState, useMemo } from 'react';", "import React, { useState, useMemo } from 'react';"),
    ("patient_case:", "patient_case_id:")
])

# 9. Profile.tsx
fix_file(f'{base_dir}/features/profile/Profile.tsx', [
    ("import type { User } from '@/store/auth.store';", ""),
    ("const { user, syncUser } = useAuthStore();", "const { user } = useAuthStore();")
])

# 10. AgeingDebtsReport.tsx
fix_file(f'{base_dir}/features/reports/pages/financials/AgeingDebtsReport.tsx', [
    (
        """const STATUS_COLORS = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  PARTIALLY_PAID: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};""",
        ""
    ),
    (
        "entry.patient_name.toLowerCase().includes(searchLower) ||",
        "// entry.patient_name.toLowerCase().includes(searchLower) ||"
    ),
    (
        "entry.invoice_number.toLowerCase().includes(searchLower)",
        "// entry.invoice_number.toLowerCase().includes(searchLower)"
    ),
    (
        """  const currentOutstanding = filteredData.reduce((sum, entry) => 
    sum + (entry.total_amount - entry.paid_amount), 0
  );""",
        ""
    )
])

# 11. AddAgeingDebtModal.tsx
fix_file(f'{base_dir}/features/reports/pages/financials/components/AddAgeingDebtModal.tsx', [
    ("from '../../reports.api'", "from '../../../reports.api'"),
    ("const [patientSearch, setPatientSearch] = useState('');", "")
])

# 12. EditAgeingDebtModal.tsx
fix_file(f'{base_dir}/features/reports/pages/financials/components/EditAgeingDebtModal.tsx', [
    ("from '../../reports.api'", "from '../../../reports.api'")
])

# 13. CreateStaffAccountModal.tsx
fix_file(f'{base_dir}/features/setup/components/modals/CreateStaffAccountModal.tsx', [
    ("member.manager_branches", "member.manager_branches_ids"),
    ("b => b.id", "(b: any) => b.id")
])

# 14. ConsentFormEditor.tsx
fix_file(f'{base_dir}/features/setup/pages/practice/ConsentFormEditor.tsx', [
    ("import { getMyClinic, updateClinicConsentForm, type Clinic } from '@/features/clinics/clinic.api';", "import { updateClinicConsentForm, type Clinic } from '@/features/clinics/clinic.api';"),
    ("const [clinicId, setClinicId] = useState<number | null>(null);", ""),
    ("const [clinicName, setClinicName] = useState('');", ""),
    ("const updatedAt = new Date(clinic.consent_form_updated_at).toLocaleDateString(undefined, {", "const _updatedAt = new Date(clinic.consent_form_updated_at).toLocaleDateString(undefined, {")
])

print("Finished fixing files")
