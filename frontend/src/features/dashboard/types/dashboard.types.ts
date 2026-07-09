export interface DashboardStats {
  todayOccupancy: {
    current: number;
    total: number;
    percentage: number;
  };
  todayBookings: number;
  todayNewClients: number;
  todayCancellations: number;
  todayConfirmed?: number;
  todayDeclined?: number;
  todayAwaiting?: number;
}

export interface BookingByType {
  type:  string;
  count: number;
  color: string;
}

/** @deprecated use BookingByType */
export type BookingByCase = BookingByType;

export interface WeeklyBooking {
  day:   string;   // "Mon", "Tue", …
  date:  string;   // "2026-04-07"
  count: number;
}

export interface DashboardData {
  stats:            DashboardStats;
  bookingsByType:   BookingByType[];
  weeklyBookings:   WeeklyBooking[];
}

// ── Clinician Performance ──────────────────────────────────────────────────

export interface ProviderPerformance {
  id:                  number;
  name:                string;
  /** One value per date label (index-aligned with dateLabels) */
  appointments:        number[];
  completed:           number[];
  dna_counts:          number[];
  dna_rate:            number[];   // percentage
  revenue:             number[];
  avg_duration:        number[];   // minutes
  /** Totals */
  total_appointments:  number;
  total_dna:           number;
  overall_dna_rate:    number;
  total_revenue:       number;
}

export interface ClinicianPerformanceData {
  date_labels:  string[];
  start_date:   string;
  end_date:     string;
  generated_at: string;
  is_own_data:  boolean;          // true when the user is a Practitioner
  providers:    ProviderPerformance[];
}

// ── Live Occupancy ─────────────────────────────────────────────────────────

export type OccupancyStatus = 'available' | 'occupied';

export interface OccupancyEntry {
  practitioner_id:  number;
  name:             string;
  status:           OccupancyStatus;
  current_patient:  string | null;
  start_time:       string | null;
  service:          string;
  today_total:      number;
  today_completed:  number;
}

/** Pushed over WebSocket */
export interface OccupancyUpdate {
  type:            'OCCUPANCY_UPDATE';
  practitioner_id: number;
  name:            string;
  status:          OccupancyStatus;
  current_patient: string | null;
  start_time:      string | null;
  service:         string;
  appointment_id:  number;
  appt_status:     string;
}
