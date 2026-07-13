import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Mail, MessageSquare, Check, X, Send, Reply,
  Loader2, ChevronLeft, ChevronRight, MessageCircle,
  Building2, AlertCircle, Clock, CalendarDays,
} from 'lucide-react';
import {
  communicationApi,
  type CommunicationLogEntry,
} from '@/features/setup/services/communication.api';

const PAGE_SIZE = 20;

// ── Helpers ────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].charAt(0).toUpperCase()
    : (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const AVATAR_PALETTE = [
  'bg-sky-100 text-sky-700', 'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700', 'bg-indigo-100 text-indigo-700',
];

function avatarColor(name: string) {
  const n = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length];
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const sizeMap = { sm: 'w-6 h-6 text-[10px]', md: 'w-8 h-8 text-[11px]' };
  return (
    <div className={`rounded-full flex items-center justify-center font-bold shrink-0 ${sizeMap[size]} ${avatarColor(name)}`}>
      {getInitials(name)}
    </div>
  );
}

function formatFull(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
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

// ── Delivery Timeline (compact) ────────────────────────────────────────────
const TIMELINE_STEPS = [
  { key: 'SENT',      Icon: Send },
  { key: 'DELIVERED', Icon: Check },
  { key: 'REPLIED',   Icon: Reply },
];
const STEP_ORDER: Record<string, number> = { SENT: 1, DELIVERED: 2, REPLIED: 3 };

function DeliveryDots({ status }: { status: string }) {
  const failed = status === 'FAILED';
  const level = failed ? 0 : (STEP_ORDER[status] ?? 1);
  return (
    <div className="flex items-center gap-1">
      {TIMELINE_STEPS.map((step, i) => (
        <div
          key={step.key}
          title={step.key}
          className={`w-1.5 h-1.5 rounded-full ${
            failed && i === 0 ? 'bg-red-400'
            : !failed && level > i ? 'bg-sky-400'
            : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

// ── Inline Thread (expandable row) ────────────────────────────────────────
function InlineThread({ log }: { log: CommunicationLogEntry }) {
  const confirmed = log.patient_reply === 'Y';
  const declined  = log.patient_reply === 'N';
  const rescheduled = log.patient_reply === 'RESCHEDULE';
  const isPending = !log.patient_reply && (log.status === 'SENT' || log.status === 'DELIVERED');
  const bgStyle = log.appointment_color ? { backgroundColor: log.appointment_color } : {};
  
  // Use the appointment color as a subtle left border AND a very light background tint
  const borderStyle = log.appointment_color 
    ? { borderLeftColor: log.appointment_color, backgroundColor: `${log.appointment_color}0D` } // ~5% opacity
    : {};
  const bgClass = log.appointment_color 
    ? 'px-5 py-4 border-b border-gray-100 border-l-4' 
    : 'px-5 py-4 bg-gray-50/60 border-b border-gray-100 border-l-4 border-l-transparent';

  return (
    <div className={bgClass} style={borderStyle}>
      <div className="ml-11 space-y-4">

        {/* Outbound message */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-linear-to-br from-sky-500 to-sky-700 flex items-center justify-center shrink-0 shadow-sm border border-white/20">
              <Building2 className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-[11.5px] font-semibold text-gray-800">Malasakit PMS</span>
            <span className="text-[11.5px] text-gray-500">→ {log.recipient}</span>
            <span className="text-[11px] text-gray-400 ml-auto">{formatFull(log.created_at)}</span>
          </div>
          <div className="ml-7 bg-gray-50 rounded-lg border border-gray-100 px-4 py-3 shadow-sm">
            {log.body_preview
              ? <p className="text-[12.5px] text-gray-700 leading-relaxed whitespace-pre-line">{log.body_preview}</p>
              : <p className="text-[12.5px] text-gray-400 italic">No preview available.</p>
            }
          </div>
          {log.error_message && (
            <div className="ml-7 mt-2 flex items-start gap-1.5 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-px" />
              <p className="text-[11px] text-red-600">{log.error_message}</p>
            </div>
          )}
        </div>

        {/* Patient reply */}
        {log.patient_reply && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Avatar name={log.patient_name || '?'} size="sm" />
              <span className="text-[11.5px] font-semibold text-gray-800">{log.patient_name || 'Patient'}</span>
              <span className="text-[11.5px] text-gray-500">replied</span>
              {log.replied_at && (
                <span className="text-[11px] text-gray-400 ml-auto">{formatFull(log.replied_at)}</span>
              )}
            </div>
            <div className={`ml-7 rounded-lg border p-3 ${
              confirmed ? 'bg-emerald-50 border-emerald-200'
              : declined ? 'bg-red-50 border-red-200'
              : rescheduled ? 'bg-amber-50 border-amber-200'
              : 'bg-gray-50 border-gray-200'
            }`}>
              {confirmed && (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-emerald-800">Appointment Confirmed</p>
                    <p className="text-[11px] text-emerald-600">Patient confirmed attendance</p>
                  </div>
                </div>
              )}
              {declined && (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                    <X className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-red-800">Cannot Attend</p>
                    <p className="text-[11px] text-red-600">Patient declined</p>
                  </div>
                </div>
              )}
              {rescheduled && (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-amber-800">Needs Rescheduling</p>
                    <p className="text-[11px] text-amber-600">Patient opted to reschedule</p>
                  </div>
                </div>
              )}
              {!confirmed && !declined && !rescheduled && (
                <p className="text-[12px] text-gray-700">
                  Replied: <span className="font-semibold">&quot;{log.patient_reply}&quot;</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Awaiting reply */}
        {isPending && (
          <div className="ml-7 flex items-center gap-2 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium">Awaiting patient response</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function PatientCommunicationHistoryPage() {
  const { patientId } = useParams<{ patientId: string }>();

  const [logs, setLogs]           = useState<CommunicationLogEntry[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [expanded, setExpanded]   = useState<number | null>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchLogs = useCallback(async (p: number) => {
    if (!patientId) return;
    setLoading(true);
    setError(false);
    try {
      const result = await communicationApi.getLogs({ patient: patientId, page: p });
      setLogs(result.results);
      setTotal(result.count);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<CommunicationLogEntry>;
      const updatedLog = customEvent.detail;
      setLogs(currentLogs => {
        const exists = currentLogs.some(log => log.id === updatedLog.id);
        if (exists) {
          return currentLogs.map(log => log.id === updatedLog.id ? updatedLog : log);
        } else {
          // New log created
          if (updatedLog.patient === Number(patientId) || !updatedLog.patient) {
            return [updatedLog, ...currentLogs];
          }
          return currentLogs;
        }
      });
    };
    window.addEventListener('communicationUpdated', handleUpdate);
    return () => window.removeEventListener('communicationUpdated', handleUpdate);
  }, [patientId]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
            <MessageCircle className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">Communication History here</h2>
        </div>
        {!loading && (
          <span className="text-[11px] text-gray-400">
            {total} record{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-14 gap-2">
          <Loader2 className="w-5 h-5 text-sky-500 animate-spin" />
          <span className="text-[13px] text-gray-400">Loading…</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-14 gap-2 text-sm text-red-500">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Failed to load communication history.
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
            <Send className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-[13px] font-semibold text-gray-700">No communications yet</p>
          <p className="text-[12px] text-gray-400 leading-relaxed max-w-56">
            Automated messages sent to this patient will appear here.
          </p>
        </div>
      ) : (
        <>
          <div>
            {logs.map(log => {
              const isOpen = expanded === log.id;
              const confirmed = log.patient_reply === 'Y';
              const declined  = log.patient_reply === 'N';
              const rescheduled = log.patient_reply === 'RESCHEDULE';

              let triangleColor = '';
              if (log.comm_type === 'APPOINTMENT_REMINDER') {
                if (confirmed) triangleColor = '#10B981'; // Green
                else if (declined) triangleColor = '#EF4444'; // Red
                else if (rescheduled) triangleColor = '#F59E0B'; // Amber
                else if (log.status === 'SENT' || log.status === 'DELIVERED') triangleColor = '#F97316'; // Orange
              }

              let rowStyle = {};
              let rowClasses = `
                relative overflow-hidden w-full text-left px-4 py-3.5 border-b border-gray-50
                flex items-center gap-3 transition-colors focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500
              `;

              // Nookal-style accent border + light background tint
              if (log.appointment_color) {
                rowClasses += ' border-l-4';
                rowStyle = { 
                  borderLeftColor: log.appointment_color,
                  backgroundColor: isOpen ? `${log.appointment_color}1A` : `${log.appointment_color}0D` // 10% and 5% opacity
                };
              } else {
                rowClasses += ' border-l-4 border-l-transparent';
              }

              if (!log.appointment_color) {
                rowClasses += isOpen ? ' bg-sky-50/40' : ' bg-white hover:bg-gray-50/80';
              } else {
                rowClasses += ' hover:brightness-95';
              }

              return (
                <div key={log.id}>
                  {/* Row */}
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : log.id)}
                    className={rowClasses}
                    style={rowStyle}
                  >
                    {/* Status Triangle Ribbon */}
                    {triangleColor && (
                      <div 
                        className="absolute top-0 right-0 w-0 h-0 z-10" 
                        style={{
                           borderTop: `28px solid ${triangleColor}`,
                           borderLeft: '28px solid transparent'
                        }}
                      />
                    )}

                    <Avatar name={log.patient_name || '?'} />
                    
                    <div className="flex-1 min-w-0 pr-6"> {/* Added pr-6 to prevent overlapping with triangle */}
                      <div className="flex items-center gap-2 mb-1">
                        <TypeChip type={log.comm_type} />
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 shrink-0">
                          {log.channel === 'SMS'
                            ? <MessageSquare className="w-2.5 h-2.5 text-amber-500" />
                            : <Mail className="w-2.5 h-2.5 text-sky-500" />
                          }
                        </div>
                        <span className="text-[11px] text-gray-400 ml-auto font-medium">
                          {formatFull(log.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {log.subject && (
                          <p className="text-[13px] text-gray-800 font-medium truncate flex-1">
                            {log.subject}
                          </p>
                        )}
                        <div className="flex items-center gap-2 shrink-0 ml-auto">
                          <DeliveryDots status={log.status} />
                          <StatusPill status={log.status} />
                          {confirmed && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-full">
                              <Check className="w-2.5 h-2.5" />
                              Confirmed
                            </span>
                          )}
                          {declined && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 rounded-full">
                              <X className="w-2.5 h-2.5" />
                              Declined
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expandable thread */}
                  {isOpen && <InlineThread log={log} />}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-white">
              <span className="text-[11px] text-gray-500">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] text-gray-500 px-1.5">{page}/{totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
