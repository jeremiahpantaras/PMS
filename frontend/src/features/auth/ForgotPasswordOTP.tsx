import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { AlertCircle, ArrowLeft, ShieldCheck, RefreshCw } from 'lucide-react';
import MalasakitWhiteLogo from '@/assets/malasakit/Primary Logo - White.svg';
import MalasakitColoredLogo from '@/assets/malasakit/PrimaryLogo-Colored.svg';
import toast from 'react-hot-toast';

/**
 * ForgotPasswordOTP — Step 2 of the OTP-based password recovery flow.
 *
 * Expects route state from /forgot-password:
 *   { email: string, expiresAt: number, resendAvailableAt: number }
 *
 * On successful verification the user is navigated to /reset-password
 * with { email, resetToken } in route state.
 */

interface LocationState {
  email:             string;
  expiresAt:         number;  // epoch ms
  resendAvailableAt: number;  // epoch ms
}

const OTP_LENGTH = 6;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatCountdown(secs: number): string {
  return `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;
}

export const ForgotPasswordOTP: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state    = location.state as LocationState | null;

  // ── Guard: must arrive via /forgot-password ────────────────────────────────
  if (!state?.email) {
    return <Navigate to="/forgot-password" replace />;
  }

  const { email } = state;

  // Mutable ref so we can update timestamps across resends without re-mounts
  const expiresAtRef         = useRef<number>(state.expiresAt);
  const resendAvailableAtRef = useRef<number>(state.resendAvailableAt);

  const [digits, setDigits]       = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputRefs                  = useRef<(HTMLInputElement | null)[]>([]);
  const [, setTick]               = useState(0);   // drives 1-second re-render
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError]         = useState('');

  // 1-second tick to keep timers live
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // ── Derived timer values ───────────────────────────────────────────────────
  const now          = Date.now();
  const expiryLeft   = Math.max(0, Math.floor((expiresAtRef.current - now) / 1000));
  const resendLeft   = Math.max(0, Math.floor((resendAvailableAtRef.current - now) / 1000));
  const canResend    = resendLeft === 0;
  const isExpired    = expiryLeft === 0;
  const isFilled     = digits.every((d) => d !== '');
  const expiryColor  = expiryLeft <= 60 ? 'text-red-500' : 'text-amber-600';

  // ── Digit handlers ─────────────────────────────────────────────────────────
  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      const cleaned = value.replace(/\D/g, '');
      if (!cleaned && value) return;  // ignore non-digit

      const next = [...digits];

      // Handle paste (multiple digits)
      if (cleaned.length > 1) {
        const chars = cleaned.slice(0, OTP_LENGTH - index).split('');
        chars.forEach((ch, i) => {
          if (index + i < OTP_LENGTH) next[index + i] = ch;
        });
        setDigits(next);
        const lastFilled = Math.min(index + chars.length, OTP_LENGTH - 1);
        inputRefs.current[lastFilled]?.focus();
        return;
      }

      next[index] = cleaned;
      setDigits(next);
      setError('');
      if (cleaned && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        if (digits[index]) {
          const next = [...digits];
          next[index] = '';
          setDigits(next);
        } else if (index > 0) {
          inputRefs.current[index - 1]?.focus();
          const next = [...digits];
          next[index - 1] = '';
          setDigits(next);
        }
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits],
  );

  // ── Verify ─────────────────────────────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    if (isVerifying || !isFilled) return;
    if (isExpired) {
      setError('This code has expired. Please request a new one.');
      return;
    }

    const otp = digits.join('');
    setIsVerifying(true);
    setError('');
    try {
      const { reset_token } = await authService.forgotPasswordVerifyOtp(email, otp);

      toast.success('Code verified! Set your new password.');
      navigate('/reset-password', {
        replace: true,
        state: { email, resetToken: reset_token },
      });
    } catch (err: any) {
      const msg = err?.detail || err?.message || 'Invalid or expired code.';
      setError(msg);
      // Clear digits on wrong code so the user can re-enter
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setIsVerifying(false);
    }
  }, [digits, email, isExpired, isFilled, isVerifying, navigate]);

  // ── Resend ─────────────────────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    if (!canResend || isResending) return;
    setIsResending(true);
    setError('');
    try {
      const result = await authService.forgotPasswordSendOtp(email);
      expiresAtRef.current         = Date.now() + (result.expires_in ?? 300) * 1000;
      resendAvailableAtRef.current = Date.now() + (result.cooldown   ?? 60)  * 1000;
      setDigits(Array(OTP_LENGTH).fill(''));
      setTick((n) => n + 1);  // force re-render to reset timers
      toast.success('New code sent — check your inbox');
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err: any) {
      const msg = err?.detail || err?.message || 'Failed to resend code.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsResending(false);
    }
  }, [canResend, email, isResending]);

  // Enter key shortcut
  const handleFormKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && isFilled && !isVerifying) handleVerify();
    },
    [handleVerify, isFilled, isVerifying],
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
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight">
            Check Your<br />Email
          </h1>
          <p className="text-blue-100 text-lg max-w-md">
            We sent a 6-digit verification code to{' '}
            <strong className="text-white">{email}</strong>.
            Enter it below to continue resetting your password.
          </p>
          <p className="text-blue-200 text-sm">
            The code is valid for 5 minutes and can only be used once.
          </p>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-blue-200 text-sm">
          © 2026 Malasakit
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-clinical-cloud">
        <div className="w-full max-w-md" onKeyDown={handleFormKeyDown}>
          {/* Back link */}
          <div className="mb-6">
            <Link
              to="/forgot-password"
              className="inline-flex items-center text-sm text-steady-slate hover:text-care-blue transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Change email
            </Link>
          </div>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <img src={MalasakitColoredLogo} alt="Malasakit Logo" className="h-10 w-auto" />
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-trust-harbor">Enter Verification Code</h2>
            <p className="mt-2 text-steady-slate text-sm">
              We sent a 6-digit code to{' '}
              <span className="font-medium text-gray-800">{email}</span>
            </p>
          </div>

          {/* Expiry timer */}
          <div className={`text-center text-sm font-medium mb-6 ${isExpired ? 'text-red-500' : expiryColor}`}>
            {isExpired
              ? '⚠ Code expired — please request a new one'
              : `Code expires in ${formatCountdown(expiryLeft)}`}
          </div>

          {/* Error banner */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* OTP digit inputs */}
          <div className="flex justify-center gap-3 mb-8">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                disabled={isVerifying || isExpired}
                className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl bg-white shadow-sm focus:outline-none transition-all
                  ${digit
                    ? 'border-purple-400 text-purple-700 bg-purple-50'
                    : 'border-gray-200 text-gray-800'
                  }
                  ${isExpired ? 'opacity-50 cursor-not-allowed' : 'focus:border-purple-500 focus:ring-2 focus:ring-purple-200'}
                  ${error ? 'border-red-300' : ''}
                `}
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          {/* Verify button */}
          <button
            type="button"
            onClick={handleVerify}
            disabled={!isFilled || isVerifying || isExpired}
            className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-2xl shadow-sm text-sm font-semibold text-white bg-primary-gradient hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-care-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all mb-4"
          >
            {isVerifying ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verifying…
              </span>
            ) : (
              'Verify Code'
            )}
          </button>

          {/* Resend */}
          <div className="text-center">
            {canResend ? (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="inline-flex items-center gap-2 text-sm font-medium text-care-blue hover:text-trust-harbor transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
                {isResending ? 'Sending…' : 'Resend code'}
              </button>
            ) : (
              <p className="text-sm text-steady-slate">
                Resend available in{' '}
                <span className="font-medium text-gray-700">{formatCountdown(resendLeft)}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
