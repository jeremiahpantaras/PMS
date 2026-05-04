import React, { useState, useCallback } from 'react';
import {
  Users, DollarSign, CalendarDays, TrendingUp,
  CheckCircle, XCircle, UserX, Clock, BookOpen,
} from 'lucide-react';
import {
  getProvidersPractice,
  type ProvidersPracticeResponse,
  type ProvidersPracticeRow,
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

const formatPeso = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PctBar: React.FC<{ pct: number; bgClass: string; textClass: string }> = ({
  pct, bgClass, textClass,
}) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-1.5 rounded-full ${bgClass}`}
        style={{ width: `${Math.min(100, pct).toFixed(1)}%` }}
      />
    </div>
    <span className={`text-xs font-semibold w-12 text-right tabular-nums ${textClass}`}>
      {pct.toFixed(1)}%
    </span>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const ProvidersPractice: React.FC = () => {
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate,   setEndDate]   = useState(todayISO());
  const [data,      setData]      = useState<ProvidersPracticeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [hasRun,    setHasRun]    = useState(false);

  const run = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getProvidersPractice({ start_date: startDate, end_date: endDate });
      setData(result);
      setHasRun(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      const msg = e.response?.data?.detail || 'Failed to generate Providers & Practice report';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

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
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-200">
              <Users className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Providers &amp; Practice Report</p>
            <p className="text-xs text-gray-500 max-w-xs">
              Select a date range and click <strong>Run Report</strong> to view provider-level
              performance, revenue, and forward booking metrics.
            </p>
          </div>
        ) : !data || data.providers.length === 0 ? (
          <ReportEmpty message="No provider data found for the selected date range." />
        ) : (
          <>
            <ReportHeader
              title="Providers & Practice"
              description="Provider-level operational and financial performance"
              startDate={data.start_date}
              endDate={data.end_date}
              icon={<Users className="w-5 h-5" />}
              totalBadge={
                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold rounded-full">
                  <Users className="w-3.5 h-3.5" />
                  {data.providers.length} Provider{data.providers.length !== 1 ? 's' : ''}
                </span>
              }
            />

            {/* ── KPI Summary ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard
                label="Total Revenue"
                value={formatPeso(data.summary.total_revenue)}
                color="text-green-700"
                bg="bg-green-50"
                border="border-green-200"
                icon={<DollarSign className="w-4 h-4" />}
              />
              <StatCard
                label="Avg Revenue / Provider"
                value={formatPeso(data.summary.avg_revenue_per_provider)}
                color="text-emerald-700"
                bg="bg-emerald-50"
                border="border-emerald-200"
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <StatCard
                label="Total Consultations"
                value={data.summary.total_consultations}
                color="text-sky-700"
                bg="bg-sky-50"
                border="border-sky-200"
                icon={<BookOpen className="w-4 h-4" />}
              />
              <StatCard
                label="Avg Forward Booking"
                value={`${data.summary.avg_forward_booking_pct.toFixed(1)}%`}
                color="text-violet-700"
                bg="bg-violet-50"
                border="border-violet-200"
                icon={<CalendarDays className="w-4 h-4" />}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <StatCard
                label="Total Appointments"
                value={data.summary.total_appointments}
                color="text-gray-900"
                bg="bg-gray-50"
                border="border-gray-200"
                icon={<CalendarDays className="w-4 h-4" />}
              />
              <StatCard
                label="Completed"
                value={data.summary.total_completed}
                color="text-teal-700"
                bg="bg-teal-50"
                border="border-teal-200"
                icon={<CheckCircle className="w-4 h-4" />}
              />
              <StatCard
                label="Cancelled"
                value={data.summary.total_cancelled}
                color="text-orange-700"
                bg="bg-orange-50"
                border="border-orange-200"
                icon={<XCircle className="w-4 h-4" />}
              />
              <StatCard
                label="No-show (DNA)"
                value={data.summary.total_no_show}
                color="text-red-700"
                bg="bg-red-50"
                border="border-red-200"
                icon={<UserX className="w-4 h-4" />}
              />
            </div>

            {/* ── Provider Comparison Table ── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">Provider Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Provider
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Revenue
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Avg / Appt
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Total Appts
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Consults
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Classes
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Completed
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Cancelled
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        DNA
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-35">
                        Forward Booking
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Avg Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.providers.map((row: ProvidersPracticeRow, idx: number) => (
                      <tr
                        key={row.practitioner_id}
                        className={`border-b border-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                      >
                        {/* Provider name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-blue-600">
                                {row.practitioner_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium text-gray-800 whitespace-nowrap">
                              {row.practitioner_name}
                            </span>
                          </div>
                        </td>

                        {/* Revenue */}
                        <td className="px-4 py-3 text-right font-semibold text-green-700 tabular-nums whitespace-nowrap">
                          {formatPeso(row.revenue)}
                        </td>

                        {/* Avg revenue */}
                        <td className="px-4 py-3 text-right text-gray-600 tabular-nums whitespace-nowrap">
                          {formatPeso(row.avg_revenue_per_appointment)}
                        </td>

                        {/* Total appointments */}
                        <td className="px-4 py-3 text-right font-medium text-gray-800 tabular-nums">
                          {row.total_appointments}
                        </td>

                        {/* Consultations */}
                        <td className="px-4 py-3 text-right text-sky-700 font-medium tabular-nums">
                          {row.consultations}
                        </td>

                        {/* Classes */}
                        <td className="px-4 py-3 text-right text-violet-700 font-medium tabular-nums">
                          {row.classes}
                        </td>

                        {/* Completed */}
                        <td className="px-4 py-3 text-right text-teal-700 tabular-nums">
                          {row.completed_appointments}
                        </td>

                        {/* Cancelled */}
                        <td className="px-4 py-3 text-right text-orange-600 tabular-nums">
                          {row.cancelled_appointments}
                        </td>

                        {/* DNA */}
                        <td className="px-4 py-3 text-right text-red-600 tabular-nums">
                          {row.no_show_appointments}
                        </td>

                        {/* Forward booking % */}
                        <td className="px-4 py-3 min-w-35">
                          <PctBar
                            pct={row.forward_booking_rate}
                            bgClass="bg-violet-400"
                            textClass="text-violet-700"
                          />
                        </td>

                        {/* Avg duration */}
                        <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {row.avg_session_duration_min > 0
                              ? `${row.avg_session_duration_min} min`
                              : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Revenue Bar Chart ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Revenue per provider */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue per Provider</h3>
                {data.providers.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No data</p>
                ) : (() => {
                  const maxRev = Math.max(...data.providers.map((p) => p.revenue), 1);
                  return (
                    <div className="space-y-3">
                      {data.providers.map((p) => (
                        <div key={p.practitioner_id} className="flex items-center gap-3">
                          <span className="text-xs text-gray-600 w-28 truncate shrink-0">
                            {p.practitioner_name}
                          </span>
                          <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                            <div
                              className="h-5 bg-green-400 rounded"
                              style={{ width: `${(p.revenue / maxRev) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-green-700 tabular-nums whitespace-nowrap w-24 text-right">
                            {formatPeso(p.revenue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Forward Booking % per provider */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Forward Booking Rate</h3>
                {data.providers.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No data</p>
                ) : (
                  <div className="space-y-3">
                    {data.providers.map((p) => (
                      <div key={p.practitioner_id} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-28 truncate shrink-0">
                          {p.practitioner_name}
                        </span>
                        <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                          <div
                            className="h-5 bg-violet-400 rounded"
                            style={{ width: `${Math.min(100, p.forward_booking_rate)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-violet-700 tabular-nums w-12 text-right">
                          {p.forward_booking_rate.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Appointment Totals Bar Chart ── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Appointment Mix per Provider
              </h3>
              {data.providers.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No data</p>
              ) : (() => {
                const maxAppts = Math.max(...data.providers.map((p) => p.total_appointments), 1);
                return (
                  <div className="space-y-4">
                    {data.providers.map((p) => {
                      const base = p.total_appointments || 1;
                      return (
                        <div key={p.practitioner_id}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700">
                              {p.practitioner_name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {p.total_appointments} total
                            </span>
                          </div>
                          {/* Stacked bar */}
                          <div
                            className="flex h-4 rounded overflow-hidden bg-gray-100"
                            style={{ width: `${(p.total_appointments / maxAppts) * 100}%` }}
                          >
                            <div
                              className="bg-teal-400"
                              style={{ width: `${(p.completed_appointments / base) * 100}%` }}
                              title={`Completed: ${p.completed_appointments}`}
                            />
                            <div
                              className="bg-orange-400"
                              style={{ width: `${(p.cancelled_appointments / base) * 100}%` }}
                              title={`Cancelled: ${p.cancelled_appointments}`}
                            />
                            <div
                              className="bg-red-400"
                              style={{ width: `${(p.no_show_appointments / base) * 100}%` }}
                              title={`DNA: ${p.no_show_appointments}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {/* Legend */}
                    <div className="flex items-center gap-4 pt-1">
                      <span className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="w-3 h-3 rounded bg-teal-400 inline-block" />
                        Completed
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="w-3 h-3 rounded bg-orange-400 inline-block" />
                        Cancelled
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="w-3 h-3 rounded bg-red-400 inline-block" />
                        DNA
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer meta */}
            <p className="text-xs text-gray-400 text-right">
              Generated {formatDate(data.generated_at.split('T')[0])}
            </p>
          </>
        )}
      </div>
    </div>
  );
};
