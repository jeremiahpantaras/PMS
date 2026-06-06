import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Clock, CheckCircle, XCircle, AlertCircle, Activity,
  Calendar, User, MapPin, FileText, Receipt,
  ChevronDown, ChevronUp, Loader2,
  ClipboardList, Printer, Mail,
} from 'lucide-react';
import type { Appointment } from '@/types';
import type { Invoice } from '@/types/billing';
import { getAppointmentInvoice } from '@/features/appointments/appointment.api';
import { SendInvoiceEmailModal } from './SendInvoiceEmailModal';
import { PMSInvoiceTemplate } from '@/components/invoices/PMSInvoiceTemplate';
import type { InvoiceClinicInfo, NextAppointmentInfo } from '@/components/invoices/PMSInvoiceTemplate';
import { useReactToPrint } from 'react-to-print';
import { getMyClinic } from '@/features/clinics/clinic.api';
import axiosInstance from '@/lib/axios';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (dateString: string) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
};

/** Converts a "HH:MM" or "HH:MM:SS" string to 12-hour format, e.g. "2:30 PM" */
const formatTime12h = (time: string): string => {
  if (!time) return time;
  const [hourStr, minuteStr] = time.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = minuteStr ?? '00';
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
};

const APPOINTMENT_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  SCHEDULED:   { label: 'Scheduled',   color: 'text-blue-700',   bgColor: 'bg-blue-50',   icon: <Clock className="w-3.5 h-3.5" /> },
  CONFIRMED:   { label: 'Confirmed',   color: 'text-sky-700',    bgColor: 'bg-sky-50',    icon: <CheckCircle className="w-3.5 h-3.5" /> },
  CHECKED_IN:  { label: 'Checked In',  color: 'text-purple-700', bgColor: 'bg-purple-50', icon: <Activity className="w-3.5 h-3.5" /> },
  IN_PROGRESS: { label: 'In Progress', color: 'text-yellow-700', bgColor: 'bg-yellow-50', icon: <Activity className="w-3.5 h-3.5" /> },
  COMPLETED:   { label: 'Completed',   color: 'text-green-700',  bgColor: 'bg-green-50',  icon: <CheckCircle className="w-3.5 h-3.5" /> },
  CANCELLED:   { label: 'Cancelled',   color: 'text-red-700',    bgColor: 'bg-red-50',    icon: <XCircle className="w-3.5 h-3.5" /> },
  NO_SHOW:     { label: 'No Show',     color: 'text-gray-600',   bgColor: 'bg-gray-100',  icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  INITIAL: 'Initial Consultation', FOLLOW_UP: 'Follow-up',
  THERAPY: 'Therapy Session', ASSESSMENT: 'Assessment',
};

// ─── CollapsibleSection ───────────────────────────────────────────────────────

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  badgeColor?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title, icon, children, defaultOpen = true, badge, badgeColor = 'bg-gray-100 text-gray-600',
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sky-600">{icon}</span>
          <span className="text-sm font-semibold text-gray-700">{title}</span>
          {badge !== undefined && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{badge}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface AppointmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  patientEmail?: string;
}

