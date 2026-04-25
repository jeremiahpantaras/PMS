import React, { useState, useCallback } from 'react';
import { CreditCard, Users, DollarSign, TrendingDown } from 'lucide-react';
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
  getAccountCredits,
  type AccountCreditsResponse,
  type AccountCreditItem,
} from '../../reports.api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPeso = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Print builder ────────────────────────────────────────────────────────────

function buildPrintHtml(data: AccountCreditsResponse): string {
  const { summary, accounts, start_date, end_date, generated_at } = data;

  const rowsHtml = accounts.map((a) => `
    <tr>
      <td>
        <div class="patient-name">${a.patient_name}</div>
        <div class="patient-num">#${a.patient_number}</div>
      </td>
      <td style="text-align:right">${a.invoice_count}</td>
      <td style="text-align:right">${formatPeso(a.credit_created)}</td>
      <td style="text-align:right">${formatPeso(a.credit_used)}</td>
      <td style="text-align:right">${formatPeso(a.credit_refunded)}</td>
      <td style="text-align:right; font-weight:600; color:${a.balance > 0 ? '#dc2626' : '#16a34a'}">${formatPeso(a.balance)}</td>
    </tr>
  `).join('');

  return `
    <div class="header">
      <div class="header-left">
        <h1>Account Credits Report</h1>
        <p class="meta">${formatDate(start_date)} — ${formatDate(end_date)}</p>
        <p class="meta">Generated: ${new Date(generated_at).toLocaleString()}</p>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-value">${summary.total_accounts}</div><div class="stat-label">Accounts</div></div>
      <div class="stat"><div class="stat-value">${formatPeso(summary.total_credit_created)}</div><div class="stat-label">Total Invoiced</div></div>
      <div class="stat"><div class="stat-value">${formatPeso(summary.total_credit_used)}</div><div class="stat-label">Total Paid</div></div>
      <div class="stat"><div class="stat-value">${formatPeso(summary.total_balance)}</div><div class="stat-label">Outstanding Balance</div></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Client / Payer</th>
          <th style="text-align:right">Invoices</th>
          <th style="text-align:right">Credit Created</th>
          <th style="text-align:right">Credit Used</th>
          <th style="text-align:right">Refunded</th>
          <th style="text-align:right">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${accounts.length > 0 ? rowsHtml : '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:16px">No accounts found</td></tr>'}
      </tbody>
      <tfoot>
        <tr style="font-weight:700; background:#fef2f2">
          <td>Total</td>
          <td style="text-align:right">${accounts.reduce((a, i) => a + i.invoice_count, 0)}</td>
          <td style="text-align:right">${formatPeso(summary.total_credit_created)}</td>
          <td style="text-align:right">${formatPeso(summary.total_credit_used)}</td>
          <td style="text-align:right">—</td>
          <td style="text-align:right; color:#dc2626">${formatPeso(summary.total_balance)}</td>
        </tr>
      </tfoot>
    </table>
    <div class="footer">
      <span>Account Credits Report · ${formatDate(start_date)} – ${formatDate(end_date)}</span>
      <span>${new Date(generated_at).toLocaleString()}</span>
    </div>
  `;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AccountCreditsReport: React.FC = () => {
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate,   setEndDate]   = useState(todayISO());
  const [data,      setData]      = useState<AccountCreditsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [hasRun,    setHasRun]    = useState(false);
  const [search,    setSearch]    = useState('');

  const runReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAccountCredits({ start_date: startDate, end_date: endDate });
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? err?.message ?? 'Failed to load report.');
    } finally {
      setIsLoading(false);
      setHasRun(true);
    }
  }, [startDate, endDate]);

  const handlePrint = () => {
    if (!data) return;
    openPrintWindow(buildPrintHtml(data), 'Account Credits Report');
  };

  const accounts: AccountCreditItem[] = (data?.accounts ?? []).filter((a) =>
    search === '' ||
    a.patient_name.toLowerCase().includes(search.toLowerCase()) ||
    a.patient_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">

      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
        onApply={runReport}
        isLoading={isLoading}
        extra={
          <input
            type="text"
            placeholder="Search patient…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 w-48"
          />
        }
      />

      {isLoading && <ReportLoading />}
      {!isLoading && error && <ReportError message={error} onRetry={runReport} />}

      {!isLoading && !error && data && (
        <div className="mt-5 space-y-5">
          <ReportHeader
            title="Account Credits Report"
            description="Per-patient billing summary: invoiced vs. paid vs. balance"
            startDate={data.start_date}
            endDate={data.end_date}
            icon={<CreditCard className="w-5 h-5 text-white" />}
            totalBadge={`${data.summary.total_accounts} accounts`}
            actions={<PrintButton onClick={handlePrint} isLoading={isLoading} />}
          />

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Accounts" value={String(data.summary.total_accounts)} color="text-blue-700" bg="bg-blue-50" border="border-blue-200" icon={<Users className="w-5 h-5 text-blue-600" />} />
            <StatCard label="Total Invoiced" value={formatPeso(data.summary.total_credit_created)} color="text-purple-700" bg="bg-purple-50" border="border-purple-200" icon={<DollarSign className="w-5 h-5 text-purple-600" />} />
            <StatCard label="Total Paid" value={formatPeso(data.summary.total_credit_used)} color="text-green-700" bg="bg-green-50" border="border-green-200" icon={<CreditCard className="w-5 h-5 text-green-600" />} />
            <StatCard label="Outstanding" value={formatPeso(data.summary.total_balance)} color="text-red-700" bg="bg-red-50" border="border-red-200" icon={<TrendingDown className="w-5 h-5 text-red-600" />} />
          </div>

          {accounts.length === 0 ? (
            <ReportEmpty message={search ? `No accounts matching "${search}".` : 'No account data found for the selected date range.'} />
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Client / Payer</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Invoices</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Credit Created</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Credit Used</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Refunded</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {accounts.map((a) => (
                      <tr key={a.patient_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{a.patient_name}</div>
                          <div className="text-xs text-gray-400">#{a.patient_number}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{a.invoice_count}</td>
                        <td className="px-4 py-3 text-right text-purple-700 font-medium">{formatPeso(a.credit_created)}</td>
                        <td className="px-4 py-3 text-right text-green-700">{formatPeso(a.credit_used)}</td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          {a.credit_refunded > 0 ? formatPeso(a.credit_refunded) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold ${a.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatPeso(a.balance)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-red-50 border-t-2 border-red-200 font-bold">
                      <td className="px-4 py-3 text-gray-700">Total ({accounts.length} accounts)</td>
                      <td className="px-4 py-3 text-right text-gray-700">{accounts.reduce((a, i) => a + i.invoice_count, 0)}</td>
                      <td className="px-4 py-3 text-right text-purple-700">{formatPeso(accounts.reduce((a, i) => a + i.credit_created, 0))}</td>
                      <td className="px-4 py-3 text-right text-green-700">{formatPeso(accounts.reduce((a, i) => a + i.credit_used, 0))}</td>
                      <td className="px-4 py-3 text-right text-gray-400">—</td>
                      <td className="px-4 py-3 text-right text-red-700 text-base">{formatPeso(accounts.reduce((a, i) => a + i.balance, 0))}</td>
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
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
            <CreditCard className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-gray-900 font-semibold text-lg mb-1">Account Credits Report</p>
          <p className="text-gray-500 text-sm max-w-xs">
            Select a date range and click <strong>Run Report</strong> to view per-patient billing balances.
          </p>
        </div>
      )}
    </div>
  );
};
