import React, { useState, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from './hooks/useNotifications';
import { NotificationPanel } from './components/NotificationPanel';
import { pushToast } from './store/toastStore';
import { getCategory } from './types/notifications.types';
import type { Notification } from './types/notifications.types';

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const handleIncoming = useCallback((n: Notification) => {
    pushToast({
      title:      n.title,
      message:    n.message,
      category:   getCategory(n.notification_type),
      created_at: n.created_at,
    });
  }, []);

  const {
    notifications,
    unreadCount,
    isLoading,
    isLoadingMore,
    hasMore,
    markRead,
    markAllRead,
    loadMore,
  } = useNotifications(isOpen, handleIncoming);

  return (
    <>
      {/* ── Bell Button ──────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="
          fixed bottom-6 right-44 z-40
          flex items-center justify-center
          px-5 py-3
          bg -gradient bg-primary-gradient  text-white font-medium
          rounded-2xl shadow-xl border border-cyan-600 border-2
          hover:shadow-2xl hover:bg-primary-gradient/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500
          transition-all duration-200 cursor-pointer
        "
        aria-label="Notifications"
        title="Notifications"
      >
        <div className="relative">
          <Bell className="w-5 h-5 text-white" />
          {unreadCount > 0 && (
            <span className="
              absolute -top-2 -right-2
              min-w-4.5 h-4.5 px-1
              bg-red-500 text-white text-[10px] font-bold
              rounded-full flex items-center justify-center leading-none
            ">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </button>

      {/* ── Panel ────────────────────────────────────────────────────────── */}
      <NotificationPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        onLoadMore={loadMore}
      />
    </>
  );
};