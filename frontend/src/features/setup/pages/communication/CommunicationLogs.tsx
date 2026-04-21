import { useState, useEffect, useCallback } from 'react';
import {
  Mail, MessageSquare, Check, X, Loader2, Clock,
  ChevronLeft, ChevronRight, Search, Send, Reply,
} from 'lucide-react';
import {
  communicationApi,
  type CommunicationLogEntry,
  type CommunicationLogSummary,
} from '../../services/communication.api';

// ── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    SENT: {
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-700',
      icon: <Check className="w-3 h-3" />,
    },
    FAILED: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-700',
      icon: <X className="w-3 h-3" />,
    },
    DELIVERED: {
      bg: 'bg-blue-50 border-blue-200',
      text: 'text-blue-700',
      icon: <Send className="w-3 h-3" />,
    },
    REPLIED: {
      bg: 'bg-violet-50 border-violet-200',
      text: 'text-violet-700',
      icon: <Reply className="w-3 h-3" />,
    },
  };

  const c = config[status] || config.SENT;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border ${c.bg} ${c.text}`}>
      {c.icon}
      {status}
    </span>
  );
}

// ── Channel badge ──────────────────────────────────────────────────────────
function ChannelBadge({ channel }: { channel: string }) {
  if (channel === 'SMS') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        <MessageSquare className="w-3 h-3" />
        SMS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">
      <Mail className="w-3 h-3" />
      Email
    </span>
  );
}

// ── Type badge ─────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  BOOKING_CONFIRMATION: 'bg-emerald-100 text-emerald-800',
  RECURRING_CONFIRMATION: 'bg-teal-100 text-teal-800',
  APPOINTMENT_REMINDER: 'bg-amber-100 text-amber-800',
  DNA_FOLLOWUP: 'bg-red-100 text-red-800',
  REBOOK_FOLLOWUP: 'bg-violet-100 text-violet-800',
  INACTIVE_CHECKIN: 'bg-pink-100 text-pink-800',
  CANCELLATION_NOTICE: 'bg-gray-100 text-gray-800',
};

function TypeBadge({ type, display }: { type: string; display: string }) {
  const color = TYPE_COLORS[type] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {display}
    </span>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <p className="text-[11px] text-gray-500 font-medium">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function CommunicationLogs() {
  const [logs, setLogs] = useState<CommunicationLogEntry[]>([]);
  const [summary, setSummary] = useState<CommunicationLogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<CommunicationLogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = { page };
      if (search) params.search = search;
      if (typeFilter) params.comm_type = typeFilter;
      if (channelFilter) params.channel = channelFilter;
      if (statusFilter) params.status = statusFilter;

      const [logsData, summaryData] = await Promise.all([
        communicationApi.getLogs(params),
        page === 1 ? communicationApi.getLogSummary() : Promise.resolve(null),
      ]);

      setLogs(logsData.results);
      setTotalCount(logsData.count);
      if (summaryData) setSummary(summaryData);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, channelFilter, statusFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, channelFilter, statusFilter]);

  const totalPages = Math.ceil(totalCount / 20);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Send className="w-5 h-5 text-sky-600" />
          <h2 className="text-lg font-bold text-gray-900">Communication Logs</h2>
        </div>
        <p className="text-sm text-gray-500">
          Track all automated patient communications sent by the system.
        </p>
      </div>

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Sent" value={summary.stats.total} color="text-gray-900" />
          <StatCard label="Delivered" value={summary.stats.sent} color="text-emerald-600" />
          <StatCard label="Failed" value={summary.stats.failed} color="text-red-600" />
          <StatCard label="Replied" value={summary.stats.replied} color="text-violet-600" />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by recipient, subject, or patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
        >
          <option value="">All Types</option>
          <option value="BOOKING_CONFIRMATION">Booking Confirmation</option>
          <option value="RECURRING_CONFIRMATION">Recurring Confirmation</option>
          <option value="APPOINTMENT_REMINDER">Reminder</option>
          <option value="DNA_FOLLOWUP">DNA Follow-up</option>
          <option value="REBOOK_FOLLOWUP">Rebook Follow-up</option>
          <option value="INACTIVE_CHECKIN">Inactive Check-in</option>
        </select>
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
        >
          <option value="">All Channels</option>
          <option value="EMAIL">Email</option>
          <option value="SMS">SMS</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
        >
          <option value="">All Statuses</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
          <option value="DELIVERED">Delivered</option>
          <option value="REPLIED">Replied</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-sky-500" />
            <span className="ml-2 text-sm text-gray-500">Loading...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Send className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No communication logs found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Time</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Type</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Patient</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Recipient</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Channel</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Reply</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-gray-50 hover:bg-sky-50/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-[12px] text-gray-600">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {new Date(log.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={log.comm_type} display={log.comm_type_display} />
                  </td>
                  <td className="px-4 py-3 text-[13px] font-medium text-gray-800">
                    {log.patient_name || '—'}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-gray-600 font-mono">
                    {log.recipient}
                  </td>
                  <td className="px-4 py-3">
                    <ChannelBadge channel={log.channel} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-4 py-3">
                    {log.patient_reply ? (
                      <span className={`font-mono font-bold text-sm ${log.patient_reply === 'Y' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {log.patient_reply}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Detail Panel */}
        {selectedLog && (
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[11px] text-gray-500 font-medium mb-1">Subject</p>
                <p className="text-gray-800">{selectedLog.subject || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500 font-medium mb-1">
                  {selectedLog.error_message ? 'Error' : 'Sent At'}
                </p>
                <p className={selectedLog.error_message ? 'text-red-600' : 'text-gray-800'}>
                  {selectedLog.error_message || new Date(selectedLog.created_at).toLocaleString()}
                </p>
              </div>
              {selectedLog.body_preview && (
                <div className="col-span-2">
                  <p className="text-[11px] text-gray-500 font-medium mb-1">Preview</p>
                  <p className="text-gray-700 text-[12px] leading-relaxed bg-white rounded-lg border border-gray-200 p-3 whitespace-pre-line max-h-32 overflow-y-auto">
                    {selectedLog.body_preview}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white">
            <p className="text-[12px] text-gray-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium text-gray-600 px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
