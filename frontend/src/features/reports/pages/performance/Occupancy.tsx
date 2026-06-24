import React, { useState, useCallback } from 'react';
import { Clock, CalendarDays, Users, TrendingUp, BarChart2, AlertCircle, Printer } from 'lucide-react';
import {
  getOccupancy,
  getOccupancyDrillDown,
  printOccupancyReport,
  type OccupancyResponse,
  type OccupancyPractitionerRow,
  type OccupancyDailyPoint,
  type OccupancyDrillDownItem,
} from '../../reports.api';
import { getClinicBranches, getPractitioners, type Practitioner } from '../../../clinics/clinic.api';
import {
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
import { Loader2 } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMins = (mins: number): string => {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const OccupancyBar: React.FC<{ pct: number; label?: string; colorClass?: string }> = ({ pct, label, colorClass }) => {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = colorClass ? colorClass : (
    clamped >= 80 ? 'bg-green-500'
    : clamped >= 50 ? 'bg-yellow-400'
    : 'bg-red-400'
  );
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-gray-500 w-8">{label}</span>}
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

const DrillDownModal: React.FC<{
  practitioner: OccupancyPractitionerRow;
  startDate: string;
  endDate: string;
  onClose: () => void;
}> = ({ practitioner, startDate, endDate, onClose }) => {
  const [items, setItems] = useState<OccupancyDrillDownItem[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    getOccupancyDrillDown({
      start_date: startDate,
      end_date: endDate,
      practitioner_id: practitioner.practitioner_id,
    }).then(res => {
      setItems(res.results || (res as any));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [startDate, endDate, practitioner]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Drill-down</p>
            <h3 className="text-lg font-bold text-gray-900">{practitioner.practitioner_name} — Appointments</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none font-light">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
             <div className="py-10 text-center text-sm text-gray-500">Loading appointments...</div>
          ) : items.length === 0 ? (
             <div className="py-10 text-center text-sm text-gray-500">No appointments found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Time</th>
                  <th className="px-4 py-2 text-left">Patient</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Branch</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.appointment_id} className="border-t border-gray-100">
                    <td className="px-4 py-2">{formatDate(it.date)}</td>
                    <td className="px-4 py-2">{it.time}</td>
                    <td className="px-4 py-2 font-medium">{it.patient_name}</td>
                    <td className="px-4 py-2 text-gray-600">{it.consultation_type}</td>
                    <td className="px-4 py-2 text-gray-600">{it.status}</td>
                    <td className="px-4 py-2 text-gray-600">{it.branch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const Occupancy: React.FC = () => {
  const [preset,     setPreset]     = useState('month');
  const [startDate,  setStartDate]  = useState(monthStart());
  const [endDate,    setEndDate]    = useState(todayISO());
  const [branchId,       setBranchId]       = useState<string>('');
  const [practitionerId, setPractitionerId] = useState<string>('');
  
  const [branches,       setBranches]       = useState<any[]>([]);
  const [practitioners,  setPractitioners]  = useState<Practitioner[]>([]);

  const [data,       setData]       = useState<OccupancyResponse | null>(null);
  const [isLoading,  setIsLoading]  = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [hasRun,     setHasRun]     = useState(false);
  const [drillDown,  setDrillDown]  = useState<OccupancyPractitionerRow | null>(null);

  React.useEffect(() => {
    getClinicBranches().then((res) => setBranches(res.branches || [])).catch(() => {});
  }, []);

  React.useEffect(() => {
    const bId = branchId ? parseInt(branchId) : null;
    getPractitioners(bId).then((res) => {
      setPractitioners(res.practitioners || []);
      if (practitionerId && bId && !res.practitioners.some(p => p.id.toString() === practitionerId)) {
        setPractitionerId('');
      }
    }).catch(() => {});
  }, [branchId]);

  const handlePresetChange = (selected: string) => {
    setPreset(selected);
    const d = new Date();
    
    const formatLocal = (dateObj: Date) => {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (selected === 'today') {
      const todayStr = formatLocal(d);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (selected === 'week') {
      const day = d.getDay(); // 0 is Sunday, 1 is Monday
      const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
      
      const start = new Date(d.getFullYear(), d.getMonth(), diffToMonday);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      
      setStartDate(formatLocal(start));
      setEndDate(formatLocal(end));
    } else if (selected === 'month') {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0); // 0 gets last day of previous month
      
      setStartDate(formatLocal(start));
      setEndDate(formatLocal(end));
    }
  };

  const run = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getOccupancy({
        start_date: startDate,
        end_date: endDate,
        ...(branchId ? { branch_id: parseInt(branchId) } : {}),
        ...(practitionerId ? { practitioner_id: parseInt(practitionerId) } : {}),
      });
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
  }, [startDate, endDate, branchId, practitionerId]);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const html = await printOccupancyReport({
        start_date: startDate,
        end_date: endDate,
        ...(branchId ? { branch_id: parseInt(branchId) } : {}),
        ...(practitionerId ? { practitioner_id: parseInt(practitionerId) } : {}),
      });
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 250);
      } else {
        toast.error('Please allow popups to print reports.');
      }
    } catch (err: any) {
      toast.error('Failed to generate print document');
    } finally {
      setIsPrinting(false);
    }
  };

  // Filter daily trend for the drilled-down practitioner by matching their
  // appointments — the API returns a global daily trend; the per-practitioner
  // drill-down uses the same series filtered to the date range only.
  const drillPoints: OccupancyDailyPoint[] = data?.daily_trend ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 w-full max-w-[180px]">
          <label className="text-xs font-medium text-gray-600">Date Range</label>
          <select
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom...</option>
          </select>
        </div>

        {preset === 'custom' && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">From</label>
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">To</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Branch</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white min-w-[150px] outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Practitioner</label>
          <select
            value={practitionerId}
            onChange={(e) => setPractitionerId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white min-w-[150px] outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="">All Practitioners</option>
            {practitioners.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={run}
          disabled={isLoading}
          className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Running...</>
          ) : (
            'Run Report'
          )}
        </button>

        {data && (
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ml-auto"
          >
            {isPrinting ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
            ) : (
              <><Printer className="w-4 h-4" />Print</>
            )}
          </button>
        )}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <StatCard
                label="Occupancy %"
                value={`${data.summary.overall_occupancy_pct.toFixed(1)}%`}
                color="text-purple-700" bg="bg-purple-50" border="border-purple-200"
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <StatCard
                label="Utilization %"
                value={`${data.summary.overall_utilization_pct.toFixed(1)}%`}
                color="text-blue-700" bg="bg-blue-50" border="border-blue-200"
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <StatCard
                label="Available"
                value={fmtMins(data.summary.total_scheduled_minutes)}
                color="text-gray-900" bg="bg-gray-50" border="border-gray-200"
                icon={<CalendarDays className="w-4 h-4" />}
              />
              <StatCard
                label="Booked"
                value={fmtMins(data.summary.total_occupied_minutes)}
                color="text-sky-700" bg="bg-sky-50" border="border-sky-200"
                icon={<Clock className="w-4 h-4" />}
              />
              <StatCard
                label="Completed"
                value={fmtMins(data.summary.total_completed_minutes)}
                color="text-green-700" bg="bg-green-50" border="border-green-200"
                icon={<Users className="w-4 h-4" />}
              />
              <StatCard
                label="Cancel/DNA"
                value={fmtMins(data.summary.total_cancelled_minutes + data.summary.total_dna_minutes)}
                color="text-red-700" bg="bg-red-50" border="border-red-200"
                icon={<AlertCircle className="w-4 h-4" />}
              />
            </div>

            {/* Practitioner table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left font-semibold">Practitioner</th>
                      <th className="px-4 py-3 text-left font-semibold">Branch</th>
                      <th className="px-4 py-3 text-right font-semibold">Available</th>
                      <th className="px-4 py-3 text-right font-semibold">Booked</th>
                      <th className="px-4 py-3 text-right font-semibold">Completed</th>
                      <th className="px-4 py-3 text-right font-semibold">Cancel/DNA</th>
                      <th className="px-4 py-3 font-semibold min-w-45">Occ / Util</th>
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
                        <td className="px-4 py-3 text-gray-600">{row.branch_name}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmtMins(row.scheduled_minutes)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmtMins(row.occupied_minutes)}</td>
                        <td className="px-4 py-3 text-right text-green-600">{fmtMins(row.completed_minutes)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{fmtMins(row.cancelled_minutes + row.dna_minutes)}</td>
                        <td className="px-4 py-3 space-y-1">
                          <OccupancyBar pct={row.occupancy_pct} label="Occ" />
                          <OccupancyBar pct={row.utilization_pct} label="Util" colorClass="bg-blue-500" />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setDrillDown(row)}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium underline underline-offset-2 transition-colors"
                          >
                            Details ↗
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Branch Chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-purple-500" />
                  Occupancy by Branch
                </h3>
                {!data.branch_chart || data.branch_chart.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No branch data available.</p>
                ) : (
                  <div className="space-y-3">
                    {data.branch_chart.map((b) => (
                      <div key={b.branch_name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-gray-700">{b.branch_name}</span>
                        </div>
                        <OccupancyBar pct={b.occupancy_pct} />
                      </div>
                    ))}
                  </div>
                )}
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
          </div>
          </>
        )}
      </div>

      {/* Drill-down modal */}
      {drillDown && (
        <DrillDownModal
          practitioner={drillDown}
          startDate={data?.start_date || startDate}
          endDate={data?.end_date || endDate}
          onClose={() => setDrillDown(null)}
        />
      )}
    </div>
  );
};
