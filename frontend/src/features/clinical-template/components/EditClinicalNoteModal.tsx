import React, { useState, useEffect, useCallback } from 'react';
import { X, FileText, FolderKanban, Loader2, Save, Calendar, ClipboardList } from 'lucide-react';
import { getActiveTemplates, getNote, updateNote } from '../clinical-templates.api';
import { getAppointments } from '@/features/appointments/appointment.api';
import { assignNoteToCase } from '@/features/patients/patientCases.api';
import type { PatientCase } from '@/types/patient';
import { DynamicFormRenderer } from './DynamicFormRenderer';
import type { ClinicalTemplate, TemplateSection } from '@/types/clinicalTemplate';
import type { Appointment } from '@/types';
import toast from 'react-hot-toast';

interface EditClinicalNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: number;
  onSuccess?: () => void;
  patientId?: number;
  cases?: PatientCase[];
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
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const EditClinicalNoteModal: React.FC<EditClinicalNoteModalProps> = ({
  isOpen,
  onClose,
  noteId,
  onSuccess,
  patientId,
  cases,
}) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ClinicalTemplate | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<number | null>(null);
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patientName, setPatientName] = useState<string>('');
  const [selectedCaseId, setSelectedCaseId] = useState<number | ''>('');

  // Fetch note data and templates on mount
  const fetchData = useCallback(async () => {
    setLoading(true);
    setSelectedCaseId('');
    try {
      // First fetch the note to get patient info
      const noteData = await getNote(noteId);
      console.log('[EditClinicalNoteModal] API response - note:', noteData);
      
      // Set patient info
      setPatientName(noteData.patient_name);
      setNoteDate(noteData.date);
      setSelectedAppointment(noteData.appointment);

      // Fetch templates and appointments in parallel
      const [templatesData, appointmentsData] = await Promise.all([
        getActiveTemplates(),
        getAppointments({ patient: noteData.patient, page_size: 100 }),
      ]);
      
      console.log('[EditClinicalNoteModal] API response - templates:', templatesData);
      console.log('[EditClinicalNoteModal] API response - appointments:', appointmentsData);
      
      // Sort appointments by date (newest first)
      const sortedAppointments = (appointmentsData.results || []).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setAppointments(sortedAppointments);

      // If note has template, set it and load content
      if (noteData.template) {
        const templateData = await import('../clinical-templates.api').then(m => m.getTemplate(noteData.template!));
        setSelectedTemplate(templateData);
        
        // Set content from note
        if (noteData.decrypted_content) {
          const mergedValues = { ...noteData.decrypted_content };
          if (noteData.chart_annotation_data) {
            Object.entries(noteData.chart_annotation_data).forEach(([fieldId, annotationData]: [string, any]) => {
              mergedValues[fieldId] = {
                canvas_image: mergedValues[fieldId] || null,
                doodle_data: annotationData.doodle_data || [],
              };
            });
          }
          setContent(mergedValues);
        }
      }
    } catch {
      toast.error('Failed to load note data');
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    if (isOpen && noteId) {
      fetchData();
    }
  }, [isOpen, noteId, fetchData]);

  // Handle appointment selection - auto-set date from appointment
  const handleAppointmentSelect = (appointmentId: number) => {
    setSelectedAppointment(appointmentId);
    // Auto-populate date from the selected appointment
    const selectedAppt = appointments.find(a => a.id === appointmentId);
    if (selectedAppt) {
      setNoteDate(selectedAppt.date);
    }
  };

  const handleSave = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    if (!selectedAppointment) {
      toast.error('Please select a session');
      return;
    }

    setSaving(true);
    try {
      console.log('[ClinicalNote Edit] Incoming Request:', JSON.stringify({
        noteId,
        date: noteDate,
        appointment: selectedAppointment,
        content: content,
      }, null, 2));

      await updateNote(noteId, {
        date: noteDate,
        appointment: selectedAppointment,
        content,
      });

      // Assign to case if selected (via API)
      if (selectedCaseId && patientId) {
        await assignNoteToCase(noteId, selectedCaseId);
      }

      console.log('[EditClinicalNoteModal] Note updated successfully!');
      toast.success('Clinical note updated successfully');
      console.log('[EditClinicalNoteModal] Calling onSuccess callback...');
      onSuccess?.();
      console.log('[EditClinicalNoteModal] Closing modal...');
      onClose();
    } catch (err: unknown) {
      console.error('Update note error:', err);
      
      let message = 'Failed to update note';
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const response = (err as { response?: { data?: { detail?: string } } }).response;
        if (response?.data) {
          if (typeof response.data === 'object') {
            const errors = Object.entries(response.data)
              .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
              .join('; ');
            message = errors || response.data.detail || message;
          } else if (typeof response.data === 'string') {
            message = response.data;
          }
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      
      toast.error(message);
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-350 h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit Clinical Note</h2>
            <p className="text-sm text-gray-500">Patient: {patientName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
            </div>
          ) : (
            // Form Editor (single column)
            <div className="h-full overflow-y-auto">
              <div className="space-y-6 max-w-3xl mx-auto">
                {/* Meta Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-1.5">
                      <Calendar className="w-4 h-4" />
                      Date
                    </label>
                    <input
                      type="date"
                      value={noteDate}
                      onChange={(e) => setNoteDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-1.5">
                      <ClipboardList className="w-4 h-4" />
                      Select Session
                    </label>
                    {appointments.length === 0 ? (
                      <div className="text-sm text-gray-500 py-2">
                        No sessions found for this patient.
                      </div>
                    ) : (
                      <select
                        value={selectedAppointment ?? ''}
                        onChange={(e) => handleAppointmentSelect(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                      >
                        <option value="">Select a session...</option>
                        {appointments.map((appt) => (
                          <option key={appt.id} value={appt.id}>
                            {formatDate(appt.date)} — {formatTime(appt.start_time)}
                            {appt.practitioner_name ? ` — ${appt.practitioner_name}` : ''}
                            {appt.service_name ? ` — ${appt.service_name}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Select the patient's session
                    </p>
                  </div>

                  {/* Assign to Case — only shown when caller provides cases */}
                  {cases && cases.length > 0 && (
                    <div className="md:col-span-2">
                      <label className="flex items-center gap-2 text-xs font-medium text-gray-600 mb-1.5">
                        <FolderKanban className="w-4 h-4" />
                        Assign Note to Case
                      </label>
                      <select
                        value={selectedCaseId}
                        onChange={(e) => setSelectedCaseId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                      >
                        <option value="">— Keep unassigned —</option>
                        {cases.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.title} ({c.status})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-400 mt-1">This note will be linked to the selected case on save.</p>
                    </div>
                  )}
                </div>

                {/* Template Info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-600" />
                    <span className="text-sm font-medium text-gray-700">
                      Template: {selectedTemplate?.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      (v{selectedTemplate?.version})
                    </span>
                  </div>
                </div>

                {/* Dynamic Form */}
                {selectedTemplate && selectedTemplate.structure?.sections && (
                  <div className="border border-gray-200 rounded-xl p-4">
                    <DynamicFormRenderer
                      sections={selectedTemplate.structure.sections as TemplateSection[]}
                      values={content as Record<string, unknown>}
                      onChange={(fieldId, value) => setContent((prev) => ({ ...prev, [fieldId]: value }))}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selectedAppointment}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};