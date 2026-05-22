import axios from 'axios';
import type { 
  LoginCredentials, 
  LoginResponse, 
  AdminRegisterData,
  AdminRegisterResponse,
  ForgotPasswordResponse,
  VerifyCodeResponse,
  ResetPasswordResponse,
  User,
  AuthTokens,
} from '@/types/auth';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

const authApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export const authService = {
  /**
   * Admin Registration
   */
  async registerAdmin(data: AdminRegisterData): Promise<AdminRegisterResponse> {
    try {
      const response = await authApi.post<AdminRegisterResponse>(
        '/auth/register-admin/',
        data
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data || { detail: 'Registration failed' };
    }
  },

  /**
   * User Login
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      // Normalize email to lowercase before sending to prevent case-sensitive login failures.
      const normalizedCredentials = { ...credentials, email: credentials.email.trim().toLowerCase() };
      const response = await authApi.post<LoginResponse>('/auth/login/', normalizedCredentials);
      
      if (response.data.tokens) {
        localStorage.setItem('access_token', response.data.tokens.access);
        localStorage.setItem('refresh_token', response.data.tokens.refresh);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } catch (error: any) {
      throw error.response?.data || { detail: 'Login failed' };
    }
  },

  /**
   * User Logout
   */
  async logout(): Promise<void> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      const accessToken = localStorage.getItem('access_token');
      
      if (refreshToken && accessToken) {
        await authApi.post(
          '/auth/logout/',
          { refresh_token: refreshToken },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('auth-storage');
    }
  },

  /**
   * Verify Token
   */
  async verifyToken(token: string): Promise<{ valid: boolean; detail: string }> {
    try {
      const response = await authApi.post('/auth/verify-token/', { token });
      return response.data;
    } catch (error: any) {
      console.error('Token verification error:', error);
      return { valid: false, detail: 'Token verification failed' };
    }
  },

  /**
   * Fetch the current authenticated user's fresh data from the server.
   * This is used during session restore (verifyAuth) to ensure the latest
   * permissions_map is loaded, even if an admin changed the user's
   * permission group since their last login.
   */
  async getMe(token: string): Promise<User> {
    const response = await authApi.get<User>('/auth/me/', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  /**
   * Get current user from localStorage
   */
  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  /**
   * Get access token
   */
  getAccessToken() {
    return localStorage.getItem('access_token');
  },

  /**
   * Get refresh token
   */
  getRefreshToken() {
    return localStorage.getItem('refresh_token');
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<string> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await authApi.post('/auth/token/refresh/', {
        refresh: refreshToken,
      });
      
      const newAccessToken = response.data.access;
      localStorage.setItem('access_token', newAccessToken);
      
      return newAccessToken;
    } catch (error) {
      this.logout();
      throw error;
    }
  },

  /**
   * Admin Registration — Step 1
   * Validates reCAPTCHA and sends a 6-digit OTP to the given email.
   */
  async sendAdminOtp(
    email: string,
    captchaToken: string,
    firstName?: string,
    resend = false,
  ): Promise<{ message: string; cooldown_seconds: number }> {
    try {
      const response = await authApi.post('/auth/send-admin-otp/', {
        email: email.trim().toLowerCase(),
        captcha_token: captchaToken,
        first_name:    firstName ?? '',
        resend,
      });
      return response.data;
    } catch (error: any) {
      throw error.response?.data || { detail: 'Failed to send verification code' };
    }
  },

  /**
   * Admin Registration — Step 2
   * Verifies the 6-digit OTP; returns a short-lived verification token on success.
   */
  async verifyAdminOtp(
    email: string,
    code: string,
  ): Promise<{ message: string; verification_token: string }> {
    try {
      const response = await authApi.post('/auth/verify-admin-otp/', { email: email.trim().toLowerCase(), code });
      return response.data;
    } catch (error: any) {
      throw error.response?.data || { detail: 'OTP verification failed' };
    }
  },

  /**
   * Request password reset - send verification code to email
   * @deprecated Use forgotPasswordSendOtp instead (legacy endpoint)
   */
  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    try {
      const response = await authApi.post<ForgotPasswordResponse>('/auth/forgot-password/', { email: email.trim().toLowerCase() });
      return response.data;
    } catch (error: any) {
      throw error.response?.data || { detail: 'Failed to send verification code' };
    }
  },

  /**
   * Verify the code entered by user
   * @deprecated Use forgotPasswordVerifyOtp instead (legacy endpoint)
   */
  async verifyCode(email: string, code: string): Promise<VerifyCodeResponse> {
    try {
      const response = await authApi.post<VerifyCodeResponse>('/auth/verify-code/', { email: email.trim().toLowerCase(), code });
      return response.data;
    } catch (error: any) {
      throw error.response?.data || { detail: 'Code verification failed' };
    }
  },

  /**
   * Reset password using verified code
   * @deprecated Use forgotPasswordReset instead (legacy endpoint)
   * Note: newPassword is not needed - backend will generate a new one
   */
  async resetPassword(email: string, code: string, _newPassword: string): Promise<ResetPasswordResponse> {
    try {
      const response = await authApi.post<ResetPasswordResponse>('/auth/reset-password-with-code/', {
        email: email.trim().toLowerCase(),
        code
      });
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      throw err.response?.data || { detail: 'Password reset failed' };
    }
  },

  // ── New OTP-based Forgot Password flow ────────────────────────────────────

  /**
   * Forgot Password — Step 1
   * Sends a 6-digit OTP to the provided email (no disclosure whether the
   * address exists, preventing email enumeration).
   *
   * Returns timing metadata for the OTP / resend timers.
   */
  async forgotPasswordSendOtp(
    email: string,
  ): Promise<{ message: string; expires_in: number; cooldown: number }> {
    try {
      const response = await authApi.post(
        '/auth/forgot-password/send-otp/',
        { email: email.trim().toLowerCase() },
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data || { detail: 'Unable to process request.' };
    }
  },

  /**
   * Forgot Password — Step 2
   * Verifies the 6-digit OTP and returns a short-lived reset token that
   * must be presented to forgotPasswordReset.
   */
  async forgotPasswordVerifyOtp(
    email: string,
    otp: string,
  ): Promise<{ reset_token: string }> {
    try {
      const response = await authApi.post(
        '/auth/forgot-password/verify-otp/',
        { email: email.trim().toLowerCase(), otp },
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data || { detail: 'OTP verification failed.' };
    }
  },

  /**
   * Forgot Password — Step 3
   * Consumes the reset token and sets the new user-chosen password.
   * Returns fresh JWT tokens (auto-login) on success.
   */
  async forgotPasswordReset(
    email: string,
    resetToken: string,
    newPassword: string,
  ): Promise<{ message: string; user: User; tokens: AuthTokens }> {
    try {
      const response = await authApi.post(
        '/auth/forgot-password/reset/',
        {
          email:        email.trim().toLowerCase(),
          reset_token:  resetToken,
          new_password: newPassword,
        },
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data || { detail: 'Password reset failed.' };
    }
  },

  /**
   * Mandatory first-login password change.
   * Called when must_change_password === true.
   * Returns updated user + fresh JWT tokens.
   */
  async changePasswordFirstLogin(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ detail: string; user: User; tokens: AuthTokens }> {
    try {
      const token = localStorage.getItem('access_token');
      const response = await authApi.post(
        '/auth/change-password-first-login/',
        { current_password: currentPassword, new_password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      throw err.response?.data || { detail: 'Password change failed. Please try again.' };
    }
  },

  /**
   * Admin Onboarding — Step 4
   * Exchanges the onboarding_token (issued by register-admin) for a JWT
   * by setting the admin's chosen password.  No prior auth required.
   */
  async setupOnboardingPassword(
    onboardingToken: string,
    email: string,
    newPassword: string,
  ): Promise<{ detail: string; user: User; tokens: AuthTokens }> {
    try {
      const response = await authApi.post(
        '/auth/setup-onboarding-password/',
        {
          onboarding_token: onboardingToken,
          email: email.trim().toLowerCase(),
          new_password: newPassword,
        },
      );
      return response.data;
    } catch (error: any) {
      throw error.response?.data || { detail: 'Password setup failed. Please try again.' };
    }
  },
};