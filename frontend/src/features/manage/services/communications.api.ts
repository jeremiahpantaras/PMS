import axiosInstance from '@/lib/axios';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CommStatus =
  | 'QUEUED' | 'SENT' | 'DELIVERED' | 'OPENED'
  | 'REPLIED' | 'FAILED' | 'BOUNCED' | 'PENDING';

export type CommType =
  | 'BOOKING_CONFIRMATION' | 'RECURRING_CONFIRMATION'
  | 'APPOINTMENT_REMINDER' | 'DNA_FOLLOWUP'
  | 'REBOOK_FOLLOWUP'      | 'INACTIVE_CHECKIN'
  | 'CANCELLATION_NOTICE'  | 'CLINICAL_NOTE'
  | 'OTP_VERIFICATION'     | 'PASSWORD_RESET'
  | 'INVOICE_EMAIL'        | 'RESCHEDULE_FOLLOWUP'
  | 'SYSTEM_NOTIFICATION';

export type CommChannel = 'EMAIL' | 'SMS';

export interface CommunicationLog {
  id: number;
  clinic: number;
  patient: number | null;
  patient_name: string;
  appointment: number | null;
  practitioner: number | null;
  practitioner_name: string;
  comm_type: CommType;
  comm_type_display: string;
  channel: CommChannel;
  channel_display: string;
  status: CommStatus;
  status_display: string;
  recipient: string;
  subject: string;
  body_preview: string;
  error_message: string;
  patient_reply: string;
  replied_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  bounced_at: string | null;
  message_id: string;
  reply_count: number;
  attachment_count: number;
  created_at: string;
}

export interface CommunicationLogDetail extends CommunicationLog {
  full_body: string;
  replies: CommunicationReply[];
  attachments: CommunicationAttachment[];
}

export interface CommunicationReply {
  id: number;
  communication_log: number;
  sender_type: 'PATIENT' | 'STAFF' | 'SYSTEM';
  sender_type_display: string;
  sender_name: string;
  message: string;
  created_at: string;
}

export interface CommunicationAttachment {
  id: number;
  communication_log: number;
  file_name: string;
  file_url: string;
  attachment_type: 'PDF' | 'IMAGE' | 'INVOICE' | 'CLINICAL' | 'OTHER';
  attachment_type_display: string;
  file_size_bytes: number | null;
  created_at: string;
}

export interface TodayStats {
  emails_sent_today: number;
  delivery_rate: number;
  replies_received: number;
  failed_deliveries: number;
  pending_responses: number;
}

export interface CommSummary {
  stats: {
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    failed: number;
    replied: number;
  };
  by_type: { comm_type: string; count: number }[];
  by_channel: { channel: string; count: number }[];
}

export interface CommFilters {
  search?: string;
  comm_type?: CommType | '';
  channel?: CommChannel | '';
  status?: CommStatus | '';
  patient?: number | '';
  practitioner?: number | '';
  branch?: number | '';
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ── API ───────────────────────────────────────────────────────────────────────

export const communicationRecordsApi = {
  /** GET /api/communication-logs/ */
  list: async (filters: CommFilters = {}): Promise<PaginatedResponse<CommunicationLog>> => {
    const params: Record<string, string | number> = {};
    if (filters.search)       params.search       = filters.search;
    if (filters.comm_type)    params.comm_type    = filters.comm_type;
    if (filters.channel)      params.channel      = filters.channel;
    if (filters.status)       params.status       = filters.status;
    if (filters.patient)      params.patient      = filters.patient;
    if (filters.practitioner) params.practitioner = filters.practitioner;
    if (filters.branch)       params.branch       = filters.branch;
    if (filters.date_from)    params.date_from    = filters.date_from;
    if (filters.date_to)      params.date_to      = filters.date_to;
    if (filters.page)         params.page         = filters.page;
    if (filters.page_size)    params.page_size    = filters.page_size ?? 25;
    const { data } = await axiosInstance.get('/communication-logs/', { params });
    return data;
  },

  /** GET /api/communication-logs/{id}/ — full detail with replies & attachments */
  retrieve: async (id: number): Promise<CommunicationLogDetail> => {
    const { data } = await axiosInstance.get(`/communication-logs/${id}/`);
    return data;
  },

  /** GET /api/communication-logs/today_stats/ */
  todayStats: async (): Promise<TodayStats> => {
    const { data } = await axiosInstance.get('/communication-logs/today_stats/');
    return data;
  },

  /** GET /api/communication-logs/summary/ */
  summary: async (): Promise<CommSummary> => {
    const { data } = await axiosInstance.get('/communication-logs/summary/');
    return data;
  },

  /** GET /api/communication-logs/{id}/replies/ */
  listReplies: async (id: number): Promise<CommunicationReply[]> => {
    const { data } = await axiosInstance.get(`/communication-logs/${id}/replies/`);
    return data;
  },

  /** GET /api/communication-logs/{id}/attachments/ */
  listAttachments: async (id: number): Promise<CommunicationAttachment[]> => {
    const { data } = await axiosInstance.get(`/communication-logs/${id}/attachments/`);
    return data;
  },

  /** POST /api/communication-logs/{id}/resend/ */
  resend: async (id: number): Promise<CommunicationLog> => {
    const { data } = await axiosInstance.post(`/communication-logs/${id}/resend/`);
    return data;
  },

  /** POST /api/communication-logs/{id}/confirm_appointment/ */
  confirmAppointment: async (id: number): Promise<CommunicationLog> => {
    const { data } = await axiosInstance.post(`/communication-logs/${id}/confirm_appointment/`);
    return data;
  },

  /** POST /api/communication-logs/{id}/reschedule_appointment/ */
  rescheduleAppointment: async (id: number): Promise<CommunicationLog> => {
    const { data } = await axiosInstance.post(`/communication-logs/${id}/reschedule_appointment/`);
    return data;
  },
};
