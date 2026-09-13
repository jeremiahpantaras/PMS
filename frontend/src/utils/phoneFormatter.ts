import { isValidPhoneNumber as isValidIntlPhone, formatPhoneNumberIntl } from 'react-phone-number-input';

/**
 * Format a raw phone input into an international format.
 * Primarily used for display purposes if not using PhoneInput directly.
 */
export const formatPHPhone = (value: string): string => {
  if (!value) return '';
  try {
    return formatPhoneNumberIntl(value) || value;
  } catch {
    return value;
  }
};

/**
 * Returns true if the value represents a valid international mobile number.
 */
export const isValidPHPhone = (value: string): boolean => {
  if (!value) return false;
  return isValidIntlPhone(value);
};

/**
 * Normalize a phone value to the canonical storage format (E.164).
 * PhoneInput already returns E.164, so this is mostly a pass-through now.
 */
export const normalizePHPhone = (value: string): string => {
  return value ? value.replace(/\s+/g, '') : '';
};

