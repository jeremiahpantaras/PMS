import React, { useState, useCallback } from 'react';
import { FileDown, Loader2, LayoutTemplate } from 'lucide-react';
import {
  DateRangePicker,
  ReportLoading,
  ReportError,
  openPrintWindow,
  formatDate,
  monthStart,
  todayISO,
} from '../../components/ReportShared';
import {
  getFinancialBulkExport,
  type BulkFinancialExportResponse,
} from '../../reports.api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fp = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash', GCASH: 'GCash', PAYMAYA: 'PayMaya',
  CREDIT_CARD: 'Credit Card', DEBIT_CARD: 'Debit Card',
  BANK_TRANSFER: 'Bank Transfer', CHECK: 'Check',
};

const CATEGORY_LABELS: Record<string, string> = {
  INITIAL: 'Initial Consultation', FOLLOW_UP: 'Follow-up',
  THERAPY: 'Therapy Session', ASSESSMENT: 'Assessment',
  UNCATEGORIZED: 'Uncategorized',
};

const BUCKET_LABELS: Record<string, string> = {
  '0_30': '0–30 days', '31_60': '31–60 days',
  '61_90': '61–90 days', '90_plus': '90+ days',
};

// ─── Shared CSS ───────────────────────────────────────────────────────────────

const PRINT_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 10pt;
    color: #1a1a2e;
    background: #fff;
  }
  @media print {
    @page { size: A4; margin: 18mm 15mm; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; break-before: page; }
  }
  .cover {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 240mm; text-align: center; padding: 40px;
  }
  .cover-logo {
    width: 72px; height: 72px; border-radius: 18px;
    background: linear-gradient(135deg, #0575E6, #021B79);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 24px;
  }
  .cover-logo svg { width: 36px; height: 36px; fill: none; stroke: white; stroke-width: 2; }
  .cover-clinic  { font-size: 15pt; font-weight: 700; color: #0575E6; margin-bottom: 8px; }
  .cover-title   { font-size: 26pt; font-weight: 800; color: #021B79; margin-bottom: 6px; }
  .cover-sub     { font-size: 12pt; color: #64748b; margin-bottom: 32px; }
  .cover-meta    { background: #f0f7ff; border: 1px solid #bfdbfe; border-radius: 12px;
                   padding: 20px 32px; display: inline-block; text-align: left; }
  .cover-meta-row { display: flex; gap: 16px; margin-bottom: 6px; font-size: 10pt; }
  .cover-meta-label { font-weight: 600; color: #374151; width: 110px; flex-shrink: 0; }
  .cover-meta-value { color: #1d4ed8; }
  .cover-footer { margin-top: 40px; font-size: 8pt; color: #94a3b8; }

  .section { padding: 8px 0 24px; }
  .section-header {
    display: flex; align-items: center; gap: 10px;
    border-bottom: 3px solid #0575E6; padding-bottom: 8px; margin-bottom: 16px;
  }
  .section-icon {
    width: 32px; height: 32px; border-radius: 8px;
    background: linear-gradient(135deg, #0575E6, #021B79);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .section-icon svg { width: 16px; height: 16px; fill: none; stroke: white; stroke-width: 2; }
  .section-title { font-size: 14pt; font-weight: 800; color: #021B79; }
  .section-sub   { font-size: 8pt; color: #64748b; margin-top: 2px; }

  .stats-row { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
  .stat-box {
    flex: 1; min-width: 100px;
    background: #f8faff; border: 1px solid #dbeafe; border-radius: 8px;
    padding: 10px 14px;
  }
  .stat-value { font-size: 12pt; font-weight: 700; color: #0575E6; }
  .stat-label { font-size: 7pt; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; }

  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 8px; }
  thead tr { background: #021B79; color: white; }
  thead th { padding: 7px 8px; text-align: left; font-weight: 600; white-space: nowrap; }
  thead th.r { text-align: right; }
  tbody tr:nth-child(even) { background: #f8faff; }
  tbody tr:hover { background: #eff6ff; }
  tbody td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  tbody td.r { text-align: right; }
  tbody td.mono { font-family: 'Courier New', monospace; font-size: 8pt; }
  tfoot tr { background: #021B79 !important; color: white; font-weight: 700; }
  tfoot td { padding: 7px 8px; }
  tfoot td.r { text-align: right; }

  .badge {
    display: inline-block; padding: 2px 8px; border-radius: 20px;
    font-size: 7.5pt; font-weight: 600; white-space: nowrap;
  }
  .badge-red    { background: #fee2e2; color: #991b1b; }
  .badge-orange { background: #ffedd5; color: #9a3412; }
  .badge-yellow { background: #fef9c3; color: #854d0e; }
  .badge-green  { background: #dcfce7; color: #166534; }
  .badge-blue   { background: #dbeafe; color: #1e40af; }

  .text-green { color: #16a34a; font-weight: 600; }
  .text-red   { color: #dc2626; font-weight: 600; }
  .text-blue  { color: #1d4ed8; font-weight: 600; }

  .progress-row { display: flex; align-items: center; gap: 8px; }
  .progress-bar { flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, #0575E6, #5CDB95); border-radius: 3px; }

  .empty-section { text-align: center; color: #94a3b8; padding: 20px; font-style: italic; }

  .footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    border-top: 1px solid #e2e8f0; background: white;
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 15mm; font-size: 7.5pt; color: #94a3b8;
  }
`;

// ─── HTML Builder ─────────────────────────────────────────────────────────────

function buildBulkPrintHtml(data: BulkFinancialExportResponse): string {
  const { start_date, end_date, generated_at, clinic_name, generated_by } = data;
  const generatedStr = new Date(generated_at).toLocaleString();
  const dateRange    = `${formatDate(start_date)} – ${formatDate(end_date)}`;

  // ── Cover page ────────────────────────────────────────────────────────────
  const coverHtml = `
    <div class="cover">
      <div class="cover-logo">
        <svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
      </div>
      <div class="cover-clinic">${clinic_name}</div>
      <div class="cover-title">Financial Bulk Report</div>
      <div class="cover-sub">Comprehensive Financial Summary</div>
      <div class="cover-meta">
        <div class="cover-meta-row">
          <span class="cover-meta-label">Report Period</span>
          <span class="cover-meta-value">${dateRange}</span>
        </div>
        <div class="cover-meta-row">
          <span class="cover-meta-label">Generated By</span>
          <span class="cover-meta-value">${generated_by}</span>
        </div>
        <div class="cover-meta-row">
          <span class="cover-meta-label">Generated At</span>
          <span class="cover-meta-value">${generatedStr}</span>
        </div>
        <div class="cover-meta-row">
          <span class="cover-meta-label">Sections</span>
          <span class="cover-meta-value">Banking · Ageing Debts · Revenue · Categories · Account Credits</span>
        </div>
      </div>
      <div class="cover-footer">Confidential — For internal use only</div>
    </div>
  `;

  // ── Banking ───────────────────────────────────────────────────────────────
  const { summary: bs, payments } = data.banking;
  const methodStatBoxes = Object.entries(bs.method_totals)
    .map(([m, t]) => `
      <div class="stat-box">
        <div class="stat-value">${fp(t)}</div>
        <div class="stat-label">${METHOD_LABELS[m] ?? m}</div>
      </div>
    `).join('');

  const bankingRows = payments.length > 0
    ? payments.map(p => `
        <tr>
          <td>${formatDate(p.date)}</td>
          <td><span class="badge badge-blue">${METHOD_LABELS[p.payment_method] ?? p.payment_method}</span></td>
          <td>${p.patient_name}</td>
          <td class="mono">${p.invoice_number}</td>
          <td class="mono">${p.receipt_number || '—'}</td>
          <td class="r text-green">${fp(p.amount)}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="6" class="empty-section">No payment transactions found</td></tr>`;

  const bankingHtml = `
    <div class="page-break section">
      <div class="section-header">
        <div class="section-icon">
          <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
        </div>
        <div>
          <div class="section-title">Banking Report</div>
          <div class="section-sub">Actual money received, grouped by payment method · ${dateRange}</div>
        </div>
      </div>
      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-value">${fp(bs.grand_total)}</div>
          <div class="stat-label">Grand Total</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${bs.total_transactions}</div>
          <div class="stat-label">Transactions</div>
        </div>
        ${methodStatBoxes}
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Method</th><th>Patient</th>
            <th>Invoice</th><th>Receipt</th><th class="r">Amount</th>
          </tr>
        </thead>
        <tbody>${bankingRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="5">Grand Total</td>
            <td class="r">${fp(bs.grand_total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  // ── Ageing Debts ──────────────────────────────────────────────────────────
  const { summary: as, debts } = data.ageing_debts;
  const buckets = ['0_30', '31_60', '61_90', '90_plus'] as const;

  const ageingRows = debts.length > 0
    ? debts.map(d => {
        const bucketClass =
          d.bucket === '90_plus' ? 'badge-red'
          : d.bucket === '61_90'  ? 'badge-orange'
          : d.bucket === '31_60'  ? 'badge-yellow'
          : 'badge-green';
        return `
          <tr>
            <td>${d.patient_name}<br/><small style="color:#94a3b8">#${d.patient_number}</small></td>
            <td class="mono">${d.invoice_number}</td>
            <td>${formatDate(d.invoice_date)}</td>
            <td class="r">${d.days_overdue}d</td>
            <td class="r">${d.bucket === '0_30'    ? fp(d.balance_due) : '—'}</td>
            <td class="r">${d.bucket === '31_60'   ? fp(d.balance_due) : '—'}</td>
            <td class="r">${d.bucket === '61_90'   ? fp(d.balance_due) : '—'}</td>
            <td class="r">${d.bucket === '90_plus' ? `<span class="text-red">${fp(d.balance_due)}</span>` : '—'}</td>
            <td class="r"><strong>${fp(d.balance_due)}</strong></td>
            <td><span class="badge ${bucketClass}">${BUCKET_LABELS[d.bucket]}</span></td>
          </tr>
        `;
      }).join('')
    : `<tr><td colspan="10" class="empty-section">No outstanding debts found</td></tr>`;

  const ageingHtml = `
    <div class="page-break section">
      <div class="section-header">
        <div class="section-icon">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div>
          <div class="section-title">Ageing Debts Report</div>
          <div class="section-sub">Outstanding invoices as at ${formatDate(new Date().toISOString().split('T')[0])}</div>
        </div>
      </div>
      <div class="stats-row">
        <div class="stat-box"><div class="stat-value">${fp(as.total_outstanding)}</div><div class="stat-label">Total Outstanding</div></div>
        <div class="stat-box"><div class="stat-value">${as.total_invoices}</div><div class="stat-label">Invoices</div></div>
        <div class="stat-box"><div class="stat-value">${fp(as.bucket_totals['0_30'])}</div><div class="stat-label">0–30 days</div></div>
        <div class="stat-box"><div class="stat-value">${fp(as.bucket_totals['31_60'])}</div><div class="stat-label">31–60 days</div></div>
        <div class="stat-box"><div class="stat-value">${fp(as.bucket_totals['61_90'])}</div><div class="stat-label">61–90 days</div></div>
        <div class="stat-box" style="border-color:#fca5a5"><div class="stat-value text-red">${fp(as.bucket_totals['90_plus'])}</div><div class="stat-label">90+ days</div></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Client</th><th>Invoice</th><th>Invoice Date</th><th class="r">Days</th>
            <th class="r">0–30</th><th class="r">31–60</th><th class="r">61–90</th>
            <th class="r">90+</th><th class="r">Balance</th><th>Bucket</th>
          </tr>
        </thead>
        <tbody>${ageingRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="4">Totals</td>
            <td class="r">${fp(as.bucket_totals['0_30'])}</td>
            <td class="r">${fp(as.bucket_totals['31_60'])}</td>
            <td class="r">${fp(as.bucket_totals['61_90'])}</td>
            <td class="r">${fp(as.bucket_totals['90_plus'])}</td>
            <td class="r">${fp(as.total_outstanding)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  // ── Revenue ───────────────────────────────────────────────────────────────
  const { summary: rs, services } = data.revenue;
  const maxRevenue = Math.max(...services.map(s => s.total_amount), 1);

  const revenueRows = services.length > 0
    ? services.map((s, idx) => {
        const pct = ((s.total_amount / maxRevenue) * 100).toFixed(0);
        const isTop = idx === 0;
        return `
          <tr${isTop ? ' style="background:#f0fdf4"' : ''}>
            <td>
              ${isTop ? '<span class="badge badge-green">★ Top</span> ' : ''}${s.service_type}
            </td>
            <td class="r">${s.quantity.toFixed(0)}</td>
            <td class="r">${s.item_count}</td>
            <td class="r text-green">${fp(s.total_amount)}</td>
            <td style="width:100px">
              <div class="progress-row">
                <div class="progress-bar">
                  <div class="progress-fill" style="width:${pct}%"></div>
                </div>
                <span style="font-size:7pt;color:#64748b;white-space:nowrap">${pct}%</span>
              </div>
            </td>
          </tr>
        `;
      }).join('')
    : `<tr><td colspan="5" class="empty-section">No revenue data found</td></tr>`;

  const revenueHtml = `
    <div class="page-break section">
      <div class="section-header">
        <div class="section-icon">
          <svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        </div>
        <div>
          <div class="section-title">Revenue Report</div>
          <div class="section-sub">Invoice items grouped by service · ${dateRange}</div>
        </div>
      </div>
      <div class="stats-row">
        <div class="stat-box"><div class="stat-value">${fp(rs.total_revenue)}</div><div class="stat-label">Total Revenue</div></div>
        <div class="stat-box"><div class="stat-value">${fp(rs.total_paid)}</div><div class="stat-label">Total Paid</div></div>
        <div class="stat-box"><div class="stat-value text-red">${fp(rs.total_balance)}</div><div class="stat-label">Outstanding</div></div>
        <div class="stat-box"><div class="stat-value">${rs.total_services}</div><div class="stat-label">Service Types</div></div>
        <div class="stat-box"><div class="stat-value">${rs.total_invoices}</div><div class="stat-label">Invoices</div></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Service Type</th><th class="r">Qty</th><th class="r">Items</th>
            <th class="r">Total Amount</th><th>Share</th>
          </tr>
        </thead>
        <tbody>${revenueRows}</tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td class="r">${services.reduce((a, s) => a + s.quantity, 0).toFixed(0)}</td>
            <td class="r">${services.reduce((a, s) => a + s.item_count, 0)}</td>
            <td class="r">${fp(rs.total_revenue)}</td>
            <td>100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  // ── Categories ────────────────────────────────────────────────────────────
  const { summary: cs, categories } = data.categories;

  const categoryRows = categories.length > 0
    ? categories.map(c => `
        <tr>
          <td>${CATEGORY_LABELS[c.category] ?? c.category.replace(/_/g, ' ')}</td>
          <td class="r">${c.invoice_count}</td>
          <td class="r text-green">${fp(c.total_revenue)}</td>
          <td class="r text-blue">${fp(c.total_payments)}</td>
          <td class="r ${c.outstanding > 0 ? 'text-red' : 'text-green'}">${fp(c.outstanding)}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="5" class="empty-section">No category data found</td></tr>`;

  const categoriesHtml = `
    <div class="page-break section">
      <div class="section-header">
        <div class="section-icon">
          <svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        </div>
        <div>
          <div class="section-title">Categories Report</div>
          <div class="section-sub">Revenue grouped by appointment category · ${dateRange}</div>
        </div>
      </div>
      <div class="stats-row">
        <div class="stat-box"><div class="stat-value">${fp(cs.total_revenue)}</div><div class="stat-label">Total Revenue</div></div>
        <div class="stat-box"><div class="stat-value">${fp(cs.total_payments)}</div><div class="stat-label">Collected</div></div>
        <div class="stat-box"><div class="stat-value text-red">${fp(cs.outstanding)}</div><div class="stat-label">Outstanding</div></div>
        <div class="stat-box"><div class="stat-value">${cs.total_categories}</div><div class="stat-label">Categories</div></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Category</th><th class="r">Invoices</th>
            <th class="r">Revenue</th><th class="r">Payments</th><th class="r">Outstanding</th>
          </tr>
        </thead>
        <tbody>${categoryRows}</tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td class="r">${categories.reduce((a, c) => a + c.invoice_count, 0)}</td>
            <td class="r">${fp(cs.total_revenue)}</td>
            <td class="r">${fp(cs.total_payments)}</td>
            <td class="r">${fp(cs.outstanding)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  // ── Account Credits ───────────────────────────────────────────────────────
  const { summary: acs, accounts } = data.account_credits;

  const creditsRows = accounts.length > 0
    ? accounts.map(a => `
        <tr>
          <td>
            ${a.patient_name}
            <br/><small class="mono" style="color:#94a3b8">#${a.patient_number}</small>
          </td>
          <td class="r">${a.invoice_count}</td>
          <td class="r text-blue">${fp(a.credit_created)}</td>
          <td class="r text-green">${fp(a.credit_used)}</td>
          <td class="r" style="color:#94a3b8">${a.credit_refunded > 0 ? fp(a.credit_refunded) : '—'}</td>
          <td class="r ${a.balance > 0 ? 'text-red' : 'text-green'}">${fp(a.balance)}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="6" class="empty-section">No account data found</td></tr>`;

  const creditsHtml = `
    <div class="page-break section">
      <div class="section-header">
        <div class="section-icon">
          <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/></svg>
        </div>
        <div>
          <div class="section-title">Account Credits Report</div>
          <div class="section-sub">Per-patient billing summary · ${dateRange}</div>
        </div>
      </div>
      <div class="stats-row">
        <div class="stat-box"><div class="stat-value">${acs.total_accounts}</div><div class="stat-label">Accounts</div></div>
        <div class="stat-box"><div class="stat-value">${fp(acs.total_credit_created)}</div><div class="stat-label">Total Invoiced</div></div>
        <div class="stat-box"><div class="stat-value text-green">${fp(acs.total_credit_used)}</div><div class="stat-label">Total Paid</div></div>
        <div class="stat-box" style="border-color:#fca5a5"><div class="stat-value text-red">${fp(acs.total_balance)}</div><div class="stat-label">Outstanding</div></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Client / Payer</th><th class="r">Invoices</th>
            <th class="r">Credit Created</th><th class="r">Credit Used</th>
            <th class="r">Refunded</th><th class="r">Balance</th>
          </tr>
        </thead>
        <tbody>${creditsRows}</tbody>
        <tfoot>
          <tr>
            <td>Total (${accounts.length} accounts)</td>
            <td class="r">${accounts.reduce((a, i) => a + i.invoice_count, 0)}</td>
            <td class="r">${fp(acs.total_credit_created)}</td>
            <td class="r">${fp(acs.total_credit_used)}</td>
            <td class="r">—</td>
            <td class="r">${fp(acs.total_balance)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerHtml = `
    <div class="footer">
      <span>${clinic_name} · Financial Bulk Report · ${dateRange}</span>
      <span>Generated ${generatedStr}</span>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Financial Bulk Report — ${clinic_name}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  ${coverHtml}
  ${bankingHtml}
  ${ageingHtml}
  ${revenueHtml}
  ${categoriesHtml}
  ${creditsHtml}
  ${footerHtml}
  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const BulkFinancialReport: React.FC = () => {
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate,   setEndDate]   = useState(todayISO());
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getFinancialBulkExport({ start_date: startDate, end_date: endDate });
      openPrintWindow(buildBulkPrintHtml(data), 'Financial Bulk Report');
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? err?.message ?? 'Failed to generate bulk report.');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  const REPORTS = [
    { icon: '🏦', label: 'Banking Report',         desc: 'Payments by method' },
    { icon: '⏳', label: 'Ageing Debts Report',    desc: 'Outstanding by age bucket' },
    { icon: '📈', label: 'Revenue Report',          desc: 'Services & quantities' },
    { icon: '🏷️', label: 'Categories Report',      desc: 'Revenue by category' },
    { icon: '💳', label: 'Account Credits Report', desc: 'Per-patient balances' },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">

      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
        onApply={handleExport}
        isLoading={isLoading}
      />

      {isLoading && <ReportLoading />}
      {!isLoading && error && <ReportError message={error} onRetry={handleExport} />}

      {!isLoading && !error && (
        <div className="mt-6 flex flex-col items-center gap-5 max-w-xl mx-auto">

          {/* Header */}
          <div className="w-full bg-primary-gradient rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <LayoutTemplate className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">Financial Bulk Report</h2>
                <p className="text-white/70 text-xs">All 5 reports combined in one PDF export</p>
              </div>
            </div>

            {/* Report list */}
            <div className="grid grid-cols-1 gap-2 mb-5">
              {REPORTS.map(({ icon, label, desc }) => (
                <div key={label} className="flex items-center gap-3 bg-white/10 rounded-xl px-3.5 py-2.5">
                  <span className="text-base">{icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">{label}</p>
                    <p className="text-xs text-white/60 truncate">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA button */}
            <button
              onClick={handleExport}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2.5 bg-white text-[#0575E6] hover:bg-white/90 disabled:opacity-60 font-bold text-sm py-3 px-5 rounded-xl transition-all shadow"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Generating PDF…</>
              ) : (
                <><FileDown className="w-4 h-4" />Export All Financial Reports (PDF)</>
              )}
            </button>
          </div>

          {/* Info chips */}
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              '📄 A4 format',
              '🖨️ Print-to-PDF via browser',
              '📊 6 pages incl. cover',
              '🔒 Single-request fetch',
            ].map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 text-xs px-3 py-1.5 rounded-full"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
