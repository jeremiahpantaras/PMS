import React, { useState, useCallback } from 'react';
import {
  DollarSign, CheckCircle2, Clock, AlertCircle, ReceiptText,
} from 'lucide-react';
import {
  getAppointmentCosts,
  type AppointmentCostsResponse,
  type AppointmentCostItem,
} from '../../reports.api';
import {
  DateRangePicker,
  StatCard,
  ReportLoading,
  ReportError,
  ReportEmpty,
  ReportHeader,
  PrintButton,
  openPrintWindow,
  StatusBadge,
  formatDate,
  todayISO,
  monthStart,
} from '../../components/ReportShared';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPeso = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Print builder ────────────────────────────────────────────────────────────

function buildAppointmentCostsPrintHtml(data: AppointmentCostsResponse): string {
  const { summary, appointments, start_date, end_date, generated_at } = data;

  const rowsHtml = appointments.map((item) => `
    <tr>
      <td>
        <div class="time-primary">${item.invoice_number}</div>
        <div class="time-secondary">${formatDate(item.invoice_date)}</div>
      </td>
      <td>
        <div class="patient-name">${item.patient_name}</div>
        <div class="patient-num">#${item.patient_number}</div>
      </td>
      <td>${item.practitioner_name || '—'}</td>
      <td>${item.appointment_type ? item.appointment_type.replace(/_/g, ' ') : '—'}</td>
      <td>${formatDate(item.appointment_date)}</td>
      <td style="text-align:right">${formatPeso(item.total_amount)}</td>
      <td style="text-align:right">${formatPeso(item.paid_amount)}</td>
      <td style="text-align:right; font-weight:600; color: ${item.balance_due > 0 ? '#dc2626' : '#16a34a'}">${formatPeso(item.balance_due)}</td>
      <td>
        <span class="badge ${
          item.payment_status === 'PAID' ? 'badge-green'
          : item.payment_status === 'PARTIALLY_PAID' ? 'badge-blue'
          : item.payment_status === 'OVERDUE' ? 'badge-red'
          : 'badge-orange'
        }">${item.payment_status.replace(/_/g, ' ')}</span>
      </td>
    </tr>
  `).join('');

  return `
    <div class="header">
      <div class="header-left">
        <h1>Appointment Costs Report</h1>
        <p class="meta">${formatDate(start_date)} — ${formatDate(end_date)}</p>
        <p class="meta">Generated: ${new Date(generated_at).toLocaleString()}</p>
      </div>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${formatPeso(summary.total_revenue)}</div>
        <div class="stat-label">Total Revenue</div>
      </div>
      <div class="stat">
        <div class="stat-value">${formatPeso(summary.paid_total)}</div>
        <div class="stat-label">Paid Total</div>
      </div>
      <div class="stat">
        <div class="stat-value">${formatPeso(summary.unpaid_total)}</div>
        <div class="stat-label">Unpaid Total</div>
      </div>
      <div class="stat">
        <div class="stat-value">${formatPeso(summary.outstanding_balance)}</div>
        <div class="stat-label">Outstanding Balance</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Patient</th>
          <th>Practitioner</th>
          <th>Appt. Type</th>
          <th>Date</th>
          <th style="text-align:right">Total</th>
          <th style="text-align:right">Paid</th>
          <th style="text-align:right">Balance</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${appointments.length > 0 ? rowsHtml : '<tr><td colspan="9" style="text-align:center;color:#9ca3af;padding:16px">No records found</td></tr>'}
      </tbody>
    </table>
    <div class="footer">
      <span>Appointment Costs Report · ${formatDate(start_date)} – ${formatDate(end_date)}</span>
      <span>${new Date(generated_at).toLocaleString()}</span>
    </div>
  `;
}

// ─── Component ────────────────────────────────────────────────────────────────

type StatusFilter = 'ALL' | 'PAID' | 'UNPAID' | 'PARTIALLY_PAID';

