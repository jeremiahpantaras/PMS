import api from '@/lib/axios';
import { axiosInstance } from '../../lib/axios';
import type { ClinicBranch, ClinicBranchesResponse, CreateBranchData } from '@/types/clinic';

// ── Existing: Practitioner types ──────────────────────────────────────────────
export type DutyDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

/** A single shift block: {start: "08:00", end: "12:00"} */
export interface ShiftBlock {
  start: string;
  end:   string;
}

/** Split-shift schedule keyed by day abbreviation */
export type DutySchedule = Partial<Record<DutyDay, ShiftBlock[]>>;

export interface PractitionerAvailability {
  duty_days:        DutyDay[];
  duty_start_time:  string; // e.g., "08:00" (legacy single-block)
  duty_end_time:    string; // e.g., "17:00" (legacy single-block)
  lunch_start_time: string; // e.g., "12:00"
  lunch_end_time:   string; // e.g., "13:00"
  /** When set, overrides duty_start_time / duty_end_time for scheduling */
  duty_schedule?:   DutySchedule | null;
}

export interface Practitioner {
  id:                 number | string; // Staff entries use "staff-<userId>"
  user_id?:           number;          // set for Staff entries
  name:               string;
  email:              string;
  specialization:     string | null;
  clinic_id:          number;
  clinic_name:        string | null;
  clinic_branch_id:   number | null;
  clinic_branch_name: string | null;
  availability?:      PractitionerAvailability;
  role?:              'PRACTITIONER' | 'STAFF';
  roles?:             string[];
  discipline?:        string | null;
}

export interface PractitionersResponse {
  practitioners: Practitioner[];
}

// ── NEW: Full clinic profile (returned by my_clinic / setup_profile) ──────────
export interface ClinicProfile {
  id:                       number;
  name:                     string;
  branch_code:              string | null;
  email:                    string;
  phone:                    string;
  address:                  string;
  city:                     string;
  province:                 string;
  postal_code:              string;
  website:                  string;
  tin:                      string;
  philhealth_accreditation: string;
  custom_location:          string;
  latitude:                 string | null;
  longitude:                string | null;
  logo:                     string | null;
  logo_url:                 string | null;
  timezone:                 string;
  is_main_branch:           boolean;
  is_active:                boolean;
  setup_complete:                boolean;
  subscription_plan:             string;
  email_notifications_enabled:   boolean;
  sms_notifications_enabled:     boolean;
  created_at:               string;
  updated_at:               string;
}

// ── NEW: Payload for clinic profile setup ─────────────────────────────────────
export interface ClinicConsentFormPayload {
  title: string;
  header_content: string;
  body_content: string;
  is_active: boolean;
}

export interface ClinicConsentFormResponse extends ClinicConsentFormPayload {
  id: number;
  clinic: number;
  clinic_name: string;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
  updated_by_name?: string;
}

export interface ClinicProfileSetupPayload {
  name?:            string;
  email?:           string;
  phone?:           string;
  address?:         string;
  city?:            string;
  province?:        string;
  postal_code?:     string;
  website?:         string;
  custom_location?: string;
  latitude?:        number;
  longitude?:       number;
  logo?:                          File | null;
  remove_logo?:                   boolean;
  email_notifications_enabled?:   boolean;
  sms_notifications_enabled?:     boolean;
}

// ── Existing functions ────────────────────────────────────────────────────────

export const getPractitioners = async (
  clinicBranchId?: number | null
): Promise<{ practitioners: Practitioner[] }> => {
  const params: any = {};
  if (clinicBranchId != null) params.clinic_branch = clinicBranchId;
  const response = await axiosInstance.get('/appointments/practitioners/', { params });
  return response.data;
};

export const getClinicBranches = async (): Promise<ClinicBranchesResponse> => {
  const response = await axiosInstance.get<ClinicBranchesResponse>('/clinics/branches/');
  return response.data;
};

