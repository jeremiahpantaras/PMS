import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, User, MapPin, Phone, Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Patient, CreatePatientData } from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { PhLocationSelect } from '@/components/location/PhLocationSelect';
import { formatPHPhone, isValidPHPhone } from '@/utils/phoneFormatter';

interface PatientModalProps {
  isOpen:   boolean;
  onClose:  () => void;
  onSave:   (data: CreatePatientData) => Promise<void>;
  patient?: Patient | null;
  mode:     'create' | 'edit';
}

export const PatientModal: React.FC<PatientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  patient,
  mode,
}) => {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [hasMedicalConditions, setHasMedicalConditions] = useState(false);
  const [hasAllergies,         setHasAllergies]         = useState(false);
  const [hasMedications,       setHasMedications]       = useState(false);

  const emptyForm = useMemo<CreatePatientData>(() => ({
    clinic:      user?.clinic || 0,
    first_name:  '', middle_name: '', last_name: '',
    date_of_birth: '', gender: 'M',
    email: '', phone: '',
    address: '', city: '', province: '', postal_code: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '',
    philhealth_number: '', hmo_provider: '', hmo_number: '',
    medical_conditions: '', allergies: '', medications: '',
    send_email_notifications: true,
    sms_notifications_enabled: false,
  }), [user?.clinic]);

  const buildFormFromPatient = useCallback((currentPatient: Patient): CreatePatientData => ({
    clinic:        currentPatient.clinic || user?.clinic || 0,
    first_name:    currentPatient.first_name || '',
    middle_name:   currentPatient.middle_name || '',
    last_name:     currentPatient.last_name || '',
    date_of_birth: currentPatient.date_of_birth || '',
    gender:        currentPatient.gender || 'M',
    email:         currentPatient.email || '',
    phone:         currentPatient.phone ? formatPHPhone(currentPatient.phone) : '',
    address:       currentPatient.address || '',
    city:          currentPatient.city || '',
    province:      currentPatient.province || '',
    postal_code:   currentPatient.postal_code || '',
    emergency_contact_name:         currentPatient.emergency_contact_name || '',
    emergency_contact_phone:        currentPatient.emergency_contact_phone ? formatPHPhone(currentPatient.emergency_contact_phone) : '',
    emergency_contact_relationship: currentPatient.emergency_contact_relationship || '',
    philhealth_number: currentPatient.philhealth_number || '',
    hmo_provider:      currentPatient.hmo_provider      || '',
    hmo_number:        currentPatient.hmo_number        || '',
    medical_conditions: currentPatient.medical_conditions || '',
    allergies:          currentPatient.allergies          || '',
    medications:        currentPatient.medications        || '',
    send_email_notifications: currentPatient.send_email_notifications ?? true,
    sms_notifications_enabled: currentPatient.sms_notifications_enabled ?? false,
  }), [user?.clinic]);

  const [formData, setFormData] = useState<CreatePatientData>(emptyForm);

  useEffect(() => {
    if (!isOpen) {
      setFormData(emptyForm);
      setErrors({});
      setHasMedicalConditions(false);
      setHasAllergies(false);
      setHasMedications(false);
      return;
    }

    if (mode === 'edit' && patient) {
      setFormData(buildFormFromPatient(patient));
      setErrors({});
      setHasMedicalConditions(!!patient.medical_conditions);
      setHasAllergies(!!patient.allergies);
      setHasMedications(!!patient.medications);
    }
  }, [isOpen, mode, patient, emptyForm, buildFormFromPatient]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  // ── Location helpers ──────────────────────────────────────────────────────
  const handleProvinceChange = (val: string) => {
    setFormData((prev) => ({ ...prev, province: val, city: '' }));
    setErrors((prev)   => ({ ...prev, province: '', city: '' }));
  };

  const handleCityChange = (val: string) => {
    setFormData((prev) => ({ ...prev, city: val }));
    setErrors((prev)   => ({ ...prev, city: '' }));
  };

  const validate = (): Record<string, string> => {
    const newErrors: Record<string, string> = {};
    if (!formData.first_name.trim())   newErrors.first_name   = 'First name is required';
    if (!formData.last_name.trim())    newErrors.last_name    = 'Last name is required';
    if (!formData.date_of_birth)       newErrors.date_of_birth = 'Date of birth is required';
    if (!formData.phone.trim())        newErrors.phone        = 'Phone number is required';
    else if (!isValidPHPhone(formData.phone)) newErrors.phone = 'Enter a valid Philippine mobile number';
    if (!formData.address.trim())      newErrors.address      = 'Address is required';
    if (!formData.city.trim())         newErrors.city         = 'City is required';
    if (!formData.province.trim())     newErrors.province     = 'Province is required';
    if (!formData.emergency_contact_name.trim())
      newErrors.emergency_contact_name  = 'Emergency contact name is required';
    if (!formData.emergency_contact_phone.trim())
      newErrors.emergency_contact_phone = 'Emergency contact phone is required';
    else if (!isValidPHPhone(formData.emergency_contact_phone))
      newErrors.emergency_contact_phone = 'Enter a valid Philippine mobile number';
    if (!formData.emergency_contact_relationship.trim())
      newErrors.emergency_contact_relationship = 'Relationship is required';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = 'Invalid email format';
    if (formData.date_of_birth && new Date(formData.date_of_birth) > new Date())
      newErrors.date_of_birth = 'Date of birth cannot be in the future';
    setErrors(newErrors);
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      toast.error('Please fix the highlighted errors before submitting.', { id: 'patient-validation' });
      return;
    }
    setIsLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error: unknown) {
      const err = error as { response?: { data?: Record<string, string | string[]> } };
      const data = err.response?.data;
      if (data) {
        // Flatten potential array values from DRF
        const flat: Record<string, string> = {};
        Object.entries(data).forEach(([k, v]) => {
          flat[k] = Array.isArray(v) ? v[0] : (v as string);
        });
        setErrors(flat);
        if (flat.email)
          toast.error(flat.email, { id: 'patient-email-error' });
        else if (flat.phone)
          toast.error(flat.phone, { id: 'patient-phone-error' });
        else
          toast.error('Failed to save client. Please check the form and try again.');
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputBase  = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent';
  const inputError = 'border-red-300 bg-red-50';
  const labelBase  = 'block text-xs font-semibold text-gray-600 mb-1';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] pointer-events-auto overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {mode === 'create' ? 'Add New Client' : 'Edit Client'}
                </h2>
                <p className="text-xs text-gray-500">
                  {mode === 'create'
                    ? 'Enter client information'
                    : `Editing ${patient?.full_name || 'client'}`}
                </p>
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

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">

              {/* ── Personal Information ── */}
              <div>
                <div className="flex items-center gap-2 pb-2 mb-4 border-b border-gray-200">
                  <User className="w-4 h-4 text-sky-600" />
                  <h3 className="text-sm font-bold text-gray-700">Personal Information</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelBase}>First Name <span className="text-red-500">*</span></label>
                      <input
                        type="text" name="first_name" value={formData.first_name}
                        onChange={handleChange} placeholder="John"
                        className={`${inputBase} ${errors.first_name ? inputError : ''}`}
                      />
                      {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>}
                    </div>
                    <div>
                      <label className={labelBase}>Middle Name</label>
                      <input
                        type="text" name="middle_name" value={formData.middle_name}
                        onChange={handleChange} placeholder="D."
                        className={inputBase}
                      />
                    </div>
                    <div>
                      <label className={labelBase}>Last Name <span className="text-red-500">*</span></label>
                      <input
                        type="text" name="last_name" value={formData.last_name}
                        onChange={handleChange} placeholder="Doe"
                        className={`${inputBase} ${errors.last_name ? inputError : ''}`}
                      />
                      {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelBase}>Date of Birth <span className="text-red-500">*</span></label>
                      <input
                        type="date" name="date_of_birth" value={formData.date_of_birth}
                        onChange={handleChange}
                        max={new Date().toISOString().split('T')[0]}
                        className={`${inputBase} ${errors.date_of_birth ? inputError : ''}`}
                      />
                      {errors.date_of_birth && <p className="text-red-500 text-xs mt-1">{errors.date_of_birth}</p>}
                    </div>
                    <div>
                      <label className={labelBase}>Gender <span className="text-red-500">*</span></label>
                      <select name="gender" value={formData.gender} onChange={handleChange} className={inputBase}>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                        <option value="O">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Contact Information ── */}
              <div>
                <div className="flex items-center gap-2 pb-2 mb-4 border-b border-gray-200">
                  <MapPin className="w-4 h-4 text-sky-600" />
                  <h3 className="text-sm font-bold text-gray-700">Contact Information</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelBase}>Email</label>
                      <input
                        type="email" name="email" value={formData.email}
                        onChange={handleChange} placeholder="john.doe@example.com"
                        className={`${inputBase} ${errors.email ? inputError : ''}`}
                      />
                      {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                    </div>
                    <div>
                      <label className={labelBase}>Phone <span className="text-red-500">*</span></label>
                      <input
                        type="tel" name="phone" value={formData.phone}
                        onChange={(e) => {
                          const formatted = formatPHPhone(e.target.value);
                          setFormData((prev) => ({ ...prev, phone: formatted }));
                          if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                        }}
                        placeholder="(+63) 9XX XXX XXXX"
                        className={`${inputBase} ${errors.phone ? inputError : ''}`}
                      />
                      {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                    </div>
                  </div>

                  <div>
                    <label className={labelBase}>Street Address <span className="text-red-500">*</span></label>
                    <textarea
                      name="address" value={formData.address} onChange={handleChange}
                      rows={2} placeholder="Unit/Floor, Building, Street, Barangay…"
                      className={`${inputBase} resize-none ${errors.address ? inputError : ''}`}
                    />
                    {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PhLocationSelect
                      province={formData.province}
                      city={formData.city}
                      onProvinceChange={handleProvinceChange}
                      onCityChange={handleCityChange}
                      provinceError={errors.province}
                      cityError={errors.city}
                      required
                    />
                  </div>

                  <div className="sm:w-1/3">
                    <label className={labelBase}>Postal Code</label>
                    <input
                      type="text" name="postal_code" value={formData.postal_code}
                      onChange={handleChange} placeholder="1000"
                      className={inputBase}
                    />
                  </div>
                </div>
              </div>

              {/* ── Emergency Contact ── */}
              <div>
                <div className="flex items-center gap-2 pb-2 mb-4 border-b border-gray-200">
                  <Phone className="w-4 h-4 text-sky-600" />
                  <h3 className="text-sm font-bold text-gray-700">Emergency Contact</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className={labelBase}>Emergency Contact Name <span className="text-red-500">*</span></label>
                    <input
                      type="text" name="emergency_contact_name"
                      value={formData.emergency_contact_name} onChange={handleChange}
                      placeholder="Jane Doe"
                      className={`${inputBase} ${errors.emergency_contact_name ? inputError : ''}`}
                    />
                    {errors.emergency_contact_name && (
                      <p className="text-red-500 text-xs mt-1">{errors.emergency_contact_name}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelBase}>Emergency Contact Phone <span className="text-red-500">*</span></label>
                      <input
                        type="tel" name="emergency_contact_phone"
                        value={formData.emergency_contact_phone}
                        onChange={(e) => {
                          const formatted = formatPHPhone(e.target.value);
                          setFormData((prev) => ({ ...prev, emergency_contact_phone: formatted }));
                          if (errors.emergency_contact_phone) setErrors((prev) => ({ ...prev, emergency_contact_phone: '' }));
                        }}
                        placeholder="(+63) 9XX XXX XXXX"
                        className={`${inputBase} ${errors.emergency_contact_phone ? inputError : ''}`}
                      />
                      {errors.emergency_contact_phone && (
                        <p className="text-red-500 text-xs mt-1">{errors.emergency_contact_phone}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelBase}>Relationship <span className="text-red-500">*</span></label>
                      <input
                        type="text" name="emergency_contact_relationship"
                        value={formData.emergency_contact_relationship} onChange={handleChange}
                        placeholder="Spouse, Parent, Sibling…"
                        className={`${inputBase} ${errors.emergency_contact_relationship ? inputError : ''}`}
                      />
                      {errors.emergency_contact_relationship && (
                        <p className="text-red-500 text-xs mt-1">{errors.emergency_contact_relationship}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Medical Information ── */}
              <div>
                <div className="flex items-center gap-2 pb-2 mb-4 border-b border-gray-200">
                  <Heart className="w-4 h-4 text-sky-600" />
                  <h3 className="text-sm font-bold text-gray-700">Medical Information</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelBase}>PhilHealth Number</label>
                      <input
                        type="text" name="philhealth_number" value={formData.philhealth_number}
                        onChange={handleChange} placeholder="PH-123456789"
                        className={inputBase}
                      />
                    </div>
                    <div>
                      <label className={labelBase}>HMO Provider</label>
                      <input
                        type="text" name="hmo_provider" value={formData.hmo_provider}
                        onChange={handleChange} placeholder="Maxicare, PhilCare…"
                        className={inputBase}
                      />
                    </div>
                    <div>
                      <label className={labelBase}>HMO Number</label>
                      <input
                        type="text" name="hmo_number" value={formData.hmo_number}
                        onChange={handleChange} placeholder="MAX-123456"
                        className={inputBase}
                      />
                    </div>
                  </div>

                  {/* Medical Conditions Yes/No */}
                  <div>
                    <label className={labelBase}>Medical Conditions</label>
                    <div className="flex gap-2 mt-1 mb-2">
                      <button
                        type="button"
                        onClick={() => setHasMedicalConditions(true)}
                        className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${hasMedicalConditions ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                      >Yes</button>
                      <button
                        type="button"
                        onClick={() => { setHasMedicalConditions(false); setFormData(prev => ({ ...prev, medical_conditions: '' })); }}
                        className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${!hasMedicalConditions ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                      >No</button>
                    </div>
                    {hasMedicalConditions && (
                      <textarea
                        name="medical_conditions" value={formData.medical_conditions}
                        onChange={handleChange} rows={3}
                        placeholder="Current medical conditions…"
                        className={`${inputBase} resize-none`}
                      />
                    )}
                  </div>

                  {/* Allergies Yes/No */}
                  <div>
                    <label className={labelBase}>Allergies</label>
                    <div className="flex gap-2 mt-1 mb-2">
                      <button
                        type="button"
                        onClick={() => setHasAllergies(true)}
                        className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${hasAllergies ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                      >Yes</button>
                      <button
                        type="button"
                        onClick={() => { setHasAllergies(false); setFormData(prev => ({ ...prev, allergies: '' })); }}
                        className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${!hasAllergies ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                      >No</button>
                    </div>
                    {hasAllergies && (
                      <textarea
                        name="allergies" value={formData.allergies}
                        onChange={handleChange} rows={2}
                        placeholder="Known allergies…"
                        className={`${inputBase} resize-none`}
                      />
                    )}
                  </div>

                  {/* Current Medications Yes/No */}
                  <div>
                    <label className={labelBase}>Current Medications</label>
                    <div className="flex gap-2 mt-1 mb-2">
                      <button
                        type="button"
                        onClick={() => setHasMedications(true)}
                        className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${hasMedications ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                      >Yes</button>
                      <button
                        type="button"
                        onClick={() => { setHasMedications(false); setFormData(prev => ({ ...prev, medications: '' })); }}
                        className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${!hasMedications ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                      >No</button>
                    </div>
                    {hasMedications && (
                      <textarea
                        name="medications" value={formData.medications}
                        onChange={handleChange} rows={3}
                        placeholder="Current medications and dosages…"
                        className={`${inputBase} resize-none`}
                      />
                    )}
                  </div>

                  {/* ── Notification Preferences ── */}
                  <div className="pt-3 border-t border-gray-200">
                    <p className={`${labelBase} mb-3`}>Notification Preferences</p>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.send_email_notifications ?? true}
                          onChange={(e) => setFormData(prev => ({ ...prev, send_email_notifications: e.target.checked }))}
                          className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                        />
                        <div>
                          <p className="text-sm text-gray-900">Email notifications</p>
                          <p className="text-xs text-gray-500">Receive appointment reminders and updates via email</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.sms_notifications_enabled ?? false}
                          onChange={(e) => setFormData(prev => ({ ...prev, sms_notifications_enabled: e.target.checked }))}
                          className="w-4 h-4 text-sky-600 border-gray-300 rounded focus:ring-sky-500"
                        />
                        <div>
                          <p className="text-sm text-gray-900">SMS notifications</p>
                          <p className="text-xs text-gray-500">Receive appointment reminders via text message</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
              <button
                type="button" onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit" disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading
                  ? 'Saving…'
                  : mode === 'create' ? 'Add Client' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};