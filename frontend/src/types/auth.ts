export interface User {
  id:                    number;
  email:                 string;
  first_name:            string;
  last_name:             string;
  role:                  'ADMIN' | 'PRACTITIONER' | 'STAFF';
  phone:                 string;
  avatar:                string | null;
  avatar_url:            string | null;  // ← NEW: full URL for avatar
  is_active:             boolean;
  clinic:                number | null;
  created_at:            string;
  password_changed:       boolean;
  needs_password_change:  boolean;
  password_rotation:      'none' | 'weekly' | 'monthly' | 'yearly';
  last_password_change:   string | null;
  clinic_setup_complete: boolean;   // ← NEW
  practitioner_id?:      number;    // ← For PRACTITIONER role: the linked Practitioner record ID
}

export interface AuthTokens {
  access:  string;
  refresh: string;
}

export interface LoginCredentials {
  email:    string;
  password: string;
}

export interface AdminRegisterData {
  first_name:   string;
  last_name:    string;
  company_name: string;
  email:        string;
  phone?:       string;
}

export interface AdminRegisterResponse {
  message:    string;
  email_sent: boolean;
  user:       User;
  tokens:     AuthTokens;
  clinic: {
    id:   number;
    name: string;
  };
}

export interface RegisterData {
  email:            string;
  first_name:       string;
  last_name:        string;
  password:         string;
  password_confirm: string;
  role:             'STAFF' | 'PRACTITIONER';
  phone?:           string;
}

export interface LoginResponse {
  user:                  User;
  tokens:                AuthTokens;
  needs_password_change?: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyCodeRequest {
  email: string;
  code: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  new_password: string;
}

export interface ForgotPasswordResponse {
  message: string;
  code_sent: boolean;
}

export interface VerifyCodeResponse {
  valid: boolean;
  message: string;
}

export interface ResetPasswordResponse {
  message: string;
  password_reset: boolean;
}

export interface AuthError {
  detail?:           string;
  email?:            string[];
  password?:         string[];
  phone?:            string[];
  first_name?:       string[];
  last_name?:        string[];
  company_name?:     string[];
  non_field_errors?: string[];
}

export interface AuthState {
  user:            User | null;
  tokens:          AuthTokens | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
}