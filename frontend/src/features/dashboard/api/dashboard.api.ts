import axiosInstance from '@/lib/axios';
import type { ClinicianPerformanceData, OccupancyEntry } from '../types/dashboard.types';

export interface DashboardMetricsResponse {
  today_appointments: number;
  today_completed: number;
  today_pending: number;
  month_revenue: number;
  active_patients: number;
  pending_invoices: number;
}

export interface PatientStatisticsResponse {
  total_patients: number;
  active_patients: number;
  new_this_month: number;
  by_gender: Array<{
    gender: string;
    count: number;
  }>;
}

export interface DashboardAnalyticsResponse {
  bookings_per_type: Array<{ type: string; count: number }>;
  weekly_bookings:   Array<{ day: string; date: string; count: number }>;
}

export interface LiveOccupancyResponse {
  snapshot:     OccupancyEntry[];
  generated_at: string;
  date:         string;
}

export interface ClinicianPerformanceParams {
  start_date?:      string;
  end_date?:        string;
  practitioner_id?: number;
}

/** Get dashboard metrics for today */
export const getDashboardMetrics = async (): Promise<DashboardMetricsResponse> => {
  const response = await axiosInstance.get<DashboardMetricsResponse>(
    '/reports/dashboard_metrics/'
  );
  return response.data;
};

/** Get patient statistics */
export const getPatientStatistics = async (): Promise<PatientStatisticsResponse> => {
  const response = await axiosInstance.get<PatientStatisticsResponse>(
    '/reports/patient_statistics/'
  );
  return response.data;
};

/** Get bookings-per-type and 7-day weekly trend */
export const getDashboardAnalytics = async (): Promise<DashboardAnalyticsResponse> => {
  const response = await axiosInstance.get<DashboardAnalyticsResponse>(
    '/reports/dashboard_analytics/'
  );
  return response.data;
};

/** Get per-provider time-series performance data */
export const getClinicianPerformance = async (
  params?: ClinicianPerformanceParams,
): Promise<ClinicianPerformanceData> => {
  const response = await axiosInstance.get<ClinicianPerformanceData>(
    '/reports/clinician_performance/',
    { params },
  );
  return response.data;
};

/** Get today's live occupancy snapshot (seeds the WebSocket widget) */
export const getLiveOccupancy = async (): Promise<LiveOccupancyResponse> => {
  const response = await axiosInstance.get<LiveOccupancyResponse>(
    '/reports/live_occupancy/',
  );
  return response.data;
};
