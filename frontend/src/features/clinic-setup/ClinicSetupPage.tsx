import React, { useState, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import MalasakitLogo from '@/assets/malasakit/PrimaryLogo-Colored.svg';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { PhLocationSelect } from '@/components/location/PhLocationSelect';
import { 
  getMyClinic, 
  setupClinicProfile, 
  getClinicBranches, 
  createClinicBranch,
} from '@/features/clinics/clinic.api';
import type { ClinicProfileSetupPayload } from '@/features/clinics/clinic.api';
import { ClinicLocationPicker } from '@/components/maps/ClinicLocationPicker';
import type { ReverseGeocodeResult } from '@/components/maps/ClinicLocationPicker';
import { forwardGeocode } from '@/utils/geocode';
import {
  Building2, MapPin, Phone, Mail, Globe,
  Upload, X, ChevronRight, CheckCircle2, Loader2, Edit3, Bell,
  Users, Stethoscope, Plus, Briefcase, Clock,
  DollarSign, AlertCircle, Minus, FileText
} from 'lucide-react';
import { BranchConsentFormModal } from './components/BranchConsentFormModal';
import toast from 'react-hot-toast';
import { invalidateClinicSettingsCache } from '@/hooks/useClinicSettings';
import { formatPHPhone, isValidPHPhone } from '@/utils/phoneFormatter';
import { validateEmailDetailed, validatePHPhoneDetailed } from '@/utils/validation';
import { useStaffManagement } from '@/features/setup/hooks/useStaffManagement';
import { useClinicServices } from '@/features/manage/hooks/useClinicServices';
import type { ClinicBranch, CreateBranchData } from '@/types/clinic';
import type { StaffMember, CreateStaffData } from '@/features/setup/types/staff.types';
import type { ClinicService, ClinicServicePayload } from '@/features/manage/services/clinic-services.api';

// Lazy-load heavy modals to keep initial bundle small
const CreateBranchModal = lazy(() =>
  import('@/features/setup/pages/practice/components/CreateBranchModal').then(
    (m) => ({ default: m.CreateBranchModal }),
  ),
);
const CreateStaffAccountModal = lazy(() =>
  import('@/features/setup/components/modals/CreateStaffAccountModal').then(
    (m) => ({ default: m.CreateStaffAccountModal }),
  ),
);
const ServiceFormModal = lazy(() =>
  import('@/features/manage/pages/clinical/components/ServiceFormModal').then(
    (m) => ({ default: m.ServiceFormModal }),
  ),
);

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

// ── Small helpers ──────────────────────────────────────────────────────────────

/** Section header used throughout the page */
const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  done: boolean;
  step: number;
  skipped?: boolean;
}> = ({ icon, title, subtitle, done, step, skipped }) => (
  <div className="flex items-start gap-3 mb-5">
    <div
      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
        done
          ? 'bg-linear-to-br from-emerald-400 to-teal-500'
          : skipped
          ? 'bg-gray-100'
          : 'bg-primary-gradient'
      }`}
    >
      {done ? <CheckCircle2 className="w-4 h-4 text-white" /> : skipped ? <Minus className="w-4 h-4 text-gray-400" /> : icon}
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Step {step}
        </span>
        {done && (
          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
            ✓ Done
          </span>
        )}
        {!done && skipped && (
          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-full">
            — Skipped
          </span>
        )}
      </div>
      <h2 className="text-base font-bold text-gray-900 mt-0.5">{title}</h2>
      <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
    </div>
  </div>
);

export const ClinicSetupPage: React.FC = () => {
  const navigate              = useNavigate();
  const { user, setAuth, tokens } = useAuthStore();

  // ── Section 1: Clinic Profile state (unchanged) ────────────────────────────
  const [isFinishing, setIsFinishing] = useState(false);
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

  // ── (Removed old global consent form state) ────────────────────────────────

  // ── Section 2: Branches state ──────────────────────────────────────────────
  const [branches,        setBranches]        = useState<ClinicBranch[]>([]);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [branchSaving,    setBranchSaving]    = useState(false);
  const [step2Skipped,    setStep2Skipped]    = useState(false);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [selectedConsentBranchId, setSelectedConsentBranchId] = useState<number | null>(null);

  // We maintain a quick map of which branch has consent enabled/disabled for the List View
  const [consentStatuses, setConsentStatuses] = useState<Record<number, { is_active: boolean; updated_at: string | null }>>({});

  // ── Section 3: Staff & Practitioners state ────────────────────────────
  const {
    staff,
    createStaff: doCreateStaff,
    updateStaff: doUpdateStaff,
  } = useStaffManagement();
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff,   setEditingStaff]   = useState<StaffMember | null>(null);
  const [step3Skipped,   setStep3Skipped]   = useState(false);

  // ── Section 4: Services state ──────────────────────────────────────────────
  const { services, createService, updateService } = useClinicServices();
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService,   setEditingService]   = useState<ClinicService | null>(null);
  const [step4Skipped,     setStep4Skipped]     = useState(false);

  // ── Scroll refs ────────────────────────────────────────────────────────────
  const branchesRef  = useRef<HTMLDivElement>(null);
  const staffRef     = useRef<HTMLDivElement>(null);
  const servicesRef  = useRef<HTMLDivElement>(null);
  const saveRef      = useRef<HTMLDivElement>(null);

  // ── Forward geocode: pan map when province + city are both set ────────────
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

  // ── Reverse geocode callback: fill province/city/address from map pin ──────
  const handleReverseGeocode = useCallback((result: ReverseGeocodeResult) => {
    skipFwdRef.current = true; // don't re-trigger forward geocode
    setForm(prev => ({
      ...prev,
      ...(result.province && { province: result.province }),
      ...(result.city     && { city:     result.city }),
      ...(result.address  && !prev.address && { address: result.address }),
    }));
  }, []);

  // ── Derived completion state ──────────────────────────────────────────────
  const hasPractitioner = useMemo(
    () => staff.some((s) => {
      const r = s.roles && s.roles.length > 0 ? s.roles : [s.role];
      return r.includes('PRACTITIONER');
    }),
    [staff],
  );
  const step1Complete = useMemo(() => {
    const emailOk = !!form.email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
    const phoneOk = !!form.phone.trim() && isValidPHPhone(form.phone);
    const locOk   = (!!form.address.trim() && !!form.city.trim() && !!form.province.trim())
                  || !!form.custom_location.trim();
    return !!form.name.trim() && emailOk && phoneOk && locOk;
  }, [form]);
  const completedCount = [
    step1Complete,
    branches.length > 0,
    hasPractitioner,
    services.length > 0,
  ].filter(Boolean).length;

  // ── Load clinic data + branches on mount ───────────────────────────────────
  React.useEffect(() => {
    const load = async () => {
      try {
        const [clinic, branchRes] = await Promise.all([
          getMyClinic(),
          getClinicBranches().catch(() => ({ branches: [] as ClinicBranch[], main_clinic_id: 0 })),
        ]);
        setClinicId(clinic.id);
        const hasCustom = !!clinic.custom_location;
        setForm({
          name:            clinic.name            || '',
          email:           clinic.email           || '',
          phone:           clinic.phone ? formatPHPhone(clinic.phone) : '',
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
        // Store the full branches list returned by backend directly
        setBranches(branchRes.branches);
        
        // (Consent forms are now fetched individually in BranchConsentFormEditor)
        
        // (step1Complete is derived automatically from form values)
      } catch {
        toast.error('Could not load clinic data. Please refresh.');
      }
    };
    load();
  }, []);

  // ── Reload Consent Statuses ──────────────────────────────────────────────
  const reloadConsentStatuses = useCallback(async (branchesToLoad: { id: number }[]) => {
    // Dynamically import to avoid circular dependencies if any, but we can just use the api
    const { getBranchConsentForm } = await import('@/features/clinics/clinic.api');
    const newStatuses: Record<number, { is_active: boolean; updated_at: string | null }> = {};
    
    await Promise.allSettled(
      branchesToLoad.map(async (b) => {
        try {
          const consent = await getBranchConsentForm(b.id);
          if (consent && Object.keys(consent).length > 0) {
            newStatuses[b.id] = {
              is_active: consent.is_active || false,
              updated_at: consent.updated_at || consent.created_at || null,
            };
          } else {
            newStatuses[b.id] = { is_active: false, updated_at: null };
          }
        } catch (e: any) {
          console.error(e);
          newStatuses[b.id] = { is_active: false, updated_at: null };
        }
      })
    );
    setConsentStatuses(prev => ({ ...prev, ...newStatuses }));
  }, []);

  React.useEffect(() => {
    if (branches.length > 0) {
      reloadConsentStatuses(branches);
    }
  }, [branches, reloadConsentStatuses]);

  const accessibleBranches = useMemo(() => {
    return branches.map(b => ({
      id: b.id,
      name: b.is_main_branch ? `${b.name} (Main Branch)` : b.name
    }));
  }, [branches]);

  // ── Clinic form handlers (unchanged) ─────────────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const formatted = name === 'phone' ? formatPHPhone(value) : value;
    setForm(prev => ({ ...prev, [name]: formatted }));

    // Real-time detailed validation for email and phone
    if (name === 'email') {
      const msg = validateEmailDetailed(value);
      setErrors(prev => ({ ...prev, email: msg || undefined }));
    } else if (name === 'phone') {
      const msg = validatePHPhoneDetailed(formatted);
      setErrors(prev => ({ ...prev, phone: msg || undefined }));
    } else {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'email') {
      const msg = validateEmailDetailed(value);
      setErrors(prev => ({ ...prev, email: msg || undefined }));
    } else if (name === 'phone') {
      const msg = validatePHPhoneDetailed(value);
      setErrors(prev => ({ ...prev, phone: msg || undefined }));
    }
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

  // ── Section 2: Branch handlers ─────────────────────────────────────────────
  const handleBranchSave = async (data: CreateBranchData) => {
    if (!clinicId) throw new Error('Save clinic profile first.');
    setBranchSaving(true);
    try {
      const created = await createClinicBranch(clinicId, data);
      setBranches((prev) => [...prev, created]);
      setBranchModalOpen(false);
      toast.success(`Branch "${created.name}" added.`);
      setTimeout(() => staffRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to create branch.';
      toast.error(msg);
      throw err;
    } finally {
      setBranchSaving(false);
    }
  };

  // ── Section 3: Staff handlers ─────────────────────────────────────────────
  const handleStaffSubmit = async (data: CreateStaffData) => {
    if (editingStaff) {
      await doUpdateStaff(editingStaff.id, data);
    } else {
      await doCreateStaff(data);
    }
    setStaffModalOpen(false);
    setEditingStaff(null);
  };

  // ── Section 4: Service handlers ────────────────────────────────────────────
  const handleServiceSubmit = async (payload: ClinicServicePayload) => {
    if (editingService) {
      await updateService(editingService.id, payload);
    } else {
      await createService(payload);
    }
    setServiceModalOpen(false);
    setEditingService(null);
  };

  // ── Final: Finish Setup — saves all collected data at once ─────────────────
  const handleFinishSetup = async () => {
    if (!clinicId) return;

    // Run field-level validation and show detailed errors before submitting
    const emailErr = validateEmailDetailed(form.email);
    const phoneErr = validatePHPhoneDetailed(form.phone);
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (emailErr) newErrors.email = emailErr;
    if (phoneErr) newErrors.phone = phoneErr;
    if (!form.name.trim()) newErrors.name = 'Clinic name is required';
    const locOk = (!!form.address.trim() && !!form.city.trim() && !!form.province.trim())
               || !!form.custom_location.trim();
    if (!locOk) newErrors.address = 'Please provide a city, province, and street address (or use the manual field)';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fix the highlighted errors before saving.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!step1Complete) {
      toast.error('Please complete Step 1 (Clinic Profile) first.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // (Consent validation moved to BranchConsentFormEditor)

    setIsFinishing(true);
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

      // (Consent form saving is now handled in BranchConsentFormEditor separately)

      invalidateClinicSettingsCache();
      if (user && tokens) {
        setAuth({ ...user, clinic_setup_complete: true }, tokens);
      }
      toast.success('Setup complete! Welcome to Malasakit.');
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      toast.error((data?.['detail'] as string) || 'Failed to complete setup. Please try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsFinishing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F9FAFB] py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── PAGE HEADER ── */}
        <div className="text-center pt-2">
          <img
            src={MalasakitLogo}
            alt="Malasakit"
            className="h-7 mx-auto mb-5"
          />
          <h1 className="text-2xl font-bold text-gray-900">Clinic Onboarding</h1>
          <p className="mt-1.5 text-sm text-gray-400 max-w-sm mx-auto">
            Complete all four steps to finish setting up your clinic.
          </p>
        </div>

        {/* ── PROGRESS BAR ── */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-sm font-semibold text-gray-700">Setup Progress</p>
            <p className="text-xs font-bold text-[#0575E6]">{completedCount} / 4 steps</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-primary-gradient transition-all duration-500"
              style={{ width: `${(completedCount / 4) * 100}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {[
              { label: 'Clinic',   done: step1Complete },
              { label: 'Branches', done: branches.length > 0 },
              { label: 'Staff',    done: hasPractitioner },
              { label: 'Services', done: services.length > 0 },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    step.done
                      ? 'bg-[#5CDB95] text-white'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                  }`}
                >
                  {step.done ? '✓' : i + 1}
                </div>
                <span className={`text-[10px] font-medium ${step.done ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ══ SECTION 1 — CLINIC PROFILE ══ */}
        <div className="bg-white rounded-lg border border-[#EAECEF] p-5">
          <SectionHeader
            step={1}
            icon={<Building2 className="w-4 h-4 text-white" />}
            title="Clinic Profile"
            subtitle="Basic info, location, logo, and notification preferences."
            done={step1Complete}
          />

          <form onSubmit={(e) => e.preventDefault()} className="space-y-5">

            {/* Logo Upload */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2.5 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-[#0575E6]" />
                Clinic Logo
                <span className="text-xs font-normal text-gray-400">(optional)</span>
              </label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-md border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
                  {logoPreview
                    ? <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                    : <Building2 className="w-6 h-6 text-gray-300" />
                  }
                </div>
                <div className="flex-1">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" id="logo-upload" />
                  <div className="flex gap-2 flex-wrap">
                    <label htmlFor="logo-upload" className="cursor-pointer px-3 py-1.5 text-xs font-medium text-[#0575E6] bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors">
                      {logoPreview ? 'Change Logo' : 'Upload Logo'}
                    </label>
                    {logoPreview && (
                      <button type="button" onClick={removeLogo} className="px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors flex items-center gap-1">
                        <X className="w-3 h-3" /> Remove
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-gray-400">PNG, JPG, SVG — max 5 MB</p>
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-[#556A73] uppercase tracking-widest">Basic Information</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Clinic Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name" value={form.name} onChange={handleChange}
                  placeholder="e.g. Malasakit Health Clinic"
                  className={`w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${errors.name ? 'border-red-400 bg-red-50' : 'border-[#E5E7EB] focus:border-blue-400'}`}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-gray-400" /> Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="phone" value={form.phone} onChange={handleChange} onBlur={handleBlur}
                    placeholder="(+63) 9XX XXX XXXX"
                    className={`w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${errors.phone ? 'border-red-400 bg-red-50' : 'border-[#E5E7EB] focus:border-blue-400'}`}
                  />
                  {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-gray-400" /> Clinic Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="email" type="email" value={form.email} onChange={handleChange} onBlur={handleBlur}
                    placeholder="clinic@example.com"
                    className={`w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${errors.email ? 'border-red-400 bg-red-50' : 'border-[#E5E7EB] focus:border-blue-400'}`}
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-gray-400" /> Website
                  <span className="text-xs font-normal text-gray-400 ml-1">(optional)</span>
                </label>
                <input
                  name="website" value={form.website} onChange={handleChange}
                  placeholder="https://yourclinic.com"
                  className="w-full px-3 py-2 rounded-md border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-[#556A73] uppercase tracking-widest flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Location
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                <textarea
                  name="address" value={form.address} onChange={handleChange} rows={2}
                  placeholder="Unit/Floor, Building, Street"
                  className={`w-full px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none ${errors.address ? 'border-red-400 bg-red-50' : 'border-[#E5E7EB] focus:border-blue-400'}`}
                />
                {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="sm:w-1/3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                <input
                  name="postal_code" value={form.postal_code} onChange={handleChange}
                  placeholder="6000"
                  className="w-full px-3 py-2 rounded-md border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                />
              </div>
              <div>
                <button type="button" onClick={() => setShowManual(v => !v)} className="flex items-center gap-1.5 text-xs text-[#0575E6] hover:text-blue-700 font-medium transition-colors">
                  <Edit3 className="w-3 h-3" />
                  {showManual ? 'Hide manual location' : 'Location not found? Enter manually'}
                </button>
                {showManual && (
                  <div className="mt-2.5">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Custom Location / Address</label>
                    <input
                      name="custom_location" value={form.custom_location} onChange={handleChange}
                      placeholder="e.g. Purok Santan, Brgy. Alijis, Bacolod City"
                      className="w-full px-3 py-2 rounded-md border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                    />
                    <p className="mt-1 text-xs text-gray-400">Used when your location isn't in the standard list.</p>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#0575E6]" /> Pin Clinic Location
                  <span className="text-xs font-normal text-gray-400 ml-1">(optional)</span>
                </label>
                <ClinicLocationPicker
                  latitude={latitude} longitude={longitude} flyTarget={flyTarget}
                  onReverseGeocode={handleReverseGeocode}
                  onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }}
                />
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-[#556A73] uppercase tracking-widest flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" /> Notifications
              </p>
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-0.5 shrink-0">
                  <input type="checkbox" checked={emailNotifEnabled} onChange={(e) => setEmailNotifEnabled(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700 transition-colors">Email Notifications</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Master switch for appointment reminders, booking confirmations, and welcome messages.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-not-allowed opacity-50">
                <div className="mt-0.5 shrink-0">
                  <input type="checkbox" checked={smsNotifEnabled} disabled className="w-4 h-4 rounded border-gray-300 text-gray-400 cursor-not-allowed" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    SMS Notifications
                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded-full">Coming Soon</span>
                  </p>
                </div>
              </label>
            </div>

            {/* (Consent form setup moved to a dedicated section) */}

            <p className="text-xs text-gray-400 pt-3 border-t border-gray-100">Fields marked <span className="text-red-500">*</span> are required</p>
          </form>
        </div>

        {/* ══ SECTION 2 — BRANCHES ══ */}
        <div ref={branchesRef} className="bg-white rounded-lg border border-[#EAECEF] p-5">
          <SectionHeader
            step={2}
            icon={<MapPin className="w-4 h-4 text-white" />}
            title="Clinic Branches"
            subtitle="Add and manage your clinic locations."
            done={branches.length > 0}
            skipped={step2Skipped && branches.length === 0}
          />

          {step2Skipped && branches.length === 0 ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep2Skipped(false)}
                className="text-xs text-[#0575E6] hover:text-blue-700 font-medium transition-colors"
              >
                Expand
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!step1Complete) {
                    toast.error('Please complete Step 1 first.');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                  }
                  setStep2Skipped(false);
                  setBranchModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-gradient text-white text-sm font-semibold rounded-md hover:opacity-90 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Branch
              </button>
            </div>
          ) : (
            <>
              {branches.length > 0 && (
                <div className="space-y-2 mb-4">
                  {branches.map((b) => (
                    <div key={b.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-md border border-gray-100">
                      <div className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-[#0575E6]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{b.name}</p>
                        {b.address && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {[b.address, b.city, b.province].filter(Boolean).join(', ')}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {b.phone && <span className="text-xs text-gray-400">{b.phone}</span>}
                          {b.email && <span className="text-xs text-gray-400">{b.email}</span>}
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                        Added
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {branches.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-gray-200 rounded-lg mb-4">
                  <MapPin className="w-8 h-8 text-gray-200 mb-2" />
                  <p className="text-sm font-medium text-gray-400">No branches added yet</p>
                  <p className="text-xs text-gray-300 mt-0.5">Add your first branch location below.</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!step1Complete) {
                      toast.error('Please complete Step 1 first.');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      return;
                    }
                    setBranchModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-gradient text-white text-sm font-semibold rounded-md hover:opacity-90 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Branch
                </button>
                <button
                  type="button"
                  onClick={() => { setStep2Skipped(true); staffRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Skip for now <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* ══ SECTION 3 — STAFF & PRACTITIONERS ══ */}
        <div ref={staffRef} className="bg-white rounded-lg border border-[#EAECEF] p-5">
          <SectionHeader
            step={3}
            icon={<Users className="w-4 h-4 text-white" />}
            title="Staff & Practitioners"
            subtitle="Add your team and assign roles and schedules."
            done={hasPractitioner}
            skipped={step3Skipped && !hasPractitioner}
          />

          {step3Skipped && !hasPractitioner ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep3Skipped(false)}
                className="text-xs text-[#0575E6] hover:text-blue-700 font-medium transition-colors"
              >
                Expand
              </button>
              <button
                type="button"
                onClick={() => { setStep3Skipped(false); setEditingStaff(null); setStaffModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-gradient text-white text-sm font-semibold rounded-md hover:opacity-90 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Staff / Practitioner
              </button>
            </div>
          ) : (
            <>
              {staff.length > 0 && (
                <div className="space-y-2 mb-4">
                  {staff.map((member) => {
                    const effectiveRoles = member.roles && member.roles.length > 0 ? member.roles : [member.role];
                    const isPractitioner = effectiveRoles.includes('PRACTITIONER');
                    return (
                      <div key={member.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-md border border-gray-100">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${isPractitioner ? 'bg-purple-50' : 'bg-blue-50'}`}>
                          {isPractitioner
                            ? <Stethoscope className="w-4 h-4 text-purple-500" />
                            : <Briefcase className="w-4 h-4 text-[#0575E6]" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">
                              {member.first_name} {member.last_name}
                            </p>
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${
                              isPractitioner
                                ? 'text-purple-700 bg-purple-50 border-purple-200'
                                : 'text-blue-700 bg-blue-50 border-blue-200'
                            }`}>
                              {member.role}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{member.email}</p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {member.clinic_branch_name && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />{member.clinic_branch_name}
                              </span>
                            )}
                            {member.availability?.duty_days && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />{member.availability.duty_days.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setEditingStaff(member); setStaffModalOpen(true); }}
                          className="text-xs text-gray-400 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-blue-50 shrink-0"
                        >
                          Edit
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {staff.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-gray-200 rounded-lg mb-4">
                  <Users className="w-8 h-8 text-gray-200 mb-2" />
                  <p className="text-sm font-medium text-gray-400">No staff added yet</p>
                  <p className="text-xs text-gray-300 mt-0.5">Add at least 1 practitioner to continue.</p>
                </div>
              )}

              {!hasPractitioner && staff.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-xs mb-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  At least 1 staff member must have the <strong>Practitioner</strong> role to complete setup.
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setEditingStaff(null); setStaffModalOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-gradient text-white text-sm font-semibold rounded-md hover:opacity-90 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Staff / Practitioner
                </button>
                <button
                  type="button"
                  onClick={() => { setStep3Skipped(true); servicesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Skip for now <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* ══ SECTION 4 — CLINIC SERVICES ══ */}
        <div ref={servicesRef} className="bg-white rounded-lg border border-[#EAECEF] p-5">
          <SectionHeader
            step={4}
            icon={<Stethoscope className="w-4 h-4 text-white" />}
            title="Clinic Services"
            subtitle="Define the services your clinic offers to patients."
            done={services.length > 0}
            skipped={step4Skipped && services.length === 0}
          />

          {step4Skipped && services.length === 0 ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep4Skipped(false)}
                className="text-xs text-[#0575E6] hover:text-blue-700 font-medium transition-colors"
              >
                Expand
              </button>
              <button
                type="button"
                onClick={() => { setStep4Skipped(false); setEditingService(null); setServiceModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-gradient text-white text-sm font-semibold rounded-md hover:opacity-90 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Service
              </button>
            </div>
          ) : (
            <>
              {services.length > 0 && (
                <div className="space-y-2 mb-4">
                  {services.map((svc) => (
                    <div key={svc.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-md border border-gray-100">
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${svc.color_hex}18`, border: `1.5px solid ${svc.color_hex}40` }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: svc.color_hex }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{svc.name}</p>
                        {svc.description && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{svc.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />{svc.duration_minutes} min
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />₱{parseFloat(svc.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </span>
                          {svc.assigned_practitioners.length > 0 && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Users className="w-3 h-3" />{svc.assigned_practitioners.length} practitioner{svc.assigned_practitioners.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setEditingService(svc); setServiceModalOpen(true); }}
                        className="text-xs text-gray-400 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-blue-50 shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {services.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-gray-200 rounded-lg mb-4">
                  <Stethoscope className="w-8 h-8 text-gray-200 mb-2" />
                  <p className="text-sm font-medium text-gray-400">No services added yet</p>
                  <p className="text-xs text-gray-300 mt-0.5">Add at least 1 service to complete setup.</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setEditingService(null); setServiceModalOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-gradient text-white text-sm font-semibold rounded-md hover:opacity-90 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Service
                </button>
                <button
                  type="button"
                  onClick={() => { setStep4Skipped(true); saveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Skip for now <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* ══ SECTION 5 — CLINIC CONSENT FORMS ══ */}
        <div className="bg-white rounded-lg border border-[#EAECEF] p-5">
          <div className="flex items-start justify-between mb-5">
            <SectionHeader
              step={5}
              icon={<FileText className="w-4 h-4 text-white" />}
              title="Clinic Consent Forms"
              subtitle="Configure standard consent forms required for online bookings per branch."
              done={true}
            />
          </div>

          {clinicId && (
            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-600">Branch Name</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Updated By</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Updated At</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {accessibleBranches.map((branch) => {
                    const status = consentStatuses[branch.id];
                    const isActive = status?.is_active ?? false;
                    const updatedAt = status?.updated_at 
                      ? new Date(status.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      : 'Never';

                    return (
                      <tr key={branch.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{branch.name}</td>
                        <td className="px-4 py-3">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Enabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                              Disabled
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          System {/* Mocked for now */}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {updatedAt}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedConsentBranchId(branch.id);
                              setConsentModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0575E6] bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ══ SAVE CLINIC SETUP ══ */}
        <div ref={saveRef} className="bg-white rounded-lg border border-[#EAECEF] p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">You can always add more from Settings later.</p>
            <button
              type="button"
              onClick={handleFinishSetup}
              disabled={!step1Complete || isFinishing}
              className={`flex items-center gap-2 px-6 py-2.5 font-bold rounded-md transition-all text-sm ${
                step1Complete && !isFinishing
                  ? 'bg-linear-to-r from-emerald-500 to-[#5CDB95] text-white hover:opacity-90'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isFinishing ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
              ) : step1Complete ? (
                <><CheckCircle2 className="w-4 h-4" />Save Clinic Setup<ChevronRight className="w-4 h-4" /></>
              ) : (
                <>Complete Step 1 to save</>
              )}
            </button>
          </div>
        </div>

        <div className="pb-8" />
      </div>

      {/* ── Modals (lazy-loaded) ── */}
      <Suspense fallback={null}>
        {branchModalOpen && (
          <CreateBranchModal
            isOpen={branchModalOpen}
            onClose={() => setBranchModalOpen(false)}
            onSave={handleBranchSave}
            branch={null}
            mode="create"
            saving={branchSaving}
            mainClinicName={form.name || 'Your Clinic'}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {staffModalOpen && (
          <CreateStaffAccountModal
            isOpen={staffModalOpen}
            onClose={() => { setStaffModalOpen(false); setEditingStaff(null); }}
            onSubmit={handleStaffSubmit}
            editingStaff={editingStaff}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {serviceModalOpen && (
          <ServiceFormModal
            open={serviceModalOpen}
            editing={editingService}
            onClose={() => { setServiceModalOpen(false); setEditingService(null); }}
            onSubmit={handleServiceSubmit}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {consentModalOpen && (
          <BranchConsentFormModal
            isOpen={consentModalOpen}
            onClose={() => setConsentModalOpen(false)}
            accessibleBranches={accessibleBranches}
            initialBranchId={selectedConsentBranchId}
            onSuccess={() => reloadConsentStatuses(accessibleBranches)}
          />
        )}
      </Suspense>

    </div>
  );
};
