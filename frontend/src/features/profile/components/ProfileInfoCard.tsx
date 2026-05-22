import React, { useState, useEffect } from 'react';
import {
  User, Mail, Phone, Edit2, Check, X,
  Loader2, AlertCircle,
} from 'lucide-react';
import type { User as UserType } from '@/types/auth';
import type { UpdateProfileData } from '../services/profile.api';
import { formatPHPhone, normalizePHPhone } from '@/utils/phoneFormatter';\nimport { validatePHPhoneDetailed } from '@/utils/validation';

interface ProfileInfoCardProps {
  user:           UserType;
  isSaving:       boolean;
  onSave:         (data: UpdateProfileData) => Promise<boolean>;
  onEditingChange?: (editing: boolean) => void;  // Callback when edit mode changes
}

interface FormState {
  first_name: string;
  last_name:  string;
  phone:      string;
}

interface FormErrors {
  first_name?: string;
  last_name?:  string;
  phone?:      string;
}

/* ── Field component ──────────────────────────────────── */
const Field: React.FC<{
  label:        string;
  icon:         React.ReactNode;
  value:        string;
  editing:      boolean;
  name:         keyof FormState;
  type?:        string;
  placeholder?: string;
  error?:       string;
  onChange:     (k: keyof FormState, v: string) => void;
}> = ({ label, icon, value, editing, name, type = 'text', placeholder, error, onChange }) => (
  <div className="flex flex-col gap-1.5">
    <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-500">
      {icon}
      {label}
    </label>
    {editing ? (
      <>
        <input
          type={type}
          value={value}
          onChange={e => onChange(name, e.target.value)}
          placeholder={placeholder}
          className={`w-full border-2 ${
            error
              ? 'border-red-400 bg-red-50 focus:ring-red-300'
              : 'border-gray-200 bg-gray-50 focus:ring-sky-300'
          } rounded-xl px-4 py-3 text-sm focus:bg-white focus:outline-none
            focus:ring-2 focus:border-transparent transition`}
        />
        {error && (
          <p className="text-xs text-red-500 font-medium">{error}</p>
        )}
      </>
    ) : (
      <div className="py-3 px-4 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-sm font-medium text-gray-800 truncate">
          {value || <span className="text-gray-400 italic font-normal">Not set</span>}
        </p>
      </div>
    )}
  </div>
);

export const ProfileInfoCard: React.FC<ProfileInfoCardProps> = ({
  user, isSaving, onSave, onEditingChange,
}) => {
  const [editing, setEditing] = useState(false);
  const [form,    setForm]    = useState<FormState>({
    first_name: user.first_name ?? '',
    last_name:  user.last_name  ?? '',
    phone:      user.phone ? formatPHPhone(user.phone) : '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!editing) {
      setForm({
        first_name: user.first_name ?? '',
        last_name:  user.last_name  ?? '',
        phone:      user.phone ? formatPHPhone(user.phone) : '',
      });
    }
  }, [user, editing]);

  const set = (k: keyof FormState, v: string) => {
    const formatted = k === 'phone' ? formatPHPhone(v) : v;
    setForm(prev => ({ ...prev, [k]: formatted }));
    setErrors(prev => ({ ...prev, [k]: undefined }));
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.first_name.trim()) e.first_name = 'First name is required';
    if (!form.last_name.trim())  e.last_name  = 'Last name is required';
    if (form.phone) {
      const phoneErr = validatePHPhoneDetailed(form.phone, false);
      if (phoneErr) e.phone = phoneErr;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    console.log('[ProfileInfoCard] handleSave called with form:', form);
    const ok = await onSave({
      first_name: form.first_name.trim(),
      last_name:  form.last_name.trim(),
      phone:      form.phone.trim() ? normalizePHPhone(form.phone) : '',
    });
    console.log('[ProfileInfoCard] handleSave result:', ok);
    if (ok) setEditing(false);
  };

  const handleCancel = () => {
    setForm({
      first_name: user.first_name ?? '',
      last_name:  user.last_name  ?? '',
      phone:      user.phone      ?? '',
    });
    setErrors({});
    setEditing(false);
    onEditingChange?.(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Card header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center">
            <User className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-800">Personal Information</h3>
            <p className="text-xs text-gray-400 mt-0.5">Update your name and contact details</p>
          </div>
        </div>

        {!editing ? (
          <button
            onClick={() => {
              setEditing(true);
              onEditingChange?.(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold
                       text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl
                       border border-sky-200 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2.5">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold
                         text-gray-600 bg-white border border-gray-200 rounded-xl
                         hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold
                         text-white bg-sky-600 hover:bg-sky-700 rounded-xl
                         disabled:opacity-50 transition-colors shadow-sm"
            >
              {isSaving
                ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                : <><Check className="w-4 h-4" />Save Changes</>
              }
            </button>
          </div>
        )}
      </div>

      {/* Fields grid */}
      <div className="px-6 py-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field
          label="First Name"   name="first_name"
          icon={<User className="w-3.5 h-3.5" />}
          value={form.first_name} editing={editing}
          placeholder="Juan"     error={errors.first_name}
          onChange={set}
        />
        <Field
          label="Last Name"    name="last_name"
          icon={<User className="w-3.5 h-3.5" />}
          value={form.last_name}  editing={editing}
          placeholder="Dela Cruz" error={errors.last_name}
          onChange={set}
        />
        <Field
          label="Phone Number" name="phone"
          icon={<Phone className="w-3.5 h-3.5" />}
          value={form.phone}     editing={editing}
          placeholder="(+63) 9XX XXX XXXX" type="tel"
          error={errors.phone}
          onChange={set}
        />

        {/* Email — always read-only */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-500">
            <Mail className="w-3.5 h-3.5" />
            Email Address
          </label>
          <div className="flex items-center gap-3 py-3 px-4 bg-gray-50 rounded-xl
                          border border-gray-100">
            <p className="text-sm font-medium text-gray-800 truncate flex-1">{user.email}</p>
            <div title="Email cannot be changed">
              <AlertCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </div>
          </div>
          <p className="text-xs text-gray-400">Email address cannot be changed</p>
        </div>
      </div>
    </div>
  );
};