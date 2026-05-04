import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { BarChart3, TrendingDown, Users, RefreshCw, ChevronDown } from 'lucide-react';
import { getClinicianPerformance } from '../api/dashboard.api';
import type { ProviderPerformance, ClinicianPerformanceData } from '../types/dashboard.types';
import { useAuth } from '@/hooks/useAuth';

// ── Colour palette ────────────────────────────────────────────────────────────

const PROVIDER_COLORS = [
  '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#EF4444', '#84CC16',
];

// ── Custom tooltip ─────────────────────────────────────────────────────────────

const ChartTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; name: string }>;
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm min-w-35">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500 text-xs">{p.name}:</span>
          <span className="font-bold text-gray-900">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ── Summary card ──────────────────────────────────────────────────────────────

const SummaryCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}> = ({ label, value, sub, color }) => (
  <div className={`rounded-xl border p-3 bg-white`} style={{ borderColor: color + '40' }}>
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className="text-lg font-bold text-gray-900">{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

// ── Date preset buttons ───────────────────────────────────────────────────────

const PRESETS = [
  { label: '7d',  days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

function isoAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days + 1);
  return d.toISOString().slice(0, 10);
}
function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Main component ─────────────────────────────────────────────────────────────

export const ClinicianPerformance: React.FC = () => {
  const { user } = useAuth();
  const isPractitioner = user?.role === 'PRACTITIONER';

  const [data,         setData]         = useState<ClinicianPerformanceData | null>(null);
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [preset,       setPreset]       = useState<number>(30);
  const [selectedPrac, setSelectedPrac] = useState<number | 'all'>('all');
  const [activeChart,  setActiveChart]  = useState<'appointments' | 'revenue' | 'dna'>('appointments');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchData = useCallback(
    async (days: number, pracId?: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          setIsLoading(true);
          setError(null);
          const result = await getClinicianPerformance({
            start_date:      isoAgo(days),
            end_date:        isoToday(),
            practitioner_id: pracId,
          });
          setData(result);
        } catch {
          setError('Failed to load clinician performance data.');
        } finally {
          setIsLoading(false);
        }
      }, 350);
    },
    [],
  );

  // Fetch on mount and when filters change
  React.useEffect(() => {
    fetchData(
      preset,
      !isPractitioner && selectedPrac !== 'all' ? (selectedPrac as number) : undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, selectedPrac]);

  // ── Derive chart datasets ─────────────────────────────────────────────────

  const visibleProviders = useMemo<ProviderPerformance[]>(() => {
    if (!data) return [];
    if (isPractitioner) return data.providers;           // only own data
    if (selectedPrac === 'all') return data.providers;
    return data.providers.filter((p) => p.id === selectedPrac);
  }, [data, isPractitioner, selectedPrac]);

  // Transform to [{date, <provider_name>: value, ...}] for recharts
  const chartRows = useMemo(() => {
    if (!data) return [];
    return data.date_labels.map((date, i) => {
      const row: Record<string, string | number> = { date };
      for (const p of visibleProviders) {
        if (activeChart === 'appointments') row[p.name] = p.appointments[i] ?? 0;
        if (activeChart === 'revenue')      row[p.name] = p.revenue[i] ?? 0;
        if (activeChart === 'dna')          row[p.name] = p.dna_rate[i] ?? 0;
      }
      return row;
    });
  }, [data, visibleProviders, activeChart]);

  // Revenue bar chart — one bar per provider
  const revenueBarData = useMemo(
    () =>
      visibleProviders.map((p, i) => ({
        name:    p.name.split(' ').pop() ?? p.name,   // last name only for brevity
        revenue: p.total_revenue,
        color:   PROVIDER_COLORS[i % PROVIDER_COLORS.length],
      })),
    [visibleProviders],
  );

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading && !data) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-2/5 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-1/2 mb-6" />
        <div className="h-70 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 flex flex-col items-center gap-3">
        <BarChart3 className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={() => fetchData(preset)}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  const isEmpty = !data || data.providers.length === 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h2 className="text-base font-bold text-gray-900 leading-tight">
            Clinician Performance
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {isPractitioner
              ? 'Your performance metrics'
              : 'Appointments, revenue, and DNA rate by provider'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData(preset)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-violet-500" />
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {/* Date preset */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => setPreset(p.days)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                preset === p.days
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Provider dropdown (Admin/Staff only) */}
        {!isPractitioner && data && data.providers.length > 1 && (
          <div className="relative">
            <select
              value={selectedPrac === 'all' ? 'all' : String(selectedPrac)}
              onChange={(e) =>
                setSelectedPrac(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="appearance-none bg-white border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 text-xs text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              <option value="all">All Providers</option>
              {data.providers.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}

        {/* Chart type switcher */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 ml-auto">
          {(['appointments', 'revenue', 'dna'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveChart(t)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                activeChart === t
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'dna' ? 'DNA %' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary cards ── */}
      {!isEmpty && visibleProviders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          {visibleProviders.slice(0, 4).map((p, i) => (
            <SummaryCard
              key={p.id}
              label={p.name.split(' ').pop() ?? p.name}
              value={
                activeChart === 'appointments'
                  ? p.total_appointments
                  : activeChart === 'revenue'
                  ? `₱${p.total_revenue.toLocaleString()}`
                  : `${p.overall_dna_rate}%`
              }
              sub={
                activeChart === 'appointments'
                  ? `${p.total_dna} DNA`
                  : activeChart === 'revenue'
                  ? `${p.total_appointments} appts`
                  : `${p.total_dna} DNA of ${p.total_appointments}`
              }
              color={PROVIDER_COLORS[i % PROVIDER_COLORS.length]}
            />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-400">No performance data for this period</p>
        </div>
      )}

      {/* ── Line chart: Appointments / DNA % over time ── */}
      {!isEmpty && (activeChart === 'appointments' || activeChart === 'dna') && (
        <div className="h-55 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartRows} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: string) => v.slice(5)}   // MM-DD
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={activeChart === 'dna'}
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                unit={activeChart === 'dna' ? '%' : ''}
              />
              <Tooltip content={<ChartTooltip />} />
              {visibleProviders.length > 1 && (
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="circle"
                  iconSize={8}
                />
              )}
              {visibleProviders.map((p, i) => (
                <Line
                  key={p.id}
                  type="monotone"
                  dataKey={p.name}
                  stroke={PROVIDER_COLORS[i % PROVIDER_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Bar chart: Revenue per provider ── */}
      {!isEmpty && activeChart === 'revenue' && (
        <div className="h-55 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={revenueBarData}
              margin={{ top: 4, right: 8, left: -10, bottom: 0 }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `₱${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number | undefined) => [`₱${(value ?? 0).toLocaleString()}`, 'Revenue']}
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {revenueBarData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── DNA rate note ── */}
      {!isEmpty && activeChart === 'dna' && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 shrink-0">
          <TrendingDown className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">
            DNA = Did Not Arrive. Lower is better. Shown as % of daily appointments.
          </p>
        </div>
      )}
    </div>
  );
};
