import React, { useState, useEffect } from 'react';
import { X, History, FileText, Loader2, Calendar } from 'lucide-react';
import { getNoteHistory } from '../clinical-templates.api';
import type { ClinicalNoteVersion } from '../clinical-templates.api';
import { DynamicFormRenderer } from './DynamicFormRenderer';
import toast from 'react-hot-toast';

interface ClinicalNoteHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: number;
  templateStructure: any; // Used to render the read-only form
}

export const ClinicalNoteHistoryModal: React.FC<ClinicalNoteHistoryModalProps> = ({
  isOpen,
  onClose,
  noteId,
  templateStructure,
}) => {
  const [history, setHistory] = useState<ClinicalNoteVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<ClinicalNoteVersion | null>(null);

  useEffect(() => {
    if (isOpen && noteId) {
      fetchHistory();
    }
  }, [isOpen, noteId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getNoteHistory(noteId);
      setHistory(data);
      if (data.length > 0) {
        setSelectedVersion(data[0]);
      }
    } catch (err) {
      console.error('Failed to load note history:', err);
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Pre-process the content to merge chart annotations before passing to renderer
  const renderValues = React.useMemo(() => {
    if (!selectedVersion || !selectedVersion.content) return {};
    
    // Deep copy content so we don't mutate the state directly
    const contentCopy = JSON.parse(JSON.stringify(selectedVersion.content));
    
    // Reconstruct chart objects
    if (selectedVersion.chart_annotation_data) {
      Object.entries(selectedVersion.chart_annotation_data).forEach(([fieldId, annotationData]: [string, any]) => {
        if (contentCopy[fieldId] && typeof contentCopy[fieldId] === 'string') {
          contentCopy[fieldId] = {
            canvas_image: contentCopy[fieldId],
            doodle_data: annotationData.doodle_data || [],
            chart_type: annotationData.chart_type
          };
        }
      });
    }
    return contentCopy;
  }, [selectedVersion]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <History className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Version History</h2>
              <p className="text-sm text-gray-500">View previous edits and amendments</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar - Version List */}
          <div className="w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                No version history found.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {history.map((version) => (
                  <button
                    key={version.id}
                    onClick={() => setSelectedVersion(version)}
                    className={`w-full text-left p-4 hover:bg-indigo-50 transition-colors ${
                      selectedVersion?.id === version.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-900">Version {version.version_number}</span>
                      <span className="text-xs text-gray-500">{formatDate(version.created_at)}</span>
                    </div>
                    <div className="text-sm text-gray-600 truncate">
                      By {version.created_by_name || 'System'}
                    </div>
                    {version.amendment_reason && (
                      <div className="mt-2 text-xs text-amber-800 bg-amber-100 rounded p-2 line-clamp-2">
                        <span className="font-semibold block mb-0.5">Amendment Reason:</span>
                        {version.amendment_reason}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Main Content - Selected Version View */}
          <div className="flex-1 overflow-y-auto bg-white p-6">
            {selectedVersion ? (
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-4">
                  <div className="bg-white p-2 rounded-lg shadow-sm border border-indigo-100">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">
                      Viewing Version {selectedVersion.version_number}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Saved on {formatDate(selectedVersion.created_at)} by {selectedVersion.created_by_name || 'System'}
                    </p>
                    {selectedVersion.amendment_reason && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">
                          Amendment Reason
                        </p>
                        <p className="text-sm text-amber-900">{selectedVersion.amendment_reason}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl p-6 relative">
                  <div className="absolute top-0 right-0 bg-gray-100 text-gray-500 px-3 py-1 rounded-bl-lg rounded-tr-xl text-xs font-medium border-b border-l border-gray-200">
                    READ ONLY
                  </div>
                  
                  {templateStructure && templateStructure.sections ? (
                    <div className="pointer-events-none opacity-90">
                      <DynamicFormRenderer
                        sections={templateStructure.sections}
                        values={renderValues}
                        onChange={() => {}} // Read-only
                      />
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      Template structure not available to render this version.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <FileText className="w-12 h-12 mb-4 opacity-50" />
                <p>Select a version from the left to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
