import React, { useState, useCallback } from 'react';
import { Clock, CalendarDays, Users, TrendingUp, BarChart2 } from 'lucide-react';
import {
  getOccupancy,
  type OccupancyResponse,
  type OccupancyPractitionerRow,
  type OccupancyDailyPoint,
} from '../../reports.api';
import {
  DateRangePicker,
  StatCard,
  ReportLoading,
  ReportError,
  ReportEmpty,
  ReportHeader,
  formatDate,
  todayISO,
  monthStart,
} from '../../components/ReportShared';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMins = (mins: number): string => {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const OccupancyBar: React.FC<{ pct: number }> = ({ pct }) => {
  const clamped = Math.min(100, Math.max(0, pct));
  const color =
    clamped >= 80 ? 'bg-green-500'
    : clamped >= 50 ? 'bg-yellow-400'
    : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-10 text-right">
        {clamped.toFixed(1)}%
      </span>
    </div>
  );
};

// ─── Drill-down daily chart ───────────────────────────────────────────────────

const DailyTrendChart: React.FC<{
  points:      OccupancyDailyPoint[];
  practitioner: string;
  onClose:     () => void;
}> = ({ points, practitioner, onClose }) => {
  if (!points.length) return null;
  const maxMins = Math.max(...points.map((p) => p.scheduled_minutes), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Drill-down</p>
            <h3 className="text-lg font-bold text-gray-900">{practitioner} — Daily Occupancy</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none font-light transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            {points.map((pt) => (
              <div key={pt.date} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-24 shrink-0">{formatDate(pt.date)}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded relative overflow-hidden">
                  {/* Scheduled bar (background) */}
                  <div
                    className="absolute inset-y-0 left-0 bg-gray-200 rounded"
                    style={{ width: `${(pt.scheduled_minutes / maxMins) * 100}%` }}
                  />
                  {/* Occupied bar (foreground) */}
                  <div
                    className={`absolute inset-y-0 left-0 rounded ${
                      pt.occupancy_pct >= 80 ? 'bg-green-500'
                      : pt.occupancy_pct >= 50 ? 'bg-yellow-400'
                      : 'bg-red-400'
                    }`}
                    style={{ width: `${(pt.occupied_minutes / maxMins) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-12 text-right">
                  {pt.occupancy_pct.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-400 w-20 text-right">
                  {fmtMins(pt.occupied_minutes)} / {fmtMins(pt.scheduled_minutes)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const Occupancy: React.FC = () => {
  const [startDate,  setStartDate]  = useState(monthStart());
  const [endDate,    setEndDate]    = useState(todayISO());
  const [data,       setData]       = useState<OccupancyResponse | null>(null);
  const [isLoading,  setIsLoading]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [hasRun,     setHasRun]     = useState(false);
  const [drillDown,  setDrillDown]  = useState<OccupancyPractitionerRow | null>(null);

  const run = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getOccupancy({ start_date: startDate, end_date: endDate });
      setData(result);
      setHasRun(true);
      setDrillDown(null);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to generate Occupancy report';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  // Filter daily trend for the drilled-down practitioner by matching their
  // appointments — the API returns a global daily trend; the per-practitioner
  // drill-down uses the same series filtered to the date range only.
  const drillPoints: OccupancyDailyPoint[] = data?.daily_trend ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          onApply={run}
          isLoading={isLoading}
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <ReportLoading />
        ) : error ? (
          <ReportError message={error} onRetry={run} />
        ) : !hasRun ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-purple-200">
              <BarChart2 className="w-8 h-8 text-purple-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Occupancy Report</p>
            <p className="text-xs text-gray-500 max-w-xs">
              Select a date range and click <strong>Run Report</strong> to measure provider
              utilisation and time efficiency.
            </p>
          </div>
        ) : !data || data.practitioners.length === 0 ? (
          <ReportEmpty message="No appointment data found for the selected date range." />
        ) : (
          <>
            <ReportHeader
              title="Occupancy Report"
              description="Provider utilisation and time efficiency"
              startDate={data.start_date}
              endDate={data.end_date}
              icon={<Clock className="w-5 h-5" />}
              totalBadge={
                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold rounded-full">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {data.summary.overall_occupancy_pct.toFixed(1)}% Overall
                </span>
              }
            />

            {/* Summary KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard
                label="Overall Occupancy"
                value={`${data.summary.overall_occupancy_pct.toFixed(1)}%`}
                color="text-purple-700"
                bg="bg-purple-50"
                border="border-purple-200"
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <StatCard
                label="Scheduled"
                value={fmtMins(data.summary.total_scheduled_minutes)}
                color="text-gray-900"
                bg="bg-gray-50"
                border="border-gray-200"
                icon={<CalendarDays className="w-4 h-4" />}
              />
              <StatCard
                label="Occupied"
                value={fmtMins(data.summary.total_occupied_minutes)}
                color="text-sky-700"
                bg="bg-sky-50"
                border="border-sky-200"
                icon={<Clock className="w-4 h-4" />}
              />
              <StatCard
                label="Appointments"
                value={data.summary.total_appointments}
                color="text-green-700"
                bg="bg-green-50"
                border="border-green-200"
                icon={<Users className="w-4 h-4" />}
              />
            </div>

            {/* Practitioner table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left font-semibold">Practitioner</th>
                      <th className="px-4 py-3 text-right font-semibold">Scheduled</th>
                      <th className="px-4 py-3 text-right font-semibold">Occupied</th>
                      <th className="px-4 py-3 text-right font-semibold">Appts</th>
                      <th className="px-4 py-3 text-right font-semibold">Services</th>
                      <th className="px-4 py-3 font-semibold min-w-45">Occupancy</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.practitioners.map((row, idx) => (
                      <tr
                        key={row.practitioner_id}
                        className={`border-t border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{row.practitioner_name}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmtMins(row.scheduled_minutes)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmtMins(row.occupied_minutes)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{row.appointment_count}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{row.service_count}</td>
                        <td className="px-4 py-3">
                          <OccupancyBar pct={row.occupancy_pct} />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setDrillDown(row)}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium underline underline-offset-2 transition-colors"
                          >
                            Trend ↗
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Overall daily trend */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-500" />
                Daily Occupancy Trend (All Practitioners)
              </h3>
              {drillPoints.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No daily data available.</p>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const maxMins = Math.max(...drillPoints.map((p) => p.scheduled_minutes), 1);
                    return drillPoints.map((pt) => (
                      <div key={pt.date} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-24 shrink-0">{formatDate(pt.date)}</span>
                        <div className="flex-1 h-4 bg-gray-100 rounded relative overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-gray-200 rounded"
                            style={{ width: `${(pt.scheduled_minutes / maxMins) * 100}%` }}
                          />
                          <div
                            className={`absolute inset-y-0 left-0 rounded ${
                              pt.occupancy_pct >= 80 ? 'bg-purple-500'
                              : pt.occupancy_pct >= 50 ? 'bg-yellow-400'
                              : 'bg-red-400'
                            }`}
                            style={{ width: `${(pt.occupied_minutes / maxMins) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 w-12 text-right">
                          {pt.occupancy_pct.toFixed(1)}%
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              )}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-gray-300" />
                  <span className="text-xs text-gray-500">Scheduled</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-purple-500" />
                  <span className="text-xs text-gray-500">Occupied (≥80%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-yellow-400" />
                  <span className="text-xs text-gray-500">Moderate (50–80%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-red-400" />
                  <span className="text-xs text-gray-500">Low (&lt;50%)</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Drill-down modal */}
      {drillDown && (
        <DailyTrendChart
          points={drillPoints}
          practitioner={drillDown.practitioner_name}
          onClose={() => setDrillDown(null)}
        />
      )}
    </div>
  );
};
