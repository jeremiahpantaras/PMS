export type AccessLevel = 'none' | 'view' | 'edit';

export type UserRole = 'ADMIN' | 'ADMIN_ASSISTANT' | 'PRACTITIONER' | 'STAFF' | 'FINANCE' | 'READ_ONLY';

export type FeatureKey =
  | 'dashboard'
  | 'appointments'
  | 'calendar'
  | 'diary'
  | 'clinical_notes'
  | 'client_cases'
  | 'patients'
  | 'reports'
  | 'inventory'
  | 'invoices'
  | 'billing'
  | 'subscriptions'
  | 'setup'
  | 'staff_management'
  | 'permissions'
  | 'settings'
  | 'documents'
  | 'outcome_measures'
  | 'contacts'
  | 'communication'
  // Granular Setup card permissions
  | 'setup_practice'
  | 'setup_items'
  | 'setup_users'
  | 'setup_account'
  | 'setup_communication'
  // Granular Manage card permissions
  | 'manage_administration'
  | 'manage_clinical'
  | 'manage_communications'
  // Granular Report card permissions
  | 'reports_administration'
  | 'reports_clinic'
  | 'reports_financial'
  | 'reports_performance';

export type PermissionsMap = Record<FeatureKey, AccessLevel>;

/** A single clinic branch returned in the manager_branches list. */
export interface ManagerBranch {
  id:             number;
  name:           string;
  city?:          string | null;
  is_main_branch: boolean;
}

export interface User {
  id:                    number;
  email:                 string;
  first_name:            string;
  last_name:             string;
  /** Primary role — highest-priority entry in `roles`. Kept for backward compat. */
  role:                  UserRole;
  /** All roles currently assigned to this user (multi-role support). */
  roles:                 UserRole[];
  phone:                 string;
  avatar:                string | null;
  avatar_url:            string | null;
  is_active:             boolean;
  clinic:                number | null;
  /** Primary branch this user is assigned to (single FK — backward compat). */
  clinic_branch?:        number | null;
  clinic_branch_name?:   string | null;
  created_at:            string;
  password_changed:       boolean;
  needs_password_change:  boolean;
  /** True when a temporary password is active — user MUST change it before proceeding. */
  must_change_password:   boolean;
  password_rotation:      'none' | 'weekly' | 'monthly' | 'yearly';
  last_password_change:   string | null;
  clinic_setup_complete: boolean;
  practitioner_id?:      number;
  // RBAC
  permission_group?:      number | null;
  permission_group_name?: string | null;
  permissions_map?:       PermissionsMap;
  // Phase 10: Manager multi-branch scope
  /** True when the user holds the ADMIN_ASSISTANT (Manager) role. */
  is_manager?:            boolean;
  /**
   * For Owner (ADMIN): all branches in the clinic family.
   * For Manager (ADMIN_ASSISTANT): only branches they are assigned to manage.
   * For all other roles: empty array.
   */
  manager_branches?:     ManagerBranch[];
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
  first_name:          string;
  last_name:           string;
  company_name:        string;
  email:               string;
  phone?:              string;
  /** Issued by verify-admin-otp; required for account creation */
  verification_token?: string;
}

export interface AdminRegisterResponse {
  message:          string;
  onboarding_token: string;
  user_email:       string;
  clinic: {
    id:   number;
    name: string;
  };
  portal_token?: string;
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

// ── New OTP-based Forgot Password flow ────────────────────────────────────────

export interface ForgotPasswordSendOtpResponse {
  message:     string;
  expires_in:  number;   // seconds until OTP expires (default 300)
  cooldown:    number;   // seconds until resend is available (default 60)
}

export interface ForgotPasswordVerifyOtpResponse {
  reset_token: string;   // short-lived token for the reset endpoint
}

export interface ForgotPasswordResetResponse {
  message: string;
  user:    User;
  tokens:  AuthTokens;
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