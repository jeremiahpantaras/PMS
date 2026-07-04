import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2, User, Calendar, Clock, Eye } from 'lucide-react';
import { getNotes } from '@/features/clinical-template/clinical-templates.api';
import { ViewClinicalNoteModal } from '@/features/clinical-template/components/ViewClinicalNoteModal';
import type { ClinicalNote } from '@/types/clinicalTemplate';

interface ClinicalNotesTabProps {
  appointmentId: number;
}

// Helper to format date
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Helper to format time
const formatTime = (timeStr: string): string => {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

// Helper to get a text preview from decrypted_content
const getContentPreview = (content: Record<string, any> | null): string => {
  if (!content) return '';
  const values = Object.values(content);
  for (const val of values) {
    if (typeof val === 'string' && val.trim().length > 0 && !val.startsWith('data:image/')) {
      return val.length > 120 ? val.slice(0, 120) + '…' : val;
    }
  }
  return '';
};

export const ClinicalNotesTab: React.FC<ClinicalNotesTabProps> = ({ appointmentId }) => {
  const [viewingNoteId, setViewingNoteId] = useState<number | null>(null);

  const { data: clinicalNotes = [], isLoading, error } = useQuery<ClinicalNote[]>({
    queryKey: ['appointmentClinicalNotes', appointmentId],
    queryFn: () => getNotes({ appointment: appointmentId }),
    enabled: !!appointmentId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-sm text-red-600">Failed to load clinical notes.</p>
      </div>
    );
  }

  if (clinicalNotes.length === 0) {
    return (
      <div className="bg-gray-50 rounded-2xl py-10 text-center">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No clinical notes found for this appointment.</p>
        <p className="text-xs text-gray-400 mt-1">
          Clinical notes will appear here once created and linked to this session.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            Clinical Notes ({clinicalNotes.length})
          </h3>
        </div>

        {clinicalNotes.map((note) => {
          const preview = getContentPreview(note.decrypted_content);

          return (
            <div
              key={note.id}
              className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-sky-300 hover:shadow-md transition-all cursor-pointer"
              onClick={() => setViewingNoteId(note.id)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <p className="text-sm font-semibold text-gray-900">
                    {note.template_name || 'Clinical Note'}
                  </p>
                  {note.is_signed ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                      Signed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                      Draft
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {formatDate(note.date)}
                </span>
              </div>

              {/* Practitioner and timing info */}
              <div className="flex flex-wrap gap-4 mb-3 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  <span>{note.practitioner_name || 'Unknown Practitioner'}</span>
                </div>
                {note.appointment_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(note.appointment_date)}</span>
                  </div>
                )}
                {note.appointment_time && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatTime(note.appointment_time)}</span>
                  </div>
                )}
              </div>

              {/* Content preview snippet */}
              {preview ? (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{preview}</p>
              ) : (
                <p className="text-xs text-gray-400 italic mb-3">No content available</p>
              )}

              {/* View button */}
              <button
                onClick={(e) => { e.stopPropagation(); setViewingNoteId(note.id); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-sky-200 rounded-lg text-xs font-medium text-sky-600 hover:bg-sky-50 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                View Clinical Note
              </button>

              {/* Signed info */}
              {note.signed_at && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-green-600">
                    Signed on {new Date(note.signed_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* View Clinical Note Modal — reuses existing component from PatientProfile */}
      {viewingNoteId && (
        <ViewClinicalNoteModal
          isOpen={!!viewingNoteId}
          onClose={() => setViewingNoteId(null)}
          noteId={viewingNoteId}
        />
      )}
    </>
  );
};
