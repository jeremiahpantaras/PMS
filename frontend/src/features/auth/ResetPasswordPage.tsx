import React, { useState, useCallback } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/services/authService';
import { Eye, EyeOff, Lock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import MalasakitWhiteLogo from '@/assets/malasakit/Primary Logo - White.svg';
import MalasakitColoredLogo from '@/assets/malasakit/Primary Logo - Colored.svg';
import toast from 'react-hot-toast';

/**
 * ResetPasswordPage — Step 3 of the OTP-based password recovery flow.
 *
 * Accessible only after a successful OTP verification.
 * Expects route state from /forgot-password/otp:
 *   { email: string, resetToken: string }
 *
 * The user sets a new password (no current password required).
 * On success the account is auto-logged-in and the user is redirected to
 * their appropriate post-login destination.
 *
 * Security:
 * - resetToken is consumed by the backend (single-use)
 * - Password strength is validated client-side AND server-side
 * - Password is never logged or stored in plain text
 */

interface LocationState {
  email:      string;
  resetToken: string;
}

interface Rule {
  label: string;
  test:  (pw: string) => boolean;
}

const RULES: Rule[] = [
  { label: 'At least 8 characters',        test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter (A–Z)',    test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter (a–z)',    test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number (0–9)',              test: (pw) => /\d/.test(pw) },
  { label: 'One special character (!@#…)', test: (pw) => /[!@#$%^&*()\-_=+\[\]{}|;':",.<>?/\\`~]/.test(pw) },
];

const isStrongPassword = (pw: string) => RULES.every((r) => r.test(pw));

export const ResetPasswordPage: React.FC = () => {
  const location   = useLocation();
  const navigate   = useNavigate();
  const { setAuth } = useAuthStore();
  const state      = location.state as LocationState | null;

  // ── Guard: must arrive via /forgot-password/otp ────────────────────────────
  if (!state?.email || !state?.resetToken) {
    return <Navigate to="/forgot-password" replace />;
  }

  const { email, resetToken } = state;

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [isLoading,       setIsLoading]       = useState(false);
  const [serverError,     setServerError]     = useState('');

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
    isStrongPassword(newPassword) && passwordsMatch && !isLoading;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;

      setIsLoading(true);
      setServerError('');
      try {
        const result = await authService.forgotPasswordReset(email, resetToken, newPassword);

        // Auto-login — persist user + tokens
        setAuth(result.user, result.tokens);

        toast.success('Password reset successfully! Welcome back.');

        // Redirect based on user state (same priority logic as Login.tsx)
        if (result.user.must_change_password) {
          navigate('/change-password', { replace: true });
        } else if (
          (result.user.roles ?? [result.user.role]).includes('ADMIN') &&
          !result.user.clinic_setup_complete
        ) {
          navigate('/clinic-setup', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } catch (err: unknown) {
        const detail =
          (err as { detail?: string })?.detail ??
          'Password reset failed. Please try again.';
        setServerError(detail);
        toast.error(detail);
      } finally {
        setIsLoading(false);
      }
    },
    [canSubmit, confirmPassword, email, navigate, newPassword, resetToken, setAuth],
  );

  return (
    <div className="min-h-screen flex">
      {/* ── Left branding panel ──────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-gradient p-12 flex-col justify-between relative overflow-hidden">
        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="animate-float-slow absolute top-[10%] left-[5%] w-28 h-28 rounded-full bg-white/10" style={{ animationDelay: '0s' }} />
          <div className="animate-float-slow absolute top-[55%] left-[2%] w-36 h-36 rounded-full bg-healing-mint/15" style={{ animationDelay: '3s' }} />
          <div className="animate-float-slow absolute top-[20%] right-[10%] w-24 h-24 rounded-full bg-white/10" style={{ animationDelay: '6s' }} />
          <div className="animate-float-slow absolute bottom-[8%] left-[28%] w-32 h-32 rounded-full bg-healing-mint/10" style={{ animationDelay: '1.5s' }} />
          <div className="animate-float-medium absolute top-[35%] left-[16%] w-16 h-16 rounded-full bg-white/15" style={{ animationDelay: '1s' }} />
          <div className="animate-float-medium absolute top-[8%] left-[48%] w-20 h-20 rounded-full bg-healing-mint/20" style={{ animationDelay: '4s' }} />
          <div className="animate-float-medium absolute top-[65%] left-[52%] w-14 h-14 rounded-full bg-white/10" style={{ animationDelay: '2s' }} />
          <div className="animate-float-fast absolute top-[28%] left-[33%] w-8 h-8 rounded-full bg-white/20" style={{ animationDelay: '0.5s' }} />
          <div className="animate-float-fast absolute top-[50%] left-[10%] w-10 h-10 rounded-full bg-healing-mint/25" style={{ animationDelay: '2.5s' }} />
          <div className="animate-float-fast absolute bottom-[28%] left-[60%] w-6 h-6 rounded-full bg-white/20" style={{ animationDelay: '1s' }} />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <img src={MalasakitWhiteLogo} alt="Malasakit Logo" className="h-10 w-auto" />
        </div>

        {/* Hero copy */}
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Set Your New<br />Password
          </h1>
          <p className="text-blue-100 text-lg max-w-md">
            Create a strong password to protect your Malasakit account. You'll be signed in automatically after resetting.
          </p>

          {/* Password rules summary */}
          <div className="space-y-2 pt-2">
            {RULES.map((rule) => (
              <div key={rule.label} className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  rule.test(newPassword) ? 'bg-green-400/80' : 'bg-white/20'
                }`}>
                  {rule.test(newPassword)
                    ? <CheckCircle className="w-3.5 h-3.5 text-white" />
                    : <div className="w-1.5 h-1.5 rounded-full bg-white/60" />}
                </div>
                <span className={`text-sm ${rule.test(newPassword) ? 'text-green-200' : 'text-blue-200'}`}>
                  {rule.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-blue-200 text-sm">
          © 2026 Malasakit EMR Solutions
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-clinical-cloud">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <img src={MalasakitColoredLogo} alt="Malasakit Logo" className="h-10 w-auto" />
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-trust-harbor">Set New Password</h2>
            <p className="mt-2 text-steady-slate text-sm">
              Resetting password for{' '}
              <span className="font-medium text-gray-800">{email}</span>
            </p>
          </div>

          {/* Server error */}
          {serverError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-800">{serverError}</p>
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* New password */}
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="new-password"
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-2xl bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-care-blue focus:border-transparent text-sm"
                  placeholder="Choose a strong password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  tabIndex={-1}
                >
                  {showNew
                    ? <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    : <Eye    className="h-5 w-5 text-gray-400 hover:text-gray-600" />}
                </button>
              </div>
            </div>

            {/* Password strength rules */}
            {newPassword.length > 0 && (
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2">
                {RULES.map((rule) => {
                  const passed = rule.test(newPassword);
                  return (
                    <div key={rule.label} className="flex items-center gap-2">
                      {passed
                        ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                        : <XCircle     className="w-4 h-4 text-gray-300 shrink-0" />}
                      <span className={`text-xs ${passed ? 'text-green-700' : 'text-gray-500'}`}>
                        {rule.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Confirm password */}
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`block w-full pl-10 pr-10 py-2.5 border rounded-2xl bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent text-sm ${
                    confirmPassword.length > 0 && !passwordsMatch
                      ? 'border-red-300 focus:ring-red-400'
                      : 'border-gray-200 focus:ring-care-blue'
                  }`}
                  placeholder="Re-enter your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  tabIndex={-1}
                >
                  {showConfirm
                    ? <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    : <Eye    className="h-5 w-5 text-gray-400 hover:text-gray-600" />}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="mt-1.5 text-sm text-red-600">Passwords do not match</p>
              )}
              {passwordsMatch && (
                <p className="mt-1.5 text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Passwords match
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-2xl shadow-sm text-sm font-semibold text-white bg-primary-gradient hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-care-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Resetting password…
                </span>
              ) : (
                'Reset Password & Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
