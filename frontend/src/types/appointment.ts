export interface Appointment {
  id:         number;
  clinic:     number;
  branch_id:  number | null;
  patient:    number;
  patient_name: string;
  practitioner:      number | null;
  practitioner_name: string | null;
  practitioner_avatar: string | null;
  location:      number | null;
  location_name: string | null;

  service:          number | null;
  service_name:     string | null;
  service_color:    string | null;
  service_duration: number | null;

  appointment_type: string;

  status: 'SCHEDULED' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'ARRIVED' | 'DNA';
  arrival_status: 'NO_STATUS' | 'ARRIVED' | 'DNA';
  arrival_time: string | null;
  date:             string;
  start_time:       string;
  end_time:         string;
  duration_minutes: number;
  chief_complaint:  string;
  notes:            string;
  patient_notes:    string;
  reminder_sent:    boolean;
  reminder_sent_at: string | null;
  has_invoice:      boolean; // Whether this appointment has an invoice
  confirmation_sent?: boolean;
  rebook_followup_sent?: boolean;

  dna_followup_sent:    boolean;
  dna_followup_sent_at: string | null;

  created_by:      number | null;
  created_by_name: string | null;
  updated_by:      number | null;
  updated_by_name: string | null;

  cancelled_by:         number | null;
  cancellation_reason:  string;
  cancelled_at:         string | null;
  booking_source:       string;
  /** True when a practitioner/admin has manually changed the consultation
   *  type on a portal-originated appointment. When true, the calendar block
   *  renders the service color instead of the default portal blue. */
  service_overridden:   boolean;
  created_at:           string;
  updated_at:           string;
}

export interface CreateAppointmentData {
  clinic: number;
  patient: number;
  practitioner?: number | null;
  location?: number | null;
  service?: number | null;           // ← primary
  appointment_type?: string;         // ← legacy fallback
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  chief_complaint?: string;
  notes?: string;
  patient_notes?: string;
}

export interface PractitionerSchedule {
  id: number;
  practitioner: number;
  practitioner_name: string;
  location: number;
  location_name: string;
  weekday: number;
  weekday_display: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentReminder {
  id: number;
  appointment: number;
  reminder_type: 'EMAIL' | 'SMS' | 'BOTH';
  sent_at: string;
  is_successful: boolean;
  error_message: string;
}

// ── Block Appointment (Event) ───────────────────────────────────────────────────

export interface BlockAppointment {
  id: number;
  clinic: number;
  clinic_name: string | null;
  clinic_branch_id: number | null; // The branch this block belongs to
  clinic_branch_name: string | null; // Display name of the branch
  practitioner_id: number | null; // Practitioner this block is scoped to (null = clinic-wide)
  event_name: string;
  event_type: string;
  date: string;
  start_time: string;
  end_time: string;
  notes: string;
  created_by: number | null;
  created_by_name: string | null;
  modified_by: number | null;
  modified_by_name: string | null;
  visibility_type: 'ALL' | 'SELECTED' | 'SELF';
  visible_to_user_ids: number[];
  visible_to_user_names: string[];
  participant_practitioner_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface CreateBlockAppointmentData {
  clinic: number;
  /** Practitioner FK — matches the DRF field name. Null = clinic-wide block. */
  practitioner?: number | null;
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  notes?: string;
  visibility_type?: 'ALL' | 'SELECTED' | 'SELF';
  visible_to_user_ids?: number[];
}

// ── Calendar Note (sticky note on calendar) ────────────────────────────────────

export interface CalendarNote {
  id: number;
  clinic: number;
  date: string;
  start_time: string;
  end_time: string;
  message: string;
  practitioner: number | null;
  created_by: number | null;
  created_by_name: string | null;
  modified_by: number | null;
  modified_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCalendarNoteData {
  clinic: number;
  date: string;
  start_time: string;
  end_time: string;
  message: string;
  practitioner?: number | null;
}

export const APPOINTMENT_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SCHEDULED:   { bg: 'bg-blue-500',   text: 'text-white',   border: 'border-blue-600'   },
  CONFIRMED:   { bg: 'bg-green-500',  text: 'text-white',   border: 'border-green-600'  },
  CHECKED_IN:  { bg: 'bg-purple-500', text: 'text-white',   border: 'border-purple-600' },
  IN_PROGRESS: { bg: 'bg-amber-500',  text: 'text-white',   border: 'border-amber-600'  },
  COMPLETED:   { bg: 'bg-gray-500',   text: 'text-white',   border: 'border-gray-600'   },
  CANCELLED:   { bg: 'bg-red-500',    text: 'text-white',   border: 'border-red-600'    },
  NO_SHOW:     { bg: 'bg-orange-500', text: 'text-white',   border: 'border-orange-600' },
  DNA:         { bg: 'bg-red-600',    text: 'text-white',   border: 'border-red-700'    },
};

export const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  INITIAL:    'Initial Consultation',
  FOLLOW_UP:  'Follow-up',
  THERAPY:    'Therapy Session',
  ASSESSMENT: 'Assessment',
};