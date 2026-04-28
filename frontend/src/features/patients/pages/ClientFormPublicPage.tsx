import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  AlertTriangle, CheckCircle, ChevronRight, Loader2, ShieldCheck,
} from 'lucide-react';
import { formatPHPhone, isValidPHPhone, normalizePHPhone } from '@/utils/phoneFormatter';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api';
const api = axios.create({ baseURL: BASE });

// ── Types ─────────────────────────────────────────────────────────────────────
interface TokenInfo {
  clinic_name:   string;
  patient_first: string;
  expires_at:    string;
}

interface Prefill {
  first_name:    string;
  last_name:     string;
  date_of_birth: string;
  gender:        string;
  address:       string;
  province:      string;
  city:          string;
  postal_code:   string;
  emergency_contact_name:         string;
  emergency_contact_phone:        string;
  emergency_contact_relationship: string;
  philhealth_number:  string;
  medical_conditions: string;
  allergies:          string;
  medications:        string;
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────
const inputCls = (err?: string) =>
  `w-full px-4 py-2.5 border ${err ? 'border-red-400' : 'border-gray-300'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent`;

const Field: React.FC<{
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}> = ({ label, required, error, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
  </div>
);

const YesNoField: React.FC<{
  label:    string;
  value:    boolean | null;
  onChange: (v: boolean) => void;
  error?:   string;
}> = ({ label, value, onChange, error }) => (
  <Field label={label} required error={error}>
    <div className="flex gap-3">
      {(['yes', 'no'] as const).map((opt) => {
        const isYes  = opt === 'yes';
        const active = value === isYes;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(isYes)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              active
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-sky-400'
            }`}
          >
            {opt === 'yes' ? 'Yes' : 'No'}
          </button>
        );
      })}
    </div>
  </Field>
);

// ── Step 1: Email Verification ────────────────────────────────────────────────
const EmailVerifyStep: React.FC<{
  token:     string;
  tokenInfo: TokenInfo;
  onVerified: (prefill: Prefill, email: string) => void;
}> = ({ token, tokenInfo, onVerified }) => {
  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true);
    try {
      const res = await api.post<Prefill>(`/public/client-form/${token}/verify/`, { email });
      onVerified(res.data, email.trim().toLowerCase());
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || 'Could not verify your email. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-sky-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-linear-to-r from-sky-500 to-indigo-600 px-8 py-6 text-white">
            <p className="text-sky-100 text-sm font-medium">{tokenInfo.clinic_name}</p>
            <h1 className="text-2xl font-bold mt-1">Client Information Form</h1>
            <p className="text-sky-100 text-sm mt-1">
              Hello, {tokenInfo.patient_first}! Please verify your identity to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <p className="text-sm text-gray-600 leading-relaxed">
              Enter the email address associated with your account to access your form.
            </p>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <Field label="Email Address" required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                className={inputCls()}
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                : <>Continue <ChevronRight className="w-4 h-4" /></>
              }
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          Step 1 of 3 · Secure form · Link expires {new Date(tokenInfo.expires_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};

// ── Step 2: Terms & Consent ───────────────────────────────────────────────────
const TERMS_TEXT = `TERMS AND CONDITIONS

1. Acceptance
By completing this form you agree to these Terms and Conditions in full. If you disagree, do not proceed.

2. Information Accuracy
You confirm that all information submitted is accurate and complete to the best of your knowledge. You accept responsibility for any consequences resulting from inaccurate or incomplete information.

3. Healthcare Services
The clinic provides healthcare services subject to professional judgement. Treatment plans are determined solely by qualified practitioners.

4. Appointments & Cancellations
Appointment requests are subject to availability and clinic confirmation. Please provide at least 24 hours notice for cancellations.

5. Communications
By providing your contact details you agree to receive appointment reminders and healthcare-related communications relevant to your care.

6. Changes to Terms
The clinic reserves the right to update these terms at any time. Continued use of clinic services constitutes acceptance.`;

const PRIVACY_TEXT = `DATA PRIVACY CONSENT

I hereby give my informed consent for the clinic to collect, process, and store my personal and health information — including but not limited to name, date of birth, contact details, emergency contact, medical history, allergies, and medications — for the following purposes:

• Scheduling, confirming, and managing appointments
• Providing and documenting healthcare treatment
• Billing and insurance processing
• Follow-up communications and reminders
• Legal compliance and audit requirements

Data Handling
Your information is handled in strict confidence by authorised clinic personnel. It will not be sold, rented, or disclosed to third parties except when legally required or with your explicit authorisation.

Rights
You have the right to access, correct, or request deletion of your personal data at any time by contacting the clinic directly.

This consent is given voluntarily and in accordance with applicable data protection laws, including the Data Privacy Act of 2012 (Republic Act No. 10173).`;

const ConsentAndTermsStep: React.FC<{
  clinicName:  string;
  onAccepted:  () => void;
}> = ({ clinicName, onAccepted }) => {
  const [agreedTerms,   setAgreedTerms]   = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);

  const canContinue = agreedTerms && agreedPrivacy;

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-sky-50 py-10 px-4">
      <div className="w-full max-w-xl mx-auto space-y-5">
        {/* Header */}
        <div className="bg-linear-to-r from-sky-500 to-indigo-600 rounded-2xl px-8 py-6 text-white shadow-lg">
          <p className="text-sky-100 text-sm font-medium">{clinicName}</p>
          <h1 className="text-2xl font-bold mt-1">Terms &amp; Consent</h1>
          <p className="text-sky-100 text-sm mt-1">
            Please read and accept both documents to continue.
          </p>
        </div>

        {/* Step indicator */}
        <p className="text-center text-xs text-gray-400">Step 2 of 3</p>

        {/* Terms & Conditions */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-gray-50 border-b border-gray-200">
            <ShieldCheck className="w-4 h-4 text-sky-600" />
            <h2 className="text-sm font-bold text-gray-800">Terms &amp; Conditions</h2>
          </div>
          <div className="px-5 py-4">
            <div className="h-40 overflow-y-auto text-xs text-gray-600 leading-relaxed whitespace-pre-line border border-gray-200 rounded-xl p-3 bg-gray-50">
              {TERMS_TEXT}
            </div>
            <label className="flex items-start gap-3 mt-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-sky-600 shrink-0"
              />
              <span className="text-sm text-gray-700 font-medium">
                I agree to the Terms and Conditions
              </span>
            </label>
          </div>
        </div>

        {/* Data Privacy Consent */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-gray-50 border-b border-gray-200">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-gray-800">Data Privacy Consent</h2>
          </div>
          <div className="px-5 py-4">
            <div className="h-40 overflow-y-auto text-xs text-gray-600 leading-relaxed whitespace-pre-line border border-gray-200 rounded-xl p-3 bg-gray-50">
              {PRIVACY_TEXT}
            </div>
            <label className="flex items-start gap-3 mt-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedPrivacy}
                onChange={(e) => setAgreedPrivacy(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-sky-600 shrink-0"
              />
              <span className="text-sm text-gray-700 font-medium">
                I consent to the Data Privacy Policy
              </span>
            </label>
          </div>
        </div>

        {!canContinue && (
          <p className="text-center text-xs text-amber-600 font-medium">
            Both checkboxes are required to proceed.
          </p>
        )}

        <button
          type="button"
          onClick={onAccepted}
          disabled={!canContinue}
          className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-2xl text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
        >
          Continue <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// ── Shared section wrapper ────────────────────────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
    <h2 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-3">{title}</h2>
    {children}
  </div>
);

// ── Step 3: Client Form ───────────────────────────────────────────────────────
interface FormState {
  // Personal info
  first_name:    string;
  last_name:     string;
  date_of_birth: string;
  gender:        string;
  address:       string;
  province:      string;
  city:          string;
  postal_code:   string;
  // Emergency contact
  emergency_contact_name:         string;
  emergency_contact_phone:        string;
  emergency_contact_relationship: string;
  // Medical info
  philhealth_number:     string;
  has_medical_conditions: boolean | null;
  medical_conditions:    string;
  has_allergies:         boolean | null;
  allergies:             string;
  has_medications:       boolean | null;
  medications:           string;
}

const ClientFormStep: React.FC<{
  token:     string;
  prefill:   Prefill;
  email:     string;
  clinicName: string;
  onSuccess:  () => void;
}> = ({ token, prefill, email, clinicName, onSuccess }) => {
  const [form, setForm] = useState<FormState>({
    first_name:    prefill.first_name,
    last_name:     prefill.last_name,
    date_of_birth: prefill.date_of_birth,
    gender:        prefill.gender,
    address:       prefill.address,
    province:      prefill.province,
    city:          prefill.city,
    postal_code:   prefill.postal_code,
    emergency_contact_name:         prefill.emergency_contact_name,
    emergency_contact_phone:        prefill.emergency_contact_phone ? formatPHPhone(prefill.emergency_contact_phone) : '',
    emergency_contact_relationship: prefill.emergency_contact_relationship,
    philhealth_number:     prefill.philhealth_number,
    has_medical_conditions: prefill.medical_conditions ? true  : null,
    medical_conditions:    prefill.medical_conditions,
    has_allergies:         prefill.allergies   ? true : null,
    allergies:             prefill.allergies,
    has_medications:       prefill.medications ? true : null,
    medications:           prefill.medications,
  });

  const [errors,      setErrors]      = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting,  setSubmitting]  = useState(false);
  const [serverError, setServerError] = useState('');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};

    // Personal
    if (!form.first_name.trim())  e.first_name    = 'Required';
    if (!form.last_name.trim())   e.last_name     = 'Required';
    if (!form.date_of_birth)      e.date_of_birth = 'Required';
    if (!form.gender)             e.gender        = 'Required';
    if (!form.address.trim())     e.address       = 'Required';
    if (!form.province.trim())    e.province      = 'Required';
    if (!form.city.trim())        e.city          = 'Required';

    // Emergency contact
    if (!form.emergency_contact_name.trim())         e.emergency_contact_name         = 'Required';
    if (!form.emergency_contact_phone.trim())        e.emergency_contact_phone        = 'Required';
    else if (!isValidPHPhone(form.emergency_contact_phone)) e.emergency_contact_phone = 'Enter a valid Philippine mobile number';
    if (!form.emergency_contact_relationship.trim()) e.emergency_contact_relationship = 'Required';

    // Medical
    if (form.has_medical_conditions === null) e.has_medical_conditions = 'Required';
    if (form.has_medical_conditions === true && !form.medical_conditions.trim())
      e.medical_conditions = 'Please describe your medical conditions.';

    if (form.has_allergies === null) e.has_allergies = 'Required';
    if (form.has_allergies === true && !form.allergies.trim())
      e.allergies = 'Please describe your allergies.';

    if (form.has_medications === null) e.has_medications = 'Required';
    if (form.has_medications === true && !form.medications.trim())
      e.medications = 'Please list your current medications.';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setServerError('');
    setSubmitting(true);
    try {
      await api.post(`/public/client-form/${token}/submit/`, {
        email,
        first_name:    form.first_name,
        last_name:     form.last_name,
        date_of_birth: form.date_of_birth,
        gender:        form.gender,
        address:       form.address,
        province:      form.province,
        city:          form.city,
        postal_code:   form.postal_code,
        emergency_contact_name:         form.emergency_contact_name,
        emergency_contact_phone:        normalizePHPhone(form.emergency_contact_phone),
        emergency_contact_relationship: form.emergency_contact_relationship,
        philhealth_number:  form.philhealth_number,
        medical_conditions: form.has_medical_conditions ? form.medical_conditions : '',
        allergies:          form.has_allergies  ? form.allergies  : '',
        medications:        form.has_medications ? form.medications : '',
        accepted_terms:   true,
        accepted_privacy: true,
      });
      onSuccess();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      if (data && typeof data === 'object') {
        const fieldErrs: Partial<Record<keyof FormState, string>> = {};
        for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
          fieldErrs[k as keyof FormState] = Array.isArray(v) ? String(v[0]) : String(v);
        }
        setErrors(fieldErrs);
      } else {
        setServerError('Submission failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-sky-50 py-10 px-4">
      <div className="w-full max-w-xl mx-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-sky-500 to-indigo-600 rounded-2xl px-8 py-6 text-white mb-2 shadow-lg">
          <p className="text-sky-100 text-sm font-medium">{clinicName}</p>
          <h1 className="text-2xl font-bold mt-1">Client Information Form</h1>
          <p className="text-sky-100 text-sm mt-1">Pre-filled data can be edited. All required fields must be completed.</p>
        </div>
        <p className="text-center text-xs text-gray-400 mb-5">Step 3 of 3</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {serverError && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {serverError}
            </div>
          )}

          {/* ── Section A: Personal Info ── */}
          <Section title="Personal Information">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" required error={errors.first_name}>
                <input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} className={inputCls(errors.first_name)} />
              </Field>
              <Field label="Last Name" required error={errors.last_name}>
                <input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} className={inputCls(errors.last_name)} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Date of Birth" required error={errors.date_of_birth}>
                <input type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} className={inputCls(errors.date_of_birth)} />
              </Field>
              <Field label="Sex" required error={errors.gender}>
                <select value={form.gender} onChange={(e) => set('gender', e.target.value)} className={inputCls(errors.gender)}>
                  <option value="">Select…</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other / Prefer not to say</option>
                </select>
              </Field>
            </div>

            <Field label="Street Address" required error={errors.address}>
              <input value={form.address} onChange={(e) => set('address', e.target.value)} className={inputCls(errors.address)} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="City" required error={errors.city}>
                <input value={form.city} onChange={(e) => set('city', e.target.value)} className={inputCls(errors.city)} />
              </Field>
              <Field label="Province" required error={errors.province}>
                <input value={form.province} onChange={(e) => set('province', e.target.value)} className={inputCls(errors.province)} />
              </Field>
            </div>

            <Field label="Postal Code" error={errors.postal_code}>
              <input value={form.postal_code} onChange={(e) => set('postal_code', e.target.value)} placeholder="Optional" className={inputCls(errors.postal_code)} />
            </Field>
          </Section>

          {/* ── Section B: Emergency Contact ── */}
          <Section title="Emergency Contact">
            <Field label="Contact Name" required error={errors.emergency_contact_name}>
              <input
                value={form.emergency_contact_name}
                onChange={(e) => set('emergency_contact_name', e.target.value)}
                placeholder="Full name"
                className={inputCls(errors.emergency_contact_name)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone Number" required error={errors.emergency_contact_phone}>
                <input
                  type="tel"
                  value={form.emergency_contact_phone}
                  onChange={(e) => set('emergency_contact_phone', formatPHPhone(e.target.value))}
                  placeholder="(+63) 9XX XXX XXXX"
                  className={inputCls(errors.emergency_contact_phone)}
                />
              </Field>
              <Field label="Relationship" required error={errors.emergency_contact_relationship}>
                <input
                  value={form.emergency_contact_relationship}
                  onChange={(e) => set('emergency_contact_relationship', e.target.value)}
                  placeholder="e.g. Spouse, Parent"
                  className={inputCls(errors.emergency_contact_relationship)}
                />
              </Field>
            </div>
          </Section>

          {/* ── Section C: Medical Information ── */}
          <Section title="Medical Information">
            <Field label="PhilHealth Number" error={errors.philhealth_number}>
              <input
                value={form.philhealth_number}
                onChange={(e) => set('philhealth_number', e.target.value)}
                placeholder="Optional"
                className={inputCls(errors.philhealth_number)}
              />
            </Field>

            <YesNoField
              label="Do you have any medical conditions?"
              value={form.has_medical_conditions}
              onChange={(v) => { set('has_medical_conditions', v); if (!v) set('medical_conditions', ''); }}
              error={errors.has_medical_conditions}
            />
            {form.has_medical_conditions === true && (
              <Field label="Please describe your medical conditions" required error={errors.medical_conditions}>
                <textarea
                  value={form.medical_conditions}
                  onChange={(e) => set('medical_conditions', e.target.value)}
                  rows={3}
                  placeholder="e.g. Hypertension, Diabetes…"
                  className={`${inputCls(errors.medical_conditions)} resize-none`}
                />
              </Field>
            )}

            <YesNoField
              label="Do you have any allergies?"
              value={form.has_allergies}
              onChange={(v) => { set('has_allergies', v); if (!v) set('allergies', ''); }}
              error={errors.has_allergies}
            />
            {form.has_allergies === true && (
              <Field label="Please describe your allergies" required error={errors.allergies}>
                <textarea
                  value={form.allergies}
                  onChange={(e) => set('allergies', e.target.value)}
                  rows={3}
                  placeholder="e.g. Penicillin, Shellfish…"
                  className={`${inputCls(errors.allergies)} resize-none`}
                />
              </Field>
            )}

            <YesNoField
              label="Are you currently taking any medications?"
              value={form.has_medications}
              onChange={(v) => { set('has_medications', v); if (!v) set('medications', ''); }}
              error={errors.has_medications}
            />
            {form.has_medications === true && (
              <Field label="Please list your current medications" required error={errors.medications}>
                <textarea
                  value={form.medications}
                  onChange={(e) => set('medications', e.target.value)}
                  rows={3}
                  placeholder="e.g. Metformin 500 mg, Lisinopril 10 mg…"
                  className={`${inputCls(errors.medications)} resize-none`}
                />
              </Field>
            )}
          </Section>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-2xl text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {submitting
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting…</>
              : <>Submit Form <ChevronRight className="w-5 h-5" /></>
            }
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Your information is securely transmitted and used only for your care.
        </p>
      </div>
    </div>
  );
};

// ── Success screen ────────────────────────────────────────────────────────────
const SuccessScreen: React.FC<{ clinicName: string }> = ({ clinicName }) => (
  <div className="min-h-screen bg-linear-to-br from-slate-50 to-sky-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10 max-w-md w-full text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
      <p className="text-sm text-gray-500 leading-relaxed">
        Your information has been submitted successfully.{' '}
        <strong>{clinicName}</strong> now has everything they need to prepare for your session.
      </p>
      <p className="text-xs text-gray-400 mt-6">You may now close this tab.</p>
    </div>
  </div>
);

// ── Error screen ──────────────────────────────────────────────────────────────
const ErrorScreen: React.FC<{ message: string }> = ({ message }) => (
  <div className="min-h-screen bg-linear-to-br from-slate-50 to-sky-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10 max-w-md w-full text-center">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Link Unavailable</h1>
      <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
      <p className="text-xs text-gray-400 mt-4">
        Please contact the clinic if you think this is an error.
      </p>
    </div>
  </div>
);

// ── Main page component ───────────────────────────────────────────────────────
export const ClientFormPublicPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [step,      setStep]      = useState<'loading' | 'verify' | 'consent' | 'form' | 'done' | 'error'>('loading');
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [prefill,   setPrefill]   = useState<Prefill | null>(null);
  const [email,     setEmail]     = useState('');
  const [errMsg,    setErrMsg]    = useState('');

  useEffect(() => {
    if (!token) { setStep('error'); setErrMsg('No form token in URL.'); return; }

    api.get<TokenInfo>(`/public/client-form/${token}/`)
      .then((res) => { setTokenInfo(res.data); setStep('verify'); })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'This form link is invalid or has expired.';
        setErrMsg(msg);
        setStep('error');
      });
  }, [token]);

  const handleVerified = (data: Prefill, verifiedEmail: string) => {
    setPrefill(data);
    setEmail(verifiedEmail);
    setStep('consent');
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-sky-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
      </div>
    );
  }
  if (step === 'error') return <ErrorScreen message={errMsg} />;
  if (step === 'done')  return <SuccessScreen clinicName={tokenInfo?.clinic_name ?? 'The Clinic'} />;

  if (step === 'verify' && tokenInfo) {
    return (
      <EmailVerifyStep
        token={token!}
        tokenInfo={tokenInfo}
        onVerified={handleVerified}
      />
    );
  }
  if (step === 'consent' && tokenInfo) {
    return (
      <ConsentAndTermsStep
        clinicName={tokenInfo.clinic_name}
        onAccepted={() => setStep('form')}
      />
    );
  }
  if (step === 'form' && prefill && tokenInfo) {
    return (
      <ClientFormStep
        token={token!}
        prefill={prefill}
        email={email}
        clinicName={tokenInfo.clinic_name}
        onSuccess={() => setStep('done')}
      />
    );
  }
  return null;
};
