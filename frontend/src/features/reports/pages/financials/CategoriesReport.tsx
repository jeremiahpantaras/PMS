import React, { useState, useCallback } from 'react';
import { Tag, DollarSign, CheckCircle, TrendingUp } from 'lucide-react';
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
  getCategories,
  type CategoriesResponse,
  type CategoryReportItem,
} from '../../reports.api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPeso = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORY_LABELS: Record<string, string> = {
  INITIAL:       'Initial Consultation',
  FOLLOW_UP:     'Follow-up',
  THERAPY:       'Therapy Session',
  ASSESSMENT:    'Assessment',
  UNCATEGORIZED: 'Uncategorized',
};

const CATEGORY_COLORS = [
  'bg-purple-50 text-purple-700 border-purple-200',
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-pink-50 text-pink-700 border-pink-200',
  'bg-green-50 text-green-700 border-green-200',
];

// ─── Print builder ────────────────────────────────────────────────────────────

function buildPrintHtml(data: CategoriesResponse): string {
  const { summary, categories, start_date, end_date, generated_at } = data;

  const rowsHtml = categories.map((c) => `
    <tr>
      <td>${CATEGORY_LABELS[c.category] ?? c.category.replace(/_/g, ' ')}</td>
      <td style="text-align:right">${c.invoice_count}</td>
      <td style="text-align:right; font-weight:600">${formatPeso(c.total_revenue)}</td>
      <td style="text-align:right">${formatPeso(c.total_payments)}</td>
      <td style="text-align:right; color:${c.outstanding > 0 ? '#dc2626' : '#16a34a'}">${formatPeso(c.outstanding)}</td>
    </tr>
  `).join('');

  return `
    <div class="header">
      <div class="header-left">
        <h1>Categories Report</h1>
        <p class="meta">${formatDate(start_date)} — ${formatDate(end_date)}</p>
        <p class="meta">Generated: ${new Date(generated_at).toLocaleString()}</p>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-value">${formatPeso(summary.total_revenue)}</div><div class="stat-label">Total Revenue</div></div>
      <div class="stat"><div class="stat-value">${formatPeso(summary.total_payments)}</div><div class="stat-label">Total Payments</div></div>
      <div class="stat"><div class="stat-value">${formatPeso(summary.outstanding)}</div><div class="stat-label">Outstanding</div></div>
      <div class="stat"><div class="stat-value">${summary.total_categories}</div><div class="stat-label">Categories</div></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th style="text-align:right">Invoices</th>
          <th style="text-align:right">Total Revenue</th>
          <th style="text-align:right">Total Payments</th>
          <th style="text-align:right">Outstanding</th>
        </tr>
      </thead>
      <tbody>
        ${categories.length > 0 ? rowsHtml : '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:16px">No data found</td></tr>'}
      </tbody>
      <tfoot>
        <tr style="font-weight:700; background:#f5f3ff">
          <td>Total</td>
          <td style="text-align:right">${categories.reduce((a, c) => a + c.invoice_count, 0)}</td>
          <td style="text-align:right; color:#15803d">${formatPeso(summary.total_revenue)}</td>
          <td style="text-align:right">${formatPeso(summary.total_payments)}</td>
          <td style="text-align:right; color:#dc2626">${formatPeso(summary.outstanding)}</td>
        </tr>
      </tfoot>
    </table>
    <div class="footer">
      <span>Categories Report · ${formatDate(start_date)} – ${formatDate(end_date)}</span>
      <span>${new Date(generated_at).toLocaleString()}</span>
    </div>
  `;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CategoriesReport: React.FC = () => {
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate,   setEndDate]   = useState(todayISO());
  const [data,      setData]      = useState<CategoriesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [hasRun,    setHasRun]    = useState(false);

  const runReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getCategories({ start_date: startDate, end_date: endDate });
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
    openPrintWindow(buildPrintHtml(data), 'Categories Report');
  };

  const categories: CategoryReportItem[] = data?.categories ?? [];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">

      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
        onApply={runReport}
        isLoading={isLoading}
      />

      {isLoading && <ReportLoading />}
      {!isLoading && error && <ReportError message={error} onRetry={runReport} />}

      {!isLoading && !error && data && (
        <div className="mt-5 space-y-5">
          <ReportHeader
            title="Categories Report"
            description="Revenue and payments grouped by appointment category"
            startDate={data.start_date}
            endDate={data.end_date}
            icon={<Tag className="w-5 h-5 text-white" />}
            totalBadge={`${data.summary.total_categories} categories`}
            actions={<PrintButton onClick={handlePrint} isLoading={isLoading} />}
          />

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Revenue" value={formatPeso(data.summary.total_revenue)} color="text-purple-700" bg="bg-purple-50" border="border-purple-200" icon={<TrendingUp className="w-5 h-5 text-purple-600" />} />
            <StatCard label="Total Payments" value={formatPeso(data.summary.total_payments)} color="text-green-700" bg="bg-green-50" border="border-green-200" icon={<CheckCircle className="w-5 h-5 text-green-600" />} />
            <StatCard label="Outstanding" value={formatPeso(data.summary.outstanding)} color="text-orange-700" bg="bg-orange-50" border="border-orange-200" icon={<DollarSign className="w-5 h-5 text-orange-600" />} />
            <StatCard label="Categories" value={String(data.summary.total_categories)} color="text-blue-700" bg="bg-blue-50" border="border-blue-200" icon={<Tag className="w-5 h-5 text-blue-600" />} />
          </div>

          {categories.length === 0 ? (
            <ReportEmpty />
          ) : (
            <>
              {/* Category breakdown cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((c, idx) => {
                  const pct = data.summary.total_revenue > 0
                    ? ((c.total_revenue / data.summary.total_revenue) * 100).toFixed(1)
                    : '0.0';
                  const colorClass = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                  return (
                    <div key={c.category} className={`rounded-xl p-4 border ${colorClass.split(' ').slice(0, 2).join(' ')} border-opacity-50`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClass}`}>
                          {CATEGORY_LABELS[c.category] ?? c.category.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-gray-500">{pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 rounded-full bg-current opacity-50" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-500">Revenue</p>
                          <p className="text-sm font-bold text-gray-900">{formatPeso(c.total_revenue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Collected</p>
                          <p className="text-sm font-bold text-gray-900">{formatPeso(c.total_payments)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Outstanding</p>
                          <p className={`text-sm font-bold ${c.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatPeso(c.outstanding)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Invoices</p>
                          <p className="text-sm font-bold text-gray-900">{c.invoice_count}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detail Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Invoices</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Total Revenue</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Total Payments</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {categories.map((c, idx) => (
                        <tr key={c.category} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}`}>
                              {CATEGORY_LABELS[c.category] ?? c.category.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{c.invoice_count}</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-700">{formatPeso(c.total_revenue)}</td>
                          <td className="px-4 py-3 text-right text-blue-700">{formatPeso(c.total_payments)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${c.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatPeso(c.outstanding)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-purple-50 border-t-2 border-purple-200 font-bold">
                        <td className="px-4 py-3 text-gray-700">Total</td>
                        <td className="px-4 py-3 text-right text-gray-700">{categories.reduce((a, c) => a + c.invoice_count, 0)}</td>
                        <td className="px-4 py-3 text-right text-green-700 text-base">{formatPeso(data.summary.total_revenue)}</td>
                        <td className="px-4 py-3 text-right text-blue-700">{formatPeso(data.summary.total_payments)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{formatPeso(data.summary.outstanding)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {!isLoading && !error && !hasRun && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-4">
            <Tag className="w-8 h-8 text-purple-500" />
          </div>
          <p className="text-gray-900 font-semibold text-lg mb-1">Categories Report</p>
          <p className="text-gray-500 text-sm max-w-xs">
            Select a date range and click <strong>Run Report</strong> to view revenue broken down by appointment category.
          </p>
        </div>
      )}
    </div>
  );
};
