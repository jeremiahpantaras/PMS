import React, { useState, useCallback } from 'react';
import { Clock, AlertTriangle, DollarSign, Plus, Pencil, Search, X } from 'lucide-react';
import {
  ReportHeader,
  StatCard,
  ReportLoading,
  ReportError,
  ReportEmpty,
  PrintButton,
  openPrintWindow,
  formatDate,
  StatusBadge,
} from '../../components/ReportShared';
import {
  getAgeingDebts,
  type AgeingDebtsResponse,
  type AgeingDebtItem,
} from '../../reports.api';
import { AddAgeingDebtModal } from './components/AddAgeingDebtModal';
import { EditAgeingDebtModal } from './components/EditAgeingDebtModal';

const formatPeso = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BUCKET_STYLES: Record<string, string> = {
  CURRENT: 'bg-blue-50 text-blue-700 border-blue-200',
  '0_30':  'bg-yellow-50 text-yellow-700 border-yellow-200',
  '31_60': 'bg-orange-50 text-orange-700 border-orange-200',
  '61_90': 'bg-red-50 text-red-700 border-red-200',
  '90_plus': 'bg-rose-100 text-rose-800 border-rose-300',
};

const BUCKET_LABELS: Record<string, string> = {
  CURRENT: 'Current',
  '0_30':  '1-30 Days',
  '31_60': '31-60 Days',
  '61_90': '61-90 Days',
  '90_plus': '90+ Days',
};



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
        <div class="time-primary">${d.source === 'unbilled_appointment' ? 'UNBILLED' : (d.invoice_number || '—')}</div>
        <div class="time-secondary">${d.invoice_date ? formatDate(d.invoice_date) : '—'}</div>
      </td>
      <td>${d.appointment_date ? formatDate(d.appointment_date) : '—'}</td>
      <td>${d.appointment_type || '—'}</td>
      <td>${d.practitioner_name || '—'}</td>
      <td>${d.due_date ? formatDate(d.due_date) : '—'}</td>
      <td>${d.days_overdue > 0 ? `${d.days_overdue}d` : '—'}</td>
      <td style="text-align:right">${formatPeso(d.balance_due)}</td>
      <td>
        <span style="
          display:inline-flex;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;
          background:${
            d.bucket === 'CURRENT' ? '#dbeafe' :
            d.bucket === '0_30' ? '#fef9c3' :
            d.bucket === '31_60' ? '#ffedd5' :
            d.bucket === '61_90' ? '#fee2e2' : '#ffe4e6'
          };color:${
            d.bucket === 'CURRENT' ? '#1d4ed8' :
            d.bucket === '0_30' ? '#a16207' :
            d.bucket === '31_60' ? '#c2410c' :
            d.bucket === '61_90' ? '#b91c1c' : '#9f1239'
          }">
          ${BUCKET_LABELS[d.bucket] ?? d.bucket}
        </span>
      </td>
      <td>${d.status.replace(/_/g, ' ')}</td>
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
      <div class="stat"><div class="stat-value">${formatPeso(bt['0_30'] ?? 0)}</div><div class="stat-label">0–30 Days</div></div>
      <div class="stat"><div class="stat-value">${formatPeso(bt['31_60'] ?? 0)}</div><div class="stat-label">31–60 Days</div></div>
      <div class="stat"><div class="stat-value">${formatPeso(bt['61_90'] ?? 0)}</div><div class="stat-label">61–90 Days</div></div>
      <div class="stat"><div class="stat-value">${formatPeso(bt['90_plus'] ?? 0)}</div><div class="stat-label">90+ Days</div></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Client</th><th>Reference</th><th>Appt Date</th><th>Appt Type</th><th>Practitioner</th><th>Due Date</th><th>Age</th>
          <th style="text-align:right">Balance</th><th>Bucket</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${debts.length > 0 ? rowsHtml : '<tr><td colspan="10" style="text-align:center;color:#9ca3af;padding:16px">No overdue invoices found</td></tr>'}
      </tbody>
      <tfoot>
        <tr style="font-weight:700; background:#fef2f2">
          <td colspan="4">Totals</td>
          <td style="text-align:right; color:#dc2626">${formatPeso(summary.total_outstanding)}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>
    <div class="footer">
      <span>Ageing Debts Report</span>
      <span>${new Date(generated_at).toLocaleString()}</span>
    </div>
  `;
}

export const AgeingDebtsReport: React.FC = () => {
  const [data,           setData]           = useState<AgeingDebtsResponse | null>(null);
  const [isLoading,      setIsLoading]      = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [hasRun,         setHasRun]         = useState(false);
  const [showAddModal,    setShowAddModal]    = useState(false);
  const [editEntry,      setEditEntry]       = useState<any | null>(null);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [filterStatus,    setFilterStatus]    = useState('ALL');
  const [filterBucket,    setFilterBucket]    = useState('ALL');

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

  const handleEntryCreated = (_entry: any) => {
    runReport();
  };

  const handleEntryUpdated = (_entry: any) => {
    runReport();
  };

  const handleEntryDeleted = (_id: number) => {
    setEditEntry(null);
    runReport();
  };

  const handlePaymentRecorded = (_entry: any) => {
    setEditEntry(null);
    runReport();
  };

  const debts: AgeingDebtItem[] = data?.debts ?? [];
  const bt = data?.summary.bucket_totals;

  const filteredDebts = debts.filter(d => {
    if (filterStatus !== 'ALL' && d.status !== filterStatus) return false;
    if (filterBucket !== 'ALL' && d.bucket !== filterBucket) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !d.patient_name?.toLowerCase().includes(q) &&
        !d.invoice_number?.toLowerCase().includes(q) &&
        !d.patient_number?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });


  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">

      <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 mb-5">
        <div>
          <p className="text-sm font-semibold text-gray-700">Accounts Receivable Management</p>
          <p className="text-xs text-gray-500 mt-0.5">Manage outstanding debts and track payments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runReport}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {isLoading ? 'Loading…' : 'Run Report'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Ageing Debt
          </button>
        </div>
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
            totalBadge={`${data.summary.total_invoices} entries`}
            actions={<PrintButton onClick={handlePrint} isLoading={isLoading} />}
          />

          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search client, invoice #…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="WRITTEN_OFF">Written Off</option>
              <option value="PENDING">Pending</option>
              <option value="OVERDUE">Overdue</option>
              <option value="UNBILLED">Unbilled</option>
            </select>
            <select
              value={filterBucket}
              onChange={e => setFilterBucket(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
            >
              <option value="ALL">All Buckets</option>
              <option value="CURRENT">Current</option>
              <option value="0_30">1-30 Days</option>
              <option value="31_60">31-60 Days</option>
              <option value="61_90">61-90 Days</option>
              <option value="90_plus">90+ Days</option>
            </select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
              label="Total Outstanding"
              value={formatPeso(data.summary.total_outstanding)}
              color="text-red-700"
              bg="bg-red-50"
              border="border-red-200"
              icon={<DollarSign className="w-5 h-5 text-red-600" />}
            />
            <StatCard
              label="Current"
              value={formatPeso(bt?.['CURRENT'] ?? 0)}
              color="text-blue-700"
              bg="bg-blue-50"
              border="border-blue-200"
              icon={<Clock className="w-5 h-5 text-blue-600" />}
            />
            <StatCard
              label="1-30 Days"
              value={formatPeso(bt?.['0_30'] ?? 0)}
              color="text-yellow-700"
              bg="bg-yellow-50"
              border="border-yellow-200"
              icon={<Clock className="w-5 h-5 text-yellow-600" />}
            />
            <StatCard
              label="31-60 Days"
              value={formatPeso(bt?.['31_60'] ?? 0)}
              color="text-orange-700"
              bg="bg-orange-50"
              border="border-orange-200"
              icon={<Clock className="w-5 h-5 text-orange-600" />}
            />
            <StatCard
              label="61-90 Days"
              value={formatPeso(bt?.['61_90'] ?? 0)}
              color="text-red-700"
              bg="bg-red-50"
              border="border-red-200"
              icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
              label="90+ Days"
              value={formatPeso(bt?.['90_plus'] ?? 0)}
              color="text-rose-800"
              bg="bg-rose-100"
              border="border-rose-300"
              icon={<AlertTriangle className="w-5 h-5 text-rose-700" />}
            />
            <StatCard
              label="Manual Debt Entries"
              value={debts.filter(d => d.source === 'debt_entry').length}
              color="text-green-700"
              bg="bg-green-50"
              border="border-green-200"
              icon={<DollarSign className="w-5 h-5 text-green-600" />}
            />
          </div>

          {filteredDebts.length === 0 && debts.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-8 text-center">
              <p className="text-sm text-gray-500">No entries match the current filters.</p>
              <button
                onClick={() => { setSearchQuery(''); setFilterStatus('ALL'); setFilterBucket('ALL'); }}
                className="mt-2 text-xs text-orange-600 hover:text-orange-700 font-medium underline underline-offset-2"
              >
                Clear filters
              </button>
            </div>
          ) : filteredDebts.length === 0 ? (
            <ReportEmpty message="No outstanding debts found. All invoices are paid." />
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Reference</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Appt Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Appt Type</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Practitioner</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Due Date</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Outstanding</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Age</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Bucket</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredDebts.map((d) => (
                      <tr key={`${d.source}-${d.id}`} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{d.patient_name}</div>
                          <div className="text-xs text-gray-400">#{d.patient_number}</div>
                        </td>
                        <td className="px-4 py-3">
                          {d.source === 'unbilled_appointment' ? (
                            <span className="font-mono text-xs text-purple-700 font-medium">UNBILLED</span>
                          ) : (
                            <div className="font-mono text-xs text-gray-700">{d.invoice_number || '—'}</div>
                          )}
                          {d.source === 'debt_entry' && (
                            <div className="text-xs text-green-600 font-medium">Manual Entry</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {d.appointment_date ? formatDate(d.appointment_date) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {d.appointment_type || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {d.practitioner_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {d.due_date ? formatDate(d.due_date) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-red-700">
                          {formatPeso(d.balance_due)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${BUCKET_STYLES[d.bucket] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                            {BUCKET_LABELS[d.bucket] ?? d.bucket}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {d.source === 'debt_entry' ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${
                              d.status === 'OPEN' ? 'bg-gray-50 text-gray-700 border-gray-200' :
                              d.status === 'PARTIALLY_PAID' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                              d.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-200' :
                              d.status === 'WRITTEN_OFF' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-gray-50 text-gray-600 border-gray-200'
                            }`}>
                              {d.status.replace(/_/g, ' ')}
                            </span>
                          ) : d.source === 'unbilled_appointment' ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium border bg-purple-50 text-purple-700 border-purple-200">
                              Unbilled
                            </span>
                          ) : (
                            <StatusBadge status={d.status} />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {d.source === 'debt_entry' ? (
                            <button
                              onClick={() => setEditEntry(d)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Invoice</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-red-50 border-t-2 border-red-200 font-bold">
                      <td colSpan={6} className="px-4 py-3 text-gray-700">Totals</td>
                      <td className="px-4 py-3 text-right text-red-700 text-base">
                        {formatPeso(filteredDebts.reduce((s, d) => s + d.balance_due, 0))}
                      </td>
                      <td colSpan={4}></td>
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

      <AddAgeingDebtModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={handleEntryCreated}
      />

      <EditAgeingDebtModal
        isOpen={!!editEntry}
        onClose={() => setEditEntry(null)}
        entry={editEntry}
        onUpdated={handleEntryUpdated}
        onDeleted={handleEntryDeleted}
        onPaymentRecorded={handlePaymentRecorded}
      />
    </div>
  );
};