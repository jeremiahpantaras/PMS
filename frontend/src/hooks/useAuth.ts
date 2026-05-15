import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { authAPI } from '@/features/auth/auth.api';
import type { LoginCredentials, RegisterData } from '@/types';
import toast from 'react-hot-toast';


/**
 * Custom hook for authentication operations
 * Manages login, register, logout with proper error handling
 * Security: Clears all auth data on logout, handles token refresh
 */
export const useAuth = () => {
  const navigate = useNavigate();
  const { setAuth, logout: clearAuth, user, isAuthenticated, tokens } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Login user
   * Security: 
   * - Stores tokens in memory via Zustand
   * - Never exposes tokens to window object
   * - Validates response before storing
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authAPI.login(credentials);
      
      // Validate response structure
      if (!response.user || !response.tokens) {
        throw new Error('Invalid server response');
      }

      // Store auth state
      setAuth(response.user, response.tokens);
      
      toast.success(`Welcome back, ${response.user.first_name}!`);
      
      // Redirect based on highest-priority role
      const userRoles = response.user.roles ?? [response.user.role];
      if (userRoles.includes('ADMIN')) {
        navigate('/dashboard');
      } else if (userRoles.includes('PRACTITIONER')) {
        navigate('/appointments');
      } else {
        navigate('/patients');
      }
    } catch (err: any) {
      const message = err.message || 'Login failed';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [setAuth, navigate]);

  /**
   * Register new user
   * Security: Validates password match client-side but server validates too
   */
  const register = useCallback(async (data: RegisterData) => {
    setIsLoading(true);
    setError(null);

    // Client-side validation
    if (data.password !== data.password_confirm) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const response = await authAPI.register(data);
      
      // Validate response
      if (!response.user || !response.tokens) {
        throw new Error('Invalid server response');
      }

      // Store auth state
      setAuth(response.user, response.tokens);
      
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (err: any) {
      const message = err.message || 'Registration failed';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [setAuth, navigate]);

  /**
   * Logout user
   * Security:
   * - Blacklists refresh token server-side
   * - Clears all local auth state
   * - Redirects to login
   */
  const logout = useCallback(async () => {
    try {
      if (tokens?.refresh) {
        await authAPI.logout(tokens.refresh);
      }
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API error:', error);
    } finally {
      // Always clear local state
      clearAuth();
      navigate('/login');
      toast.success('Logged out successfully');
    }
  }, [tokens, clearAuth, navigate]);

  /**
   * Check if user has a specific role (multi-role aware).
   * Returns true if the user holds ANY of the provided roles.
   */
  const hasRole = useCallback((role: string | string[]) => {
    if (!user) return false;
    // Prefer the `roles` array; fall back to the single `role` field for compat.
    const userRoles: string[] = (user.roles && user.roles.length > 0)
      ? user.roles
      : [user.role];
    if (Array.isArray(role)) {
      return role.some(r => userRoles.includes(r));
    }
    return userRoles.includes(role);
  }, [user]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    hasRole
  };
};