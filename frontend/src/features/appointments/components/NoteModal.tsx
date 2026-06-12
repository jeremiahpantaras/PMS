import React, { useState, useEffect, useRef } from 'react';
import { X, StickyNote, User, Trash2, CalendarDays, Check, Pencil, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import type { CalendarNote } from '@/types';
import { deleteCalendarNote, updateCalendarNote } from '../appointment.api';

interface NoteModalProps {
  note: CalendarNote | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: (id: number) => void;
  onUpdated?: (note: CalendarNote) => void;
}

const fmt12 = (time: string): string => {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

export const NoteModal: React.FC<NoteModalProps> = ({
  note,
  isOpen,
  onClose,
  onDeleted,
  onUpdated,
}) => {
  const [deleting, setDeleting]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing]             = useState(false);
  const [editedMessage, setEditedMessage] = useState('');
  const [saving, setSaving]               = useState(false);
  const textareaRef                       = useRef<HTMLTextAreaElement>(null);

  // Sync edited message when note changes / modal opens
  useEffect(() => {
    if (isOpen && note) {
      setEditedMessage(note.message);
      setEditing(false);
      setConfirmDelete(false);
    }
  }, [isOpen, note]);

  // Auto-focus textarea when editing starts
  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [editing]);

  if (!isOpen || !note) return null;

  const formattedDate = (() => {
    try { return format(parseISO(note.date), 'EEEE, MMMM d, yyyy'); }
    catch { return note.date; }
  })();

  const handleSaveMessage = async () => {
    const trimmed = editedMessage.trim();
    if (!trimmed) { toast.error('Message cannot be empty.'); return; }
    if (trimmed === note.message) { setEditing(false); return; }
    setSaving(true);
    try {
      const updated = await updateCalendarNote(note.id, { message: trimmed });
      toast.success('Note updated.');
      onUpdated?.(updated);
      setEditing(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update note.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedMessage(note.message);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteCalendarNote(note.id);
      toast.success('Note removed.');
      onDeleted?.(note.id);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to delete note.';
      toast.error(msg);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleClose = () => {
    if (editing) { handleCancelEdit(); return; }
    setConfirmDelete(false);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
        onClick={handleClose}
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
              <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
                <StickyNote className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Calendar Note</h2>
                <p className="text-xs text-gray-400">Non-blocking annotation</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Editable Message */}
            <div className={`border rounded-xl p-4 transition-colors ${editing ? 'border-orange-400 bg-white' : 'border-orange-200 bg-orange-50'}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-[10px] font-semibold text-orange-600 uppercase tracking-wide">Message</span>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="p-1 hover:bg-orange-100 rounded-md transition-colors"
                    title="Edit message"
                  >
                    <Pencil className="w-3 h-3 text-orange-400" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleCancelEdit}
                      disabled={saving}
                      className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                      title="Cancel"
                    >
                      <X className="w-3 h-3 text-gray-400" />
                    </button>
                    <button
                      onClick={handleSaveMessage}
                      disabled={saving}
                      className="p-1 hover:bg-green-100 rounded-md transition-colors"
                      title="Save"
                    >
                      <Check className="w-3 h-3 text-green-600" />
                    </button>
                  </div>
                )}
              </div>
              {editing ? (
                <textarea
                  ref={textareaRef}
                  value={editedMessage}
                  onChange={e => setEditedMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveMessage();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  rows={4}
                  disabled={saving}
                  className="w-full text-sm text-gray-800 leading-relaxed resize-none border-0 p-0 bg-transparent focus:outline-none focus:ring-0"
                  placeholder="Enter note message…"
                />
              ) : (
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                  {note.message}
                </p>
              )}
              {editing && (
                <p className="text-[10px] text-gray-400 mt-2">⌘ Enter to save · Esc to cancel</p>
              )}
            </div>

            {/* Meta — Date & Time */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                  <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700">{formattedDate}</p>
                  <p className="text-xs text-gray-500">
                    {fmt12(note.start_time)} – {fmt12(note.end_time)}
                  </p>
                </div>
              </div>
            </div>

            {/* Audit Trail */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Audit Trail
              </h4>

              {/* Created By */}
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-sky-100 rounded-lg shrink-0">
                  <User className="w-3.5 h-3.5 text-sky-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Created by</p>
                  <p className="text-xs font-medium text-gray-800">
                    {note.created_by_name || 'Unknown'}
                  </p>
                  {note.created_at && (() => {
                    try {
                      return (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {format(parseISO(note.created_at), 'MMM d, yyyy · h:mm a')}
                        </p>
                      );
                    } catch { return null; }
                  })()}
                </div>
              </div>

              {/* Modified By — always shown */}
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-purple-100 rounded-lg shrink-0">
                  <Clock className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Modified by</p>
                  {note.modified_by_name ? (
                    <>
                      <p className="text-xs font-medium text-gray-800">{note.modified_by_name}</p>
                      {note.updated_at && (() => {
                        try {
                          return (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {format(parseISO(note.updated_at), 'MMM d, yyyy · h:mm a')}
                            </p>
                          );
                        } catch { return null; }
                      })()}
                    </>
                  ) : (
                    <p className="text-[10px] text-gray-400 italic mt-0.5">Not yet modified</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 italic">
                📌 Notes are non-blocking — appointments can overlap this time.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`flex items-center gap-2 px-4 py-2 text-sm rounded-xl font-medium transition-all
                  ${confirmDelete
                    ? 'bg-red-600 hover:bg-red-700 text-white border border-red-700'
                    : 'bg-white hover:bg-red-50 text-red-500 border border-red-300 hover:border-red-400'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Removing…' : confirmDelete ? 'Confirm Remove' : 'Remove Note'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
