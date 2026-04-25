import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, CalendarDays, AlertTriangle, Settings } from 'lucide-react';
import type { Notification, NotificationCategory } from '../types/notifications.types';
import { getCategory } from '../types/notifications.types';

interface Props {
  notification: Notification;
  onMarkRead: (id: number) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);

  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric',
  });
}

// ── Color map ─────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<NotificationCategory, {
  icon:        React.ElementType;
  iconBg:      string;
  iconColor:   string;
  borderColor: string;
  cardBg:      string;
  dot:         string;
}> = {
  booking: {
    icon:        Calendar,
    iconBg:      'bg-emerald-100',
    iconColor:   'text-emerald-600',
    borderColor: 'border-l-emerald-400',
    cardBg:      'bg-emerald-50/40',
    dot:         'bg-emerald-500',
  },
  appointment: {
    icon:        Calendar,
    iconBg:      'bg-sky-100',
    iconColor:   'text-sky-600',
    borderColor: 'border-l-sky-400',
    cardBg:      'bg-sky-50/40',
    dot:         'bg-sky-500',
  },
  reminder: {
    icon:        CalendarDays,
    iconBg:      'bg-amber-100',
    iconColor:   'text-amber-600',
    borderColor: 'border-l-amber-400',
    cardBg:      'bg-amber-50/40',
    dot:         'bg-amber-500',
  },
  alert: {
    icon:        AlertTriangle,
    iconBg:      'bg-red-100',
    iconColor:   'text-red-600',
    borderColor: 'border-l-red-400',
    cardBg:      'bg-red-50/40',
    dot:         'bg-red-500',
  },
  system: {
    icon:        Settings,
    iconBg:      'bg-gray-100',
    iconColor:   'text-gray-500',
    borderColor: 'border-l-gray-300',
    cardBg:      '',
    dot:         'bg-gray-400',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export const NotificationItem: React.FC<Props> = ({ notification, onMarkRead }) => {
  const navigate = useNavigate();
  const category = useMemo(() => getCategory(notification.notification_type), [notification.notification_type]);
  const config   = CATEGORY_CONFIG[category];
  const Icon     = config.icon;

  const handleClick = () => {
    if (!notification.is_read) onMarkRead(notification.id);
    if (notification.link_url) navigate(notification.link_url);
  };

  return (
    <div
      onClick={handleClick}
      className={`
        mx-2 my-1.5 rounded-xl border border-gray-100 border-l-4 p-3
        cursor-pointer transition-all duration-150
        hover:scale-[1.01] hover:shadow-md
        ${config.borderColor}
        ${!notification.is_read ? config.cardBg : 'bg-white'}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${config.iconBg}`}>
          <Icon className={`w-4 h-4 ${config.iconColor}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={`text-sm leading-snug ${!notification.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
              {notification.title}
            </h4>
            {!notification.is_read && (
              <span className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${config.dot}`} />
            )}
          </div>

          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
            {notification.message}
          </p>

          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] text-gray-400">
              {formatRelativeTime(notification.created_at)}
            </span>
            {notification.clinic_branch_name && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-[11px] text-gray-400 truncate">
                  {notification.clinic_branch_name}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};