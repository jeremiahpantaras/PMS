import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mail, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '@/services/authService';

// ── Types ──────────────────────────────────────────────────────────────────────

interface OTPVerificationModalProps {
  email: string;
  firstName: string;
  /** Epoch ms when the OTP expires — set by parent, survives modal close/reopen */
  expiresAt: number;
  /** Epoch ms when the resend cooldown lifts — set by parent, survives modal close/reopen */
  resendAvailableAt: number;
  onVerified: (verificationToken: string) => void;
  onClose: () => void;
  /** Sends a new OTP; returns updated expiry/cooldown timestamps from parent state. */
  onResend: () => Promise<{ expiresAt: number; resendAvailableAt: number }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OTP_LENGTH = 6;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const OTPVerificationModal: React.FC<OTPVerificationModalProps> = ({
  email,
  expiresAt,
  resendAvailableAt,
  onVerified,
  onClose,
  onResend,
}) => {
  // OTP digit state
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputRefs            = useRef<(HTMLInputElement | null)[]>([]);

  // Single 1-second tick — timer values are derived from absolute timestamps
  // so they remain correct even after the modal was closed and reopened.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // UI state
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError]             = useState('');

  // ── Derived timer values ────────────────────────────────────────────────────
  const now         = Date.now();
  const expiryLeft  = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const resendLeft  = Math.max(0, Math.floor((resendAvailableAt - now) / 1000));
  const canResend   = resendLeft === 0;
  const isExpired   = expiryLeft === 0;
  const isFilled    = digits.every((d) => d !== '');
  const expiryColor = expiryLeft <= 60 ? 'text-red-500' : 'text-amber-600';

  // ── Focus first input on mount ─────────────────────────────────────────────
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // ── Digit handlers ──────────────────────────────────────────────────────────
  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      // Accept only digits
      const cleaned = value.replace(/\D/g, '');
      if (!cleaned && value) return; // ignore non-digit input

      const next = [...digits];

      if (cleaned.length > 1) {
        // Handle paste: spread digits across fields
        const pasted = cleaned.slice(0, OTP_LENGTH);
        for (let i = 0; i < OTP_LENGTH; i++) {
          next[i] = pasted[i] ?? '';
        }
        setDigits(next);
        const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
        inputRefs.current[focusIdx]?.focus();
        return;
      }

      next[index] = cleaned;
      setDigits(next);
      setError('');

      // Move forward
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
        }
      } else if (e.key === 'ArrowLeft' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits],
  );

  // ── Verify ──────────────────────────────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    const code = digits.join('');
    if (code.length < OTP_LENGTH) {
      setError('Please enter the complete 6-digit code.');
      return;
    }
    if (isExpired) {
      setError('The code has expired. Please request a new one.');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const res = await authService.verifyAdminOtp(email, code);
      toast.success('Email verified!');
      onVerified(res.verification_token);
    } catch (err: unknown) {
      const msg =
        (err as { detail?: string })?.detail ||
        'Invalid or expired code. Please try again.';
      setError(msg);
      // Clear digits on hard failures (max attempts, expired)
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('attempts')) {
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } finally {
      setIsVerifying(false);
    }
  }, [digits, email, isExpired, onVerified]);

  // ── Resend ──────────────────────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    if (!canResend || isResending) return;

    setIsResending(true);
    setError('');

    try {
      // onResend updates expiresAt/resendAvailableAt in the parent; they flow
      // back down as props so the countdown corrects itself automatically.
      await onResend();
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      toast.success('New verification code sent!');
    } catch (err: unknown) {
      const msg =
        (err as { detail?: string })?.detail ||
        'Failed to resend. Please try again.';
      setError(msg);
    } finally {
      setIsResending(false);
    }
  }, [canResend, isResending, onResend]);

  // ── Enter key shortcut ──────────────────────────────────────────────────────
  const handleFormKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isVerifying) handleVerify();
    },
    [handleVerify, isVerifying],
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="otp-modal-title"
    >
      {/* Card */}
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onKeyDown={handleFormKeyDown}
      >
        {/* ── Header gradient bar ─────────────────────────────────── */}
        <div className="bg-primary-gradient px-8 pt-8 pb-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 id="otp-modal-title" className="text-xl font-bold leading-tight">
                Verify Your Email
              </h2>
              <p className="text-white/70 text-sm">Complete your registration</p>
            </div>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="px-8 py-6">
          {/* Email hint */}
          <div className="flex items-start gap-2.5 mb-6">
            <Mail className="w-5 h-5 text-care-blue mt-0.5 shrink-0" />
            <p className="text-sm text-steady-slate leading-relaxed">
              We sent a 6-digit verification code to{' '}
              <span className="font-semibold text-trust-harbor break-all">{email}</span>.
              Enter it below to continue.
            </p>
          </div>

          {/* OTP inputs */}
          <div className="flex gap-2.5 justify-center mb-2" aria-label="OTP input">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={OTP_LENGTH}       // allows paste handling
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                disabled={isVerifying || isExpired}
                className={`w-11 h-14 text-center text-2xl font-bold border-2 rounded-xl
                  bg-gray-50 focus:outline-none focus:ring-2 transition-all
                  ${digit ? 'border-care-blue bg-blue-50 text-trust-harbor' : 'border-gray-200 text-gray-400'}
                  ${error ? 'border-red-400 bg-red-50' : ''}
                  ${isExpired ? 'opacity-50 cursor-not-allowed' : 'focus:ring-care-blue/30 focus:border-care-blue'}
                  disabled:cursor-not-allowed`}
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 text-center mt-2 mb-1" role="alert">
              {error}
            </p>
          )}

          {/* Expiry timer */}
          <div className="flex items-center justify-center gap-1.5 mt-3 mb-5">
            {isExpired ? (
              <span className="text-sm text-red-500 font-medium">
                Code expired — request a new one below
              </span>
            ) : (
              <>
                <span className="text-xs text-gray-400">Code expires in</span>
                <span className={`text-sm font-mono font-semibold ${expiryColor}`}>
                  {formatTime(expiryLeft)}
                </span>
              </>
            )}
          </div>

          {/* Verify button */}
          <button
            type="button"
            onClick={handleVerify}
            disabled={isVerifying || isExpired || !isFilled}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
              font-semibold text-sm text-white bg-primary-gradient
              hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-care-blue focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Verify &amp; Create Account
              </>
            )}
          </button>

          {/* Resend */}
          <div className="mt-4 text-center">
            {canResend ? (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="inline-flex items-center gap-1.5 text-sm text-care-blue
                  hover:text-trust-harbor font-medium transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {isResending ? 'Sending…' : 'Resend Code'}
              </button>
            ) : (
              <p className="text-sm text-gray-400">
                Resend available in{' '}
                <span className="font-mono font-medium text-gray-600">
                  {resendLeft}s
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
