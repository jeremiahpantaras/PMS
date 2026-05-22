export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Returns a specific error message for an invalid email, or '' if valid.
 * Checks for spaces, missing @, missing domain, and overall format.
 */
export const validateEmailDetailed = (email: string): string => {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required';
  if (/\s/.test(email)) return 'Email must not contain spaces';
  if (!trimmed.includes('@')) return 'Email must contain @';
  const atIdx = trimmed.lastIndexOf('@');
  const local  = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);
  if (!local)  return 'Email must have content before @';
  if (!domain) return 'Email must have a domain after @';
  if (!domain.includes('.')) return 'Email must include a valid domain (e.g. .com)';
  const tld = domain.split('.').pop() ?? '';
  if (tld.length < 2) return 'Email domain extension is too short';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Please enter a valid email address';
  return '';
};

/**
 * Validate Philippine phone number.
 * Delegates to isValidPHPhone from phoneFormatter utility.
 */
export const validatePhone = (phone: string): boolean => {
  if (!phone) return true; // Phone is optional

  const digits = phone.replace(/\D/g, '');
  let cleaned = digits;
  if (cleaned.startsWith('0'))  cleaned = cleaned.slice(1);
  if (cleaned.startsWith('63')) cleaned = cleaned.slice(2);
  return /^9\d{9}$/.test(cleaned);
};

/**
 * Returns a specific error message for an invalid PH phone number, or '' if valid.
 * Distinguishes between invalid characters, wrong prefix, too short, and too long.
 */
export const validatePHPhoneDetailed = (value: string, required = true): string => {
  const empty = !value || !value.trim() || value.trim() === '(+63)';
  if (empty) return required ? 'Phone number is required' : '';

  // Check for disallowed characters (anything that isn't digit, space, +, (, ))
  const stripped = value.replace(/[\s()+]/g, '');
  if (/[^0-9]/.test(stripped)) return 'Phone number contains invalid characters';

  const digits = value.replace(/\D/g, '');
  let cleaned = digits;
  if (cleaned.startsWith('0'))  cleaned = cleaned.slice(1);
  if (cleaned.startsWith('63')) cleaned = cleaned.slice(2);

  if (!cleaned.startsWith('9')) return 'Phone number must start with a valid prefix (09 or +63 9)';
  if (cleaned.length < 10) return 'Phone number is too short';
  if (cleaned.length > 10) return 'Phone number is too long';
  return '';
};

export const validatePassword = (password: string): { valid: boolean; message: string } => {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*)' };
  }
  return { valid: true, message: '' };
};

export const validateName = (name: string): boolean => {
  if (!name || name.trim().length < 2) return false;
  // Only letters, spaces, hyphens, and apostrophes
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  return nameRegex.test(name);
};

export const validateCompanyName = (name: string): boolean => {
  if (!name || name.trim().length < 2) return false;
  return name.trim().length <= 255;
};

export const sanitizeInput = (input: string): string => {
  // Remove HTML tags but keep spaces (don't use trim() as it prevents typing spaces)
  return input.replace(/[<>]/g, '');
};

export const formatPhoneNumber = (phone: string): string => {
  // Delegate to formatPHPhone standard
  const digits = phone.replace(/\D/g, '');
  let cleaned = digits;
  if (cleaned.startsWith('0'))  cleaned = cleaned.slice(1);
  if (cleaned.startsWith('63')) cleaned = cleaned.slice(2);
  cleaned = cleaned.slice(0, 10);

  const p1 = cleaned.slice(0, 3);
  const p2 = cleaned.slice(3, 6);
  const p3 = cleaned.slice(6, 10);

  let formatted = '(+63)';
  if (p1) formatted += ` ${p1}`;
  if (p2) formatted += ` ${p2}`;
  if (p3) formatted += ` ${p3}`;
  return formatted;
};