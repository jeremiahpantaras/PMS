import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckSquare,
  Clock,
  Loader2,
  Square,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { bulkCancelAppointments } from '@/features/appointments/appointment.api';
import { CancelAppointmentModal } from '@/features/appointments/components/CancelAppointmentModal';
import { AppointmentDetailModal } from './components/AppointmentDetailModal';
import { usePatientProfileContext } from './context/PatientProfileContext';
import {
  APPOINTMENT_TYPE_LABELS,
  getAppointmentIdsWithNotes,
  getDaysUntilAppointment,
  getSimplifiedAppointmentStatus,
} from './patientProfile.utils.tsx';
import type { Appointment } from '@/types';

type AppointmentFilter = 'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED' | 'UNFINISHED';
const APPOINTMENTS_PER_PAGE = 8;

const isSelectableForCancellation = (appointment: Appointment, hasClinicalNote: boolean): boolean => {
  const isCancelledOrNoShow = appointment.status === 'CANCELLED' || appointment.arrival_status === 'DNA';
  if (isCancelledOrNoShow) return false;

  // Only Upcoming and Unfinished should be cancellable.
  return !hasClinicalNote;
};

interface AppointmentRowProps {
  appointment: Appointment;
  hasClinicalNote: boolean;
  isSelectableForCancellation: boolean;
  isSelected: boolean;
  onSelect: (appointmentId: number) => void;
  onClick: (appointment: Appointment) => void;
}

