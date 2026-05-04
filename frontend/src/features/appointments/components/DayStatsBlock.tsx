import React, { useMemo } from 'react';
import { Users, UserPlus, Activity } from 'lucide-react';
import type { Appointment } from '@/types';
import type { PractitionerAvailability, DutyDay } from '@/features/clinics/clinic.api';

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_MAP: Record<number, DutyDay> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

/** Appointment statuses that should not count toward client or occupancy metrics. */
const EXCLUDED_STATUSES = new Set<string>(['CANCELLED', 'NO_SHOW', 'DNA']);

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DayStatsBlockProps {
  /** The calendar date this block represents. */
  date: Date;
  /**
   * Appointments for this specific date — already filtered by the caller
   * (e.g. from appointmentsByDate[dateStr]).
   */
  appointments: Appointment[];
  /**
   * Practitioner availability used to compute total duty minutes.
   * When undefined the occupancy indicator is hidden.
   */
  availability?: PractitionerAvailability;
  /** When true renders a compact layout suited for week-view columns. */
  compact?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Computes total duty minutes for a given date from PractitionerAvailability.
 * Returns 0 if the date is not a duty day or availability is undefined.
 */
function computeTotalDutyMinutes(
  date: Date,
  availability: PractitionerAvailability | undefined,
): number {
  if (!availability) return 0;

  const dayKey = DAY_MAP[date.getDay()];
  if (!availability.duty_days.includes(dayKey)) return 0;

  // Split-shift mode: sum each block
  if (availability.duty_schedule) {
    const blocks = availability.duty_schedule[dayKey] ?? [];
    return blocks.reduce(
      (sum, b) => sum + Math.max(0, timeToMinutes(b.end) - timeToMinutes(b.start)),
      0,
    );
  }

  // Legacy single-block mode: duty range minus lunch
  const dutyMins  = timeToMinutes(availability.duty_end_time)   - timeToMinutes(availability.duty_start_time);
  const lunchMins = timeToMinutes(availability.lunch_end_time)  - timeToMinutes(availability.lunch_start_time);
  return Math.max(0, dutyMins - lunchMins);
}

// ── Occupancy colour helpers ──────────────────────────────────────────────────

function occupancyTextColor(pct: number): string {
  if (pct >= 70) return 'text-emerald-600';
  if (pct >= 40) return 'text-amber-600';
  return 'text-red-500';
}

function occupancyBgColor(pct: number, hasData: boolean): string {
  if (!hasData) return 'bg-gray-100';
  if (pct >= 70) return 'bg-emerald-50';
  if (pct >= 40) return 'bg-amber-50';
  return 'bg-red-50';
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DayStatsBlock: React.FC<DayStatsBlockProps> = ({
  date,
  appointments,
  availability,
  compact = false,
}) => {
  const stats = useMemo(() => {
    // Only count visits that actually (or will) happen
    const validApts = appointments.filter(a => !EXCLUDED_STATUSES.has(a.status));

    // Unique patients (by patient PK)
    const clientIds = new Set(validApts.map(a => a.patient));
    const totalClients = clientIds.size;

    // "New" clients: use appointment_type === 'INITIAL' as a reliable proxy
    // since the frontend doesn't have access to historical records outside
    // the currently loaded date range.
    const newClientIds = new Set(
      validApts.filter(a => a.appointment_type === 'INITIAL').map(a => a.patient),
    );
    const newClients = newClientIds.size;

    // Occupied minutes = sum of durations for valid appointments
    const occupiedMinutes = validApts.reduce(
      (sum, a) => sum + (a.duration_minutes ?? 0),
      0,
    );

    // Total duty minutes from availability config
    const totalDutyMinutes = computeTotalDutyMinutes(date, availability);

    const occupancy =
      totalDutyMinutes > 0
        ? Math.min(100, Math.round((occupiedMinutes / totalDutyMinutes) * 100))
        : 0;

    return { totalClients, newClients, occupiedMinutes, totalDutyMinutes, occupancy };
  }, [appointments, availability, date]);

  const { totalClients, newClients, occupancy, totalDutyMinutes } = stats;
  const showOccupancy = totalDutyMinutes > 0;
  const textCol = occupancyTextColor(occupancy);
  const bgCol   = occupancyBgColor(occupancy, showOccupancy);

  // ── COMPACT LAYOUT (week-view column footer) ──────────────────────────────
  if (compact) {
    return (
      <div className="border-t border-gray-200 bg-gray-50 px-2 py-1.5 space-y-0.5">
        {/* Total clients */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 text-[10px] text-gray-500 min-w-0">
            <Users className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">Clients</span>
          </div>
          <span className="text-[10px] font-semibold text-gray-800 shrink-0">
            {totalClients}
          </span>
        </div>

        {/* New clients */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 text-[10px] text-gray-500 min-w-0">
            <UserPlus className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">New</span>
          </div>
          <span className="text-[10px] font-semibold text-sky-700 shrink-0">
            {newClients}
          </span>
        </div>

        {/* Occupancy */}
        <div className={`flex items-center justify-between gap-1 rounded px-1 -mx-1 ${bgCol}`}>
          <div className="flex items-center gap-1 text-[10px] text-gray-500 min-w-0">
            <Activity className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">Occuupancy</span>
          </div>
          <span className={`text-[11px] font-bold shrink-0 ${showOccupancy ? textCol : 'text-gray-400'}`}>
            {showOccupancy ? `${occupancy}%` : '—'}
          </span>
        </div>
      </div>
    );
  }

  // ── EXPANDED LAYOUT (day-view footer) ────────────────────────────────────
  return (
    <div className="shrink-0 border-t border-gray-200 bg-gray-50">
      <div className="px-6 py-2.5 flex items-center gap-5 flex-wrap">

        {/* Total clients */}
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
            Total Clients
          </span>
          <span className="text-sm font-bold text-gray-800">{totalClients}</span>
        </div>

        <div className="w-px h-4 bg-gray-300 shrink-0" />

        {/* New clients */}
        <div className="flex items-center gap-2">
          <UserPlus className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
            New Clients
          </span>
          <span className="text-sm font-bold text-sky-700">{newClients}</span>
        </div>

        <div className="w-px h-4 bg-gray-300 shrink-0" />

        {/* Occupancy */}
        <div className={`flex items-center gap-2 rounded-lg px-3 py-1 ${bgCol}`}>
          <Activity className={`w-3.5 h-3.5 shrink-0 ${showOccupancy ? textCol : 'text-gray-400'}`} />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
            Occupancy
          </span>
          <span className={`text-sm font-bold ${showOccupancy ? textCol : 'text-gray-400'}`}>
            {showOccupancy ? `${occupancy}%` : '—'}
          </span>
        </div>

      </div>
    </div>
  );
};
