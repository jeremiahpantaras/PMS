import React, { useState, useCallback } from 'react';
import {
  DollarSign, CalendarDays, UserPlus, Users,
  TrendingUp, XCircle, UserX,
} from 'lucide-react';
import {
  getBusinessPerformance,
  type BusinessPerformanceResponse,
  type BusinessRevenueTrendPoint,
  type BusinessAppointmentTrendPoint,
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

const RateBar: React.FC<{ pct: number; color: string; bgColor: string }> = ({
  pct, color, bgColor,
}) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-2 rounded-full ${bgColor}`}
        style={{ width: `${Math.min(100, pct).toFixed(1)}%` }}
      />
    </div>
    <span className={`text-xs font-semibold w-12 text-right ${color}`}>
      {pct.toFixed(1)}%
    </span>
  </div>
);

// ─── Mini sparkline bar chart ─────────────────────────────────────────────────

const SparkBars: React.FC<{
  points: { date: string; value: number }[];
  color:  string;
}> = ({ points, color }) => {
  if (!points.length) return <p className="text-xs text-gray-400 italic">No data</p>;
  const maxVal = Math.max(...points.map((p) => p.value), 1);
  return (
    <div className="flex items-end gap-0.5 h-16">
      {points.map((pt) => (
        <div
          key={pt.date}
          title={`${formatDate(pt.date)}: ${pt.value}`}
          className={`flex-1 rounded-t ${color} min-w-0.5`}
          style={{ height: `${(pt.value / maxVal) * 100}%` }}
        />
      ))}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const BusinessPerformance: React.FC = () => {
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate,   setEndDate]   = useState(todayISO());
  const [data,      setData]      = useState<BusinessPerformanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [hasRun,    setHasRun]    = useState(false);

  const run = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getBusinessPerformance({ start_date: startDate, end_date: endDate });
      setData(result);
      setHasRun(true);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to generate Business Performance report';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  const revenuePts = (data?.revenue_trend ?? []).map((p: BusinessRevenueTrendPoint) => ({
    date: p.date, value: p.revenue,
  }));
  const apptPts = (data?.appointment_trend ?? []).map((p: BusinessAppointmentTrendPoint) => ({
    date: p.date, value: p.count,
  }));

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
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Business Performance Report</p>
            <p className="text-xs text-gray-500 max-w-xs">
              Select a date range and click <strong>Run Report</strong> to view KPIs, revenue,
              and provider comparison.
            </p>
          </div>
        ) : !data || data.summary.total_appointments === 0 ? (
          <ReportEmpty message="No appointment data found for the selected date range." />
        ) : (
          <>
            <ReportHeader
              title="Business Performance"
              description="Clinic KPIs, revenue trends, and provider comparison"
              startDate={data.start_date}
              endDate={data.end_date}
              icon={<TrendingUp className="w-5 h-5" />}
              totalBadge={
                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold rounded-full">
                  <DollarSign className="w-3.5 h-3.5" />
                  {formatPeso(data.summary.total_revenue)}
                </span>
              }
            />

            {/* KPI grid */}
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
                label="Total Appointments"
                value={data.summary.total_appointments}
                color="text-sky-700"
                bg="bg-sky-50"
                border="border-sky-200"
                icon={<CalendarDays className="w-4 h-4" />}
              />
              <StatCard
                label="Cancellation Rate"
                value={`${data.summary.cancellation_rate.toFixed(1)}%`}
                color="text-orange-700"
                bg="bg-orange-50"
                border="border-orange-200"
                icon={<XCircle className="w-4 h-4" />}
              />
              <StatCard
                label="No-show (DNA) Rate"
                value={`${data.summary.no_show_rate.toFixed(1)}%`}
                color="text-red-700"
                bg="bg-red-50"
                border="border-red-200"
                icon={<UserX className="w-4 h-4" />}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard
                label="Completed Appts"
                value={data.summary.completed_appointments}
                color="text-gray-900"
                bg="bg-gray-50"
                border="border-gray-200"
                icon={<CalendarDays className="w-4 h-4" />}
              />
              <StatCard
                label="Avg Revenue / Appt"
                value={formatPeso(data.summary.avg_revenue_per_appointment)}
                color="text-emerald-700"
                bg="bg-emerald-50"
                border="border-emerald-200"
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <StatCard
                label="New Clients"
                value={data.summary.new_clients}
                color="text-violet-700"
                bg="bg-violet-50"
                border="border-violet-200"
                icon={<UserPlus className="w-4 h-4" />}
              />
              <StatCard
                label="Returning Clients"
                value={data.summary.returning_clients}
                color="text-indigo-700"
                bg="bg-indigo-50"
                border="border-indigo-200"
                icon={<Users className="w-4 h-4" />}
              />
            </div>

            {/* Sparkline charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  Revenue Trend
                </h3>
                <SparkBars points={revenuePts} color="bg-green-400" />
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-gray-400">{formatDate(data.start_date)}</span>
                  <span className="text-xs text-gray-400">{formatDate(data.end_date)}</span>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-sky-500" />
                  Appointment Trend
                </h3>
                <SparkBars points={apptPts} color="bg-sky-400" />
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-gray-400">{formatDate(data.start_date)}</span>
                  <span className="text-xs text-gray-400">{formatDate(data.end_date)}</span>
                </div>
              </div>
            </div>

            {/* Provider comparison table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">Provider Comparison</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                      <th className="px-4 py-3 text-left font-semibold">Practitioner</th>
                      <th className="px-4 py-3 text-right font-semibold">Appts</th>
                      <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                      <th className="px-4 py-3 text-right font-semibold">Rev / Appt</th>
                      <th className="px-4 py-3 font-semibold min-w-40">Cancel Rate</th>
                      <th className="px-4 py-3 font-semibold min-w-40">DNA Rate</th>
                      <th className="px-4 py-3 text-right font-semibold">New</th>
                      <th className="px-4 py-3 text-right font-semibold">Returning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.practitioners.map((row, idx) => (
                      <tr
                        key={row.practitioner_id}
                        className={`border-t border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{row.practitioner_name}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{row.total_appointments}</td>
                        <td className="px-4 py-3 text-right text-green-700 font-semibold">
                          {formatPeso(row.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {formatPeso(row.revenue_per_appointment)}
                        </td>
                        <td className="px-4 py-3">
                          <RateBar
                            pct={row.cancellation_rate}
                            color="text-orange-600"
                            bgColor="bg-orange-400"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <RateBar
                            pct={row.no_show_rate}
                            color="text-red-600"
                            bgColor="bg-red-400"
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-violet-700">{row.new_clients}</td>
                        <td className="px-4 py-3 text-right text-indigo-700">{row.returning_clients}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
