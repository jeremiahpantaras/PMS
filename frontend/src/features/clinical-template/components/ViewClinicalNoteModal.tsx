import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { X, FileText, Loader2, Printer, Mail, CheckCircle, Pencil } from 'lucide-react';
import { getNote, getPrintNote } from '../clinical-templates.api';
import type { ClinicalNote, ClinicalTemplate, TemplateSection, TemplateField } from '@/types/clinicalTemplate';
import { ClinicalNoteTemplate } from './ClinicalNoteTemplate';
import { SendClinicalNoteModal } from './SendClinicalNoteModal';
import toast from 'react-hot-toast';
import { useClinicSettings } from '@/hooks/useClinicSettings';

interface ViewClinicalNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: number;
  onEdit?: (noteId: number) => void;
}

// Helper to format time
const formatTime = (time: string): string => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

// Helper to format date
const formatDate = (dateStr: string): string => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Helper to format full date
const formatFullDate = (dateStr: string): string => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export const ViewClinicalNoteModal: React.FC<ViewClinicalNoteModalProps> = ({
  isOpen,
  onClose,
  noteId,
  onEdit,
}) => {
  const [note, setNote] = useState<ClinicalNote | null>(null);
  const [template, setTemplate] = useState<ClinicalTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const { emailEnabled } = useClinicSettings();

  useEffect(() => {
    if (isOpen && noteId) {
      fetchNote();
    }
  }, [isOpen, noteId]);

  const fetchNote = async () => {
    setLoading(true);
    try {
      const noteData = await getNote(noteId);
      setNote(noteData);
      
      // Fetch template if available
      if (noteData.template) {
        const { getTemplate } = await import('../clinical-templates.api');
        const templateData = await getTemplate(noteData.template);
        setTemplate(templateData);
      }
    } catch (err) {
      console.error('Failed to load note:', err);
      toast.error('Failed to load clinical note');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const printData = await getPrintNote(noteId);

      // Render ClinicalNoteTemplate offscreen
      const A4_W = 794;
      const container = document.createElement('div');
      container.style.cssText = `position:fixed;left:-9999px;top:0;width:${A4_W}px;background:white;z-index:-1;overflow:hidden;`;
      document.body.appendChild(container);

      const root = createRoot(container);
      await new Promise<void>((resolve) => {
        root.render(<ClinicalNoteTemplate data={printData} />);
        setTimeout(resolve, 500);
      });

      // Collect all CSS rules from existing stylesheets
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
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to generate print view');
    } finally {
      setPrinting(false);
    }
  };

  // Generate initials for avatar
  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts.length > 1 
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() 
      : name.substring(0, 2).toUpperCase();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Clinical Note</h2>
              <p className="text-sm text-gray-500">
                {note?.template_name || 'Clinical Note'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(noteId)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                title="Edit Note"
              >
                <Pencil className="w-4 h-4" />
                Edit Note
              </button>
            )}
            <button
              onClick={() => emailEnabled && setSendEmailOpen(true)}
              disabled={!emailEnabled}
              title={!emailEnabled
                ? 'Email notifications are currently disabled in Clinic Setup. Enable Email Notifications to use this feature.'
                : 'Send Clinical Note via Email'
              }
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors ${
                !emailEnabled ? 'opacity-50 cursor-not-allowed hover:bg-white' : ''
              }`}
            >
              <Mail className="w-4 h-4" />
              Send Email
            </button>
            <button
              onClick={handlePrint}
              disabled={printing}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors"
            >
              {printing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              Print
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
            </div>
          ) : note ? (
            <div className="space-y-6">
              {/* Status Banner - Only show signed status */}
              {note.is_signed && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">
                    This note was signed on {note.signed_at ? formatFullDate(note.signed_at) : 'N/A'}
                  </span>
                </div>
              )}

              {/* Header Section */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
                  {/* Practitioner Avatar */}
                  {note.practitioner_avatar ? (
                    <img 
                      src={note.practitioner_avatar} 
                      alt={note.practitioner_name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-sky-500 shadow-sm"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-sky-100 border-2 border-sky-500 flex items-center justify-center text-sky-600 font-bold text-xl shadow-sm">
                      {getInitials(note.practitioner_name)}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">{note.practitioner_name}</h3>
                    <p className="text-sm text-gray-500">{note.template_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Date</p>
                    <p className="text-sm font-medium text-gray-900">{formatFullDate(note.date)}</p>
                  </div>
                </div>
                
                {/* Patient & Session Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Patient</p>
                    <p className="font-medium text-gray-900">{note.patient_name}</p>
                  </div>
                  {note.appointment_date && (
                    <div>
                      <p className="text-xs text-gray-500">Session Date</p>
                      <p className="font-medium text-gray-900">{formatDate(note.appointment_date)}</p>
                    </div>
                  )}
                  {note.appointment_time && (
                    <div>
                      <p className="text-xs text-gray-500">Session Time</p>
                      <p className="font-medium text-gray-900">{formatTime(note.appointment_time)}</p>
                    </div>
                  )}
                  {note.appointment_service && (
                    <div>
                      <p className="text-xs text-gray-500">Service</p>
                      <p className="font-medium text-gray-900">{note.appointment_service}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Template Content */}
              {note.decrypted_content && template?.structure?.sections && (
                <div className="space-y-4">
                  {template.structure.sections.map((section: TemplateSection, sectionIndex: number) => (
                    <div key={section.id || sectionIndex} className="bg-white rounded-lg border border-gray-200">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 rounded-t-lg">
                        <h4 className="font-semibold text-sm text-gray-900">{section.title}</h4>
                        {section.description && (
                          <p className="text-xs text-gray-500">{section.description}</p>
                        )}
                      </div>
                      <div className="p-4">
                        {section.fields && (section.fields as TemplateField[]).map((field: TemplateField, fieldIndex: number) => {
                          // Skip non-data field types in view mode
                          if (field.type === 'section_header') return null;
                          
                          // Render heading as a styled heading
                          if (field.type === 'heading') {
                            return (
                              <div key={field.id || fieldIndex} className="mb-3 last:mb-0 pt-2">
                                <h5 className="text-base font-semibold text-gray-800">{field.label}</h5>
                                {field.helpText && <p className="text-xs text-gray-500 mt-0.5">{field.helpText}</p>}
                              </div>
                            );
                          }

                          // Render chart with saved annotation image
                          if (field.type === 'chart') {
                            const chartValue = note.decrypted_content?.[field.id];
                            // After backend processing, chartValue is a plain base64 string.
                            // Guard against legacy object format too.
                            const canvasImage: string | null =
                              typeof chartValue === 'string' && chartValue.startsWith('data:image/')
                                ? chartValue
                                : chartValue && typeof chartValue === 'object' && 'canvas_image' in chartValue
                                  ? (chartValue as { canvas_image: string | null }).canvas_image
                                  : null;
                            const chartName =
                                 field.chartType === 'head'
                                  ? 'Head Chart'
                                  : 'Body Chart';
                            
                            const chartType = (field.chartType as 'body' | 'head' | 'hand' | 'feet') || 'body';
                            const fallbackImageMap: Record<string, string> = {
                              body: '/src/assets/charts/body-chart.webp',
                              head: '/src/assets/charts/head-chart.webp',
                              hand: '/src/assets/charts/hand-chart.webp',
                              feet: '/src/assets/charts/feet-chart.webp',
                            };
                            const fallbackImage = fallbackImageMap[chartType] || fallbackImageMap.body;
                            const finalImage = canvasImage || fallbackImage;

                            return (
                              <div key={field.id || fieldIndex} className="mb-4">
                                <p className="text-sm font-semibold text-gray-700 mb-2">{field.label}</p>
                                <img
                                  src={finalImage}
                                  alt={chartName}
                                  className="w-full rounded-lg border border-gray-200 shadow-sm"
                                />
                              </div>
                            );
                          }

                          const value = note.decrypted_content?.[field.id];
                          const displayValue = () => {
                            if (value === undefined || value === '' || value === null) {
                              return <span className="text-gray-400 italic">Not filled</span>;
                            }
                            if (typeof value === 'boolean') {
                              return value ? 'Yes' : 'No';
                            }
                            if (Array.isArray(value)) {
                              return value.length > 0 ? value.join(', ') : <span className="text-gray-400 italic">Not filled</span>;
                            }
                            // Scale: show numeric value
                            if (field.type === 'scale') {
                              return `${value} / ${field.max || 10}`;
                            }
                            return String(value);
                          };

                          return (
                            <div key={field.id || fieldIndex} className="mb-3 last:mb-0">
                              <p className="text-xs font-medium text-gray-600 mb-1">{field.label}</p>
                              <div className="text-sm text-gray-900 bg-gray-50 rounded p-2 min-h-[32px] whitespace-pre-wrap">
                                {displayValue()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="text-xs text-gray-500 flex justify-between border-t border-gray-200 pt-4">
                <div>
                  <p>Created: {note.created_at ? new Date(note.created_at).toLocaleString() : 'N/A'}</p>
                </div>
                <div>
                  <p>Last Updated: {note.updated_at ? new Date(note.updated_at).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No note data available
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      <SendClinicalNoteModal
        isOpen={sendEmailOpen}
        onClose={() => setSendEmailOpen(false)}
        noteId={noteId}
        patientName={note?.patient_name ?? ''}
      />
    </div>
  );
};
