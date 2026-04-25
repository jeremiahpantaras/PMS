import React, { useState, useRef, useCallback } from 'react';
import { X, Loader2, GitBranch, Hash, Edit3, MapPin, Bell } from 'lucide-react';
import { PhLocationSelect } from '@/components/location/PhLocationSelect';
import { ClinicLocationPicker } from '@/components/maps/ClinicLocationPicker';
import type { ReverseGeocodeResult } from '@/components/maps/ClinicLocationPicker';
import { forwardGeocode } from '@/utils/geocode';
import type { ClinicBranch, CreateBranchData } from '@/types/clinic';
import { formatPHPhone, isValidPHPhone } from '@/utils/phoneFormatter';

const EMPTY_FORM = {
  location: '',
  email: '', phone: '', address: '',
  city: '', province: '', postal_code: '',
  custom_location: '',
};

interface CreateBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateBranchData) => Promise<void>;
  branch?: ClinicBranch | null;
  mode: 'create' | 'edit';
  saving: boolean;
  mainClinicName: string;
}

export const CreateBranchModal: React.FC<CreateBranchModalProps> = ({
  isOpen, onClose, onSave, branch, mode, saving, mainClinicName,
}) => {
  const [form, setForm]               = useState(EMPTY_FORM);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [latitude, setLatitude]       = useState<number | null>(null);
  const [longitude, setLongitude]     = useState<number | null>(null);
  const [showManual, setShowManual]   = useState(false);
  const [mapKey, setMapKey]           = useState(0);
  const [flyTarget, setFlyTarget]     = useState<[number, number] | null>(null);
  const [emailNotifEnabled, setEmailNotifEnabled] = useState(true);
  const [smsNotifEnabled,   setSmsNotifEnabled]   = useState(false);
  const skipFwdRef                    = useRef(false);
  const fwdTimerRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Forward geocode: pan map when province+city are both set
  React.useEffect(() => {
    if (!isOpen) return;
    if (!form.province || !form.city) { setFlyTarget(null); return; }
    if (skipFwdRef.current) { skipFwdRef.current = false; return; }
    if (fwdTimerRef.current) clearTimeout(fwdTimerRef.current);
    fwdTimerRef.current = setTimeout(async () => {
      const coords = await forwardGeocode(form.city, form.province);
      if (coords) setFlyTarget(coords);
    }, 800);
    return () => { if (fwdTimerRef.current) clearTimeout(fwdTimerRef.current); };
  }, [form.province, form.city, isOpen]);

  // Reverse geocode callback: fill province/city/address from map pin
  const handleReverseGeocode = useCallback((result: ReverseGeocodeResult) => {
    skipFwdRef.current = true;
    setForm(prev => ({
      ...prev,
      ...(result.province && { province: result.province }),
      ...(result.city     && { city:     result.city }),
      ...(result.address  && !prev.address && { address: result.address }),
    }));
  }, []);

  const isMainBranch = mode === 'edit' && !!branch?.is_main_branch;

  React.useEffect(() => {
    if (isOpen) {
      setMapKey((k) => k + 1);
      setFlyTarget(null);
      skipFwdRef.current = false;
      if (mode === 'edit' && branch) {
        const isMain = !!branch.is_main_branch;
        const hasCustom = !!(branch.custom_location);

        // Extract location suffix from the full branch name
        let location = branch.name;
        if (!isMain) {
          const prefix = mainClinicName + ' - ';
          if (branch.name.startsWith(prefix)) {
            location = branch.name.slice(prefix.length);
          } else {
            const sep = branch.name.indexOf(' - ');
            location = sep !== -1 ? branch.name.slice(sep + 3) : branch.name;
          }
        }

        setForm({
          location,
          email:           branch.email           || '',
          phone:           branch.phone ? formatPHPhone(branch.phone) : '',
          address:         branch.address         || '',
          city:            branch.city            || '',
          province:        branch.province        || '',
          postal_code:     branch.postal_code     || '',
          custom_location: branch.custom_location || '',
        });
        setShowManual(hasCustom);
        setLatitude(branch.latitude  != null ? Number(branch.latitude)  : null);
        setLongitude(branch.longitude != null ? Number(branch.longitude) : null);
        if (isMain) {
          setEmailNotifEnabled(branch.email_notifications_enabled ?? true);
          setSmsNotifEnabled(branch.sms_notifications_enabled     ?? false);
        }
      } else {
        setForm(EMPTY_FORM);
        setShowManual(false);
        setLatitude(null);
        setLongitude(null);
        setEmailNotifEnabled(true);
        setSmsNotifEnabled(false);
      }
      setErrors({});
    }
  }, [isOpen, mode, branch, mainClinicName]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const formatted = name === 'phone' ? formatPHPhone(value) : value;
    setForm((prev) => ({ ...prev, [name]: formatted }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const composedName = isMainBranch
    ? form.location.trim() || mainClinicName
    : form.location.trim()
      ? `${mainClinicName} - ${form.location.trim()}`
      : mainClinicName;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.location.trim()) errs.location = 'Location / barangay name is required';
    if (!form.email.trim())    errs.email    = 'Email is required';
    if (!form.phone.trim())    errs.phone    = 'Phone is required';
    else if (!isValidPHPhone(form.phone)) errs.phone = 'Enter a valid Philippine mobile number';
    if (!form.address.trim())  errs.address  = 'Address is required';
    if (!form.city.trim())     errs.city     = 'City is required';
    if (!form.province.trim()) errs.province = 'Province is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Invalid email format';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const payload: CreateBranchData = {
      name:            composedName,
      email:           form.email,
      phone:           form.phone,
      address:         form.address,
      city:            form.city,
      province:        form.province,
      postal_code:     form.postal_code,
      custom_location: form.custom_location || undefined,
      ...(latitude  != null && { latitude }),
      ...(longitude != null && { longitude }),
      ...(isMainBranch && {
        email_notifications_enabled: emailNotifEnabled,
        sms_notifications_enabled:   smsNotifEnabled,
      }),
    };
    await onSave(payload);
  };

  if (!isOpen) return null;

  const inputBase =
    'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent';
  const inputErr  = 'border-red-300 bg-red-50';
  const labelBase = 'block text-xs font-semibold text-gray-600 mb-1';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl pointer-events-auto max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <GitBranch className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {mode === 'create' ? 'Create New Branch' : 'Edit Branch'}
                </h2>
                <p className="text-xs text-gray-500">
                  {mode === 'create'
                    ? `Adding a branch under ${mainClinicName}`
                    : `Editing: ${branch?.name}`}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* Auto-generated ID notice */}
              {mode === 'create' && (
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex items-start gap-2">
                  <Hash className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-sky-700">Auto-generated Branch ID</p>
                    <p className="text-xs text-sky-600 mt-0.5">
                      A unique ID will be assigned automatically.&nbsp;
                      <span className="font-mono font-bold">
                        {mainClinicName.replace(/\s+/g, '').replace(/[^A-Za-z0-9]/g, '')}-000X
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* Edit: read-only branch code */}
              {mode === 'edit' && branch?.branch_code && (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                  <Hash className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Branch ID</p>
                    <p className="text-sm font-mono font-bold text-gray-800">{branch.branch_code}</p>
                  </div>
                  <span className="ml-auto text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                    Auto-generated
                  </span>
                </div>
              )}

              {/* Branch Name composer */}
              <div>
                <label className={labelBase}>
                  {isMainBranch ? 'Clinic Name' : 'Branch Name'} <span className="text-red-500">*</span>
                </label>
                {isMainBranch ? (
                  <>
                    <input
                      type="text"
                      name="location"
                      value={form.location}
                      onChange={handleChange}
                      placeholder="Clinic name"
                      className={`${inputBase} ${errors.location ? inputErr : ''}`}
                    />
                    {errors.location && (
                      <p className="text-red-500 text-xs mt-1">{errors.location}</p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-0 mb-2 rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-transparent">
                      <span className="px-3 py-2 text-sm font-medium bg-gray-100 text-gray-500 border-r border-gray-300 whitespace-nowrap flex-shrink-0">
                        {mainClinicName} —
                      </span>
                      <input
                        type="text"
                        name="location"
                        value={form.location}
                        onChange={handleChange}
                        placeholder="Barangay / Location name"
                        className="flex-1 px-3 py-2 text-sm focus:outline-none bg-white"
                      />
                    </div>
                    {errors.location && (
                      <p className="text-red-500 text-xs mt-1">{errors.location}</p>
                    )}
                    {form.location.trim() && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        Full name preview:&nbsp;
                        <span className="font-medium text-gray-700">{composedName}</span>
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelBase}>
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email" name="email" value={form.email} onChange={handleChange}
                    placeholder="branch@clinic.com"
                    className={`${inputBase} ${errors.email ? inputErr : ''}`}
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className={labelBase}>
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel" name="phone" value={form.phone} onChange={handleChange}
                    placeholder="(+63) 9XX XXX XXXX"
                    className={`${inputBase} ${errors.phone ? inputErr : ''}`}
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
              </div>

              {/* Address */}
              <div>
                <label className={labelBase}>
                  Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" name="address" value={form.address} onChange={handleChange}
                  placeholder="Street address, Barangay"
                  className={`${inputBase} ${errors.address ? inputErr : ''}`}
                />
                {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
              </div>

              {/* ── Province + City via PhLocationSelect ── */}
              <PhLocationSelect
                province={form.province}
                city={form.city}
                onProvinceChange={(val) => {
                  setForm((prev) => ({ ...prev, province: val, city: '' }));
                  if (errors.province) setErrors((prev) => ({ ...prev, province: '' }));
                }}
                onCityChange={(val) => {
                  setForm((prev) => ({ ...prev, city: val }));
                  if (errors.city) setErrors((prev) => ({ ...prev, city: '' }));
                }}
                provinceError={errors.province}
                cityError={errors.city}
                required
              />

              {/* Postal Code */}
              <div>
                <label className={labelBase}>Postal Code</label>
                <input
                  type="text" name="postal_code" value={form.postal_code} onChange={handleChange}
                  placeholder="1634"
                  className={inputBase}
                />
              </div>

              {/* Manual location toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowManual((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 font-medium transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {showManual ? 'Hide manual location' : 'Location not found? Enter manually'}
                </button>
                {showManual && (
                  <div className="mt-2">
                    <label className={labelBase}>Custom Location / Address</label>
                    <input
                      type="text"
                      name="custom_location"
                      value={form.custom_location}
                      onChange={handleChange}
                      placeholder="e.g. Purok Santan, Brgy. Alijis, Bacolod City"
                      className={inputBase}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Used when the location isn't in the standard list.
                    </p>
                  </div>
                )}
              </div>

              {/* Leaflet map */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-sky-500" />
                  Pin Branch Location
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <ClinicLocationPicker
                  key={mapKey}
                  latitude={latitude}
                  longitude={longitude}
                  flyTarget={flyTarget}
                  onReverseGeocode={handleReverseGeocode}
                  onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }}
                />
              </div>

              {/* Subscription inheritance note */}
              {mode === 'create' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                  <GitBranch className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    This branch will inherit the subscription plan from the main clinic.
                  </p>
                </div>
              )}

              

              {/* ── Notification Preferences (main branch only) ── */}
              {isMainBranch && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Bell className="w-4 h-4 text-sky-500" />
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      Notification Preferences
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 -mt-1">
                    These settings apply to all branches. Only the main branch controls them.
                  </p>

                  {/* Email */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="mt-0.5 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={emailNotifEnabled}
                        onChange={(e) => setEmailNotifEnabled(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-800 group-hover:text-sky-700 transition-colors">
                        Email Notifications
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Appointment reminders, booking confirmations, and welcome messages.
                        When disabled, no automated or manual emails are sent from any branch.
                      </p>
                    </div>
                  </label>

                  {/* SMS (placeholder) */}
                  <label className="flex items-start gap-3 cursor-not-allowed opacity-50">
                    <div className="mt-0.5 flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={smsNotifEnabled}
                        disabled
                        className="w-4 h-4 rounded border-gray-300 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                        SMS Notifications
                        <span className="text-xs px-1.5 py-0.5 bg-sky-100 text-sky-600 rounded-full font-normal">
                          Coming Soon
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        SMS reminders will be available in a future update.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Notification note for non-main branches (edit mode) */}
              {mode === 'edit' && !isMainBranch && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-start gap-2">
                  <Bell className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-500">
                    Notification preferences are managed by the main branch and apply to all locations.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                type="button" onClick={onClose} disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit" disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving...</>
                  : <><GitBranch className="w-3.5 h-3.5" />{mode === 'create' ? 'Create Branch' : 'Save Changes'}</>
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};