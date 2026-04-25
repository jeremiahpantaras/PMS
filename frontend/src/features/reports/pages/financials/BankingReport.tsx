import React, { useState, useCallback } from 'react';
import { Banknote, CreditCard, Smartphone, Building2, DollarSign } from 'lucide-react';
import {
  DateRangePicker,
  ReportHeader,
  StatCard,
  ReportLoading,
  ReportError,
  ReportEmpty,
  PrintButton,
  openPrintWindow,
  formatDate,
  monthStart,
  todayISO,
} from '../../components/ReportShared';
import {
  getBanking,
  type BankingResponse,
  type BankingPaymentItem,
} from '../../reports.api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPeso = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const METHOD_LABELS: Record<string, string> = {
  CASH:          'Cash',
  GCASH:         'GCash',
  PAYMAYA:       'PayMaya',
  CREDIT_CARD:   'Credit Card',
  DEBIT_CARD:    'Debit Card',
  BANK_TRANSFER: 'Bank Transfer',
  CHECK:         'Check',
};

const METHOD_ICON: Record<string, React.ReactNode> = {
  CASH:          <Banknote className="w-4 h-4" />,
  GCASH:         <Smartphone className="w-4 h-4" />,
  PAYMAYA:       <Smartphone className="w-4 h-4" />,
  CREDIT_CARD:   <CreditCard className="w-4 h-4" />,
  DEBIT_CARD:    <CreditCard className="w-4 h-4" />,
  BANK_TRANSFER: <Building2 className="w-4 h-4" />,
  CHECK:         <DollarSign className="w-4 h-4" />,
};

// ─── Print builder ────────────────────────────────────────────────────────────

function buildPrintHtml(data: BankingResponse): string {
  const { summary, payments, start_date, end_date, generated_at } = data;

  const methodRows = Object.entries(summary.method_totals)
    .map(([m, total]) => `
      <tr>
        <td>${METHOD_LABELS[m] ?? m}</td>
        <td style="text-align:right; font-weight:600">${formatPeso(total)}</td>
      </tr>
    `)
    .join('');

  const rowsHtml = payments.map((p) => `
    <tr>
      <td>${formatDate(p.date)}</td>
      <td>${METHOD_LABELS[p.payment_method] ?? p.payment_method}</td>
      <td>${p.patient_name}</td>
      <td>${p.invoice_number}</td>
      <td>${p.receipt_number}</td>
      <td style="text-align:right; font-weight:600">${formatPeso(p.amount)}</td>
    </tr>
  `).join('');

  return `
    <div class="header">
      <div class="header-left">
        <h1>Banking Report</h1>
        <p class="meta">${formatDate(start_date)} — ${formatDate(end_date)}</p>
        <p class="meta">Generated: ${new Date(generated_at).toLocaleString()}</p>
      </div>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${formatPeso(summary.grand_total)}</div>
        <div class="stat-label">Grand Total</div>
      </div>
      <div class="stat">
        <div class="stat-value">${summary.total_transactions}</div>
        <div class="stat-label">Transactions</div>
      </div>
    </div>

    <h2 style="margin-top:16px; margin-bottom:6px">Summary by Payment Method</h2>
    <table>
      <thead><tr><th>Method</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${methodRows}</tbody>
    </table>

    <h2 style="margin-top:16px; margin-bottom:6px">Transaction Detail</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Method</th>
          <th>Patient</th>
          <th>Invoice</th>
          <th>Receipt</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${payments.length > 0
          ? rowsHtml
          : '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:16px">No records found</td></tr>'}
      </tbody>
    </table>
    <div class="footer">
      <span>Banking Report · ${formatDate(start_date)} – ${formatDate(end_date)}</span>
      <span>${new Date(generated_at).toLocaleString()}</span>
    </div>
  `;
}

// ─── Component ────────────────────────────────────────────────────────────────

const PAYMENT_METHODS = ['ALL', 'CASH', 'GCASH', 'PAYMAYA', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CHECK'];

export const BankingReport: React.FC = () => {
  const [startDate,     setStartDate]     = useState(monthStart());
  const [endDate,       setEndDate]       = useState(todayISO());
  const [methodFilter,  setMethodFilter]  = useState('ALL');
  const [data,          setData]          = useState<BankingResponse | null>(null);
  const [isLoading,     setIsLoading]     = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [hasRun,        setHasRun]        = useState(false);

  const runReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getBanking({
        start_date:     startDate,
        end_date:       endDate,
        payment_method: methodFilter === 'ALL' ? undefined : methodFilter,
      });
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? err?.message ?? 'Failed to load report.');
    } finally {
      setIsLoading(false);
      setHasRun(true);
    }
  }, [startDate, endDate, methodFilter]);

  const handlePrint = () => {
    if (!data) return;
    openPrintWindow(buildPrintHtml(data), 'Banking Report');
  };

  const payments: BankingPaymentItem[] = data?.payments ?? [];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">

      {/* Filters */}
      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
        onApply={runReport}
        isLoading={isLoading}
        extra={
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Method</label>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m === 'ALL' ? 'All Methods' : (METHOD_LABELS[m] ?? m)}</option>
              ))}
            </select>
          </div>
        }
      />

      {/* Loading / Error */}
      {isLoading && <ReportLoading />}
      {!isLoading && error && <ReportError message={error} onRetry={runReport} />}

      {/* Results */}
      {!isLoading && !error && data && (
        <div className="mt-5 space-y-5">
          <ReportHeader
            title="Banking Report"
            description="Actual money received, grouped by payment method"
            startDate={data.start_date}
            endDate={data.end_date}
            icon={<Banknote className="w-5 h-5 text-white" />}
            totalBadge={`${data.summary.total_transactions} transactions`}
            actions={<PrintButton onClick={handlePrint} isLoading={isLoading} />}
          />

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Grand Total"
              value={formatPeso(data.summary.grand_total)}
              color="text-green-700"
              bg="bg-green-50"
              border="border-green-200"
              icon={<DollarSign className="w-5 h-5 text-green-600" />}
            />
            {Object.entries(data.summary.method_totals).map(([method, total]) => (
              <StatCard
                key={method}
                label={METHOD_LABELS[method] ?? method}
                value={formatPeso(total)}
                color="text-blue-700"
                bg="bg-blue-50"
                border="border-blue-200"
                icon={METHOD_ICON[method] ?? <DollarSign className="w-5 h-5 text-blue-600" />}
              />
            ))}
          </div>

          {/* Table */}
          {payments.length === 0 ? (
            <ReportEmpty message="No payment transactions found for the selected date range." />
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Method</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Patient</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Invoice</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Receipt</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {payments.map((p) => (
                      <tr key={p.payment_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-700">{formatDate(p.date)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            {METHOD_ICON[p.payment_method]}
                            {METHOD_LABELS[p.payment_method] ?? p.payment_method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{p.patient_name}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.invoice_number}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.receipt_number}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-700">{formatPeso(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-green-50 border-t-2 border-green-200">
                      <td colSpan={5} className="px-4 py-3 font-bold text-gray-700">Grand Total</td>
                      <td className="px-4 py-3 text-right font-bold text-green-700 text-base">
                        {formatPeso(data.summary.grand_total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state before first run */}
      {!isLoading && !error && !hasRun && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-4">
            <Banknote className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-gray-900 font-semibold text-lg mb-1">Banking Report</p>
          <p className="text-gray-500 text-sm max-w-xs">
            Select a date range and click <strong>Run Report</strong> to view payment transactions grouped by method.
          </p>
        </div>
      )}
    </div>
  );
};
