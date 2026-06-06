/**
 * SetOnboardingPasswordPage — Admin registration Step 4.
 *
 * The admin arrives here after their clinic account has been created by
 * register-admin.  They set their own password (no temporary password is
 * ever emailed).  On success the account is fully activated and the admin
 * is auto-logged in and redirected straight to /clinic-setup.
 *
 * Guard: OnboardingPasswordRoute ensures sessionStorage contains a valid
 * reg_onboarding_token; if not present the user is sent back to /register.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, XCircle, Sparkles, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/services/authService';
import MalasakitWhiteLogo   from '@/assets/malasakit/Primary Logo - White.svg';
import MalasakitColoredLogo from '@/assets/malasakit/PrimaryLogo-Colored.svg';

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

export const SetOnboardingPasswordPage: React.FC = () => {
  const navigate     = useNavigate();
  const { setAuth }  = useAuthStore();

  // Read onboarding session from sessionStorage (set by AdminRegister after register-admin)
  const [onboardingToken] = useState(() => sessionStorage.getItem('reg_onboarding_token') ?? '');
  const [userEmail]       = useState(() => sessionStorage.getItem('reg_user_email') ?? '');
  const [clinicName]      = useState(() => sessionStorage.getItem('reg_clinic_name') ?? '');

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading,    setIsLoading]    = useState(false);
  const [serverError,  setServerError]  = useState('');

  // Guard: if session keys are missing, redirect back to /register
  useEffect(() => {
    if (!onboardingToken || !userEmail) {
      navigate('/register', { replace: true });
    }
  }, [onboardingToken, userEmail, navigate]);

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
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
        const result = await authService.setupOnboardingPassword(
          onboardingToken,
          userEmail,
          newPassword,
        );

        // Clear the onboarding session data (single-use)
        sessionStorage.removeItem('reg_onboarding_token');
        sessionStorage.removeItem('reg_user_email');
        sessionStorage.removeItem('reg_clinic_name');

        // Persist JWT + user in store & localStorage
        setAuth(result.user, result.tokens);

        toast.success('Password set! Welcome to Malasakit!', { duration: 4000 });

        // Admins always go to clinic setup after onboarding
        navigate('/clinic-setup', { replace: true });
      } catch (err: unknown) {
        const detail =
          (err as { detail?: string })?.detail ??
          'Password setup failed. Please try again.';
        setServerError(detail);
        toast.error(detail);
      } finally {
        setIsLoading(false);
      }
    },
    [canSubmit, onboardingToken, userEmail, newPassword, setAuth, navigate],
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
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {clinicName ? `Welcome, ${clinicName}!` : 'Almost There!'}
              </h2>
              <p className="text-blue-100 text-sm mt-0.5">One last step to get started</p>
            </div>
          </div>
          <p className="text-blue-100 text-base leading-relaxed max-w-sm">
            Create a strong password to protect your clinic account and patient records.
            You'll use this to log in every time.
          </p>
          <ul className="space-y-2.5 pt-2">
            {[
              'Your password is known only to you',
              'We never store passwords in plain text',
              'All clinic data is encrypted at rest',
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

        <div className="relative z-10 text-blue-200 text-sm">© 2026 Malasakit</div>
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
            <h1 className="text-2xl font-bold text-trust-harbor">Create Your Password</h1>
            <p className="mt-2 text-steady-slate text-sm">
              {userEmail
                ? <>Setting up account for <span className="font-medium text-gray-700">{userEmail}</span></>
                : 'Almost done — just set a password to activate your account.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* New password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setServerError(''); }}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  autoFocus
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
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
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
                  Activating account…
                </span>
              ) : (
                'Set Password & Continue'
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
