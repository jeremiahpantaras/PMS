import React, { useState, useEffect, useRef, useCallback, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Calendar, Clock, User, FileText, Tag, MapPin,
  Receipt, Plus, Printer, AlertCircle,
  RefreshCw, ChevronDown, Building2, Edit3, Trash2,
  Save, XCircle, Search, UserCircle, ClipboardList,
  ExternalLink, Repeat, List, Stethoscope, Repeat2,
  Phone, Mail, Home, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Appointment } from '@/types';
import { getPatient } from '@/features/patients/patient.api';
import { getNotes } from '@/features/clinical-template/clinical-templates.api';
import type { ClinicalNote } from '@/types/clinicalTemplate';
import { APPOINTMENT_STATUS_COLORS, APPOINTMENT_TYPE_LABELS } from '@/types';
import { billingApi } from '@/features/billing/billing.api';
import type { ClinicService } from '@/features/billing/billing.api';
import type { Invoice } from '@/types/billing';
import {
  getCaseNoteCount,
  getCaseNotes,
  getLinkedCaseId,
  setLinkedCaseId,
  clearLinkedCase,
  type PatientCase,
  type PatientCaseStatus,
} from '@/features/patients/patientCases.storage';
import {
  getPatientCases,
  createPatientCase as apiCreatePatientCase,
  updatePatientCase as apiUpdatePatientCase,
} from '@/features/patients/patientCases.api';
import type { PatientCase as ApiPatientCase } from '@/types/patient';
import { CaseModal, type CaseFormData } from '@/features/patients/CaseModal';
import type { Practitioner } from '@/features/clinics/clinic.api';

import { AppointmentEditForm }    from './AppointmentEditForm';
import { CancelAppointmentModal } from './CancelAppointmentModal';
import { AddRecurringAppointments } from './AddRecurringAppointments';
import { ServiceSelector }         from './ServiceSelector';
import {
  createRecurringAppointments,
  editAppointment as apiEditAppointment,
  rescheduleAppointment as apiRescheduleAppointment,
} from '../appointment.api';
import toast from 'react-hot-toast';
import { useAppointmentEdit }     from '../hooks/useAppointmentEdit';
import { usePractitioners }       from '@/features/clinics/hooks/usePractitioners';
import { useAppointmentServices } from '../hooks/useAppointmentServices';
import type { AppointmentEditPayload } from '../appointment.api';

// ── helpers ─────────────────────────────────────────────────────────────────
const fmt12 = (t: string): string => {
  const [h, m] = t.split(':').map(Number);
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const minsToLabel = (mins: number): string => {
  if (mins <= 0) return '—';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const TIME_SLOTS_15: { value: string; label: string }[] = (() => {
  const slots: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push({ value, label: fmt12(value) });
    }
  }
  return slots;
})();

const INVOICE_STATUS_STYLES: Record<string, string> = {
  DRAFT:          'bg-gray-100 text-gray-600 border-gray-200',
  PENDING:        'bg-yellow-50 text-yellow-700 border-yellow-200',
  PAID:           'bg-green-50 text-green-700 border-green-200',
  PARTIALLY_PAID: 'bg-blue-50 text-blue-700 border-blue-200',
  OVERDUE:        'bg-red-50 text-red-700 border-red-200',
  CANCELLED:      'bg-gray-100 text-gray-400 border-gray-200',
};

type Tab = 'client' | 'appointment' | 'status' | 'clinical_notes' | 'invoice';

interface AppointmentViewProps {
  isOpen:      boolean;
  onClose:     () => void;
  appointment: Appointment | null;
  onUpdated?:  (appointment: Appointment) => void;
  onRecurringCreated?: () => void;
  /** Called when the user initiates rebook mode from this appointment's dropdown */
  onRebook?: (appointment: Appointment) => void;
}

interface EditableItem {
  id?:         number;
  description: string;
  quantity:    number;   // always number
  unit_price:  number;
  service_id?: number;
  _key:        string;
}

const newBlankItem = (): EditableItem => ({
  description: '',
  quantity:    1,
  unit_price:  0,
  _key:        crypto.randomUUID(),
});

