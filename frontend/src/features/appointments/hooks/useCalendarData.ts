import { useMemo } from 'react';
import { useAppointments } from './useAppointments';
import { useBlockAppointments } from './useBlockAppointments';

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

  return useMemo(() => ({
    appointments: appointmentState.appointments,
    updateAppointmentInState: appointmentState.updateAppointmentInState,
    addAppointmentToState: appointmentState.addAppointmentToState,
    refetchAppointments: appointmentState.refetch,

    blockAppointments: blockState.blockAppointments,
    updateBlockAppointmentInState: blockState.updateBlockAppointmentInState,
    refetchBlockAppointments: blockState.refetch,
  }), [
    appointmentState.appointments,
    appointmentState.updateAppointmentInState,
    appointmentState.addAppointmentToState,
    appointmentState.refetch,
    blockState.blockAppointments,
    blockState.updateBlockAppointmentInState,
    blockState.refetch,
  ]);
};
