import { AlertCircle, CheckCircle, Clock, FileText, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Appointment } from '@/types';
import type { ClinicalNote } from '@/types/clinicalTemplate';

export const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatDateTime = (dateString: string) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const getGenderLabel = (gender: string) => ({ M: 'Male', F: 'Female', O: 'Other' }[gender] ?? gender);

export const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  INITIAL: 'Initial Consultation',
  FOLLOW_UP: 'Follow-up',
  THERAPY: 'Therapy Session',
  ASSESSMENT: 'Assessment',
};

export const getDaysUntilAppointment = (appointmentDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const apptDate = new Date(appointmentDate);
  apptDate.setHours(0, 0, 0, 0);
  return Math.floor((apptDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export const getAppointmentIdsWithNotes = (clinicalNotes: ClinicalNote[]): Set<number> => {
  return new Set(
    clinicalNotes
      .filter((note) => note.appointment !== null)
      .map((note) => note.appointment as number)
  );
};

export interface PatientProfileStats {
  total: number;
  completed: number;
  upcoming: number;
  unfinished: number;
  cancelled: number;
  noShow: number;
}

export const getPatientProfileStats = (
  appointments: Appointment[],
  appointmentIdsWithNotes: Set<number>
): PatientProfileStats => {
  const completed = appointments.filter((a) => appointmentIdsWithNotes.has(a.id)).length;
  const cancelled = appointments.filter((a) => a.status === 'CANCELLED').length;
  const noShow = appointments.filter((a) => a.arrival_status === 'DNA').length;
  const upcoming = appointments.filter((a) => getDaysUntilAppointment(a.date) >= 1).length;
  const unfinished = appointments.filter((a) => {
    const daysUntil = getDaysUntilAppointment(a.date);
    const hasNote = appointmentIdsWithNotes.has(a.id);
    const notCancelled = a.status !== 'CANCELLED' && a.arrival_status !== 'DNA';
    return daysUntil < 1 && !hasNote && notCancelled;
  }).length;

  return {
    total: appointments.length,
    completed,
    upcoming,
    unfinished,
    cancelled,
    noShow,
  };
};

export interface SimplifiedAppointmentStatus {
  label: string;
  color: string;
  icon: ReactNode;
}

export const getSimplifiedAppointmentStatus = (
  appointment: Appointment,
  hasClinicalNote: boolean
): SimplifiedAppointmentStatus => {
  if (appointment.status === 'CANCELLED') {
    return {
      label: 'Cancelled',
      color: 'bg-red-50 text-red-700',
      icon: <XCircle className="w-3 h-3" />,
    };
  }

  if (appointment.arrival_status === 'DNA') {
    return {
      label: 'No Show',
      color: 'bg-gray-100 text-gray-600',
      icon: <AlertCircle className="w-3 h-3" />,
    };
  }

  if (hasClinicalNote) {
    return {
      label: 'Completed',
      color: 'bg-green-50 text-green-700',
      icon: <CheckCircle className="w-3 h-3" />,
    };
  }

  if (getDaysUntilAppointment(appointment.date) >= 1) {
    return {
      label: 'Upcoming',
      color: 'bg-blue-50 text-blue-700',
      icon: <Clock className="w-3 h-3" />,
    };
  }

  return {
    label: 'Unfinished',
    color: 'bg-orange-50 text-orange-700',
    icon: <FileText className="w-3 h-3" />,
  };
};
