import { useMemo, useState } from 'react';
import { Download, Eye, FileText, Files } from 'lucide-react';
import { openPrintNote } from '@/features/clinical-template/clinical-templates.api';
import { ViewClinicalNoteModal } from '@/features/clinical-template/components/ViewClinicalNoteModal';
import { usePatientProfileContext } from './context/PatientProfileContext';
import { getCaseIdForNote, listPatientCases } from './patientCases.storage';
import { formatDate } from './patientProfile.utils.tsx';

interface PatientDocumentItem {
  id: string;
  title: string;
  type: 'Clinical' | 'Consent' | 'Legal';
  uploadedAt: string;
  noteId?: number;
  caseTitle?: string;
  isAvailable: boolean;
}

export const PatientDocumentsPage = () => {
  const { patient, clinicalNotes, loadingNotes } = usePatientProfileContext();
  const [viewingNoteId, setViewingNoteId] = useState<number | null>(null);

  const patientCases = useMemo(() => {
    if (!patient) return [];
    return listPatientCases(patient.id);
  }, [patient]);

  const documents = useMemo<PatientDocumentItem[]>(() => {
    if (!patient) return [];

    const noteDocs: PatientDocumentItem[] = clinicalNotes.map((note) => {
      const linkedCaseId = getCaseIdForNote(patient.id, note.id);
      const linkedCase = patientCases.find((caseItem) => caseItem.id === linkedCaseId);

      return {
        id: `note_${note.id}`,
        title: note.template_name || `Clinical Note ${note.id}`,
        type: 'Clinical',
        uploadedAt: note.created_at || note.date,
        noteId: note.id,
        caseTitle: linkedCase?.title,
        isAvailable: true,
      };
    });

    const legalDocs: PatientDocumentItem[] = [
      {
        id: 'consent_form_placeholder',
        title: 'Consent to Treatment Form',
        type: 'Consent',
        uploadedAt: patient.created_at,
        isAvailable: false,
      },
      {
        id: 'privacy_notice_placeholder',
        title: 'Data Privacy Agreement',
        type: 'Legal',
        uploadedAt: patient.created_at,
        isAvailable: false,
      },
    ];

    return [...noteDocs, ...legalDocs].sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }, [clinicalNotes, patient, patientCases]);

  if (!patient) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-2xl border border-gray-200">
        <p className="text-sm text-gray-500">Loading patient documents...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-heading text-gray-900">Documents</h1>
              <p className="text-sm text-gray-500 mt-1">
                Consent forms, legal records, and patient documentation
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-2 bg-sky-50 border border-sky-200 rounded-lg text-xs font-medium text-sky-700">
              <Files className="w-4 h-4" />
              {documents.filter((documentItem) => documentItem.isAvailable).length} available
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          {loadingNotes ? (
            <div className="py-10 text-center text-sm text-gray-500">Loading documents...</div>
          ) : documents.length === 0 ? (
            <div className="py-10 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 flex items-center justify-center">
                <FileText className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">No documents yet</p>
              <p className="text-xs text-gray-500 mt-1">Patient documents will appear here once available.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((documentItem) => (
                <article
                  key={documentItem.id}
                  className="border border-gray-200 rounded-xl p-4 hover:border-sky-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900">{documentItem.title}</h3>
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          {documentItem.type}
                        </span>
                        {documentItem.caseTitle && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                            {documentItem.caseTitle}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 mt-1">Date Uploaded: {formatDate(documentItem.uploadedAt)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!documentItem.isAvailable || !documentItem.noteId}
                        onClick={() => {
                          if (documentItem.noteId) {
                            setViewingNoteId(documentItem.noteId);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 rounded-lg hover:bg-sky-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>

                      <button
                        type="button"
                        disabled={!documentItem.isAvailable || !documentItem.noteId}
                        onClick={() => {
                          if (documentItem.noteId) {
                            openPrintNote(documentItem.noteId);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {viewingNoteId && (
        <ViewClinicalNoteModal
          isOpen={Boolean(viewingNoteId)}
          onClose={() => setViewingNoteId(null)}
          noteId={viewingNoteId}
        />
      )}
    </>
  );
};

export default PatientDocumentsPage;
