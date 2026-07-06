import React, { useState, useEffect, useRef } from 'react';
import { X, UserPlus, AlertCircle, Building2, RefreshCw, Clock, Plus, Trash2, Check, ShieldCheck, Stethoscope, Users, DollarSign, Crown, Eye, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import type { CreateStaffData, StaffFormErrors, StaffMember, PractitionerRoleImpact } from '../../types/staff.types';
import type { DutySchedule, DutyDay } from '@/features/clinics/clinic.api';
import { TITLE_OPTIONS, GENDER_OPTIONS } from '../../types/staff.types';
import { useDisciplineOptions } from '../../hooks/useDisciplineOptions';
import { useClinicBranches } from '@/features/clinics/hooks/useClinicBranches';
import { formatPHPhone, normalizePHPhone } from '@/utils/phoneFormatter';
import { validateEmailDetailed, validatePHPhoneDetailed } from '@/utils/validation';
import { usePermissions } from '@/hooks/usePermissions';
import { PractitionerRemovalModal } from './PractitionerRemovalModal';
import { getPractitionerRoleImpact } from '../../services/StaffService';
import { emitPractitionerRemoved } from '@/events/practitionerEvents';
import { useAuthStore } from '@/store/auth.store';

// ── Clinical Role Cards ──────────────────────────────────────────────────────

type ClinicalRoleValue = 'ADMIN' | 'ADMIN_ASSISTANT' | 'PRACTITIONER' | 'STAFF' | 'FINANCE' | 'READ_ONLY';

const ALL_CLINICAL_ROLES: {
  value: ClinicalRoleValue;
  label: string;
  description: string;
  icon: React.ElementType;
  ring: string;
  bg: string;
  /** If true, only admins (isOwner) can see + select this card */
  ownerOnly?: boolean;
  /** If true, only Owners can see this card (Managers cannot create Managers) */
  managerOnly?: boolean;
  /** Warning shown beneath role card when selected */
  warning?: string;
}[] = [
  {
    value: 'ADMIN',
    label: 'Administrator',
    description: 'Full system access',
    icon: Crown,
    ring: 'ring-amber-400',
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    ownerOnly: true,
    warning: 'This user will have full system access. At least one Administrator must always exist.',
  },
  {
    value: 'ADMIN_ASSISTANT',
    label: 'Manager',
    description: 'Branch management & admin',
    icon: ShieldCheck,
    ring: 'ring-violet-400',
    bg: 'bg-violet-50 text-violet-700 border-violet-200',
    /** Only Owner can create another Manager. Managers cannot create Managers. */
    managerOnly: true,
  },
  {
    value: 'PRACTITIONER',
    label: 'Practitioner',
    description: 'Clinical & patient care',
    icon: Stethoscope,
    ring: 'ring-purple-400',
    bg: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    value: 'STAFF',
    label: 'Staff',
    description: 'Front desk & operations',
    icon: Users,
    ring: 'ring-sky-400',
    bg: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    value: 'FINANCE',
    label: 'Finance',
    description: 'Billing, invoicing & reports',
    icon: DollarSign,
    ring: 'ring-green-400',
    bg: 'bg-green-50 text-green-700 border-green-200',
  },
  {
    value: 'READ_ONLY',
    label: 'Read-Only',
    description: 'View-only access',
    icon: Eye,
    ring: 'ring-gray-400',
    bg: 'bg-gray-100 text-gray-600 border-gray-300',
  },
];

const CLINICAL_ROLE_VALUES: ClinicalRoleValue[] = ALL_CLINICAL_ROLES.map(r => r.value);

const DUTY_DAY_OPTIONS: { value: DutyDay; label: string }[] = [
  { value: 'Mon', label: 'Mon' },
  { value: 'Tue', label: 'Tue' },
  { value: 'Wed', label: 'Wed' },
  { value: 'Thu', label: 'Thu' },
  { value: 'Fri', label: 'Fri' },
  { value: 'Sat', label: 'Sat' },
  { value: 'Sun', label: 'Sun' },
];

const DEFAULT_DUTY_DAYS: DutyDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/** Returns true if any two blocks in the list overlap in time. */
const hasScheduleConflict = (blocks: { start: string; end: string }[]): boolean => {
  if (blocks.length < 2) return false;
  const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].end > sorted[i + 1].start) return true;
  }
  return false;
};

const makeDefaultSchedule = (days: DutyDay[]): DutySchedule =>
  Object.fromEntries(days.map(d => [d, [{ start: '08:00', end: '17:00' }]])) as DutySchedule;

/** Build a duty_schedule from editing staff data, falling back to legacy fields. */
const buildDutySchedule = (staff: StaffMember): DutySchedule => {
  if (staff.duty_schedule) return staff.duty_schedule;
  if (staff.availability?.duty_schedule) return staff.availability.duty_schedule as DutySchedule;
  const days: DutyDay[] = (
    staff.duty_days ?? staff.availability?.duty_days ?? DEFAULT_DUTY_DAYS
  ) as DutyDay[];
  const start = staff.availability?.duty_start_time ?? '08:00';
  const end   = staff.availability?.duty_end_time   ?? '17:00';
  return Object.fromEntries(days.map(d => [d, [{ start, end }]])) as DutySchedule;
};

