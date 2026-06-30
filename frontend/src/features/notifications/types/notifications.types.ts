export type NotificationType = 'NEW_BOOKING' | 'NEW_CLIENT' | 'ONLINE_BOOKING' | 'DAILY_SUMMARY';

export type NotificationCategory = 'booking' | 'appointment' | 'system' | 'reminder' | 'alert';

export function getCategory(type: NotificationType): NotificationCategory {
  switch (type) {
    case 'NEW_BOOKING':
    case 'ONLINE_BOOKING': return 'booking';
    case 'DAILY_SUMMARY': return 'reminder';
    default:              return 'system';
  }
}

export interface Notification {
  id: number;
  notification_type: NotificationType;
  notification_type_display: string;
  title: string;
  message: string;
  link_url: string;
  appointment_id: number | null;
  patient_id: number | null;
  patient_name: string | null;
  practitioner_id: number | null;
  practitioner_name: string | null;
  clinic_branch_id: number | null;
  clinic_branch_name: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Notification[];
}

export interface UnreadCountResponse {
  unread_count: number;
}

export interface MarkAllReadResponse {
  marked_read: number;
}