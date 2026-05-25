import React from 'react';
import {
  Mail, MessageSquare, Eye, RotateCcw, ChevronLeft, ChevronRight,
  AlertCircle, CheckCircle2, Clock, Send, Ban, RefreshCw,
} from 'lucide-react';
import type { CommunicationLog, CommStatus } from '../../services/communications.api';

// ── Status badge config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CommStatus, { label: string; className: string; icon: React.ReactNode }> = {
  QUEUED:    { label: 'Queued',    className: 'bg-gray-100 text-gray-600 border-gray-200',       icon: <Clock className="w-3 h-3" /> },
  SENT:      { label: 'Sent',      className: 'bg-blue-50 text-blue-700 border-blue-200',         icon: <Send className="w-3 h-3" /> },
  DELIVERED: { label: 'Delivered', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  OPENED:    { label: 'Opened',    className: 'bg-teal-50 text-teal-700 border-teal-200',          icon: <Eye className="w-3 h-3" /> },
  REPLIED:   { label: 'Replied',   className: 'bg-violet-50 text-violet-700 border-violet-200',    icon: <MessageSquare className="w-3 h-3" /> },
  FAILED:    { label: 'Failed',    className: 'bg-red-50 text-red-700 border-red-200',             icon: <AlertCircle className="w-3 h-3" /> },
  BOUNCED:   { label: 'Bounced',   className: 'bg-orange-50 text-orange-700 border-orange-200',    icon: <Ban className="w-3 h-3" /> },
  PENDING:   { label: 'Pending',   className: 'bg-yellow-50 text-yellow-700 border-yellow-200',    icon: <Clock className="w-3 h-3" /> },
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  EMAIL: <Mail className="w-3.5 h-3.5 text-sky-500" />,
  SMS:   <MessageSquare className="w-3.5 h-3.5 text-violet-500" />,
};

function StatusBadge({ status }: { status: CommStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.QUEUED;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CommunicationTableProps {
  logs: CommunicationLog[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onView: (log: CommunicationLog) => void;
  onResend: (log: CommunicationLog) => void;
  isLoading: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CommunicationTable: React.FC<CommunicationTableProps> = ({
  logs,
  total,
  page,
  pageSize,
  onPageChange,
  onView,
  onResend,
  isLoading,
}) => {
  const totalPages = Math.ceil(total / pageSize);
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-50">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-6 py-4 animate-pulse flex items-center gap-4">
              <div className="h-4 bg-gray-100 rounded w-32" />
              <div className="h-4 bg-gray-100 rounded w-40 flex-1" />
              <div className="h-4 bg-gray-100 rounded w-24" />
              <div className="h-5 bg-gray-100 rounded-full w-20" />
              <div className="h-4 bg-gray-100 rounded w-28" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-sky-300" />
        </div>
        <p className="text-gray-500 font-medium">No communications found</p>
        <p className="text-gray-400 text-sm mt-1">Adjust your filters to see results</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-225 text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-5 py-3 text-left font-semibold text-gray-500 uppercase tracking-wide text-xs w-10">#</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-500 uppercase tracking-wide text-xs">Type</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-500 uppercase tracking-wide text-xs">Patient</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-500 uppercase tracking-wide text-xs">Recipient</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-500 uppercase tracking-wide text-xs">Subject</th>
              <th className="px-5 py-3 text-center font-semibold text-gray-500 uppercase tracking-wide text-xs">Status</th>
              <th className="px-5 py-3 text-left font-semibold text-gray-500 uppercase tracking-wide text-xs">Sent</th>
              <th className="px-5 py-3 text-center font-semibold text-gray-500 uppercase tracking-wide text-xs">Delivered</th>
              <th className="px-5 py-3 text-center font-semibold text-gray-500 uppercase tracking-wide text-xs">Opened</th>
              <th className="px-5 py-3 text-center font-semibold text-gray-500 uppercase tracking-wide text-xs">Replied</th>
              <th className="px-5 py-3 text-center font-semibold text-gray-500 uppercase tracking-wide text-xs">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.map((log, idx) => (
              <tr
                key={log.id}
                className="hover:bg-sky-50/30 transition-colors cursor-pointer group"
                onClick={() => onView(log)}
              >
                <td className="px-5 py-3.5 text-gray-400 text-xs">
                  {from + idx}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1.5">
                    {CHANNEL_ICONS[log.channel]}
                    <span className="text-gray-700 font-medium text-xs leading-tight">
                      {log.comm_type_display}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-gray-800 font-medium">
                    {log.patient_name || '—'}
                  </span>
                  {log.practitioner_name && (
                    <p className="text-gray-400 text-xs mt-0.5">{log.practitioner_name}</p>
                  )}
                </td>
                <td className="px-5 py-3.5 text-gray-500 text-xs max-w-40 truncate">
                  {log.recipient}
                </td>
                <td className="px-5 py-3.5 text-gray-600 max-w-50">
                  <p className="truncate text-xs">{log.subject || '—'}</p>
                  {log.body_preview && (
                    <p className="text-gray-400 text-xs truncate mt-0.5">{log.body_preview.slice(0, 60)}…</p>
                  )}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <StatusBadge status={log.status} />
                </td>
                <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">
                  {formatShortDate(log.created_at)}
                </td>
                <td className="px-5 py-3.5 text-center text-xs">
                  {log.delivered_at ? (
                    <span className="text-emerald-600 font-medium">✓</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-center text-xs">
                  {log.opened_at ? (
                    <span className="text-teal-600 font-medium">✓</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-center">
                  {log.patient_reply === 'Y' && (
                    <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-medium">YES</span>
                  )}
                  {log.patient_reply === 'N' && (
                    <span className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5 font-medium">NO</span>
                  )}
                  {!log.patient_reply && <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onView(log)}
                      className="p-1.5 rounded-lg hover:bg-sky-100 text-sky-600 transition-colors"
                      title="View details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {(log.status === 'FAILED' || log.status === 'BOUNCED') && (
                      <button
                        onClick={() => onResend(log)}
                        className="p-1.5 rounded-lg hover:bg-orange-100 text-orange-600 transition-colors"
                        title="Resend"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <p className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{from}–{to}</span> of{' '}
            <span className="font-semibold text-gray-700">{total}</span> records
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-white border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            {[...Array(Math.min(totalPages, 7))].map((_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    p === page
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'hover:bg-white border border-gray-200 text-gray-600'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg hover:bg-white border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
