import { useState, useEffect, useCallback } from 'react';
import { getAppointments, getPortalBookingsForDiary } from '../appointment.api';
import { format } from 'date-fns';
import type { Appointment } from '@/types';
import type { PortalBookingDiaryItem } from '../appointment.api';
import toast from 'react-hot-toast';

interface UseAppointmentsParams {
  startDate:       Date;
  endDate:         Date;
  practitionerId?: number | null;
  clinicBranchId?: number | null;
}

export const useAppointments = ({
  startDate,
  endDate,
  practitionerId = null,
  clinicBranchId = null,
}: UseAppointmentsParams) => {
  const [appointments,   setAppointments]   = useState<Appointment[]>([]);
  const [portalBookings, setPortalBookings] = useState<PortalBookingDiaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr   = format(endDate,   'yyyy-MM-dd');

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // FIX: Build params with proper typing
      // page_size is capped at 200; date-range filtering on the backend
      // ensures results are already scoped to the visible calendar window.
      const apptParams: { start_date: string; end_date: string; practitioner?: number; page_size?: number } = {
        start_date: startDateStr,
        end_date:   endDateStr,
        page_size:  200,
      };
      if (practitionerId !== null) apptParams.practitioner = practitionerId;

      const portalParams: { start_date: string; end_date: string; practitioner?: number } = {
        start_date: startDateStr,
        end_date:   endDateStr,
      };
      if (practitionerId !== null) portalParams.practitioner = practitionerId;

      const [apptResponse, portalResponse] = await Promise.all([
        getAppointments(apptParams),
        getPortalBookingsForDiary(portalParams),
      ]);

      const allAppointments: Appointment[] = apptResponse.results;

      const filteredAppointments = clinicBranchId === null
        ? allAppointments
        : allAppointments.filter(apt => {
            const aptBranch = apt.branch_id ?? apt.clinic;
            return aptBranch === clinicBranchId;
          });

      setAppointments(filteredAppointments);

      const pendingBookings = portalResponse.filter(
        (b: PortalBookingDiaryItem) => b.status === 'PENDING'
      );

      const filteredBookings = clinicBranchId === null
        ? pendingBookings
        : pendingBookings.filter((b: PortalBookingDiaryItem) => {
            const bookingBranch = b.practitioner_branch_id ?? b.portal_clinic_id ?? null;
            if (bookingBranch === null) return true;
            return bookingBranch === clinicBranchId;
          });

      setPortalBookings(filteredBookings);

    } catch (err: any) {
      console.error('Failed to fetch appointments:', err);
      const msg = err.response?.data?.detail || 'Failed to load appointments';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [startDateStr, endDateStr, practitionerId, clinicBranchId]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const removePortalBooking = useCallback((bookingId: number) => {
    setPortalBookings(prev => prev.filter(b => b.id !== bookingId));
  }, []);

  const updateAppointmentInState = useCallback((updated: Appointment) => {
    setAppointments(prev =>
      prev.map(appt => appt.id === updated.id ? updated : appt)
    );
  }, []);

  const addAppointmentToState = useCallback((appointment: Appointment) => {
    setAppointments(prev => {
      if (prev.some(a => a.id === appointment.id)) return prev;
      return [...prev, appointment];
    });
  }, []);

  return {
    appointments,
    portalBookings,
    loading,
    error,
    refetch: fetchAppointments,
    removePortalBooking,
    updateAppointmentInState,
    addAppointmentToState,
  };
};