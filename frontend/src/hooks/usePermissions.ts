/**
 * usePermissions — Central RBAC permission hook.
 *
 * Returns helpers that check the authenticated user's feature-level access.
 * Permission data comes from the `permissions_map` returned by the backend
 * in the User object (populated at login / /auth/me/ calls).
 *
 * Access hierarchy:  edit > view > none
 *
 * ADMIN users implicitly have 'edit' on every feature regardless of their
 * permission group, matching the backend's `has_feature_permission` logic.
 *
 * Usage:
 *   const { canView, canEdit, hasAccess, accessLevel } = usePermissions();
 *   if (canEdit('appointments')) { ... }
 *
 * DO NOT rely on this for security — backend APIs must always enforce RBAC.
 * These helpers drive UI visibility only.
 */

import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth.store';
import type { FeatureKey, AccessLevel, PermissionsMap } from '@/types/auth';

const LEVELS: Record<AccessLevel, number> = { none: 0, view: 1, edit: 2 };

// Full 'edit' map for ADMIN users
const ADMIN_MAP: PermissionsMap = {} as PermissionsMap;
const FEATURE_KEYS: FeatureKey[] = [
  'dashboard', 'appointments', 'calendar', 'diary', 'clinical_notes',
  'client_cases', 'patients', 'reports', 'inventory', 'invoices', 'billing',
  'subscriptions', 'setup', 'staff_management', 'permissions', 'settings',
  'documents', 'outcome_measures', 'contacts', 'communication',
  // Granular Setup card permissions
  'setup_practice', 'setup_items', 'setup_users', 'setup_account', 'setup_communication',
  // Granular Manage card permissions
  'manage_administration', 'manage_clinical', 'manage_communications',
  // Granular Report card permissions
  'reports_administration', 'reports_clinic', 'reports_financial', 'reports_performance',
];
FEATURE_KEYS.forEach((k) => { ADMIN_MAP[k] = 'edit'; });

export interface UsePermissionsReturn {
  /** True if the user has at least 'view' access to the feature. */
  canView:    (feature: FeatureKey) => boolean;
  /** True if the user has 'edit' access to the feature. */
  canEdit:    (feature: FeatureKey) => boolean;
  /** True if the user has at least the requested access level. */
  hasAccess:  (feature: FeatureKey, required?: AccessLevel) => boolean;
  /** Returns the raw access level string for a feature ('none' | 'view' | 'edit'). */
  accessLevel: (feature: FeatureKey) => AccessLevel;
  /** The full permissions map for the current user. */
  permissionsMap: PermissionsMap;
  /** Whether the user is an Owner (ADMIN role). */
  isOwner: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const user = useAuthStore((s) => s.user);

  const permissionsMap = useMemo<PermissionsMap>(() => {
    if (!user) return {} as PermissionsMap;
    // Multi-role: check if ADMIN is in the roles array (or fall back to single role field)
    const userRoles = (user.roles && user.roles.length > 0) ? user.roles : [user.role];
    if (userRoles.includes('ADMIN')) return ADMIN_MAP;
    if (user.permissions_map) return user.permissions_map;
    // Fallback: empty map (no access)
    return FEATURE_KEYS.reduce((acc, k) => { acc[k] = 'none'; return acc; }, {} as PermissionsMap);
  }, [user]);

  const isOwner = user
    ? ((user.roles && user.roles.length > 0) ? user.roles : [user.role]).includes('ADMIN')
    : false;

  const accessLevel = (feature: FeatureKey): AccessLevel =>
    permissionsMap[feature] ?? 'none';

  const hasAccess = (feature: FeatureKey, required: AccessLevel = 'view'): boolean =>
    LEVELS[accessLevel(feature)] >= LEVELS[required];

  const canView = (feature: FeatureKey): boolean => hasAccess(feature, 'view');
  const canEdit = (feature: FeatureKey): boolean => hasAccess(feature, 'edit');

  return { canView, canEdit, hasAccess, accessLevel, permissionsMap, isOwner };
}
