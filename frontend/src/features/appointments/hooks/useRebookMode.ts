import { useState, useCallback } from 'react';
import type { Appointment } from '@/types';

export interface RebookData {
  clinic:           number;
  patient:          number;
  practitioner:     number | null;
  service:          number | null;
  appointment_type: string;
  duration_minutes: number;
  chief_complaint:  string;
  notes:            string;
  patient_notes:    string;
  // Display helpers
  patient_name:  string;
  service_name:  string | null;
}

export const useRebookMode = () => {
  const [rebookMode, setRebookMode] = useState(false);
  const [rebookData, setRebookData] = useState<RebookData | null>(null);

  const startRebook = useCallback((appointment: Appointment) => {
    const [startH, startM] = appointment.start_time.split(':').map(Number);
    const [endH,   endM]   = appointment.end_time.split(':').map(Number);
    const duration = Math.max((endH * 60 + endM) - (startH * 60 + startM), 15);

    setRebookData({
      clinic:           appointment.clinic,
      patient:          appointment.patient,
      practitioner:     appointment.practitioner,
      service:          appointment.service,
      appointment_type: appointment.appointment_type,
      duration_minutes: duration,
      chief_complaint:  appointment.chief_complaint,
      notes:            appointment.notes,
      patient_notes:    appointment.patient_notes,
      patient_name:     appointment.patient_name,
      service_name:     appointment.service_name,
    });
    setRebookMode(true);
  }, []);

  const exitRebook = useCallback(() => {
    setRebookMode(false);
    setRebookData(null);
  }, []);

  return { rebookMode, rebookData, startRebook, exitRebook };
};
