import React from 'react';
import {
  Mail, MessageSquare, CheckCircle2, XCircle, AlertCircle, Clock,
  Eye, Send, RotateCcw, RefreshCw, Bell, FileText, Shield, Receipt,
  Calendar, Ban, User,
} from 'lucide-react';
import type { CommunicationLog, CommStatus, CommType } from '../../services/communications.api';

// ── Type icon map ─────────────────────────────────────────────────────────────

const TYPE_ICON: Record<CommType, React.ReactNode> = {
  APPOINTMENT_REMINDER:   <Bell        className="w-4 h-4" />,
  BOOKING_CONFIRMATION:   <Calendar    className="w-4 h-4" />,
  RECURRING_CONFIRMATION: <Calendar    className="w-4 h-4" />,
  DNA_FOLLOWUP:           <AlertCircle className="w-4 h-4" />,
  REBOOK_FOLLOWUP:        <RotateCcw   className="w-4 h-4" />,
  INACTIVE_CHECKIN:       <User        className="w-4 h-4" />,
  CANCELLATION_NOTICE:    <XCircle     className="w-4 h-4" />,
  CLINICAL_NOTE:          <FileText    className="w-4 h-4" />,
  OTP_VERIFICATION:       <Shield      className="w-4 h-4" />,
  PASSWORD_RESET:         <Shield      className="w-4 h-4" />,
  INVOICE_EMAIL:          <Receipt     className="w-4 h-4" />,
  RESCHEDULE_FOLLOWUP:    <RefreshCw   className="w-4 h-4" />,
  SYSTEM_NOTIFICATION:    <Bell        className="w-4 h-4" />,
};

const TYPE_COLOR: Record<CommType, string> = {
  APPOINTMENT_REMINDER:   'bg-sky-100 text-sky-600',
  BOOKING_CONFIRMATION:   'bg-emerald-100 text-emerald-600',
  RECURRING_CONFIRMATION: 'bg-emerald-100 text-emerald-600',
  DNA_FOLLOWUP:           'bg-orange-100 text-orange-600',
  REBOOK_FOLLOWUP:        'bg-amber-100 text-amber-600',
  INACTIVE_CHECKIN:       'bg-purple-100 text-purple-600',
  CANCELLATION_NOTICE:    'bg-red-100 text-red-600',
  CLINICAL_NOTE:          'bg-teal-100 text-teal-600',
  OTP_VERIFICATION:       'bg-indigo-100 text-indigo-600',
  PASSWORD_RESET:         'bg-indigo-100 text-indigo-600',
  INVOICE_EMAIL:          'bg-violet-100 text-violet-600',
  RESCHEDULE_FOLLOWUP:    'bg-amber-100 text-amber-600',
  SYSTEM_NOTIFICATION:    'bg-gray-100 text-gray-600',
};

// ── Status line config ────────────────────────────────────────────────────────

const STATUS_LINE: Record<CommStatus, { icon: React.ReactNode; label: string; dot: string }> = {
  QUEUED:    { icon: <Clock         className="w-3.5 h-3.5" />, label: 'Queued',    dot: 'bg-gray-400' },
  SENT:      { icon: <Send          className="w-3.5 h-3.5" />, label: 'Sent',      dot: 'bg-blue-400' },
  DELIVERED: { icon: <CheckCircle2  className="w-3.5 h-3.5" />, label: 'Delivered', dot: 'bg-emerald-500' },
  OPENED:    { icon: <Eye           className="w-3.5 h-3.5" />, label: 'Opened',    dot: 'bg-teal-500' },
  REPLIED:   { icon: <MessageSquare className="w-3.5 h-3.5" />, label: 'Replied',   dot: 'bg-violet-500' },
  FAILED:    { icon: <XCircle       className="w-3.5 h-3.5" />, label: 'Failed',    dot: 'bg-red-500' },
  BOUNCED:   { icon: <Ban           className="w-3.5 h-3.5" />, label: 'Bounced',   dot: 'bg-orange-500' },
  PENDING:   { icon: <Clock         className="w-3.5 h-3.5" />, label: 'Pending',   dot: 'bg-yellow-400' },
};

const STATUS_CARD: Record<CommStatus, string> = {
  QUEUED:    'border-gray-100 bg-white',
  SENT:      'border-blue-100 bg-white',
  DELIVERED: 'border-emerald-100 bg-emerald-50/30',
  OPENED:    'border-teal-100 bg-teal-50/20',
  REPLIED:   'border-violet-100 bg-violet-50/20',
  FAILED:    'border-red-200 bg-red-50/30',
  BOUNCED:   'border-orange-200 bg-orange-50/30',
  PENDING:   'border-yellow-100 bg-yellow-50/20',
};

