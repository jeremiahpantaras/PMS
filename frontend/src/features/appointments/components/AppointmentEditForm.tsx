import React, { useState, useEffect } from 'react';
import { Save, XCircle, AlertCircle, Layers } from 'lucide-react';
import type { Appointment } from '@/types';
import type { AppointmentEditPayload } from '../appointment.api';
import { useAppointmentServices } from '../hooks/useAppointmentServices';

interface Practitioner {
  id:             number | string;
  name:           string;
  specialization: string | null;
  role?:          string;
  roles?:         string[];
}

interface AppointmentEditFormProps {
  appointment:          Appointment;
  practitioners:        Practitioner[];
  loadingPractitioners: boolean;
  isSaving:             boolean;
  isDirty:              boolean;
  editError:            string | null;
  onSave:               (payload: AppointmentEditPayload) => void;
  onCancel:             () => void;
  onMarkDirty:          () => void;
}

export const AppointmentEditForm: React.FC<AppointmentEditFormProps> = ({
  appointment,
  practitioners,
  loadingPractitioners,
  isSaving,
  isDirty,
  editError,
  onSave,
  onCancel,
  onMarkDirty,
}) => {
  const { services, loading: loadingServices } = useAppointmentServices();

  const [practitioner,   setPractitioner]   = useState<number | ''>(appointment.practitioner ?? '');
  const [service,        setService]        = useState<number | ''>(appointment.service ?? '');
  const [chiefComplaint, setChiefComplaint] = useState(appointment.chief_complaint || '');
  const [notes,          setNotes]          = useState(appointment.notes || '');
  const [patientNotes,   setPatientNotes]   = useState(appointment.patient_notes || '');
  const [arrivalStatus,  setArrivalStatus]  = useState<'NO_STATUS' | 'ARRIVED' | 'DNA'>(appointment.arrival_status || 'NO_STATUS');

  // Reset when a different appointment is opened
  useEffect(() => {
    setPractitioner(appointment.practitioner ?? '');
    setService(appointment.service ?? '');
    setChiefComplaint(appointment.chief_complaint || '');
    setNotes(appointment.notes || '');
    setPatientNotes(appointment.patient_notes || '');
    setArrivalStatus(appointment.arrival_status || 'NO_STATUS');
  }, [appointment.id]);

  const selectedService = services.find(s => s.id === Number(service));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: AppointmentEditPayload = {};

    if (String(practitioner) !== String(appointment.practitioner ?? '')) {
      payload.practitioner = practitioner === '' ? null : Number(practitioner);
    }
    if (String(service) !== String(appointment.service ?? '')) {
      payload.service = service === '' ? null : Number(service);
    }
    if (chiefComplaint !== (appointment.chief_complaint || '')) {
      payload.chief_complaint = chiefComplaint;
    }
    if (notes !== (appointment.notes || '')) {
      payload.notes = notes;
    }
    if (patientNotes !== (appointment.patient_notes || '')) {
      payload.patient_notes = patientNotes;
    }
    if (arrivalStatus !== (appointment.arrival_status || 'NO_STATUS')) {
      payload.arrival_status = arrivalStatus;
    }

    if (Object.keys(payload).length === 0) {
      onCancel();
      return;
    }

    onSave(payload);
  };

  const inputBase = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {editError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{editError}</span>
        </div>
      )}

      {/* ── Service ── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Service / Appointment Type
        </label>
        {loadingServices ? (
          <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-sky-600 border-t-transparent" />
            Loading services…
          </div>
        ) : (
          <>
            <div className="relative">
              <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={service}
                onChange={e => {
                  setService(e.target.value === '' ? '' : Number(e.target.value));
                  onMarkDirty();
                }}
                className={`${inputBase} pl-9`}
              >
                <option value="">— No service selected —</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.duration_minutes ? ` (${s.duration_minutes} min)` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedService && (
              <div
                className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: selectedService.color_hex || '#0D9488' }}
              >
                <span className="w-2 h-2 rounded-full bg-white/70" />
                {selectedService.name}&nbsp;·&nbsp;{selectedService.duration_minutes} min
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Practitioner ── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Practitioner
          <span className="ml-2 text-xs font-normal text-gray-400">(Optional)</span>
        </label>
        {loadingPractitioners ? (
          <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-sky-600 border-t-transparent" />
            Loading practitioners…
          </div>
        ) : (
          <select
            value={practitioner}
            onChange={e => {
              setPractitioner(e.target.value === '' ? '' : Number(e.target.value));
              onMarkDirty();
            }}
            className={inputBase}
          >
            <option value="">Unassigned</option>
            {practitioners.filter(p =>
              (p.roles ?? []).includes('PRACTITIONER') || p.role === 'PRACTITIONER'
            ).map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.specialization && ` — ${p.specialization}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── Chief Complaint ── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Chief Complaint
        </label>
        <textarea
          value={chiefComplaint}
          onChange={e => { setChiefComplaint(e.target.value); onMarkDirty(); }}
          rows={2}
          className={`${inputBase} resize-none`}
          placeholder="Primary reason for visit…"
        />
      </div>

      {/* ── Internal Notes ── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Internal Notes
          <span className="ml-2 text-xs font-normal text-gray-400">(Staff only)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); onMarkDirty(); }}
          rows={2}
          className={`${inputBase} resize-none`}
          placeholder="Notes visible to staff only…"
        />
      </div>

      {/* ── Patient Notes ── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Patient Notes
          <span className="ml-2 text-xs font-normal text-gray-400">(Visible to patient)</span>
        </label>
        <textarea
          value={patientNotes}
          onChange={e => { setPatientNotes(e.target.value); onMarkDirty(); }}
          rows={2}
          className={`${inputBase} resize-none`}
          placeholder="Notes visible to the patient…"
        />
      </div>

      {/* ── Arrival Status (Admin/Staff only) ── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Arrival Status
          <span className="ml-2 text-xs font-normal text-gray-400">(Mark practitioner arrival)</span>
        </label>
        <select
          value={arrivalStatus}
          onChange={e => { setArrivalStatus(e.target.value as 'NO_STATUS' | 'ARRIVED' | 'DNA'); onMarkDirty(); }}
          className={inputBase}
        >
          <option value="NO_STATUS">No Status</option>
          <option value="ARRIVED">Arrived</option>
          <option value="DNA">Did Not Arrive (DNA)</option>
        </select>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <XCircle className="w-3.5 h-3.5" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || !isDirty}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </form>
  );
};