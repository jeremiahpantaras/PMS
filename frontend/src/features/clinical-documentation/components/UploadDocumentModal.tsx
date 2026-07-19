import { useState, useRef } from 'react';
import { X, Upload, File as FileIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadCaseDocument } from '../api/caseDocuments.api';
import type { PatientCase } from '@/types/patient';

interface UploadDocumentModalProps {
  patientId: string | number;
  cases: PatientCase[];
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  { value: 'CLINICAL_NOTE', label: 'Clinical Note' },
  { value: 'LETTER', label: 'Letter' },
  { value: 'REPORT', label: 'Report' },
  { value: 'LAB_RESULT', label: 'Lab Result' },
  { value: 'IMAGING', label: 'Imaging' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'ATTACHMENT', label: 'Attachment' },
  { value: 'OTHER', label: 'Other' },
];

export const UploadDocumentModal = ({ patientId, cases, onClose, onSuccess }: UploadDocumentModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [patientCaseId, setPatientCaseId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!title) {
        setTitle(selected.name.split('.')[0]); // Default title to filename without extension
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }
    if (!title) {
      toast.error('Please provide a title');
      return;
    }

    try {
      setIsSubmitting(true);
      await uploadCaseDocument(
        patientId,
        patientCaseId === '' ? null : patientCaseId,
        file,
        title,
        category,
        description
      );
      toast.success('Document uploaded successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to upload document');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Upload Document</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            {/* File Upload Area */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">File *</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                  file ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400'
                }`}
              >
                <div className="space-y-1 text-center">
                  {file ? (
                    <FileIcon className="mx-auto h-12 w-12 text-indigo-500" />
                  ) : (
                    <Upload className="mx-auto h-12 w-12 text-slate-400" />
                  )}
                  <div className="flex text-sm text-slate-600 justify-center">
                    <span className="relative font-medium text-indigo-600 hover:text-indigo-500">
                      {file ? file.name : 'Upload a file'}
                    </span>
                  </div>
                  {!file && <p className="text-xs text-slate-500">PDF, PNG, JPG up to 10MB</p>}
                  {file && <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Document Title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assign to Case (Optional)</label>
              <select
                value={patientCaseId}
                onChange={(e) => setPatientCaseId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">-- No Case --</option>
                {cases.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                placeholder="Add any notes about this document..."
              />
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !file || !title}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      </div>
    </div>
  );
};
