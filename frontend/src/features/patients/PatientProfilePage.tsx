import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Archive,
  ArchiveRestore,
  CheckCircle,
  Edit,
  Heart,
  Loader2,
  MapPin,
  Phone,
  Settings,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { archivePatient, restorePatient, updatePatient } from './patient.api';
import { PatientModal } from './components/PatientModal';
import { usePatientProfileContext } from './context/PatientProfileContext';
import { listPatientCases } from './patientCases.storage';
import {
  formatDate,
  formatDateTime,
  getAppointmentIdsWithNotes,
  getGenderLabel,
  getPatientProfileStats,
} from './patientProfile.utils.tsx';
import type { CreatePatientData } from '@/types';

interface InfoRowProps {
  label: string;
  value: string;
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmDisabled?: boolean;
  confirmClassName: string;
  icon: ReactNode;
  iconBg: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface PatientSettingsDraft {
  send_email_notifications: boolean;
  sms_notifications_enabled: boolean;
  allow_push_notifications: boolean;
  data_sharing_preferences: Record<string, unknown>;
}

const buildSettingsDraft = (patient?: {
  send_email_notifications?: boolean;
  sms_notifications_enabled?: boolean;
  allow_push_notifications?: boolean;
  data_sharing_preferences?: Record<string, unknown>;
}): PatientSettingsDraft => {
  return {
    send_email_notifications: patient?.send_email_notifications ?? true,
    sms_notifications_enabled: patient?.sms_notifications_enabled ?? false,
    allow_push_notifications: patient?.allow_push_notifications ?? false,
    data_sharing_preferences: patient?.data_sharing_preferences ?? {},
  };
};

const InfoRow = ({ label, value }: InfoRowProps) => (
  <div>
    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
    <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
  </div>
);

const ConfirmDialog = ({
  title,
  message,
  confirmLabel,
  confirmDisabled = false,
  confirmClassName,
  icon,
  iconBg,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <>
    <div className="fixed inset-0 bg-black/50 z-50" onClick={onCancel} />
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center mx-auto mb-4`}>{icon}</div>
          <h3 className="text-base font-bold text-gray-900 text-center mb-2">{title}</h3>
          <p className="text-sm text-gray-600 text-center">{message}</p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  </>
);

export const PatientProfilePage = () => {
  const {
    patient,
    appointments,
    clinicalNotes,
    loadingPatient,
    refreshPatient,
  } = usePatientProfileContext();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [settings, setSettings] = useState<PatientSettingsDraft>(() => buildSettingsDraft());
  const [originalSettings, setOriginalSettings] = useState<PatientSettingsDraft>(() => buildSettingsDraft());

  useEffect(() => {
    if (!patient) return;

    const next = buildSettingsDraft(patient);
    setSettings(next);
    setOriginalSettings(next);
  }, [patient]);

  const appointmentIdsWithNotes = useMemo(() => getAppointmentIdsWithNotes(clinicalNotes), [clinicalNotes]);

  const stats = useMemo(
    () => getPatientProfileStats(appointments, appointmentIdsWithNotes),
    [appointments, appointmentIdsWithNotes]
  );

  const caseCount = useMemo(() => {
    if (!patient) return 0;
    return listPatientCases(patient.id).length;
  }, [patient]);

  const hasSettingsChanged = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const cards = [
    {
      title: 'Card 1',
      subtitle: 'Total Sessions',
      value: stats.total,
      valueClass: 'text-gray-900',
      bgClass: 'bg-white border-gray-200',
    },
    {
      title: 'Card 2',
      subtitle: 'Completed',
      value: stats.completed,
      valueClass: 'text-green-700',
      bgClass: 'bg-green-50 border-green-200',
    },
    {
      title: 'Card 3',
      subtitle: 'Upcoming',
      value: stats.upcoming,
      valueClass: 'text-sky-700',
      bgClass: 'bg-sky-50 border-sky-200',
    },
    {
      title: 'Card 4',
      subtitle: 'Unfinished Notes',
      value: stats.unfinished,
      valueClass: 'text-orange-700',
      bgClass: 'bg-orange-50 border-orange-200',
    },
    {
      title: 'Card 5',
      subtitle: 'Active Cases',
      value: caseCount,
      valueClass: 'text-purple-700',
      bgClass: 'bg-purple-50 border-purple-200',
    },
  ];

  const handleSavePatient = async (data: CreatePatientData) => {
    if (!patient) return;

    try {
      await updatePatient(patient.id, data);
      toast.success('Client updated successfully');
      setIsEditModalOpen(false);
      await refreshPatient();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to update client');
      throw error;
    }
  };

  const handleSaveSettings = async () => {
    if (!patient) return;

    setIsSavingSettings(true);
    try {
      await updatePatient(patient.id, {
        send_email_notifications: settings.send_email_notifications,
        sms_notifications_enabled: settings.sms_notifications_enabled,
        allow_push_notifications: settings.allow_push_notifications,
        data_sharing_preferences: settings.data_sharing_preferences,
      } as Partial<CreatePatientData>);

      toast.success('Settings saved successfully');
      setOriginalSettings(settings);
      await refreshPatient();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleArchive = async () => {
    if (!patient) return;

    setArchiveLoading(true);
    try {
      await archivePatient(patient.id);
      toast.success(`${patient.full_name} has been archived.`);
      setShowArchiveConfirm(false);
      await refreshPatient();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to archive patient');
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!patient) return;

    setArchiveLoading(true);
    try {
      await restorePatient(patient.id);
      toast.success(`${patient.full_name} has been restored.`);
      setShowRestoreConfirm(false);
      await refreshPatient();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to restore patient');
    } finally {
      setArchiveLoading(false);
    }
  };

  if (loadingPatient || !patient) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-2xl border border-gray-200">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-sky-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading patient profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-heading text-gray-900">Patient Profile</h1>
              <p className="text-sm text-gray-500 mt-1">
                {patient.full_name} • {patient.patient_number}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {patient.is_archived ? (
                <button
                  onClick={() => setShowRestoreConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-sky-700 bg-sky-50 rounded-lg hover:bg-sky-100 transition-colors"
                >
                  <ArchiveRestore className="w-4 h-4" />
                  Restore
                </button>
              ) : (
                <button
                  onClick={() => setShowArchiveConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
              )}

              <button
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-sky-700 bg-sky-50 rounded-lg hover:bg-sky-100 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit Profile
              </button>
            </div>
          </div>
        </div>

        {patient.is_archived && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-800">
              This client is archived and hidden from the diary.
              {patient.archived_by_name && ` Archived by ${patient.archived_by_name}.`}
              {patient.archived_at && ` on ${formatDate(patient.archived_at)}.`}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          {cards.map((card) => (
            <div key={card.title} className={`${card.bgClass} border rounded-xl p-4`}>
              <p className="text-[11px] text-gray-500 mb-1">{card.title}</p>
              <p className={`text-2xl font-bold ${card.valueClass}`}>{card.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.subtitle}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-semibold text-gray-700">Personal Information</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="First Name" value={patient.first_name} />
              <InfoRow label="Last Name" value={patient.last_name} />
              <InfoRow label="Date of Birth" value={formatDate(patient.date_of_birth)} />
              <InfoRow label="Gender" value={getGenderLabel(patient.gender)} />
              <InfoRow label="Age" value={`${patient.age} years old`} />
              <InfoRow label="Status" value={patient.is_active ? 'Active' : 'Inactive'} />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-semibold text-gray-700">Contact Information</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Phone" value={patient.phone || '—'} />
              <InfoRow label="Email" value={patient.email || '—'} />
              <InfoRow label="City" value={patient.city || '—'} />
              <InfoRow label="Province" value={patient.province || '—'} />
              <InfoRow label="Postal Code" value={patient.postal_code || '—'} />
              <InfoRow label="Address" value={patient.address || '—'} />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-semibold text-gray-700">Emergency Contact</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InfoRow label="Name" value={patient.emergency_contact_name || '—'} />
              <InfoRow label="Phone" value={patient.emergency_contact_phone || '—'} />
              <InfoRow label="Relationship" value={patient.emergency_contact_relationship || '—'} />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-semibold text-gray-700">Medical Information</h3>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InfoRow label="PhilHealth #" value={patient.philhealth_number || '—'} />
                <InfoRow label="HMO Provider" value={patient.hmo_provider || '—'} />
                <InfoRow label="HMO #" value={patient.hmo_number || '—'} />
              </div>
              <InfoRow label="Medical Conditions" value={patient.medical_conditions || 'None reported'} />
              <InfoRow label="Allergies" value={patient.allergies || 'None reported'} />
              <InfoRow label="Current Medications" value={patient.medications || 'None reported'} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-sky-600" />
            <h3 className="text-sm font-semibold text-gray-700">Notification Settings</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Send email notifications automatically?</p>
                <p className="text-xs text-gray-500 mt-0.5">Enable automatic email reminders for appointments.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.send_email_notifications}
                  onChange={(e) => setSettings((prev) => ({ ...prev, send_email_notifications: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-sky-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:bg-white after:border after:border-gray-300 after:rounded-full after:transition-all" />
              </label>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">SMS notifications</p>
                <p className="text-xs text-gray-500 mt-0.5">Receive appointment reminders via text message.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.sms_notifications_enabled}
                  onChange={(e) => setSettings((prev) => ({ ...prev, sms_notifications_enabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-sky-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:bg-white after:border after:border-gray-300 after:rounded-full after:transition-all" />
              </label>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Allow push notifications</p>
                <p className="text-xs text-gray-500 mt-0.5">Coming soon.</p>
              </div>
              <label className="relative inline-flex items-center cursor-not-allowed opacity-60">
                <input
                  type="checkbox"
                  checked={settings.allow_push_notifications}
                  disabled
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:bg-white after:border after:border-gray-300 after:rounded-full after:transition-all" />
              </label>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={handleSaveSettings}
                disabled={isSavingSettings || !hasSettingsChanged}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  hasSettingsChanged
                    ? 'text-white bg-sky-600 hover:bg-sky-700'
                    : 'text-gray-500 bg-gray-100 cursor-not-allowed'
                } ${isSavingSettings ? 'opacity-60' : ''}`}
              >
                {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 px-1">
          <span>Created: {formatDateTime(patient.created_at)}</span>
          <span>Last Updated: {formatDateTime(patient.updated_at)}</span>
        </div>
      </div>

      <PatientModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSavePatient}
        patient={patient}
        mode="edit"
      />

      {showArchiveConfirm && (
        <ConfirmDialog
          title="Archive Client"
          message={`Archive ${patient.full_name}? Their appointments will be hidden from the diary until restored.`}
          confirmLabel={archiveLoading ? 'Archiving...' : 'Archive'}
          confirmDisabled={archiveLoading}
          confirmClassName="bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
          icon={<Archive className="w-6 h-6 text-amber-600" />}
          iconBg="bg-amber-100"
          onConfirm={handleArchive}
          onCancel={() => setShowArchiveConfirm(false)}
        />
      )}

      {showRestoreConfirm && (
        <ConfirmDialog
          title="Restore Client"
          message={`Restore ${patient.full_name}? They and their appointments will become visible again.`}
          confirmLabel={archiveLoading ? 'Restoring...' : 'Restore'}
          confirmDisabled={archiveLoading}
          confirmClassName="bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50"
          icon={<ArchiveRestore className="w-6 h-6 text-sky-600" />}
          iconBg="bg-sky-100"
          onConfirm={handleRestore}
          onCancel={() => setShowRestoreConfirm(false)}
        />
      )}
    </>
  );
};

export default PatientProfilePage;
