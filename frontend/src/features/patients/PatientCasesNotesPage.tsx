import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, ChevronRight, FileText, FolderKanban, Loader2, Mail, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { createRoot } from 'react-dom/client';
import { getNotes, getNote, getPrintNote } from '@/features/clinical-template/clinical-templates.api';
import { ClinicalNoteTemplate } from '@/features/clinical-template/components/ClinicalNoteTemplate';
import { CreateClinicalNoteModal } from '@/features/clinical-template/components/CreateClinicalNoteModal';
import { EditClinicalNoteModal } from '@/features/clinical-template/components/EditClinicalNoteModal';
import { SendClinicalNoteModal } from '@/features/clinical-template/components/SendClinicalNoteModal';
import { useClinicSettings } from '@/hooks/useClinicSettings';
import { getPractitioners } from '@/features/clinics/clinic.api';
import type { Practitioner } from '@/features/clinics/clinic.api';
import { CaseModal, type CaseFormData } from './CaseModal';
import { usePatientProfileContext } from './context/PatientProfileContext';
import {
  assignNotesToCase,
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
import type { ClinicalNote, ClinicalTemplate, TemplateSection, TemplateField } from '@/types/clinicalTemplate';

const getInitials = (name: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.substring(0, 2).toUpperCase();
};

const formatTime = (time: string): string => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

interface NoteDetailCardProps {
  note: ClinicalNote;
  onEdit: () => void;
}

const NoteDetailCard = ({ note, onEdit }: NoteDetailCardProps) => {
  const [fullNote, setFullNote] = useState<ClinicalNote | null>(null);
  const [template, setTemplate] = useState<ClinicalTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  const { emailEnabled } = useClinicSettings();

  useEffect(() => {
    let cancelled = false;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const noteData = await getNote(note.id);
        if (cancelled) return;
        setFullNote(noteData);
        if (noteData.template) {
          const { getTemplate } = await import('@/features/clinical-template/clinical-templates.api');
          const templateData = await getTemplate(noteData.template);
          if (!cancelled) setTemplate(templateData);
        }
      } catch {
        if (!cancelled) setFullNote(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchDetail();
    return () => { cancelled = true; };
  }, [note.id]);

  const displayNote = fullNote ?? note;

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const printData = await getPrintNote(note.id);
      const A4_W = 794;
      const container = document.createElement('div');
      container.style.cssText = `position:fixed;left:-9999px;top:0;width:${A4_W}px;background:white;z-index:-1;overflow:hidden;`;
      document.body.appendChild(container);
      const root = createRoot(container);
      await new Promise<void>((resolve) => {
        root.render(<ClinicalNoteTemplate data={printData} />);
        setTimeout(resolve, 500);
      });
      const cssRules: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          if (sheet.cssRules) {
            cssRules.push(Array.from(sheet.cssRules).map((r) => r.cssText).join('\n'));
          }
        } catch {
          if (sheet.href) cssRules.push(`@import url("${sheet.href}");`);
        }
      }
      const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map((link) => `<link rel="stylesheet" href="${(link as HTMLLinkElement).href}" />`)
        .join('\n');
      const printWindow = window.open('', '_blank', 'width=900,height=700');
      if (printWindow) {
        printWindow.document.write(`<!DOCTYPE html><html><head>
          <meta charset="UTF-8" />
          ${linkTags}
          <style>${cssRules.join('\n')}</style>
          <style>
            @page { size: A4 portrait; margin: 0; }
            html, body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          </style>
        </head><body>${container.innerHTML}</body></html>`);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 600);
      }
      root.unmount();
      document.body.removeChild(container);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to generate print view');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Card header: practitioner + actions */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        {displayNote.practitioner_avatar ? (
          <img
            src={displayNote.practitioner_avatar}
            alt={displayNote.practitioner_name}
            className="w-10 h-10 rounded-full object-cover border-2 border-sky-300 shadow-sm shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-sky-100 border-2 border-sky-200 flex items-center justify-center text-sky-700 font-bold text-sm shrink-0">
            {getInitials(displayNote.practitioner_name ?? '')}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">
            {displayNote.practitioner_name || 'Unknown Practitioner'}
          </p>
          <p className="text-xs text-gray-500 truncate">{displayNote.template_name || 'Clinical Note'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">{formatDate(displayNote.date)}</span>
          {displayNote.is_signed && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle className="w-2.5 h-2.5" />
              Signed
            </span>
          )}
          {displayNote.is_draft && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
              Draft
            </span>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-sky-700 hover:border-sky-300 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => emailEnabled && setSendEmailOpen(true)}
            disabled={!emailEnabled}
            title={!emailEnabled ? 'Email notifications are disabled in Clinic Setup' : 'Send via Email'}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-sky-700 hover:border-sky-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail className="w-3 h-3" />
            Email
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={printing}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors"
          >
            {printing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
            Print
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {/* Patient & Session info */}
          <div className="rounded-lg border border-gray-100 overflow-hidden">
            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Patient Information</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-3">
              {fullNote?.patient_name && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Patient Name</p>
                  <p className="text-xs font-medium text-gray-900">{fullNote.patient_name}</p>
                </div>
              )}
              {fullNote?.appointment_date && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Session Date</p>
                  <p className="text-xs font-medium text-gray-900">{formatDate(fullNote.appointment_date)}</p>
                </div>
              )}
              {fullNote?.appointment_time && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Session Time</p>
                  <p className="text-xs font-medium text-gray-900">{formatTime(fullNote.appointment_time)}</p>
                </div>
              )}
              {fullNote?.appointment_service && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Service</p>
                  <p className="text-xs font-medium text-gray-900">{fullNote.appointment_service}</p>
                </div>
              )}
            </div>
          </div>

          {/* Template sections */}
          {fullNote?.decrypted_content && template?.structure?.sections && (
            <div className="space-y-3">
              {(template.structure.sections as TemplateSection[]).map((section, sectionIndex) => (
                <div key={section.id || sectionIndex} className="rounded-lg border border-gray-100 overflow-hidden">
                  <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{section.title}</p>
                  </div>
                  <div className="p-3 space-y-2.5">
                    {(section.fields as TemplateField[])?.map((field, fieldIndex) => {
                      if (field.type === 'section_header') return null;

                      if (field.type === 'heading') {
                        return (
                          <h5 key={field.id || fieldIndex} className="text-xs font-semibold text-gray-700 pt-1">
                            {field.label}
                          </h5>
                        );
                      }

                      if (field.type === 'chart') {
                        const chartValue = fullNote.decrypted_content?.[field.id];
                        const canvasImage: string | null =
                          typeof chartValue === 'string' && chartValue.startsWith('data:image/')
                            ? chartValue
                            : chartValue && typeof chartValue === 'object' && 'canvas_image' in chartValue
                              ? (chartValue as { canvas_image: string | null }).canvas_image
                              : null;
                        return (
                          <div key={field.id || fieldIndex}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{field.label}</p>
                            {canvasImage ? (
                              <img
                                src={canvasImage}
                                alt="chart annotation"
                                className="w-full rounded-lg border border-gray-200"
                              />
                            ) : (
                              <div className="border border-dashed border-gray-200 rounded-lg p-3 text-center">
                                <p className="text-xs text-gray-400">No annotations recorded</p>
                              </div>
                            )}
                          </div>
                        );
                      }

                      const value = fullNote.decrypted_content?.[field.id];
                      const displayValue = (): string => {
                        if (value === undefined || value === '' || value === null) return '—';
                        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
                        if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—';
                        if (field.type === 'scale') return `${value} / ${field.max || 10}`;
                        return String(value);
                      };

                      return (
                        <div key={field.id || fieldIndex}>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">{field.label}</p>
                          <p className="text-sm text-gray-900 bg-gray-50 rounded px-2 py-1.5 min-h-8">{displayValue()}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SendClinicalNoteModal
        isOpen={sendEmailOpen}
        onClose={() => setSendEmailOpen(false)}
        noteId={note.id}
        patientName={displayNote.patient_name ?? ''}
      />
    </div>
  );
};

const STATUS_CONFIG: Record<PatientCaseStatus, { label: string; className: string }> = {
  OPEN:       { label: 'Open',       className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MONITORING: { label: 'Monitoring', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  DISCHARGED: { label: 'Discharged', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  CLOSED:     { label: 'Closed',     className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const CASES_PER_PAGE = 5;

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination = ({ currentPage, totalPages, onPageChange }: PaginationProps) => {
  if (totalPages <= 1) return null;

  return (
    <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="px-2.5 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Previous
      </button>

      <span className="text-xs text-gray-600">
        Page {currentPage} / {totalPages}
      </span>

      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="px-2.5 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  );
};

const getMonthLabel = (monthValue: string): string => {
  const [year, month] = monthValue.split('-').map(Number);
  if (!year || !month) return monthValue;

  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

export const PatientCasesNotesPage = () => {
  const {
    patient,
    clinicalNotes,
    loadingPatient,
    loadingNotes,
    refreshClinicalNotes,
  } = usePatientProfileContext();

  const [cases, setCases] = useState<PatientCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [notes, setNotes] = useState<ClinicalNote[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [page, setPage] = useState(1);

  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<PatientCase | null>(null);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loadingPractitioners, setLoadingPractitioners] = useState(false);

  const [isCreateNoteOpen, setIsCreateNoteOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);

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
    if (cases.length === 0) {
      setSelectedCaseId(null);
      return;
    }

    const selectedExists = selectedCaseId && cases.some((caseItem) => caseItem.id === selectedCaseId);
    if (!selectedExists) {
      setSelectedCaseId(cases[0].id);
    }
  }, [cases, selectedCaseId]);

  const monthOptions = useMemo(() => {
    const values = new Set<string>();
    cases.forEach((caseItem) => {
      values.add(caseItem.createdAt.slice(0, 7));
    });

    return Array.from(values).sort((a, b) => b.localeCompare(a));
  }, [cases]);

  const filteredCases = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return cases.filter((caseItem) => {
      const titleMatch = caseItem.title.toLowerCase().includes(normalizedSearch);
      const monthMatch = selectedMonth ? caseItem.createdAt.startsWith(selectedMonth) : true;
      return titleMatch && monthMatch;
    });
  }, [cases, searchTerm, selectedMonth]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / CASES_PER_PAGE));

  const paginatedCases = useMemo(() => {
    const startIndex = (page - 1) * CASES_PER_PAGE;
    return filteredCases.slice(startIndex, startIndex + CASES_PER_PAGE);
  }, [filteredCases, page]);

  const selectedCase = useMemo(
    () => cases.find((caseItem) => caseItem.id === selectedCaseId) ?? null,
    [cases, selectedCaseId]
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedMonth]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!patient || !selectedCase) {
      setNotes([]);
      return;
    }

    setNotes(getCaseNotes(patient.id, selectedCase.id, clinicalNotes));
  }, [patient, selectedCase, clinicalNotes]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingPractitioners(true);
      try {
        const { practitioners: list } = await getPractitioners();
        if (!cancelled) setPractitioners(list);
      } catch {
        // Non-critical — practitioners list is optional
      } finally {
        if (!cancelled) setLoadingPractitioners(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCreateCase = (data: CaseFormData) => {
    if (!patient) return;

    const createdCase = createPatientCase(patient.id, {
      title: data.title,
      description: data.description,
      status: data.status,
      primaryPractitionerId: data.primaryPractitionerId || undefined,
      primaryPractitionerName: data.primaryPractitionerName || undefined,
      referredBy: data.referredBy || undefined,
      referralInfo: data.referralInfo || undefined,
    });

    toast.success('Case created successfully');
    setIsCreateCaseOpen(false);
    loadCases();
    setSelectedCaseId(createdCase.id);
  };

  const handleDeleteCase = (caseId: string, title: string) => {
    if (!patient) return;

    const confirmed = window.confirm(`Delete case "${title}"? This will remove note-to-case links.`);
    if (!confirmed) return;

    deletePatientCase(patient.id, caseId);
    toast.success('Case deleted');
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
    updatePatientCase(patient.id, caseId, { status });
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
      <div className="h-full min-h-0 flex gap-6">
        <div className="w-[320px] bg-white rounded-2xl shadow p-4 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Cases</h2>
            <button
              type="button"
              onClick={() => setIsCreateCaseOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Case
            </button>
          </div>

          <div className="space-y-2 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search case..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Filter by Month</option>
              {monthOptions.map((monthValue) => (
                <option key={monthValue} value={monthValue}>
                  {getMonthLabel(monthValue)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {filteredCases.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <FolderKanban className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No cases found</p>
                <p className="text-xs text-gray-400 mt-1">
                  Try a different search or create a new case.
                </p>
              </div>
            ) : (
              paginatedCases.map((caseItem) => {
                const isActive = selectedCase?.id === caseItem.id;
                const statusCfg = STATUS_CONFIG[caseItem.status];
                const noteCount = getCaseNoteCount(patient.id, caseItem.id, clinicalNotes);

                return (
                  <div
                    key={caseItem.id}
                    onClick={() => setSelectedCaseId(caseItem.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                      isActive ? 'bg-sky-50 border-sky-400' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm text-gray-900 truncate flex-1">{caseItem.title}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingCase(caseItem);
                          }}
                          className="p-1 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                          title="Edit case"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteCase(caseItem.id, caseItem.title);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete case"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className={`w-4 h-4 transition-colors ${
                          isActive ? 'text-sky-500' : 'text-gray-300'
                        }`} />
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${
                          statusCfg.className
                        }`}>
                          {statusCfg.label}
                        </span>
                        {noteCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-sky-50 text-sky-600 border border-sky-100">
                            <FileText className="w-2.5 h-2.5" />
                            {noteCount}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">{formatDate(caseItem.createdAt)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>

        <div className="flex-1 bg-white rounded-2xl shadow p-6 min-h-0 flex flex-col">
          <div className="flex justify-between items-start gap-3 mb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 truncate">
                  {selectedCase ? selectedCase.title : 'Select a Case'}
                </h2>
                {selectedCase && (
                  <select
                    value={selectedCase.status}
                    onChange={(event) => handleStatusChange(selectedCase.id, event.target.value as PatientCaseStatus)}
                    onClick={(event) => event.stopPropagation()}
                    className={`text-xs border rounded-full px-2 py-0.5 font-medium focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer ${
                      STATUS_CONFIG[selectedCase.status].className
                    }`}
                  >
                    <option value="OPEN">Open</option>
                    <option value="MONITORING">Monitoring</option>
                    <option value="DISCHARGED">Discharged</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                )}
              </div>
              {selectedCase?.primaryPractitionerName && (
                <p className="text-xs text-gray-500 mt-0.5">Primary: {selectedCase.primaryPractitionerName}</p>
              )}
              {selectedCase?.description && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">{selectedCase.description}</p>
              )}
              {selectedCase?.referredBy && (
                <p className="text-xs text-gray-500 mt-0.5">Referral: {selectedCase.referredBy}</p>
              )}
            </div>

            {selectedCase && (
              <button
                type="button"
                onClick={() => setIsCreateNoteOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                Add Clinical Note
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {!selectedCase ? (
              <div className="text-gray-400 text-center mt-20">Select a case to view clinical notes</div>
            ) : loadingNotes ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-7 h-7 text-sky-400 animate-spin" />
              </div>
            ) : notes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <FileText className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500">No clinical notes for this case yet</p>
                <p className="text-xs text-gray-400 mt-1">Add a note to start documenting case progress.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notes.map((note) => (
                  <NoteDetailCard
                    key={note.id}
                    note={note}
                    onEdit={() => setEditingNoteId(note.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CaseModal
        key="create-case"
        isOpen={isCreateCaseOpen}
        onClose={() => setIsCreateCaseOpen(false)}
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

      {selectedCase && (
        <CreateClinicalNoteModal
          isOpen={isCreateNoteOpen}
          onClose={() => setIsCreateNoteOpen(false)}
          patientId={patient.id}
          patientName={patient.full_name}
          existingNotes={clinicalNotes
            .filter((note) => note.appointment !== null)
            .map((note) => ({ appointment: note.appointment as number }))}
          onSuccess={() => {
            const beforeNoteIds = new Set(clinicalNotes.map((note) => note.id));
            const selectedCaseAtSave = selectedCase.id;

            void (async () => {
              try {
                const latestNotes = await getNotes({ patient: patient.id });
                const newNoteIds = latestNotes
                  .map((note) => note.id)
                  .filter((noteId) => !beforeNoteIds.has(noteId));

                if (newNoteIds.length > 0) {
                  assignNotesToCase(patient.id, newNoteIds, selectedCaseAtSave);
                  toast.success('Clinical note assigned to selected case');
                }
              } catch {
                // Ignore assignment errors and still refresh notes in the UI.
              } finally {
                await refreshClinicalNotes();
              }
            })();
          }}
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

export default PatientCasesNotesPage;
