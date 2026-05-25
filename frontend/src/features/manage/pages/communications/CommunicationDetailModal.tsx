import React, { useEffect, useState, useCallback } from 'react';
import {
  X, Mail, MessageSquare, CheckCircle2, AlertCircle, Eye, Send,
  Paperclip, RefreshCw, Calendar, User, ExternalLink, FileText, RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  communicationRecordsApi,
  type CommunicationLog,
  type CommunicationLogDetail,
  type CommStatus,
} from '../../services/communications.api';
import { usePermissions } from '@/hooks/usePermissions';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<CommStatus, { label: string; className: string }> = {
  QUEUED:    { label: 'Queued',    className: 'bg-gray-100 text-gray-600 border-gray-200' },
  SENT:      { label: 'Sent',      className: 'bg-blue-50 text-blue-700 border-blue-200' },
  DELIVERED: { label: 'Delivered', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  OPENED:    { label: 'Opened',    className: 'bg-teal-50 text-teal-700 border-teal-200' },
  REPLIED:   { label: 'Replied',   className: 'bg-violet-50 text-violet-700 border-violet-200' },
  FAILED:    { label: 'Failed',    className: 'bg-red-50 text-red-700 border-red-200' },
  BOUNCED:   { label: 'Bounced',   className: 'bg-orange-50 text-orange-700 border-orange-200' },
  PENDING:   { label: 'Pending',   className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
};

function StatusBadge({ status }: { status: CommStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.QUEUED;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function formatDt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fileIcon(type: string) {
  if (type === 'PDF' || type === 'INVOICE' || type === 'CLINICAL') {
    return <FileText className="w-5 h-5 text-red-500" />;
  }
  return <Paperclip className="w-5 h-5 text-gray-400" />;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CommunicationDetailModalProps {
  log: CommunicationLog | null;
  onClose: () => void;
  onResend: (log: CommunicationLog) => void;
  onUpdated: (log: CommunicationLog) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CommunicationDetailModal: React.FC<CommunicationDetailModalProps> = ({
  log,
  onClose,
  onResend,
  onUpdated,
}) => {
  const { canEdit } = usePermissions();
  const canManage   = canEdit('manage_communications');

  const [detail, setDetail] = useState<CommunicationLogDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!log) return;
    setLoading(true);
    try {
      const data = await communicationRecordsApi.retrieve(log.id);
      setDetail(data);
    } catch {
      toast.error('Failed to load communication details');
    } finally {
      setLoading(false);
    }
  }, [log]);

  useEffect(() => {
    if (log) load();
    else setDetail(null);
  }, [log, load]);

  // Keyboard close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleConfirm() {
    if (!detail) return;
    setActing('confirm');
    try {
      const updated = await communicationRecordsApi.confirmAppointment(detail.id);
      toast.success('Appointment confirmed');
      onUpdated(updated);
      await load();
    } catch {
      toast.error('Failed to confirm appointment');
    } finally {
      setActing(null);
    }
  }

  async function handleReschedule() {
    if (!detail) return;
    setActing('reschedule');
    try {
      const updated = await communicationRecordsApi.rescheduleAppointment(detail.id);
      toast.success('Appointment marked for reschedule');
      onUpdated(updated);
      await load();
    } catch {
      toast.error('Failed to update appointment');
    } finally {
      setActing(null);
    }
  }

  if (!log) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Communication Details"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
                {log.channel === 'SMS'
                  ? <MessageSquare className="w-4 h-4 text-sky-600" />
                  : <Mail className="w-4 h-4 text-sky-600" />
                }
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 leading-tight">
                  {log.comm_type_display}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {log.channel} · {formatDt(log.created_at)}
                </p>
              </div>
              <StatusBadge status={log.status} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {loading && !detail ? (
            <div className="p-8 space-y-3 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-100 rounded w-full" />
              ))}
            </div>
          ) : (
            <div className="p-5 space-y-5">

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-3">
                <MetaItem icon={<User className="w-3.5 h-3.5" />} label="Patient">
                  {log.patient_name || '—'}
                </MetaItem>
                <MetaItem icon={<Mail className="w-3.5 h-3.5" />} label="Recipient">
                  <span className="truncate">{log.recipient}</span>
                </MetaItem>
                {log.practitioner_name && (
                  <MetaItem icon={<User className="w-3.5 h-3.5" />} label="Practitioner">
                    {log.practitioner_name}
                  </MetaItem>
                )}
                {log.appointment && (
                  <MetaItem icon={<Calendar className="w-3.5 h-3.5" />} label="Appointment">
                    #{log.appointment}
                  </MetaItem>
                )}
              </div>

              {/* Delivery timeline */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">
                  Delivery Track
                </h3>
                <div className="flex items-center gap-0">
                  <TrackStep done icon={<Send className="w-3.5 h-3.5" />} label="Sent" time={log.created_at} />
                  <div className={`h-px w-8 shrink-0 ${log.delivered_at ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                  <TrackStep done={!!log.delivered_at} icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Delivered" time={log.delivered_at} />
                  <div className={`h-px w-8 shrink-0 ${log.opened_at ? 'bg-teal-300' : 'bg-gray-200'}`} />
                  <TrackStep done={!!log.opened_at} icon={<Eye className="w-3.5 h-3.5" />} label="Opened" time={log.opened_at} />
                  <div className={`h-px w-8 shrink-0 ${log.replied_at ? 'bg-violet-300' : 'bg-gray-200'}`} />
                  <TrackStep done={!!log.replied_at} icon={<MessageSquare className="w-3.5 h-3.5" />} label="Replied" time={log.replied_at} />
                </div>
                {log.status === 'FAILED' && log.error_message && (
                  <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{log.error_message}</p>
                  </div>
                )}
              </div>

              {/* Subject + body */}
              {(log.subject || detail?.full_body || log.body_preview) && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">
                    Message
                  </h3>
                  {log.subject && (
                    <p className="text-sm font-semibold text-gray-800 mb-2">{log.subject}</p>
                  )}
                  <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {detail?.full_body || log.body_preview || '(No body content)'}
                  </div>
                </div>
              )}

              {/* Patient reply actions */}
              {detail && log.comm_type === 'APPOINTMENT_REMINDER' && !log.patient_reply && canManage && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">
                    Patient Response
                  </h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleConfirm}
                      disabled={!!acting}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {acting === 'confirm' ? 'Confirming…' : 'YES — Confirm Appointment'}
                    </button>
                    <button
                      onClick={handleReschedule}
                      disabled={!!acting}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {acting === 'reschedule' ? 'Updating…' : 'NO — Reschedule'}
                    </button>
                  </div>
                </div>
              )}

              {/* Patient reply result */}
              {log.patient_reply && (
                <div className={`flex items-center gap-3 rounded-xl p-3 border ${
                  log.patient_reply === 'Y'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-amber-50 border-amber-100 text-amber-700'
                }`}>
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">
                      {log.patient_reply === 'Y' ? 'Patient confirmed appointment' : 'Patient requested reschedule'}
                    </p>
                    <p className="text-xs mt-0.5 opacity-75">{formatDt(log.replied_at)}</p>
                  </div>
                </div>
              )}

              {/* Reply thread */}
              {detail && detail.replies.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Reply Thread ({detail.replies.length})
                  </h3>
                  <div className="space-y-2">
                    {detail.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className={`flex gap-2.5 ${reply.sender_type === 'PATIENT' ? 'flex-row' : 'flex-row-reverse'}`}
                      >
                        {/* Avatar */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                          reply.sender_type === 'PATIENT'
                            ? 'bg-sky-100 text-sky-700'
                            : reply.sender_type === 'SYSTEM'
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-teal-100 text-teal-700'
                        }`}>
                          {reply.sender_name?.charAt(0) || '?'}
                        </div>
                        {/* Bubble */}
                        <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
                          reply.sender_type === 'PATIENT'
                            ? 'bg-gray-100 text-gray-800 rounded-tl-sm'
                            : reply.sender_type === 'SYSTEM'
                            ? 'bg-gray-50 text-gray-500 border border-gray-100 rounded-tr-sm text-xs italic'
                            : 'bg-sky-500 text-white rounded-tr-sm'
                        }`}>
                          <p className="text-sm leading-snug">{reply.message}</p>
                          <p className={`text-xs mt-1 ${
                            reply.sender_type === 'STAFF' ? 'text-sky-200' : 'text-gray-400'
                          }`}>
                            {reply.sender_name} · {formatDt(reply.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachments */}
              {detail && detail.attachments.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">
                    Attachments ({detail.attachments.length})
                  </h3>
                  <div className="space-y-2">
                    {detail.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors"
                      >
                        <div className="shrink-0">{fileIcon(att.attachment_type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{att.file_name}</p>
                          <p className="text-xs text-gray-400">
                            {att.attachment_type_display}
                            {att.file_size_bytes ? ` · ${formatBytes(att.file_size_bytes)}` : ''}
                          </p>
                        </div>
                        {att.file_url && (
                          <a
                            href={att.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors shrink-0"
                            title="Download"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-2">
            {log.message_id && (
              <p className="text-xs text-gray-400 font-mono">
                ID: {log.message_id.slice(0, 20)}…
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(log.status === 'FAILED' || log.status === 'BOUNCED') && canManage && (
              <button
                onClick={() => onResend(log)}
                disabled={!!acting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                <RefreshCw className="w-4 h-4" />
                Resend
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MetaItem({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
      <div className="flex items-center gap-1.5 text-gray-400 mb-1">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-sm font-semibold text-gray-800 truncate">{children}</div>
    </div>
  );
}

function TrackStep({ done, icon, label, time }: {
  done: boolean;
  icon: React.ReactNode;
  label: string;
  time: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
        done ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-300'
      }`}>
        {icon}
      </div>
      <span className={`text-xs font-medium ${done ? 'text-sky-600' : 'text-gray-300'}`}>{label}</span>
      {done && time && (
        <span className="text-xs text-gray-400 text-center leading-tight">
          {new Date(time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}
