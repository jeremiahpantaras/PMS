import { useState, useEffect } from 'react';
import {
  getDashboardMetrics,
  getPatientStatistics,
  getDashboardAnalytics,
} from '../api/dashboard.api';
import type { DashboardData } from '../types/dashboard.types';
import toast from 'react-hot-toast';

// Color palette for appointment types
const TYPE_COLORS = [
  '#0EA5E9', // sky
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#EF4444', // red
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
];

export const useDashboardData = () => {
  const [data,      setData]      = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [metrics, patientStats, analytics] = await Promise.all([
          getDashboardMetrics(),
          getPatientStatistics(),
          getDashboardAnalytics(),
        ]);

        const dashboardData: DashboardData = {
          stats: {
            todayOccupancy: {
              current:    metrics.today_completed,
              total:      metrics.today_appointments,
              percentage: metrics.today_occupancy_pct ?? 0,
            },
            todayBookings:      metrics.today_appointments,
            todayNewClients:    patientStats.new_this_month,
            todayCancellations: 0, // loaded via metrics if needed
            todayConfirmed:     metrics.today_confirmed,
            todayDeclined:      metrics.today_declined,
            todayAwaiting:      metrics.today_awaiting,
          },
          bookingsByType: analytics.bookings_per_type.map((item, i) => ({
            type:  item.type,
            count: item.count,
            color: TYPE_COLORS[i % TYPE_COLORS.length],
          })),
          weeklyBookings: analytics.weekly_bookings,
        };

        setData(dashboardData);
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          ?? 'Failed to fetch dashboard data';
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const refresh = () => window.location.reload();

  return { data, isLoading, error, refresh };
};