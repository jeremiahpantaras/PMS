import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { User, Users, CalendarDays, Clock, FileText, Pencil } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { BlockAppointment } from '@/types';

interface BlockHoverCardProps {
  block: BlockAppointment;
  anchorRect: DOMRect;
  onEnter: () => void;
  onLeave: () => void;
}

// Helper to format time in 12-hour format
const fmt12 = (time: string): string => {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

// Row component outside the main component
const HoverRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode }> = ({ icon, label, value, sub }) => (
  <div className="flex items-start gap-2.5 py-1.5">
    <div className="flex-shrink-0 mt-0.5 text-gray-400">{icon}</div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-none mb-0.5">{label}</p>
      <p className="text-xs text-gray-800 font-medium leading-snug">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5 leading-none">{sub}</p>}
    </div>
  </div>
);

export const BlockHoverCard: React.FC<BlockHoverCardProps> = ({
  block,
  anchorRect,
  onEnter,
  onLeave,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
  const CARD_WIDTH = 280;
  const GAP = 8;

  // Memoize formatted date
  const formattedDate = useMemo(() => {
    try {
      return format(parseISO(block.date), 'EEEE, MMMM d, yyyy');
    } catch {
      return block.date;
    }
  }, [block.date]);

  // Position the card once it's rendered so we know its height
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const cardH = card.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer right side; fall back to left
    let left = anchorRect.right + GAP;
    if (left + CARD_WIDTH > vw - 8) {
      left = anchorRect.left - CARD_WIDTH - GAP;
    }

    // Vertically align with the anchor, clamped to viewport
    let top = anchorRect.top;
    if (top + cardH > vh - 8) {
      top = vh - cardH - 8;
    }
    if (top < 8) top = 8;

    // Use requestAnimationFrame to avoid the warning
    requestAnimationFrame(() => {
      setStyle({ position: 'fixed', top, left, width: CARD_WIDTH, visibility: 'visible', zIndex: 9990 });
    });
  }, [anchorRect]);

  return createPortal(
    <div
      ref={cardRef}
      style={style}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden pointer-events-auto"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gray-800">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight truncate text-white">
              {block.event_name}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-2 divide-y divide-gray-100">
        {/* Date */}
        <HoverRow
          icon={<CalendarDays className="w-3.5 h-3.5" />}
          label="Date"
          value={formattedDate}
        />

        {/* Time */}
        <HoverRow
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Time"
          value={
            <span className="text-sky-600">
              {fmt12(block.start_time)} – {fmt12(block.end_time)}
            </span>
          }
        />

        {/* Created By */}
        {block.created_by_name && (
          <HoverRow
            icon={<User className="w-3.5 h-3.5" />}
            label="Created By"
            value={block.created_by_name}
            sub={block.created_at && (() => {
              try { return format(parseISO(block.created_at), 'MMM d, yyyy h:mm a'); }
              catch { return undefined; }
            })()}
          />
        )}

        {/* Modified By — always shown */}
        <HoverRow
          icon={<Pencil className="w-3.5 h-3.5" />}
          label="Modified By"
          value={
            block.modified_by_name
              ? block.modified_by_name
              : <span className="text-gray-400 italic font-normal">Not yet modified</span>
          }
          sub={block.modified_by_name && block.updated_at && (() => {
            try { return format(parseISO(block.updated_at), 'MMM d, yyyy h:mm a'); }
            catch { return undefined; }
          })()}
        />

        {/* People / Users Involved */}
        {block.visible_to_user_names && block.visible_to_user_names.length > 0 && (
          <HoverRow
            icon={<Users className="w-3.5 h-3.5" />}
            label="People Involved"
            value={block.visible_to_user_names.join(', ')}
          />
        )}

        {/* Notes */}
        {block.notes && (
          <HoverRow
            icon={<FileText className="w-3.5 h-3.5" />}
            label="Notes"
            value={<span className="line-clamp-2 text-gray-600">{block.notes}</span>}
          />
        )}
      </div>

      {/* Footer tip */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 text-center">Hold 2s to drag and reschedule</p>
      </div>
    </div>,
    document.body,
  );
};
