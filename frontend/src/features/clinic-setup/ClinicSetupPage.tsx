import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { PhLocationSelect } from '@/components/location/PhLocationSelect';
import { getMyClinic, setupClinicProfile } from '@/features/clinics/clinic.api';
import type { ClinicProfileSetupPayload } from '@/features/clinics/clinic.api';
import { ClinicLocationPicker } from '@/components/maps/ClinicLocationPicker';
import type { ReverseGeocodeResult } from '@/components/maps/ClinicLocationPicker';
import { forwardGeocode } from '@/utils/geocode';
import {
  Building2, MapPin, Phone, Mail, Globe,
  Upload, X, ChevronRight, CheckCircle2, Loader2, Edit3, Bell,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { invalidateClinicSettingsCache } from '@/hooks/useClinicSettings';

interface FormState {
  name:            string;
  email:           string;
  phone:           string;
  address:         string;
  city:            string;
  province:        string;
  postal_code:     string;
  website:         string;
  custom_location: string;
}

export const ClinicSetupPage: React.FC = () => {
  const navigate              = useNavigate();
  const { user, setAuth, tokens } = useAuthStore();

  const [isLoading,   setIsLoading]   = useState(false);
  const [clinicId,    setClinicId]    = useState<number | null>(null);
  const [logoFile,    setLogoFile]    = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [errors,      setErrors]      = useState<Partial<Record<keyof FormState, string>>>({});
  const [latitude,    setLatitude]    = useState<number | null>(null);
  const [longitude,   setLongitude]   = useState<number | null>(null);
  const [showManual,  setShowManual]  = useState(false);
  const [flyTarget,   setFlyTarget]   = useState<[number, number] | null>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const skipFwdRef     = useRef(false);  // prevents forward→reverse→forward loop

  const [form, setForm] = useState<FormState>({
    name:            '',
    email:           '',
    phone:           '',
    address:         '',
    city:            '',
    province:        '',
    postal_code:     '',
    website:         '',
    custom_location: '',
  });

  const [emailNotifEnabled, setEmailNotifEnabled] = useState(true);
  const [smsNotifEnabled,   setSmsNotifEnabled]   = useState(false);

  // Forward geocode: when province + city are both set, pan map to that area
  const fwdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (!form.province || !form.city) { setFlyTarget(null); return; }
    if (skipFwdRef.current) { skipFwdRef.current = false; return; }
    if (fwdTimerRef.current) clearTimeout(fwdTimerRef.current);
    fwdTimerRef.current = setTimeout(async () => {
      const coords = await forwardGeocode(form.city, form.province);
      if (coords) setFlyTarget(coords);
    }, 800);
    return () => { if (fwdTimerRef.current) clearTimeout(fwdTimerRef.current); };
  }, [form.province, form.city]);

  // Reverse geocode callback: fill province/city/address from map pin
  const handleReverseGeocode = useCallback((result: ReverseGeocodeResult) => {
    skipFwdRef.current = true; // don't re-trigger forward geocode
    setForm(prev => ({
      ...prev,
      ...(result.province && { province: result.province }),
      ...(result.city     && { city:     result.city }),
      ...(result.address  && !prev.address && { address: result.address }),
    }));
  }, []);

  // Load existing clinic data on mount
  React.useEffect(() => {
    const load = async () => {
      try {
        const clinic = await getMyClinic();
        setClinicId(clinic.id);
        const hasCustom = !!clinic.custom_location;
        setForm({
          name:            clinic.name            || '',
          email:           clinic.email           || '',
          phone:           clinic.phone           || '',
          address:         clinic.address         || '',
          city:            clinic.city            || '',
          province:        clinic.province        || '',
          postal_code:     clinic.postal_code     || '',
          website:         clinic.website         || '',
          custom_location: clinic.custom_location || '',
        });
        if (hasCustom) setShowManual(true);
        if (clinic.latitude  != null) setLatitude(Number(clinic.latitude));
        if (clinic.longitude != null) setLongitude(Number(clinic.longitude));
        setEmailNotifEnabled(clinic.email_notifications_enabled ?? true);
        setSmsNotifEnabled(clinic.sms_notifications_enabled     ?? false);
        if (clinic.logo_url) setLogoPreview(clinic.logo_url);
      } catch {
        toast.error('Could not load clinic data. Please refresh.');
      }
    };
    load();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB.');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.name.trim())  newErrors.name  = 'Clinic name is required.';
    if (!form.email.trim()) newErrors.email = 'Clinic email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                            newErrors.email = 'Invalid email format.';
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required.';

    const hasStandard = form.address.trim() && form.city.trim() && form.province.trim();
    const hasCustom   = form.custom_location.trim();
    if (!hasStandard && !hasCustom) {
      newErrors.address = 'Provide a street address + city + province, or enter a custom location.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !clinicId) return;

    setIsLoading(true);
    try {
      const payload: ClinicProfileSetupPayload = {
        name:                        form.name,
        email:                       form.email,
        phone:                       form.phone,
        address:                     form.address,
        city:                        form.city,
        province:                    form.province,
        postal_code:                 form.postal_code,
        website:                     form.website,
        custom_location:             form.custom_location,
        email_notifications_enabled: emailNotifEnabled,
        sms_notifications_enabled:   smsNotifEnabled,
        ...(latitude  != null && { latitude }),
        ...(longitude != null && { longitude }),
      };
      if (logoFile) payload.logo = logoFile;

      await setupClinicProfile(clinicId, payload);

      invalidateClinicSettingsCache();

      if (user && tokens) {
        setAuth({ ...user, clinic_setup_complete: true }, tokens);
      }

      toast.success('Clinic profile saved! Welcome to Malasakit EMR Solutions.');
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      // Show field-level errors from backend if present
      if (data && typeof data === 'object') {
        const fieldErrors: Partial<Record<keyof FormState, string>> = {};
        (Object.keys(data) as (keyof FormState)[]).forEach((key) => {
          const val = data[key];
          if (Array.isArray(val))         fieldErrors[key] = String((val as unknown[])[0]);
          else if (typeof val === 'string') fieldErrors[key] = val;
        });
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          toast.error('Please fix the errors below.');
          return;
        }
      }
      toast.error((data?.['detail'] as string) || 'Failed to save clinic profile.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Set Up Your Clinic Profile</h1>
          <p className="mt-2 text-gray-500 text-sm max-w-md mx-auto">
            Complete your clinic details to get started. You can update these anytime in Settings.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* ── Logo Upload ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 text-sky-500" />
              Clinic Logo
              <span className="text-xs font-normal text-gray-400">(optional)</span>
            </h2>
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden flex-shrink-0">
                {logoPreview
                  ? <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                  : <Building2 className="w-8 h-8 text-gray-300" />
                }
              </div>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                  id="logo-upload"
                />
                <div className="flex gap-3">
                  <label
                    htmlFor="logo-upload"
                    className="cursor-pointer px-4 py-2 text-sm font-medium text-sky-600 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors"
                  >
                    {logoPreview ? 'Change Logo' : 'Upload Logo'}
                  </label>
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="px-4 py-2 text-sm font-medium text-red-500 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1"
                    >
                      <X className="w-4 h-4" /> Remove
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-400">PNG, JPG, SVG up to 5 MB</p>
              </div>
            </div>
          </div>

          {/* ── Basic Info ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky-500" />
              Basic Information
            </h2>

            {/* Clinic Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Clinic Name <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Malasakit Health Clinic"
                className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-sky-400
                  ${errors.name ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-sky-400'}`}
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>

            {/* Phone + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="09XXXXXXXXX"
                  className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-sky-400
                    ${errors.phone ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-sky-400'}`}
                />
                {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  Clinic Email <span className="text-red-500">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="clinic@example.com"
                  className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-sky-400
                    ${errors.email ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-sky-400'}`}
                />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
              </div>
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-gray-400" /> Website
                <span className="text-xs font-normal text-gray-400 ml-1">(optional)</span>
              </label>
              <input
                name="website"
                value={form.website}
                onChange={handleChange}
                placeholder="https://yourclinic.com"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
              />
            </div>
          </div>

          {/* ── Location ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-sky-500" />
              Location
            </h2>

            {/* Street Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Street Address
              </label>
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                rows={2}
                placeholder="Unit/Floor, Building, Street"
                className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none
                  ${errors.address ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-sky-400'}`}
              />
              {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address}</p>}
            </div>

            {/* Province + City side-by-side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PhLocationSelect
                province={form.province}
                city={form.city}
                onProvinceChange={(val) => {
                  setForm(prev => ({ ...prev, province: val, city: '' }));
                  setErrors(prev => ({ ...prev, province: undefined, city: undefined }));
                }}
                onCityChange={(val) => {
                  setForm(prev => ({ ...prev, city: val }));
                  setErrors(prev => ({ ...prev, city: undefined }));
                }}
                provinceError={errors.province}
                cityError={errors.city}
              />
            </div>

            {/* Postal Code */}
            <div className="sm:w-1/3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
              <input
                name="postal_code"
                value={form.postal_code}
                onChange={handleChange}
                placeholder="6000"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
              />
            </div>

            {/* Manual location toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowManual(v => !v)}
                className="flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 font-medium transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {showManual ? 'Hide manual location' : 'Location not found? Enter manually'}
              </button>
              {showManual && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Location / Address
                  </label>
                  <input
                    name="custom_location"
                    value={form.custom_location}
                    onChange={handleChange}
                    placeholder="e.g. Purok Santan, Brgy. Alijis, Bacolod City"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Used when your location isn't in the standard list.
                  </p>
                </div>
              )}
            </div>

            {/* Leaflet Map */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-sky-500" />
                Pin Clinic Location
                <span className="text-xs font-normal text-gray-400 ml-1">(optional)</span>
              </label>
              <ClinicLocationPicker
                latitude={latitude}
                longitude={longitude}
                flyTarget={flyTarget}
                onReverseGeocode={handleReverseGeocode}
                onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }}
              />
            </div>
          </div>

          {/* ── Notification Preferences ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Bell className="w-4 h-4 text-sky-500" />
              Notification Preferences
            </h2>

            {/* Email Notifications */}
            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="mt-0.5 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={emailNotifEnabled}
                  onChange={(e) => setEmailNotifEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 group-hover:text-sky-700 transition-colors">
                  Email Notifications
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Master switch for all clinic emails — appointment reminders, booking confirmations, and welcome messages.
                  When disabled, no automated or manual emails will be sent from this clinic.
                </p>
              </div>
            </label>

            {/* SMS Notifications (placeholder) */}
            <label className="flex items-start gap-4 cursor-not-allowed opacity-50">
              <div className="mt-0.5 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={smsNotifEnabled}
                  disabled
                  className="w-4 h-4 rounded border-gray-300 text-gray-400 cursor-not-allowed"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  SMS Notifications
                  <span className="text-xs font-normal px-1.5 py-0.5 bg-sky-100 text-sky-600 rounded-full">
                    Coming Soon
                  </span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  SMS reminders and alerts will be available in a future update.
                </p>
              </div>
            </label>
          </div>

          {/* ── Submit ── */}
          <div className="flex items-center justify-between gap-4 pb-10">
            <p className="text-xs text-gray-400">
              Fields marked <span className="text-red-500">*</span> are required
            </p>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-sky-500 to-blue-600
                text-white font-semibold rounded-xl shadow-md hover:from-sky-600 hover:to-blue-700
                disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Complete Setup
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};