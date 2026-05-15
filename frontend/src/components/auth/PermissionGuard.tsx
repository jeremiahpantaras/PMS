/**
 * PermissionGuard — RBAC route / component guard.
 *
 * Renders children only when the authenticated user has at least `required`
 * access to `feature`.  Renders `fallback` otherwise (defaults to null).
 *
 * ADMIN users always pass through regardless of feature / required.
 *
 * Usage:
 *   <PermissionGuard feature="staff_management" required="view">
 *     <StaffPage />
 *   </PermissionGuard>
 *
 *   // Show custom 403 message:
 *   <PermissionGuard feature="billing" required="edit" fallback={<AccessDenied />}>
 *     <BillingForm />
 *   </PermissionGuard>
 */

import React from 'react';
import { ShieldOff } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import type { FeatureKey, AccessLevel } from '@/types/auth';

interface PermissionGuardProps {
  feature:   FeatureKey;
  required?: AccessLevel;
  /** What to render when access is denied. Default: null (render nothing). */
  fallback?: React.ReactNode;
  children:  React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  feature,
  required = 'view',
  fallback = null,
  children,
}) => {
  const { hasAccess } = usePermissions();
  return hasAccess(feature, required) ? <>{children}</> : <>{fallback}</>;
};

/**
 * AccessDenied — default full-page 403 placeholder.
 * Used as fallback when a whole page is restricted.
 */
export const AccessDenied: React.FC<{ feature?: string }> = ({ feature }) => (
  <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-4">
    <div className="w-14 h-14 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center">
      <ShieldOff className="w-7 h-7 text-rose-500" />
    </div>
    <div>
      <p className="text-base font-semibold text-gray-800">Access Restricted</p>
      <p className="text-sm text-gray-500 mt-1">
        {feature
          ? `You don't have permission to access ${feature.replace('_', ' ')}.`
          : "You don't have permission to view this page."}
      </p>
      <p className="text-xs text-gray-400 mt-2">
        Contact your administrator to request access.
      </p>
    </div>
  </div>
);
