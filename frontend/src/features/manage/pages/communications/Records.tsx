import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail, MessageSquare, TrendingUp, AlertCircle, Clock,
  Search, Filter, X, RefreshCw, LayoutList, List,
  Calendar, ChevronDown, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  communicationRecordsApi,
  type CommunicationLog,
  type TodayStats,
  type CommFilters,
  type CommType,
  type CommChannel,
  type CommStatus,
} from '../../services/communications.api';
import { CommunicationTable }       from './CommunicationTable';
import { CommunicationTimeline }     from './CommunicationTimeline';
import { CommunicationDetailModal }  from './CommunicationDetailModal';
import { usePermissions }            from '@/hooks/usePermissions';

// ── Constants ─────────────────────────────────────────────────────────────────

const COMM_TYPE_OPTIONS: { value: CommType | ''; label: string }[] = [
  { value: '',                     label: 'All Types' },
  { value: 'APPOINTMENT_REMINDER', label: 'Appointment Reminder' },
  { value: 'BOOKING_CONFIRMATION', label: 'Booking Confirmation' },
  { value: 'RECURRING_CONFIRMATION', label: 'Recurring Confirmation' },
  { value: 'CANCELLATION_NOTICE',  label: 'Cancellation Notice' },
  { value: 'DNA_FOLLOWUP',         label: 'DNA Follow-up' },
  { value: 'REBOOK_FOLLOWUP',      label: 'No-Rebook Follow-up' },
  { value: 'INACTIVE_CHECKIN',     label: 'Inactive Patient Check-in' },
  { value: 'CLINICAL_NOTE',        label: 'Clinical Note Email' },
  { value: 'OTP_VERIFICATION',     label: 'OTP Verification' },
  { value: 'PASSWORD_RESET',       label: 'Password Reset' },
  { value: 'INVOICE_EMAIL',        label: 'Invoice Email' },
  { value: 'RESCHEDULE_FOLLOWUP',  label: 'Reschedule Follow-up' },
  { value: 'SYSTEM_NOTIFICATION',  label: 'System Notification' },
];

const STATUS_OPTIONS: { value: CommStatus | ''; label: string }[] = [
  { value: '',          label: 'All Statuses' },
  { value: 'QUEUED',    label: 'Queued' },
  { value: 'SENT',      label: 'Sent' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'OPENED',    label: 'Opened' },
  { value: 'REPLIED',   label: 'Replied' },
  { value: 'FAILED',    label: 'Failed' },
  { value: 'BOUNCED',   label: 'Bounced' },
  { value: 'PENDING',   label: 'Pending' },
];

const CHANNEL_OPTIONS: { value: CommChannel | ''; label: string }[] = [
  { value: '',      label: 'All Channels' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS',   label: 'SMS' },
];

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  trend?: 'up' | 'down' | 'neutral';
  isLoading?: boolean;
}

