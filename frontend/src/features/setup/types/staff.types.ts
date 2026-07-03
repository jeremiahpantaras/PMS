import type { DutyDay, DutySchedule, PractitionerAvailability } from '@/features/clinics/clinic.api';
import type { UserRole } from '@/types/auth';

export type TitleType = 'Mr' | 'Ms' | 'Mrs' | 'Miss' | 'Dr' | 'Prof' | 'Assoc Prof';

export type DisciplineType = 
  | 'OCCUPATIONAL_THERAPY'
  | 'SPEECH_LANGUAGE_PATHOLOGIST'
  | 'PHYSICAL_THERAPY'
  | 'OSTEOPATHY'
  | 'DENTISTRY'
  | 'MD_GENERAL_PRACTITIONER';

export type GenderType = 'Male' | 'Female' | 'Other' | 'Prefer not to say';

export interface StaffMember {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  nickname?: string;
  title?: TitleType;
  /** Primary role — backward compat; use `roles` for multi-role checks. */
  role: 'STAFF' | 'PRACTITIONER' | 'ADMIN' | 'ADMIN_ASSISTANT' | 'FINANCE' | 'READ_ONLY';
  /** All assigned roles (multi-role). */
  roles: UserRole[];
  phone: string;
  avatar: string | null;
  is_active: boolean;
  clinic: number;
  clinic_branch?: number | null;
  clinic_branch_name?: string | null;
  created_at: string;
  password_changed: boolean;
  permission_group?: number | null;
  permission_group_name?: string | null;
  manager_branches?: any[];
  manager_branches_ids?: any[];

  // Additional staff fields
  position?: string;
  discipline?: string;
  date_of_birth?: string;
  gender?: GenderType;
  address?: string;

  // Availability (for PRACTITIONER and STAFF roles)
  availability?: PractitionerAvailability;
  duty_days?: DutyDay[];
  lunch_start_time?: string;
  lunch_end_time?: string;
  duty_schedule?: DutySchedule | null;
}

export interface CreateStaffData {
  email: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  nickname?: string;
  title?: TitleType;
  /** All assigned clinical roles (multi-select). */
  roles: ('ADMIN_ASSISTANT' | 'PRACTITIONER' | 'STAFF' | 'FINANCE' | 'ADMIN' | 'READ_ONLY')[];
  phone: string;
  position?: string;
  discipline?: string;
  date_of_birth?: string;
  gender?: GenderType;
  address?: string;
  clinic_branch?: number | null;
  /** List of branch IDs to assign (used for Manager multi-branch scope). */
  branch_ids?: number[];

  // Legacy single-block availability (PRACTITIONER only, kept for compat)
  duty_start_time?: string;
  duty_end_time?: string;
  // Shared availability fields (both STAFF and PRACTITIONER)
  duty_days?: DutyDay[];
  lunch_start_time?: string;
  lunch_end_time?: string;
  /** Split-shift schedule — when provided, overrides duty_start/end_time */
  duty_schedule?: DutySchedule | null;
}

export interface StaffFormErrors {
  first_name?: string;
  last_name?: string;
  title?: string;
  position?: string;
  discipline?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  clinic_branch?: string;
  general?: string;
  duty_days?: string;
  duty_schedule?: string;
  lunch_start_time?: string;
  lunch_end_time?: string;
}

// Title options for dropdown
export const TITLE_OPTIONS: { value: TitleType; label: string }[] = [
  { value: 'Mr', label: 'Mr.' },
  { value: 'Ms', label: 'Ms.' },
  { value: 'Mrs', label: 'Mrs.' },
  { value: 'Miss', label: 'Miss' },
  { value: 'Dr', label: 'Dr.' },
  { value: 'Prof', label: 'Prof.' },
  { value: 'Assoc Prof', label: 'Assoc. Prof.' },
];

// Discipline options for dropdown
export const DISCIPLINE_OPTIONS: { value: DisciplineType; label: string }[] = [
  { value: 'OCCUPATIONAL_THERAPY', label: 'Occupational Therapy' },
  { value: 'SPEECH_LANGUAGE_PATHOLOGIST', label: 'Speech Language Pathologist' },
  { value: 'PHYSICAL_THERAPY', label: 'Physical Therapy' },
  { value: 'OSTEOPATHY', label: 'Osteopathy' },
  { value: 'DENTISTRY', label: 'Dentistry' },
  { value: 'MD_GENERAL_PRACTITIONER', label: 'MD: General Practitioner' },
];

// Gender options for dropdown
export const GENDER_OPTIONS: { value: GenderType; label: string }[] = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
];

// ── Practitioner Role Removal Impact ─────────────────────────────────────────

export interface PractitionerRoleImpact {
  practitioner_id: number | null;
  future_appointments: number;
  future_blockouts: number;
  future_calendar_events: number;
  has_impact: boolean;
}