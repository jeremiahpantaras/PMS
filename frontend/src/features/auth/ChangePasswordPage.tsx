/**
 * ChangePasswordPage — Mandatory first-login password setup.
 *
 * Shown immediately after login when must_change_password === true.
 * The user cannot navigate anywhere else until they complete this step.
 *
 * Flow:
 *  1. User enters the temporary password they received via email.
 *  2. User chooses a new strong password (with live validation feedback).
 *  3. On success the store is updated with fresh tokens/user and the user
 *     is redirected to /clinic-setup (admin) or /dashboard (others).
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, XCircle, ShieldCheck, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/services/authService';
import MalasakitWhiteLogo  from '@/assets/malasakit/Primary Logo - White.svg';
import MalasakitColoredLogo from '@/assets/malasakit/Primary Logo - Colored.svg';

// ── Password strength rules ───────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export const ChangePasswordPage: React.FC = () => {
  const navigate        = useNavigate();
  const { setAuth, user } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent]   = useState(false);
  const [showNew,     setShowNew]       = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    isStrongPassword(newPassword) &&
    passwordsMatch &&
    !isLoading;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setServerError('');

      if (!canSubmit) return;

      setIsLoading(true);
      try {
        const result = await authService.changePasswordFirstLogin(currentPassword, newPassword);

        // Persist fresh user + tokens
        setAuth(result.user, result.tokens);

        toast.success('Password updated successfully!');

        // Redirect: admin without clinic setup → /clinic-setup, otherwise /dashboard
        if (
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
          'Password change failed. Please try again.';
        setServerError(detail);
        toast.error(detail);
      } finally {
        setIsLoading(false);
      }
    },
    [canSubmit, currentPassword, newPassword, setAuth, navigate],
  );

  return (
    <div className="min-h-screen flex">
      {/* ── Left branding panel ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-gradient p-12 flex-col justify-between relative overflow-hidden">
        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          {[
            { cls: 'animate-float-slow  top-[10%]  left-[5%]  w-28 h-28',  bg: 'bg-white/10',         delay: '0s'   },
            { cls: 'animate-float-slow  top-[55%]  left-[2%]  w-36 h-36',  bg: 'bg-healing-mint/15',  delay: '3s'   },
            { cls: 'animate-float-slow  top-[20%]  right-[10%] w-24 h-24', bg: 'bg-white/10',         delay: '6s'   },
            { cls: 'animate-float-slow  bottom-[8%] left-[28%] w-32 h-32', bg: 'bg-healing-mint/10',  delay: '1.5s' },
            { cls: 'animate-float-medium top-[35%] left-[16%] w-16 h-16',  bg: 'bg-white/15',         delay: '1s'   },
            { cls: 'animate-float-medium top-[8%]  left-[48%] w-20 h-20',  bg: 'bg-healing-mint/20',  delay: '4s'   },
            { cls: 'animate-float-fast  top-[28%]  left-[33%] w-8  h-8',   bg: 'bg-white/20',         delay: '0.5s' },
            { cls: 'animate-float-fast  top-[50%]  left-[10%] w-10 h-10',  bg: 'bg-healing-mint/25',  delay: '2.5s' },
          ].map(({ cls, bg, delay }, i) => (
            <div
              key={i}
              className={`absolute ${cls} rounded-full ${bg}`}
              style={{ animationDelay: delay }}
            />
          ))}
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <img src={MalasakitWhiteLogo} alt="Malasakit Logo" className="h-10 w-auto" />
        </div>

        {/* Hero content */}
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Secure Your Account</h2>
              <p className="text-blue-100 text-sm mt-0.5">One quick step before you begin</p>
            </div>
          </div>
          <p className="text-blue-100 text-base leading-relaxed max-w-sm">
            Your account was created with a temporary password. Set a strong personal password
            to protect your clinic data and patient records.
          </p>
          <ul className="space-y-2.5 pt-2">
            {[
              'Temporary passwords are single-use only',
              'Your new password is known only to you',
              'All data is encrypted and secure',
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-blue-100 text-sm">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-blue-200 text-sm">© 2026 Malasakit EMR Solutions</div>
      </div>

      {/* ── Right form panel ────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-clinical-cloud">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <img src={MalasakitColoredLogo} alt="Malasakit Logo" className="h-10 w-auto" />
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-sky-50 border border-sky-200 rounded-2xl mb-4">
              <Lock className="w-7 h-7 text-sky-600" />
            </div>
            <h1 className="text-2xl font-bold text-trust-harbor">Set Your Password</h1>
            <p className="mt-2 text-steady-slate text-sm">
              {user?.first_name ? `Welcome, ${user.first_name}! ` : ''}
              Create a strong password to secure your account.
            </p>
          </div>

          {/* Notice banner */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Your temporary password was sent to your email. You must create a new password
              before accessing the platform.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Current (temporary) password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Current Temporary Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); setServerError(''); }}
                  placeholder="Enter your temporary password"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 text-sm
                             focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
                             placeholder:text-gray-400 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 text-sm
                             focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
                             placeholder:text-gray-400 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Live validation */}
              {newPassword.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {RULES.map((rule) => {
                    const ok = rule.test(newPassword);
                    return (
                      <div key={rule.label} className="flex items-center gap-2">
                        {ok
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          : <XCircle      className="w-3.5 h-3.5 text-gray-300     shrink-0" />}
                        <span className={`text-xs ${ok ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {rule.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your new password"
                  autoComplete="new-password"
                  className={`w-full pl-10 pr-10 py-2.5 rounded-lg border text-sm
                              focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
                              placeholder:text-gray-400 bg-white
                              ${confirmPassword.length > 0
                                ? passwordsMatch
                                  ? 'border-emerald-400 ring-1 ring-emerald-200'
                                  : 'border-red-400 ring-1 ring-red-200'
                                : 'border-gray-300'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="mt-1 text-xs text-red-500">Passwords do not match.</p>
              )}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700">{serverError}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-150
                          ${canSubmit
                            ? 'bg-sky-600 hover:bg-sky-700 shadow-sm hover:shadow-md'
                            : 'bg-gray-300 cursor-not-allowed'}`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving…
                </span>
              ) : (
                'Save & Continue'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Need help?{' '}
            <a href="mailto:support@malasakit.com" className="text-sky-600 hover:underline">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