function StatCard({ label, value, sub, icon, iconBg, isLoading }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        {isLoading ? (
          <div className="h-6 w-16 bg-gray-100 rounded animate-pulse mb-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        )}
        <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const Records: React.FC = () => {
  const { canEdit } = usePermissions();
  void canEdit; // permissions forwarded to child modal via its own hook

  // View mode
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('table');

  // Stats
  const [stats, setStats]         = useState<TodayStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Logs
  const [logs, setLogs]           = useState<CommunicationLog[]>([]);
  const [total, setTotal]         = useState(0);
  const [logsLoading, setLogsLoading] = useState(true);
  const [page, setPage]           = useState(1);
  const PAGE_SIZE = 25;

  // Filters
  const [search, setSearch]       = useState('');
  const [commType, setCommType]   = useState<CommType | ''>('');
  const [channel, setChannel]     = useState<CommChannel | ''>('');
  const [status, setStatus]       = useState<CommStatus | ''>('');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Detail modal
  const [selectedLog, setSelectedLog] = useState<CommunicationLog | null>(null);

  // Keep latest search value accessible inside loadLogs without adding search
  // to loadLogs' useCallback deps (prevents double-fire with debounce effect).
  const searchRef  = useRef(search);
  useEffect(() => { searchRef.current = search; }, [search]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load stats ──────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await communicationRecordsApi.todayStats();
      setStats(data);
    } catch {
      // silently fail stats
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── Load logs ───────────────────────────────────────────────────────────────
  const loadLogs = useCallback(async (p = 1) => {
    setLogsLoading(true);
    try {
      const filters: CommFilters = {
        page:      p,
        page_size: PAGE_SIZE,
      };
      const s = searchRef.current;
      if (s)        filters.search    = s;
      if (commType) filters.comm_type = commType;
      if (channel)  filters.channel   = channel;
      if (status)   filters.status    = status;
      if (dateFrom) filters.date_from = dateFrom;
      if (dateTo)   filters.date_to   = dateTo;

      const res = await communicationRecordsApi.list(filters);
      setLogs(res.results);
      setTotal(res.count);
      setPage(p);
    } catch {
      toast.error('Failed to load communication records');
    } finally {
      setLogsLoading(false);
    }
  }, [commType, channel, status, dateFrom, dateTo]);

  // Initial load
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadLogs(1); }, [loadLogs]);

  // Debounced search (fires after 350 ms idle; loadLogs reads search via ref)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadLogs(1), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, loadLogs]);

  // ── Realtime: poll for active-view updates every 30s ───────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      loadStats();
      if (page === 1) loadLogs(1);
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadStats, loadLogs, page]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleResend(log: CommunicationLog) {
    toast.promise(
      communicationRecordsApi.resend(log.id).then(() => {
        loadLogs(page);
        loadStats();
      }),
      {
        loading: 'Re-queuing…',
        success: 'Communication re-queued for resending',
        error:   'Failed to resend',
      },
    );
  }

  function handleUpdated(updated: CommunicationLog) {
    setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    loadStats();
  }

  function clearFilters() {
    setSearch('');
    setCommType('');
    setChannel('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
  }

  const hasActiveFilters = search || commType || channel || status || dateFrom || dateTo;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5 max-w-7xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Communication Records</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Audit-ready history of all patient communications
          </p>
        </div>
        <button
          onClick={() => { loadLogs(page); loadStats(); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Emails Sent Today"
          value={stats?.emails_sent_today ?? 0}
          icon={<Mail className="w-5 h-5 text-sky-600" />}
          iconBg="bg-sky-50"
          isLoading={statsLoading}
        />
        <StatCard
          label="Delivery Rate"
          value={stats ? `${stats.delivery_rate}%` : '—'}
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          isLoading={statsLoading}
        />
        <StatCard
          label="Replies Received"
          value={stats?.replies_received ?? 0}
          icon={<MessageSquare className="w-5 h-5 text-violet-600" />}
          iconBg="bg-violet-50"
          isLoading={statsLoading}
        />
        <StatCard
          label="Failed Deliveries"
          value={stats?.failed_deliveries ?? 0}
          icon={<AlertCircle className="w-5 h-5 text-red-500" />}
          iconBg="bg-red-50"
          isLoading={statsLoading}
        />
        <StatCard
          label="Pending Responses"
          value={stats?.pending_responses ?? 0}
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          iconBg="bg-amber-50"
          isLoading={statsLoading}
        />
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">

        {/* Row 1: search + view toggle + filter toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-50">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient, email, or subject…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View mode */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1 shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'table' ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              Table
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'timeline' ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Timeline
            </button>
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors shrink-0 ${
              showFilters
                ? 'bg-sky-50 border-sky-200 text-sky-700'
                : hasActiveFilters
                ? 'bg-orange-50 border-orange-200 text-orange-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-4 h-4 rounded-full bg-sky-500 text-white text-xs flex items-center justify-center">
                !
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Row 2: expanded filters */}
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
            <select
              value={commType}
              onChange={(e) => setCommType(e.target.value as CommType | '')}
              className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-gray-700"
            >
              {COMM_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CommStatus | '')}
              className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-gray-700"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as CommChannel | '')}
              className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-gray-700"
            >
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 px-2 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-gray-700"
                title="From date"
              />
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 px-2 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300 text-gray-700"
                title="To date"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
              <span>{total} result{total !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {viewMode === 'table' ? (
        <CommunicationTable
          logs={logs}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={(p) => loadLogs(p)}
          onView={(log) => setSelectedLog(log)}
          onResend={handleResend}
          isLoading={logsLoading}
        />
      ) : (
        <CommunicationTimeline
          logs={logs}
          onView={(log) => setSelectedLog(log)}
          onResend={handleResend}
          isLoading={logsLoading}
        />
      )}

      {/* ── Detail modal ─────────────────────────────────────────────────── */}
      <CommunicationDetailModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        onResend={(log) => {
          setSelectedLog(null);
          handleResend(log);
        }}
        onUpdated={handleUpdated}
      />
    </div>
  );
};
