import api from '@/lib/axios';

export interface CaseDocument {
  id: number;
  patient: number;
  patient_name: string;
  patient_case: number | null;
  case_title: string | null;
  clinic: number;
  uploaded_by: number;
  uploaded_by_name: string;
  title: string;
  description: string;
  category: 'CLINICAL_NOTE' | 'LETTER' | 'REPORT' | 'LAB_RESULT' | 'IMAGING' | 'REFERRAL' | 'INSURANCE' | 'ATTACHMENT' | 'OTHER';
  source_type: 'UPLOAD' | 'CLINICAL_NOTE' | 'LETTER' | 'REPORT';
  source_id: number | null;
  file: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export const getCaseDocuments = async (patientId: string | number): Promise<CaseDocument[]> => {
  const response = await api.get(`/case-documents/?patient=${patientId}`);
  return response.data;
};

export const uploadCaseDocument = async (
  patientId: string | number,
  patientCaseId: number | null,
  file: File,
  title: string,
  category: string,
  description?: string
): Promise<CaseDocument> => {
  const formData = new FormData();
  formData.append('patient', patientId.toString());
  if (patientCaseId) {
    formData.append('patient_case', patientCaseId.toString());
  }
  formData.append('file', file);
  formData.append('title', title || file.name);
  formData.append('category', category);
  if (description) {
    formData.append('description', description);
  }
  
  const response = await api.post('/case-documents/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const deleteCaseDocument = async (id: number): Promise<void> => {
  await api.delete(`/case-documents/${id}/`);
};
