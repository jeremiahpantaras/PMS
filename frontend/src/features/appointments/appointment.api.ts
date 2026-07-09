import axiosInstance from '@/lib/axios';
import type {
  Appointment,
  CreateAppointmentData,
  PaginatedResponse,
  BlockAppointment,
  CreateBlockAppointmentData,
  CalendarNote,
  CreateCalendarNoteData,
} from '@/types';

export interface AppointmentFilters {
  search?: string;
  status?: string;
  appointment_type?: string;
  service?: number;
  patient?: number;
  practitioner?: number;
  clinic_branch?: number;
  date_from?: string;
  date_to?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

// ── Edit payload — service added ──────────────────────────────────────────────
export interface AppointmentEditPayload {
  practitioner?:    number | null;
  service?:         number | null;    // ← NEW
  chief_complaint?: string;
  notes?:           string;
  patient_notes?:   string;
  arrival_status?:  'NO_STATUS' | 'ARRIVED' | 'DNA';  // ← NEW
}

export interface AppointmentCancelPayload {
  cancellation_reason: string;
}

export interface AppointmentCancelResponse extends Appointment {
  email_sent:     boolean;
  email_warning?: string;
}

// ── Bulk cancel appointments ─────────────────────────────────────────────────────
export interface BulkCancelPayload {
  appointment_ids: number[];
  cancellation_reason: string;
}

export interface BulkCancelResult {
  cancelled_count: number;
  failed_count: number;
  results: Array<{
    appointment_id: number;
    success: boolean;
    email_sent?: boolean;
    error?: string;
  }>;
}

export interface PortalBookingDiaryItem {
  id:                     number;
  reference_number:       string;
  status:                 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  patient_name:           string;
  patient_phone:          string;
  patient_email:          string;
  service_name:           string;
  service_color:          string | null;
  practitioner_name:      string | null;
  practitioner_branch_id: number | null;   // practitioner's assigned branch
  portal_clinic_id:       number | null;   // ← ADD: the clinic the portal link belongs to
  date:                   string;
  start_time:             string;
  end_time:               string;
  duration_minutes:       number;
  notes:                  string;
}



export const getAppointments = async (
  filters?: AppointmentFilters
): Promise<PaginatedResponse<Appointment>> => {
  const params = new URLSearchParams();

  if (filters?.search)           params.append('search',           filters.search);
  if (filters?.status)           params.append('status',           filters.status);
  if (filters?.appointment_type) params.append('appointment_type', filters.appointment_type);
  if (filters?.service)          params.append('service',          String(filters.service));
  if (filters?.patient)          params.append('patient',          String(filters.patient));
  if (filters?.practitioner)     params.append('practitioner',     String(filters.practitioner));
  if (filters?.clinic_branch)    params.append('clinic_branch',    String(filters.clinic_branch));
  if (filters?.date_from)        params.append('date_from',        filters.date_from);
  if (filters?.date_to)          params.append('date_to',          filters.date_to);
  if (filters?.start_date)       params.append('start_date',       filters.start_date);
  if (filters?.end_date)         params.append('end_date',         filters.end_date);
  if (filters?.page)             params.append('page',             String(filters.page));
  if (filters?.page_size)        params.append('page_size',        String(filters.page_size));

  const response = await axiosInstance.get<PaginatedResponse<Appointment>>(
    `/appointments/?${params.toString()}`
  );
  return response.data;
};

export interface DailyOccupancyStats {
  available_minutes: number;
  occupied_minutes: number;
  occupancy_pct: number;
  total_clients: number;
  new_clients: number;
}

// Stats mapped by YYYY-MM-DD -> Practitioner ID -> Stats
export type DailyStatsResponse = Record<string, Record<number, DailyOccupancyStats>>;

export const getDailyStats = async (params: {
  start_date: string;
  end_date: string;
  clinic_branch: number;
}): Promise<DailyStatsResponse> => {
  const query = new URLSearchParams({
    start_date: params.start_date,
    end_date: params.end_date,
    clinic_branch: String(params.clinic_branch),
  });
  const response = await axiosInstance.get<DailyStatsResponse>(
    `/appointments/daily_stats/?${query.toString()}`
  );
  return response.data;
};


// Get upcoming appointments for a patient (future dates only)
export const getUpcomingAppointments = async (
  patientId: number,
  limit: number = 5
): Promise<Appointment[]> => {
  const today = new Date().toISOString().split('T')[0];
  const params = new URLSearchParams({
    patient: String(patientId),
    date_from: today,
    page_size: String(limit),
    ordering: 'date,start_time',
  });

  const response = await axiosInstance.get<PaginatedResponse<Appointment>>(
    `/appointments/?${params.toString()}`
  );
  return response.data.results;
};

export const getAppointment = async (id: number): Promise<Appointment> => {
  const response = await axiosInstance.get<Appointment>(`/appointments/${id}/`);
  return response.data;
};

export const createAppointment = async (
  data: CreateAppointmentData
): Promise<Appointment> => {
  const response = await axiosInstance.post<Appointment>('/appointments/', data);
  return response.data;
};

export const updateAppointment = async (
  id: number,
  data: Partial<CreateAppointmentData>
): Promise<Appointment> => {
  const response = await axiosInstance.patch<Appointment>(`/appointments/${id}/`, data);
  return response.data;
};

export const editAppointment = async (
  id: number,
  data: AppointmentEditPayload
): Promise<Appointment> => {
  const response = await axiosInstance.patch<Appointment>(
    `/appointments/${id}/edit/`,
    data
  );
  return response.data;
};

/**
 * Get today's arrivals (appointments with arrival_status='ARRIVED' for today)
 */
export const getTodayArrivals = async (): Promise<Appointment[]> => {
  const response = await axiosInstance.get<Appointment[]>(
    '/appointments/today-arrivals/'
  );
  return response.data;
};

export interface RescheduleAppointmentPayload {
  date:          string;   // yyyy-MM-dd
  start_time:    string;   // HH:mm
  end_time:      string;   // HH:mm
  practitioner?: number | null;  // updated when appointment is moved between practitioner columns
}

export const rescheduleAppointment = async (
  id: number,
  data: RescheduleAppointmentPayload
): Promise<Appointment> => {
  const response = await axiosInstance.patch<Appointment>(
    `/appointments/${id}/`,
    data,
  );
  return response.data;
};

export const cancelAppointment = async (
  id: number,
  data: AppointmentCancelPayload
): Promise<AppointmentCancelResponse> => {
  const response = await axiosInstance.post<AppointmentCancelResponse>(
    `/appointments/${id}/cancel/`,
    data
  );
  return response.data;
};

// Bulk cancel multiple appointments
export const bulkCancelAppointments = async (
  data: BulkCancelPayload
): Promise<BulkCancelResult> => {
  const response = await axiosInstance.post<BulkCancelResult>(
    '/appointments/bulk_cancel/',
    data
  );
  return response.data;
};

export const deleteAppointment = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/appointments/${id}/`);
};

export const getAppointmentClinicalNotes = async (appointmentId: number) => {
  const response = await axiosInstance.get(
    `/clinical-notes/?appointment=${appointmentId}`
  );
  return response.data;
};

export const getAppointmentInvoice = async (appointmentId: number) => {
  const response = await axiosInstance.get(
    `/invoices/?appointment=${appointmentId}`
  );
  return response.data;
};

export const getPortalBookingsForDiary = async (params: {
  start_date:     string;
  end_date:       string;
  practitioner?:  number;
  clinic_branch?: number;
}): Promise<PortalBookingDiaryItem[]> => {
  const response = await axiosInstance.get<PortalBookingDiaryItem[]>(
    `/appointments/portal_bookings/`,
    { params }
  );
  return response.data;
};

export const updatePortalBookingStatus = async (
  id: number,
  newStatus: 'CONFIRMED' | 'CANCELLED'
): Promise<{
  id: number;
  status: string;
  patient_id?: number;
  patient_number?: string;
  patient_name?: string;
  appointment_id?: number;
  warning?: string;
}> => {
  const response = await axiosInstance.patch(
    `/portal-bookings/${id}/update_status/`,
    { status: newStatus }
  );
  return response.data;
};

// ── Check recurring appointments availability ─────────────────────────────────
export interface RecurringAvailabilitySlot {
  date: string;
  day_name: string;
  time: string;
  status: 'AVAILABLE' | 'BOOKED';
}

export interface CheckRecurringAvailabilityParams {
  practitioner_id: number | null;
  dates: string[];
  start_time: string;
  duration_minutes: number;
}

export const checkRecurringAvailability = async (
  params: CheckRecurringAvailabilityParams
): Promise<{ slots: RecurringAvailabilitySlot[] }> => {
  const response = await axiosInstance.post<{ slots: RecurringAvailabilitySlot[] }>(
    '/appointments/check_recurring_availability/',
    params
  );
  return response.data;
};

// ── Create recurring appointments ───────────────────────────────────────────────
export interface CreateRecurringAppointmentsParams {
  service_id: number;
  duration_minutes: number;
  dates: string[];
  practitioner_id: number | null;
  start_time: string;
  patient_id: number;
  clinic_id: number;
}

export const createRecurringAppointments = async (
  params: CreateRecurringAppointmentsParams
): Promise<{ created: number; appointments: Appointment[] }> => {
  const response = await axiosInstance.post<{ created: number; appointments: Appointment[] }>(
    '/appointments/create_recurring/',
    params
  );
  return response.data;
};

// ── Block Appointments (Events) ─────────────────────────────────────────────────

export interface BlockAppointmentFilters {
  clinic_branch?: number;
  start_date?: string;
  end_date?: string;
}

export const getBlockAppointments = async (
  filters?: BlockAppointmentFilters
): Promise<{ count: number; results: BlockAppointment[] }> => {
  const params = new URLSearchParams();

  if (filters?.clinic_branch) params.append('clinic_branch', String(filters.clinic_branch));
  if (filters?.start_date) params.append('start_date', filters.start_date);
  if (filters?.end_date) params.append('end_date', filters.end_date);

  const response = await axiosInstance.get<{ count: number; results: BlockAppointment[] }>(
    `/block-appointments/?${params.toString()}`
  );
  return response.data;
};

export const getBlockAppointmentsCalendar = async (
  filters?: BlockAppointmentFilters
): Promise<BlockAppointment[]> => {
  const params = new URLSearchParams();

  if (filters?.clinic_branch) params.append('clinic_branch', String(filters.clinic_branch));
  if (filters?.start_date) params.append('start_date', filters.start_date);
  if (filters?.end_date) params.append('end_date', filters.end_date);

  const response = await axiosInstance.get<BlockAppointment[]>(
    `/block-appointments/calendar/?${params.toString()}`
  );
  return response.data;
};

export const createBlockAppointment = async (
  data: CreateBlockAppointmentData
): Promise<BlockAppointment> => {
  const response = await axiosInstance.post<BlockAppointment>('/block-appointments/', data);
  return response.data;
};

export const updateBlockAppointment = async (
  id: number,
  data: Partial<CreateBlockAppointmentData>
): Promise<BlockAppointment> => {
  const response = await axiosInstance.patch<BlockAppointment>(`/block-appointments/${id}/`, data);
  return response.data;
};

export const deleteBlockAppointment = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/block-appointments/${id}/`);
};