function formatDateGroup(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CommunicationTimelineProps {
  logs: CommunicationLog[];
  onView: (log: CommunicationLog) => void;
  onResend: (log: CommunicationLog) => void;
  isLoading: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CommunicationTimeline: React.FC<CommunicationTimelineProps> = ({
  logs,
  onView,
  onResend,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 bg-gray-100 rounded-xl" />
              <div className="w-0.5 h-12 bg-gray-100 mt-2" />
            </div>
            <div className="flex-1 pb-6">
              <div className="h-4 bg-gray-100 rounded w-48 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-sky-300" />
        </div>
        <p className="text-gray-500 font-medium">No communications found</p>
        <p className="text-gray-400 text-sm mt-1">Adjust your filters to see results</p>
      </div>
    );
  }

  // Group by date
  const groups = logs.reduce<Record<string, CommunicationLog[]>>((acc, log) => {
    const key = formatDateGroup(log.created_at);
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(groups).map(([dateLabel, items]) => (
        <div key={dateLabel}>
          {/* Date separator */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-gray-100" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-2">
              {dateLabel}
            </span>
            <div className="h-px flex-1 bg-gray-100" />
          </div>

          {/* Timeline items */}
          <div className="relative">
            {/* Vertical connector line */}
            <div
              className="absolute left-5 top-5 bottom-5 w-px bg-linear-to-b from-gray-200 via-gray-100 to-transparent"
              aria-hidden="true"
            />

            <div className="space-y-3">
              {items.map((log) => {
                const typeColor = TYPE_COLOR[log.comm_type] ?? 'bg-gray-100 text-gray-600';
                const typeIcon  = TYPE_ICON[log.comm_type]  ?? <Mail className="w-4 h-4" />;
                const statusCfg = STATUS_LINE[log.status]   ?? STATUS_LINE.QUEUED;
                const cardBorder = STATUS_CARD[log.status]  ?? 'border-gray-100 bg-white';

                return (
                  <div
                    key={log.id}
                    className="flex gap-4 group cursor-pointer"
                    onClick={() => onView(log)}
                  >
                    {/* Timeline dot */}
                    <div className="relative flex flex-col items-center z-10 shrink-0">
                      <div className={`w-10 h-10 rounded-xl ${typeColor} flex items-center justify-center shadow-sm transition-transform group-hover:scale-110`}>
                        {typeIcon}
                      </div>
                    </div>

                    {/* Card */}
                    <div className={`flex-1 rounded-xl border ${cardBorder} p-4 shadow-sm transition-shadow group-hover:shadow-md`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {/* Type + status */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-semibold text-gray-800">
                              {log.comm_type_display}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${statusCfg.dot.replace('bg-', 'text-').replace('-500', '-600').replace('-400', '-600')}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} inline-block`} />
                              {statusCfg.label}
                            </span>
                            {log.channel === 'SMS' && (
                              <span className="text-xs bg-violet-50 text-violet-600 border border-violet-100 rounded-full px-2 py-0.5">
                                SMS
                              </span>
                            )}
                          </div>

                          {/* Patient + practitioner */}
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            {log.patient_name && (
                              <span className="font-medium text-gray-700">{log.patient_name}</span>
                            )}
                            {log.practitioner_name && (
                              <span>· {log.practitioner_name}</span>
                            )}
                            {log.recipient && (
                              <span className="truncate max-w-45">· {log.recipient}</span>
                            )}
                          </div>

                          {/* Subject */}
                          {log.subject && (
                            <p className="text-xs text-gray-500 mt-1 truncate">{log.subject}</p>
                          )}

                          {/* Error message */}
                          {(log.status === 'FAILED' || log.status === 'BOUNCED') && log.error_message && (
                            <p className="text-xs text-red-600 mt-1.5 bg-red-50 rounded-lg px-2 py-1">
                              {log.error_message.slice(0, 100)}
                            </p>
                          )}

                          {/* Delivery checkpoints */}
                          <div className="flex items-center gap-3 mt-2">
                            {log.delivered_at && (
                              <span className="text-xs text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Delivered
                              </span>
                            )}
                            {log.opened_at && (
                              <span className="text-xs text-teal-600 flex items-center gap-1">
                                <Eye className="w-3 h-3" /> Opened
                              </span>
                            )}
                            {log.patient_reply === 'Y' && (
                              <span className="text-xs text-violet-600 flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> Replied YES
                              </span>
                            )}
                            {log.patient_reply === 'N' && (
                              <span className="text-xs text-amber-600 flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> Replied NO
                              </span>
                            )}
                            {log.reply_count > 0 && (
                              <span className="text-xs text-gray-400">
                                {log.reply_count} {log.reply_count === 1 ? 'reply' : 'replies'}
                              </span>
                            )}
                            {log.attachment_count > 0 && (
                              <span className="text-xs text-gray-400">
                                {log.attachment_count} {log.attachment_count === 1 ? 'attachment' : 'attachments'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Timestamp + actions */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {formatTime(log.created_at)}
                          </span>
                          <div
                            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {(log.status === 'FAILED' || log.status === 'BOUNCED') && (
                              <button
                                onClick={() => onResend(log)}
                                className="p-1.5 rounded-lg hover:bg-orange-100 text-orange-500 transition-colors"
                                title="Resend"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
