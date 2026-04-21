import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Practitioner } from '@/features/clinics/clinic.api';
import type { PatientCase, PatientCaseStatus } from './patientCases.storage';

export interface CaseFormData {
  title: string;
  status: PatientCaseStatus;
  primaryPractitionerId: string;
  primaryPractitionerName: string;
  referredBy: string;
  referralInfo: string;
  description: string;
}

interface CaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialValues?: Partial<PatientCase>;
  onSave: (data: CaseFormData) => void;
  practitioners: Practitioner[];
  loadingPractitioners: boolean;
}

export const CaseModal = ({ isOpen, onClose, mode, initialValues, onSave, practitioners, loadingPractitioners }: CaseModalProps) => {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [status, setStatus] = useState<PatientCaseStatus>(initialValues?.status ?? 'OPEN');
  const [primaryPractitionerId, setPrimaryPractitionerId] = useState(initialValues?.primaryPractitionerId ?? '');
  const [primaryPractitionerName, setPrimaryPractitionerName] = useState(initialValues?.primaryPractitionerName ?? '');
  const [referredBy, setReferredBy] = useState(initialValues?.referredBy ?? '');
  const [referralInfo, setReferralInfo] = useState(initialValues?.referralInfo ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');

  const handlePractitionerChange = (id: string) => {
    setPrimaryPractitionerId(id);
    const found = practitioners.find((p) => String(p.id) === id);
    setPrimaryPractitionerName(found?.name ?? '');
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl pointer-events-auto max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {mode === 'create' ? 'Create New Case' : 'Edit Case'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {mode === 'create'
                  ? 'Define a case to organize patient notes and follow-up actions.'
                  : 'Update case details and assignment.'}
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Case Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Post-op Knee Recovery"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PatientCaseStatus)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="OPEN">Open</option>
                <option value="MONITORING">Monitoring</option>
                <option value="DISCHARGED">Discharged</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Primary Practitioner</label>
              {loadingPractitioners ? (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 border border-gray-200 rounded-lg">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading practitioners...
                </div>
              ) : (
                <select
                  value={primaryPractitionerId}
                  onChange={(e) => handlePractitionerChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">— Not assigned —</option>
                  {practitioners.map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-3 pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-600">Referral <span className="text-gray-400 font-normal">(Optional)</span></p>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Referred By</label>
                <input
                  type="text"
                  value={referredBy}
                  onChange={(e) => setReferredBy(e.target.value)}
                  placeholder="e.g., Dr. Smith, St. Luke's Hospital"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Referral Notes</label>
                <textarea
                  value={referralInfo}
                  onChange={(e) => setReferralInfo(e.target.value)}
                  rows={2}
                  placeholder="Additional referral information..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Add context, goals, and notes for this case"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!title.trim()) {
                  toast.error('Case title is required');
                  return;
                }
                onSave({ title: title.trim(), status, primaryPractitionerId, primaryPractitionerName, referredBy, referralInfo, description });
              }}
              className="px-3 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700"
            >
              {mode === 'create' ? 'Create Case' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
