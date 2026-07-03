import React, { useState, useEffect } from 'react';
import { X, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { createAgeingDebtEntry } from '../../../reports.api';
import type { AgeingDebtEntryItem } from '../../../reports.api';

const CATEGORY_OPTIONS = [
  { value: 'CONSULTATION',  label: 'Consultation' },
  { value: 'TREATMENT',     label: 'Treatment' },
  { value: 'INVOICE',       label: 'Invoice' },
  { value: 'INSURANCE',     label: 'Insurance' },
  { value: 'CORPORATE',     label: 'Corporate Account' },
  { value: 'OTHER',         label: 'Other' },
];

interface AddAgeingDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (entry: AgeingDebtEntryItem) => void;
}

export const AddAgeingDebtModal: React.FC<AddAgeingDebtModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [patientId, setPatientId] = useState('');
  
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [category, setCategory] = useState('INVOICE');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setPatientId('');
      setInvoiceNumber('');
      setInvoiceDate('');
      setDueDate('');
      setTotalAmount('');
      setCategory('INVOICE');
      setNotes('');
      setErrors({});
      setSaving(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!patientId.trim()) {
      errs.patientId = 'Patient is required.';
    }
    if (!invoiceNumber.trim()) {
      errs.invoiceNumber = 'Invoice number is required.';
    }
    if (!invoiceDate.trim()) {
      errs.invoiceDate = 'Invoice date is required.';
    }
    if (!dueDate.trim()) {
      errs.dueDate = 'Due date is required.';
    }
    const amt = parseFloat(totalAmount);
    if (isNaN(amt) || amt <= 0) {
      errs.totalAmount = 'Outstanding amount must be greater than zero.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const entry = await createAgeingDebtEntry({
        patient: parseInt(patientId, 10),
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        due_date: dueDate,
        total_amount: parseFloat(totalAmount),
        category,
        notes: notes.trim(),
      });
      toast.success('Ageing debt entry created.');
      onCreated?.(entry);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? err.message ?? 'Failed to create entry.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Add Ageing Debt</h2>
                <p className="text-xs text-gray-500 mt-0.5">Create a manual debt entry</p>
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

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient / Client <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={patientId}
                onChange={e => {
                  setPatientId(e.target.value);
                  if (e.target.value.trim()) setErrors(prev => ({ ...prev, patientId: '' }));
                }}
                placeholder="Enter patient ID"
                className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 resize-none
                  ${errors.patientId ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-orange-400 focus:border-orange-400'}`}
                autoFocus
              />
              {errors.patientId && <p className="mt-1 text-xs text-red-600">{errors.patientId}</p>}
              <p className="mt-0.5 text-xs text-gray-400">Enter the patient ID number</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={e => {
                    setInvoiceNumber(e.target.value);
                    if (e.target.value.trim()) setErrors(prev => ({ ...prev, invoiceNumber: '' }));
                  }}
                  placeholder="INV-2025-0001"
                  className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-900 placeholder-gray-400
                    focus:outline-none focus:ring-2
                    ${errors.invoiceNumber ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-orange-400 focus:border-orange-400'}`}
                />
                {errors.invoiceNumber && <p className="mt-1 text-xs text-red-600">{errors.invoiceNumber}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={e => {
                    setInvoiceDate(e.target.value);
                    if (e.target.value.trim()) setErrors(prev => ({ ...prev, invoiceDate: '' }));
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-900
                    focus:outline-none focus:ring-2
                    ${errors.invoiceDate ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-orange-400 focus:border-orange-400'}`}
                />
                {errors.invoiceDate && <p className="mt-1 text-xs text-red-600">{errors.invoiceDate}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => {
                    setDueDate(e.target.value);
                    if (e.target.value.trim()) setErrors(prev => ({ ...prev, dueDate: '' }));
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-900
                    focus:outline-none focus:ring-2
                    ${errors.dueDate ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-orange-400 focus:border-orange-400'}`}
                />
                {errors.dueDate && <p className="mt-1 text-xs text-red-600">{errors.dueDate}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Outstanding Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalAmount}
                  onChange={e => {
                    setTotalAmount(e.target.value);
                    if (e.target.value) setErrors(prev => ({ ...prev, totalAmount: '' }));
                  }}
                  placeholder="0.00"
                  className={`w-full rounded-xl border pl-7 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400
                    focus:outline-none focus:ring-2
                    ${errors.totalAmount ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-orange-400 focus:border-orange-400'}`}
                />
              </div>
              {errors.totalAmount && <p className="mt-1 text-xs text-red-600">{errors.totalAmount}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes or remarks…"
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 resize-none"
              />
            </div>

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
                    Creating…
                  </>
                ) : (
                  'Create Entry'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};