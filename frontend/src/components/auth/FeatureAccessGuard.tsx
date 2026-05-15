/**
 * FeatureAccessGuard — RBAC page-level access guard with non-blocking UX.
 *
 * Behaviour:
 *   none  → page renders with opacity-40 + pointer-events-none, toast shown once
 *   view  → page renders with pointer-events-none (when required='edit'), toast shown once
 *   edit  → full interaction, no notice
 *
 * Critically:
 *   • The sidebar is NEVER blocked — restriction is on the page content div only.
 *   • Access notifications appear as small top-right floating toasts (not banners).
 *   • ADMIN bypasses all checks.
 */

import React, { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Lock, Eye } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import type { FeatureKey, AccessLevel } from '@/types/auth';

// ── Custom toast renderers ─────────────────────────────────────────────────────

const NoAccessToast: React.FC<{ label: string; visible: boolean }> = ({ label, visible }) => (
  <div
    className={`
      flex items-start gap-3 bg-white rounded-2xl shadow-xl border border-rose-200
      px-4 py-3 max-w-xs w-full
      transition-all duration-300
      ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}
    `}
  >
    <div className="w-8 h-8 bg-rose-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
      <Lock className="w-4 h-4 text-rose-500" />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-gray-800">Limited Access</p>
      <p className="text-xs text-gray-500 mt-0.5 leading-snug">
        You don't have permission to access <span className="font-medium">"{label}"</span>.
        Contact your administrator to request access.
      </p>
    </div>
  </div>
);

const ViewOnlyToast: React.FC<{ label: string; visible: boolean }> = ({ label, visible }) => (
  <div
    className={`
      flex items-start gap-3 bg-white rounded-2xl shadow-xl border border-amber-200
      px-4 py-3 max-w-xs w-full
      transition-all duration-300
      ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}
    `}
  >
    <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
      <Eye className="w-4 h-4 text-amber-500" />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-gray-800">View Only</p>
      <p className="text-xs text-gray-500 mt-0.5 leading-snug">
        You have view-only access to <span className="font-medium">"{label}"</span>.
        Editing is disabled.
      </p>
    </div>
  </div>
);

// ── LimitedAccessNotice (kept for use outside the guard) ──────────────────────

interface LimitedAccessNoticeProps {
  type?: 'none' | 'view';
  featureLabel?: string;
}

export const LimitedAccessNotice: React.FC<LimitedAccessNoticeProps> = ({
  type = 'none',
  featureLabel,
}) => {
  const isNone = type === 'none';
  const label  = featureLabel ? ` "${featureLabel}"` : ' this feature';

  return (
    <div
      role="alert"
      className={`
        flex items-start gap-4 rounded-2xl border px-5 py-4 mb-4
        ${isNone ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}
      `}
    >
      <div className={`
        w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5
        ${isNone ? 'bg-rose-100' : 'bg-amber-100'}
      `}>
        {isNone
          ? <Lock className="w-5 h-5 text-rose-500" />
          : <Eye  className="w-5 h-5 text-amber-500" />
        }
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${isNone ? 'text-rose-800' : 'text-amber-800'}`}>
          {isNone ? 'No Access' : 'View Only'}
        </p>
        <p className={`text-xs mt-0.5 leading-relaxed ${isNone ? 'text-rose-600' : 'text-amber-600'}`}>
          {isNone
            ? `You don't have permission to access${label}. Contact your administrator.`
            : `You have view-only access to${label}. Editing is disabled.`
          }
        </p>
      </div>
    </div>
  );
};

// ── FeatureAccessGuard ─────────────────────────────────────────────────────────

interface FeatureAccessGuardProps {
  feature: FeatureKey;
  required?: AccessLevel;
  featureLabel?: string;
  children: React.ReactNode;
}

export const FeatureAccessGuard: React.FC<FeatureAccessGuardProps> = ({
  feature,
  required = 'view',
  featureLabel,
  children,
}) => {
  const { accessLevel, isOwner } = usePermissions();

  const label      = featureLabel ?? feature.replace('_', ' ');
  const level      = isOwner ? 'edit' : accessLevel(feature);
  const hasNone    = !isOwner && level === 'none';
  const hasViewOnly = !isOwner && level === 'view' && required === 'edit';

  // Fire a toast once per page mount when the user has restricted access.
  // Delay slightly so the toast appears after the page transition settles.
  // Using a stable toast `id` prevents the same notice from stacking if the
  // component re-renders without unmounting.
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasNone && !hasViewOnly) return;

    const toastId = `rbac-${feature}-${hasNone ? 'none' : 'view'}`;

    toastTimerRef.current = setTimeout(() => {
      if (hasNone) {
        toast.custom(
          (t) => <NoAccessToast label={label} visible={t.visible} />,
          { id: toastId, duration: 6000 },
        );
      } else {
        toast.custom(
          (t) => <ViewOnlyToast label={label} visible={t.visible} />,
          { id: toastId, duration: 5000 },
        );
      }
    }, 150);

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
    // Re-fire only when the restriction state changes (e.g. after admin updates perms)
  }, [feature, hasNone, hasViewOnly, label]);

  // ADMIN — pass through with no overhead
  if (isOwner) return <>{children}</>;

  // ── No access: visible but blurred + fully disabled ──
  if (hasNone) {
    return (
      <div
        aria-hidden="true"
        className="opacity-40 blur-[2px] pointer-events-none select-none h-full overflow-hidden"
      >
        {children}
      </div>
    );
  }

  // ── View-only: visible but interactions disabled ──
  if (hasViewOnly) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none select-none h-full"
      >
        {children}
      </div>
    );
  }

  // ── Full access ──
  return <>{children}</>;
};
