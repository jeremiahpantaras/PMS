import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Calendar, Clock, Timer, User, FileText,
  AlertCircle, UserPlus, Stethoscope, Building2, Lock,
} from 'lucide-react';
import { format } from 'date-fns';
import { getPatients, createPatient } from '@/features/patients/patient.api';
import { PatientModal } from '@/features/patients/components/PatientModal';
import { createAppointment } from '../appointment.api';
import { ServiceSelector } from './ServiceSelector';
import { usePractitioners } from '@/features/clinics/hooks/usePractitioners';
import { useAppointmentServices } from '../hooks/useAppointmentServices';
import { useClinicBranches } from '@/features/clinics/hooks/useClinicBranches';   // ← ADD
import { useAuthStore } from '@/store/auth.store';
import type { Patient, CreateAppointmentData, CreatePatientData, Appointment } from '@/types';
import toast from 'react-hot-toast';

interface AppointmentModalProps {
  isOpen:                  boolean;
  onClose:                 () => void;
  onCreated?:              (appointment: Appointment) => void;
  selectedSlot: {
    date:     Date;
    time:     string;
    hour:     number;
    minutes:  number;
    duration: number;
  } | null;
  selectedClinicBranchId?:  number | null;
  /** Pre-select the practitioner from the active calendar filter. The user can still change it. */
  defaultPractitionerId?:   number | null;
  /** Pre-select the patient from SelectOptionModal search. */
  defaultPatientId?:       number | null;
}

