import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getPatient } from '../patient.api';
import { getAppointments } from '@/features/appointments/appointment.api';
import { getNotes } from '@/features/clinical-template/clinical-templates.api';
import type { Patient, Appointment } from '@/types';
import type { ClinicalNote } from '@/types/clinicalTemplate';

interface PatientProfileContextValue {
  patientId: number;
  patient: Patient | null;
  appointments: Appointment[];
  clinicalNotes: ClinicalNote[];
  loadingPatient: boolean;
  loadingAppointments: boolean;
  loadingNotes: boolean;
  refreshPatient: () => Promise<void>;
  refreshAppointments: () => Promise<void>;
  refreshClinicalNotes: () => Promise<void>;
}

const PatientProfileContext = React.createContext<PatientProfileContextValue | undefined>(undefined);

interface PatientProfileProviderProps {
  patientId: number;
  children: React.ReactNode;
}

export const PatientProfileProvider: React.FC<PatientProfileProviderProps> = ({ patientId, children }) => {
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>([]);

  const [loadingPatient, setLoadingPatient] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(true);

  const refreshPatient = useCallback(async () => {
    setLoadingPatient(true);
    try {
      const data = await getPatient(patientId);
      setPatient(data);
    } catch {
      toast.error('Failed to load patient details');
      navigate('/clients');
    } finally {
      setLoadingPatient(false);
    }
  }, [patientId, navigate]);

  const refreshAppointments = useCallback(async () => {
    setLoadingAppointments(true);
    try {
      const response = await getAppointments({ patient: patientId, page_size: 100 });
      const sorted = [...(response.results ?? [])].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      setAppointments(sorted);
    } catch {
      toast.error('Failed to load appointment history');
    } finally {
      setLoadingAppointments(false);
    }
  }, [patientId]);

  const refreshClinicalNotes = useCallback(async () => {
    setLoadingNotes(true);
    try {
      const data = await getNotes({ patient: patientId });
      setClinicalNotes(data);
    } catch {
      toast.error('Failed to load clinical notes');
    } finally {
      setLoadingNotes(false);
    }
  }, [patientId]);

  useEffect(() => {
    void refreshPatient();
    void refreshAppointments();
    void refreshClinicalNotes();
  }, [refreshPatient, refreshAppointments, refreshClinicalNotes]);

  const contextValue = useMemo<PatientProfileContextValue>(() => ({
    patientId,
    patient,
    appointments,
    clinicalNotes,
    loadingPatient,
    loadingAppointments,
    loadingNotes,
    refreshPatient,
    refreshAppointments,
    refreshClinicalNotes,
  }), [
    patientId,
    patient,
    appointments,
    clinicalNotes,
    loadingPatient,
    loadingAppointments,
    loadingNotes,
    refreshPatient,
    refreshAppointments,
    refreshClinicalNotes,
  ]);

  return (
    <PatientProfileContext.Provider value={contextValue}>
      {children}
    </PatientProfileContext.Provider>
  );
};

export const usePatientProfileContext = (): PatientProfileContextValue => {
  const context = useContext(PatientProfileContext);
  if (!context) {
    throw new Error('usePatientProfileContext must be used within a PatientProfileProvider');
  }
  return context;
};
