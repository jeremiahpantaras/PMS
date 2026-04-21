import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getPractitioners } from '@/features/clinics/clinic.api';
import type { Practitioner } from '@/features/clinics/clinic.api';
import { CaseModal, type CaseFormData } from './CaseModal';
import { usePatientProfileContext } from './context/PatientProfileContext';
import {
  createPatientCase,
  deletePatientCase,
  getCaseNoteCount,
  getCaseNotes,
  listPatientCases,
  type PatientCase,
  type PatientCaseStatus,
  updatePatientCase,
} from './patientCases.storage';
import { formatDate } from './patientProfile.utils.tsx';

export const PatientCasesPage = () => {
  const navigate = useNavigate();
  const { patient, clinicalNotes, loadingPatient } = usePatientProfileContext();

  const [cases, setCases] = useState<PatientCase[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<PatientCase | null>(null);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loadingPractitioners, setLoadingPractitioners] = useState(false);

  const loadCases = useCallback(() => {
    if (!patient) {
      setCases([]);
      return;
    }

    setCases(listPatientCases(patient.id));
  }, [patient]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingPractitioners(true);
      try {
        const { practitioners: list } = await getPractitioners();
        if (!cancelled) setPractitioners(list);
      } catch {
        // Non-critical
      } finally {
        if (!cancelled) setLoadingPractitioners(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const caseMetrics = useMemo(() => {
    if (!patient) return {} as Record<string, { noteCount: number; lastUpdated: string }>;

    const metrics: Record<string, { noteCount: number; lastUpdated: string }> = {};

    cases.forEach((caseItem) => {
      const notes = getCaseNotes(patient.id, caseItem.id, clinicalNotes);
      const noteCount = getCaseNoteCount(patient.id, caseItem.id, clinicalNotes);
      const latestNoteDate = notes
        .map((note) => note.updated_at || note.date)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

      metrics[caseItem.id] = {
        noteCount,
        lastUpdated: latestNoteDate || caseItem.createdAt,
      };
    });

    return metrics;
  }, [cases, clinicalNotes, patient]);

  const handleCreateCase = (data: CaseFormData) => {
    if (!patient) return;

    createPatientCase(patient.id, {
      title: data.title,
      description: data.description,
      status: data.status,
      primaryPractitionerId: data.primaryPractitionerId || undefined,
      primaryPractitionerName: data.primaryPractitionerName || undefined,
      referredBy: data.referredBy || undefined,
      referralInfo: data.referralInfo || undefined,
    });

    toast.success('Case created successfully');
    setIsCreateOpen(false);
    loadCases();
  };

  const handleSaveEditCase = (data: CaseFormData) => {
    if (!patient || !editingCase) return;

    updatePatientCase(patient.id, editingCase.id, {
      title: data.title,
      description: data.description,
      status: data.status,
      primaryPractitionerId: data.primaryPractitionerId || undefined,
      primaryPractitionerName: data.primaryPractitionerName || undefined,
      referredBy: data.referredBy || undefined,
      referralInfo: data.referralInfo || undefined,
    });

    toast.success('Case updated successfully');
    setEditingCase(null);
    loadCases();
  };

  const handleStatusChange = (caseId: string, status: PatientCaseStatus) => {
    if (!patient) return;

    const updated = updatePatientCase(patient.id, caseId, { status });
    if (updated) {
      toast.success('Case status updated');
      loadCases();
    }
  };

  const handleDeleteCase = (caseId: string, title: string) => {
    if (!patient) return;

    const confirmed = window.confirm(`Delete case \"${title}\"? This will remove note-to-case links.`);
    if (!confirmed) return;

    deletePatientCase(patient.id, caseId);
    toast.success('Case deleted');
    loadCases();
  };

  if (loadingPatient || !patient) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-2xl border border-gray-200">
        <p className="text-sm text-gray-500">Loading patient cases...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-heading text-gray-900">Cases</h1>
              <p className="text-sm text-gray-500 mt-1">Manage patient cases and case-linked clinical notes</p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Case
            </button>
          </div>
        </div>

        {cases.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 flex items-center justify-center">
              <FolderKanban className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700">No cases yet</p>
            <p className="text-xs text-gray-500 mt-1">Create your first case to start organizing notes by clinical context.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {cases.map((caseItem) => {
              const metrics = caseMetrics[caseItem.id];
              const noteCount = metrics?.noteCount ?? 0;
              const lastUpdated = metrics?.lastUpdated ?? caseItem.createdAt;

              return (
                <article key={caseItem.id} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{caseItem.title}</h3>
                      {caseItem.primaryPractitionerName && (
                        <p className="text-xs text-gray-500 mt-0.5">Primary: {caseItem.primaryPractitionerName}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">Created {formatDate(caseItem.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingCase(caseItem)}
                        className="p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                        title="Edit case"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCase(caseItem.id, caseItem.title)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete case"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {caseItem.description && (
                    <p className="text-sm text-gray-600 mt-3">{caseItem.description}</p>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="border border-gray-200 rounded-lg p-2.5">
                      <p className="text-[11px] text-gray-500">Case Notes</p>
                      <p className="text-lg font-semibold text-gray-900">{noteCount}</p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-2.5">
                      <p className="text-[11px] text-gray-500">Last Updated</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(lastUpdated)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <select
                      value={caseItem.status}
                      onChange={(event) => handleStatusChange(caseItem.id, event.target.value as PatientCaseStatus)}
                      className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="OPEN">Open</option>
                      <option value="MONITORING">Monitoring</option>
                      <option value="DISCHARGED">Discharged</option>
                      <option value="CLOSED">Closed</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => navigate(`/patients/${patient.id}/notes?case=${caseItem.id}`)}
                      className="px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 rounded-lg hover:bg-sky-100 transition-colors"
                    >
                      View Notes
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <CaseModal
        key="create-case"
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        mode="create"
        onSave={handleCreateCase}
        practitioners={practitioners}
        loadingPractitioners={loadingPractitioners}
      />

      <CaseModal
        key={editingCase?.id ?? 'edit-case'}
        isOpen={Boolean(editingCase)}
        onClose={() => setEditingCase(null)}
        mode="edit"
        initialValues={editingCase ?? undefined}
        onSave={handleSaveEditCase}
        practitioners={practitioners}
        loadingPractitioners={loadingPractitioners}
      />
    </>
  );
};

export default PatientCasesPage;
