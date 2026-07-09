import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { getDailyStats } from '@/features/appointments/appointment.api';
import type { DailyStatsResponse } from '@/features/appointments/appointment.api';

interface UseDailyStatsParams {
  startDate: Date;
  endDate: Date;
  clinicBranchId?: number | null;
}

export const useDailyStats = ({
  startDate,
  endDate,
  clinicBranchId,
}: UseDailyStatsParams) => {
  const [dailyStats, setDailyStats] = useState<DailyStatsResponse>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    if (!clinicBranchId) return;

    setIsLoading(true);
    setError(null);
    try {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      
      const response = await getDailyStats({
        start_date: startStr,
        end_date: endStr,
        clinic_branch: clinicBranchId,
      });
      setDailyStats(response);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, clinicBranchId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    dailyStats,
    isLoadingStats: isLoading,
    statsError: error,
    refetchStats: fetchStats,
  };
};
