import React from 'react';
import { User, Mail, Phone, FileText, Calendar } from 'lucide-react';
import { formatPHPhone } from '@/utils/phoneFormatter';

export interface PatientFormData {
  first_name:    string;
  last_name:     string;
  email:         string;
  phone:         string;
  date_of_birth: string;
  notes:         string;
}

interface PatientDetailsFormProps {
  formData:  PatientFormData;
  formError: string | null;
  onChange:  (data: PatientFormData) => void;
  acceptedTerms: boolean;
  acceptedConsent: boolean;
  acceptedClinicConsent: boolean;
  signatureReady: boolean;
  clinicConsentReady: boolean;
  hasClinicConsentForm?: boolean;
  onTermsChange: (checked: boolean) => void;
  onOpenTerms: () => void;
  onOpenConsent: () => void;
  onOpenClinicConsent: () => void;
}

export const PatientDetailsForm: React.FC<PatientDetailsFormProps> = ({
  formData,
  formError,
  onChange,
  acceptedTerms,
  acceptedConsent,
  acceptedClinicConsent,
  signatureReady,
  clinicConsentReady,
  hasClinicConsentForm,
  onTermsChange,
  onOpenTerms,
  onOpenConsent,
  onOpenClinicConsent,
}) => {
  const set = (field: keyof PatientFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = field === 'phone' ? formatPHPhone(e.target.value) : e.target.value;
      onChange({ ...formData, [field]: value });
    };

  return (
    <div className="space-y-4 w-full">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Your Booking Details</h2>
        <p className="text-sm text-gray-500 mt-1">
          Please fill in your contact information to complete the booking.
        </p>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-5">

        {/* Row 1 — First Name / Last Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              First Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.first_name}
                onChange={set('first_name')}
                className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                placeholder="Enter First Name"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Last Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.last_name}
                onChange={set('last_name')}
                className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                placeholder="Enter Last Name"
              />
            </div>
          </div>
        </div>

        {/* Row 2 — Phone / Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Mobile Phone <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={formData.phone}
                onChange={set('phone')}
                className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                placeholder="(+63) 9XX XXX XXXX"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={formData.email}
                onChange={set('email')}
                className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                placeholder="Enter Email"
              />
            </div>
          </div>
        </div>

        {/* Row 3 — Date of Birth (half width) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Date of Birth <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={formData.date_of_birth}
                onChange={set('date_of_birth')}
                max={new Date().toISOString().split('T')[0]}
                className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
              />
            </div>
          </div>
          {/* intentionally empty — keeps DOB at half width */}
          <div />
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Notes — full width */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Notes{' '}
            <span className="text-gray-400 font-normal">Please specify your concerns...</span>
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
            <textarea
              rows={4}
              value={formData.notes}
              onChange={set('notes')}
              className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 resize-none"
              placeholder="Any additional information for the practitioner..."
            />
          </div>
        </div>

        {/* Compliance */}
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => onTermsChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700">
              I agree to the{' '}
              <button
                type="button"
                onClick={onOpenTerms}
                className="text-sky-600 underline hover:text-sky-700"
              >
                Terms & Conditions
              </button>{' '}
              <span className="text-red-500">*</span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer" onClick={onOpenConsent}>
            <input
              type="checkbox"
              checked={acceptedConsent}
              readOnly
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700">
              I consent to the{' '}
              <button
                type="button"
                onClick={onOpenConsent}
                className="text-sky-600 underline hover:text-sky-700"
              >
                Data Privacy Policy
              </button>{' '}
              <span className="text-red-500">*</span>
              <span className="block text-xs text-gray-500 mt-1">
                A signed consent form is required before booking can proceed.
              </span>
            </span>
          </label>

          {acceptedConsent && (
            <p className={`text-xs ${signatureReady ? 'text-emerald-600' : 'text-amber-600'}`}>
              {signatureReady ? 'Consent signed and saved.' : 'Consent checked but signature is missing.'}
            </p>
          )}

          {hasClinicConsentForm && (
          <label className="flex items-start gap-3 cursor-pointer" onClick={onOpenClinicConsent}>
            <input
              type="checkbox"
              checked={acceptedClinicConsent}
              readOnly
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700">
              I have read and agree to the{' '}
              <button
                type="button"
                onClick={onOpenClinicConsent}
                className="text-sky-600 underline hover:text-sky-700"
              >
                Clinic Consent Form
              </button>{' '}
              <span className="text-red-500">*</span>
              <span className="block text-xs text-gray-500 mt-1">
                {clinicConsentReady ? 'Clinic consent signed and saved.' : 'Please review and sign the clinic consent form.'}
              </span>
            </span>
          </label>
        )}
        </div>
      </div>
    </div>
  );
};