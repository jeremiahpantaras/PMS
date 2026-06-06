import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { Mail, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import MalasakitWhiteLogo from '@/assets/malasakit/Primary Logo - White.svg';
import MalasakitColoredLogo from '@/assets/malasakit/PrimaryLogo-Colored.svg';
import toast from 'react-hot-toast';

/**
 * ForgotPassword — Step 1 of the OTP-based password recovery flow.
 * The user enters their email; the backend sends a 6-digit OTP.
 * On success the user is navigated to /forgot-password/otp.
 */
export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail]           = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState('');
  const [emailError, setEmailError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');

    const trimmed = email.trim().toLowerCase();

    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.forgotPasswordSendOtp(trimmed);
      toast.success('Verification code sent — check your inbox');
      navigate('/forgot-password/otp', {
        replace: false,
        state: {
          email: trimmed,
          expiresAt:         Date.now() + (result.expires_in ?? 300) * 1000,
          resendAvailableAt: Date.now() + (result.cooldown   ?? 60)  * 1000,
        },
      });
    } catch (err: unknown) {
      const msg = (err as { detail?: string; message?: string })?.detail
        || (err as { message?: string })?.message
        || 'Unable to process request.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-gradient p-12 flex-col justify-between relative overflow-hidden">
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

        <div className="relative z-10">
          <img src={MalasakitWhiteLogo} alt="Malasakit Logo" className="h-10 w-auto" />
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Forgot Your<br />Password?
          </h1>
          <p className="text-blue-100 text-lg max-w-md">
            No worries — enter your email and we will send you a secure
            verification code to recover your account.
          </p>
          <div className="space-y-4 pt-4">
            {[
              { num: '1', label: 'Enter your email address' },
              { num: '2', label: 'Enter the 6-digit OTP' },
              { num: '3', label: 'Set your new password' },
            ].map((s) => (
              <div key={s.num} className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {s.num}
                </div>
                <span className="text-blue-100">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-blue-200 text-sm">
          © 2026 Malasakit
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-clinical-cloud">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-steady-slate hover:text-care-blue transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to login
            </Link>
          </div>

          <div className="lg:hidden flex items-center justify-center mb-8">
            <img src={MalasakitColoredLogo} alt="Malasakit Logo" className="h-10 w-auto" />
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-trust-harbor">Reset Password</h2>
            <p className="mt-2 text-steady-slate">
              Enter your email address to receive a verification code
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError('');
                    setError('');
                  }}
                  className={`block w-full pl-10 pr-3 py-2.5 border rounded-2xl bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-care-blue focus:border-transparent text-sm ${emailError ? 'border-red-300' : 'border-gray-200'}`}
                  placeholder="you@example.com"
                  disabled={isLoading}
                />
              </div>
              {emailError && (
                <p className="mt-1.5 text-sm text-red-600">{emailError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-2xl shadow-sm text-sm font-semibold text-white bg-primary-gradient hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-care-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending code…
                </span>
              ) : (
                <span className="flex items-center">
                  Send Verification Code
                  <ArrowRight className="ml-2 w-4 h-4" />
                </span>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-steady-slate">
              Remember your password?{' '}
              <Link to="/login" className="font-semibold text-care-blue hover:text-trust-harbor">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
