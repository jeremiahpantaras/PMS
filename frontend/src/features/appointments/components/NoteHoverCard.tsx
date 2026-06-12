import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, StickyNote, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { CalendarNote } from '@/types';

interface NoteHoverCardProps {
  note: CalendarNote;
  anchorRect: DOMRect;
  onEnter: () => void;
  onLeave: () => void;
}

const fmt12 = (time: string): string => {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

export const NoteHoverCard: React.FC<NoteHoverCardProps> = ({
  note,
  anchorRect,
  onEnter,
  onLeave,
}) => {
  const cardRef   = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
  const CARD_WIDTH = 240;
  const GAP        = 8;

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const cardH = card.offsetHeight;
    const vw    = window.innerWidth;
    const vh    = window.innerHeight;

    let left = anchorRect.right + GAP;
    if (left + CARD_WIDTH > vw - 8) {
      left = anchorRect.left - CARD_WIDTH - GAP;
    }

    let top = anchorRect.top;
    if (top + cardH > vh - 8) top = vh - cardH - 8;
    if (top < 8) top = 8;

    requestAnimationFrame(() => {
      setStyle({ position: 'fixed', top, left, width: CARD_WIDTH, visibility: 'visible', zIndex: 9990 });
    });
  }, [anchorRect]);

  const formattedDate = (() => {
    try { return format(parseISO(note.date), 'EEEE, MMMM d, yyyy'); }
    catch { return note.date; }
  })();

  return createPortal(
    <div
      ref={cardRef}
      style={style}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="bg-white rounded-xl shadow-2xl border border-orange-200 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-orange-50 border-b border-orange-200">
        <StickyNote className="w-3.5 h-3.5 text-orange-500 shrink-0" />
        <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Note</span>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {/* Message */}
        <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap break-words line-clamp-6">
          {note.message}
        </p>

        <div className="border-t border-gray-100 pt-2 space-y-1.5">
          {/* Date & time */}
          <div className="flex items-start gap-2">
            <Clock className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-gray-700 font-medium">{formattedDate}</p>
              <p className="text-[10px] text-gray-500">
                {fmt12(note.start_time)} – {fmt12(note.end_time)}
              </p>
            </div>
          </div>

          {/* Created by */}
          {note.created_by_name && (
            <div className="flex items-start gap-2">
              <User className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-none">Created by</p>
                <p className="text-[10px] text-gray-700 font-medium">{note.created_by_name}</p>
                {note.created_at && (() => {
                  try {
                    return (
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {format(parseISO(note.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    );
                  } catch { return null; }
                })()}
              </div>
            </div>
          )}

          {/* Modified by — always shown */}
          <div className="flex items-start gap-2">
            <User className="w-3 h-3 text-gray-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-none">Modified by</p>
              {note.modified_by_name ? (
                <p className="text-[10px] text-gray-700 font-medium">{note.modified_by_name}</p>
              ) : (
                <p className="text-[10px] text-gray-400 italic">Not yet modified</p>
              )}
              {/* Last Modified timestamp */}
              {note.modified_by_name && note.updated_at && (() => {
                try {
                  return (
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {format(parseISO(note.updated_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  );
                } catch { return null; }
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 pb-2">
        <p className="text-[9px] text-gray-400 italic">Click to view &amp; manage</p>
      </div>
    </div>,
    document.body,
  );
};
