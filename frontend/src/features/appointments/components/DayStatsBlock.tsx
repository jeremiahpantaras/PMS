import React from 'react';
import { Users, UserPlus, Activity } from 'lucide-react';
import type { DailyOccupancyStats } from '@/features/appointments/appointment.api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DayStatsBlockProps {
  /** Stats provided from the backend */
  stats?: DailyOccupancyStats;
  /** When true renders a compact layout suited for week-view columns. */
  compact?: boolean;
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
  stats,
  compact = false,
}) => {
  const totalClients = stats?.total_clients ?? 0;
  const newClients = stats?.new_clients ?? 0;
  const occupancy = stats?.occupancy_pct ?? 0;
  const totalDutyMinutes = stats?.available_minutes ?? 0;
  
  const showOccupancy = totalDutyMinutes > 0;
  const textCol = occupancyTextColor(occupancy);
  const bgCol   = occupancyBgColor(occupancy, showOccupancy);
  
  const formattedOccupancy = Number(occupancy.toFixed(2));

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
            <span className="truncate">Occupancy</span>
          </div>
          <span className={`text-[11px] font-bold shrink-0 ${showOccupancy ? textCol : 'text-gray-400'}`}>
            {showOccupancy ? `${formattedOccupancy}%` : '—'}
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
            {showOccupancy ? `${formattedOccupancy}%` : '—'}
          </span>
        </div>

      </div>
    </div>
  );
};
