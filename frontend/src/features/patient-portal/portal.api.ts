import axios from 'axios';
import type {
  PortalData,
  BookingPayload,
  BookingConfirmation,
  PortalConsentPayload,
  PortalConsentResponse,
} from './types/portal';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api';

const publicApi = axios.create({ baseURL: BASE });

export interface ClinicConsentFormData {
  id: number;
  title: string;
  header_content: string;
  body_content: string;
  is_active: boolean;
  clinic_name: string;
}

export interface ClinicConsentDocumentPayload {
  title: string;
  header_snapshot: string;
  body_snapshot: string;
  signature: string;
  consent_version: string;
  signer_full_name: string;
  signer_email: string;
}

export interface ClinicConsentDocumentResponse {
  id: number;
  title: string;
  header_snapshot: string;
  body_snapshot: string;
  signature: string;
  signed_at: string;
  consent_version: string;
  signer_full_name: string;
  signer_email: string;
  created_at: string;
}

export const fetchPortal = async (token: string): Promise<PortalData> => {
  const res = await publicApi.get<PortalData>(`/public/portal/${token}/`);
  return res.data;
};

export const fetchAvailableSlots = async (
  token:          string,
  serviceId:      number,
  date:           string,
  practitionerId?: number | null,
): Promise<{ date: string; slots: string[] }> => {
  const params: Record<string, string | number> = {
    service: serviceId,
    date,
  };
  if (practitionerId != null) {
    params.practitioner = practitionerId;
  }
  const res = await publicApi.get(`/public/portal/${token}/slots/`, { params });
  return res.data;
};

export const submitBooking = async (
  token:   string,
  payload: BookingPayload,
): Promise<BookingConfirmation> => {
  const res = await publicApi.post<BookingConfirmation>(
    `/public/portal/${token}/book/`,
    payload,
  );
  return res.data;
};

export const createPortalConsent = async (
  token: string,
  payload: PortalConsentPayload,
): Promise<PortalConsentResponse> => {
  const res = await publicApi.post<PortalConsentResponse>(
    `/public/portal/${token}/consent/`,
    payload,
  );
  return res.data;
};

export const fetchActiveClinicConsent = async (
  token: string,
): Promise<ClinicConsentFormData | null> => {
  try {
    const res = await publicApi.get<ClinicConsentFormData>(
      `/public/portal/${token}/clinic_consent/form/`,
    );
    return res.data;
  } catch {
    return null;
  }
};

export const createClinicConsentDocument = async (
  token: string,
  payload: ClinicConsentDocumentPayload,
): Promise<ClinicConsentDocumentResponse> => {
  const res = await publicApi.post<ClinicConsentDocumentResponse>(
    `/public/portal/${token}/clinic_consent/`,
    payload,
  );
  return res.data;
};