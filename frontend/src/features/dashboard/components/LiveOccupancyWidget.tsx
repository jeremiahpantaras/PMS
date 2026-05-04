import React from 'react';
import { Activity, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useLiveOccupancy } from '../hooks/useLiveOccupancy';
import type { OccupancyEntry } from '../types/dashboard.types';

// ── Status badge ──────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: OccupancyEntry['status'] }> = ({ status }) => {
  if (status === 'occupied') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        Occupied
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
      <span className="w-2 h-2 rounded-full bg-emerald-500" />
      Available
    </span>
  );
};

// ── Single practitioner card ──────────────────────────────────────────────────

const PractitionerCard: React.FC<{ entry: OccupancyEntry }> = ({ entry }) => {
  const initials = entry.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className={`
        flex items-start gap-3 p-3 rounded-xl border transition-all duration-300
        ${entry.status === 'occupied'
          ? 'bg-red-50 border-red-200'
          : 'bg-emerald-50 border-emerald-200'}
      `}
    >
      {/* Avatar */}
      <div
        className={`
          w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold
          ${entry.status === 'occupied'
            ? 'bg-red-200 text-red-800'
            : 'bg-emerald-200 text-emerald-800'}
        `}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{entry.name}</p>
          <StatusBadge status={entry.status} />
        </div>

        {entry.status === 'occupied' && entry.current_patient ? (
          <div className="space-y-0.5">
            <p className="text-xs text-gray-600 truncate">
              <span className="font-medium text-gray-700">Patient: </span>
              {entry.current_patient}
            </p>
            {entry.service && (
              <p className="text-xs text-gray-500 truncate">{entry.service}</p>
            )}
            {entry.start_time && (
              <p className="text-xs text-gray-400">
                Started: {entry.start_time.substring(0, 5)}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            <p className="text-xs text-gray-500">
              {entry.start_time
                ? `Next: ${entry.start_time.substring(0, 5)}`
                : 'No upcoming appointments'}
            </p>
          </div>
        )}

        {/* Mini progress */}
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-1">
            <div
              className={`h-1 rounded-full transition-all ${
                entry.status === 'occupied' ? 'bg-red-400' : 'bg-emerald-400'
              }`}
              style={{
                width: entry.today_total
                  ? `${Math.min((entry.today_completed / entry.today_total) * 100, 100)}%`
                  : '0%',
              }}
            />
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {entry.today_completed}/{entry.today_total}
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Main widget ───────────────────────────────────────────────────────────────

interface LiveOccupancyWidgetProps {
  maxVisible?: number;
}

export const LiveOccupancyWidget: React.FC<LiveOccupancyWidgetProps> = ({
  maxVisible = 8,
}) => {
  const { snapshot, isLoading, wsConnected, refetch } = useLiveOccupancy();

  const occupied  = snapshot.filter((e) => e.status === 'occupied');
  const available = snapshot.filter((e) => e.status === 'available');
  const sorted    = [...occupied, ...available].slice(0, maxVisible);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-2/5 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-1/2 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 shrink-0">
        <div>
          <h2 className="text-base font-bold text-gray-900 leading-tight">
            Live Clinic Occupancy
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time practitioner activity
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* WS indicator */}
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              wsConnected
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-gray-100 text-gray-400'
            }`}
            title={wsConnected ? 'Live (WebSocket connected)' : 'Offline — showing last snapshot'}
          >
            {wsConnected ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            {wsConnected ? 'Live' : 'Offline'}
          </span>

          <button
            onClick={refetch}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            title="Refresh snapshot"
          >
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>

          {/* Icon */}
          <div className="w-9 h-9 bg-sky-50 rounded-xl flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-sky-500" />
          </div>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 mb-4 shrink-0">
        <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-xs font-semibold text-red-700">{occupied.length} Occupied</span>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-emerald-700">{available.length} Available</span>
        </div>
      </div>

      {/* Cards */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
            <Activity className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-400">No practitioners on schedule today</p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto">
          {sorted.map((entry) => (
            <PractitionerCard key={entry.practitioner_id} entry={entry} />
          ))}
          {snapshot.length > maxVisible && (
            <p className="text-center text-xs text-gray-400 pt-1">
              +{snapshot.length - maxVisible} more practitioners
            </p>
          )}
        </div>
      )}
    </div>
  );
};
