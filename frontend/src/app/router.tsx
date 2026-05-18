import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { Loader2 } from 'lucide-react';
import { useSubscriptionStatus } from '@/features/setup/hooks/useSubscription';
import { isSubscriptionActive } from '@/features/setup/services/subscription.api';

const SUBSCRIPTION_REDIRECT_PATH = '/setup?card=account&option=subscription';

const RouteGuardLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-sky-50 to-blue-50">
    <div className="inline-flex items-center gap-2 text-sky-700">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm font-medium">Checking subscription...</span>
    </div>
  </div>
);

// ── ProtectedRoute ─────────────────────────────────────────────────────────────
export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();
  const shouldCheckSubscription = isAuthenticated;
  const { data: subscription, isLoading: isCheckingSubscription } = useSubscriptionStatus(shouldCheckSubscription);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Must change password before accessing anything else
  if (user?.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  if (shouldCheckSubscription && isCheckingSubscription) {
    return <RouteGuardLoading />;
  }

  if (subscription && !isSubscriptionActive(subscription) && location.pathname !== '/setup') {
    return <Navigate to={SUBSCRIPTION_REDIRECT_PATH} replace />;
  }

  // Admin must complete clinic setup before accessing any protected page
  if (
    user?.role === 'ADMIN' &&
    user.clinic_setup_complete === false &&
    location.pathname !== '/clinic-setup'
  ) {
    return <Navigate to="/clinic-setup" replace />;
  }

  return <>{children}</>;
};

// ── PublicRoute ────────────────────────────────────────────────────────────────
export const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated) {
    // Must change password first — redirect to the mandatory change page
    if (user?.must_change_password) {
      return <Navigate to="/change-password" replace />;
    }
    // Redirect admin to setup if not complete
    if (user?.role === 'ADMIN' && user.clinic_setup_complete === false) {
      return <Navigate to="/clinic-setup" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// ── RoleBasedRoute ─────────────────────────────────────────────────────────────
export const RoleBasedRoute: React.FC<{
  children:      React.ReactNode;
  allowedRoles:  string[];
}> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

// ── ClinicMemberRoute ──────────────────────────────────────────────────────────
export const ClinicMemberRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();
  const shouldCheckSubscription = isAuthenticated && location.pathname !== '/setup';
  const { data: subscription, isLoading: isCheckingSubscription } = useSubscriptionStatus(shouldCheckSubscription);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Must change password before accessing any member routes
  if (user?.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  if (shouldCheckSubscription && isCheckingSubscription) {
    return <RouteGuardLoading />;
  }

  if (subscription && !isSubscriptionActive(subscription) && location.pathname !== '/setup') {
    return <Navigate to={SUBSCRIPTION_REDIRECT_PATH} replace />;
  }

  if (!user?.clinic) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Same setup guard
  if (
    (user.roles ?? [user.role]).includes('ADMIN') &&
    user.clinic_setup_complete === false &&
    location.pathname !== '/clinic-setup'
  ) {
    return <Navigate to="/clinic-setup" replace />;
  }

  return <>{children}</>;
};

// ── ClinicSetupRoute ───────────────────────────────────────────────────────────
// Only admins who haven't completed setup can access /clinic-setup
// Anyone else gets redirected
export const ClinicSetupRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Password change is mandatory before clinic setup
  if (user?.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  // Non-admins or already-setup admins → go to dashboard
  if (user?.role !== 'ADMIN' || user.clinic_setup_complete === true) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// ── ChangePasswordRoute ────────────────────────────────────────────────────────
// Gate for /change-password — only accessible when must_change_password === true.
// Unauthenticated users → /login.
// Authenticated users who have already set their password → /dashboard (or /clinic-setup).
export const ChangePasswordRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.must_change_password) {
    // Already done — redirect to the appropriate next step
    if (user?.role === 'ADMIN' && user.clinic_setup_complete === false) {
      return <Navigate to="/clinic-setup" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// ── ResetPasswordRoute ─────────────────────────────────────────────────────────
// Gate for /reset-password — blocks direct URL access unless navigated from
// /forgot-password/otp (route state must contain email + resetToken).
// Authenticated users are sent to their dashboard instead.
export const ResetPasswordRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const state = location.state as { email?: string; resetToken?: string } | null;

  // Authenticated users don't need the forgot-password flow
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Require route state — prevents direct URL access
  if (!state?.email || !state?.resetToken) {
    return <Navigate to="/forgot-password" replace />;
  }

  return <>{children}</>;
};