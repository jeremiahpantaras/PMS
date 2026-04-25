import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { 
  validateEmail, 
  validateName,
  validateCompanyName,
  sanitizeInput,
} from '@/utils/validation';
import { formatPHPhone, isValidPHPhone } from '@/utils/phoneFormatter';
import { Mail, User, Building2, Phone, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import MalasakitWhiteLogo from '@/assets/malasakit/Primary Logo - White.svg';
import MalasakitColoredLogo from '@/assets/malasakit/Primary Logo - Colored.svg';
import type { AdminRegisterData, AuthError } from '@/types/auth';
import toast from 'react-hot-toast';

export const AdminRegister: React.FC = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<AdminRegisterData>({
    first_name: '',
    last_name: '',
    company_name: '',
    email: '',
    phone: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const sanitized = name === 'phone' ? formatPHPhone(value) : sanitizeInput(value);
    
    setFormData(prev => ({
      ...prev,
      [name]: sanitized
    }));

    setValidationErrors(prev => ({
      ...prev,
      [name]: ''
    }));
    
    setServerError('');
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.first_name.trim()) {
      errors.first_name = 'First name is required';
    } else if (!validateName(formData.first_name)) {
      errors.first_name = 'Invalid first name format';
    }

    if (!formData.last_name.trim()) {
      errors.last_name = 'Last name is required';
    } else if (!validateName(formData.last_name)) {
      errors.last_name = 'Invalid last name format';
    }

    if (!formData.company_name.trim()) {
      errors.company_name = 'Company/Clinic name is required';
    } else if (!validateCompanyName(formData.company_name)) {
      errors.company_name = 'Company name must be 2-255 characters';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Invalid email format';
    }

    if (formData.phone && !isValidPHPhone(formData.phone)) {
      errors.phone = 'Enter a valid Philippine mobile number (e.g. 09XX XXX XXXX)';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    if (!validateForm() || isLoading) {
        return;
    }

    setIsLoading(true);

    try {
        const response = await authService.registerAdmin(formData);
        
        if (response.email_sent) {
        toast.success('Account created! Check your email for login credentials.', {
            duration: 5000,
        });
        } else {
        toast.success('Account created! Email delivery pending.', {
            duration: 5000,
        });
        }

        navigate('/register/success', { 
        state: { 
            email: formData.email,
            emailSent: response.email_sent,
            companyName: response.clinic.name
        } 
        });
        
    } catch (error: unknown) {
        console.error('Registration error:', error);
        
        const authError = error as AuthError;
        
        if (authError.email) {
        setValidationErrors(prev => ({ ...prev, email: authError.email![0] }));
        }
        if (authError.phone) {
        setValidationErrors(prev => ({ ...prev, phone: authError.phone![0] }));
        }
        if (authError.first_name) {
        setValidationErrors(prev => ({ ...prev, first_name: authError.first_name![0] }));
        }
        if (authError.last_name) {
        setValidationErrors(prev => ({ ...prev, last_name: authError.last_name![0] }));
        }
        if (authError.company_name) {
        setValidationErrors(prev => ({ ...prev, company_name: authError.company_name![0] }));
        }
        
        const errorMessage = 
        authError.detail || 
        authError.non_field_errors?.[0] || 
        'Registration failed. Please try again.';
        
        setServerError(errorMessage);
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
            Start Your Free Trial
          </h1>
          <p className="text-healing-mint text-lg max-w-md">
            Create your clinic account and start managing patients efficiently.
          </p>
          
          {/* Benefits */}
          <div className="space-y-4 pt-4">
            {[
              { title: '14-day free trial', desc: 'No credit card required' },
              { title: 'Full access', desc: 'All features included' },
              { title: 'Cancel anytime', desc: 'No long-term contracts' }
            ].map((item, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className="w-6 h-6 rounded-full bg-healing-mint flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">{item.title}</p>
                  <p className="text-white/70 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-white/60 text-sm">
          © 2026 Malasakit EMR Solutions
        </div>
      </div>

      {/* Right Side - Registration Form */}
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
            <h2 className="text-3xl font-bold text-trust-harbor">Create your account</h2>
            <p className="mt-2 text-steady-slate">Set up your clinic and start managing patients</p>
          </div>

          {/* Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Server Error Display */}
            {serverError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{serverError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-trust-harbor mb-1.5">
                  First Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-2.5 border rounded-2xl bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-care-blue focus:border-transparent text-sm ${
                      validationErrors.first_name ? 'border-red-300' : 'border-gray-200'
                    }`}
                    placeholder="Juan"
                    disabled={isLoading}
                  />
                </div>
                {validationErrors.first_name && (
                  <p className="mt-1.5 text-sm text-red-600">{validationErrors.first_name}</p>
                )}
              </div>

              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-trust-harbor mb-1.5">
                  Last Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-2.5 border rounded-2xl bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-care-blue focus:border-transparent text-sm ${
                      validationErrors.last_name ? 'border-red-300' : 'border-gray-200'
                    }`}
                    placeholder="Dela Cruz"
                    disabled={isLoading}
                  />
                </div>
                {validationErrors.last_name && (
                  <p className="mt-1.5 text-sm text-red-600">{validationErrors.last_name}</p>
                )}
              </div>
            </div>

            {/* Company Name */}
            <div>
              <label htmlFor="company_name" className="block text-sm font-medium text-trust-harbor mb-1.5">
                Clinic/Company Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="company_name"
                  name="company_name"
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={handleChange}
                  className={`block w-full pl-10 pr-3 py-2.5 border rounded-2xl bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-care-blue focus:border-transparent text-sm ${
                    validationErrors.company_name ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="My Medical Clinic"
                  disabled={isLoading}
                />
              </div>
              {validationErrors.company_name && (
                <p className="mt-1.5 text-sm text-red-600">{validationErrors.company_name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-trust-harbor mb-1.5">
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
                  value={formData.email}
                  onChange={handleChange}
                  className={`block w-full pl-10 pr-3 py-2.5 border rounded-2xl bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-care-blue focus:border-transparent text-sm ${
                    validationErrors.email ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="you@example.com"
                  disabled={isLoading}
                />
              </div>
              {validationErrors.email && (
                <p className="mt-1.5 text-sm text-red-600">{validationErrors.email}</p>
              )}
              <p className="mt-1.5 text-xs text-gray-500">
                Your login credentials will be sent to this email
              </p>
            </div>

            {/* Phone (Optional) */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-trust-harbor mb-1.5">
                Phone Number <span className="text-gray-500 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`block w-full pl-10 pr-3 py-2.5 border rounded-2xl bg-white shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-care-blue focus:border-transparent text-sm ${
                    validationErrors.phone ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="(+63) 9XX XXX XXXX"
                  disabled={isLoading}
                />
              </div>
              {validationErrors.phone && (
                <p className="mt-1.5 text-sm text-red-600">{validationErrors.phone}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-2xl shadow-sm text-sm font-semibold text-white bg-primary-gradient hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-care-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Account...
                </span>
              ) : (
                <span className="flex items-center">
                  Create Account
                  <CheckCircle className="ml-2 w-4 h-4" />
                </span>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-steady-slate">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-care-blue hover:text-trust-harbor">
                Sign in
              </Link>
            </p>
          </div>

          {/* Terms Notice */}
          <p className="mt-6 text-xs text-center text-gray-500">
            By creating an account, you agree to our{' '}
            <a href="#" className="text-care-blue hover:text-trust-harbor font-medium">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-care-blue hover:text-trust-harbor font-medium">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
