import { useState, useCallback, useEffect } from 'react';
import { DISCIPLINE_OPTIONS } from '../types/staff.types';
import { useAuthStore } from '@/store/auth.store';

export interface DisciplineOption {
  value: string;
  label: string;
  isCustom?: boolean;
}

/** Returns a clinic-scoped localStorage key so disciplines never bleed across clinics. */
const getStorageKey = (clinicId: number | null): string =>
  clinicId != null ? `pms_custom_disciplines_${clinicId}` : 'pms_custom_disciplines';

const loadCustomDisciplines = (storageKey: string): DisciplineOption[] => {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as DisciplineOption[]) : [];
  } catch {
    return [];
  }
};

/**
 * Returns the full list of discipline options (built-in + custom),
 * plus a helper to permanently add a new custom discipline.
 *
 * Custom disciplines are persisted in a clinic-scoped localStorage key so
 * they are never visible to users of a different clinic.
 */
export const useDisciplineOptions = () => {
  const clinicId = useAuthStore(s => s.user?.clinic ?? null);
  const storageKey = getStorageKey(clinicId);

  const [customDisciplines, setCustomDisciplines] = useState<DisciplineOption[]>(
    () => loadCustomDisciplines(storageKey),
  );

  // Re-sync when the clinic changes (e.g. after login resolves the user object)
  useEffect(() => {
    setCustomDisciplines(loadCustomDisciplines(storageKey));
  }, [storageKey]);

  const allOptions: DisciplineOption[] = [
    ...DISCIPLINE_OPTIONS,
    ...customDisciplines,
  ];

  /**
   * Adds a new custom discipline (persisted in localStorage).
   * Returns the created option, or undefined if label is empty / already exists.
   */
  const addDiscipline = useCallback((label: string): DisciplineOption | undefined => {
    const trimmed = label.trim();
    if (!trimmed) return undefined;

    // Derive a stable value key from the label
    const value = trimmed
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '');

    // Prevent duplicates against both built-in and custom options
    const existing = [...DISCIPLINE_OPTIONS, ...loadCustomDisciplines(storageKey)];
    if (existing.some(d => d.value === value || d.label.toLowerCase() === trimmed.toLowerCase())) {
      return existing.find(
        d => d.value === value || d.label.toLowerCase() === trimmed.toLowerCase(),
      ) as DisciplineOption;
    }

    const newOption: DisciplineOption = { value, label: trimmed, isCustom: true };

    setCustomDisciplines(prev => {
      const updated = [...prev, newOption];
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // quota exceeded – still work in-memory
      }
      return updated;
    });

    return newOption;
  }, [storageKey]);

  return { allOptions, addDiscipline };
};
