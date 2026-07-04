import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/features/dashboard/components/DashboardLayout';
import { DynamicFormRenderer } from '../components/DynamicFormRenderer';
import { Save, FileSignature, AlertCircle, Printer } from 'lucide-react';
import { useClinicalNote } from '../hooks/useClinicalNote';
import { useAutoSave } from '../hooks/useAutoSave';
import { openPrintNote } from '../clinical-templates.api';
import toast from 'react-hot-toast';

export const NoteEditor: React.FC = () => {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const isNewNote = noteId === 'new';

  const { note, template, loading, saving, saveNote, signNote } = useClinicalNote(
    isNewNote ? null : Number(noteId)
  );

  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSigning, setIsSigning] = useState(false);

  useEffect(() => {
    if (note?.decrypted_content) {
      const mergedValues = { ...note.decrypted_content };
      if (note.chart_annotation_data) {
        Object.entries(note.chart_annotation_data).forEach(([fieldId, annotationData]: [string, any]) => {
          mergedValues[fieldId] = {
            canvas_image: mergedValues[fieldId] || null,
            doodle_data: annotationData.doodle_data || [],
          };
        });
      }
      setFormValues(mergedValues);
    }
  }, [note]);

  const { lastSaved, isAutoSaving } = useAutoSave({
    data: formValues,
    onSave: async (data) => {
      if (!isNewNote && !note?.is_signed) {
        await saveNote({ content: data }, true);
      }
    },
    interval: 30000,
    enabled: !isNewNote && !note?.is_signed,
  });

  const handleFieldChange = useCallback((fieldId: string, value: any) => {
    setFormValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
    
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldId];
      return newErrors;
    });
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    template?.structure.sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.required && !formValues[field.id]) {
          newErrors[field.id] = `${field.label} is required`;
        }
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await saveNote({ content: formValues });
      toast.success('Note saved successfully');
    } catch (error) {
      toast.error('Failed to save note');
    }
  };

  const handleSign = async () => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields before signing');
      return;
    }

    setIsSigning(true);
    try {
      await saveNote({ content: formValues });
      await signNote();
      toast.success('Note signed successfully');
      navigate('/clinical-notes');
    } catch (error) {
      toast.error('Failed to sign note');
    } finally {
      setIsSigning(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-600">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden bg-gray-50">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isNewNote ? 'New Clinical Note' : 'Edit Clinical Note'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {note?.patient_name} • {template?.name}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Auto-save indicator */}
              {!note?.is_signed && lastSaved && (
                <div className="text-sm text-gray-500">
                  {isAutoSaving ? 'Saving...' : `Saved ${lastSaved}`}
                </div>
              )}

              {/* Save Button */}
              {!note?.is_signed && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
              )}

              {/* Sign Button */}
              {!note?.is_signed && (
                <button
                  onClick={handleSign}
                  disabled={isSigning || saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <FileSignature className="w-4 h-4" />
                  {isSigning ? 'Signing...' : 'Sign & Finalize'}
                </button>
              )}

              {/* Signed Badge */}
              {note?.is_signed && (
                <div className="px-4 py-2 bg-green-100 text-green-700 rounded-lg flex items-center gap-2">
                  <FileSignature className="w-4 h-4" />
                  Signed
                </div>
              )}

              {/* Print Button - only show for existing notes */}
              {!isNewNote && note && (
                <button
                  onClick={() => openPrintNote(note.id)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                  title="Print Clinical Note"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              )}
            </div>
          </div>

          {/* Warning for signed notes */}
          {note?.is_signed && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                This note has been signed and cannot be edited. Signed on{' '}
                {new Date(note.signed_at!).toLocaleDateString()}.
              </div>
            </div>
          )}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {template && (
            <DynamicFormRenderer
              sections={template.structure.sections}
              values={formValues}
              onChange={handleFieldChange}
              errors={errors}
              disabled={note?.is_signed}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};