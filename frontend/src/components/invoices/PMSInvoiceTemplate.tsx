import { forwardRef } from 'react';
import type { Invoice, InvoiceItem, Payment } from '@/types/billing';
import { getBankByCode } from '@/data/philippineBanks';
import { DocumentFooter } from '@/components/DocumentFooter';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InvoiceClinicInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  tinNumber?: string;
  logoUrl?: string;
}

export interface NextAppointmentInfo {
  date: string;
  start_time: string;
}

export interface PMSInvoiceTemplateProps {
  invoice: Invoice;
  clinic?: InvoiceClinicInfo;
  currencySymbol?: string;
  showPaymentHistory?: boolean;
  nextAppointment?: NextAppointmentInfo | null;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (value: string | number, currency = '₱') => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return `${currency}0.00`;
  return `${currency}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const fmtQty = (qty: string | number) => {
  const n = typeof qty === 'string' ? parseFloat(qty) : qty;
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  DRAFT:          { bg: 'bg-gray-100',   text: 'text-gray-600',    border: 'border-gray-300' },
  PENDING:        { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-300' },
  PAID:           { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  PARTIALLY_PAID: { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-300' },
  OVERDUE:        { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-300' },
  CANCELLED:      { bg: 'bg-gray-100',   text: 'text-gray-500',    border: 'border-gray-300' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export const PMSInvoiceTemplate = forwardRef<HTMLDivElement, PMSInvoiceTemplateProps>(
  ({ invoice, clinic, currencySymbol = '₱', showPaymentHistory = true, nextAppointment, className = '' }, ref) => {
    const items: InvoiceItem[] = invoice.items ?? [];
    const payments: Payment[] = invoice.payments ?? [];
    const statusStyle = STATUS_STYLES[invoice.status] ?? STATUS_STYLES.DRAFT;

    const hasDiscounts = items.some((i) => parseFloat(i.discount_percent) > 0);
    const hasTaxes = items.some((i) => parseFloat(i.tax_percent) > 0);

    const clinicName = clinic?.name ?? invoice.clinic_name ?? '';
    const discountAmt = parseFloat(invoice.discount_amount || '0');
    const taxAmt = parseFloat(invoice.tax_amount || '0');
    const philhealthCoverage = parseFloat(invoice.philhealth_coverage || '0');
    const hmoCoverage = parseFloat(invoice.hmo_coverage || '0');
    const amountPaid = parseFloat(invoice.amount_paid || '0');
    const balanceDue = parseFloat(invoice.balance_due || '0');

    return (
      <div
        ref={ref}
        className={`bg-white font-sans text-gray-800 print:text-[13px] flex flex-col ${className}`}
        style={{ maxWidth: '210mm', minHeight: '297mm' }}
      >
        {/* ═══════════ CURVED HEADER ═══════════ */}
        <div className="relative overflow-hidden rounded-t-2xl print:rounded-none">
          {/* Blue background with curve */}
          <div className="bg-sky-600 px-8 pt-8 pb-16 relative">
            {/* Decorative curved shapes */}
            <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-sky-500/30" />
            <div className="absolute -right-8 top-8 w-48 h-48 rounded-full bg-sky-500/20" />
            <div className="absolute left-1/2 -bottom-12 w-[120%] h-24 bg-white rounded-[50%] -translate-x-1/2" />

            <div className="relative z-10 flex items-start justify-between">
              {/* Clinic / Company Info */}
              <div className="flex items-start gap-4">
                {clinic?.logoUrl ? (
                  <img
                    src={clinic.logoUrl}
                    alt={`${clinicName} logo`}
                    className="h-24 w-auto"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                    {clinicName.charAt(0) || 'C'}
                  </div>
                )}
                <div className="text-white">
                  <h1 className="text-xl font-bold tracking-tight">{clinicName}</h1>
                  <div className="text-sky-100 text-xs mt-1 space-y-0.5 leading-relaxed">
                    {clinic?.address && <p>{clinic.address}</p>}
                    {clinic?.phone && <p>📞 {clinic.phone}</p>}
                    {clinic?.email && <p>✉️ {clinic.email}</p>}
                    {clinic?.website && <p>🌐 {clinic.website}</p>}
                  </div>
                </div>
              </div>

              {/* Invoice Title */}
              <div className="text-right">
                <h2 className="text-3xl font-extrabold text-white uppercase tracking-wider">
                  Invoice
                </h2>
                <p className="text-sky-100 text-sm font-semibold mt-1 font-mono">
                  {invoice.invoice_number}
                </p>
                <span
                  className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                >
                  {invoice.status_display ?? invoice.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════ BODY ═══════════ */}
        <div className="px-8 -mt-4 relative z-10 flex-1">
          {/* ── Bill From / Bill To / Payment Details ── */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            {/* Bill From */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600 mb-2">
                Bill From
              </p>
              <p className="text-sm font-bold text-gray-900">{clinicName}</p>
              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                {clinic?.address && <p>{clinic.address}</p>}
                {clinic?.phone && <p>{clinic.phone}</p>}
                {clinic?.email && <p>{clinic.email}</p>}
                {clinic?.tinNumber && <p>TIN: {clinic.tinNumber}</p>}
              </div>
            </div>

            {/* Bill To */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600 mb-2">
                Bill To
              </p>
              <p className="text-sm font-bold text-gray-900">{invoice.patient_name}</p>
              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                {invoice.patient_number && <p>Patient #: {invoice.patient_number}</p>}
              </div>
            </div>

            {/* Payment Details */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600 mb-2">
                Invoice Details
              </p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Invoice Date</span>
                  <span className="font-semibold text-gray-800">{fmtDate(invoice.invoice_date)}</span>
                </div>
                {invoice.due_date && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Due Date</span>
                    <span className="font-semibold text-gray-800">{fmtDate(invoice.due_date)}</span>
                  </div>
                )}
                {invoice.appointment_date && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Appointment</span>
                    <span className="font-semibold text-gray-800">{fmtDate(invoice.appointment_date)}</span>
                  </div>
                )}
                {invoice.payment_method && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Payment Method</span>
                    <span className="font-semibold text-gray-800">{invoice.payment_method}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Items Table ── */}
          <div className="mb-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600 mb-3">
              Services / Items
            </p>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sky-600 text-white">
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider w-[5%]">
                      #
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider">
                      Description
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wider w-[10%]">
                      Qty
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider w-[15%]">
                      Price
                    </th>
                    {hasDiscounts && (
                      <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider w-[10%]">
                        Discount
                      </th>
                    )}
                    {hasTaxes && (
                      <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider w-[10%]">
                        Tax
                      </th>
                    )}
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider w-[15%]">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 1 ? 'bg-gray-50/50' : ''}>
                      <td className="py-3 px-4 text-gray-500">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">{item.description}</p>
                        {item.service_code && (
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                            {item.service_code}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-700">
                        {fmtQty(item.quantity)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">
                        {fmt(item.unit_price, currencySymbol)}
                      </td>
                      {hasDiscounts && (
                        <td className="py-3 px-4 text-right text-gray-500">
                          {parseFloat(item.discount_percent) > 0
                            ? `${parseFloat(item.discount_percent)}%`
                            : '—'}
                        </td>
                      )}
                      {hasTaxes && (
                        <td className="py-3 px-4 text-right text-gray-500">
                          {parseFloat(item.tax_percent) > 0
                            ? `${parseFloat(item.tax_percent)}%`
                            : '—'}
                        </td>
                      )}
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        {fmt(item.total, currencySymbol)}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td
                        colSpan={4 + (hasDiscounts ? 1 : 0) + (hasTaxes ? 1 : 0)}
                        className="py-8 text-center text-gray-400 text-sm"
                      >
                        No items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Totals ── */}
          <div className="flex justify-end mb-8">
            <div className="w-80 border border-gray-200 rounded-xl overflow-hidden">
              {/* Subtotal */}
              <div className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-semibold text-gray-800">
                  {fmt(invoice.subtotal, currencySymbol)}
                </span>
              </div>

              {/* Discount */}
              {discountAmt > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-sm bg-gray-50/50">
                  <span className="text-gray-500">
                    Discount
                    {parseFloat(invoice.discount_percent) > 0 &&
                      ` (${parseFloat(invoice.discount_percent)}%)`}
                  </span>
                  <span className="font-semibold text-red-600">
                    -{fmt(invoice.discount_amount, currencySymbol)}
                  </span>
                </div>
              )}

              {/* Tax / GST */}
              {taxAmt > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-sm">
                  <span className="text-gray-500">
                    Tax / GST
                    {parseFloat(invoice.tax_percent) > 0 &&
                      ` (${parseFloat(invoice.tax_percent)}%)`}
                  </span>
                  <span className="font-semibold text-gray-800">
                    {fmt(invoice.tax_amount, currencySymbol)}
                  </span>
                </div>
              )}

              {/* PhilHealth Coverage */}
              {philhealthCoverage > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-sm bg-gray-50/50">
                  <span className="text-gray-500">PhilHealth Coverage</span>
                  <span className="font-semibold text-emerald-600">
                    -{fmt(invoice.philhealth_coverage, currencySymbol)}
                  </span>
                </div>
              )}

              {/* HMO Coverage */}
              {hmoCoverage > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-sm">
                  <span className="text-gray-500">HMO Coverage</span>
                  <span className="font-semibold text-emerald-600">
                    -{fmt(invoice.hmo_coverage, currencySymbol)}
                  </span>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex justify-between px-4 py-3 bg-sky-600 text-white">
                <span className="font-bold text-sm">Total Amount</span>
                <span className="font-bold text-base">
                  {fmt(invoice.total_amount, currencySymbol)}
                </span>
              </div>

              {/* Amount Paid */}
              {amountPaid > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-sm">
                  <span className="text-gray-500">Amount Paid</span>
                  <span className="font-semibold text-emerald-600">
                    {fmt(invoice.amount_paid, currencySymbol)}
                  </span>
                </div>
              )}

              {/* Balance Due */}
              <div className="flex justify-between px-4 py-3 border-t-2 border-gray-200">
                <span className="font-bold text-sm text-gray-800">Balance Due</span>
                <span
                  className={`font-bold text-base ${
                    balanceDue <= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {fmt(invoice.balance_due, currencySymbol)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Payment History ── */}
          {showPaymentHistory && payments.length > 0 && (
            <div className="mb-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600 mb-3">
                Payment History
              </p>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-sky-600 text-white">
                      <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase">
                        Receipt #
                      </th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase">
                        Date
                      </th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase">
                        Method
                      </th>
                      <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase">
                        Reference
                      </th>
                      <th className="text-right py-2.5 px-4 text-xs font-semibold uppercase">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.map((p, idx) => (
                      <tr key={p.id} className={idx % 2 === 1 ? 'bg-gray-50/50' : ''}>
                        <td className="py-2.5 px-4 font-mono text-xs text-gray-700">
                          {p.receipt_number}
                        </td>
                        <td className="py-2.5 px-4 text-gray-700">{fmtDate(p.payment_date)}</td>
                        <td className="py-2.5 px-4 text-gray-700">
                          {p.payment_method}
                          {p.bank_name && (
                            <span className="ml-1 text-xs text-gray-500">
                              ({getBankByCode(p.bank_name)?.shortName ?? p.bank_name})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-gray-500">
                          {p.reference_number || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-gray-900">
                          {fmt(p.amount, currencySymbol)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Notes ── */}
          {invoice.notes && (
            <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1">
                Notes
              </p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}

          {/* ── Terms & Conditions ── */}
          {invoice.terms_conditions && (
            <div className="mb-8 text-xs text-gray-400 leading-relaxed">
              <p className="font-bold text-gray-500 mb-1">Terms & Conditions</p>
              <p className="whitespace-pre-wrap">{invoice.terms_conditions}</p>
            </div>
          )}
        </div>

        {/* ═══════════ MALASAKIT BRANDING ═══════════ */}
          <div className="px-8 pb-4">
            <DocumentFooter />
          </div>

        {/* ═══════════ CURVED FOOTER ═══════════ */}
        <div className="relative overflow-hidden rounded-b-2xl print:rounded-none mt-auto">
          {/* Curved top edge */}
          <div className="relative">
            <div className="absolute -top-12 left-1/2 w-[120%] h-12 bg-white rounded-[50%] -translate-x-1/2 z-10" />
            <div className="bg-sky-600 pt-8 pb-6 px-8 relative">
              {/* Decorative shapes */}
              <div className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full bg-sky-500/20" />
              <div className="absolute right-1/4 -top-6 w-32 h-32 rounded-full bg-sky-500/15" />

              <div className="relative z-10">
                {/* Contact Row */}
                <div className="flex items-center justify-center gap-6 text-sky-100 text-xs mb-3 flex-wrap">
                  {clinic?.phone && (
                    <span className="flex items-center gap-1">📞 {clinic.phone}</span>
                  )}
                  {clinic?.email && (
                    <span className="flex items-center gap-1">✉️ {clinic.email}</span>
                  )}
                  {clinic?.website && (
                    <span className="flex items-center gap-1">🌐 {clinic.website}</span>
                  )}
                </div>

                {/* Thank You & Next Appointment */}
                <p className="text-center text-sky-100 text-[12px] leading-relaxed font-medium max-w-lg mx-auto">
                  Thank you for choosing {clinicName || 'our clinic'}. We sincerely appreciate
                  the opportunity to provide you with our clinic services. Please contact us if
                  you have any questions regarding this invoice. Kindly settle this invoice
                  within 30 days. We look forward to seeing you again at your next appointment.
                </p>
                <div className="mt-2">
                  {nextAppointment ? (
                    <p className="text-xs text-emerald-300 font-semibold text-center">
                      Next Appointment: {new Date(nextAppointment.date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })} {nextAppointment.start_time}
                    </p>
                  ) : (
                    <p className="text-xs text-red-300 font-medium text-center">
                      No Further Appointments
                    </p>
                  )}
                </div>

                <p className="text-center text-sky-200 text-[10px] mt-2">
                  Generated on{' '}
                  {new Date().toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}{' '}
                  · {clinicName}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════ PRINT STYLES ═══════════ */}
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 0;
            }
            html, body {
              margin: 0;
              padding: 0;
              width: 210mm;
              height: 297mm;
              overflow: hidden;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            /* Prevent page breaks — force single page */
            * {
              page-break-before: avoid !important;
              page-break-after: avoid !important;
              page-break-inside: avoid !important;
              break-before: avoid !important;
              break-after: avoid !important;
              break-inside: avoid !important;
            }
            /* Compact spacing for print */
            .print\\:text-\\[13px\\] {
              font-size: 11px !important;
            }
          }
        `}</style>
      </div>
    );
  },
);

PMSInvoiceTemplate.displayName = 'PMSInvoiceTemplate';

export default PMSInvoiceTemplate;
