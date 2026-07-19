import api from '@/lib/axios';

export interface Letter {
  id: number;
  subject: string;
  status: 'DRAFT' | 'FINAL' | 'SENT';
  created_at: string;
  updated_at: string;
  rendered_pdf: string | null;
  patient_case: number | null;
  template: number | null;
  practitioner_name?: string;
  is_signed: boolean;
  sent_to: string[];
}

export const getLetters = async (patientId: string | number): Promise<Letter[]> => {
  const response = await api.get(`/letters/letters/?patient=${patientId}`);
  return response.data.results || response.data;
};

export const generateLetter = async (data: {
  template_id: number;
  patient_id: string | number;
  subject: string;
  patient_case_id?: number;
}): Promise<Letter> => {
  const response = await api.post('/letters/letters/generate/', data);
  return response.data;
};

export const deleteLetter = async (id: number): Promise<void> => {
  await api.delete(`/letters/letters/${id}/`);
};
