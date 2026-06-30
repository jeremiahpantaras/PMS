import axiosInstance from '@/lib/axios';
import type {
  Notification,
  NotificationListResponse,
  UnreadCountResponse,
  MarkAllReadResponse,
} from '../types/notifications.types';

const BASE = '/notifications';

export const notificationsApi = {

  /** GET /notifications/ — paginated list */
  getAll: async (params?: {
    is_read?: boolean;
    notification_type?: string;
    page?: number;
    date_from?: string;
    date_to?: string;
    branch?: number;
  }): Promise<NotificationListResponse> => {
    const { data } = await axiosInstance.get(`${BASE}/`, { params });
    return data;
  },

  /** GET /notifications/{id}/ */
  getById: async (id: number): Promise<Notification> => {
    const { data } = await axiosInstance.get(`${BASE}/${id}/`);
    return data;
  },

  /** GET /notifications/unread_count/ */
  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    const { data } = await axiosInstance.get(`${BASE}/unread_count/`);
    return data;
  },

  /** POST /notifications/{id}/mark_read/ */
  markRead: async (id: number): Promise<Notification> => {
    const { data } = await axiosInstance.post(`${BASE}/${id}/mark_read/`);
    return data;
  },

  /** POST /notifications/mark_all_read/ */
  markAllRead: async (): Promise<MarkAllReadResponse> => {
    const { data } = await axiosInstance.post(`${BASE}/mark_all_read/`);
    return data;
  },
};