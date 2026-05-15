import { useState, useEffect, useCallback } from 'react';
import {
  Mail, MessageSquare, Check, X, Loader2, Clock,
  ChevronLeft, ChevronRight, ChevronDown, Search, Send, Reply,
  Building2, AlertCircle, Inbox,
} from 'lucide-react';
import {
  communicationApi,
  type CommunicationLogEntry,
  type CommunicationLogSummary,
} from '../../services/communication.api';

const PAGE_SIZE = 20;

// ── Helpers ────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].charAt(0).toUpperCase()
    : (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const mins = Math.floor((now.getTime() - date.getTime()) / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFull(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Patient Group ──────────────────────────────────────────────────────────
type PatientGroup = {
  key: string;
  patientName: string;
  logs: CommunicationLogEntry[];
};

function groupByPatient(logs: CommunicationLogEntry[]): PatientGroup[] {
  const map = new Map<string, PatientGroup>();
  for (const log of logs) {
    const key = log.patient != null ? String(log.patient) : `name:${log.patient_name}`;
    if (!map.has(key)) {
      map.set(key, { key, patientName: log.patient_name || 'Unknown Patient', logs: [] });
    }
    map.get(key)!.logs.push(log);
  }
  return Array.from(map.values());
}

// ── Avatar ─────────────────────────────────────────────────────────────────
const AVATAR_PALETTE = [
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-indigo-100 text-indigo-700',
];

function avatarColor(name: string) {
  const n = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length];
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = { sm: 'w-6 h-6 text-[10px]', md: 'w-8 h-8 text-[11px]', lg: 'w-10 h-10 text-[13px]' };
  return (
    <div className={`rounded-full flex items-center justify-center font-bold shrink-0 ${sizeMap[size]} ${avatarColor(name)}`}>
      {getInitials(name)}
    </div>
  );
}

// ── Status Pill ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { dot: string; pill: string; label: string }> = {
  SENT:      { dot: 'bg-sky-400',     pill: 'bg-sky-50 border-sky-200 text-sky-700',             label: 'Sent' },
  DELIVERED: { dot: 'bg-emerald-400', pill: 'bg-emerald-50 border-emerald-200 text-emerald-700', label: 'Delivered' },
  FAILED:    { dot: 'bg-red-400',     pill: 'bg-red-50 border-red-200 text-red-700',             label: 'Failed' },
  REPLIED:   { dot: 'bg-violet-400',  pill: 'bg-violet-50 border-violet-200 text-violet-700',   label: 'Replied' },
};

function StatusPill({ status }: { status: string }) {
  const c = STATUS_CFG[status] || STATUS_CFG.SENT;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full border ${c.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ── Type Chip ──────────────────────────────────────────────────────────────
const TYPE_CFG: Record<string, { bg: string; label: string }> = {
  BOOKING_CONFIRMATION:   { bg: 'bg-emerald-100 text-emerald-700', label: 'Booking' },
  RECURRING_CONFIRMATION: { bg: 'bg-teal-100 text-teal-700',       label: 'Recurring' },
  APPOINTMENT_REMINDER:   { bg: 'bg-amber-100 text-amber-700',     label: 'Reminder' },
  DNA_FOLLOWUP:           { bg: 'bg-red-100 text-red-700',          label: 'DNA' },
  REBOOK_FOLLOWUP:        { bg: 'bg-violet-100 text-violet-700',   label: 'Rebook' },
  INACTIVE_CHECKIN:       { bg: 'bg-pink-100 text-pink-700',        label: 'Check-in' },
  CANCELLATION_NOTICE:    { bg: 'bg-gray-100 text-gray-600',        label: 'Cancelled' },
};

function TypeChip({ type }: { type: string }) {
  const c = TYPE_CFG[type] || { bg: 'bg-gray-100 text-gray-600', label: type };
  return (
    <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${c.bg}`}>
      {c.label}
    </span>
  );
}

// ── Delivery Timeline ──────────────────────────────────────────────────────
const TIMELINE_STEPS = [
  { key: 'SENT',      label: 'Sent',      Icon: Send },
  { key: 'DELIVERED', label: 'Delivered', Icon: Check },
  { key: 'REPLIED',   label: 'Replied',   Icon: Reply },
];
const STEP_ORDER: Record<string, number> = { SENT: 1, DELIVERED: 2, REPLIED: 3 };

function DeliveryTimeline({ status, channel }: { status: string; channel: string }) {
  const failed = status === 'FAILED';
  const level = failed ? 0 : (STEP_ORDER[status] ?? 1);

  return (
    <div className="flex items-center">
      {TIMELINE_STEPS.map((step, i) => {
        const reached = !failed && level > i;
        const current = !failed && level === i + 1;
        const stepLabel = i === 1 && channel === 'SMS' ? 'Received' : step.label;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                  failed && i === 0
                    ? 'bg-red-100 text-red-500'
                    : reached || current
                      ? 'bg-sky-500 text-white'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {failed && i === 0
                  ? <X className="w-3.5 h-3.5" />
                  : <step.Icon className="w-3.5 h-3.5" />
                }
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${
                failed && i === 0 ? 'text-red-500' : reached || current ? 'text-sky-600' : 'text-gray-400'
              }`}>
                {failed && i === 0 ? 'Failed' : stepLabel}
              </span>
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <div className={`w-14 h-px mb-5 ${!failed && level > i + 1 ? 'bg-sky-200' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Skeleton List Item ─────────────────────────────────────────────────────
function SkeletonItem() {
  return (
    <div className="px-4 py-3.5 border-b border-gray-50 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="flex justify-between gap-3">
            <div className="h-3 w-28 bg-gray-200 rounded" />
            <div className="h-3 w-8 bg-gray-200 rounded" />
          </div>
          <div className="h-2.5 w-4/5 bg-gray-200 rounded" />
          <div className="flex gap-2">
            <div className="h-4 w-12 bg-gray-200 rounded" />
            <div className="h-4 w-10 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty States ───────────────────────────────────────────────────────────
function EmptyThread() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
        <Inbox className="w-6 h-6 text-gray-400" />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-gray-700 mb-1">No conversation selected</p>
        <p className="text-[12px] text-gray-400 leading-relaxed max-w-48">
          Select a message from the list to view the full conversation thread and delivery details.
        </p>
      </div>
    </div>
  );
}

function EmptyList() {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
        <Send className="w-5 h-5 text-gray-400" />
      </div>
      <p className="text-[13px] font-semibold text-gray-700">No communications found</p>
      <p className="text-[12px] text-gray-400">Adjust your filters to see results.</p>
    </div>
  );
}

// ── Patient Group Item ────────────────────────────────────────────────────
function PatientGroupItem({
  group, selectedId, onSelect,
}: {
  group: PatientGroup;
  selectedId: number | null;
  onSelect: (log: CommunicationLogEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasSelected = group.logs.some(l => l.id === selectedId);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      {/* Patient header — toggle button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`
          w-full flex items-center gap-2.5 px-4 py-3
          hover:bg-gray-50/70 transition-colors text-left
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-inset focus-visible:ring-sky-500
          ${hasSelected ? 'bg-sky-50/40' : ''}
        `}
      >
        <Avatar name={group.patientName} />
        <span className="text-[13px] font-semibold text-gray-800 truncate flex-1">
          {group.patientName}
        </span>
        <span className="text-[10px] font-medium text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5 shrink-0">
          {group.logs.length}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform duration-150 ${
            open ? 'rotate-0' : '-rotate-90'
          }`}
        />
      </button>

      {/* Message sub-rows — only when open */}
      {open && (
        <div className="pb-1.5 bg-gray-50/30">
          {group.logs.map(log => {
            const isSelected = selectedId === log.id;
            return (
              <button
                key={log.id}
                type="button"
                onClick={() => onSelect(log)}
                className={`
                  w-full text-left pl-14 pr-3 py-2 border-l-2
                  flex items-center gap-1.5 transition-colors
                  focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-inset focus-visible:ring-sky-500
                  ${isSelected
                    ? 'bg-sky-50/80 border-l-sky-500'
                    : 'hover:bg-gray-50/70 border-l-transparent'
                  }
                `}
              >
                <TypeChip type={log.comm_type} />
                {log.channel === 'SMS'
                  ? <MessageSquare className="w-3 h-3 text-amber-400 shrink-0" />
                  : <Mail className="w-3 h-3 text-sky-400 shrink-0" />
                }
                <span className="text-[11px] text-gray-500 truncate flex-1 mx-0.5">
                  {log.subject || log.comm_type_display}
                </span>
                <StatusPill status={log.status} />
                <span className="text-[10px] text-gray-400 shrink-0 ml-1">
                  {formatRelative(log.created_at)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Thread View ────────────────────────────────────────────────────────────
function ThreadView({ log }: { log: CommunicationLogEntry }) {
  const replied   = Boolean(log.patient_reply);
  const confirmed = log.patient_reply === 'Y';
  const declined  = log.patient_reply === 'N';
  const isPending = !replied && (log.status === 'SENT' || log.status === 'DELIVERED');

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-start gap-3.5">
          <Avatar name={log.patient_name || '?'} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-gray-900 truncate">
                  {log.patient_name || 'Unknown Patient'}
                </h2>
                <p className="text-[12px] text-gray-500 mt-0.5 font-mono truncate">{log.recipient}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusPill status={log.status} />
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border ${
                  log.channel === 'SMS'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-sky-50 border-sky-200 text-sky-700'
                }`}>
                  {log.channel === 'SMS'
                    ? <MessageSquare className="w-3 h-3" />
                    : <Mail className="w-3 h-3" />
                  }
                  {log.channel}
                </span>
              </div>
            </div>
            {log.subject && (
              <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                <p className="text-[13px] font-semibold text-gray-800">{log.subject}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {log.comm_type_display} · {formatFull(log.created_at)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 bg-gray-50/30">

        {/* 1. Outbound message */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-linear-to-br from-sky-500 to-sky-700 flex items-center justify-center shrink-0">
              <Building2 className="w-3 h-3 text-white" />
            </div>
            <span className="text-[12px] font-semibold text-gray-700">Malasakit PMS</span>
            <span className="text-[11px] text-gray-400">→ {log.recipient}</span>
            <span className="text-[11px] text-gray-400 ml-auto">{formatFull(log.created_at)}</span>
          </div>
          <div className="ml-8 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-4 py-3.5">
              {log.body_preview
                ? <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-line">{log.body_preview}</p>
                : <p className="text-[13px] text-gray-400 italic">No preview available.</p>
              }
            </div>
          </div>
          {log.error_message && (
            <div className="ml-8 mt-2.5 flex items-start gap-2 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-px" />
              <p className="text-[12px] text-red-600 leading-relaxed">{log.error_message}</p>
            </div>
          )}
        </div>

        {/* 2. Delivery timeline */}
        <div className="ml-8">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Delivery
          </p>
          <DeliveryTimeline status={log.status} channel={log.channel} />
        </div>

        {/* 3. Patient reply */}
        {replied && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Avatar name={log.patient_name || '?'} size="sm" />
              <span className="text-[12px] font-semibold text-gray-700">
                {log.patient_name || 'Patient'}
              </span>
              <span className="text-[11px] text-gray-400">replied</span>
              {log.replied_at && (
                <span className="text-[11px] text-gray-400 ml-auto">{formatFull(log.replied_at)}</span>
              )}
            </div>
            <div className={`ml-8 rounded-xl border p-4 ${
              confirmed ? 'bg-emerald-50 border-emerald-200'
              : declined ? 'bg-red-50 border-red-200'
              : 'bg-gray-50 border-gray-200'
            }`}>
              {confirmed && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-emerald-800">Appointment Confirmed</p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">Patient confirmed their attendance</p>
                  </div>
                </div>
              )}
              {declined && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                    <X className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-red-800">Cannot Attend</p>
                    <p className="text-[11px] text-red-600 mt-0.5">Patient declined — a reschedule follow-up will be sent</p>
                  </div>
                </div>
              )}
              {!confirmed && !declined && (
                <p className="text-[13px] text-gray-700">
                  Replied: <span className="font-semibold">&quot;{log.patient_reply}&quot;</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* 4. Awaiting reply */}
        {isPending && (
          <div className="ml-8">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-[12px] text-amber-700 font-medium">Awaiting patient response</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({
  label, value, iconBg, valueCls, Icon,
}: {
  label: string;
  value: number;
  iconBg: string;
  valueCls: string;
  Icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className={`text-xl font-bold leading-none ${valueCls}`}>{value.toLocaleString()}</p>
        <p className="text-[11px] text-gray-500 mt-0.5 font-medium">{label}</p>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function CommunicationLogs() {
  const [logs, setLogs]         = useState<CommunicationLogEntry[]>([]);
  const [summary, setSummary]   = useState<CommunicationLogSummary | null>(null);
  const [loading, setLoading]   = useState(true);
  const [totalCount, setTotal]  = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [typeFilter, setType]   = useState('');
  const [channelFilter, setCh]  = useState('');
  const [statusFilter, setStat] = useState('');
  const [selected, setSelected] = useState<CommunicationLogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page };
      if (search)        params.search    = search;
      if (typeFilter)    params.comm_type = typeFilter;
      if (channelFilter) params.channel   = channelFilter;
      if (statusFilter)  params.status    = statusFilter;

      const [logsData, summaryData] = await Promise.all([
        communicationApi.getLogs(params),
        page === 1 ? communicationApi.getLogSummary() : Promise.resolve(null),
      ]);

      setLogs(logsData.results);
      setTotal(logsData.count);
      if (summaryData) setSummary(summaryData);
    } catch {
      // silently handled
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, channelFilter, statusFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
    setSelected(null);
  }, [search, typeFilter, channelFilter, statusFilter]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-5 pl-4">
      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
          <Send className="w-4 h-4 text-sky-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Communication Logs</h2>
          <p className="text-sm text-gray-500">
            Track all automated patient communications sent by the system.
          </p>
        </div>
      </div>

      {/* ── Stats bar ── */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Total Sent" value={summary.stats.total}
            iconBg="bg-sky-50 text-sky-600"         valueCls="text-gray-900"    Icon={Send}  />
          <StatCard label="Delivered"  value={summary.stats.sent}
            iconBg="bg-emerald-50 text-emerald-600" valueCls="text-emerald-700" Icon={Check} />
          <StatCard label="Failed"     value={summary.stats.failed}
            iconBg="bg-red-50 text-red-500"         valueCls="text-red-600"     Icon={X}     />
          <StatCard label="Replied"    value={summary.stats.replied}
            iconBg="bg-violet-50 text-violet-600"   valueCls="text-violet-700"  Icon={Reply} />
        </div>
      )}

      {/* ── Workspace split panel ── */}
      <div
        className="flex rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm"
        style={{ height: 'calc(100vh - 230px)' }}
      >
        {/* ── LEFT: List panel ── */}
        <div className="w-80 xl:w-96 shrink-0 flex flex-col border-r border-gray-100">

          {/* Filter toolbar */}
          <div className="px-3 py-3 space-y-2 bg-gray-50/60 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search patients, subjects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-[13px] bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>
            <div className="flex gap-1.5">
              <select
                value={typeFilter}
                onChange={(e) => setType(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              >
                <option value="">All Types</option>
                <option value="BOOKING_CONFIRMATION">Booking</option>
                <option value="RECURRING_CONFIRMATION">Recurring</option>
                <option value="APPOINTMENT_REMINDER">Reminder</option>
                <option value="DNA_FOLLOWUP">DNA</option>
                <option value="REBOOK_FOLLOWUP">Rebook</option>
                <option value="INACTIVE_CHECKIN">Check-in</option>
              </select>
              <select
                value={channelFilter}
                onChange={(e) => setCh(e.target.value)}
                className="w-24 px-2 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              >
                <option value="">Channel</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStat(e.target.value)}
                className="w-24 px-2 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              >
                <option value="">Status</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
                <option value="DELIVERED">Delivered</option>
                <option value="REPLIED">Replied</option>
              </select>
            </div>
          </div>

          {/* Count bar */}
          <div className="px-4 py-2 border-b border-gray-100 bg-white shrink-0">
            {loading ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading…
              </span>
            ) : (
              <span className="text-[11px] text-gray-500">
                {totalCount.toLocaleString()} message{totalCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto">
            {loading
              ? Array.from({ length: 7 }).map((_, i) => <SkeletonItem key={i} />)
              : logs.length === 0
                ? <EmptyList />
                : groupByPatient(logs).map(group => (
                    <PatientGroupItem
                      key={group.key}
                      group={group}
                      selectedId={selected?.id ?? null}
                      onSelect={(log) => setSelected(prev => prev?.id === log.id ? null : log)}
                    />
                  ))
            }
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-white shrink-0">
              <span className="text-[11px] text-gray-500">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <span className="text-[11px] text-gray-500 px-1.5">{page}/{totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Thread panel ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/20">
          {selected
            ? <ThreadView log={selected} key={selected.id} />
            : <EmptyThread />
          }
        </div>
      </div>
    </div>
  );
}
