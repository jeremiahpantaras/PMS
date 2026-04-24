import axiosInstance from '@/lib/axios';
import type { Patient, CreatePatientData, PaginatedResponse } from '@/types';

export interface PatientFilters {
  search?: string;
  gender?: 'M' | 'F' | 'O' | '';
  is_active?: boolean;
  // ── Archive filters ──────────────────────────────────────────────────────
  archived?: boolean;          // ?archived=true  → only archived patients
  include_archived?: boolean;  // ?include_archived=true → all patients
  page?: number;
  page_size?: number;
}

export interface ArchiveResponse {
  detail: string;
  patient_id: number;
  is_archived: boolean;
  archived_at?: string;
  archived_by?: string;
}

export interface PatientConsentRecord {
  id: number;
  patient: number | null;
  patient_name?: string;
  portal_link: number;
  full_name: string;
  email: string;
  consent_text: string;
  signature: string;
  created_at: string;
}

/**
 * Get all patients with filters
 */
export const getPatients = async (filters?: PatientFilters): Promise<PaginatedResponse<Patient>> => {
  const params = new URLSearchParams();

  if (filters?.search)                          params.append('search',           filters.search);
  if (filters?.gender)                          params.append('gender',           filters.gender);
  if (filters?.is_active !== undefined)         params.append('is_active',        String(filters.is_active));
  if (filters?.archived === true)               params.append('archived',         'true');
  if (filters?.include_archived === true)       params.append('include_archived', 'true');
  if (filters?.page)                            params.append('page',             String(filters.page));
  if (filters?.page_size)                       params.append('page_size',        String(filters.page_size));

  const response = await axiosInstance.get<PaginatedResponse<Patient>>(
    `/patients/?${params.toString()}`
  );
  return response.data;
};

/**
 * Get single patient by ID
 */
export const getPatient = async (id: number): Promise<Patient> => {
  const response = await axiosInstance.get<Patient>(`/patients/${id}/`);
  return response.data;
};

/**
 * Create new patient
 */
export const createPatient = async (data: CreatePatientData): Promise<Patient> => {
  const response = await axiosInstance.post<Patient>('/patients/', data);
  return response.data;
};

/**
 * Update patient
 */
export const updatePatient = async (id: number, data: Partial<CreatePatientData>): Promise<Patient> => {
  const response = await axiosInstance.patch<Patient>(`/patients/${id}/`, data);
  return response.data;
};

/**
 * Delete patient (soft delete)
 */
export const deletePatient = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/patients/${id}/`);
};

/**
 * Archive a patient — hides them and their appointments from the diary.
 * POST /patients/{id}/archive/
 */
export const archivePatient = async (id: number): Promise<ArchiveResponse> => {
  const response = await axiosInstance.post<ArchiveResponse>(`/patients/${id}/archive/`);
  return response.data;
};

/**
 * Restore an archived patient — makes them and their appointments visible again.
 * POST /patients/{id}/restore/
 */
export const restorePatient = async (id: number): Promise<ArchiveResponse> => {
  const response = await axiosInstance.post<ArchiveResponse>(`/patients/${id}/restore/`);
  return response.data;
};

/**
 * Get patient intake forms
 */
export const getPatientIntakeForms = async (patientId: number) => {
  const response = await axiosInstance.get(`/patients/${patientId}/intake_forms/`);
  return response.data;
};

/**
 * Get patient legal/privacy consents
 */
export const getPatientConsents = async (patientId: number): Promise<PatientConsentRecord[]> => {
  const response = await axiosInstance.get<PatientConsentRecord[]>(`/patients/${patientId}/consents/`);
  return response.data;
};