// ── Appointment Summary Card ──────────────────────────────────────────────────
const AppointmentSummary: React.FC<{ appointment: Appointment }> = ({ appointment }) => {
  const formattedDate = format(new Date(appointment.date), 'MMM d, yyyy');

  const typeLabel = appointment.service_name
    ?? APPOINTMENT_TYPE_LABELS[appointment.appointment_type]
    ?? appointment.appointment_type;

  return (
    <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide">
        Appointment Summary
      </p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Patient</p>
            <p className="font-semibold text-gray-800">{appointment.patient_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Practitioner</p>
            <p className="font-semibold text-gray-800">
              {appointment.practitioner_name ?? 'Unassigned'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Date &amp; Time</p>
            <p className="font-semibold text-gray-800">
              {formattedDate} · {fmt12(appointment.start_time)} – {fmt12(appointment.end_time)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-sky-500 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Service</p>
            {appointment.service_color ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white mt-0.5"
                style={{ backgroundColor: appointment.service_color }}
              >
                {typeLabel}
              </span>
            ) : (
              <p className="font-semibold text-gray-800">{typeLabel}</p>
            )}
          </div>
        </div>
        {appointment.location_name && (
          <div className="flex items-center gap-2 col-span-2">
            <Building2 className="w-4 h-4 text-sky-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Clinic / Location</p>
              <p className="font-semibold text-gray-800">{appointment.location_name}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Service Picker Dropdown ───────────────────────────────────────────────────
const ServicePicker: React.FC<{
  services: ClinicService[];
  onSelect: (svc: ClinicService) => void;
  onClose:  () => void;
}> = ({ services, onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const filtered = services.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="absolute z-20 top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-hidden flex flex-col">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
        <Search className="w-3.5 h-3.5 text-gray-400" />
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search services…"
          className="flex-1 text-sm outline-none bg-transparent"
        />
        <button onClick={onClose} className="p-0.5 hover:bg-gray-100 rounded">
          <X className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>
      <div className="overflow-y-auto flex-1">
        {filtered.length === 0 && (
          <p className="text-xs text-gray-400 px-3 py-4 text-center">No services found</p>
        )}
        {filtered.map(svc => (
          <button
            key={svc.id}
            onClick={() => { onSelect(svc); onClose(); }}
            className="w-full text-left px-3 py-2 hover:bg-sky-50 transition-colors flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{svc.name}</p>
              {svc.description && (
                <p className="text-xs text-gray-400 truncate">{svc.description}</p>
              )}
            </div>
            <span className="text-sm font-semibold text-sky-700 flex-shrink-0">
              ₱{parseFloat(svc.price).toLocaleString()}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ── ClinicalCaseWorkspace (Column 2 of Client Tab) ───────────────────────────
const CASE_STATUS_STYLES: Record<PatientCaseStatus, { label: string; dot: string; cls: string }> = {
  OPEN:       { label: 'Open',       dot: 'bg-emerald-400', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MONITORING: { label: 'Monitoring', dot: 'bg-amber-400',   cls: 'bg-amber-50 text-amber-700 border-amber-200'       },
  DISCHARGED: { label: 'Discharged', dot: 'bg-purple-400',  cls: 'bg-purple-50 text-purple-700 border-purple-200'    },
  CLOSED:     { label: 'Closed',     dot: 'bg-gray-400',    cls: 'bg-gray-100 text-gray-500 border-gray-200'         },
};

const ClinicalCaseWorkspace = React.forwardRef<
  { save(): void },
  {
    appointment:          Appointment;
    patientCases:         PatientCase[];
    practitioners:        Practitioner[];
    loadingPractitioners: boolean;
    onCasesChanged:       () => void;
    onDirtyChange:        (dirty: boolean) => void;
  }
>(({ appointment, patientCases, practitioners, loadingPractitioners, onCasesChanged, onDirtyChange }, ref) => {
  const queryClient = useQueryClient();
  const [selectedCaseId,  setSelectedCaseId]  = useState<string>(patientCases[0]?.id ? String(patientCases[0].id) : '');
  const [editPayer,       setEditPayer]        = useState<string>(patientCases[0]?.payer ?? '');
  const [editStatus,      setEditStatus]       = useState<PatientCaseStatus>(patientCases[0]?.status ?? 'OPEN');
  const [editAlertNotes,  setEditAlertNotes]   = useState<string>(patientCases[0]?.alert_notes ?? '');
  const [saveError,       setSaveError]        = useState<string | null>(null);
  const [savedOk,         setSavedOk]          = useState(false);
  const [showCreateModal, setShowCreateModal]  = useState(false);
  const [showEditModal,   setShowEditModal]    = useState(false);

  const selectedCase = patientCases.find(c => String(c.id) === selectedCaseId) ?? null;

  // Sync editable fields when user switches cases; clear them when deselected
  useEffect(() => {
    if (selectedCase) {
      setEditPayer(selectedCase.payer ?? '');
      setEditStatus(selectedCase.status);
      setEditAlertNotes(selectedCase.alert_notes ?? '');
    } else {
      setEditPayer('');
      setEditStatus('OPEN');
      setEditAlertNotes('');
    }
    setSaveError(null);
    setSavedOk(false);
  }, [selectedCaseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to the appointment's linked case (or blank) when a different appointment is opened
  useEffect(() => {
    setSelectedCaseId(getLinkedCaseId(appointment.id) ?? '');
    setSaveError(null);
    setSavedOk(false);
  }, [appointment.id]);

  // Keep selectedCaseId valid after cases list changes (e.g. after create/delete).
  // '' is a valid "no case" state — never auto-select a case the user didn't choose.
  useEffect(() => {
    if (selectedCaseId !== '' && !patientCases.some(c => String(c.id) === selectedCaseId)) {
      setSelectedCaseId('');
      clearLinkedCase(appointment.id);
    }
  }, [patientCases]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = !!selectedCase && (
    editPayer      !== (selectedCase.payer      ?? '') ||
    editStatus     !== selectedCase.status             ||
    editAlertNotes !== (selectedCase.alert_notes ?? '')
  );

  const handleSave = () => {
    if (!selectedCase) return;
    setSaveError(null);
    apiUpdatePatientCase(Number(selectedCase.id), {
      payer:      editPayer || undefined,
      status:     editStatus,
      alert_notes: editAlertNotes || undefined,
    }).then(() => {
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
      onCasesChanged();
    }).catch(() => {
      setSaveError('Failed to save. Please try again.');
    });
  };

  const handleCreateCase = (data: CaseFormData) => {
    apiCreatePatientCase({
      patient:     appointment.patient,
      title:       data.title,
      description: data.description,
      status:      data.status,
      primary_practitioner: data.primaryPractitionerId ? Number(data.primaryPractitionerId) : undefined,
      primary_practitioner_name: data.primaryPractitionerName || undefined,
      payer:       data.payer || undefined,
      alert_notes:  data.alertNotes || undefined,
      referred_by:  data.referredBy || undefined,
      referral_info: data.referralInfo || undefined,
    }).then((created) => {
      setLinkedCaseId(appointment.id, String(created.id)); // explicitly link to this appointment
      toast.success('Case created');
      setShowCreateModal(false);
      setSelectedCaseId(String(created.id));
      queryClient.invalidateQueries({ queryKey: ['patient-cases', appointment.patient] });
      onCasesChanged();
    });
  };

  const handleEditCase = (data: CaseFormData) => {
    if (!selectedCase) return;
    apiUpdatePatientCase(Number(selectedCase.id), {
      title:                   data.title,
      description:             data.description,
      status:                  data.status,
      primary_practitioner:    data.primaryPractitionerId ? Number(data.primaryPractitionerId) : undefined,
      primary_practitioner_name: data.primaryPractitionerName || undefined,
      payer:       data.payer || undefined,
      alert_notes:  data.alertNotes || undefined,
      referred_by:  data.referredBy || undefined,
      referral_info: data.referralInfo || undefined,
    }).then(() => {
      setEditStatus(data.status);
      toast.success('Case updated');
      setShowEditModal(false);
      queryClient.invalidateQueries({ queryKey: ['patient-cases', appointment.patient] });
      onCasesChanged();
    });
  };

  const _handleSaveRef = useRef(handleSave);
  useEffect(() => { _handleSaveRef.current = handleSave; });
  useImperativeHandle(ref, () => ({ save: () => _handleSaveRef.current() }), []);
  useEffect(() => { onDirtyChange(isDirty); }, [isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  const fieldCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white text-gray-800';

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-sky-600 shrink-0" />
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Case Details</h3>
        </div>

        {/* Appointment practitioner row */}
        <div className="pb-3 border-b border-gray-100">
          <p className="text-xs text-gray-500 mb-0.5">Primary Practitioner</p>
          <p className="text-sm font-medium text-gray-900">
            {appointment.practitioner_name || <span className="text-gray-400 italic font-normal">Unassigned</span>}
          </p>
        </div>

        {/* Case selector */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Active Case</label>
          <div className="flex items-center gap-2">
            <select
              value={selectedCaseId}
              onChange={e => {
                if (e.target.value === '__create__') {
                  setShowCreateModal(true);
                } else {
                  const newId = e.target.value;
                  setSelectedCaseId(newId);
                  if (newId) {
                    setLinkedCaseId(appointment.id, newId);
                  } else {
                    clearLinkedCase(appointment.id);
                  }
                }
              }}
              className={`${fieldCls} flex-1 min-w-0`}
            >
              <option value="">— Select or Create Case —</option>
              {patientCases.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
              <option value="__create__">+ Create New Case</option>
            </select>
            {selectedCase && (
              <button
                onClick={() => setShowEditModal(true)}
                title="Edit this case"
                className="p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 border border-gray-200 rounded-lg transition-colors shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {selectedCase && (
          <>
            {/* Read-only case metadata card */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Status</p>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-semibold border ${CASE_STATUS_STYLES[selectedCase.status].cls}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${CASE_STATUS_STYLES[selectedCase.status].dot}`} />
                  {CASE_STATUS_STYLES[selectedCase.status].label}
                </span>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Opened</p>
                <p className="font-medium text-gray-900">{format(new Date(selectedCase.created_at), 'MMM d, yyyy')}</p>
              </div>
              {selectedCase.primary_practitioner_name && (
                <div className="col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Case Practitioner</p>
                  <p className="font-medium text-gray-900">{selectedCase.primary_practitioner_name}</p>
                </div>
              )}
              {selectedCase.referred_by && (
                <div className="col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Referred By</p>
                  <p className="font-medium text-gray-900">{selectedCase.referred_by}</p>
                </div>
              )}
              {selectedCase.description && (
                <div className="col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Description</p>
                  <p className="text-gray-700 leading-relaxed">{selectedCase.description}</p>
                </div>
              )}
            </div>

            {/* Editable: Status */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Case Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value as PatientCaseStatus)} className={fieldCls}>
                <option value="OPEN">Open</option>
                <option value="MONITORING">Monitoring</option>
                <option value="DISCHARGED">Discharged</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {/* Editable: Payer */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Payer</label>
              <select value={editPayer} onChange={e => setEditPayer(e.target.value)} className={fieldCls}>
                <option value="">— Select payer —</option>
                <option value="PRIVATE">Private Pay</option>
                <option value="HMO">HMO</option>
                <option value="INSURANCE">Insurance</option>
                <option value="CORPORATE">Corporate</option>
              </select>
            </div>

            {/* Editable: Alert Notes */}
            <div>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
                Alert Notes
                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 leading-none">CASE-WIDE</span>
              </label>
              <textarea
                value={editAlertNotes}
                onChange={e => setEditAlertNotes(e.target.value)}
                rows={3}
                className={`${fieldCls} resize-none`}
                placeholder="Persistent alerts visible across all sessions for this case…"
              />
            </div>

            {saveError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{saveError}
              </div>
            )}

            {savedOk && !isDirty && (
              <span className="text-xs text-green-600 font-medium">✓ Saved</span>
            )}
          </>
        )}
      </div>

      {/* Create Case Modal */}
      <CaseModal
        key="create-case"
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        mode="create"
        initialValues={{
            primary_practitioner:      appointment.practitioner ?? null,
            primary_practitioner_name: appointment.practitioner_name ?? null,
          }}
        lockPractitioner
        onSave={handleCreateCase}
        practitioners={practitioners}
        loadingPractitioners={loadingPractitioners}
      />

      {/* Edit Case Modal */}
      <CaseModal
        key={selectedCaseId ? `edit-${selectedCaseId}` : 'edit-case'}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        mode="edit"
        initialValues={selectedCase ?? undefined}
        onSave={handleEditCase}
        practitioners={practitioners}
        loadingPractitioners={loadingPractitioners}
      />
    </>
  );
});

// ── InlineAppointmentCard (Column 3 of Client Tab) ────────────────────────────
const InlineAppointmentCard = React.forwardRef<
  { save(): Promise<void> },
  {
    appointment:          Appointment;
    practitioners:        { id: number | string; name: string; specialization: string | null; role?: string; roles?: string[]; discipline?: string | null }[];
    loadingPractitioners: boolean;
    isTerminal:           boolean;
    onSaved:              (updated: Appointment) => void;
    queryClient:          ReturnType<typeof useQueryClient>;
    onDirtyChange:        (dirty: boolean) => void;
  }
>(({ appointment, practitioners, loadingPractitioners, isTerminal, onSaved, queryClient, onDirtyChange }, ref) => {
  const [editService,      setEditService]      = useState<number | ''>(appointment.service ?? '');
  const [editPractitioner, setEditPractitioner] = useState<number | ''>(appointment.practitioner ?? '');

  // Derive the currently-selected practitioner object and their discipline
  const hasPractitioner = editPractitioner !== '';
  const selectedPractitionerObj = hasPractitioner
    ? (practitioners.find(p => String(p.id) === String(editPractitioner)) ?? null)
    : null;
  const selectedPractitionerDiscipline = selectedPractitionerObj?.discipline ?? null;

  // Only fetch services when a practitioner with a known discipline is selected.
  // Passing `discipline: null` (no filter) is intentionally avoided here — if
  // there is no discipline we want an empty list, not all services.
  const shouldFetchServices = hasPractitioner && !!selectedPractitionerDiscipline;
  const { services, loading: loadingServices } = useAppointmentServices(
    shouldFetchServices ? { discipline: selectedPractitionerDiscipline! } : undefined
  );
  // When no practitioner or no discipline, override to empty so ServiceSelector
  // never shows unfiltered services.
  const filteredServices = shouldFetchServices ? services : [];

  const [editStartTime,    setEditStartTime]    = useState(appointment.start_time.slice(0, 5));
  const [editEndTime,      setEditEndTime]      = useState(appointment.end_time.slice(0, 5));
  const [editNotes,        setEditNotes]        = useState(appointment.notes || '');
  const [saveError,        setSaveError]        = useState<string | null>(null);

  useEffect(() => {
    setEditService(appointment.service ?? '');
    setEditPractitioner(appointment.practitioner ?? '');
    setEditStartTime(appointment.start_time.slice(0, 5));
    setEditEndTime(appointment.end_time.slice(0, 5));
    setEditNotes(appointment.notes || '');
    setSaveError(null);
  }, [appointment.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the practitioner changes and their discipline no longer covers the
  // currently-selected service, clear the selection to avoid an invalid state.
  useEffect(() => {
    // If no discipline is available (practitioner removed or discipline unset),
    // always clear the service selection to prevent stale data.
    if (!shouldFetchServices) {
      if (editService !== '') setEditService('');
      return;
    }
    if (editService === '' || filteredServices.length === 0) return;
    const stillValid = filteredServices.some(s => s.id === Number(editService));
    if (!stillValid) {
      setEditService('');
    }
  }, [filteredServices, shouldFetchServices]); // eslint-disable-line react-hooks/exhaustive-deps


  const computeDuration = (start: string, end: string): number => {
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    return Math.max((eH * 60 + eM) - (sH * 60 + sM), 0);
  };

  const handleServiceChange = (serviceId: number | '') => {
    setEditService(serviceId);
    if (serviceId !== '') {
      const svc = services.find(s => s.id === Number(serviceId));
      if (svc?.duration_minutes) {
        const [sH, sM] = editStartTime.split(':').map(Number);
        const totalMins = sH * 60 + sM + svc.duration_minutes;
        const eH = Math.floor(totalMins / 60) % 24;
        const eM = totalMins % 60;
        setEditEndTime(`${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`);
      }
    }
  };

  const handleStartTimeChange = (newStart: string) => {
    const oldDuration = computeDuration(editStartTime, editEndTime);
    setEditStartTime(newStart);
    if (oldDuration > 0) {
      const [sH, sM] = newStart.split(':').map(Number);
      const totalMins = sH * 60 + sM + oldDuration;
      const eH = Math.floor(totalMins / 60) % 24;
      const eM = totalMins % 60;
      setEditEndTime(`${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`);
    }
  };

  const isDirty =
    String(editService)      !== String(appointment.service      ?? '') ||
    String(editPractitioner) !== String(appointment.practitioner ?? '') ||
    editStartTime            !== appointment.start_time.slice(0, 5)     ||
    editEndTime              !== appointment.end_time.slice(0, 5)       ||
    editNotes                !== (appointment.notes || '');

  const handleSave = async () => {
    setSaveError(null);
    try {
      let updated = appointment;

      const timeChanged =
        editStartTime !== appointment.start_time.slice(0, 5) ||
        editEndTime   !== appointment.end_time.slice(0, 5);

      if (timeChanged) {
        updated = await apiRescheduleAppointment(appointment.id, {
          date:       appointment.date,
          start_time: editStartTime,
          end_time:   editEndTime,
        });
      }

      const editPayload: AppointmentEditPayload = {};
      if (String(editService) !== String(appointment.service ?? ''))
        editPayload.service = editService === '' ? null : Number(editService);
      if (String(editPractitioner) !== String(appointment.practitioner ?? ''))
        editPayload.practitioner = editPractitioner === '' ? null : Number(editPractitioner);
      if (editNotes !== (appointment.notes || ''))
        editPayload.notes = editNotes;

      if (Object.keys(editPayload).length > 0) {
        updated = await apiEditAppointment(appointment.id, editPayload);
      }

      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['diary-appointments'] });
      onSaved(updated);
      toast.success('Appointment updated.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; non_field_errors?: string[] } } };
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.non_field_errors?.[0] ||
        'Failed to save changes.';
      setSaveError(msg);
      toast.error(msg);
    }
  };

  const _apptSaveRef = useRef(handleSave);
  useEffect(() => { _apptSaveRef.current = handleSave; });
  useImperativeHandle(ref, () => ({ save: () => _apptSaveRef.current() }), []);
  useEffect(() => { onDirtyChange(isDirty); }, [isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  const duration = computeDuration(editStartTime, editEndTime);
  const fieldCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white text-gray-800 disabled:bg-gray-50 disabled:text-gray-400';

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-sky-600 shrink-0" />
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Appointment Details</h3>
      </div>

      {isTerminal && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          This appointment is {appointment.status.toLowerCase()} — details are read-only.
        </div>
      )}

      <div className="pb-3 border-b border-gray-100">
        <p className="text-xs text-gray-500 mb-0.5">Date</p>
        <p className="text-sm font-semibold text-gray-900">{format(new Date(appointment.date), 'EEEE, MMM d, yyyy')}</p>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Time</label>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <p className="text-[10px] text-gray-400 mb-1">Start</p>
            <select
              value={editStartTime}
              onChange={e => handleStartTimeChange(e.target.value)}
              disabled={isTerminal}
              className={fieldCls}
            >
              {TIME_SLOTS_15.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <span className="text-gray-300 mt-4 text-lg">–</span>
          <div className="flex-1">
            <p className="text-[10px] text-gray-400 mb-1">End</p>
            <select
              value={editEndTime}
              onChange={e => setEditEndTime(e.target.value)}
              disabled={isTerminal}
              className={fieldCls}
            >
              {TIME_SLOTS_15.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        {duration > 0 && (
          <p className="text-[10px] text-sky-600 font-medium mt-1.5">Duration: {minsToLabel(duration)}</p>
        )}
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Consultation Type</label>
        {/* ── Edge Case 2: No practitioner assigned ── */}
        {!isTerminal && !hasPractitioner ? (
          <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-400">
              Assign a practitioner first to see available services.
            </p>
          </div>
        ) : !isTerminal && hasPractitioner && !selectedPractitionerDiscipline && !loadingPractitioners ? (
          /* ── Edge Case 2: Practitioner exists but has no discipline ── */
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-800">No services available</p>
              <p className="text-xs text-amber-700 mt-0.5">
                The assigned practitioner has no discipline configured. Ask an admin to set one
                under <strong>Setup → Practitioners</strong>.
              </p>
            </div>
          </div>
        ) : !isTerminal && shouldFetchServices && !loadingServices && filteredServices.length === 0 ? (
          /* ── Edge Case 3: Discipline set but no services configured for it ── */
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-800">No services configured for this discipline</p>
              <p className="text-xs text-amber-700 mt-0.5">
                No active clinic services exist for <strong>{selectedPractitionerObj?.discipline}</strong>. Ask an admin to add
                them under <strong>Setup → Clinic Services</strong>.
              </p>
            </div>
          </div>
        ) : (
          /* ── Normal: show discipline-filtered services ── */
          <ServiceSelector
            services={filteredServices}
            value={editService}
            onChange={handleServiceChange}
            disabled={isTerminal || (!hasPractitioner && !isTerminal)}
            loading={loadingServices || (hasPractitioner && loadingPractitioners)}
            compact
          />
        )}
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Practitioner</label>
        {loadingPractitioners ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
            <div className="w-3.5 h-3.5 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin" />
            Loading practitioners…
          </div>
        ) : (
          <select
            value={editPractitioner}
            onChange={e => setEditPractitioner(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={isTerminal}
            className={fieldCls}
          >
            <option value="">Unassigned</option>
            {practitioners
              .filter(p => (p.roles ?? []).includes('PRACTITIONER') || p.role === 'PRACTITIONER')
              .map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.specialization && ` — ${p.specialization}`}
                </option>
              ))}
          </select>
        )}
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1.5">
          Appointment Notes{' '}
          <span className="text-[10px] font-semibold text-sky-600 bg-sky-50 border border-sky-200 rounded px-1 py-0.5">THIS SESSION ONLY</span>
        </label>
        <textarea
          value={editNotes}
          onChange={e => setEditNotes(e.target.value)}
          rows={3}
          disabled={isTerminal}
          className={`${fieldCls} resize-none`}
          placeholder="Notes specific to this appointment…"
        />
        <p className="text-[10px] text-gray-400 mt-1">Only affects this appointment session.</p>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{saveError}
        </div>
      )}
    </div>
  );
});

// ── Invoice Tab ───────────────────────────────────────────────────────────────
const InvoiceTab: React.FC<{ appointment: Appointment }> = ({ appointment }) => {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [isEditing,   setIsEditing]   = useState(false);
  const [editItems,   setEditItems]   = useState<EditableItem[]>([]);
  const [editNotes,   setEditNotes]   = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [pickerIdx,   setPickerIdx]   = useState<number | null>(null);
  const [saveError,   setSaveError]   = useState<string | null>(null);

  const { data: invoice, isLoading, error: fetchError, refetch } = useQuery<Invoice | null>({
    queryKey: ['appointment-invoice', appointment.id],
    queryFn:  () => billingApi.getByAppointment(appointment.id),
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 404) return false;
      return failureCount < 2;
    },
  });

  const { data: clinicServices = [] } = useQuery<ClinicService[]>({
    queryKey: ['clinic-services'],
    queryFn:  () => billingApi.getClinicServices(),
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (items?: EditableItem[]) =>
      billingApi.createFromAppointment({
        appointment:  appointment.id,
        invoice_date: format(new Date(), 'yyyy-MM-dd'),
        items: items?.map(i => ({
          description: i.description,
          quantity:    i.quantity,
          unit_price:  i.unit_price,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointment-invoice', appointment.id] });
      qc.invalidateQueries({ queryKey: ['appointment-invoice-exists', appointment.id] });
    },
    onError: (error: any) => {
      console.error('❌ Invoice creation error:', error?.response?.data);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error('No invoice');
      const keepIds  = new Set(editItems.filter(i => i.id).map(i => i.id!));
      const toDelete = invoice.items.filter(i => !keepIds.has(i.id));
      for (const item of toDelete) await billingApi.deleteItem(item.id);
      for (const item of editItems.filter(i => i.id)) {
        await billingApi.updateItem(item.id!, {
          description: item.description,
          quantity:    String(item.quantity) as any,
          unit_price:  String(item.unit_price) as any,
        });
      }
      for (const item of editItems.filter(i => !i.id)) {
        if (!item.description.trim()) continue;
        await billingApi.addItem(invoice.id, {
          invoice:     invoice.id,
          description: item.description,
          quantity:    item.quantity,
          unit_price:  item.unit_price,
        });
      }
      await billingApi.updateInvoice(invoice.id, {
        notes:    editNotes,
        due_date: editDueDate || null,
      } as any);
    },
    onSuccess: () => {
      setSaveError(null);
      setIsEditing(false);
      qc.invalidateQueries({ queryKey: ['appointment-invoice', appointment.id] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data;
      if (typeof detail === 'string') setSaveError(detail);
      else if (detail?.detail) setSaveError(detail.detail);
      else setSaveError('Failed to save changes. Please try again.');
    },
  });
  
  const startEditing = useCallback(() => {
    if (!invoice) return;
    setEditItems(invoice.items.map(item => ({
      id:          item.id,
      description: item.description,
      // FIX: Parse string to number
      quantity:    parseInt(String(item.quantity), 10) || 1,
      // FIX: Parse string to number
      unit_price:  parseFloat(String(item.unit_price)) || 0,
      _key:        String(item.id),
    })));
    setEditNotes(invoice.notes || '');
    setEditDueDate(invoice.due_date || '');
    setSaveError(null);
    setIsEditing(true);
  }, [invoice]);


  const cancelEditing = () => { setIsEditing(false); setPickerIdx(null); setSaveError(null); };
  const updateItem    = (key: string, patch: Partial<EditableItem>) =>
    setEditItems(prev => prev.map(i => i._key === key ? { ...i, ...patch } : i));
  const removeItem    = (key: string) =>
    setEditItems(prev => prev.filter(i => i._key !== key));
  const addServiceItem = (svc: ClinicService, idx: number) =>
    setEditItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, description: svc.name, unit_price: parseFloat(svc.price), service_id: svc.id } : item
    ));
  const computeSubtotal = () =>
    editItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />Loading invoice…
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-4">
        <AppointmentSummary appointment={appointment} />
        <div className="flex flex-col items-center justify-center py-8">
          {fetchError && (fetchError as any)?.response?.status !== 404 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 w-full mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Failed to check existing invoice. Please try refreshing.</span>
            </div>
          )}
          {createMutation.isError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 w-full mb-4">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                {(() => {
                  const err = createMutation.error as any;
                  const detail = err?.response?.data;
                  if (typeof detail === 'string') return detail;
                  if (detail?.detail) return detail.detail;
                  if (detail?.appointment && Array.isArray(detail.appointment)) return detail.appointment.join(' ');
                  if (typeof detail === 'object') return JSON.stringify(detail);
                  return 'Failed to create invoice. Please try again.';
                })()}
              </span>
            </div>
          )}
          <button 
            onClick={() => navigate(`/billing/generate-invoice/${appointment.id}`)}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium">
            {createMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {createMutation.isPending ? 'Generating…' : 'Generate Invoice'}
          </button>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="space-y-4">
        <AppointmentSummary appointment={appointment} />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Editing Invoice</p>
            <p className="text-base font-bold text-gray-900 font-mono">{invoice.invoice_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={cancelEditing} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <XCircle className="w-3.5 h-3.5" />Cancel
            </button>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-medium hover:bg-sky-700 disabled:opacity-50 transition-colors">
              {saveMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
        {saveError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{saveError}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-xs text-gray-500">Invoice Date</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{format(new Date(invoice.invoice_date), 'MMM d, yyyy')}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <label className="text-xs text-gray-500 block">Due Date</label>
            <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className="mt-0.5 text-sm font-semibold text-gray-800 bg-transparent outline-none w-full" />
          </div>
        </div>
        <div className="border border-gray-200 rounded-xl overflow-visible">
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Line Items</p>
            <button onClick={() => setEditItems(prev => [...prev, newBlankItem()])} className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700">
              <Plus className="w-3.5 h-3.5" />Add Item
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {editItems.map((item, idx) => (
              <div key={item._key} className="px-4 py-3 space-y-2 relative">
                <div className="flex items-start gap-2">
                  <div className="flex-1 relative">
                    <label className="text-xs text-gray-400 block mb-0.5">Description</label>
                    <div className="flex gap-1">
                      <input value={item.description} onChange={e => updateItem(item._key, { description: e.target.value })} placeholder="Item description" className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-200" />
                      <button onClick={() => setPickerIdx(pickerIdx === idx ? null : idx)} className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:bg-sky-50 hover:text-sky-600 transition-colors flex-shrink-0" type="button">
                        <Search className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {pickerIdx === idx && <ServicePicker services={clinicServices} onSelect={svc => addServiceItem(svc, idx)} onClose={() => setPickerIdx(null)} />}
                  </div>
                  <button onClick={() => removeItem(item._key)} className="mt-5 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-0.5">Qty</label>
                    <input type="number" min={1} value={item.quantity} onChange={e => updateItem(item._key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-0.5">Unit Price (₱)</label>
                    <input type="number" min={0} step="0.01" value={item.unit_price} onChange={e => updateItem(item._key, { unit_price: parseFloat(e.target.value) || 0 })} className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-0.5">Line Total</label>
                    <p className="text-sm font-semibold text-gray-800 px-2.5 py-1.5">₱{(item.quantity * item.unit_price).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
            {editItems.length === 0 && <div className="px-4 py-8 text-center"><p className="text-xs text-gray-400">No items. Click "Add Item" above.</p></div>}
          </div>
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Subtotal</span>
            <span className="text-sm font-bold text-gray-900">₱{computeSubtotal().toLocaleString()}</span>
          </div>
        </div>
        {clinicServices.length > 0 && (
          <div className="border border-dashed border-sky-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-sky-700 mb-2 uppercase tracking-wide">Quick Add from Services</p>
            <div className="flex flex-wrap gap-1.5">
              {clinicServices.map(svc => {
                const alreadyAdded = editItems.some(i => i.service_id === svc.id);
                return (
                  <button key={svc.id} disabled={alreadyAdded}
                    onClick={() => setEditItems(prev => [...prev, { description: svc.name, quantity: 1, unit_price: parseFloat(svc.price), service_id: svc.id, _key: crypto.randomUUID() }])}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${alreadyAdded ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed' : 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50'}`}>
                    {svc.name} · ₱{parseFloat(svc.price).toLocaleString()}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Notes</label>
          <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-200 resize-none" placeholder="Optional notes…" />
        </div>
      </div>
    );
  }

  const canEdit = invoice.status === 'DRAFT' || invoice.status === 'PENDING';

  return (
    <div className="space-y-4">
      <AppointmentSummary appointment={appointment} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-gray-500">Invoice Number</p>
          <p className="text-base font-bold text-gray-900 font-mono">{invoice.invoice_number}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${INVOICE_STATUS_STYLES[invoice.status] ?? ''}`}>{invoice.status_display}</span>
          {canEdit && <button onClick={startEditing} className="flex items-center gap-1.5 px-3 py-1.5 border border-sky-200 rounded-lg text-xs font-medium text-sky-600 hover:bg-sky-50 transition-colors"><Edit3 className="w-3.5 h-3.5" />Edit</button>}
          <button onClick={() => navigate(`/clients/${appointment.patient}`)} className="flex items-center gap-1.5 px-3 py-1.5 border border-sky-200 rounded-lg text-xs font-medium text-sky-600 hover:bg-sky-50 transition-colors"><FileText className="w-3.5 h-3.5" />View Full Invoice</button>
          <button onClick={() => billingApi.print(invoice.id)} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"><Printer className="w-3.5 h-3.5" />Print</button>
          <button onClick={() => refetch()} className="p-1.5 border border-gray-200 rounded-lg text-gray-400 hover:bg-gray-50 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
          <p className="text-xs text-gray-500">Invoice Date</p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5">{format(new Date(invoice.invoice_date), 'MMM d, yyyy')}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
          <p className="text-xs text-gray-500">Due Date</p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5">{invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : <span className="text-gray-400">—</span>}</p>
        </div>
      </div>
      {invoice.items.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Items</p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">Description</th>
                <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">Qty</th>
                <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">Price</th>
                <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoice.items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-800">{item.description}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">₱{parseFloat(item.unit_price).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-800">₱{parseFloat(item.total).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
        {[
          { label: 'Subtotal', value: invoice.subtotal },
          { label: 'Discount', value: invoice.discount_amount },
          { label: 'Tax',      value: invoice.tax_amount },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="text-gray-700">₱{parseFloat(value).toLocaleString()}</span>
          </div>
        ))}
        <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-900">Total</span>
          <span className="text-base font-bold text-gray-900">₱{parseFloat(invoice.total_amount).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Amount Paid</span>
          <span className="text-green-600 font-medium">₱{parseFloat(invoice.amount_paid).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-700">Balance Due</span>
          <span className={`font-bold ${parseFloat(invoice.balance_due) > 0 ? 'text-red-600' : 'text-green-600'}`}>₱{parseFloat(invoice.balance_due).toLocaleString()}</span>
        </div>
      </div>
      {invoice.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-amber-700 mb-1">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
};

// ── Main AppointmentView Component ────────────────────────────────────────────
export const AppointmentView: React.FC<AppointmentViewProps> = ({
  isOpen,
  onClose,
  appointment: initialAppointment,
  onUpdated,
  onRecurringCreated,
  onRebook,
}) => {
  const [activeTab,             setActiveTab]             = useState<Tab>('client');
  const [showCancelModal,       setShowCancelModal]       = useState(false);
  const [showAppointmentDropdown, setShowAppointmentDropdown] = useState(false);
  const [showRecurringModal,     setShowRecurringModal]     = useState(false);
  const [casesVersion,           setCasesVersion]           = useState(0);
  const caseWorkspaceRef = useRef<{ save(): void } | null>(null);
  const inlineApptRef    = useRef<{ save(): Promise<void> } | null>(null);
  const [caseDirty,      setCaseDirty]   = useState(false);
  const [apptDirty,      setApptDirty]   = useState(false);
  const [isSavingAll,    setIsSavingAll] = useState(false);
  const appointmentDropdownRef = useRef<HTMLDivElement>(null);

  // Query client for invalidation
  const queryClient = useQueryClient();

  // Query to check if invoice exists for this appointment
  const { data: hasInvoice } = useQuery({
    queryKey: ['appointment-invoice-exists', initialAppointment?.id],
    queryFn: async () => {
      if (!initialAppointment?.id) return false;
      try {
        const invoice = await billingApi.getByAppointment(initialAppointment.id);
        return !!invoice;
      } catch {
        return false;
      }
    },
    enabled: !!initialAppointment,
    initialData: false,
  });

  // Close appointment dropdown when clicking outside
  useEffect(() => {
    if (!showAppointmentDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (appointmentDropdownRef.current && !appointmentDropdownRef.current.contains(event.target as Node)) {
        setShowAppointmentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAppointmentDropdown]);

  const lastAppointmentIdRef = useRef<number | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(initialAppointment);

  useEffect(() => {
    if (!initialAppointment) {
      setAppointment(null);
      lastAppointmentIdRef.current = null;
      return;
    }
    // Always sync the latest initialAppointment into local state.
    // The previous guard (id !== lastId) blocked updates when the SAME appointment's
    // fields changed (e.g. arrival_status: DNA → ARRIVED after onUpdated), causing
    // the modal to show stale data. We now accept all updates unconditionally so
    // the Status tab, badges, and DNA banner always reflect the current backend value.
    setAppointment(initialAppointment);
    lastAppointmentIdRef.current = initialAppointment.id;
  }, [initialAppointment]);

  const {
    isEditing, isSaving, isDirty, editError,
    isCancelling, cancelError,
    startEdit, cancelEdit, saveEdit,
    cancelAppointmentAction, markDirty,
  } = useAppointmentEdit();

  const { practitioners, loading: loadingPractitioners } = usePractitioners();

  // ── Patient data ───────────────────────────────────────────────────────────────
  const navigate = useNavigate();
  const { data: patient, isLoading: loadingPatient } = useQuery({
    queryKey: ['patient', appointment?.patient],
    queryFn: () => getPatient(appointment!.patient),
    enabled: !!appointment?.patient,
  });

  const { data: patientNotes = [] } = useQuery<ClinicalNote[]>({
    queryKey: ['appointment-patient-notes', appointment?.patient],
    queryFn: () => getNotes({ patient: appointment!.patient }),
    enabled: !!appointment?.patient,
    staleTime: 60 * 1000,
  });

  const handleViewFullProfile = () => {
    if (patient) {
      onClose();
      navigate(`/clients/${patient.id}`);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      cancelEdit();
      setShowCancelModal(false);
      setActiveTab('client');
      lastAppointmentIdRef.current = null;
    }
  }, [isOpen, cancelEdit]);

  // casesVersion increments trigger re-renders, which re-fetches from API below.
  const { data: apiPatientCases = [] } = useQuery<ApiPatientCase[]>({
    queryKey: ['patient-cases', appointment?.patient],
    queryFn: () => getPatientCases(appointment!.patient),
    enabled: !!appointment?.patient,
  });

  const patientCases = casesVersion >= 0 && appointment
    ? apiPatientCases
    : [];

  if (!isOpen || !appointment) return null;

  const statusColors  = APPOINTMENT_STATUS_COLORS[appointment.status]
    ?? APPOINTMENT_STATUS_COLORS['CANCELLED']; // safe fallback for any unknown status

  const typeLabel = appointment.service_name
    ?? APPOINTMENT_TYPE_LABELS[appointment.appointment_type]
    ?? appointment.appointment_type;

  const serviceColor = appointment.service_color;

  const formattedDate = format(new Date(appointment.date), 'EEEE, MMMM d, yyyy');
  const formattedTime = `${fmt12(appointment.start_time)} - ${fmt12(appointment.end_time)}`;
  const isCancelled   = appointment.status === 'CANCELLED';
  const isCompleted   = appointment.status === 'COMPLETED';
  const isDNA         = appointment.arrival_status === 'DNA' || appointment.status === 'DNA';
  const isTerminal    = isCancelled || isCompleted;

const caseMetrics: Record<string, { noteCount: number; lastUpdated: string }> = {};
  patientCases.forEach((caseItem: PatientCase) => {
    const notes = getCaseNotes(appointment.patient, caseItem.id, patientNotes);
    const noteCount = getCaseNoteCount(appointment.patient, caseItem.id, patientNotes);
    const latestNoteDate = notes
      .map((note) => note.updated_at || note.date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    caseMetrics[caseItem.id] = {
      noteCount,
      lastUpdated: latestNoteDate || caseItem.createdAt,
    };
  });

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins  = minutes % 60;
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
  };

  const handleSaveEdit = async (payload: AppointmentEditPayload) => {
    const updated = await saveEdit(appointment.id, payload);
    if (updated) {
      setAppointment(updated);
      lastAppointmentIdRef.current = updated.id;
      onUpdated?.(updated);
    }
  };

  const handleInlineApptSaved = (updated: Appointment) => {
    setAppointment(updated);
    lastAppointmentIdRef.current = updated.id;
    onUpdated?.(updated);
  };

  const handleSaveAll = async () => {
    setIsSavingAll(true);
    try {
      if (caseDirty) caseWorkspaceRef.current?.save();
      if (apptDirty && !isTerminal) await inlineApptRef.current?.save();
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleCancelAppointment = async (reason: string) => {
    const updated = await cancelAppointmentAction(appointment.id, {
      cancellation_reason: reason,
    });
    if (updated) {
      setAppointment(updated);
      lastAppointmentIdRef.current = updated.id;
      onUpdated?.(updated);
      setShowCancelModal(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-md transition-opacity duration-300"
        onClick={isEditing ? undefined : onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl pointer-events-auto max-h-[90vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isCancelled ? 'bg-red-100' : 'bg-sky-600'
              }`}>
                <Calendar className={`w-5 h-5 ${isCancelled ? 'text-red-500' : 'text-white'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-gray-900">Appointment Details</h2>
                  {isEditing && (
                    <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-xs font-semibold rounded-full">
                      Editing
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{appointment.patient_name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* ── Tabs ── */}
          <div className="flex border-b border-gray-200 flex-shrink-0 overflow-visible relative">
            {([
              { key: 'client', label: 'Client Information', icon: UserCircle },
              { key: 'appointment', label: 'Appointment', icon: Calendar, isDropdown: true },
              { key: 'status', label: 'Status', icon: ClipboardList },
              { key: 'clinical_notes', label: 'Clinical Notes', icon: FileText },
              { key: 'invoice', label: hasInvoice ? 'View Invoice' : 'Generate Invoice', icon: Receipt },
            ] as { key: Tab; label: string; icon: React.ElementType; isDropdown?: boolean }[]).map(tab => (
              <div key={tab.key} className="relative" ref={tab.isDropdown ? appointmentDropdownRef : null}>
                <button
                  key={tab.key}
                  onClick={() => {
                    if (tab.isDropdown) {
                      setShowAppointmentDropdown(!showAppointmentDropdown);
                    } else if (tab.key === 'clinical_notes') {
                      // Redirect to PatientCasesNotesPage
                      onClose();
                      navigate(`/patients/${appointment.patient}/cases`);
                    } else {
                      setActiveTab(tab.key);
                      if (isEditing) cancelEdit();
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'border-sky-500 text-sky-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.isDropdown && <ChevronDown className={`w-3 h-3 transition-transform ${showAppointmentDropdown ? 'rotate-180' : ''}`} />}
                </button>
                {/* Appointment Dropdown Menu */}
                {tab.isDropdown && showAppointmentDropdown && (
                  <div className="absolute left-0 top-full mt-1 w-66 bg-white border border-gray-200 rounded-xl shadow-lg z-9999 py-1">
                    <button
                      onClick={() => {
                        setShowAppointmentDropdown(false);
                        setActiveTab('appointment');
                        if (isEditing) cancelEdit();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-sky-50 transition-colors"
                    >
                      <Calendar className="w-4 h-4 text-sky-500" />
                      View Appointment Details
                    </button>
                    {!isTerminal && (
                      <button
                        onClick={() => {
                          setShowAppointmentDropdown(false);
                          setActiveTab('appointment');
                          startEdit();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-sky-50 transition-colors"
                      >
                        <Edit3 className="w-4 h-4 text-sky-500" />
                        Edit Appointment
                      </button>
                    )}
                    {!isTerminal && (
                      <button
                        onClick={() => {
                          setShowAppointmentDropdown(false);
                          setShowCancelModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Cancel Appointment
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowAppointmentDropdown(false);
                        setShowRecurringModal(true);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-sky-50 transition-colors"
                    >
                      <Repeat className="w-4 h-4 text-sky-500" />
                      Add Recurring Appointments
                    </button>
                    {onRebook && (
                      <button
                        onClick={() => {
                          setShowAppointmentDropdown(false);
                          onRebook(appointment);
                          onClose();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-emerald-700 hover:bg-emerald-50 transition-colors"
                      >
                        <Repeat2 className="w-4 h-4 text-emerald-500" />
                        Rebook Appointment
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowAppointmentDropdown(false);
                        onClose();
                        navigate(`/clients/${appointment.patient}`);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-sky-50 transition-colors"
                    >
                      <List className="w-4 h-4 text-sky-500" />
                      View Appointment List
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeTab === 'client' && (
              <div className="space-y-5">
                {/* 3-Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* ── Column 1: Client Information ── */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-4">
                      <User className="w-4 h-4 text-sky-600 shrink-0" />
                      <h3 className="text-lg font-semibold text-gray-900">Client Information</h3>
                    </div>

                    {loadingPatient ? (
                      <div className="flex items-center gap-2 text-xs text-gray-500 py-5">
                        <div className="w-4 h-4 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin" />
                        Loading...
                      </div>
                    ) : patient ? (
                      <div className="space-y-2.5">
                        {/* Name + Patient ID header */}
                        <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0 text-sky-700 font-bold text-sm select-none">
                            {`${patient.first_name?.[0] ?? ''}${patient.last_name?.[0] ?? ''}`.toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 leading-tight">{patient.full_name}</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5"># {patient.patient_number}</p>
                          </div>
                        </div>

                        {/* Email */}
                        {patient.email && (
                          <div className="pt-1 border-t border-gray-100">
                            <div className="flex items-center gap-1 mb-0.5">
                              <Mail className="w-3 h-3 text-gray-400" />
                              <p className="text-xs text-gray-500">Email</p>
                            </div>
                            <p className="text-sm font-medium text-gray-900 truncate">{patient.email}</p>
                          </div>
                        )}

                        {/* Phone */}
                        {patient.phone && (
                          <div className="pt-1 border-t border-gray-100">
                            <div className="flex items-center gap-1 mb-0.5">
                              <Phone className="w-3 h-3 text-gray-400" />
                              <p className="text-xs text-gray-500">Phone</p>
                            </div>
                            <p className="text-sm font-medium text-gray-900">{patient.phone}</p>
                          </div>
                        )}

                        {/* Gender */}
                        {patient.gender && (
                          <div className="pt-1 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-0.5">Gender</p>
                            <p className="text-sm font-medium text-gray-900">{patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : 'Other'}</p>
                          </div>
                        )}

                        {/* Date of Birth */}
                        {patient.date_of_birth && (
                          <div className="pt-1 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-0.5">Date of Birth</p>
                            <p className="text-sm font-medium text-gray-900">
                              {format(new Date(patient.date_of_birth), 'MMM d, yyyy')} ({patient.age} yrs)
                            </p>
                          </div>
                        )}

                        {/* Address */}
                        {patient.address && (
                          <div className="pt-1 border-t border-gray-100">
                            <div className="flex items-center gap-1 mb-0.5">
                              <Home className="w-3 h-3 text-gray-400" />
                              <p className="text-xs text-gray-500">Address</p>
                            </div>
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">
                              {patient.city && patient.province
                                ? `${patient.address}, ${patient.city}, ${patient.province}`
                                : patient.address}
                            </p>
                          </div>
                        )}

                        {patient.philhealth_number && (
                          <div className="pt-1 border-t border-gray-100">
                            <div className="flex items-center gap-1 mb-0.5">
                              <ShieldCheck className="w-3 h-3 text-gray-400" />
                              <p className="text-xs text-gray-500">PhilHealth</p>
                            </div>
                            <p className="text-sm font-medium text-gray-900">{patient.philhealth_number}</p>
                          </div>
                        )}

                        {patient.medical_conditions && (
                          <div className="pt-1 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-0.5">Medical Conditions</p>
                            <p className="text-sm font-medium text-gray-900 line-clamp-3">{patient.medical_conditions}</p>
                          </div>
                        )}

                        {patient.allergies && (
                          <div className="pt-1 border-t border-gray-100">
                            <div className="flex items-center gap-1 mb-0.5">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <p className="text-xs text-gray-500">Allergies</p>
                            </div>
                            <p className="text-sm font-medium text-gray-900 line-clamp-3">{patient.allergies}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Fallback to appointment.patient_name */}
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Patient Name</p>
                          <p className="text-sm font-medium text-gray-900">{appointment.patient_name}</p>
                        </div>
                        <div className="pt-4 text-xs text-gray-400 italic">
                          Additional details unavailable
                        </div>
                      </div>
                    )}

                    {patient && (
                      <div className="pt-4 mt-4 border-t border-gray-100">
                        <button
                          onClick={handleViewFullProfile}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Full Profile
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Column 2: Case Details ── */}
                  <ClinicalCaseWorkspace
                    ref={caseWorkspaceRef}
                    appointment={appointment}
                    patientCases={patientCases}
                    practitioners={practitioners}
                    loadingPractitioners={loadingPractitioners}
                    onCasesChanged={() => setCasesVersion(v => v + 1)}
                    onDirtyChange={setCaseDirty}
                  />

                  {/* ── Column 3: Appointment Details ── */}
                  <InlineAppointmentCard
                    ref={inlineApptRef}
                    appointment={appointment}
                    practitioners={practitioners}
                    loadingPractitioners={loadingPractitioners}
                    isTerminal={isTerminal}
                    onSaved={handleInlineApptSaved}
                    queryClient={queryClient}
                    onDirtyChange={setApptDirty}
                  />
                </div>

                {(caseDirty || (apptDirty && !isTerminal)) && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleSaveAll}
                      disabled={isSavingAll}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white text-sm font-semibold rounded-xl hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      {isSavingAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {isSavingAll ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Appointment Tab ── */}
            {activeTab === 'appointment' && (
              <div className="space-y-4">

                {isCancelled && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm font-semibold text-red-700">This appointment has been cancelled.</p>
                    </div>
                    {appointment.cancellation_reason && (
                      <p className="text-xs text-red-600 pl-6">
                        Reason: {appointment.cancellation_reason}
                      </p>
                    )}
                    {appointment.cancelled_at && (
                      <p className="text-xs text-red-500 pl-6">
                        Cancelled on {format(new Date(appointment.cancelled_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    )}
                  </div>
                )}

                {isEditing ? (
                  <AppointmentEditForm
                    appointment={appointment}
                    practitioners={practitioners}
                    loadingPractitioners={loadingPractitioners}
                    isSaving={isSaving}
                    isDirty={isDirty}
                    editError={editError}
                    onSave={handleSaveEdit}
                    onCancel={cancelEdit}
                    onMarkDirty={markDirty}
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                        {appointment.status.replace('_', ' ')}
                      </span>
                      <span className="text-gray-300 text-sm">·</span>
                      {serviceColor ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: serviceColor }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                          {typeLabel}
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-gray-600">{typeLabel}</span>
                      )}
                    </div>

                    <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-sky-600 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-sky-600 font-medium">Date</p>
                            <p className="text-sm font-semibold text-gray-900">{formattedDate}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-sky-600 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-sky-600 font-medium">Time</p>
                            <p className="text-sm font-semibold text-gray-900">{formattedTime}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-sky-600 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-sky-600 font-medium">Duration</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {formatDuration((() => { const [sH,sM] = appointment.start_time.split(':').map(Number); const [eH,eM] = appointment.end_time.split(':').map(Number); return Math.max((eH*60+eM)-(sH*60+sM), 15); })())}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <User className="w-4 h-4 text-sky-600" />
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Patient</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{appointment.patient_name}</p>
                      </div>
                      <div className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <User className="w-4 h-4 text-sky-600" />
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Practitioner</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">
                          {appointment.practitioner_name ?? (
                            <span className="text-gray-400 font-normal italic">Unassigned</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {appointment.location_name && (
                      <div className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <MapPin className="w-4 h-4 text-sky-600" />
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</span>
                        </div>
                        <p className="text-sm text-gray-900">{appointment.location_name}</p>
                      </div>
                    )}

                    {appointment.chief_complaint ? (
                      <div className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <FileText className="w-4 h-4 text-sky-600" />
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chief Complaint</span>
                        </div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{appointment.chief_complaint}</p>
                      </div>
                    ) : (
                      !isTerminal && (
                        <div className="border border-dashed border-gray-200 rounded-xl p-4 text-center">
                          <p className="text-xs text-gray-400">No chief complaint recorded.</p>
                        </div>
                      )
                    )}

                    {appointment.notes ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <FileText className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Internal Notes</span>
                          <span className="text-xs text-amber-500">(Staff Only)</span>
                        </div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{appointment.notes}</p>
                      </div>
                    ) : null}

                    {appointment.patient_notes ? (
                      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <FileText className="w-4 h-4 text-sky-600" />
                          <span className="text-xs font-semibold text-sky-700 uppercase tracking-wide">Patient Notes</span>
                          <span className="text-xs text-sky-500">(Visible to Patient)</span>
                        </div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{appointment.patient_notes}</p>
                      </div>
                    ) : null}

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                      {[
                        { label: 'Created by', value: appointment.created_by_name || 'Unknown' },
                        { label: 'Created at', value: format(new Date(appointment.created_at), 'MMM d, yyyy h:mm a') },
                        ...(appointment.updated_by_name ? [
                          { label: 'Last updated by', value: appointment.updated_by_name },
                          { label: 'Updated at',      value: format(new Date(appointment.updated_at), 'MMM d, yyyy h:mm a') },
                        ] : []),
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">{label}</span>
                          <span className="text-xs font-medium text-gray-900">{value}</span>
                        </div>
                      ))}
                    </div>

                  </>
                )}
              </div>
            )}

            {/* ── Status Tab ── */}
            {activeTab === 'status' && (
              <div className="space-y-4">
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide mb-3">
                    Appointment Status
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Current Status</span>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
                        {appointment.status.replace('_', ' ')}
                      </span>
                    </div>
                    {/* Arrival Status Dropdown */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Arrival Status</span>
                      <select
                        value={appointment.arrival_status || 'NO_STATUS'}
                        onChange={async (e) => {
                          const newStatus = e.target.value as 'NO_STATUS' | 'ARRIVED' | 'DNA';
                          // Optimistic UI: immediately show the new selection in the dropdown
                          // so there's no visual lag while the API call is in flight.
                          try {
                            const updated = await apiEditAppointment(appointment.id, { arrival_status: newStatus });
                            // 1. Update local AppointmentView state so badge, banner, and
                            //    DNA section reflect the new value immediately.
                            setAppointment(updated);
                            // 2. Propagate to Calendar's updateAppointmentInState so every
                            //    card (Day/Week/Month) re-renders with the correct color.
                            onUpdated?.(updated);
                            // 3. Invalidate React-Query caches so any query-based consumers
                            //    (arrivals list, appointment detail queries) refetch fresh data.
                            queryClient.invalidateQueries({ queryKey: ['today-arrivals'] });
                            // Broad invalidation: covers any cached appointment list that may
                            // have been fetched via useQuery (e.g. patient appointment history).
                            queryClient.invalidateQueries({ queryKey: ['appointments'] });

                            const statusLabel = newStatus === 'ARRIVED' ? 'Arrived'
                              : newStatus === 'DNA' ? 'Did Not Arrive'
                              : 'No Status';
                            toast.success(`Arrival status updated → ${statusLabel}`);
                          } catch (err) {
                            console.error('Failed to update arrival status:', err);
                            toast.error('Failed to update arrival status. Please try again.');
                          }
                        }}
                        className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="NO_STATUS">No Status</option>
                        <option value="ARRIVED">Arrived</option>
                        <option value="DNA">Did Not Arrive (DNA)</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Created By</span>
                      <span className="text-sm font-medium text-gray-800">{appointment.created_by_name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Created At</span>
                      <span className="text-sm font-medium text-gray-800">{format(new Date(appointment.created_at), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                    {appointment.updated_by_name && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Last Updated By</span>
                          <span className="text-sm font-medium text-gray-800">{appointment.updated_by_name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Updated At</span>
                          <span className="text-sm font-medium text-gray-800">{format(new Date(appointment.updated_at), 'MMM d, yyyy h:mm a')}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {/* ── DNA Banner ── */}
                {isDNA && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm font-semibold text-red-700">Did Not Arrive (DNA)</p>
                    </div>
                    <p className="text-xs text-red-600 pl-6">
                      This appointment was marked as Did Not Arrive.
                      The calendar block and diary view are displayed in red.
                    </p>
                    {appointment.dna_followup_sent ? (
                      <div className="flex items-center gap-1.5 pl-6">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                        <p className="text-xs text-green-700 font-medium">
                          Reschedule notification sent to patient
                          {appointment.dna_followup_sent_at
                            ? ` on ${format(new Date(appointment.dna_followup_sent_at), 'MMM d, yyyy h:mm a')}`
                            : ''}.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 pl-6">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400" />
                        <p className="text-xs text-gray-500">No follow-up notification sent.</p>
                      </div>
                    )}
                  </div>
                )}
                {isCancelled && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm font-semibold text-red-700">This appointment has been cancelled.</p>
                    </div>
                    {appointment.cancellation_reason && (
                      <p className="text-xs text-red-600 pl-6">
                        Reason: {appointment.cancellation_reason}
                      </p>
                    )}
                    {appointment.cancelled_at && (
                      <p className="text-xs text-red-500 pl-6">
                        Cancelled on {format(new Date(appointment.cancelled_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Invoice Tab ── */}
            {activeTab === 'invoice' && (
              <InvoiceTab appointment={appointment} />
            )}

            {/* ── Clinical Notes Tab ── */}
            {activeTab === 'clinical_notes' && (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-gray-500">Redirecting to Clinical Notes...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <CancelAppointmentModal
        isOpen={showCancelModal}
        appointment={appointment}
        isCancelling={isCancelling}
        cancelError={cancelError}
        onConfirm={handleCancelAppointment}
        onClose={() => setShowCancelModal(false)}
      />

      <AddRecurringAppointments
        isOpen={showRecurringModal}
        appointment={appointment}
        onClose={() => setShowRecurringModal(false)}
        onSave={async (data) => {
          try {
            const result = await createRecurringAppointments({
              service_id: data.service_id,
              duration_minutes: data.duration_minutes,
              frequency: data.frequency,
              repetitions: data.repetitions,
              selected_days: data.selected_days,
              start_date: data.start_date,
              practitioner_id: data.practitioner_id,
              start_time: data.start_time,
              patient_id: appointment!.patient,
              clinic_id: appointment!.clinic,
            });
            toast.success(`${result.created} recurring appointment(s) created!`);
            onRecurringCreated?.();
            setShowRecurringModal(false);
          } catch (error: any) {
            console.error('Failed to create recurring appointments:', error);
            toast.error(error.response?.data?.error || 'Failed to create recurring appointments');
          }
        }}
      />
    </>
  );
};
