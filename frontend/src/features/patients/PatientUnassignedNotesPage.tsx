import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, FileText, FolderKanban, Loader2, Pencil, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { EditClinicalNoteModal } from '@/features/clinical-template/components/EditClinicalNoteModal';
import { ViewClinicalNoteModal } from '@/features/clinical-template/components/ViewClinicalNoteModal';
import { usePatientProfileContext } from './context/PatientProfileContext';
import {
  assignNotesToCase,
  getCaseIdForNote,
  listPatientCases,
  type PatientCase,
} from './patientCases.storage';
import { formatDate } from './patientProfile.utils.tsx';
import type { ClinicalNote } from '@/types/clinicalTemplate';

export const PatientUnassignedNotesPage = () => {
  const {
    patient,
    clinicalNotes,
    loadingPatient,
    loadingNotes,
    refreshClinicalNotes,
  } = usePatientProfileContext();

  const [cases, setCases] = useState<PatientCase[]>([]);
  const [viewingNoteId, setViewingNoteId] = useState<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  // Track per-note assignment state: noteId → selected case id string
  const [pendingAssignments, setPendingAssignments] = useState<Record<number, string>>({});
  const [assigningNoteId, setAssigningNoteId] = useState<number | null>(null);

  useEffect(() => {
    if (!patient) {
      setCases([]);
      return;
    }
    setCases(listPatientCases(patient.id));
  }, [patient, clinicalNotes]); // refresh cases list whenever notes change too

  // Notes with no case assignment
  const unassignedNotes = useMemo<ClinicalNote[]>(() => {
    if (!patient) return [];
    return clinicalNotes.filter((note) => !getCaseIdForNote(patient.id, note.id));
  }, [patient, clinicalNotes]);

  const handleAssign = (note: ClinicalNote, caseId: string) => {
    if (!patient || !caseId) return;

    setAssigningNoteId(note.id);
    try {
      assignNotesToCase(patient.id, [note.id], caseId);
      const targetCase = cases.find((c) => c.id === caseId);
      toast.success(`Note assigned to "${targetCase?.title ?? 'case'}"`);
      // Clear the pending selection for this note then refresh
      setPendingAssignments((prev) => {
        const next = { ...prev };
        delete next[note.id];
        return next;
      });
      void refreshClinicalNotes();
    } catch {
      toast.error('Failed to assign note');
    } finally {
      setAssigningNoteId(null);
    }
  };

  if (loadingPatient || !patient) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-2xl border border-gray-200">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div>
            <h1 className="text-xl font-heading text-gray-900">Unassigned Clinical Notes</h1>
            <p className="text-sm text-gray-500 mt-1">
              These notes are not linked to any case. Use the dropdown on each card to assign them.
            </p>
          </div>
        </div>

        {/* Content */}
        {loadingNotes ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-sky-400 animate-spin" />
          </div>
        ) : unassignedNotes.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-gray-700">All notes are assigned</p>
            <p className="text-xs text-gray-500 mt-1">
              Every clinical note for this patient is linked to a case.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {unassignedNotes.map((note) => (
              <div
                key={note.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-sky-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Note info — clickable to view */}
                  <button
                    type="button"
                    onClick={() => setViewingNoteId(note.id)}
                    className="flex-1 text-left group"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-gray-900 group-hover:text-sky-700 transition-colors">
                        {note.template_name || 'Clinical Note'}
                      </p>
                      {note.is_signed && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-2.5 h-2.5" />
                          Signed
                        </span>
                      )}
                      {note.is_draft && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          Draft
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(note.date)}
                      </span>
                      {note.practitioner_name && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {note.practitioner_name}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => setEditingNoteId(note.id)}
                      className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                      title="Edit note"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {cases.length === 0 ? (
                      <span className="flex items-center gap-1 text-xs text-gray-400 italic">
                        <FolderKanban className="w-3.5 h-3.5" />
                        No cases yet
                      </span>
                    ) : (
                      <>
                        <select
                          value={pendingAssignments[note.id] ?? ''}
                          onChange={(event) => {
                            const val = event.target.value;
                            setPendingAssignments((prev) => ({ ...prev, [note.id]: val }));
                          }}
                          disabled={assigningNoteId === note.id}
                          className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-50 max-w-45"
                        >
                          <option value="">Assign to case…</option>
                          {cases.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          disabled={!pendingAssignments[note.id] || assigningNoteId === note.id}
                          onClick={() => handleAssign(note, pendingAssignments[note.id])}
                          className="px-2.5 py-1.5 text-xs font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {assigningNoteId === note.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            'Assign'
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingNoteId && (
        <ViewClinicalNoteModal
          isOpen={Boolean(viewingNoteId)}
          onClose={() => setViewingNoteId(null)}
          noteId={viewingNoteId}
        />
      )}

      {editingNoteId && (
        <EditClinicalNoteModal
          isOpen={Boolean(editingNoteId)}
          onClose={() => setEditingNoteId(null)}
          noteId={editingNoteId}
          patientId={patient.id}
          cases={cases}
          onSuccess={() => {
            setEditingNoteId(null);
            void refreshClinicalNotes();
          }}
        />
      )}
    </>
  );
};

export default PatientUnassignedNotesPage;
