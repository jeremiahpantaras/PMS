import React, { useState, useCallback } from 'react';
import {
  Package, AlertTriangle, XCircle, Layers, TrendingUp,
} from 'lucide-react';
import {
  getInventoryFinancial,
  type InventoryFinancialResponse,
  type InventoryFinancialItem,
} from '../../reports.api';
import {
  StatCard,
  ReportLoading,
  ReportError,
  ReportEmpty,
  ReportHeader,
  PrintButton,
  openPrintWindow,
} from '../../components/ReportShared';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatPeso = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STOCK_STYLES: Record<string, string> = {
  ok:  'bg-green-50  text-green-700  border-green-200',
  low: 'bg-amber-50  text-amber-700  border-amber-200',
  out: 'bg-red-50    text-red-700    border-red-200',
};

const STOCK_LABELS: Record<string, string> = {
  ok:  'In Stock',
  low: 'Low Stock',
  out: 'Out of Stock',
};

// ─── Print builder ────────────────────────────────────────────────────────────

function buildInventoryPrintHtml(data: InventoryFinancialResponse): string {
  const { summary, category_breakdown, items, generated_at } = data;

  const rowsHtml = items.map((item) => `
    <tr>
      <td>
        <div class="patient-name">${item.name}</div>
        ${item.sku ? `<div class="patient-num">${item.sku}</div>` : ''}
      </td>
      <td>${item.category}</td>
      <td>${item.item_type}</td>
      <td style="text-align:right">${item.quantity} ${item.unit}</td>
      <td style="text-align:right">${formatPeso(item.unit_cost)}</td>
      <td style="text-align:right; font-weight:600">${formatPeso(item.total_value)}</td>
      <td>
        <span class="badge ${
          item.stock_flag === 'out' ? 'badge-red'
          : item.stock_flag === 'low' ? 'badge-orange'
          : 'badge-green'
        }">${STOCK_LABELS[item.stock_flag]}</span>
      </td>
    </tr>
  `).join('');

  const catRows = category_breakdown.map((c) => `
    <tr>
      <td>${c.category}</td>
      <td style="text-align:right; font-weight:600">${formatPeso(c.total_value)}</td>
    </tr>
  `).join('');

  return `
    <div class="header">
      <div class="header-left">
        <h1>Inventory Financial Report</h1>
        <p class="meta">Generated: ${new Date(generated_at).toLocaleString()}</p>
      </div>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${formatPeso(summary.total_inventory_value)}</div>
        <div class="stat-label">Total Inventory Value</div>
      </div>
      <div class="stat">
        <div class="stat-value">${summary.total_items}</div>
        <div class="stat-label">Total Items</div>
      </div>
      <div class="stat">
        <div class="stat-value">${summary.low_stock_count}</div>
        <div class="stat-label">Low Stock Items</div>
      </div>
      <div class="stat">
        <div class="stat-value">${summary.out_of_stock_count}</div>
        <div class="stat-label">Out of Stock</div>
      </div>
    </div>

    ${category_breakdown.length > 0 ? `
    <h2 style="margin-bottom:8px; margin-top:16px;">Value by Category</h2>
    <table>
      <thead><tr><th>Category</th><th style="text-align:right">Total Value</th></tr></thead>
      <tbody>${catRows}</tbody>
    </table>
    ` : ''}

    <h2 style="margin-bottom:8px; margin-top:16px;">Items</h2>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Category</th>
          <th>Type</th>
          <th style="text-align:right">Qty</th>
          <th style="text-align:right">Unit Cost</th>
          <th style="text-align:right">Total Value</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${items.length > 0 ? rowsHtml : '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:16px">No items found</td></tr>'}</tbody>
    </table>
    <div class="footer">
      <span>Inventory Financial Report</span>
      <span>${new Date(generated_at).toLocaleString()}</span>
    </div>
  `;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const InventoryItems: React.FC = () => {
  const [data,        setData]        = useState<InventoryFinancialResponse | null>(null);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [hasRun,      setHasRun]      = useState(false);

  // Filters
  const [categoryId,   setCategoryId]   = useState<string>('');
  const [stockStatus,  setStockStatus]  = useState<'all' | 'low' | 'out'>('all');

  // Derived category list from last fetch
  const categories = data?.categories ?? [];

  const runReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { stock_status: stockStatus };
      if (categoryId) params.category_id = Number(categoryId);

      const result = await getInventoryFinancial(params as any);
      setData(result);
      setHasRun(true);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to load inventory report';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, stockStatus]);

  const handlePrint = () => {
    if (!data) return;
    openPrintWindow(buildInventoryPrintHtml(data), 'Inventory Financial Report');
  };

  // Table: live filtered items (filter is already applied server-side; client-side search optional)
  const items: InventoryFinancialItem[] = data?.items ?? [];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">

      {/* ── Filters Bar ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">

          {/* Category filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none min-w-40"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Stock status filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Stock Status</label>
            <select
              value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value as 'all' | 'low' | 'out')}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none"
            >
              <option value="all">All Items</option>
              <option value="low">Low Stock Only</option>
              <option value="out">Out of Stock Only</option>
            </select>
          </div>

          <button
            onClick={runReport}
            disabled={isLoading}
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            {isLoading
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Running...</>
              : 'Run Report'
            }
          </button>
        </div>
      </div>

      {/* ── States ── */}
      {isLoading && <ReportLoading />}

      {!isLoading && error && (
        <ReportError message={error} onRetry={runReport} />
      )}

      {!isLoading && !error && hasRun && !data && (
        <ReportEmpty message="No inventory data found." />
      )}

      {/* ── Report Content ── */}
      {!isLoading && !error && data && (
        <>
          {/* Header */}
          <ReportHeader
            title="Inventory Financial Report"
            description="Stock valuation and financial overview of clinic inventory items"
            startDate=""
            endDate=""
            icon={<Package className="w-5 h-5" />}
            totalBadge={
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                {data.summary.total_items} items
              </span>
            }
            actions={
              <PrintButton onClick={handlePrint} label="Print Report" />
            }
          />

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Inventory Value"
              value={formatPeso(data.summary.total_inventory_value)}
              color="text-green-700"
              bg="bg-green-50"
              border="border-green-200"
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <StatCard
              label="Total Items"
              value={data.summary.total_items}
              color="text-blue-700"
              bg="bg-blue-50"
              border="border-blue-200"
              icon={<Layers className="w-5 h-5" />}
            />
            <StatCard
              label="Low Stock Items"
              value={data.summary.low_stock_count}
              color="text-amber-700"
              bg="bg-amber-50"
              border="border-amber-200"
              icon={<AlertTriangle className="w-5 h-5" />}
            />
            <StatCard
              label="Out of Stock"
              value={data.summary.out_of_stock_count}
              color="text-red-700"
              bg="bg-red-50"
              border="border-red-200"
              icon={<XCircle className="w-5 h-5" />}
            />
          </div>

          {/* Category Breakdown */}
          {data.category_breakdown.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-5 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">Value by Category</h3>
              </div>
              <div className="p-4 flex flex-wrap gap-3">
                {data.category_breakdown.map((c) => (
                  <div
                    key={c.category}
                    className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2"
                  >
                    <span className="text-sm text-gray-600 font-medium">{c.category}</span>
                    <span className="text-sm font-bold text-green-700">{formatPeso(c.total_value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {items.length === 0 ? (
              <ReportEmpty message="No items match the selected filters." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Item</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Category</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Type</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Qty</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Unit Cost</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Value</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item) => (
                      <tr key={item.product_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-medium text-gray-900">{item.name}</div>
                          {item.sku && <div className="text-xs text-gray-400 mt-0.5">{item.sku}</div>}
                        </td>
                        <td className="px-5 py-3 text-gray-600">{item.category}</td>
                        <td className="px-5 py-3 text-gray-600 capitalize">{item.item_type.toLowerCase()}</td>
                        <td className="px-5 py-3 text-right font-medium text-gray-800">
                          {item.quantity} <span className="text-xs text-gray-400">{item.unit}</span>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-700">{formatPeso(item.unit_cost)}</td>
                        <td className="px-5 py-3 text-right font-bold text-green-700">{formatPeso(item.total_value)}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STOCK_STYLES[item.stock_flag]}`}>
                            {STOCK_LABELS[item.stock_flag]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals row */}
                  <tfoot className="bg-green-50 border-t-2 border-green-200">
                    <tr>
                      <td colSpan={5} className="px-5 py-3 text-sm font-semibold text-gray-700 text-right">
                        Total Inventory Value ({items.length} items)
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-green-800 text-base">
                        {formatPeso(data.summary.total_inventory_value)}
                      </td>
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
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-green-200">
            <Package className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Inventory Financial Report</p>
          <p className="text-xs text-gray-500 max-w-xs mb-4">
            View stock valuation, low stock alerts, and total inventory value by category.
          </p>
          <button
            onClick={runReport}
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            Run Report
          </button>
        </div>
      )}
    </div>
  );
};

