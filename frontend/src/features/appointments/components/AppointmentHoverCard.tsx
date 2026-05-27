import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  User, Stethoscope, Tag, FileText,
  Building2, CalendarDays, ArrowRight, Globe
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { Appointment } from '@/types';
import { APPOINTMENT_STATUS_COLORS } from '@/types';
import { format, parseISO } from 'date-fns';
import { getUpcomingAppointments } from '../appointment.api';

interface AppointmentHoverCardProps {
  appointment: Appointment;
  anchorRect:  DOMRect;
  onEnter:     () => void;
  onLeave:     () => void;
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED:  'Scheduled',
  CONFIRMED:  'Confirmed',
  COMPLETED:  'Completed',
  CANCELLED:  'Cancelled',
  NO_SHOW:    'No Show',
  IN_PROGRESS:'In Progress',
};

const fmt12 = (time: string): string => {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

export const AppointmentHoverCard: React.FC<AppointmentHoverCardProps> = ({
  appointment: apt,
  anchorRect,
  onEnter,
  onLeave,
}) => {
  const cardRef               = useRef<HTMLDivElement>(null);
  const [style, setStyle]     = useState<React.CSSProperties>({ visibility: 'hidden' });
  const CARD_WIDTH            = 300;
  const GAP                   = 8;

  // ── Position the card once it's rendered so we know its height ───────────
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const cardH  = card.offsetHeight;
    const vw     = window.innerWidth;
    const vh     = window.innerHeight;

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

    setStyle({ position: 'fixed', top, left, width: CARD_WIDTH, visibility: 'visible', zIndex: 9990 });
  }, [anchorRect]);

  const statusColors = APPOINTMENT_STATUS_COLORS[apt.status] ?? APPOINTMENT_STATUS_COLORS['SCHEDULED'];

  // ── Detect portal (online) booking ─────────────────────────────────────────
  const isPortal = apt.booking_source === 'portal' ||
    (apt.created_by === null && !!apt.notes?.startsWith('Created from portal booking'));

  // ── Override color when practitioner has arrived ──────────────────────────────
  const isArrived = apt.arrival_status === 'ARRIVED';
  // Portal gets mint green header; arrived gets purple; otherwise service color.
  const cardBackground = isArrived ? '#0575E6' : isPortal ? '#0575E6' : (apt.service_color ?? null);
  const cardTextColor  = isArrived ? '#fff' : isPortal ? '#ffffff' : undefined;

  // Fetch upcoming appointments for this patient
  const { data: upcomingAppointments = [] } = useQuery({
    queryKey: ['upcoming-appointments', apt.patient],
    queryFn: () => getUpcomingAppointments(apt.patient, 5),
    enabled: !!apt.patient,
  });

  // Filter out the current appointment from upcoming list
  const otherUpcomingAppointments = upcomingAppointments.filter(a => a.id !== apt.id);

  const Row: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className="flex-shrink-0 mt-0.5 text-gray-400">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <p className="text-xs text-gray-800 font-medium leading-snug">{value}</p>
      </div>
    </div>
  );

  return createPortal(
    <div
      ref={cardRef}
      style={style}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden pointer-events-auto"
    >
      {/* ── Colour header strip ── */}
      <div
        className={`px-4 py-3 ${!cardBackground ? statusColors.bg : ''}`}
        style={cardBackground ? { backgroundColor: cardBackground } : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className="text-sm font-bold leading-tight truncate"
              style={cardBackground ? { color: cardTextColor } : undefined}
            >
              <span className={!cardBackground ? statusColors.text : ''}>
                {apt.patient_name}
              </span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            {/* Portal badge */}
            {isPortal && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                <Globe className="w-2.5 h-2.5" />
                Online
              </span>
            )}
            {/* Status badge */}
            <span
              className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border
                ${(apt.service_color && !isPortal)
                  ? 'bg-white/20 text-white border-white/40'
                  : isPortal
                  ? 'bg-emerald-700/20 text-emerald-900 border-emerald-400/40'
                  : `${statusColors.bg} ${statusColors.text} ${statusColors.border}`
                }`}
            >
              {STATUS_LABELS[apt.status] ?? apt.status}
            </span>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-4 py-2 divide-y divide-gray-100">

        {/* Date & Time */}
        <Row
          icon={<CalendarDays className="w-3.5 h-3.5" />}
          label="Date & Time"
          value={
            <>
              {format(parseISO(apt.date), 'EEEE, MMMM d, yyyy')}
              <br />
              <span className="text-sky-600">
                {fmt12(apt.start_time)} – {fmt12(apt.end_time)}
              </span>
              {apt.start_time && apt.end_time && (() => {
                const [sH, sM] = apt.start_time.split(':').map(Number);
                const [eH, eM] = apt.end_time.split(':').map(Number);
                const mins = Math.max((eH * 60 + eM) - (sH * 60 + sM), 0);
                if (!mins) return null;
                const hrs = Math.floor(mins / 60);
                const rem = mins % 60;
                const label = hrs > 0 && rem > 0 ? `${hrs}h ${rem}m` : hrs > 0 ? `${hrs}h` : `${mins} min`;
                return (
                  <span className="ml-1.5 text-gray-400 text-[10px]">
                    ({label})
                  </span>
                );
              })()}
            </>
          }
        />

        {/* Practitioner */}
        {apt.practitioner_name && (
          <Row
            icon={<User className="w-3.5 h-3.5" />}
            label="Practitioner"
            value={apt.practitioner_name}
          />
        )}

        {/* Service */}
        {apt.service_name && (
          <Row
            icon={<Stethoscope className="w-3.5 h-3.5" />}
            label="Service"
            value={
              <span className="flex items-center gap-1.5">
                {apt.service_color && (
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: apt.service_color }}
                  />
                )}
                {apt.service_name}
              </span>
            }
          />
        )}

        {/* Appointment type (fallback) */}
        {!apt.service_name && apt.appointment_type && (
          <Row
            icon={<Tag className="w-3.5 h-3.5" />}
            label="Type"
            value={apt.appointment_type}
          />
        )}

        {/* Chief complaint */}
        {apt.chief_complaint && (
          <Row
            icon={<FileText className="w-3.5 h-3.5" />}
            label="Chief Complaint"
            value={apt.chief_complaint}
          />
        )}

        {/* Notes */}
        {apt.notes && (
          <Row
            icon={<FileText className="w-3.5 h-3.5" />}
            label="Notes"
            value={
              <span className="line-clamp-2 text-gray-600">{apt.notes}</span>
            }
          />
        )}

        {/* Branch — uses location_name from Appointment type */}
        {apt.location_name && (
          <Row
            icon={<Building2 className="w-3.5 h-3.5" />}
            label="Branch"
            value={apt.location_name}
          />
        )}

        {/* Upcoming Appointments */}
        {otherUpcomingAppointments.length > 0 && (
          <div className="py-2">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              <CalendarDays className="w-3.5 h-3.5" />
              Upcoming Appointments
            </div>
            <div className="space-y-1.5">
              {otherUpcomingAppointments.slice(0, 3).map(apt2 => (
                <div key={apt2.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                  <span className="text-sky-600 font-medium">
                    {format(parseISO(apt2.date), 'MMM d')}
                  </span>
                  <span className="text-gray-400">
                    {fmt12(apt2.start_time)}
                  </span>
                  <ArrowRight className="w-3 h-3 text-gray-300" />
                  <span className="text-gray-600 truncate">
                    {apt2.service_name || apt2.appointment_type}
                  </span>
                </div>
              ))}
              {otherUpcomingAppointments.length > 3 && (
                <p className="text-[10px] text-gray-400 pl-1">
                  +{otherUpcomingAppointments.length - 3} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* Created by & Modified by */}
        {(apt.created_by_name || apt.updated_by_name || (apt.created_by === null && apt.notes?.startsWith('Created from portal booking'))) && (
          <div className="py-2 border-t border-gray-100">
            {apt.created_by === null && apt.notes?.startsWith('Created from portal booking') ? (
              <Row
                icon={<User className="w-3.5 h-3.5" />}
                label="Created by"
                value={
                  <span className="text-sky-600 font-semibold">
                    Online Booking
                    <span className="text-gray-400 text-[10px] ml-1 font-normal">
                      {apt.created_at && format(parseISO(apt.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </span>
                }
              />
            ) : (
              apt.created_by_name && (
                <Row
                  icon={<User className="w-3.5 h-3.5" />}
                  label="Created by"
                  value={
                    <span className="text-gray-600">
                      {apt.created_by_name}
                      <span className="text-gray-400 text-[10px] ml-1">
                        {apt.created_at && format(parseISO(apt.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </span>
                  }
                />
              )
            )}
            {apt.updated_by_name && (
              <Row
                icon={<User className="w-3.5 h-3.5" />}
                label="Modified by"
                value={
                  <span className="text-gray-600">
                    {apt.updated_by_name}
                    <span className="text-gray-400 text-[10px] ml-1">
                      {apt.updated_at && format(parseISO(apt.updated_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </span>
                }
              />
            )}
          </div>
        )}

      </div>

      {/* ── Subtle footer tip ── */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 text-center">Click card to open full details</p>
      </div>
    </div>,
    document.body,
  );
};