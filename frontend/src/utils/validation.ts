export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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