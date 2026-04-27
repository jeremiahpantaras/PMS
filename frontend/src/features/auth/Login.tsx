import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/services/authService';
import { Mail, Lock, AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import MalasakitWhiteLogo from '@/assets/malasakit/Primary Logo - White.svg';
import MalasakitColoredLogo from '@/assets/malasakit/Primary Logo - Colored.svg';
import type { LoginCredentials, AuthError } from '@/types/auth';
import toast from 'react-hot-toast';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!credentials.email || !credentials.password) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.login(credentials);
      
      setAuth(response.user, response.tokens);
      
      toast.success(`Welcome back, ${response.user.first_name}!`);

      // Redirect based on clinic setup status
      if (response.user.role === 'ADMIN' && !response.user.clinic_setup_complete) {
        navigate('/clinic-setup', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
      
    } catch (error: any) {
      console.error('Login error:', error);
      
      const authError = error as AuthError;
      const errorMessage = 
        authError.detail || 
        'Login failed. Please check your credentials and try again.';
      
      setError(errorMessage);
      toast.error(errorMessage);
      
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-gradient p-12 flex-col justify-between relative overflow-hidden">
        {/* Floating Particles */}
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

        {/* Hero Content */}
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Patient Management<br />System
          </h1>
          <p className="text-blue-100 text-lg max-w-md">
            Streamline your clinic operations with our comprehensive patient management solution.
          </p>
          
          {/* Features */}
          <div className="space-y-3 pt-4">
            {[
              'Appointment Scheduling',
              'Patient Records',
              'Billing & Invoicing',
              'PhilHealth Integration'
            ].map((feature, index) => (
              <div key={index} className="flex items-center space-x-3 text-blue-100">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-blue-200 text-sm">
          © 2026 Malasakit EMR Solutions
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-clinical-cloud">
        <div className="w-full max-w-md">
          {/* Go Back Button */}
          <div className="mb-6">
            <Link
              to="/"
              className="inline-flex items-center text-sm text-steady-slate hover:text-care-blue transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Go back
            </Link>
          </div>

          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <img src={MalasakitColoredLogo} alt="Malasakit Logo" className="h-10 w-auto" />
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-trust-harbor">Welcome back</h2>
            <p className="mt-2 text-steady-slate">Sign in to your account to continue</p>
          </div>

          {/* Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Error Display */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Email Field */}
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
                  value={credentials.email}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-2xl bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-care-blue focus:border-transparent text-sm"
                  placeholder="you@example.com"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="text-sm">
                  <Link to="/forgot-password" className="font-medium text-care-blue hover:text-trust-harbor">
                    Forgot password?
                  </Link>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={credentials.password}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-2xl bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-care-blue focus:border-transparent text-sm"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-care-blue focus:ring-care-blue border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-600">
                Remember me
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-2xl shadow-sm text-sm font-semibold text-white bg-primary-gradient hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-care-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-steady-slate">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-care-blue hover:text-trust-harbor">
                Create one now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
