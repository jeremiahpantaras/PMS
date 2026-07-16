import axiosInstance from '@/lib/axios';
import type { ClinicalTemplate, ClinicalNote, CreateClinicalNoteData } from '@/types/clinicalTemplate';

const BASE_URL = '/clinical-templates';

// ─── Template APIs ───────────────────────────────────────────────

export const getTemplates = async (): Promise<ClinicalTemplate[]> => {
  const response = await axiosInstance.get(`${BASE_URL}/templates/`);
  return response.data.results ?? response.data;
};

export const getActiveTemplates = async (): Promise<ClinicalTemplate[]> => {
  const response = await axiosInstance.get(`${BASE_URL}/templates/active/`);
  return response.data;
};

export const getTemplate = async (id: number): Promise<ClinicalTemplate> => {
  const response = await axiosInstance.get(`${BASE_URL}/templates/${id}/`);
  return response.data;
};

export const createTemplate = async (data: Partial<ClinicalTemplate>): Promise<ClinicalTemplate> => {
  try {
    const response = await axiosInstance.post(`${BASE_URL}/templates/`, data);
    return response.data;
  } catch (error: any) {
    // ✅ ADD THIS to see the actual validation errors
    console.error('Create template error response:', error.response?.data);
    throw error;
  }
};

export const updateTemplate = async (id: number, data: Partial<ClinicalTemplate>): Promise<ClinicalTemplate> => {
  const response = await axiosInstance.patch(`${BASE_URL}/templates/${id}/`, data);
  return response.data;
};

export const archiveTemplate = async (id: number): Promise<void> => {
  await axiosInstance.post(`${BASE_URL}/templates/${id}/archive/`);
};

export const createTemplateVersion = async (id: number): Promise<ClinicalTemplate> => {
  const response = await axiosInstance.post(`${BASE_URL}/templates/${id}/create_version/`);
  return response.data;
};

// ─── Clinical Note APIs ──────────────────────────────────────────

export const getNotes = async (filters?: {
  patient?: number;
  practitioner?: number;
  appointment?: number;
  is_signed?: boolean;
  is_draft?: boolean;
}): Promise<ClinicalNote[]> => {
  const params = new URLSearchParams();
  if (filters?.patient) params.append('patient', String(filters.patient));
  if (filters?.practitioner) params.append('practitioner', String(filters.practitioner));
  if (filters?.appointment) params.append('appointment', String(filters.appointment));
  if (filters?.is_signed !== undefined) params.append('is_signed', String(filters.is_signed));
  if (filters?.is_draft !== undefined) params.append('is_draft', String(filters.is_draft));

  const response = await axiosInstance.get(`${BASE_URL}/notes/?${params.toString()}`);
  return response.data.results ?? response.data;
};

export const getNote = async (id: number): Promise<ClinicalNote> => {
  const response = await axiosInstance.get(`${BASE_URL}/notes/${id}/`);
  return response.data;
};

export const createNote = async (data: CreateClinicalNoteData): Promise<ClinicalNote> => {
  const response = await axiosInstance.post(`${BASE_URL}/notes/`, data);
  return response.data;
};

export const updateNote = async (
  id: number, 
  data: Partial<{ content: Record<string, any>; date?: string; appointment?: number; amendment_reason?: string }>
): Promise<ClinicalNote> => {
  const response = await axiosInstance.patch(`${BASE_URL}/notes/${id}/`, data);
  return response.data;
};

export const signNote = async (id: number): Promise<ClinicalNote> => {
  const response = await axiosInstance.post(`${BASE_URL}/notes/${id}/sign/`);
  return response.data;
};

export const autosaveNote = async (id: number, content: Record<string, any>): Promise<{ detail: string; last_autosave: string }> => {
  const response = await axiosInstance.post(`${BASE_URL}/notes/${id}/autosave/`, { content });
  return response.data;
};

export const getNoteAuditLog = async (id: number) => {
  const response = await axiosInstance.get(`${BASE_URL}/notes/${id}/audit_log/`);
  return response.data;
};

export interface ClinicalNoteVersion {
  id: number;
  clinical_note: number;
  version_number: number;
  content: Record<string, any> | null;
  chart_annotation_data: Record<string, { chart_type: string; doodle_data: Record<string, unknown>[] }> | null;
  amendment_reason: string;
  created_by: number | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export const getNoteHistory = async (id: number): Promise<ClinicalNoteVersion[]> => {
  const response = await axiosInstance.get(`${BASE_URL}/notes/${id}/history/`);
  return response.data;
};

export const getNoteHistoryDetail = async (id: number, versionId: number): Promise<ClinicalNoteVersion> => {
  const response = await axiosInstance.get(`${BASE_URL}/notes/${id}/history/${versionId}/`);
  return response.data;
};

// ─── Email & Print APIs ──────────────────────────────────────────

export const emailNote = async (id: number): Promise<{ detail: string }> => {
  const response = await axiosInstance.post(`${BASE_URL}/notes/${id}/email_note/`);
  return response.data;
};

export const archiveNote = async (id: number): Promise<{ detail: string }> => {
  const response = await axiosInstance.post(`${BASE_URL}/notes/${id}/archive/`);
  return response.data;
};

export const restoreNote = async (id: number): Promise<{ detail: string }> => {
  const response = await axiosInstance.post(`${BASE_URL}/notes/${id}/restore/`);
  return response.data;
};

export const deleteNotePermanently = async (id: number): Promise<{ detail: string }> => {
  const response = await axiosInstance.delete(`${BASE_URL}/notes/${id}/`);
  return response.data;
};

export const getArchivedNotes = async (patientId: number): Promise<ClinicalNote[]> => {
  const response = await axiosInstance.get(`${BASE_URL}/notes/archived/?patient=${patientId}`);
  return response.data.results ?? response.data;
};

export interface PrintNoteResponse {
  patient_name: string;
  patient_number: string;
  patient_email: string;
  clinic_name: string;
  clinic_address: string;
  clinic_phone: string;
  clinic_email: string;
  practitioner_name: string;
  practitioner_title: string;
  practitioner_avatar?: string;
  practitioner_initials?: string;
  date: string | null;
  day_name: string;
  month: string;
  day: string;
  year: string;
  time: string;
  template_name: string;
  template_category: string;
  note_type: string;
  is_signed: boolean;
  signed_at: string | null;
  created_at: string | null;
  sections: Array<{
    title: string;
    description: string;
    fields: Array<{
      label: string;
      value: string;
      /** Base64 PNG for chart annotation fields */
      image?: string;
    }>;
  }>;
}

export const getPrintNote = async (id: number): Promise<PrintNoteResponse> => {
  const response = await axiosInstance.get(`${BASE_URL}/notes/${id}/print_note/`);
  return response.data;
};

export const sendClinicalNoteEmail = async (
  id: number,
  payload: { to: string; subject: string; body: string; attachment?: File }
): Promise<{ detail: string }> => {
  const formData = new FormData();
  formData.append('to', payload.to);
  formData.append('subject', payload.subject);
  formData.append('body', payload.body);
  if (payload.attachment) formData.append('attachment', payload.attachment);
  const response = await axiosInstance.post(`${BASE_URL}/notes/${id}/email_note/`, formData, {
    timeout: 90000,
  });
  return response.data;
};

export const openPrintNote = (id: number) => {
  const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
  const printUrl = `${API_URL}${BASE_URL}/notes/${id}/print_note_html/`;
  window.open(printUrl, '_blank');
};