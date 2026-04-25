import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle, RefreshCw, Building2, Phone, Mail, MapPin, Briefcase } from 'lucide-react';
import type { CreateContactData, Contact } from '@/types';
import { PhLocationSelect } from '@/components/location/PhLocationSelect';
import { formatPHPhone, isValidPHPhone } from '@/utils/phoneFormatter';

interface AddContactModalProps {
  isOpen:          boolean;
  onClose:         () => void;
  onSubmit:        (data: CreateContactData) => Promise<void>;
  editingContact?: Contact | null;
}

type ContactType = 'DOCTOR' | 'PRACTITIONER' | 'CLINIC' | 'LABORATORY' | 'PHARMACY' | 'OTHER';

interface FormErrors {
  first_name?:    string;
  last_name?:     string;
  phone?:         string;
  email?:         string;
  address?:       string;
  city?:          string;
  province?:      string;
  general?:       string;
}

const CONTACT_TYPES: { value: ContactType; label: string }[] = [
  { value: 'DOCTOR',        label: 'Doctor'        },
  { value: 'PRACTITIONER',  label: 'Practitioner'  },
  { value: 'CLINIC',        label: 'Clinic'        },
  { value: 'LABORATORY',    label: 'Laboratory'    },
  { value: 'PHARMACY',      label: 'Pharmacy'      },
  { value: 'OTHER',         label: 'Other'         },
];

const EMPTY_FORM: CreateContactData = {
  clinic:            0,
  contact_type:      'DOCTOR',
  first_name:        '',
  last_name:         '',
  middle_name:       '',
  organization_name: '',
  specialty:         '',
  license_number:    '',
  email:             '',
  phone:             '',
  alternative_phone: '',
  address:           '',
  city:              '',
  province:          '',
  postal_code:       '',
  notes:             '',
  website:           '',
  is_active:         true,
  is_preferred:      false,
};

/* ── Reusable helpers ──────────────────────────────────── */
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

const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode; color?: string }> = ({
  icon, children, color = 'text-sky-600',
}) => (
  <div className={`flex items-center gap-1.5 text-[11px] font-bold ${color} uppercase tracking-widest mb-3`}>
    {icon}
    {children}
  </div>
);

