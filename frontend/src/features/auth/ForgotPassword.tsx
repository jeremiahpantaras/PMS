import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '@/services/authService';
import { validateEmail } from '@/utils/validation';
import { Mail, KeyRound, CheckCircle, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

type Step = 'email' | 'code' | 'success';

export const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Validation errors
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');

    if (!email.trim()) {
      setEmailError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      await authService.forgotPassword(email);
      toast.success('Verification code sent to your email');
      setStep('code');
    } catch (err: any) {
      const errorMessage = err.detail || 'Failed to send verification code';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCodeError('');

    if (!code.trim()) {
      setCodeError('Verification code is required');
      return;
    }

    if (code.length !== 6) {
      setCodeError('Verification code must be 6 digits');
      return;
    }

    setIsLoading(true);

    try {
      // Verify the code first
      await authService.verifyCode(email, code);
      
      // If verification succeeds, reset the password (backend will generate new password)
      await authService.resetPassword(email, code, '');
      
      // Show success
      toast.success('New password sent to your email');
      setStep('success');
    } catch (err: unknown) {
      const errorMessage = (err as any)?.message || 'Invalid or expired verification code';
      setCodeError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setIsLoading(true);

    try {
      await authService.forgotPassword(email);
      toast.success('New verification code sent to your email');
    } catch (err: any) {
      const errorMessage = err.detail || 'Failed to resend verification code';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-500 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        
        {/* Logo & Brand */}
        <div className="relative z-10">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Malasakit</span>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Reset Your<br />Password
          </h1>
          <p className="text-blue-100 text-lg max-w-md">
            Follow the steps to recover your account and regain access to your patient management system.
          </p>
          
          {/* Steps */}
          <div className="space-y-4 pt-4">
            {[
              { num: 1, text: 'Enter your email address' },
              { num: 2, text: 'Verify with the code sent' },
              { num: 3, text: 'Get new password via email' }
            ].map((item, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  step === 'success' ? 'bg-green-500 text-white' :
                  (step === 'code' && item.num === 1) ? 'bg-green-500 text-white' :
                  (step === 'code' && item.num === 2) ? 'bg-white text-sky-600' :
                  (step === 'email' && item.num === 1) ? 'bg-white text-sky-600' :
                  'bg-white/20 text-white'
                }`}>
                  {item.num}
                </div>
                <span className="text-white">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-blue-200 text-sm">
          © 2026 Malasakit EMR Solutions
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Go Back Button */}
          <div className="mb-6">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-gray-600 hover:text-sky-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to login
            </Link>
          </div>

          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-sky-600 to-blue-600 rounded-xl flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Malasakit</span>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            {step === 'email' && (
              <>
                <h2 className="text-3xl font-bold text-gray-900">Reset Password</h2>
                <p className="mt-2 text-gray-600">Enter your email to receive a verification code</p>
              </>
            )}
            {step === 'code' && (
              <>
                <h2 className="text-3xl font-bold text-gray-900">Enter Code</h2>
                <p className="mt-2 text-gray-600">We sent a 6-digit code to {email}</p>
              </>
            )}
            {step === 'success' && (
              <>
                <h2 className="text-3xl font-bold text-gray-900">Password Reset</h2>
                <p className="mt-2 text-gray-600">Your new password has been sent to your email</p>
              </>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-6">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Email Form */}
          {step === 'email' && (
            <form className="space-y-6" onSubmit={handleEmailSubmit}>
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
                    }}
                    className={`block w-full pl-10 pr-3 py-2.5 border rounded-lg bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm ${
                      emailError ? 'border-red-300' : 'border-gray-300'
                    }`}
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
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center">
                    Send Code
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </span>
                )}
              </button>
            </form>
          )}

          {/* Step 2: Code Form */}
          {step === 'code' && (
            <form className="space-y-6" onSubmit={handleCodeSubmit}>
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Verification Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="code"
                    name="code"
                    type="text"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, ''));
                      setCodeError('');
                    }}
                    className={`block w-full pl-10 pr-3 py-2.5 border rounded-lg bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm text-center tracking-widest font-mono ${
                      codeError ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="000000"
                    disabled={isLoading}
                  />
                </div>
                {codeError && (
                  <p className="mt-1.5 text-sm text-red-600">{codeError}</p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Didn't receive the code?{' '}
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={isLoading}
                    className="text-sky-600 hover:text-sky-700 font-medium"
                  >
                    Resend
                  </button>
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  <span className="flex items-center">
                    Verify Code
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </span>
                )}
              </button>
            </form>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-gray-600">
                  A new password has been generated and sent to your email address.
                </p>
                <p className="text-sm text-gray-500 mt-4">
                  Please check your email and use the new password to log in.
                </p>
              </div>

              <Link
                to="/login"
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors"
              >
                <span className="flex items-center">
                  Back to Login
                  <ArrowRight className="ml-2 w-4 h-4" />
                </span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