interface CreateStaffAccountModalProps {
  isOpen:          boolean;
  onClose:         () => void;
  onSubmit:        (data: CreateStaffData) => Promise<void>;
  editingStaff?:   StaffMember | null;
  /** ID of the currently logged-in user. Used to show the "Me" badge. */
  currentUserId?:  number;
}

const EMPTY_FORM: CreateStaffData = {
  first_name:    '',
  last_name:     '',
  middle_name:   '',
  nickname:      '',
  title:         'Mr',
  position:      '',
  discipline:    'OCCUPATIONAL_THERAPY',
  email:         '',
  phone:         '',
  address:       '',
  date_of_birth: '',
  gender:        'Male',
  roles:         ['STAFF'],
  clinic_branch: null,
  branch_ids:    [],
  // Availability defaults
  duty_days:        DEFAULT_DUTY_DAYS,
  lunch_start_time: '12:00',
  lunch_end_time:   '13:00',
  duty_schedule:    makeDefaultSchedule(DEFAULT_DUTY_DAYS),
};

/* ── Reusable field helpers ─────────────────────────────── */
const inputCls = (hasError?: boolean) =>
  `w-full border ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}
   rounded-lg px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2
   focus:ring-sky-400 focus:border-transparent transition`;

const selectCls =
  'w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition';

const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <label className="block text-xs font-semibold text-gray-600 mb-1">
    {children} {required && <span className="text-red-400">*</span>}
  </label>
);

const FieldError: React.FC<{ msg?: string }> = ({ msg }) =>
  msg ? <p className="mt-0.5 text-[11px] text-red-500">{msg}</p> : null;

const SectionTitle: React.FC<{ color?: string; children: React.ReactNode }> = ({
  color = 'text-sky-600', children,
}) => (
  <p className={`text-[11px] font-bold ${color} uppercase tracking-widest mb-3`}>
    {children}
  </p>
);

