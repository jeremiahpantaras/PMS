import { useEffect, useMemo, useState } from 'react';
import { Calendar, Edit, FileText, FolderKanban, Loader2, Mail, Plus, User } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  emailNote,
  getNotes,
  openPrintNote,
} from '@/features/clinical-template/clinical-templates.api';
import { CreateClinicalNoteModal } from '@/features/clinical-template/components/CreateClinicalNoteModal';
import { EditClinicalNoteModal } from '@/features/clinical-template/components/EditClinicalNoteModal';
import { ViewClinicalNoteModal } from '@/features/clinical-template/components/ViewClinicalNoteModal';
import { usePatientProfileContext } from './context/PatientProfileContext';
import {
  assignNotesToCase,
  getCaseIdForNote,
  getCaseNotes,
  getUnassignedNotes,
  listPatientCases,
} from './patientCases.storage';
import { formatDate } from './patientProfile.utils.tsx';

export const PatientClinicalNotesPage = () => {
  const {
    patient,
    clinicalNotes,
    loadingNotes,
    refreshClinicalNotes,
  } = usePatientProfileContext();

  const [searchParams, setSearchParams] = useSearchParams();

  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);
  const [viewingNoteId, setViewingNoteId] = useState<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [emailingNoteId, setEmailingNoteId] = useState<number | null>(null);
  const [printingNoteId, setPrintingNoteId] = useState<number | null>(null);
  const [createCaseId, setCreateCaseId] = useState('');

  const selectedCaseFilter = searchParams.get('case') ?? 'all';

  const patientCases = useMemo(() => {
    if (!patient) return [];
    return listPatientCases(patient.id);
  }, [patient]);

  useEffect(() => {
    if (selectedCaseFilter === 'all' || selectedCaseFilter === '__unassigned') return;

    const exists = patientCases.some((caseItem) => caseItem.id === selectedCaseFilter);
    if (!exists) {
      setSearchParams({}, { replace: true });
    }
  }, [patientCases, selectedCaseFilter, setSearchParams]);

  useEffect(() => {
    if (selectedCaseFilter !== 'all' && selectedCaseFilter !== '__unassigned') {
      setCreateCaseId(selectedCaseFilter);
    }
  }, [selectedCaseFilter]);

  useEffect(() => {
    if (!createCaseId) return;

    const exists = patientCases.some((caseItem) => caseItem.id === createCaseId);
    if (!exists) {
      setCreateCaseId('');
    }
  }, [createCaseId, patientCases]);

  const filteredNotes = useMemo(() => {
    if (!patient) return [];

    if (selectedCaseFilter === 'all') return clinicalNotes;
    if (selectedCaseFilter === '__unassigned') return getUnassignedNotes(patient.id, clinicalNotes);
    return getCaseNotes(patient.id, selectedCaseFilter, clinicalNotes);
  }, [clinicalNotes, patient, selectedCaseFilter]);

  const handleOpenCreateNote = () => {
    setIsCreateNoteOpen(true);
  };

  const handleSendEmail = async (noteId: number) => {
    setEmailingNoteId(noteId);
    try {
      await emailNote(noteId);
      toast.success('Clinical note sent to patient email');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to send email');
    } finally {
      setEmailingNoteId(null);
    }
  };

  const handlePrint = async (noteId: number) => {
    setPrintingNoteId(noteId);
    try {
      openPrintNote(noteId);
    } finally {
      setPrintingNoteId(null);
    }
  };

  if (!patient) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-2xl border border-gray-200">
        <p className="text-sm text-gray-500">Loading clinical notes...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-heading text-gray-900">Clinical Notes</h1>
              <p className="text-sm text-gray-500 mt-1">
                Create, review, and manage all notes linked to this patient.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateNote}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Note
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Filter by Case (optional)</label>
              <select
                value={selectedCaseFilter}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === 'all') {
                    setSearchParams({}, { replace: true });
                  } else {
                    setSearchParams({ case: value }, { replace: true });
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="all">All Cases</option>
                <option value="__unassigned">Unassigned Notes</option>
                {patientCases.map((caseItem) => (
                  <option key={caseItem.id} value={caseItem.id}>{caseItem.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Assign New Notes to Case</label>
              <select
                value={createCaseId}
                onChange={(event) => setCreateCaseId(event.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">No case assignment</option>
                {patientCases.map((caseItem) => (
                  <option key={caseItem.id} value={caseItem.id}>{caseItem.title}</option>
                ))}
              </select>
            </div>
          </div>

          {loadingNotes ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-7 h-7 text-sky-400 animate-spin" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                <FileText className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">No clinical notes found</p>
              <p className="text-xs text-gray-400 mt-1">
                {selectedCaseFilter === 'all'
                  ? 'Click "Create Note" to add a clinical note for this patient.'
                  : 'No notes match this case filter yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((note) => {
                const noteCaseId = getCaseIdForNote(patient.id, note.id);
                const noteCase = patientCases.find((caseItem) => caseItem.id === noteCaseId);

                return (
                  <article
                    key={note.id}
                    onClick={() => setViewingNoteId(note.id)}
                    className="p-4 border border-gray-200 rounded-lg hover:border-sky-300 hover:bg-sky-50/40 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {note.template_name || 'Clinical Note'}
                        </span>
                        {note.is_signed && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-700 border border-green-200">
                            Signed
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          <FolderKanban className="w-3 h-3" />
                          {noteCase?.title || 'Unassigned'}
                        </span>
                      </div>

                      <span className="text-xs text-gray-500">{formatDate(note.date)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {note.date}
                        </span>
                        {note.practitioner_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {note.practitioner_name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleSendEmail(note.id);
                          }}
                          disabled={emailingNoteId === note.id}
                          className="p-1.5 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors disabled:opacity-50"
                          title="Send to Client Email"
                        >
                          {emailingNoteId === note.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Mail className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handlePrint(note.id);
                          }}
                          disabled={printingNoteId === note.id}
                          className="p-1.5 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors disabled:opacity-50"
                          title="Print Clinical Note"
                        >
                          {printingNoteId === note.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingNoteId(note.id);
                          }}
                          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Edit Clinical Note"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <CreateClinicalNoteModal
        isOpen={isCreateNoteOpen}
        onClose={() => setIsCreateNoteOpen(false)}
        patientId={patient.id}
        patientName={patient.full_name}
        onSuccess={() => {
          const beforeNoteIds = new Set(clinicalNotes.map((note) => note.id));

          void (async () => {
            try {
              if (createCaseId) {
                const latestNotes = await getNotes({ patient: patient.id });
                const newNoteIds = latestNotes
                  .map((note) => note.id)
                  .filter((noteId) => !beforeNoteIds.has(noteId));

                if (newNoteIds.length > 0) {
                  assignNotesToCase(patient.id, newNoteIds, createCaseId);
                  toast.success('Clinical note assigned to selected case');
                }
              }
            } catch {
              // Ignore assignment errors and still refresh notes in the UI.
            } finally {
              await refreshClinicalNotes();
            }
          })();
        }}
      />

      {viewingNoteId && (
        <ViewClinicalNoteModal
          isOpen={Boolean(viewingNoteId)}
          onClose={() => setViewingNoteId(null)}
          noteId={viewingNoteId}
          onEdit={(noteId) => {
            setViewingNoteId(null);
            setEditingNoteId(noteId);
          }}
        />
      )}

      {editingNoteId && (
        <EditClinicalNoteModal
          isOpen={Boolean(editingNoteId)}
          onClose={() => setEditingNoteId(null)}
          noteId={editingNoteId}
          onSuccess={() => {
            setEditingNoteId(null);
            void refreshClinicalNotes();
          }}
        />
      )}
    </>
  );
};

export default PatientClinicalNotesPage;