export const AddContactModal: React.FC<AddContactModalProps> = ({
  isOpen, onClose, onSubmit, editingContact = null,
}) => {
  const isEditMode = !!editingContact;

  const [formData, setFormData] = useState<CreateContactData>(EMPTY_FORM);
  const [errors, setErrors]     = useState<FormErrors>({});
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (editingContact) {
      setFormData({
        clinic:            editingContact.clinic,
        contact_type:      editingContact.contact_type,
        first_name:        editingContact.first_name,
        last_name:         editingContact.last_name,
        middle_name:       editingContact.middle_name       ?? '',
        organization_name: editingContact.organization_name ?? '',
        specialty:         editingContact.specialty         ?? '',
        license_number:    editingContact.license_number    ?? '',
        email:             editingContact.email             ?? '',
        phone:             editingContact.phone ? formatPHPhone(editingContact.phone) : '',
        alternative_phone: editingContact.alternative_phone ? formatPHPhone(editingContact.alternative_phone) : '',
        address:           editingContact.address,
        city:              editingContact.city,
        province:          editingContact.province,
        postal_code:       editingContact.postal_code       ?? '',
        notes:             editingContact.notes             ?? '',
        website:           editingContact.website           ?? '',
        is_active:         editingContact.is_active,
        is_preferred:      editingContact.is_preferred,
      });
    } else {
      setFormData(EMPTY_FORM);
    }
    setErrors({});
  }, [editingContact, isOpen]);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!formData.first_name.trim())  e.first_name = 'First name is required';
    if (!formData.last_name.trim())   e.last_name  = 'Last name is required';
    if (formData.phone.trim() && !isValidPHPhone(formData.phone))
      e.phone = 'Enter a valid Philippine mobile number';
    const emailValue = formData.email ?? '';
    if (!emailValue.trim()) {
      e.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue))
      e.email = 'Invalid email format';
    if (!formData.address.trim())  e.address  = 'Address is required';
    if (!formData.city.trim())     e.city     = 'City is required';
    if (!formData.province.trim()) e.province = 'Province is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      // Strip the clinic field — backend injects it from the auth token
      const { clinic: _clinic, ...payload } = formData;
      await onSubmit(payload as CreateContactData);
      handleClose();
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.[0] ||
        Object.values(err?.response?.data ?? {})?.[0] ||
        err?.message ||
        'Failed to save contact. Please try again.';
      setErrors({ general: String(detail) });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData(EMPTY_FORM);
    setErrors({});
    onClose();
  };

  const set = <K extends keyof CreateContactData>(field: K, value: CreateContactData[K]) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Top accent */}
          <div className="h-1.5 w-full bg-sky-500 rounded-t-2xl" />

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center shadow-sm">
                <UserPlus className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {isEditMode ? 'Edit Contact' : 'New Contact'}
                </h2>
                <p className="text-xs text-gray-400">
                  {isEditMode
                    ? `Editing ${editingContact?.first_name} ${editingContact?.last_name}`
                    : 'Add a new professional contact or referral'}
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

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="px-6 py-5 space-y-6">

              {/* General error */}
              {errors.general && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {errors.general}
                </div>
              )}

              {/* Two-column layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">

                {/* ── LEFT COLUMN ── */}
                <div className="space-y-4">

                  {/* SECTION — Identity */}
                  <SectionTitle icon={<UserPlus className="w-3 h-3" />}>
                    Personal Information
                  </SectionTitle>

                  {/* Contact Type */}
                  <div>
                    <Label required>Contact Type</Label>
                    <select
                      value={formData.contact_type}
                      onChange={e => set('contact_type', e.target.value as ContactType)}
                      className={selectCls}
                    >
                      {CONTACT_TYPES.map(o => (
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
                      placeholder="Juan"
                      className={inputCls(!!errors.first_name)}
                    />
                    <FieldError msg={errors.first_name} />
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

                  {/* Last Name */}
                  <div>
                    <Label required>Last Name</Label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={e => set('last_name', e.target.value)}
                      placeholder="Dela Cruz"
                      className={inputCls(!!errors.last_name)}
                    />
                    <FieldError msg={errors.last_name} />
                  </div>

                  {/* Organization */}
                  <div>
                    <Label>
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-sky-400" />
                        Organization / Clinic Name
                      </span>
                    </Label>
                    <input
                      type="text"
                      value={formData.organization_name}
                      onChange={e => set('organization_name', e.target.value)}
                      placeholder="e.g. St. Luke's Medical Center"
                      className={inputCls()}
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <Label required>Status</Label>
                    <div className="flex gap-3">
                      {[
                        { value: true,  label: 'Active',   ring: 'ring-sky-400', bg: 'bg-sky-50 text-sky-700 border-sky-200' },
                        { value: false, label: 'Archived', ring: 'ring-gray-300',   bg: 'bg-gray-100  text-gray-500   border-gray-200'   },
                      ].map(opt => (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => set('is_active', opt.value)}
                          className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                            formData.is_active === opt.value
                              ? `${opt.bg} ring-2 ${opt.ring}`
                              : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preferred */}
                  <div>
                    <Label>Preferred Contact</Label>
                    <div className="flex gap-3">
                      {[
                        { value: true,  label: 'Yes', ring: 'ring-yellow-400', bg: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                        { value: false, label: 'No',  ring: 'ring-gray-300',   bg: 'bg-gray-100 text-gray-500   border-gray-200'   },
                      ].map(opt => (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => set('is_preferred', opt.value)}
                          className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                            formData.is_preferred === opt.value
                              ? `${opt.bg} ring-2 ${opt.ring}`
                              : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-0.5 text-[10px] text-gray-400">
                      Preferred contacts appear highlighted in referral lists.
                    </p>
                  </div>
                </div>

                {/* ── RIGHT COLUMN ── */}
                <div className="space-y-4">

                  {/* SECTION — Professional */}
                  <SectionTitle icon={<Briefcase className="w-3 h-3" />} color="text-slate-500">
                    Professional Details
                  </SectionTitle>

                  {/* Specialty */}
                  <div>
                    <Label>Specialty</Label>
                    <input
                      type="text"
                      value={formData.specialty}
                      onChange={e => set('specialty', e.target.value)}
                      placeholder="e.g. Pediatrics, Orthopedics"
                      className={inputCls()}
                    />
                  </div>

                  {/* License Number */}
                  <div>
                    <Label>License Number</Label>
                    <input
                      type="text"
                      value={formData.license_number}
                      onChange={e => set('license_number', e.target.value)}
                      placeholder="PRC License No."
                      className={inputCls()}
                    />
                  </div>

                  {/* Website */}
                  <div>
                    <Label>Website</Label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={e => set('website', e.target.value)}
                      placeholder="https://example.com"
                      className={inputCls()}
                    />
                  </div>

                  {/* SECTION — Contact */}
                  <SectionTitle icon={<Phone className="w-3 h-3" />} color="text-slate-500">
                    Contact Details
                  </SectionTitle>

                  {/* Phone */}
                  <div>
                    <Label>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-sky-400" />
                        Phone Number <span className="text-gray-400 font-normal">(optional)</span>
                      </span>
                    </Label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => set('phone', formatPHPhone(e.target.value))}
                      placeholder="(+63) 9XX XXX XXXX"
                      className={inputCls(!!errors.phone)}
                    />
                    <FieldError msg={errors.phone} />
                  </div>

                  {/* Alternative Phone */}
                  <div>
                    <Label>Alternative Phone</Label>
                    <input
                      type="tel"
                      value={formData.alternative_phone}
                      onChange={e => set('alternative_phone', formatPHPhone(e.target.value))}
                      placeholder="(+63) 9XX XXX XXXX"
                      className={inputCls()}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <Label required>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-sky-400" />
                        Email Address
                      </span>
                    </Label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="contact@example.com"
                      className={inputCls(!!errors.email)}
                    />
                    <FieldError msg={errors.email} />
                  </div>
                </div>
              </div>

              {/* ── SECTION — Address (full width) ── */}
              <div>
                <SectionTitle icon={<MapPin className="w-3 h-3" />} color="text-slate-500">
                  Address
                </SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">

                  <div className="md:col-span-2">
                    <Label required>Street Address</Label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={e => set('address', e.target.value)}
                      placeholder="Unit / Bldg., Street, Barangay"
                      className={inputCls(!!errors.address)}
                    />
                    <FieldError msg={errors.address} />
                  </div>

                  {/* Use PhLocationSelect for Province and City */}
                  <PhLocationSelect
                    province={formData.province}
                    city={formData.city}
                    onProvinceChange={(value) => set('province', value)}
                    onCityChange={(value) => set('city', value)}
                    provinceError={errors.province}
                    cityError={errors.city}
                    required
                  />

                  <div>
                    <Label>Postal Code</Label>
                    <input
                      type="text"
                      value={formData.postal_code}
                      onChange={e => set('postal_code', e.target.value)}
                      placeholder="1100"
                      className={inputCls()}
                    />
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <textarea
                      rows={2}
                      value={formData.notes}
                      onChange={e => set('notes', e.target.value)}
                      placeholder="Additional notes or remarks…"
                      className={`${inputCls()} resize-none`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
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
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />{isEditMode ? 'Saving…' : 'Adding…'}</>
                  : <><UserPlus className="w-4 h-4" />{isEditMode ? 'Save Changes' : 'Add Contact'}</>
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};