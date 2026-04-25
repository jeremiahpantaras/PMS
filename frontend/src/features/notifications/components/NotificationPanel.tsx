import React, { useEffect, useRef, useMemo } from 'react';
import { X, Bell, CheckCheck, Loader2, InboxIcon } from 'lucide-react';
import { NotificationItem } from './NotificationItem';
import type { Notification } from '../types/notifications.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
  onLoadMore: () => void;
}

// ── Group helpers ─────────────────────────────────────────────────────────────

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth()    &&
    d.getDate()     === now.getDate()
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export const NotificationPanel: React.FC<Props> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  isLoading,
  isLoadingMore,
  hasMore,
  onMarkRead,
  onMarkAllRead,
  onLoadMore,
}) => {
  const panelRef  = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Group by Today / Earlier ───────────────────────────────────────────────
  const { today, earlier } = useMemo(() => {
    const t: Notification[] = [];
    const e: Notification[] = [];
    notifications.forEach(n => (isToday(n.created_at) ? t : e).push(n));
    return { today: t, earlier: e };
  }, [notifications]);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  // ── Close on Escape ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ── Infinite scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 80 && hasMore && !isLoadingMore) {
        onLoadMore();
      }
    };
    el.addEventListener('scroll', handler);
    return () => el.removeEventListener('scroll', handler);
  }, [hasMore, isLoadingMore, onLoadMore]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="
        fixed bottom-20 right-32 z-50
        w-95
        bg-white rounded-2xl shadow-2xl border border-gray-200
        flex flex-col overflow-hidden
        animate-in fade-in slide-in-from-bottom-2 duration-200
      "
    >
      {/* ── Gradient accent bar ─────────────────────────────────────────────── */}
      <div className="h-0.5 w-full bg-linear-to-r from-[#0575E6] to-[#5CDB95]" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-sky-600" />
          <span className="font-semibold text-gray-900 text-sm">Notifications</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-700 min-w-5">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="flex items-center gap-1 text-[11px] text-sky-600 hover:text-sky-700 font-medium px-2 py-1 rounded-lg hover:bg-sky-50 transition-colors"
              title="Mark all as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Body — max 5 items visible, scrollable beyond that ─────────────── */}
      <div
        ref={scrollRef}
        className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent py-1"
        style={{ maxHeight: '380px' }}
      >

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-sky-500 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <InboxIcon className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">No notifications yet</p>
            <p className="text-xs text-gray-400 mt-1">
              New bookings and daily summaries will appear here.
            </p>
          </div>
        )}

        {/* ── Today group ────────────────────────────────────────────────── */}
        {!isLoading && today.length > 0 && (
          <>
            <div className="px-4 pt-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Today</span>
            </div>
            {today.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={onMarkRead}
              />
            ))}
          </>
        )}

        {/* ── Earlier group ───────────────────────────────────────────────── */}
        {!isLoading && earlier.length > 0 && (
          <>
            <div className="px-4 pt-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Earlier</span>
            </div>
            {earlier.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={onMarkRead}
              />
            ))}
          </>
        )}

        {/* Load more spinner */}
        {isLoadingMore && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
        <p className="text-[11px] text-center text-gray-400">
          Showing appointment bookings &amp; daily summaries
        </p>
      </div>
    </div>
  );
};