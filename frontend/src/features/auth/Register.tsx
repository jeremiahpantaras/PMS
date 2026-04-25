import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { 
  validateEmail, 
  validatePassword, 
  sanitizeInput 
} from '@/utils/validation';
import { formatPHPhone, isValidPHPhone } from '@/utils/phoneFormatter';
import { Eye, EyeOff, Lock, Mail, User, Phone } from 'lucide-react';

/**
 * Register Component
 * Security features:
 * - Strong password validation
 * - Input sanitization
 * - Password confirmation
 * - Client-side validation (not relied upon for security)
 * - Disabled submit during loading
 */
export const Register: React.FC = () => {
  const { register, isLoading, error } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    password: '',
    password_confirm: '',
    role: 'STAFF' as 'STAFF' | 'PRACTITIONER'
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  /**
   * Handle input change with sanitization
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Sanitize input
    const sanitized = name === 'password' || name === 'password_confirm'
      ? value // Don't sanitize passwords
      : name === 'phone'
        ? formatPHPhone(value)
        : sanitizeInput(value);
    
    setFormData(prev => ({
      ...prev,
      [name]: sanitized
    }));

    // Clear validation error
    setValidationErrors(prev => ({
      ...prev,
      [name]: ''
    }));
  };

  /**
   * Validate entire form
   * Security: This is UX only - server validates everything
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Email validation
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Invalid email format';
    }

    // Name validation
    if (!formData.first_name) {
      errors.first_name = 'First name is required';
    }
    if (!formData.last_name) {
      errors.last_name = 'Last name is required';
    }

    // Phone validation (optional)
    if (formData.phone && !isValidPHPhone(formData.phone)) {
      errors.phone = 'Enter a valid Philippine mobile number';
    }

    // Password validation
    const passwordCheck = validatePassword(formData.password);
    if (!passwordCheck.valid) {
      errors.password = passwordCheck.message;
    }

    // Password confirmation
    if (formData.password !== formData.password_confirm) {
      errors.password_confirm = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || isLoading) {
      return;
    }

    await register(formData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-clinical-cloud py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div>
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary-gradient rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-trust-harbor">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-steady-slate">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-care-blue hover:text-trust-harbor"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* Server Error Display */}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    {error}
                  </h3>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-trust-harbor">
                  First name
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={handleChange}
                  className={`mt-1 appearance-none block w-full px-3 py-2 border ${
                    validationErrors.first_name ? 'border-red-300' : 'border-gray-200'
                  } rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-care-blue focus:border-care-blue sm:text-sm`}
                  disabled={isLoading}
                />
                {validationErrors.first_name && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.first_name}</p>
                )}
              </div>

              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-trust-harbor">
                  Last name
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={handleChange}
                  className={`mt-1 appearance-none block w-full px-3 py-2 border ${
                    validationErrors.last_name ? 'border-red-300' : 'border-gray-200'
                  } rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-care-blue focus:border-care-blue sm:text-sm`}
                  disabled={isLoading}
                />
                {validationErrors.last_name && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.last_name}</p>
                )}
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-trust-harbor">
                Email address
              </label>
              <div className="mt-1 relative">
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
                  className={`appearance-none block w-full pl-10 pr-3 py-2 border ${
                    validationErrors.email ? 'border-red-300' : 'border-gray-200'
                  } rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-care-blue focus:border-care-blue sm:text-sm`}
                  placeholder="you@example.com"
                  disabled={isLoading}
                />
              </div>
              {validationErrors.email && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
              )}
            </div>

            {/* Phone Field (Optional) */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-trust-harbor">
                Phone number <span className="text-gray-500">(optional)</span>
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`appearance-none block w-full pl-10 pr-3 py-2 border ${
                    validationErrors.phone ? 'border-red-300' : 'border-gray-200'
                  } rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-care-blue focus:border-care-blue sm:text-sm`}
                  placeholder="(+63) 9XX XXX XXXX"
                  disabled={isLoading}
                />
              </div>
              {validationErrors.phone && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.phone}</p>
              )}
            </div>

            {/* Role Selection */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-trust-harbor">
                Role
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-200 focus:outline-none focus:ring-care-blue focus:border-care-blue sm:text-sm rounded-2xl"
                disabled={isLoading}
              >
                <option value="STAFF">Staff</option>
                <option value="PRACTITIONER">Practitioner</option>
              </select>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-trust-harbor">
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className={`appearance-none block w-full pl-10 pr-10 py-2 border ${
                    validationErrors.password ? 'border-red-300' : 'border-gray-200'
                  } rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-care-blue focus:border-care-blue sm:text-sm`}
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
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                  )}
                </button>
              </div>
              {validationErrors.password && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
              )}
              <p className="mt-1 text-xs text-steady-slate">
                Must be at least 8 characters with uppercase, lowercase, and number
              </p>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="password_confirm" className="block text-sm font-medium text-trust-harbor">
                Confirm password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password_confirm"
                  name="password_confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={formData.password_confirm}
                  onChange={handleChange}
                  className={`appearance-none block w-full pl-10 pr-10 py-2 border ${
                    validationErrors.password_confirm ? 'border-red-300' : 'border-gray-200'
                  } rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-care-blue focus:border-care-blue sm:text-sm`}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                  )}
                </button>
              </div>
              {validationErrors.password_confirm && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.password_confirm}</p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-2xl text-white bg-primary-gradient hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-care-blue disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </button>
          </div>

          {/* Terms Notice */}
          <p className="text-xs text-center text-steady-slate">
            By creating an account, you agree to our{' '}
            <a href="#" className="text-care-blue hover:text-trust-harbor">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-care-blue hover:text-trust-harbor">
              Privacy Policy
            </a>
          </p>
        </form>
      </div>
    </div>
  );
};