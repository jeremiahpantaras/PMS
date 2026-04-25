import React from 'react';
import { useToastStore } from '../store/toastStore';
import { FloatingNotification } from './FloatingNotification';

export const FloatingNotificationsContainer: React.FC = () => {
  const toasts = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-60 flex flex-col gap-3 pointer-events-auto">
      {toasts.map(toast => (
        <FloatingNotification key={toast.id} toast={toast} />
      ))}
    </div>
  );
};
