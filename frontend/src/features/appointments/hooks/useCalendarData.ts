import { useMemo } from 'react';
import { useAppointments } from './useAppointments';
import { useBlockAppointments } from './useBlockAppointments';
import { useNotes } from './useNotes';
import { useDailyStats } from './useDailyStats';

interface UseCalendarDataParams {
  startDate: Date;
  endDate: Date;
  practitionerId?: number | null;
  clinicBranchId?: number | null;
  blockClinicBranchId?: number | null;
}

export const useCalendarData = ({
  startDate,
  endDate,
  practitionerId = null,
  clinicBranchId = null,
  blockClinicBranchId = null,
}: UseCalendarDataParams) => {
  const appointmentState = useAppointments({
    startDate,
    endDate,
    practitionerId,
    clinicBranchId,
  });

  const blockState = useBlockAppointments({
    startDate,
    endDate,
    clinicBranchId: blockClinicBranchId,
  });

  const noteState = useNotes({
    startDate,
    endDate,
    clinicBranchId: blockClinicBranchId ?? clinicBranchId,
    // Scope note fetching to the selected practitioner so only that practitioner's
    // notes (plus clinic-wide null notes from the backend) are loaded.
    practitionerId,
  });

  const statsState = useDailyStats({
    startDate,
    endDate,
    clinicBranchId: clinicBranchId,
  });

  return useMemo(() => ({
    appointments: appointmentState.appointments,
    updateAppointmentInState: appointmentState.updateAppointmentInState,
    addAppointmentToState: appointmentState.addAppointmentToState,
    removeAppointmentFromState: appointmentState.removeAppointmentFromState,
    refetchAppointments: appointmentState.refetch,

    blockAppointments: blockState.blockAppointments,
    updateBlockAppointmentInState: blockState.updateBlockAppointmentInState,
    addBlockAppointmentToState: blockState.addBlockAppointmentToState,
    removeBlockAppointmentFromState: blockState.removeBlockAppointmentFromState,
    refetchBlockAppointments: blockState.refetch,

    notes: noteState.notes,
    addNoteToState: noteState.addNoteToState,
    removeNoteFromState: noteState.removeNoteFromState,
    updateNoteInState: noteState.updateNoteInState,
    refetchNotes: noteState.refetch,

    dailyStats: statsState.dailyStats,
    refetchStats: statsState.refetchStats,

    // Unified loading / error — consumers can gate rendering on these
    loading: appointmentState.loading || blockState.loading,
    error: appointmentState.error || blockState.error,
  }), [
    appointmentState.updateAppointmentInState,
    appointmentState.addAppointmentToState,
    appointmentState.removeAppointmentFromState,
    appointmentState.refetch,
    appointmentState.loading,
    appointmentState.error,
    blockState.blockAppointments,
    blockState.updateBlockAppointmentInState,
    blockState.addBlockAppointmentToState,
    blockState.removeBlockAppointmentFromState,
    blockState.refetch,
    blockState.loading,
    blockState.error,
    noteState.notes,
    noteState.addNoteToState,
    noteState.removeNoteFromState,
    noteState.updateNoteInState,
    noteState.refetch,
    statsState.dailyStats,
    statsState.refetchStats,
    appointmentState.appointments,
  ]);
};
