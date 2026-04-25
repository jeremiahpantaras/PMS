import React, { useState, useCallback } from 'react';
import { Clock, AlertTriangle, DollarSign, FileText } from 'lucide-react';
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
  StatusBadge,
} from '../../components/ReportShared';
import {
  getAgeingDebts,
  type AgeingDebtsResponse,
  type AgeingDebtItem,
} from '../../reports.api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPeso = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BUCKET_LABELS: Record<string, string> = {
  '0_30':    '0–30 days',
  '31_60':   '31–60 days',
  '61_90':   '61–90 days',
  '90_plus': '90+ days',
};

const BUCKET_STYLES: Record<string, string> = {
  '0_30':    'bg-yellow-50 text-yellow-700 border-yellow-200',
  '31_60':   'bg-orange-50 text-orange-700 border-orange-200',
  '61_90':   'bg-red-50 text-red-700 border-red-200',
  '90_plus': 'bg-rose-100 text-rose-800 border-rose-300',
};

// ─── Print builder ────────────────────────────────────────────────────────────

function buildPrintHtml(data: AgeingDebtsResponse): string {
  const { summary, debts, generated_at } = data;
  const bt = summary.bucket_totals;

  const rowsHtml = debts.map((d) => `
    <tr>
      <td>
        <div class="patient-name">${d.patient_name}</div>
        <div class="patient-num">#${d.patient_number}</div>
      </td>
      <td>
        <div class="time-primary">${d.invoice_number}</div>
        <div class="time-secondary">${formatDate(d.invoice_date)}</div>
      </td>
      <td>${d.days_overdue} days</td>
      <td style="text-align:right">${d['0_30'] > 0 ? formatPeso(d['0_30']) : '—'}</td>
      <td style="text-align:right">${d['31_60'] > 0 ? formatPeso(d['31_60']) : '—'}</td>
      <td style="text-align:right">${d['61_90'] > 0 ? formatPeso(d['61_90']) : '—'}</td>
      <td style="text-align:right">${d['90_plus'] > 0 ? formatPeso(d['90_plus']) : '—'}</td>
      <td style="text-align:right; font-weight:600; color:#dc2626">${formatPeso(d.balance_due)}</td>
    </tr>
  `).join('');

  return `
    <div class="header">
      <div class="header-left">
        <h1>Ageing Debts Report</h1>
        <p class="meta">As at: ${new Date(generated_at).toLocaleDateString()}</p>
        <p class="meta">Generated: ${new Date(generated_at).toLocaleString()}</p>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-value">${formatPeso(summary.total_outstanding)}</div><div class="stat-label">Total Outstanding</div></div>
      <div class="stat"><div class="stat-value">${formatPeso(bt['0_30'])}</div><div class="stat-label">0–30 Days</div></div>
      <div class="stat"><div class="stat-value">${formatPeso(bt['31_60'])}</div><div class="stat-label">31–60 Days</div></div>
      <div class="stat"><div class="stat-value">${formatPeso(bt['61_90'])}</div><div class="stat-label">61–90 Days</div></div>
      <div class="stat"><div class="stat-value">${formatPeso(bt['90_plus'])}</div><div class="stat-label">90+ Days</div></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Client</th><th>Invoice</th><th>Age</th>
          <th style="text-align:right">0–30</th>
          <th style="text-align:right">31–60</th>
          <th style="text-align:right">61–90</th>
          <th style="text-align:right">90+</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${debts.length > 0 ? rowsHtml : '<tr><td colspan="8" style="text-align:center;color:#9ca3af;padding:16px">No overdue invoices found</td></tr>'}
      </tbody>
      <tfoot>
        <tr style="font-weight:700; background:#fef2f2">
          <td colspan="3">Totals</td>
          <td style="text-align:right">${formatPeso(bt['0_30'])}</td>
          <td style="text-align:right">${formatPeso(bt['31_60'])}</td>
          <td style="text-align:right">${formatPeso(bt['61_90'])}</td>
          <td style="text-align:right">${formatPeso(bt['90_plus'])}</td>
          <td style="text-align:right; color:#dc2626">${formatPeso(summary.total_outstanding)}</td>
        </tr>
      </tfoot>
    </table>
    <div class="footer">
      <span>Ageing Debts Report</span>
      <span>${new Date(generated_at).toLocaleString()}</span>
    </div>
  `;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AgeingDebtsReport: React.FC = () => {
  const [data,      setData]      = useState<AgeingDebtsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [hasRun,    setHasRun]    = useState(false);

  const runReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAgeingDebts();
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? err?.message ?? 'Failed to load report.');
    } finally {
      setIsLoading(false);
      setHasRun(true);
    }
  }, []);

  const handlePrint = () => {
    if (!data) return;
    openPrintWindow(buildPrintHtml(data), 'Ageing Debts Report');
  };

  const debts: AgeingDebtItem[] = data?.debts ?? [];
  const bt = data?.summary.bucket_totals;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">

      {/* Filters — no date range needed (always "as at today") */}
      <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 mb-5">
        <div>
          <p className="text-sm font-semibold text-gray-700">Current Outstanding Debts</p>
          <p className="text-xs text-gray-500 mt-0.5">Shows all unpaid and partially-paid invoices as at today</p>
        </div>
        <button
          onClick={runReport}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {isLoading ? 'Loading…' : 'Run Report'}
        </button>
      </div>

      {isLoading && <ReportLoading />}
      {!isLoading && error && <ReportError message={error} onRetry={runReport} />}

      {!isLoading && !error && data && (
        <div className="space-y-5">
          <ReportHeader
            title="Ageing Debts Report"
            description="Unpaid and partially-paid invoices by age bucket"
            startDate=""
            endDate=""
            icon={<Clock className="w-5 h-5 text-white" />}
            totalBadge={`${data.summary.total_invoices} invoices`}
            actions={<PrintButton onClick={handlePrint} isLoading={isLoading} />}
          />

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Total Outstanding" value={formatPeso(data.summary.total_outstanding)} color="text-red-700" bg="bg-red-50" border="border-red-200" icon={<DollarSign className="w-5 h-5 text-red-600" />} />
            <StatCard label="0–30 Days" value={formatPeso(bt!['0_30'])} color="text-yellow-700" bg="bg-yellow-50" border="border-yellow-200" icon={<Clock className="w-5 h-5 text-yellow-600" />} />
            <StatCard label="31–60 Days" value={formatPeso(bt!['31_60'])} color="text-orange-700" bg="bg-orange-50" border="border-orange-200" icon={<Clock className="w-5 h-5 text-orange-600" />} />
            <StatCard label="61–90 Days" value={formatPeso(bt!['61_90'])} color="text-red-700" bg="bg-red-50" border="border-red-200" icon={<AlertTriangle className="w-5 h-5 text-red-600" />} />
            <StatCard label="90+ Days" value={formatPeso(bt!['90_plus'])} color="text-rose-800" bg="bg-rose-100" border="border-rose-300" icon={<AlertTriangle className="w-5 h-5 text-rose-700" />} />
          </div>

          {debts.length === 0 ? (
            <ReportEmpty message="No outstanding debts found. All invoices are paid." />
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Invoice</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Age</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                      <th className="text-right px-4 py-3 font-semibold text-yellow-700">0–30</th>
                      <th className="text-right px-4 py-3 font-semibold text-orange-700">31–60</th>
                      <th className="text-right px-4 py-3 font-semibold text-red-700">61–90</th>
                      <th className="text-right px-4 py-3 font-semibold text-rose-800">90+</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {debts.map((d) => (
                      <tr key={d.invoice_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{d.patient_name}</div>
                          <div className="text-xs text-gray-400">#{d.patient_number}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-gray-700">{d.invoice_number}</div>
                          <div className="text-xs text-gray-400">{formatDate(d.invoice_date)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${BUCKET_STYLES[d.bucket]}`}>
                            {d.days_overdue}d
                          </span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                        <td className="px-4 py-3 text-right text-sm text-yellow-700">{d['0_30'] > 0 ? formatPeso(d['0_30']) : '—'}</td>
                        <td className="px-4 py-3 text-right text-sm text-orange-700">{d['31_60'] > 0 ? formatPeso(d['31_60']) : '—'}</td>
                        <td className="px-4 py-3 text-right text-sm text-red-700">{d['61_90'] > 0 ? formatPeso(d['61_90']) : '—'}</td>
                        <td className="px-4 py-3 text-right text-sm text-rose-800">{d['90_plus'] > 0 ? formatPeso(d['90_plus']) : '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-700">{formatPeso(d.balance_due)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-red-50 border-t-2 border-red-200 font-bold">
                      <td colSpan={4} className="px-4 py-3 text-gray-700">Totals</td>
                      <td className="px-4 py-3 text-right text-yellow-700">{formatPeso(bt!['0_30'])}</td>
                      <td className="px-4 py-3 text-right text-orange-700">{formatPeso(bt!['31_60'])}</td>
                      <td className="px-4 py-3 text-right text-red-700">{formatPeso(bt!['61_90'])}</td>
                      <td className="px-4 py-3 text-right text-rose-800">{formatPeso(bt!['90_plus'])}</td>
                      <td className="px-4 py-3 text-right text-red-700 text-base">{formatPeso(data.summary.total_outstanding)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && !error && !hasRun && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-gray-900 font-semibold text-lg mb-1">Ageing Debts Report</p>
          <p className="text-gray-500 text-sm max-w-xs">
            Click <strong>Run Report</strong> to see all outstanding invoices categorised by how overdue they are.
          </p>
        </div>
      )}
    </div>
  );
};
