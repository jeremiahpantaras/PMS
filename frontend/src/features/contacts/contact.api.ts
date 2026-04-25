import axiosInstance from '@/lib/axios';
import type { Contact, CreateContactData, ContactStats, PaginatedResponse } from '@/types';

/**
 * Normalize a Philippine phone number to +639XXXXXXXXX format for the API.
 * Accepts: 09XXXXXXXXX, +639XXXXXXXXX, (63)XXXXXXXXX, (02)XXXXXXXX, etc.
 */
const normalizePhoneForAPI = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  let cleaned = digits;
  if (cleaned.startsWith('63')) cleaned = cleaned.slice(2);
  else if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  return `+63${cleaned}`;
};

export interface ContactFilters {
  search?: string;
  contact_type?: string;
  is_active?: boolean;
  is_preferred?: boolean;
  page?: number;
  page_size?: number;
}

/**
 * Get all contacts with filters
 */
export const getContacts = async (filters?: ContactFilters): Promise<PaginatedResponse<Contact>> => {
  const params = new URLSearchParams();
  
  if (filters?.search) params.append('search', filters.search);
  if (filters?.contact_type) params.append('contact_type', filters.contact_type);
  if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
  if (filters?.is_preferred !== undefined) params.append('is_preferred', String(filters.is_preferred));
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.page_size) params.append('page_size', String(filters.page_size));

  const response = await axiosInstance.get<PaginatedResponse<Contact>>(
    `/contacts/?${params.toString()}`
  );
  return response.data;
};

/**
 * Get single contact by ID
 */
export const getContact = async (id: number): Promise<Contact> => {
  const response = await axiosInstance.get<Contact>(`/contacts/${id}/`);
  return response.data;
};

/**
 * Create new contact
 */
export const createContact = async (data: CreateContactData): Promise<Contact> => {
  const payload: CreateContactData = {
    ...data,
    phone: normalizePhoneForAPI(data.phone),
    ...(data.alternative_phone ? { alternative_phone: normalizePhoneForAPI(data.alternative_phone) } : {}),
  };
  const response = await axiosInstance.post<Contact>('/contacts/', payload);
  return response.data;
};

/**
 * Update contact
 */
export const updateContact = async (id: number, data: Partial<CreateContactData>): Promise<Contact> => {
  const payload: Partial<CreateContactData> = {
    ...data,
    ...(data.phone ? { phone: normalizePhoneForAPI(data.phone) } : {}),
    ...(data.alternative_phone ? { alternative_phone: normalizePhoneForAPI(data.alternative_phone) } : {}),
  };
  const response = await axiosInstance.patch<Contact>(`/contacts/${id}/`, payload);
  return response.data;
};

/**
 * Delete contact
 */
export const deleteContact = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/contacts/${id}/`);
};

/**
 * Toggle contact active status
 */
export const toggleContactActive = async (id: number): Promise<Contact> => {
  const response = await axiosInstance.post<Contact>(`/contacts/${id}/toggle_active/`);
  return response.data;
};

/**
 * Toggle contact preferred status
 */
export const toggleContactPreferred = async (id: number): Promise<Contact> => {
  const response = await axiosInstance.post<Contact>(`/contacts/${id}/toggle_preferred/`);
  return response.data;
};

/**
 * Get contact statistics
 */
export const getContactStats = async (): Promise<ContactStats> => {
  const response = await axiosInstance.get<ContactStats>('/contacts/stats/');
  return response.data;
};

/**
 * Send email to contact
 */
export const sendContactEmail = async (contactId: number, message: string): Promise<{ success: boolean; message: string }> => {
  const response = await axiosInstance.post<{ success: boolean; message: string }>(
    `/contacts/${contactId}/send_email/`,
    { message }
  );
  return response.data;
};