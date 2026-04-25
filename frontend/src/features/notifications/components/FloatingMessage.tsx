import React, { useEffect, useState } from 'react';
import { MessageSquare, X } from 'lucide-react';

interface Props {
  title:          string;
  message:        string;
  senderAvatar?:  string | null;
  onDismiss:      () => void;
  autoDismissMs?: number;
}

export const FloatingMessage: React.FC<Props> = ({
  title,
  message,
  senderAvatar,
  onDismiss,
  autoDismissMs = 6_000,
}) => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const enter  = setTimeout(() => setVisible(true), 15);
    const dismiss = setTimeout(() => handleDismiss(), autoDismissMs);
    return () => { clearTimeout(enter); clearTimeout(dismiss); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDismissMs]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(), 280);
  };

  return (
    <div
      className={`
        w-72
        bg-linear-to-r from-[#0575E6] to-[#5CDB95]
        text-white p-4 rounded-2xl shadow-2xl
        transition-all duration-300 ease-out
        ${visible && !exiting
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-4 scale-95'}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Avatar or icon */}
        {senderAvatar ? (
          <img
            src={senderAvatar}
            alt="sender"
            className="shrink-0 w-9 h-9 rounded-full object-cover border-2 border-white/30"
          />
        ) : (
          <div className="shrink-0 w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm leading-snug">{title}</h4>
          <p className="text-sm opacity-90 mt-0.5 line-clamp-2 leading-relaxed">{message}</p>
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors"
          aria-label="Dismiss message"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
