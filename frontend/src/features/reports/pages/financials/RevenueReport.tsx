import React, { useState, useCallback } from 'react';
import { TrendingUp, DollarSign, CheckCircle, FileText } from 'lucide-react';
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
  getRevenue,
  type RevenueResponse,
  type RevenueServiceItem,
} from '../../reports.api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPeso = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Print builder ────────────────────────────────────────────────────────────

function buildPrintHtml(data: RevenueResponse): string {
  const { summary, services, start_date, end_date, generated_at } = data;

  const rowsHtml = services.map((s) => `
    <tr>
      <td>${s.service_type || 'Unknown Service'}</td>
      <td style="text-align:right">${s.quantity.toLocaleString()}</td>
      <td style="text-align:right; font-weight:600">${formatPeso(s.total_amount)}</td>
    </tr>
  `).join('');

  return `
    <div class="header">
      <div class="header-left">
        <h1>Revenue Report</h1>
        <p class="meta">${formatDate(start_date)} — ${formatDate(end_date)}</p>
        <p class="meta">Generated: ${new Date(generated_at).toLocaleString()}</p>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-value">${formatPeso(summary.total_revenue)}</div><div class="stat-label">Total Revenue</div></div>
      <div class="stat"><div class="stat-value">${formatPeso(summary.total_paid)}</div><div class="stat-label">Total Paid</div></div>
      <div class="stat"><div class="stat-value">${formatPeso(summary.total_balance)}</div><div class="stat-label">Outstanding</div></div>
      <div class="stat"><div class="stat-value">${summary.total_services}</div><div class="stat-label">Service Types</div></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Service Type</th>
          <th style="text-align:right">Quantity</th>
          <th style="text-align:right">Total Amount</th>
        </tr>
      </thead>
      <tbody>
        ${services.length > 0 ? rowsHtml : '<tr><td colspan="3" style="text-align:center;color:#9ca3af;padding:16px">No data found</td></tr>'}
      </tbody>
      <tfoot>
        <tr style="font-weight:700; background:#f0fdf4">
          <td>Total</td>
          <td style="text-align:right">${services.reduce((a, s) => a + s.quantity, 0).toLocaleString()}</td>
          <td style="text-align:right; color:#15803d">${formatPeso(summary.total_revenue)}</td>
        </tr>
      </tfoot>
    </table>
    <div class="footer">
      <span>Revenue Report · ${formatDate(start_date)} – ${formatDate(end_date)}</span>
      <span>${new Date(generated_at).toLocaleString()}</span>
    </div>
  `;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const RevenueReport: React.FC = () => {
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate,   setEndDate]   = useState(todayISO());
  const [data,      setData]      = useState<RevenueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [hasRun,    setHasRun]    = useState(false);

  const runReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getRevenue({ start_date: startDate, end_date: endDate });
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
    openPrintWindow(buildPrintHtml(data), 'Revenue Report');
  };

  const services: RevenueServiceItem[] = data?.services ?? [];
  const totalQty = services.reduce((a, s) => a + s.quantity, 0);

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
            title="Revenue Report"
            description="Total invoiced services grouped by description"
            startDate={data.start_date}
            endDate={data.end_date}
            icon={<TrendingUp className="w-5 h-5 text-white" />}
            totalBadge={`${data.summary.total_services} service types`}
            actions={<PrintButton onClick={handlePrint} isLoading={isLoading} />}
          />

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Revenue" value={formatPeso(data.summary.total_revenue)} color="text-green-700" bg="bg-green-50" border="border-green-200" icon={<TrendingUp className="w-5 h-5 text-green-600" />} />
            <StatCard label="Total Paid" value={formatPeso(data.summary.total_paid)} color="text-blue-700" bg="bg-blue-50" border="border-blue-200" icon={<CheckCircle className="w-5 h-5 text-blue-600" />} />
            <StatCard label="Outstanding" value={formatPeso(data.summary.total_balance)} color="text-orange-700" bg="bg-orange-50" border="border-orange-200" icon={<DollarSign className="w-5 h-5 text-orange-600" />} />
            <StatCard label="Service Types" value={String(data.summary.total_services)} color="text-purple-700" bg="bg-purple-50" border="border-purple-200" icon={<FileText className="w-5 h-5 text-purple-600" />} />
          </div>

          {services.length === 0 ? (
            <ReportEmpty />
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Service Type / Description</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Qty</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">% of Revenue</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {services.map((s, idx) => {
                      const pct = data.summary.total_revenue > 0
                        ? ((s.total_amount / data.summary.total_revenue) * 100).toFixed(1)
                        : '0.0';
                      return (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {s.service_type || <span className="text-gray-400 italic">Unknown</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{s.quantity.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 bg-gray-100 rounded-full h-1.5">
                                <div
                                  className="bg-green-500 h-1.5 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-gray-500 text-xs w-10 text-right">{pct}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-green-700">{formatPeso(s.total_amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-green-50 border-t-2 border-green-200 font-bold">
                      <td className="px-4 py-3 text-gray-700">Total</td>
                      <td className="px-4 py-3 text-right text-gray-700">{totalQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-400">100%</td>
                      <td className="px-4 py-3 text-right text-green-700 text-base">{formatPeso(data.summary.total_revenue)}</td>
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
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-4">
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-gray-900 font-semibold text-lg mb-1">Revenue Report</p>
          <p className="text-gray-500 text-sm max-w-xs">
            Select a date range and click <strong>Run Report</strong> to view total invoiced services grouped by type.
          </p>
        </div>
      )}
    </div>
  );
};
