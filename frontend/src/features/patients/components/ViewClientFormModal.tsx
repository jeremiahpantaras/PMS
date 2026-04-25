import { CheckCircle2, Clock, MapPin, Phone, ShieldCheck, User, X, XCircle } from 'lucide-react';
import type { ClientFormRequestRecord } from '../patient.api';
import type { Patient } from '@/types/patient';
import { formatDate, formatDateTime, getGenderLabel } from '../patientProfile.utils.tsx';

interface Props {
  isOpen:  boolean;
  req:     ClientFormRequestRecord;
  patient: Patient;
  onClose: () => void;
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
    <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
  </div>
);

const SectionHeader = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <div className="flex items-center gap-2 mb-3">
    {icon}
    <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
  </div>
);

export const ViewClientFormModal = ({ isOpen, req, patient, onClose }: Props) => {
  if (!isOpen) return null;

  const isCompleted = req.is_completed;
  const isExpired   = !isCompleted && req.is_expired;
  const isPending   = !isCompleted && !isExpired;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-gray-100 shrink-0">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">Client Information Form</h2>
                {isCompleted && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    <CheckCircle2 className="w-3 h-3" /> Completed
                  </span>
                )}
                {isExpired && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                    <XCircle className="w-3 h-3" /> Expired
                  </span>
                )}
                {isPending && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock className="w-3 h-3" /> Awaiting Response
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-gray-500">
                <span>Sent {formatDate(req.created_at)}{req.sent_by_name ? ` by ${req.sent_by_name}` : ''}</span>
                {isCompleted && req.completed_at && (
                  <span>Submitted {formatDateTime(req.completed_at)}</span>
                )}
                {isExpired && (
                  <span>Expired {formatDate(req.expires_at)}</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {!isCompleted ? (
              <div className="py-10 text-center">
                <div className={`w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center ${
                  isExpired ? 'bg-gray-100' : 'bg-amber-50'
                }`}>
                  {isExpired
                    ? <XCircle className="w-7 h-7 text-gray-400" />
                    : <Clock className="w-7 h-7 text-amber-500" />
                  }
                </div>
                <p className="text-sm font-semibold text-gray-700">
                  {isExpired ? 'Form not completed' : 'Waiting for patient to respond'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {isExpired
                    ? 'The link expired before the patient submitted the form.'
                    : `Link expires ${formatDate(req.expires_at)}.`
                  }
                </p>
              </div>
            ) : (
              <>
                {/* Personal Information */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <SectionHeader
                    icon={<User className="w-4 h-4 text-sky-600" />}
                    title="Personal Information"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Row label="First Name"     value={patient.first_name} />
                    <Row label="Last Name"      value={patient.last_name} />
                    <Row label="Date of Birth"  value={formatDate(patient.date_of_birth)} />
                    <Row label="Sex"            value={getGenderLabel(patient.gender)} />
                    <Row label="City"           value={patient.city} />
                    <Row label="Province"       value={patient.province} />
                    <Row label="Postal Code"    value={patient.postal_code} />
                    <Row label="Address"        value={patient.address} />
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <SectionHeader
                    icon={<Phone className="w-4 h-4 text-sky-600" />}
                    title="Emergency Contact"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Row label="Name"         value={patient.emergency_contact_name} />
                    <Row label="Phone"        value={patient.emergency_contact_phone} />
                    <Row label="Relationship" value={patient.emergency_contact_relationship} />
                  </div>
                </div>

                {/* Location */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <SectionHeader
                    icon={<MapPin className="w-4 h-4 text-sky-600" />}
                    title="Medical Information"
                  />
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3">
                      <Row label="PhilHealth Number"    value={patient.philhealth_number} />
                      <Row label="Medical Conditions"   value={patient.medical_conditions || 'None reported'} />
                      <Row label="Allergies"            value={patient.allergies || 'None reported'} />
                      <Row label="Current Medications"  value={patient.medications || 'None reported'} />
                    </div>
                  </div>
                </div>

                {/* Consent */}
                {(req.accepted_terms || req.accepted_privacy) && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <SectionHeader
                      icon={<ShieldCheck className="w-4 h-4 text-green-600" />}
                      title="Consent"
                    />
                    <div className="space-y-2">
                      {req.accepted_terms && (
                        <div className="flex items-center gap-2 text-sm text-green-800">
                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                          Agreed to Terms &amp; Conditions
                        </div>
                      )}
                      {req.accepted_privacy && (
                        <div className="flex items-center gap-2 text-sm text-green-800">
                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                          Consented to Data Privacy Policy
                        </div>
                      )}
                      {req.accepted_at && (
                        <p className="text-xs text-green-600 mt-1">
                          Accepted {formatDateTime(req.accepted_at)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
