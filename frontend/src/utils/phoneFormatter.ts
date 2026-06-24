/**
 * Philippine phone number formatter and validator.
 * Standard: (+63) XXX XXX XXXX  (10 digits after +63, starting with 9)
 */

/**
 * Format a raw phone input into "(+63) XXX XXX XXXX" as the user types.
 * Strips non-digits, removes leading 0 or 63 prefix, then formats.
 */
export const formatPHPhone = (value: string): string => {
  if (!value) return '';
  
  const digits = value.replace(/\D/g, '');

  let cleaned = digits;
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('63')) cleaned = cleaned.slice(2);

  if (!cleaned) return '';

  // Limit to 10 digits
  cleaned = cleaned.slice(0, 10);

  const part1 = cleaned.slice(0, 3);
  const part2 = cleaned.slice(3, 6);
  const part3 = cleaned.slice(6, 10);

  let formatted = '(+63)';
  if (part1) formatted += ` ${part1}`;
  if (part2) formatted += ` ${part2}`;
  if (part3) formatted += ` ${part3}`;

  return formatted;
};

/**
 * Returns true if the value represents a valid Philippine mobile number.
 * Accepts any formatting — strips non-digits before checking.
 */
export const isValidPHPhone = (value: string): boolean => {
  if (!value) return false;
  const digits = value.replace(/\D/g, '');

  let cleaned = digits;
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('63')) cleaned = cleaned.slice(2);

  return /^9\d{9}$/.test(cleaned);
};

/**
 * Normalize a phone value to the canonical storage format "+63XXXXXXXXXX".
 * Use this before sending to the backend.
 */
export const normalizePHPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');

  let cleaned = digits;
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('63')) cleaned = cleaned.slice(2);

  return `+63${cleaned}`;
};