export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  isOpen, onClose, appointment, patientEmail,
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'invoice'>('details');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [clinicInfo, setClinicInfo] = useState<InvoiceClinicInfo | undefined>();
  const [nextAppointment, setNextAppointment] = useState<NextAppointmentInfo | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  // A4 height in pixels at 96 DPI
  const A4_HEIGHT_PX = 1122; // 297mm ≈ 1122px

  const handlePrint = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: invoices.length > 0 ? `Invoice-${invoices[0].invoice_number}` : 'Invoice',
    pageStyle: `
      @page { size: A4 portrait; margin: 0; }
      html, body {
        margin: 0; padding: 0;
        width: 210mm;
        height: 297mm;
        overflow: hidden;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    `,
    onBeforePrint: async () => {
      const el = invoiceRef.current;
      if (!el) return;
      // Measure natural height, scale down if it exceeds A4
      const naturalHeight = el.scrollHeight;
      if (naturalHeight > A4_HEIGHT_PX) {
        const scale = A4_HEIGHT_PX / naturalHeight;
        el.style.transform = `scale(${scale})`;
        el.style.transformOrigin = 'top left';
        el.style.width = `${100 / scale}%`;
        el.style.maxWidth = 'none';
        el.dataset.printScaled = 'true';
      }
    },
    onAfterPrint: () => {
      const el = invoiceRef.current;
      if (!el || !el.dataset.printScaled) return;
      el.style.transform = '';
      el.style.transformOrigin = '';
      el.style.width = '';
      el.style.maxWidth = '';
      delete el.dataset.printScaled;
    },
  });

  const fetchInvoices = useCallback(async () => {
    if (!appointment) return;
    setLoadingInvoices(true);
    try {
      const data = await getAppointmentInvoice(appointment.id);
      const results = data?.results ?? data ?? [];
      setInvoices(Array.isArray(results) ? results : [results]);
    } catch { setInvoices([]); }
    finally { setLoadingInvoices(false); }
  }, [appointment]);

  useEffect(() => {
    if (isOpen && appointment) {
      setActiveTab('details');
      fetchInvoices();

      // Fetch clinic profile
      getMyClinic().then((profile) => {
        setClinicInfo({
          name: profile.name,
          address: [profile.address, profile.city, profile.province, profile.postal_code].filter(Boolean).join(', '),
          phone: profile.phone || undefined,
          email: profile.email || undefined,
          website: profile.website || undefined,
          tinNumber: profile.tin || undefined,
          logoUrl: profile.logo_url || profile.logo || undefined,
        });
      }).catch(() => {});

      // Fetch next appointment for this patient
      if (appointment.patient) {
        const params = new URLSearchParams({
          patient: String(appointment.patient),
          date_from: appointment.date,
          ordering: 'date,start_time',
          page_size: '10',
        });
        axiosInstance.get(`/appointments/?${params.toString()}`)
          .then(({ data }) => {
            const next = data.results?.find((a: Appointment) => a.id !== appointment.id);
            setNextAppointment(next ? { date: next.date, start_time: next.start_time } : null);
          })
          .catch(() => setNextAppointment(null));
      }
    }
  }, [isOpen, appointment, fetchInvoices]);

  if (!isOpen || !appointment) return null;

  const statusConfig = APPOINTMENT_STATUS_CONFIG[appointment.status] || APPOINTMENT_STATUS_CONFIG['SCHEDULED'];
  const appointmentTypeLabel = APPOINTMENT_TYPE_LABELS[appointment.appointment_type] || appointment.appointment_type;

  const tabs = [
    { id: 'details' as const,  label: 'Appointment Details', icon: <ClipboardList className="w-3.5 h-3.5" /> },
    { id: 'invoice' as const,  label: 'Invoice',        icon: <Receipt className="w-3.5 h-3.5" />,     count: invoices.length },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] pointer-events-auto flex flex-col overflow-hidden transition-all ${
            activeTab === 'invoice' ? 'max-w-4xl' : 'max-w-2xl'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Date block */}
                <div className="w-12 h-12 bg-sky-600 rounded-xl flex flex-col items-center justify-center flex-shrink-0 shadow-sm">
                  <p className="text-[9px] font-bold text-sky-200 uppercase leading-none">
                    {new Date(appointment.date).toLocaleDateString('en-US', { month: 'short' })}
                  </p>
                  <p className="text-lg font-bold text-white leading-tight">
                    {new Date(appointment.date).getDate()}
                  </p>
                  <p className="text-[9px] text-sky-200 leading-none">
                    {new Date(appointment.date).getFullYear()}
                  </p>
                </div>

                {/* Info */}
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="text-base font-bold text-gray-900">{appointmentTypeLabel}</h2>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold border ${statusConfig.bgColor} ${statusConfig.color}`}>
                      {statusConfig.icon}
                      {statusConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime12h(appointment.start_time)} – {formatTime12h(appointment.end_time)}
                    </span>
                    {appointment.practitioner_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {appointment.practitioner_name}
                      </span>
                    )}
                    {appointment.location_name && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {appointment.location_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0" aria-label="Close">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="flex border-b border-gray-200 bg-gray-50 px-4 flex-shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    activeTab === tab.id ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab Content ── */}
          <div className="flex-1 overflow-y-auto p-5">

            {/* Details Tab */}
            {activeTab === 'details' && (
              <div className="space-y-3">
                <CollapsibleSection title="Appointment Information" icon={<Calendar className="w-4 h-4" />}>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {[
                      { label: 'Date', value: formatDate(appointment.date) },
                      { label: 'Time', value: `${formatTime12h(appointment.start_time)} – ${formatTime12h(appointment.end_time)} (${appointment.duration_minutes} min)` },
                      { label: 'Type', value: appointmentTypeLabel },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-sm font-medium text-gray-900">{value}</p>
                      </div>
                    ))}
                    {appointment.practitioner_name && (
                      <div>
                        <p className="text-xs text-gray-500">Practitioner</p>
                        <p className="text-sm font-medium text-gray-900">{appointment.practitioner_name}</p>
                      </div>
                    )}
                    {appointment.location_name && (
                      <div>
                        <p className="text-xs text-gray-500">Location</p>
                        <p className="text-sm font-medium text-gray-900">{appointment.location_name}</p>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>

                {appointment.notes && (
                  <CollapsibleSection title="Session Notes" icon={<FileText className="w-4 h-4" />}>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{appointment.notes}</p>
                  </CollapsibleSection>
                )}

                {appointment.patient_notes && (
                  <CollapsibleSection title="Patient Notes" icon={<User className="w-4 h-4" />} defaultOpen={false}>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{appointment.patient_notes}</p>
                  </CollapsibleSection>
                )}

                {(appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW') && (
                  <CollapsibleSection title="Cancellation Details" icon={<XCircle className="w-4 h-4" />} badgeColor="bg-red-50 text-red-600">
                    <div className="space-y-2">
                      {appointment.cancellation_reason && (
                        <div>
                          <p className="text-xs text-gray-500">Reason</p>
                          <p className="text-sm text-gray-800">{appointment.cancellation_reason}</p>
                        </div>
                      )}
                      {appointment.cancelled_at && (
                        <div>
                          <p className="text-xs text-gray-500">Cancelled At</p>
                          <p className="text-sm text-gray-800">{formatDateTime(appointment.cancelled_at)}</p>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                )}

                <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                  <span>Created: {formatDateTime(appointment.created_at)}</span>
                  <span>Updated: {formatDateTime(appointment.updated_at)}</span>
                </div>
              </div>
            )}

            {/* Invoice Tab */}
            {activeTab === 'invoice' && (
              <div className="space-y-3">
                {loadingInvoices ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-7 h-7 text-sky-500 animate-spin" />
                  </div>
                ) : !appointment.has_invoice ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                      <Receipt className="w-7 h-7 text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">No Invoice generated yet</p>
                    <p className="text-xs text-gray-400 mt-1">An invoice will appear here once generated</p>
                  </div>
                ) : invoices.length > 0 ? (
                  /* Display React invoice template inline with action buttons */
                  <div className="flex flex-col gap-4">
                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handlePrint()}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                        Print
                      </button>
                      <button
                        onClick={() => setShowEmailModal(true)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                        Send Email
                      </button>
                    </div>
                    {/* Invoice Preview */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
                      <div className="max-h-[500px] overflow-y-auto">
                        <PMSInvoiceTemplate
                          ref={invoiceRef}
                          invoice={invoices[0]}
                          clinic={clinicInfo}
                          nextAppointment={nextAppointment}
                          showPaymentHistory
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                      <Receipt className="w-7 h-7 text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">No Invoice found</p>
                    <p className="text-xs text-gray-400 mt-1">No invoice has been generated for this appointment</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Send Email Modal */}
      {showEmailModal && invoices.length > 0 && (
        <SendInvoiceEmailModal
          isOpen={showEmailModal}
          onClose={() => { setShowEmailModal(false); }}
          invoiceId={invoices[0].id}
          invoiceNumber={invoices[0].invoice_number}
          patientName={appointment.patient_name}
          patientEmail={patientEmail || ''}
          appointmentDate={formatDate(appointment.date)}
          appointmentType={APPOINTMENT_TYPE_LABELS[appointment.appointment_type] || appointment.appointment_type}
          invoice={invoices[0]}
          clinic={clinicInfo}
          nextAppointment={nextAppointment}
        />
      )}
    </>
  );
};