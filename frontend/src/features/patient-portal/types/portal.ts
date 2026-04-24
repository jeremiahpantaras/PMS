import type { DutyDay, DutySchedule } from '@/features/clinics/clinic.api';

export interface PortalAvailability {
  duty_days: DutyDay[];
  duty_start_time: string;
  duty_end_time: string;
  lunch_start_time: string;
  lunch_end_time: string;
  duty_schedule?: DutySchedule | null; // split-shift support
}

export interface PortalBranch {
  id:              number;
  name:            string;
  address:         string;
  city:            string;
  province:        string;
  phone:           string;
  email:           string;
  is_main_branch:  boolean;
  latitude?:       string | null;
  longitude?:      string | null;
  custom_location?: string;
}

export interface PortalPractitioner {
  id:             number | null;
  full_name:      string;
  title?:         string | null;
  specialization: string;
  position?:      string | null;
  occupation:     string;
  discipline?:    string | null;
  bio:            string;
  avatar_url:     string | null;
  branch_id?:     number | null;
  availability?:  PortalAvailability;
  services?:      Array<{ id: number; name: string }>; // assigned services
}

export interface PortalService {
  id:               number;
  name:             string;
  description:      string;
  duration_minutes: number;
  price:            string;
  image_url:        string | null;
  is_active:        boolean;
  sort_order:       number;
  category:         number | null;
  category_name:    string | null;
  color_hex:        string;
  assigned_practitioner_ids?: number[]; // empty = any practitioner
}

export interface PortalCategory {
  id:          number | null;
  name:        string;
  description: string;
  services:    PortalService[];
}

export interface PortalData {
  token:          string;
  heading:        string;
  description:    string;
  clinic_name:    string;
  clinic_logo:    string | null;
  clinic_address: string;
  clinic_phone:   string;
  clinic_email:   string;
  branches:       PortalBranch[];
  categories:     PortalCategory[];
  practitioners:  PortalPractitioner[];
}

export interface BookingPayload {
  service:            number;
  branch?:            number | null;
  practitioner?:      number | null;
  consent_id?:        number;
  patient_first_name: string;
  patient_last_name:  string;
  patient_email:      string;
  patient_phone:      string;
  notes:              string;
  appointment_date:   string;
  appointment_time:   string;
}

export interface BookingConfirmation {
  id:                          number;
  patient_id?:                 number;
  reference_number:            string;
  status:                      string;
  patient_first_name:          string;
  patient_last_name:           string;
  patient_email:               string;
  patient_phone:               string;
  appointment_date:            string;
  appointment_time:            string;
  notes:                       string;
  service_name:                string;
  service_duration:            number;
  service_price:               string;
  practitioner_name:           string | null;
  practitioner_specialization: string | null;
  clinic_name:                 string;
  branch_name:                 string | null;
  created_at:                  string;
}

export interface PortalConsentPayload {
  full_name: string;
  email: string;
  consent_text: string;
  signature: string;
}

export interface PortalConsentResponse {
  id: number;
  full_name: string;
  email: string;
  consent_text: string;
  signature: string;
  created_at: string;
}

export interface SlotsResponse {
  date:  string;
  slots: string[];
}