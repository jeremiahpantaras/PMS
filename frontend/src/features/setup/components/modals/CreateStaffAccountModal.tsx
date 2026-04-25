import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle, Building2, RefreshCw, Clock, Plus, Trash2 } from 'lucide-react';
import type { CreateStaffData, StaffFormErrors, StaffMember } from '../../types/staff.types';
import type { DutySchedule, DutyDay } from '@/features/clinics/clinic.api';
import { TITLE_OPTIONS, DISCIPLINE_OPTIONS, GENDER_OPTIONS } from '../../types/staff.types';
import { useClinicBranches } from '@/features/clinics/hooks/useClinicBranches';
import { formatPHPhone, isValidPHPhone } from '@/utils/phoneFormatter';

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
  isOpen:        boolean;
  onClose:       () => void;
  onSubmit:      (data: CreateStaffData) => Promise<void>;
  editingStaff?: StaffMember | null;
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
  role:          'STAFF',
  clinic_branch: null,
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
  isOpen, onClose, onSubmit, editingStaff = null,
}) => {
  const isEditMode = !!editingStaff;

  const [formData, setFormData] = useState<CreateStaffData>(EMPTY_FORM);
  const [errors, setErrors]     = useState<StaffFormErrors>({});
  const [loading, setLoading]   = useState(false);

  const { branches, loading: loadingBranches } = useClinicBranches();

  useEffect(() => {
    console.log('[CreateStaffModal] useEffect triggered', { editingStaff, isOpen });
    if (editingStaff) {
      console.log('[CreateStaffModal] Editing existing staff:', editingStaff);
      console.log('[CreateStaffModal] Staff availability:', editingStaff.availability);
      console.log('[CreateStaffModal] Staff discipline:', editingStaff.discipline);
      console.log('[CreateStaffModal] Staff position:', editingStaff.position);
      
      const newFormData = {
        first_name:    editingStaff.first_name,
        last_name:     editingStaff.last_name,
        middle_name:   editingStaff.middle_name   ?? '',
        nickname:      editingStaff.nickname       ?? '',
        title:         editingStaff.title          ?? 'Mr',
        position:      editingStaff.position       ?? '',
        discipline:    editingStaff.discipline     ?? 'OCCUPATIONAL_THERAPY',
        email:         editingStaff.email,
        phone:         editingStaff.phone ? formatPHPhone(editingStaff.phone) : '',
        address:       editingStaff.address        ?? '',
        date_of_birth: editingStaff.date_of_birth  ?? '',
        gender:        editingStaff.gender         ?? 'Male',
        role:          editingStaff.role,
        clinic_branch: editingStaff.clinic_branch  ?? null,
        // Availability
        duty_days:       (editingStaff.duty_days ?? editingStaff.availability?.duty_days ?? DEFAULT_DUTY_DAYS) as DutyDay[],
        lunch_start_time: editingStaff.lunch_start_time ?? editingStaff.availability?.lunch_start_time ?? '12:00',
        lunch_end_time:   editingStaff.lunch_end_time   ?? editingStaff.availability?.lunch_end_time   ?? '13:00',
        duty_schedule:    buildDutySchedule(editingStaff),
      };
      console.log('[CreateStaffModal] Setting form data to:', newFormData);
      setFormData(newFormData);
    } else {
      console.log('[CreateStaffModal] Creating new staff, using EMPTY_FORM');
      setFormData(EMPTY_FORM);
    }
    setErrors({});
  }, [editingStaff, isOpen]);

  const validateForm = (): boolean => {
    console.log('[CreateStaffModal] validateForm called, role:', formData.role);
    const e: StaffFormErrors = {};
    if (!formData.first_name.trim()) e.first_name = 'First name is required';
    if (!formData.last_name.trim())  e.last_name  = 'Last name is required';
    if (!formData.position?.trim())  e.position   = 'Position is required';
    if (!formData.email.trim()) {
      e.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      e.email = 'Invalid email format';
    }
    if (!formData.phone.trim()) {
      e.phone = 'Phone number is required';
    } else if (!isValidPHPhone(formData.phone)) {
      e.phone = 'Enter a valid Philippine mobile number';
    }
    if (formData.date_of_birth && new Date(formData.date_of_birth) > new Date())
      e.date_of_birth = 'Date of birth cannot be in the future';

    // Availability validation (for both PRACTITIONER and STAFF)
    if (formData.role === 'PRACTITIONER' || formData.role === 'STAFF') {
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
        }
      }
      if (!formData.lunch_start_time) e.lunch_start_time = 'Required';
      if (!formData.lunch_end_time)   e.lunch_end_time   = 'Required';
    }

    console.log('[CreateStaffModal] Validation errors:', e);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[CreateStaffModal] handleSubmit called');
    console.log('[CreateStaffModal] Current formData:', formData);
    console.log('[CreateStaffModal] Role:', formData.role);
    
    if (!validateForm()) {
      console.log('[CreateStaffModal] Validation failed, errors:', errors);
      return;
    }
    
    console.log('[CreateStaffModal] Validation passed, submitting...');
    setLoading(true);
    setErrors({});
    try {
      console.log('[CreateStaffModal] Calling onSubmit with:', formData);
      await onSubmit(formData);
      console.log('[CreateStaffModal] onSubmit completed successfully');
      handleClose();
    } catch (err: any) {
      console.error('[CreateStaffModal] Submit error:', err);
      console.error('[CreateStaffModal] Error response:', err?.response?.data);
      setErrors({ general: err.message || 'Failed to save. Please try again.' });
    } finally {
      setLoading(false);
    }
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

  if (!isOpen) return null;

  return (
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
                <h2 className="text-base font-bold text-gray-900">
                  {isEditMode ? 'Edit Staff Account' : 'New Staff Member'}
                </h2>
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

                  {/* Position */}
                  <div>
                    <Label required>Position</Label>
                    <input
                      type="text"
                      value={formData.position}
                      onChange={e => set('position', e.target.value)}
                      placeholder="e.g. Clinic Desk, Office Manager"
                      className={inputCls(!!errors.position)}
                    />
                    <FieldError msg={errors.position} />
                  </div>

                  {/* Discipline */}
                  <div>
                    <Label required>Discipline</Label>
                    <select
                      value={formData.discipline}
                      onChange={e => set('discipline', e.target.value as any)}
                      className={selectCls}
                    >
                      {DISCIPLINE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Role — toggle buttons */}
                  <div className="md:col-span-2">
                    <Label required>Role</Label>
                    <div className="flex gap-3">
                      {[
                        { value: 'STAFF',        label: 'Staff',        ring: 'ring-sky-400',   bg: 'bg-sky-50   text-sky-700   border-sky-200'   },
                        { value: 'PRACTITIONER', label: 'Practitioner', ring: 'ring-purple-400', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => set('role', opt.value as any)}
                          className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                            formData.role === opt.value
                              ? `${opt.bg} ring-2 ${opt.ring}`
                              : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Availability Section (for PRACTITIONER and STAFF) ── */}
                  {(formData.role === 'PRACTITIONER' || formData.role === 'STAFF') && (
                    <div className="md:col-span-2 border-t border-gray-200 pt-5">
                      <SectionTitle color="text-emerald-600">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {formData.role === 'PRACTITIONER' ? 'Practitioner' : 'Staff'} Schedule
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

                  {/* Clinic Branch */}
                  <div className="md:col-span-2">
                    <Label>
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-sky-500" />
                        Assign to Clinic Branch
                      </span>
                    </Label>
                    {loadingBranches ? (
                      <div className={`${selectCls} text-gray-400`}>Loading branches…</div>
                    ) : branches.length === 0 ? (
                      <div className={`${selectCls} text-gray-400`}>No branches available</div>
                    ) : (
                      <select
                        value={formData.clinic_branch ?? ''}
                        onChange={e =>
                          set('clinic_branch', e.target.value ? Number(e.target.value) : null)
                        }
                        className={selectCls}
                      >
                        <option value="">— No specific branch (all branches) —</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                            {b.is_main_branch ? ' (Main)' : ''}
                            {b.city ? ` · ${b.city}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    <p className="mt-0.5 text-[10px] text-gray-400">
                      Allows filtering staff per location in the diary.
                    </p>
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
                      onChange={e => set('email', e.target.value)}
                      disabled={isEditMode}
                      placeholder="john.doe@example.com"
                      className={`${inputCls(!!errors.email)} ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    {isEditMode && (
                      <p className="mt-0.5 text-[10px] text-gray-400">
                        Email cannot be changed after account creation.
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
                      onChange={e => set('phone', formatPHPhone(e.target.value))}
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
  );
};