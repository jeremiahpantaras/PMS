import React, { useState, useEffect } from 'react';
import { X, DollarSign, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  updateAgeingDebtEntry,
  recordDebtPayment,
  markDebtEntryPaid,
  writeOffDebtEntry,
  deleteAgeingDebtEntry,
} from '../../../reports.api';
import type { AgeingDebtEntryItem } from '../../../reports.api';

const CATEGORY_OPTIONS = [
  { value: 'CONSULTATION',  label: 'Consultation' },
  { value: 'TREATMENT',    label: 'Treatment' },
  { value: 'INVOICE',      label: 'Invoice' },
  { value: 'INSURANCE',    label: 'Insurance' },
  { value: 'CORPORATE',    label: 'Corporate Account' },
  { value: 'OTHER',       label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'OPEN',          label: 'Open' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'PAID',          label: 'Paid' },
  { value: 'WRITTEN_OFF',   label: 'Written Off' },
];

interface EditAgeingDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: AgeingDebtEntryItem | null;
  onUpdated?: (entry: AgeingDebtEntryItem) => void;
  onDeleted?: (id: number) => void;
  onPaymentRecorded?: (entry: AgeingDebtEntryItem) => void;
}

export const EditAgeingDebtModal: React.FC<EditAgeingDebtModalProps> = ({
  isOpen,
  onClose,
  entry,
  onUpdated,
  onDeleted,
  onPaymentRecorded,
}) => {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [category, setCategory] = useState('INVOICE');
  const [status, setStatus] = useState('OPEN');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && entry) {
      setInvoiceNumber(entry.invoice_number || '');
      setInvoiceDate(entry.invoice_date || '');
      setDueDate(entry.due_date || '');
      setTotalAmount(String(entry.total_amount));
      setAmountPaid(String(entry.amount_paid));
      setCategory(entry.category || 'INVOICE');
      setStatus(entry.status);
      setNotes(entry.notes || '');
      setErrors({});
      setSaving(false);
      setShowPaymentForm(false);
      setPaymentAmount('');
    }
  }, [isOpen, entry]);

  if (!isOpen || !entry) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!invoiceNumber.trim()) errs.invoiceNumber = 'Invoice number is required.';
    if (!invoiceDate.trim()) errs.invoiceDate = 'Invoice date is required.';
    if (!dueDate.trim()) errs.dueDate = 'Due date is required.';
    const amt = parseFloat(totalAmount);
    if (isNaN(amt) || amt <= 0) errs.totalAmount = 'Total amount must be greater than zero.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const updated = await updateAgeingDebtEntry(entry.id, {
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        due_date: dueDate,
        total_amount: parseFloat(totalAmount),
        category,
        status,
        notes: notes.trim(),
      });
      toast.success('Debt entry updated.');
      onUpdated?.(updated);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? err.message ?? 'Failed to update entry.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid payment amount.');
      return;
    }
    const remaining = parseFloat(totalAmount) - parseFloat(amountPaid);
    if (amt > remaining) {
      toast.error(`Payment cannot exceed remaining balance of ₱${remaining.toFixed(2)}.`);
      return;
    }

    setSaving(true);
    try {
      const updated = await recordDebtPayment(entry.id, { amount: amt });
      toast.success('Payment recorded successfully.');
      onPaymentRecorded?.(updated);
      setShowPaymentForm(false);
      setPaymentAmount('');
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? err.message ?? 'Failed to record payment.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async () => {
    setSaving(true);
    try {
      const updated = await markDebtEntryPaid(entry.id);
      toast.success('Debt marked as fully paid.');
      onPaymentRecorded?.(updated);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? err.message ?? 'Failed to mark as paid.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleWriteOff = async () => {
    if (!confirm('Write off this debt? This will set the balance to zero.')) return;
    setSaving(true);
    try {
      const updated = await writeOffDebtEntry(entry.id);
      toast.success('Debt written off.');
      onPaymentRecorded?.(updated);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? err.message ?? 'Failed to write off.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this debt entry? This action cannot be undone.')) return;
    setSaving(true);
    try {
      await deleteAgeingDebtEntry(entry.id);
      toast.success('Debt entry deleted.');
      onDeleted?.(entry.id);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? err.message ?? 'Failed to delete.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const remainingBalance = parseFloat(totalAmount) - parseFloat(amountPaid);
  const isDebtEntrySource = entry.source === 'debt_entry';

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Edit Ageing Debt</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {entry.patient_name} · #{entry.patient_number}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {!showPaymentForm ? (
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2
                      ${errors.invoiceNumber ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-orange-400 focus:border-orange-400'}`}
                  />
                  {errors.invoiceNumber && <p className="mt-1 text-xs text-red-600">{errors.invoiceNumber}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                  >
                    {CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2
                      ${errors.invoiceDate ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-orange-400 focus:border-orange-400'}`}
                  />
                  {errors.invoiceDate && <p className="mt-1 text-xs text-red-600">{errors.invoiceDate}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2
                      ${errors.dueDate ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-orange-400 focus:border-orange-400'}`}
                  />
                  {errors.dueDate && <p className="mt-1 text-xs text-red-600">{errors.dueDate}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={totalAmount}
                      onChange={e => setTotalAmount(e.target.value)}
                      className={`w-full rounded-xl border pl-7 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2
                        ${errors.totalAmount ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-orange-400 focus:border-orange-400'}`}
                    />
                  </div>
                  {errors.totalAmount && <p className="mt-1 text-xs text-red-600">{errors.totalAmount}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amountPaid}
                      disabled
                      className="w-full rounded-xl border border-gray-200 pl-7 pr-3 py-2 text-sm text-gray-400 bg-gray-50"
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">Remaining: ₱{remainingBalance.toFixed(2)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 resize-none"
                />
              </div>

              {remainingBalance > 0 && isDebtEntrySource && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPaymentForm(true)}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <DollarSign className="w-4 h-4" />
                    Record Payment
                  </button>
                  {status !== 'WRITTEN_OFF' && (
                    <button
                      type="button"
                      onClick={handleMarkPaid}
                      disabled={saving}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      Mark as Paid
                    </button>
                  )}
                </div>
              )}

              {remainingBalance > 0 && isDebtEntrySource && status !== 'WRITTEN_OFF' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleWriteOff}
                    disabled={saving}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    Write Off
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {saving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Saving…
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <p className="text-sm font-medium text-green-800">Record Payment</p>
                <p className="text-xs text-green-600 mt-1">
                  Outstanding: <strong>₱{remainingBalance.toFixed(2)}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={remainingBalance}
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-gray-300 pl-7 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentForm(false);
                    setPaymentAmount('');
                  }}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {saving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Recording…
                    </>
                  ) : (
                    'Record Payment'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};