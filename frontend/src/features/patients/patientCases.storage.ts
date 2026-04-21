import type { ClinicalNote } from '@/types/clinicalTemplate';

export type PatientCaseStatus = 'OPEN' | 'MONITORING' | 'CLOSED' | 'DISCHARGED';

export interface PatientCase {
  id: string;
  patientId: number;
  title: string;
  description: string;
  status: PatientCaseStatus;
  createdAt: string;
  primaryPractitionerId?: string;
  primaryPractitionerName?: string;
  referredBy?: string;
  referralInfo?: string;
}

type NoteCaseLinkMap = Record<string, string>;

const CASE_STORAGE_KEY = 'pms_patient_cases_v1';
const NOTE_LINK_STORAGE_KEY = 'pms_patient_note_case_links_v1';

const canUseStorage = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readFromStorage = <T,>(key: string, fallback: T): T => {
  if (!canUseStorage()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeToStorage = <T,>(key: string, value: T) => {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently ignore storage failures.
  }
};

const noteLinkKey = (patientId: number, noteId: number): string => `${patientId}:${noteId}`;

export const listPatientCases = (patientId: number): PatientCase[] => {
  const allCases = readFromStorage<PatientCase[]>(CASE_STORAGE_KEY, []);
  return allCases
    .filter((caseItem) => caseItem.patientId === patientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const createPatientCase = (
  patientId: number,
  payload: {
    title: string;
    description?: string;
    status?: PatientCaseStatus;
    primaryPractitionerId?: string;
    primaryPractitionerName?: string;
    referredBy?: string;
    referralInfo?: string;
  }
): PatientCase => {
  const allCases = readFromStorage<PatientCase[]>(CASE_STORAGE_KEY, []);

  const createdCase: PatientCase = {
    id: `case_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    patientId,
    title: payload.title.trim(),
    description: payload.description?.trim() ?? '',
    status: payload.status ?? 'OPEN',
    createdAt: new Date().toISOString(),
    primaryPractitionerId: payload.primaryPractitionerId,
    primaryPractitionerName: payload.primaryPractitionerName,
    referredBy: payload.referredBy?.trim(),
    referralInfo: payload.referralInfo?.trim(),
  };

  allCases.push(createdCase);
  writeToStorage(CASE_STORAGE_KEY, allCases);

  return createdCase;
};

export const updatePatientCase = (
  patientId: number,
  caseId: string,
  updates: Partial<Pick<PatientCase, 'title' | 'description' | 'status' | 'primaryPractitionerId' | 'primaryPractitionerName' | 'referredBy' | 'referralInfo'>>
): PatientCase | null => {
  const allCases = readFromStorage<PatientCase[]>(CASE_STORAGE_KEY, []);
  const index = allCases.findIndex((caseItem) => caseItem.patientId === patientId && caseItem.id === caseId);

  if (index === -1) return null;

  const existing = allCases[index];
  const updated: PatientCase = {
    ...existing,
    title: updates.title !== undefined ? updates.title.trim() : existing.title,
    description: updates.description !== undefined ? updates.description.trim() : existing.description,
    status: updates.status ?? existing.status,
    primaryPractitionerId: updates.primaryPractitionerId !== undefined ? updates.primaryPractitionerId : existing.primaryPractitionerId,
    primaryPractitionerName: updates.primaryPractitionerName !== undefined ? updates.primaryPractitionerName : existing.primaryPractitionerName,
    referredBy: updates.referredBy !== undefined ? updates.referredBy?.trim() : existing.referredBy,
    referralInfo: updates.referralInfo !== undefined ? updates.referralInfo?.trim() : existing.referralInfo,
  };

  allCases[index] = updated;
  writeToStorage(CASE_STORAGE_KEY, allCases);

  return updated;
};

export const deletePatientCase = (patientId: number, caseId: string) => {
  const allCases = readFromStorage<PatientCase[]>(CASE_STORAGE_KEY, []);
  const nextCases = allCases.filter((caseItem) => !(caseItem.patientId === patientId && caseItem.id === caseId));
  writeToStorage(CASE_STORAGE_KEY, nextCases);

  const links = readFromStorage<NoteCaseLinkMap>(NOTE_LINK_STORAGE_KEY, {});
  const nextLinks = { ...links };

  Object.entries(links).forEach(([key, linkedCaseId]) => {
    if (linkedCaseId === caseId && key.startsWith(`${patientId}:`)) {
      delete nextLinks[key];
    }
  });

  writeToStorage(NOTE_LINK_STORAGE_KEY, nextLinks);
};

export const getCaseIdForNote = (patientId: number, noteId: number): string | null => {
  const links = readFromStorage<NoteCaseLinkMap>(NOTE_LINK_STORAGE_KEY, {});
  return links[noteLinkKey(patientId, noteId)] ?? null;
};

export const assignNotesToCase = (patientId: number, noteIds: number[], caseId: string) => {
  if (noteIds.length === 0) return;

  const links = readFromStorage<NoteCaseLinkMap>(NOTE_LINK_STORAGE_KEY, {});
  const nextLinks = { ...links };

  noteIds.forEach((noteId) => {
    nextLinks[noteLinkKey(patientId, noteId)] = caseId;
  });

  writeToStorage(NOTE_LINK_STORAGE_KEY, nextLinks);
};

export const clearCaseForNotes = (patientId: number, noteIds: number[]) => {
  if (noteIds.length === 0) return;

  const links = readFromStorage<NoteCaseLinkMap>(NOTE_LINK_STORAGE_KEY, {});
  const nextLinks = { ...links };

  noteIds.forEach((noteId) => {
    delete nextLinks[noteLinkKey(patientId, noteId)];
  });

  writeToStorage(NOTE_LINK_STORAGE_KEY, nextLinks);
};

export const getCaseNotes = (patientId: number, caseId: string, notes: ClinicalNote[]): ClinicalNote[] => {
  return notes.filter((note) => getCaseIdForNote(patientId, note.id) === caseId);
};

export const getUnassignedNotes = (patientId: number, notes: ClinicalNote[]): ClinicalNote[] => {
  return notes.filter((note) => !getCaseIdForNote(patientId, note.id));
};

export const getCaseNoteCount = (patientId: number, caseId: string, notes: ClinicalNote[]): number => {
  return getCaseNotes(patientId, caseId, notes).length;
};
