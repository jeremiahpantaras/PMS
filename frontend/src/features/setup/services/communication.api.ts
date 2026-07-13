import axiosInstance from '@/lib/axios';

export interface CommunicationSettings {
  id: number;
  // Per-reminder-type channel methods
  booking_confirmation_method: 'EMAIL' | 'SMS' | 'BOTH';
  reminder_method: 'EMAIL' | 'SMS' | 'BOTH';
  cancellation_method: 'EMAIL' | 'SMS' | 'BOTH';
  dna_followup_method: 'EMAIL' | 'SMS' | 'BOTH';
  rebook_followup_method: 'EMAIL' | 'SMS' | 'BOTH';
  inactive_checkin_method: 'EMAIL' | 'SMS' | 'BOTH';
  profile_creation_method: 'EMAIL' | 'SMS' | 'BOTH';
  // Timing
  reminder_hours_before: number;
  dna_followup_delay_hours: number;
  no_rebook_followup_days: number;
  inactive_patient_months: number;
  // Feature toggles
  booking_confirmations_enabled: boolean;
  reminders_enabled: boolean;
  cancellation_enabled: boolean;
  dna_followup_enabled: boolean;
  rebook_followup_enabled: boolean;
  inactive_checkin_enabled: boolean;
  profile_creation_enabled: boolean;
}

export interface CommunicationLogEntry {
  id: number;
  clinic: number;
  patient: number | null;
  patient_name: string;
  appointment: number | null;
  appointment_color: string | null;
  comm_type: string;
  comm_type_display: string;
  channel: string;
  channel_display: string;
  status: string;
  status_display: string;
  recipient: string;
  subject: string;
  body_preview: string;
  error_message: string;
  patient_reply: string;
  replied_at: string | null;
  created_at: string;
}

export interface CommunicationLogSummary {
  stats: {
    total: number;
    sent: number;
    failed: number;
    replied: number;
  };
  by_type: { comm_type: string; count: number }[];
  by_channel: { channel: string; count: number }[];
}

export const communicationApi = {
  // Settings
  getSettings: async (): Promise<CommunicationSettings> => {
    const { data } = await axiosInstance.get('/communication-settings/my-settings/');
    return data;
  },

  updateSettings: async (updates: Partial<CommunicationSettings>): Promise<CommunicationSettings> => {
    const { data } = await axiosInstance.patch('/communication-settings/my-settings/', updates);
    return data;
  },

  // Communication Logs
  getLogs: async (params?: {
    comm_type?: string;
    channel?: string;
    status?: string;
    search?: string;
    page?: number;
    ordering?: string;
    patient?: string | number;
  }): Promise<{ results: CommunicationLogEntry[]; count: number }> => {
    const { data } = await axiosInstance.get('/communication-logs/', { params });
    return data;
  },

  getLogDetail: async (id: number): Promise<CommunicationLogEntry> => {
    const { data } = await axiosInstance.get(`/communication-logs/${id}/`);
    return data;
  },

  getLogSummary: async (): Promise<CommunicationLogSummary> => {
    const { data } = await axiosInstance.get('/communication-logs/summary/');
    return data;
  },
};
