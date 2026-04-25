import React, { useEffect, useState } from 'react';
import { X, Calendar, CalendarDays, AlertTriangle, Settings, Bell } from 'lucide-react';
import type { NotificationCategory } from '../types/notifications.types';
import { dismissToast, type ToastItem } from '../store/toastStore';

// ── Config ────────────────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<NotificationCategory, React.ElementType> = {
  booking:     Calendar,
  appointment: Calendar,
  reminder:    CalendarDays,
  alert:       AlertTriangle,
  system:      Bell,
};

const CATEGORY_STYLE: Record<NotificationCategory, string> = {
  booking:     'bg-emerald-100 text-emerald-600',
  appointment: 'bg-sky-100 text-sky-600',
  reminder:    'bg-amber-100 text-amber-600',
  alert:       'bg-red-100 text-red-600',
  system:      'bg-gray-100 text-gray-500',
};

const CATEGORY_SETTINGS_ICON_OVERRIDE: Partial<Record<NotificationCategory, React.ElementType>> = {
  system: Settings,
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  toast: ToastItem;
}

export const FloatingNotification: React.FC<Props> = ({ toast }) => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  const IconComponent =
    CATEGORY_SETTINGS_ICON_OVERRIDE[toast.category] ?? CATEGORY_ICON[toast.category] ?? Bell;
  const iconStyle = CATEGORY_STYLE[toast.category];

  useEffect(() => {
    // Tiny delay to trigger entrance animation after mount
    const t = setTimeout(() => setVisible(true), 15);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => dismissToast(toast.id), 280);
  };

  return (
    <div
      className={`
        w-80 bg-white/85 backdrop-blur-md
        border border-white/60 shadow-2xl
        rounded-2xl overflow-hidden
        transition-all duration-300 ease-out
        ${visible && !exiting
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 -translate-y-3 scale-95'}
      `}
    >
      {/* Gradient accent bar */}
      <div className="h-0.5 w-full bg-linear-to-r from-[#0575E6] to-[#5CDB95]" />

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${iconStyle}`}>
            <IconComponent className="w-4 h-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 leading-snug">
              {toast.title}
            </h4>
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed line-clamp-2">
              {toast.message}
            </p>
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