export const AppointmentCosts: React.FC = () => {
  const [startDate,    setStartDate]    = useState(monthStart());
  const [endDate,      setEndDate]      = useState(todayISO());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [data,         setData]         = useState<AppointmentCostsResponse | null>(null);
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [hasRun,       setHasRun]       = useState(false);

  const runReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getAppointmentCosts({
        start_date:     startDate,
        end_date:       endDate,
        payment_status: statusFilter,
      });
      setData(result);
      setHasRun(true);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to load appointment costs';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, statusFilter]);

  const handlePrint = () => {
    if (!data) return;
    openPrintWindow(buildAppointmentCostsPrintHtml(data), 'Appointment Costs Report');
  };

  const appointments: AppointmentCostItem[] = data?.appointments ?? [];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">

      {/* ── Filters Bar ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 shadow-sm">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          isLoading={isLoading}
          onApply={runReport}
          extra={
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Payment Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:ring-2 focus:ring-teal-400 focus:border-teal-400 outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
              </select>
            </div>
          }
        />
      </div>

      {/* ── States ── */}
      {isLoading && <ReportLoading />}

      {!isLoading && error && (
        <ReportError message={error} onRetry={runReport} />
      )}

      {/* ── Report Content ── */}
      {!isLoading && !error && data && (
        <>
          {/* Header */}
          <ReportHeader
            title="Appointment Costs Report"
            description="Invoice revenue tracking — paid, unpaid, and outstanding balances"
            startDate={data.start_date}
            endDate={data.end_date}
            icon={<DollarSign className="w-5 h-5" />}
            totalBadge={
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
                {data.summary.total_invoices} invoices
              </span>
            }
            actions={<PrintButton onClick={handlePrint} label="Print Report" />}
          />

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Revenue"
              value={formatPeso(data.summary.total_revenue)}
              color="text-teal-700"
              bg="bg-teal-50"
              border="border-teal-200"
              icon={<DollarSign className="w-5 h-5" />}
            />
            <StatCard
              label={`Paid (${data.summary.paid_count})`}
              value={formatPeso(data.summary.paid_total)}
              color="text-green-700"
              bg="bg-green-50"
              border="border-green-200"
              icon={<CheckCircle2 className="w-5 h-5" />}
            />
            <StatCard
              label={`Unpaid (${data.summary.unpaid_count})`}
              value={formatPeso(data.summary.unpaid_total)}
              color="text-amber-700"
              bg="bg-amber-50"
              border="border-amber-200"
              icon={<Clock className="w-5 h-5" />}
            />
            <StatCard
              label="Outstanding Balance"
              value={formatPeso(data.summary.outstanding_balance)}
              color="text-red-700"
              bg="bg-red-50"
              border="border-red-200"
              icon={<AlertCircle className="w-5 h-5" />}
            />
          </div>

          {/* Partial count callout */}
          {data.summary.partial_count > 0 && (
            <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <ReceiptText className="w-4 h-4 text-blue-600 shrink-0" />
              <p className="text-xs text-blue-700">
                <strong>{data.summary.partial_count}</strong> invoices are partially paid with a remaining balance.
              </p>
            </div>
          )}

          {/* Paid / Unpaid breakdown bar */}
          {data.summary.total_revenue > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-5">
              <div className="flex justify-between text-xs font-medium text-gray-600 mb-2">
                <span>Paid ({((data.summary.paid_total / data.summary.total_revenue) * 100).toFixed(1)}%)</span>
                <span>Unpaid ({((data.summary.unpaid_total / data.summary.total_revenue) * 100).toFixed(1)}%)</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-green-500 h-full rounded-l-full transition-all"
                  style={{ width: `${(data.summary.paid_total / data.summary.total_revenue) * 100}%` }}
                />
                <div
                  className="bg-amber-400 h-full transition-all"
                  style={{ width: `${(data.summary.unpaid_total / data.summary.total_revenue) * 100}%` }}
                />
              </div>
              <div className="flex gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Paid
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Unpaid / Overdue
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />Partial
                </span>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {appointments.length === 0 ? (
              <ReportEmpty message="No invoices found for the selected period and filters." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Invoice</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Practitioner</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Appt. Date</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Total</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Paid</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">Balance</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {appointments.map((item) => (
                      <tr key={item.invoice_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs font-semibold text-gray-800">{item.invoice_number}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{formatDate(item.invoice_date)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{item.patient_name}</div>
                          <div className="text-xs text-gray-400">#{item.patient_number}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{item.practitioner_name || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 text-sm whitespace-nowrap">{formatDate(item.appointment_date)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">{formatPeso(item.total_amount)}</td>
                        <td className="px-4 py-3 text-right text-green-700 font-medium">{formatPeso(item.paid_amount)}</td>
                        <td className="px-4 py-3 text-right font-bold">
                          <span className={item.balance_due > 0 ? 'text-red-600' : 'text-gray-400'}>
                            {formatPeso(item.balance_due)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={item.payment_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals row */}
                  <tfoot className="bg-teal-50 border-t-2 border-teal-200">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">
                        Totals ({appointments.length} invoices)
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{formatPeso(data.summary.total_revenue)}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-700">{formatPeso(data.summary.paid_total)}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">{formatPeso(data.summary.outstanding_balance)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 mt-4 text-right">
            Generated: {new Date(data.generated_at).toLocaleString()}
          </p>
        </>
      )}

      {/* ── Initial State ── */}
      {!isLoading && !error && !hasRun && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-teal-200">
            <DollarSign className="w-8 h-8 text-teal-500" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Appointment Costs Report</p>
          <p className="text-xs text-gray-500 max-w-xs mb-4">
            Track invoice revenue from appointments — paid, unpaid, and outstanding balances by date range.
          </p>
          <button
            onClick={runReport}
            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            Run Report
          </button>
        </div>
      )}
    </div>
  );
};

