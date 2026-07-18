import React from 'react';
import { AlertTriangle, Calendar, X, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { PractitionerRoleImpact } from '../../types/staff.types';

interface DeleteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  staffName: string;
  impact?: PractitionerRoleImpact;
  isPractitioner: boolean;
}

export const DeleteStaffModal: React.FC<DeleteStaffModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  loading,
  staffName,
  impact,
  isPractitioner,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!loading ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-200/50">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900">
                {isPractitioner ? 'Delete Practitioner' : 'Delete Staff Member'}
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Confirm deletion for{' '}
                <span className="font-semibold text-gray-700">{staffName}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-2 -mt-1 -mr-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {isPractitioner && impact && impact.future_appointments > 0 ? (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <p className="font-semibold">This practitioner has:</p>
                    <ul className="mt-2 space-y-1">
                      <li className="flex items-center gap-2 text-rose-700 font-medium">
                        <Calendar className="w-4 h-4" />
                        {impact.future_appointments} Future Appointment{impact.future_appointments !== 1 ? 's' : ''}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="text-sm text-gray-600 space-y-2">
                <p className="font-semibold text-gray-900">Deleting this practitioner will:</p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2"><X className="w-4 h-4 text-rose-500 shrink-0" /> Cancel future appointments</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Preserve all completed appointments</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Preserve patient records</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Preserve clinical notes</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Preserve invoices & audit history</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              <p>Are you sure you want to permanently delete this user? This action cannot be undone.</p>
              {isPractitioner && (
                <ul className="mt-4 space-y-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Preserve all historical appointments</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Preserve clinical notes and patient records</li>
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/80">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md text-sm font-semibold"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