// ── Calendar Notes (sticky notes on calendar) ─────────────────────────────────

export interface CalendarNoteFilters {
  clinic?: number;
  date?: string;
  start_date?: string;
  end_date?: string;
  clinic_branch?: number;
  /** Filter notes to a specific practitioner (matches backend ?practitioner=<id> param). */
  practitioner?: number;
}

export const getCalendarNotes = async (
  filters?: CalendarNoteFilters,
): Promise<CalendarNote[]> => {
  const params = new URLSearchParams();
  if (filters?.clinic)        params.append('clinic',        String(filters.clinic));
  if (filters?.date)          params.append('date',          filters.date);
  if (filters?.start_date)    params.append('start_date',    filters.start_date);
  if (filters?.end_date)      params.append('end_date',      filters.end_date);
  if (filters?.clinic_branch) params.append('clinic_branch', String(filters.clinic_branch));
  if (filters?.practitioner)  params.append('practitioner',  String(filters.practitioner));

  const response = await axiosInstance.get<
    CalendarNote[] | { count: number; results: CalendarNote[] }
  >(`/calendar-notes/?${params.toString()}`);

  const data = response.data;
  return Array.isArray(data) ? data : (data.results ?? []);
};

export const createCalendarNote = async (
  data: CreateCalendarNoteData,
): Promise<CalendarNote> => {
  const response = await axiosInstance.post<CalendarNote>('/calendar-notes/', data);
  return response.data;
};

export const updateCalendarNote = async (
  id: number,
  data: Partial<CreateCalendarNoteData>,
): Promise<CalendarNote> => {
  const response = await axiosInstance.patch<CalendarNote>(`/calendar-notes/${id}/`, data);
  return response.data;
};

export const deleteCalendarNote = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/calendar-notes/${id}/`);
};