import api from '@/lib/axios';

export interface LetterTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
  version: number;
}

export const getActiveLetterTemplates = async (): Promise<LetterTemplate[]> => {
  const response = await api.get('/letters/templates/active/');
  return response.data;
};
