import { useState, useEffect, useCallback } from 'react';
import { getBlockAppointments } from '../appointment.api';
import { format } from 'date-fns';
import type { BlockAppointment } from '@/types';
import toast from 'react-hot-toast';

interface UseBlockAppointmentsParams {
  startDate: Date;
  endDate: Date;
  clinicBranchId?: number | null;
}

export const useBlockAppointments = ({
  startDate,
  endDate,
  clinicBranchId = null,
}: UseBlockAppointmentsParams) => {
  const [blockAppointments, setBlockAppointments] = useState<BlockAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  const fetchBlockAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: { start_date: string; end_date: string; clinic_branch?: number } = {
        start_date: startDateStr,
        end_date: endDateStr,
      };
      if (clinicBranchId !== null) {
        params.clinic_branch = clinicBranchId;
      }

      const data = await getBlockAppointments(params);
      // Handle paginated response - API returns { count, results, ... }
      const items = Array.isArray(data) ? data : (data.results || []);
      setBlockAppointments(items as BlockAppointment[]);
    } catch (err: any) {
      console.error('Failed to fetch block appointments:', err);
      const msg = err.response?.data?.detail || 'Failed to load blocked events';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [startDateStr, endDateStr, clinicBranchId]);

  useEffect(() => {
    fetchBlockAppointments();
  }, [fetchBlockAppointments]);

  const addBlockAppointmentToState = useCallback((event: BlockAppointment) => {
    setBlockAppointments(prev => {
      if (prev.some(e => e.id === event.id)) return prev;
      return [...prev, event];
    });
  }, []);

  const removeBlockAppointmentFromState = useCallback((eventId: number) => {
    setBlockAppointments(prev => prev.filter(e => e.id !== eventId));
  }, []);

  const updateBlockAppointmentInState = useCallback((updated: BlockAppointment) => {
    setBlockAppointments(prev =>
      prev.map(e => e.id === updated.id ? updated : e)
    );
  }, []);

  return {
    blockAppointments,
    loading,
    error,
    refetch: fetchBlockAppointments,
    addBlockAppointmentToState,
    removeBlockAppointmentFromState,
    updateBlockAppointmentInState,
  };
};