export const getPractitioner = async (id: number): Promise<Practitioner> => {
  const response = await api.get<Practitioner>(`/practitioners/${id}/`);
  return response.data;
};

export const createClinicBranch = async (
  mainClinicId: number,
  data: CreateBranchData
): Promise<ClinicBranch> => {
  const response = await api.post<ClinicBranch>(
    `/clinics/${mainClinicId}/create_branch/`,
    data
  );
  return response.data;
};

export const updateClinicBranch = async (
  id: number,
  data: Partial<CreateBranchData>
): Promise<ClinicBranch> => {
  const response = await api.patch<ClinicBranch>(`/clinics/${id}/`, data);
  return response.data;
};

// ── NEW functions ─────────────────────────────────────────────────────────────

/**
 * GET /api/clinics/my_clinic/
 * Returns the main clinic record for the authenticated admin.
 */
export const getMyClinic = async (): Promise<ClinicProfile> => {
  const res = await axiosInstance.get<ClinicProfile>('/clinics/my_clinic/');
  return res.data;
};

/**
 * PATCH /api/clinics/{id}/setup_profile/
 * Saves clinic profile fields + marks setup_complete = true.
 * Accepts FormData for logo upload.
 */
export const setupClinicProfile = async (
  clinicId: number,
  payload:  ClinicProfileSetupPayload,
): Promise<ClinicProfile> => {
  const form = new FormData();

  (Object.keys(payload) as (keyof ClinicProfileSetupPayload)[]).forEach((key) => {
    const val = payload[key];
    if (val === undefined || val === null) return;
    if (key === 'logo' && val instanceof File) {
      form.append('logo', val);
    } else if (key === 'remove_logo' && val === true) {
      form.append('remove_logo', 'true');
    } else if (key !== 'logo' && key !== 'remove_logo') {
      form.append(key, String(val));
    }
  });

  const res = await axiosInstance.patch<ClinicProfile>(
    `/clinics/${clinicId}/setup_profile/`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return res.data;
};

/**
 * GET /api/clinic-consent-forms/active/
 * Returns the active clinic consent form if it exists.
 */
export const getActiveClinicConsentForm = async (): Promise<ClinicConsentFormResponse> => {
  const res = await axiosInstance.get<ClinicConsentFormResponse>('/clinic-consent-forms/active/');
  return res.data;
};

/**
 * POST /api/clinic-consent-forms/
 * Creates a new clinic consent form.
 */
export const createClinicConsentForm = async (
  payload: ClinicConsentFormPayload
): Promise<ClinicConsentFormResponse> => {
  const res = await axiosInstance.post<ClinicConsentFormResponse>('/clinic-consent-forms/', payload);
  return res.data;
};

/**
 * PATCH /api/clinic-consent-forms/{id}/
 * Updates an existing clinic consent form.
 */
export const updateClinicConsentForm = async (
  id: number,
  payload: Partial<ClinicConsentFormPayload>
): Promise<ClinicConsentFormResponse> => {
  const res = await axiosInstance.patch<ClinicConsentFormResponse>(`/clinic-consent-forms/${id}/`, payload);
  return res.data;
};

/**
 * GET /api/clinics/{branchId}/consent_form/
 * Returns the consent form for a specific branch.
 */
export const getBranchConsentForm = async (branchId: number): Promise<ClinicConsentFormResponse> => {
  const res = await axiosInstance.get<ClinicConsentFormResponse>(`/clinics/${branchId}/consent_form/`);
  return res.data;
};

/**
 * PATCH /api/clinics/{branchId}/consent_form/
 * Creates or updates the consent form for a specific branch.
 */
export const updateBranchConsentForm = async (
  branchId: number,
  payload: ClinicConsentFormPayload,
): Promise<ClinicConsentFormResponse> => {
  const res = await axiosInstance.patch<ClinicConsentFormResponse>(`/clinics/${branchId}/consent_form/`, payload);
  return res.data;
};