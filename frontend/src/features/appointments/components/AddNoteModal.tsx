import React, { useState } from 'react';
import { X, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import { createCalendarNote } from '../appointment.api';
import { useClinicBranches } from '@/features/clinics/hooks/useClinicBranches';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';
import type { CalendarNote } from '@/types';

interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (note: CalendarNote) => void;
  selectedClinicBranchId?: number | null;
  initialDate?: Date;
  initialTime?: string;
  initialEndTime?: string;
  practitionerId?: number | null;
}

const calculateEndTime = (startTime: string, durationMins: number): string => {
  const [h, m] = startTime.split(':').map(Number);
  const total  = h * 60 + m + durationMins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export const AddNoteModal: React.FC<AddNoteModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  selectedClinicBranchId,
  initialDate,
  initialTime,
  initialEndTime,
  practitionerId,
}) => {
  const { user } = useAuthStore();
  const { branches } = useClinicBranches();

  const today     = format(initialDate ?? new Date(), 'yyyy-MM-dd');
  const startTime = initialTime    ?? '09:00';
  const endTime   = initialEndTime ?? calculateEndTime(startTime, 30);

  const [message, setMessage]     = useState('');
  const [date, setDate]           = useState(today);
  const [start, setStart]         = useState(startTime);
  const [end, setEnd]             = useState(endTime);
  const [saving, setSaving]       = useState(false);
  const [msgError, setMsgError]   = useState('');

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setMessage('');
      setMsgError('');
      setDate(format(initialDate ?? new Date(), 'yyyy-MM-dd'));
      setStart(initialTime ?? '09:00');
      setEnd(initialEndTime ?? calculateEndTime(initialTime ?? '09:00', 30));
    }
  }, [isOpen, initialDate, initialTime, initialEndTime]);

  if (!isOpen) return null;

  const resolveClinicId = (): number | null => {
    if (selectedClinicBranchId != null) return selectedClinicBranchId;
    if (branches.length > 0) return branches[0].id;
    if (user?.clinic) return user.clinic as unknown as number;
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsgError('');

    if (!message.trim()) {
      setMsgError('Message is required.');
      return;
    }

    const clinicId = resolveClinicId();
    if (!clinicId) {
      toast.error('Could not determine clinic. Please try again.');
      return;
    }

    setSaving(true);
    try {
      const note = await createCalendarNote({
        clinic:      clinicId,
        date,
        start_time:  start,
        end_time:    end,
        message:     message.trim(),
        ...(practitionerId != null ? { practitioner: practitionerId } : {}),
      });
      toast.success('Note added to calendar.');
      onCreated?.(note);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to save note.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
                <StickyNote className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Add Calendar Note</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {format(new Date(date + 'T00:00:00'), 'EEEE, MMMM d')} · {start} – {end}
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={e => { setMessage(e.target.value); if (e.target.value.trim()) setMsgError(''); }}
                placeholder="Enter your note message…"
                rows={4}
                className={`w-full rounded-xl border px-3 py-2 text-sm text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 resize-none
                  ${msgError ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-orange-400 focus:border-orange-400'}`}
                autoFocus
              />
              {msgError && (
                <p className="mt-1 text-xs text-red-600">{msgError}</p>
              )}
            </div>

            {/* Date + Time row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
                <input
                  type="time"
                  value={start}
                  onChange={e => setStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
                <input
                  type="time"
                  value={end}
                  onChange={e => setEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                />
              </div>
            </div>

            {/* Info banner */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-xs text-orange-700">
              📌 Notes are <strong>non-blocking</strong> — appointments can still be booked at this time.
            </div>

            {/* Actions */}
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
                  'Add Note'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};