export const CreateStaffAccountModal: React.FC<CreateStaffAccountModalProps> = ({
  isOpen, onClose, onSubmit, editingStaff = null, currentUserId,
}) => {
  const isEditMode = !!editingStaff;
  const { isOwner, isManager, managerBranches } = usePermissions();
  const currentUser = useAuthStore(s => s.user);

  // Multi-role helpers
  const isMe = !!(editingStaff && currentUserId && editingStaff.id === currentUserId);
  // Original roles array of the staff being edited (for submit payload preservation)
  const originalRolesRef = useRef<string[]>([]);

  // Phase 6/7: Filter role cards based on the actor's authority.
  // Owner: sees all cards (including ADMIN and ADMIN_ASSISTANT/Manager).
  // Manager: can see operational roles only — cannot create Owner or another Manager.
  // Others: only see operational roles.
  const visibleClinicalRoles = ALL_CLINICAL_ROLES.filter(r => {
    if (r.ownerOnly && !isOwner)   return false;  // ADMIN card: Owner only
    if (r.managerOnly && !isOwner) return false;  // Manager card: Owner only (Managers cannot create Managers)
    return true;
  });

  const [formData, setFormData] = useState<CreateStaffData>(EMPTY_FORM);
  const [errors, setErrors]     = useState<StaffFormErrors>({});
  const [loading, setLoading]   = useState(false);

  // ── Practitioner removal confirmation state ────────────────────────────────
  // When the admin removes the PRACTITIONER role we intercept the submit,
  // fetch the impact counts, and surface a confirmation modal.  The pending
  // payload is stored here so we can re-fire it once confirmed.
  const [showRemovalModal, setShowRemovalModal]   = useState(false);
  const [removalImpact, setRemovalImpact]         = useState<PractitionerRoleImpact | null>(null);
  const [removalLoading, setRemovalLoading]       = useState(false);
  const pendingPayloadRef = useRef<(CreateStaffData & { confirm_practitioner_removal?: boolean }) | null>(null);

  // ── Discipline create-inline state ─────────────────────────────────────────
  const [showCreateDiscipline, setShowCreateDiscipline] = useState(false);
  const [newDisciplineLabel, setNewDisciplineLabel]     = useState('');
  const newDisciplineInputRef = useRef<HTMLInputElement>(null);
  const { allOptions: disciplineOptions, addDiscipline } = useDisciplineOptions();

  const handleAddDiscipline = () => {
    const created = addDiscipline(newDisciplineLabel);
    if (!created) {
      toast.error('Please enter a discipline name.');
      return;
    }
    set('discipline', created.value);
    setNewDisciplineLabel('');
    setShowCreateDiscipline(false);
  };

  const { branches, loading: loadingBranches } = useClinicBranches();

  // Phase 8: Auto-assign branch for Branch Managers.
  // When the actor is a Branch Manager, pre-populate clinic_branch
  // so the user inherits the manager's assigned branch automatically.
  useEffect(() => {
    if (!isEditMode && isManager && !isOwner) {
      if (currentUser?.clinic_branch) {
        setFormData(prev => ({
          ...prev,
          clinic_branch: currentUser.clinic_branch,
          branch_ids: [currentUser.clinic_branch as number],
        }));
      } else if (managerBranches.length > 0) {
        setFormData(prev => ({
          ...prev,
          clinic_branch: managerBranches[0].id,
          branch_ids: [managerBranches[0].id],
        }));
      }
    }
  }, [isEditMode, isManager, isOwner, currentUser?.clinic_branch, managerBranches]);

  useEffect(() => {
    if (editingStaff) {
      // Compute effective roles (multi-role aware)
      const effectiveRoles: string[] =
        editingStaff.roles && editingStaff.roles.length > 0
          ? editingStaff.roles
          : [editingStaff.role];
      // Cache original roles for submit preservation
      originalRolesRef.current = effectiveRoles;

      // Extract only the clinical roles (those selectable in the multi-role cards).
      const clinicalRoles = effectiveRoles.filter(r =>
        CLINICAL_ROLE_VALUES.includes(r as ClinicalRoleValue)
      ) as ClinicalRoleValue[];
      const displayRoles: ClinicalRoleValue[] = clinicalRoles.length > 0 ? clinicalRoles : ['STAFF'];

      setFormData({
        first_name:    editingStaff.first_name,
        last_name:     editingStaff.last_name,
        middle_name:   editingStaff.middle_name   ?? '',
        nickname:      editingStaff.nickname       ?? '',
        title:         editingStaff.title          ?? 'Mr',
        position:      editingStaff.position       ?? '',
        discipline:    editingStaff.discipline || 'OCCUPATIONAL_THERAPY',
        email:         editingStaff.email,
        phone:         editingStaff.phone ? formatPHPhone(editingStaff.phone) : '',
        address:       editingStaff.address        ?? '',
        date_of_birth: editingStaff.date_of_birth  ?? '',
        gender:        editingStaff.gender         ?? 'Male',
        roles:         displayRoles,
        clinic_branch: editingStaff.clinic_branch  ?? null,
        branch_ids:    editingStaff.manager_branches ? editingStaff.manager_branches.map((b: any) => b.id) : [],
        // Availability
        duty_days:        (editingStaff.duty_days ?? editingStaff.availability?.duty_days ?? DEFAULT_DUTY_DAYS) as DutyDay[],
        lunch_start_time: editingStaff.lunch_start_time ?? editingStaff.availability?.lunch_start_time ?? '12:00',
        lunch_end_time:   editingStaff.lunch_end_time   ?? editingStaff.availability?.lunch_end_time   ?? '13:00',
        duty_schedule:    buildDutySchedule(editingStaff),
      });
    } else {
      originalRolesRef.current = [];
      setFormData(EMPTY_FORM);
    }
    setErrors({});
  }, [editingStaff, isOpen]);

  const validateForm = (): boolean => {
    const e: StaffFormErrors = {};
    if (!formData.first_name.trim()) e.first_name = 'First name is required';
    if (!formData.last_name.trim())  e.last_name  = 'Last name is required';
    if (!formData.roles || formData.roles.length === 0) e.general = 'Select at least one clinical role';

    const emailErr = validateEmailDetailed(formData.email);
    if (emailErr) e.email = emailErr;

    const phoneErr = validatePHPhoneDetailed(formData.phone);
    if (phoneErr) e.phone = phoneErr;

    if (formData.date_of_birth && new Date(formData.date_of_birth) > new Date())
      e.date_of_birth = 'Date of birth cannot be in the future';

    // Branch is required for all roles — every user must be scoped to a branch.
    // For Branch Managers, we auto-inject their branch, bypassing UI-level requirement checks here.
    if (!isManager || isOwner) {
      const isManagerRole = (formData.roles ?? []).includes('ADMIN_ASSISTANT');
      if (isManagerRole) {
        if (!formData.branch_ids || formData.branch_ids.length === 0) {
          e.clinic_branch = 'A Manager must be assigned to at least one branch.';
        }
      } else {
        if (!formData.clinic_branch) e.clinic_branch = 'Branch assignment is required.';
      }
    }

    // Availability validation (for PRACTITIONER role only)
    const needsSchedule = (formData.roles ?? []).includes('PRACTITIONER');
    if (needsSchedule) {
      if (!formData.duty_days || formData.duty_days.length === 0)
        e.duty_days = 'At least one duty day is required';
      // Validate per-day blocks
      if (formData.duty_schedule) {
        for (const day of (formData.duty_days ?? [])) {
          const blocks = formData.duty_schedule[day] ?? [];
          for (const block of blocks) {
            if (!block.start || !block.end) {
              e.duty_schedule = `${day}: every block must have a start and end time`;
              break;
            }
            if (block.start >= block.end) {
              e.duty_schedule = `${day}: shift end must be after shift start (${block.start}–${block.end})`;
              break;
            }
          }
          if (e.duty_schedule) break;
          if (!e.duty_schedule && hasScheduleConflict(blocks)) {
            e.duty_schedule = `${day}: shift blocks overlap. Please adjust the time ranges.`;
            break;
          }
        }
      }
      if (!formData.lunch_start_time) e.lunch_start_time = 'Required';
      if (!formData.lunch_end_time)   e.lunch_end_time   = 'Required';
    }

    setErrors(e);
    if (Object.keys(e).length > 0) {
      console.error('[CreateStaffAccountModal] Validation Failed! Errors:', e);
      console.log('[CreateStaffAccountModal] Current formData:', formData);
    }
    return Object.keys(e).length === 0;
  };

  // ── Core submit helper (shared by direct submit & confirmed removal) ────────
  const executeSubmit = async (
    payload: CreateStaffData & { confirm_practitioner_removal?: boolean }
  ) => {
    try {
      await onSubmit(payload as CreateStaffData);
      handleClose();
    } catch (err: any) {
      const data = err?.response?.data as Record<string, string | string[]> | undefined;
      console.log('[DEBUG-MODAL] 400 Error Data:', data);
      if (data) {
        const mapped: StaffFormErrors = {};
        const pick = (v: string | string[]) => (Array.isArray(v) ? v[0] : v);
        if (data.email)  mapped.email  = pick(data.email);
        if (data.phone)  mapped.phone  = pick(data.phone);
        if (data.branch_ids) mapped.general = pick(data.branch_ids);
        if (data.detail) mapped.general = pick(data.detail);
        if (Object.keys(mapped).length > 0) {
          setErrors(mapped);
          if (mapped.email)        toast.error(mapped.email,   { id: 'staff-email-error' });
          else if (mapped.phone)   toast.error(mapped.phone,   { id: 'staff-phone-error' });
          else if (mapped.general) toast.error(mapped.general);
        } else {
          const msg = err.message || 'Failed to save. Please try again.';
          setErrors({ general: msg });
          toast.error(msg);
        }
      } else {
        const msg = err.message || 'Failed to save. Please try again.';
        setErrors({ general: msg });
        toast.error(msg);
      }
      throw err; // re-throw so callers can reset loading state
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('[CreateStaffAccountModal] Logging before submit:', {
      role: isOwner ? 'Owner' : isManager ? 'Branch Manager' : 'Staff',
      userBranch: currentUser?.clinic_branch,
      payload: formData
    });

    if (!validateForm()) {
      toast.error('Please fix the highlighted errors before submitting.', { id: 'staff-validation' });
      return;
    }

    // Rebuild the full roles array: preserve non-clinical roles that aren't
    // selectable in the card UI (none currently), then add all selected
    // clinical roles. ADMIN is now a selectable card so it flows through
    // the standard clinical-roles path.
    const preservedRoles = originalRolesRef.current.filter(
      r => !CLINICAL_ROLE_VALUES.includes(r as ClinicalRoleValue)
    );
    const finalRoles = [...preservedRoles, ...(formData.roles ?? ['STAFF'])];

    const payload: CreateStaffData & { confirm_practitioner_removal?: boolean } = {
      ...formData,
      phone: normalizePHPhone(formData.phone),
      roles: finalRoles as CreateStaffData['roles'],
    };

    // ── Detect PRACTITIONER role removal ─────────────────────────────────────
    // If we are in edit mode and PRACTITIONER was in the original roles but
    // is NOT in the new roles, we must confirm before submitting because the
    // backend will delete future scheduling data.
    const hadPractitioner  = originalRolesRef.current.includes('PRACTITIONER');
    const hasPractitioner  = finalRoles.includes('PRACTITIONER');
    const removingPractitioner = isEditMode && hadPractitioner && !hasPractitioner;

    if (removingPractitioner && editingStaff) {
      setLoading(true);
      try {
        const impact = await getPractitionerRoleImpact(editingStaff.id);
        if (impact.has_impact) {
          // Store payload for the confirmed re-submit and surface the modal
          pendingPayloadRef.current = payload;
          setRemovalImpact(impact);
          setShowRemovalModal(true);
          return; // don't submit yet — wait for confirmation
        }
        // No future data to clean up — proceed immediately (no modal needed)
        await executeSubmit(payload);
      } catch (err: any) {
        // If the impact check itself fails, fall through to a normal submit
        // attempt so the user isn't silently blocked.
        console.warn('[CreateStaffAccountModal] impact check failed, proceeding:', err);
        await executeSubmit(payload);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Normal (non-practitioner-removal) submit path
    setLoading(true);
    setErrors({});
    try {
      await executeSubmit(payload);
    } finally {
      setLoading(false);
    }
  };

  // Called when the admin confirms in the PractitionerRemovalModal
  const handleRemovalConfirm = async () => {
    const payload = pendingPayloadRef.current;
    if (!payload) return;
    setRemovalLoading(true);
    try {
      await executeSubmit({ ...payload, confirm_practitioner_removal: true });
      setShowRemovalModal(false);
      pendingPayloadRef.current = null;

      // Notify Calendar / Diary to immediately refetch all scheduling data.
      // This clears appointments, block-outs and notes for the former
      // practitioner from the live calendar view without a page reload.
      const userId = editingStaff?.id ?? null;
      const practitionerId = removalImpact?.practitioner_id ?? null;
      if (userId !== null) {
        emitPractitionerRemoved(userId, practitionerId);
      }
    } finally {
      setRemovalLoading(false);
    }
  };

  const handleRemovalCancel = () => {
    setShowRemovalModal(false);
    pendingPayloadRef.current = null;
    setRemovalImpact(null);
  };

  const handleClose = () => {
    setFormData(EMPTY_FORM);
    setErrors({});
    onClose();
  };

  const set = <K extends keyof CreateStaffData>(field: K, value: CreateStaffData[K]) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  // ── Split-shift schedule handlers ──────────────────────────────────────────
  const toggleDutyDay = (day: DutyDay) => {
    const currentDays = formData.duty_days ?? [];
    const isActive = currentDays.includes(day);
    if (isActive) {
      const newDays = currentDays.filter(d => d !== day);
      const newSchedule = { ...(formData.duty_schedule ?? {}) } as DutySchedule;
      delete newSchedule[day];
      setFormData(prev => ({
        ...prev,
        duty_days: newDays,
        duty_schedule: Object.keys(newSchedule).length > 0 ? newSchedule : null,
      }));
    } else {
      const newDays = [...currentDays, day];
      const existing = formData.duty_schedule ?? {};
      const newSchedule: DutySchedule = {
        ...existing,
        [day]: (existing[day] ?? [{ start: '08:00', end: '17:00' }]),
      };
      setFormData(prev => ({ ...prev, duty_days: newDays, duty_schedule: newSchedule }));
    }
  };

  const addBlock = (day: DutyDay) => {
    const existing = formData.duty_schedule ?? {};
    const blocks = existing[day] ?? [{ start: '08:00', end: '17:00' }];
    const [h, m] = (blocks[blocks.length - 1]?.end ?? '08:00').split(':').map(Number);
    const newH = Math.min(h + 1, 23);
    const newBlock = {
      start: `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      end:   `${String(Math.min(newH + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    };
    setFormData(prev => ({
      ...prev,
      duty_schedule: { ...existing, [day]: [...blocks, newBlock] },
    }));
  };

  const removeBlock = (day: DutyDay, idx: number) => {
    const existing = formData.duty_schedule ?? {};
    const blocks = (existing[day] ?? []).filter((_: { start: string; end: string }, i: number) => i !== idx);
    const newSchedule = { ...existing, [day]: blocks } as DutySchedule;
    setFormData(prev => ({ ...prev, duty_schedule: newSchedule }));
  };

  const updateBlock = (day: DutyDay, idx: number, field: 'start' | 'end', value: string) => {
    const existing = formData.duty_schedule ?? {};
    const blocks = [...(existing[day] ?? [])];
    blocks[idx] = { ...blocks[idx], [field]: value };
    setFormData(prev => ({ ...prev, duty_schedule: { ...existing, [day]: blocks } }));
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Top accent bar ── */}
          <div className="h-1.5 w-full bg-sky-500 rounded-t-2xl" />

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center shadow-sm">
                <UserPlus className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-gray-900">
                    {isEditMode ? 'Edit Staff Account' : 'New Staff Member'}
                  </h2>
                  {isMe && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 leading-none">
                      Me
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {isEditMode
                    ? `Editing ${editingStaff?.first_name} ${editingStaff?.last_name}`
                    : 'Add a new staff member to your practice'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Scrollable body ── */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="px-6 py-5 space-y-6">

              {/* General error */}
              {errors.general && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {errors.general}
                </div>
              )}

              {/* Info notice — create mode only */}
              {!isEditMode && (
                <div className="flex items-start gap-2 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    A temporary password will be auto-generated and sent to the staff member's
                    email. They must change it on first login.
                  </span>
                </div>
              )}

              {/* ════════════════════════════════════════
                  SECTION 1 — Personal Information
              ════════════════════════════════════════ */}
              <div>
                <SectionTitle color="text-sky-600">Personal Information</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">

                  {/* Title */}
                  <div>
                    <Label required>Title</Label>
                    <select
                      value={formData.title}
                      onChange={e => set('title', e.target.value as any)}
                      className={selectCls}
                    >
                      {TITLE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Gender */}
                  <div>
                    <Label>Gender</Label>
                    <select
                      value={formData.gender}
                      onChange={e => set('gender', e.target.value as any)}
                      className={selectCls}
                    >
                      {GENDER_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* First Name */}
                  <div>
                    <Label required>First Name</Label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={e => set('first_name', e.target.value)}
                      placeholder="John"
                      className={inputCls(!!errors.first_name)}
                    />
                    <FieldError msg={errors.first_name} />
                  </div>

                  {/* Last Name */}
                  <div>
                    <Label required>Last Name</Label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={e => set('last_name', e.target.value)}
                      placeholder="Doe"
                      className={inputCls(!!errors.last_name)}
                    />
                    <FieldError msg={errors.last_name} />
                  </div>

                  {/* Middle Name */}
                  <div>
                    <Label>Middle Name</Label>
                    <input
                      type="text"
                      value={formData.middle_name}
                      onChange={e => set('middle_name', e.target.value)}
                      placeholder="Optional"
                      className={inputCls()}
                    />
                  </div>

                  {/* Nickname */}
                  <div>
                    <Label>Nickname</Label>
                    <input
                      type="text"
                      value={formData.nickname}
                      onChange={e => set('nickname', e.target.value)}
                      placeholder="Optional"
                      className={inputCls()}
                    />
                  </div>

                  {/* Date of Birth */}
                  <div>
                    <Label>Date of Birth</Label>
                    <input
                      type="date"
                      value={formData.date_of_birth}
                      onChange={e => set('date_of_birth', e.target.value)}
                      className={inputCls(!!errors.date_of_birth)}
                    />
                    <FieldError msg={errors.date_of_birth} />
                  </div>

                </div>
              </div>

              {/* ════════════════════════════════════════
                  SECTION 2 — Professional Information
              ════════════════════════════════════════ */}
              <div>
                <SectionTitle color="text-slate-500">Professional Information</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">

                  {/* ── Clinical Role (multi-select cards) — FIRST ── */}
                  <div className="md:col-span-2">
                    <Label required>Clinical Role</Label>

                    {/* READ-ONLY notice banner */}
                    {(formData.roles ?? []).includes('READ_ONLY') && !(formData.roles ?? []).some(r => r !== 'READ_ONLY') && (
                      <div className="flex items-center gap-2 mb-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                        <Eye className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span className="text-xs text-gray-600">
                          Read-Only users can view allowed modules but cannot create, edit, or delete anything.
                        </span>
                      </div>
                    )}

                    {/* ADMIN promotion warning */}
                    {(formData.roles ?? []).includes('ADMIN') && (
                      <div className="flex items-center gap-2 mb-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                        <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="text-xs text-amber-700">
                          This user will have <strong>full system access</strong>. At least one Administrator must always exist.
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {visibleClinicalRoles.map(opt => {
                        const Icon = opt.icon;
                        const isSelected = (formData.roles ?? []).includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              const current = formData.roles ?? [];
                              const next = isSelected
                                ? current.filter(r => r !== opt.value)
                                : [...current, opt.value];
                              setFormData(prev => ({ ...prev, roles: next.length > 0 ? next : [opt.value] }));
                            }}
                            className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-sm font-medium transition-all ${
                              isSelected
                                ? `${opt.bg} ring-2 ${opt.ring}`
                                : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <Icon className={`w-5 h-5 ${isSelected ? '' : 'text-gray-400'}`} />
                            <span className="text-xs font-semibold leading-tight text-center">{opt.label}</span>
                            <span className={`text-[10px] leading-tight text-center ${isSelected ? 'opacity-80' : 'text-gray-400'}`}>{opt.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Position */}
                  <div>
                    <Label>Position</Label>
                    <input
                      type="text"
                      value={formData.position}
                      onChange={e => set('position', e.target.value)}
                      placeholder="e.g. Clinic Desk, Office Manager"
                      className={inputCls(!!errors.position)}
                    />
                    <FieldError msg={errors.position} />
                  </div>

                  {/* Discipline — only shown for PRACTITIONER */}
                  {(formData.roles ?? []).includes('PRACTITIONER') && (
                    <div>
                      <Label required>Discipline</Label>
                      {showCreateDiscipline ? (
                        <div className="space-y-2">
                          <input
                            ref={newDisciplineInputRef}
                            type="text"
                            value={newDisciplineLabel}
                            onChange={e => setNewDisciplineLabel(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); handleAddDiscipline(); }
                              if (e.key === 'Escape') { setShowCreateDiscipline(false); setNewDisciplineLabel(''); }
                            }}
                            placeholder="e.g. Psychology"
                            className={inputCls()}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleAddDiscipline}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-semibold hover:bg-sky-700 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowCreateDiscipline(false); setNewDisciplineLabel(''); }}
                              className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <select
                          value={formData.discipline ?? ''}
                          onChange={e => {
                            if (e.target.value === '__CREATE__') {
                              setShowCreateDiscipline(true);
                            } else {
                              set('discipline', e.target.value);
                            }
                          }}
                          className={selectCls}
                        >
                          {disciplineOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                          <option disabled className="text-gray-300">──────────────</option>
                          <option value="__CREATE__">➕ Create Discipline...</option>
                        </select>
                      )}
                    </div>
                  )}

                  {/* ── Availability Section (for PRACTITIONER only) ── */}
                  {(formData.roles ?? []).includes('PRACTITIONER') && (
                    <div className="md:col-span-2 border-t border-gray-200 pt-5">
                      <SectionTitle color="text-emerald-600">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Practitioner Schedule
                        </span>
                      </SectionTitle>

                      {/* Duty Days */}
                      <div className="mb-4">
                        <Label required>Duty Days</Label>
                        <div className="flex flex-wrap gap-2">
                          {DUTY_DAY_OPTIONS.map(day => (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => toggleDutyDay(day.value)}
                              className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                                (formData.duty_days ?? []).includes(day.value)
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-400'
                                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {day.label}
                            </button>
                          ))}
                        </div>
                        {errors.duty_days && <FieldError msg={errors.duty_days} />}
                      </div>

                      {/* Per-day shift blocks */}
                      <div className="space-y-3 mb-4">
                        {DUTY_DAY_OPTIONS.filter(d => (formData.duty_days ?? []).includes(d.value)).map(day => {
                          const blocks = formData.duty_schedule?.[day.value] ?? [{ start: '08:00', end: '17:00' }];
                          return (
                            <div key={day.value} className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{day.label}</span>
                                <button
                                  type="button"
                                  onClick={() => addBlock(day.value)}
                                  className="flex items-center gap-1 text-xs text-emerald-600 font-medium hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Add Block
                                </button>
                              </div>
                              <div className="space-y-2">
                                {blocks.map((block: { start: string; end: string }, idx: number) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <input
                                      type="time"
                                      value={block.start}
                                      onChange={e => updateBlock(day.value, idx, 'start', e.target.value)}
                                      className="flex-1 border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition"
                                    />
                                    <span className="text-gray-400 text-xs shrink-0">–</span>
                                    <input
                                      type="time"
                                      value={block.end}
                                      onChange={e => updateBlock(day.value, idx, 'end', e.target.value)}
                                      className="flex-1 border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition"
                                    />
                                    <button
                                      type="button"
                                      disabled={blocks.length === 1}
                                      onClick={() => removeBlock(day.value, idx)}
                                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                      title="Remove block"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {errors.duty_schedule && <FieldError msg={errors.duty_schedule} />}

                      {/* Lunch Break (global) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label required>Lunch Start</Label>
                          <input
                            type="time"
                            value={formData.lunch_start_time ?? '12:00'}
                            onChange={e => set('lunch_start_time', e.target.value)}
                            className={inputCls(!!errors.lunch_start_time)}
                          />
                          <FieldError msg={errors.lunch_start_time} />
                        </div>
                        <div>
                          <Label required>Lunch End</Label>
                          <input
                            type="time"
                            value={formData.lunch_end_time ?? '13:00'}
                            onChange={e => set('lunch_end_time', e.target.value)}
                            className={inputCls(!!errors.lunch_end_time)}
                          />
                          <FieldError msg={errors.lunch_end_time} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Phase 8: Context-aware Branch Selector ─────────────────────── */}
                  <div className="md:col-span-2">
                    <Label required>
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-sky-500" />
                        Assign to Clinic Branch
                      </span>
                    </Label>

                    {formData.roles.includes('ADMIN_ASSISTANT') ? (
                      /* ── Manager Scope: Multi-branch Checkboxes ── */
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 mb-2">
                          Select the branches this Manager is authorized to manage.
                        </p>
                        {(isOwner ? branches : managerBranches).map(branch => {
                          const isSelected = formData.branch_ids?.includes(branch.id);
                          return (
                            <label
                              key={branch.id}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-200'
                                  : 'bg-white border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                value={branch.id}
                                checked={isSelected}
                                onChange={(e) => {
                                  const current = formData.branch_ids || [];
                                  if (e.target.checked) {
                                    set('branch_ids', [...current, branch.id]);
                                  } else {
                                    set('branch_ids', current.filter(id => id !== branch.id));
                                  }
                                }}
                                className="accent-sky-500 w-4 h-4 rounded border-gray-300 text-sky-500 focus:ring-sky-400"
                              />
                              <span className="text-sm font-medium text-gray-700">
                                {branch.name}
                                {branch.is_main_branch ? (
                                  <span className="ml-1.5 text-[10px] font-semibold text-sky-600 bg-sky-100 px-1.5 py-0.5 rounded">Main</span>
                                ) : null}
                                {branch.city ? <span className="ml-1 text-gray-400">· {branch.city}</span> : null}
                              </span>
                            </label>
                          );
                        })}
                        {(!formData.branch_ids || formData.branch_ids.length === 0) && (
                          <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            A Manager must be assigned to at least one branch.
                          </p>
                        )}
                      </div>
                    ) : (
                      /* ── Operational Roles: Single Primary Branch ── */
                      <>
                        {/* ── Branch Manager: Inherited Auto-Assignment (read-only) ── */}
                        {isManager && !isOwner && (
                          <div className="flex items-center gap-2 px-3 py-2.5 bg-sky-50 border border-sky-200 rounded-lg text-sm text-sky-800">
                            <Lock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            <span>
                              Auto-assigned to your clinic branch.
                            </span>
                          </div>
                        )}

                        {/* ── Case C: Owner → full dropdown of all branches ── */}
                        {(isOwner || (!isManager && managerBranches.length === 0)) && (
                          <>
                            {loadingBranches ? (
                              <div className={`${selectCls} text-gray-400`}>Loading branches…</div>
                            ) : branches.length === 0 ? (
                              <div className={`${selectCls} text-amber-600 bg-amber-50 border-amber-200`}>
                                No branches found. Please add a clinic branch first.
                              </div>
                            ) : (
                              <select
                                value={formData.clinic_branch ?? ''}
                                onChange={e =>
                                  set('clinic_branch', e.target.value ? Number(e.target.value) : null)
                                }
                                className={`${selectCls} ${
                                  errors.clinic_branch ? 'border-rose-400 ring-2 ring-rose-200' : ''
                                }`}
                              >
                                <option value="" disabled>— Select a branch —</option>
                                {branches.map(b => (
                                  <option key={b.id} value={b.id}>
                                    {b.name}
                                    {b.is_main_branch ? ' (Main)' : ''}
                                    {b.city ? ` · ${b.city}` : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                            {errors.clinic_branch ? (
                              <p className="mt-1 text-xs text-rose-500 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {errors.clinic_branch}
                              </p>
                            ) : (
                              <p className="mt-0.5 text-[10px] text-gray-400">
                                Every user must be assigned to a branch for correct diary and calendar scoping.
                              </p>
                            )}
                          </>
                        )}

                        {/* No branches case for Manager */}
                        {isManager && !isOwner && managerBranches.length === 0 && (
                          <div className={`${selectCls} text-amber-600 bg-amber-50 border-amber-200`}>
                            You have no branches assigned. Contact an Administrator.
                          </div>
                        )}
                      </>
                    )}
                  </div>

                </div>
              </div>

              {/* ════════════════════════════════════════
                  SECTION 3 — Contact Information
              ════════════════════════════════════════ */}
              <div>
                <SectionTitle color="text-slate-500">Contact Information</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">

                  {/* Email */}
                  <div className="md:col-span-2">
                    <Label required>Email Address</Label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => {
                        set('email', e.target.value);
                        const msg = validateEmailDetailed(e.target.value);
                        setErrors(prev => ({ ...prev, email: msg || undefined }));
                      }}
                      onBlur={e => {
                        const msg = validateEmailDetailed(e.target.value);
                        setErrors(prev => ({ ...prev, email: msg || undefined }));
                      }}
                      placeholder="john.doe@example.com"
                      className={inputCls(!!errors.email)}
                    />
                    {isEditMode && editingStaff && formData.email.trim().toLowerCase() !== editingStaff.email.trim().toLowerCase() && (
                      <div className="mt-1.5 flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          Changing the email will reset this user's password and send new
                          login credentials to <strong>{formData.email}</strong>. The old
                          email address will no longer work for sign-in.
                        </span>
                      </div>
                    )}
                    {isEditMode && editingStaff && formData.email.trim().toLowerCase() === editingStaff.email.trim().toLowerCase() && (
                      <p className="mt-0.5 text-[10px] text-gray-400">
                        Updating the email will send new temporary credentials to the new address and require a password reset.
                      </p>
                    )}
                    <FieldError msg={errors.email} />
                  </div>

                  {/* Phone */}
                  <div>
                    <Label required>Phone Number</Label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => {
                        const formatted = formatPHPhone(e.target.value);
                        set('phone', formatted);
                        const msg = validatePHPhoneDetailed(formatted);
                        setErrors(prev => ({ ...prev, phone: msg || undefined }));
                      }}
                      onBlur={e => {
                        const msg = validatePHPhoneDetailed(e.target.value);
                        setErrors(prev => ({ ...prev, phone: msg || undefined }));
                      }}
                      placeholder="(+63) 9XX XXX XXXX"
                      className={inputCls(!!errors.phone)}
                    />
                    <FieldError msg={errors.phone} />
                  </div>

                  {/* Address */}
                  <div>
                    <Label>Address</Label>
                    <textarea
                      rows={3}
                      value={formData.address}
                      onChange={e => set('address', e.target.value)}
                      placeholder="Street, City, Province, ZIP"
                      className={`${inputCls()} resize-none`}
                    />
                  </div>

                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/80">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm text-sm font-semibold"
              >
                {loading
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />{isEditMode ? 'Saving…' : 'Creating…'}</>
                  : <><UserPlus  className="w-4 h-4" />{isEditMode ? 'Save Changes' : 'Create Staff Member'}</>
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

      {/* ── Practitioner Removal Confirmation Modal ───────────────────────── */}
      {removalImpact && (
        <PractitionerRemovalModal
          isOpen={showRemovalModal}
          onClose={handleRemovalCancel}
          onConfirm={handleRemovalConfirm}
          loading={removalLoading}
          impact={removalImpact}
          practitionerName={
            editingStaff
              ? `${editingStaff.first_name} ${editingStaff.last_name}`.trim()
              : ''
          }
        />
      )}
    </>
  );
};