const AppointmentRow = ({
  appointment,
  hasClinicalNote,
  isSelectableForCancellation,
  isSelected,
  onSelect,
  onClick,
}: AppointmentRowProps) => {
  const statusConfig = getSimplifiedAppointmentStatus(appointment, hasClinicalNote);

  return (
    <div className="relative">
      {isSelectableForCancellation && (
        <button
          type="button"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(appointment.id);
          }}
        >
          {isSelected ? (
            <CheckSquare className="w-5 h-5 text-sky-600" />
          ) : (
            <Square className="w-5 h-5 text-gray-400 hover:text-sky-500" />
          )}
        </button>
      )}

      <button
        type="button"
        onClick={() => onClick(appointment)}
        className={`w-full text-left flex items-center gap-4 px-4 py-3 rounded-lg border border-gray-200 hover:border-sky-300 hover:bg-sky-50/40 transition-all group ${
          isSelectableForCancellation
            ? (isSelected ? 'bg-sky-50 border-sky-300' : 'bg-white')
            : 'bg-gray-50 opacity-60'
        }`}
        style={{ paddingLeft: isSelectableForCancellation ? '2.5rem' : '1rem' }}
      >
        <div className="shrink-0 w-11 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase leading-none">
            {new Date(appointment.date).toLocaleDateString('en-US', { month: 'short' })}
          </p>
          <p className="text-lg font-bold text-gray-900 leading-tight">{new Date(appointment.date).getDate()}</p>
          <p className="text-[10px] text-gray-400 leading-none">{new Date(appointment.date).getFullYear()}</p>
        </div>

        <div className="w-px h-9 bg-gray-200 shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {APPOINTMENT_TYPE_LABELS[appointment.appointment_type] || appointment.appointment_type}
            </p>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig.color}`}>
              {statusConfig.icon}
              {statusConfig.label}
            </span>
          </div>

          <p className="text-xs text-gray-500 mt-0.5 truncate">
            <Clock className="w-3 h-3 inline mr-1" />
            {appointment.start_time} – {appointment.end_time}
            {appointment.practitioner_name && <> • {appointment.practitioner_name}</>}
          </p>

          {appointment.cancellation_reason && (
            <p className="text-xs text-red-500 mt-0.5 truncate">Reason: {appointment.cancellation_reason}</p>
          )}
        </div>

        <span className="shrink-0 text-xs text-gray-300 group-hover:text-sky-500 transition-colors font-medium">
          View →
        </span>
      </button>
    </div>
  );
};

export const PatientAppointmentsPage = () => {
  const {
    patient,
    appointments,
    clinicalNotes,
    loadingAppointments,
    refreshAppointments,
  } = usePatientProfileContext();

  const [filter, setFilter] = useState<AppointmentFilter>('ALL');
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<Set<number>>(new Set());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isBulkCancelModalOpen, setIsBulkCancelModalOpen] = useState(false);
  const [isBulkCancelling, setIsBulkCancelling] = useState(false);
  const [bulkCancelError, setBulkCancelError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const appointmentIdsWithNotes = useMemo(() => getAppointmentIdsWithNotes(clinicalNotes), [clinicalNotes]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      const hasNote = appointmentIdsWithNotes.has(appointment.id);
      const daysUntil = getDaysUntilAppointment(appointment.date);
      const isUpcoming = daysUntil >= 1;
      const notCancelled = appointment.status !== 'CANCELLED' && appointment.arrival_status !== 'DNA';
      const isUnfinished = daysUntil < 1 && !hasNote && notCancelled;

      if (filter === 'UPCOMING') return isUpcoming;
      if (filter === 'COMPLETED') return hasNote;
      if (filter === 'CANCELLED') return appointment.status === 'CANCELLED' || appointment.arrival_status === 'DNA';
      if (filter === 'UNFINISHED') return isUnfinished;
      return true;
    });
  }, [appointments, appointmentIdsWithNotes, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredAppointments.length / APPOINTMENTS_PER_PAGE));

  const paginatedAppointments = useMemo(() => {
    const startIndex = (currentPage - 1) * APPOINTMENTS_PER_PAGE;
    return filteredAppointments.slice(startIndex, startIndex + APPOINTMENTS_PER_PAGE);
  }, [filteredAppointments, currentPage]);

  const selectableAppointmentIdSet = useMemo(() => {
    const ids = new Set<number>();
    appointments.forEach((appointment) => {
      const hasNote = appointmentIdsWithNotes.has(appointment.id);
      if (isSelectableForCancellation(appointment, hasNote)) {
        ids.add(appointment.id);
      }
    });
    return ids;
  }, [appointments, appointmentIdsWithNotes]);

  const selectedCancellableIds = useMemo(
    () => Array.from(selectedAppointmentIds).filter((id) => selectableAppointmentIdSet.has(id)),
    [selectedAppointmentIds, selectableAppointmentIdSet]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setSelectedAppointmentIds((prev) => {
      let hasInvalidSelection = false;
      const next = new Set<number>();

      prev.forEach((id) => {
        if (selectableAppointmentIdSet.has(id)) {
          next.add(id);
        } else {
          hasInvalidSelection = true;
        }
      });

      return hasInvalidSelection ? next : prev;
    });
  }, [selectableAppointmentIdSet]);

  const cancellableAppointments = useMemo(
    () => paginatedAppointments.filter((appointment) => {
      const hasClinicalNote = appointmentIdsWithNotes.has(appointment.id);
      return isSelectableForCancellation(appointment, hasClinicalNote);
    }),
    [paginatedAppointments, appointmentIdsWithNotes]
  );

  const allSelected = cancellableAppointments.length > 0
    && cancellableAppointments.every((appointment) => selectedAppointmentIds.has(appointment.id));

  const handleSelectAll = () => {
    const cancellableIds = cancellableAppointments.map((appointment) => appointment.id);

    if (allSelected) {
      setSelectedAppointmentIds((prev) => {
        const next = new Set(prev);
        cancellableIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }

    setSelectedAppointmentIds((prev) => {
      const next = new Set(prev);
      cancellableIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleToggleSelect = (appointmentId: number) => {
    if (!selectableAppointmentIdSet.has(appointmentId)) {
      return;
    }

    const nextSelected = new Set(selectedAppointmentIds);
    if (nextSelected.has(appointmentId)) {
      nextSelected.delete(appointmentId);
    } else {
      nextSelected.add(appointmentId);
    }
    setSelectedAppointmentIds(nextSelected);
  };

  const handleBulkCancel = async (reason: string) => {
    setIsBulkCancelling(true);
    setBulkCancelError(null);

    if (selectedCancellableIds.length === 0) {
      setBulkCancelError('No eligible appointments selected for cancellation');
      setIsBulkCancelling(false);
      return;
    }

    try {
      const result = await bulkCancelAppointments({
        appointment_ids: selectedCancellableIds,
        cancellation_reason: reason,
      });

      if (result.cancelled_count > 0) {
        toast.success(`Successfully cancelled ${result.cancelled_count} appointment(s)`);
      }
      if (result.failed_count > 0) {
        toast.error(`${result.failed_count} appointment(s) could not be cancelled`);
      }

      setSelectedAppointmentIds(new Set());
      setIsBulkCancelModalOpen(false);
      await refreshAppointments();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      const message = err.response?.data?.detail || 'Failed to cancel appointments';
      setBulkCancelError(message);
      toast.error(message);
    } finally {
      setIsBulkCancelling(false);
    }
  };

  const startItemIndex = filteredAppointments.length === 0 ? 0 : (currentPage - 1) * APPOINTMENTS_PER_PAGE + 1;
  const endItemIndex = Math.min(currentPage * APPOINTMENTS_PER_PAGE, filteredAppointments.length);

  return (
    <>
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-heading text-gray-900">Appointments</h1>
              <p className="text-sm text-gray-500 mt-1">
                {patient?.full_name || 'Patient'} • {appointments.length} total appointments
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div className="flex items-center gap-1">
              {(['ALL', 'UPCOMING', 'COMPLETED', 'UNFINISHED', 'CANCELLED'] as const).map((nextFilter) => (
                <button
                  key={nextFilter}
                  type="button"
                  onClick={() => setFilter(nextFilter)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    filter === nextFilter
                      ? 'bg-sky-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {nextFilter.charAt(0) + nextFilter.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {cancellableAppointments.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="flex items-center gap-1.5 text-xs px-2 py-1.5 text-gray-600 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors"
                >
                  {allSelected ? (
                    <>
                      <CheckSquare className="w-4 h-4" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4" />
                      Select All
                    </>
                  )}
                </button>
              )}

              {selectedCancellableIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsBulkCancelModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Cancel ({selectedCancellableIds.length})
                </button>
              )}
            </div>
          </div>

          {loadingAppointments ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-7 h-7 text-sky-400 animate-spin" />
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                <Calendar className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">No appointments found</p>
              <p className="text-xs text-gray-400 mt-1">
                {filter !== 'ALL' ? `No ${filter.toLowerCase()} appointments` : 'This patient has no appointment history'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedAppointments.map((appointment) => (
                <AppointmentRow
                  key={appointment.id}
                  appointment={appointment}
                  hasClinicalNote={appointmentIdsWithNotes.has(appointment.id)}
                  isSelectableForCancellation={isSelectableForCancellation(appointment, appointmentIdsWithNotes.has(appointment.id))}
                  isSelected={selectedAppointmentIds.has(appointment.id)}
                  onSelect={handleToggleSelect}
                  onClick={(nextAppointment) => {
                    setSelectedAppointment(nextAppointment);
                    setIsDetailOpen(true);
                  }}
                />
              ))}
            </div>
          )}

          {!loadingAppointments && filteredAppointments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-gray-500">
                Showing {startItemIndex}-{endItemIndex} of {filteredAppointments.length} appointments
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <span className="text-xs text-gray-600 min-w-18 text-center">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AppointmentDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedAppointment(null);
        }}
        appointment={selectedAppointment}
        patientEmail={patient?.email}
      />

      <CancelAppointmentModal
        isOpen={isBulkCancelModalOpen}
        appointment={null}
        isCancelling={isBulkCancelling}
        cancelError={bulkCancelError}
        onConfirm={handleBulkCancel}
        onClose={() => setIsBulkCancelModalOpen(false)}
        selectedCount={selectedCancellableIds.length}
      />
    </>
  );
};

export default PatientAppointmentsPage;