interface FormData {
  patient:      number | '';
  practitioner: number | '';
  service:      number | '';
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  selectedSlot,
  selectedClinicBranchId,
  defaultPractitionerId,
  defaultPatientId,
}) => {
  const { user } = useAuthStore();

  const [patients,        setPatients]        = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [errors,          setErrors]          = useState<Record<string, string>>({});
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [chiefComplaint,  setChiefComplaint]  = useState('');
  const [notes,           setNotes]           = useState('');
  const [patientNotes,    setPatientNotes]    = useState('');

  const [formData, setFormData] = useState<FormData>({
    patient:      '',
    practitioner: '',
    service:      '',
  });

  // Filter practitioners by selected branch
  const { practitioners, loading: loadingPractitioners } = usePractitioners({
    clinicBranchId: selectedClinicBranchId ?? null,   // ← ADD: filter by branch
  });

  // Only PRACTITIONER-role users are bookable in appointment forms.
  const bookablePractitioners = useMemo(
    () => practitioners.filter(p =>
      (p.roles ?? []).includes('PRACTITIONER') || p.role === 'PRACTITIONER'
    ),
    [practitioners],
  );
  // Derive discipline from the selected practitioner (handles locked practitioner case)
  const selectedPractitionerObj = useMemo(
    () => practitioners.find(p => p.id == formData.practitioner) ?? null,
    [practitioners, formData.practitioner],
  );

  // Compute effective discipline for service filtering.
  // Priority: locked practitioner's discipline > selected practitioner's discipline.
  // This ensures discipline filtering works even while practitioners are still loading.
  const effectiveDiscipline = useMemo(() => {
    if (defaultPractitionerId) {
      // Use loose equality to handle string/number ID mismatch from API
      const lockedPrac = practitioners.find(p => p.id == defaultPractitionerId);
      if (lockedPrac?.discipline) return lockedPrac.discipline;
    }
    return selectedPractitionerObj?.discipline ?? null;
  }, [defaultPractitionerId, practitioners, selectedPractitionerObj]);

  // Load all services, then filter locally by discipline (same pattern as Patient Portal)
  const { services: allServices, loading: loadingServices } = useAppointmentServices();

  const filteredServices = useMemo(() => {
    if (!effectiveDiscipline) return allServices;
    return allServices.filter(s => s.discipline === effectiveDiscipline);
  }, [allServices, effectiveDiscipline]);

  const selectedService   = filteredServices.find(s => s.id === Number(formData.service));
  const effectiveDuration = selectedService?.duration_minutes ?? selectedSlot?.duration ?? 60;

  // Resolve branch name for display
  const { branches } = useClinicBranches();
  const selectedBranchName = branches.find(b => b.id === selectedClinicBranchId)?.name ?? null;

  // Locked practitioner (auto-assigned from calendar filter)
  const isPractitionerLocked = useMemo(() => {
    if (!defaultPractitionerId) return false;
    if (loadingPractitioners) return false;
    return practitioners.some(p => p.id == defaultPractitionerId);
  }, [defaultPractitionerId, practitioners, loadingPractitioners]);

  const lockedPractitioner = useMemo(
    () => (isPractitionerLocked ? practitioners.find(p => p.id == defaultPractitionerId) ?? null : null),
    [isPractitionerLocked, practitioners, defaultPractitionerId],
  );

  useEffect(() => {
    if (isOpen) {
      loadPatients();
      setFormData({
        patient:      defaultPatientId ?? '',
        practitioner: defaultPractitionerId ?? '',
        service:      '',
      });
      setChiefComplaint('');
      setNotes('');
      setPatientNotes('');
      setErrors({});
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // If defaultPatientId changes after patients are loaded, update formData
  useEffect(() => {
    if (defaultPatientId && patients.length > 0) {
      setFormData(prev => ({ ...prev, patient: defaultPatientId }));
    }
  }, [defaultPatientId, patients]);

  const loadPatients = async () => {
    setLoadingPatients(true);
    try {
      const response = await getPatients({ is_active: true, page_size: 1000 });
      setPatients(response.results || []);
    } catch {
      toast.error('Failed to load patients');
    } finally {
      setLoadingPatients(false);
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const parsedValue = value === '' ? '' : Number(value);

    if (name === 'practitioner' && formData.service) {
      const newPracId = parsedValue === '' ? null : parsedValue;
      const newPractitioner = practitioners.find(p => p.id == newPracId);
      const currentService = allServices.find(s => s.id === Number(formData.service));
      if (
        newPractitioner &&
        currentService &&
        newPractitioner.discipline !== undefined &&
        currentService.discipline !== newPractitioner.discipline
      ) {
        setFormData(prev => ({ ...prev, [name as keyof FormData]: parsedValue, service: '' }));
        setErrors(prev => ({ ...prev, service: '' }));
        return;
      }
    }

    setFormData(prev => ({ ...prev, [name as keyof FormData]: parsedValue }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.patient) errs.patient = 'Please select a patient.';
    if (!formData.service) errs.service = 'Please select a service / appointment type.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !selectedSlot || !user?.clinic) return;

    setSaving(true);
    try {
      const startH = selectedSlot.hour;
      const startM = selectedSlot.minutes;
      const endMin = startH * 60 + startM + effectiveDuration;
      const endH   = Math.floor(endMin / 60);
      const endMm  = endMin % 60;

      // ── Derive clinic/branch from selected practitioner first,
      //    then fall back to the active diary branch tab,
      //    then fall back to user's own clinic. ──────────────────────────────
      const selectedPractitionerForSubmit = formData.practitioner
        ? practitioners.find(p => p.id == formData.practitioner)
        : null;

      const clinicId =
        selectedPractitionerForSubmit?.clinic_branch_id   // practitioner's assigned branch
        ?? selectedClinicBranchId                   // active diary tab branch
        ?? user.clinic;                             // user's clinic fallback

      const data: CreateAppointmentData = {
        clinic:           clinicId,
        patient:          Number(formData.patient),
        service:          Number(formData.service),
        ...(formData.practitioner && { practitioner: Number(formData.practitioner) }),
        appointment_type: 'INITIAL',
        date:             format(selectedSlot.date, 'yyyy-MM-dd'),
        start_time:       `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
        end_time:         `${String(endH).padStart(2, '0')}:${String(endMm).padStart(2, '0')}`,
        duration_minutes: effectiveDuration,
        chief_complaint:  chiefComplaint,
        notes,
        patient_notes:    patientNotes,
      };

      const created = await createAppointment(data);
      toast.success('Appointment created successfully!');
      onCreated?.(created);
      handleClose();
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to create appointment'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setFormData({ patient: '', practitioner: '', service: '' });
    setChiefComplaint('');
    setNotes('');
    setPatientNotes('');
    setErrors({});
    onClose();
  };

  const handlePatientSave = async (data: CreatePatientData) => {
    const newPatient = await createPatient(data);
    setPatients(prev => [...prev, newPatient]);
    setFormData(prev => ({ ...prev, patient: newPatient.id }));
  };

  const handleCreatePatient = () => {
    setShowPatientModal(true);
  };

  if (!isOpen || !selectedSlot) return null;

  const fmt12 = (h: number, m: number) => {
    const h12 = h > 12 ? h - 12 : h || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };
  const endMin = selectedSlot.hour * 60 + selectedSlot.minutes + effectiveDuration;
  const endH   = Math.floor(endMin / 60);
  const endMm  = endMin % 60;

  const fmtDuration = (min: number) => {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  const inputBase  = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent';
  const inputError = 'border-red-300 bg-red-50';

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-md transition-opacity duration-300"
        onClick={handleClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl pointer-events-auto max-h-[90vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">New Appointment</h2>
                <p className="text-xs text-gray-500">
                  {selectedBranchName
                    ? <>Scheduling at <span className="font-semibold text-sky-600">{selectedBranchName}</span></>
                    : 'Schedule a new appointment'
                  }
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Close modal">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

              {/* Slot summary */}
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 text-sky-700">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium">{format(selectedSlot.date, 'EEEE, MMMM d, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sky-700">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium">{fmt12(selectedSlot.hour, selectedSlot.minutes)} – {fmt12(endH, endMm)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sky-700">
                    <Timer className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium">{fmtDuration(effectiveDuration)}</span>
                  </div>
                </div>

                {/* Branch indicator */}
                {selectedBranchName && (
                  <div className="mt-3 pt-3 border-t border-sky-100 flex items-center gap-2 text-sky-600">
                    <Building2 className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs font-semibold">{selectedBranchName}</span>
                  </div>
                )}
              </div>

              {/* ── Service ── */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Service / Consultation Type <span className="text-red-500">*</span>
                </label>
                {filteredServices.length === 0 && !loadingServices ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800 mb-1">No services configured</p>
                        <p className="text-xs text-amber-700">Ask an admin to add clinic services under <strong>Setup → Clinic Services</strong>.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <ServiceSelector
                    services={filteredServices}
                    value={formData.service}
                    onChange={(id) => {
                      setFormData(prev => ({ ...prev, service: id }));
                      if (errors.service) setErrors(prev => ({ ...prev, service: '' }));
                    }}
                    loading={loadingServices}
                    error={errors.service}
                  />
                )}
              </div>

              {/* ── Patient ── */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Patient / Client <span className="text-red-500">*</span>
                </label>
                {loadingPatients ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-sky-600 border-t-transparent" />
                  </div>
                ) : patients.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800 mb-1">No patients found</p>
                        <p className="text-xs text-amber-700 mb-3">Create a patient before scheduling an appointment.</p>
                        <button type="button" onClick={handleCreatePatient} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
                          <UserPlus className="w-3.5 h-3.5" />
                          Create New Patient
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select name="patient" value={formData.patient} onChange={handleSelectChange} className={`${inputBase} pl-9 ${errors.patient ? inputError : ''}`}>
                        <option value="">Select a patient…</option>
                        {patients.map(p => (
                          <option key={p.id} value={p.id}>{p.full_name} — {p.patient_number}</option>
                        ))}
                      </select>
                    </div>
                    {errors.patient && <p className="mt-1 text-xs text-red-600">{errors.patient}</p>}
                    <button type="button" onClick={handleCreatePatient} className="mt-2 inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium">
                      <UserPlus className="w-3.5 h-3.5" />
                      Create new patient
                    </button>
                  </>
                )}
              </div>

              {/* ── Practitioner ── */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Assigned Practitioner
                  {isPractitionerLocked ? (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-sky-600">
                      <Lock className="w-3 h-3" />
                      Auto-assigned from filter
                    </span>
                  ) : (
                    <span className="ml-2 text-xs font-normal text-gray-400">Select to Assign</span>
                  )}
                </label>
                {loadingPractitioners ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-sky-600 border-t-transparent" />
                  </div>
                ) : isPractitionerLocked && lockedPractitioner ? (
                  /* ── Read-only display when auto-filled from calendar filter ── */
                  <div className="relative flex items-center gap-3 px-3 py-2.5 bg-sky-50 border border-sky-200 rounded-lg">
                    <Stethoscope className="w-4 h-4 text-sky-500 shrink-0" />
                    <span className="flex-1 text-sm font-medium text-sky-900">
                      {lockedPractitioner.name}
                      {lockedPractitioner.specialization && (
                        <span className="ml-1 font-normal text-sky-600">— {lockedPractitioner.specialization}</span>
                      )}
                    </span>
                    <Lock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  </div>
                ) : (
                  <div className="relative">
                    <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select name="practitioner" value={formData.practitioner} onChange={handleSelectChange} className={`${inputBase} pl-9`}>
                      <option value="">Unassigned</option>
                      {bookablePractitioners.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.specialization && ` — ${p.specialization}`}</option>
                      ))}
                    </select>
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  {isPractitionerLocked
                    ? 'Practitioner is set by the active calendar filter.'
                    : bookablePractitioners.length === 0
                      ? selectedClinicBranchId
                        ? 'No practitioners assigned to this branch.'
                        : 'No practitioners available. Contact admin to add practitioners.'
                      : 'Select a practitioner or leave unassigned to assign later.'}
                </p>
              </div>

              {/* ── Chief Complaint ── */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Chief Complaint</label>
                <textarea value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} rows={2} className={`${inputBase} resize-none`} placeholder="Primary reason for visit…" />
              </div>

              {/* ── Internal Notes ── */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Internal Notes <span className="ml-2 text-xs font-normal text-gray-400">(Staff only)</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${inputBase} pl-9 resize-none`} placeholder="Internal notes for staff…" />
                </div>
              </div>

              {/* ── Patient Notes ── */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Patient Notes <span className="ml-2 text-xs font-normal text-gray-400">(Visible to patient)</span>
                </label>
                <textarea value={patientNotes} onChange={e => setPatientNotes(e.target.value)} rows={2} className={`${inputBase} resize-none`} placeholder="Notes for patient…" />
              </div>

              {user && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Created by: <span className="font-medium text-gray-700">{user.first_name} {user.last_name}</span></span>
                    <span className="text-gray-400">{format(new Date(), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <button type="button" onClick={handleClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={saving || filteredServices.length === 0 || patients.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <><div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />Saving…</>
              ) : (
                <><Calendar className="w-3.5 h-3.5" />Create Appointment</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Inline Create Patient ── */}
      {showPatientModal && (
        <PatientModal
          isOpen={showPatientModal}
          onClose={() => setShowPatientModal(false)}
          onSave={handlePatientSave}
          mode="create"
        />
      )}
    </>
  );
};