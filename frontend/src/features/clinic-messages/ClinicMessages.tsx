import { useState } from 'react';
import { MessageButton } from './components/MessageButton';
import { MessagePanel }  from './components/MessagePanel';
import { useUnreadCount } from './hooks/useUnreadCount';
import { useAuthStore }  from '@/store/auth.store';

const ALLOWED_ROLES = ['ADMIN', 'STAFF', 'PRACTITIONER', 'ADMIN_ASSISTANT'] as const;

export const ClinicMessages = () => {
  const [isOpen,        setIsOpen]        = useState(false);
  const user            = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  const { unreadCount, setUnreadCount, decrementBy } = useUnreadCount(isAuthenticated);

  // Gate: only show for clinic staff — never patients
  if (!user || !ALLOWED_ROLES.includes(user.role as any)) return null;

  const handleUnreadChange = (delta: number) => {
    if (delta < 0) decrementBy(Math.abs(delta));
    else setUnreadCount(prev => prev + delta);
  };

  return (
    <>
      {/* Center modal */}
      {isOpen && (
        <MessagePanel
          currentUserId={user.id}
          onClose={() => setIsOpen(false)}
          onUnreadChange={handleUnreadChange}
        />
      )}

      {/* Floating button — always visible */}
      <MessageButton
        unreadCount={unreadCount}
        onClick={() => setIsOpen(prev => !prev)}
      />
    </>
  );
};