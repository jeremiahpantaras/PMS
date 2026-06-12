import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, Edit, Trash2, CheckCircle, XCircle,
  Loader2, Save, Eye, AlertTriangle,
} from 'lucide-react';
import axiosInstance from '@/lib/axios';
import toast from 'react-hot-toast';

interface ClinicConsentForm {
  id?: number;
  clinic?: number;
  title: string;
  header_content: string;
  body_content: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface SavePayload {
  title: string;
  header_content: string;
  body_content: string;
  is_active: boolean;
}

export const ConsentFormEditor: React.FC = () => {
  const [forms, setForms] = useState<ClinicConsentForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingForm, setEditingForm] = useState<ClinicConsentForm | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [headerContent, setHeaderContent] = useState('');
  const [bodyContent, setBodyContent] = useState('');
  const [isActive, setIsActive] = useState(false);

  const loadForms = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('/clinic-consent-forms/');
      setForms(res.data.results || res.data);
    } catch {
      toast.error('Failed to load consent forms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForms();
  }, []);

  const handleNew = () => {
    setEditingForm(null);
    setFormTitle('');
    setHeaderContent('');
    setBodyContent('');
    setIsActive(false);
    setIsCreating(true);
  };

  const handleEdit = (form: ClinicConsentForm) => {
    setEditingForm(form);
    setFormTitle(form.title);
    setHeaderContent(form.header_content || '');
    setBodyContent(form.body_content || '');
    setIsActive(form.is_active);
    setIsCreating(true);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingForm(null);
    setFormTitle('');
    setHeaderContent('');
    setBodyContent('');
    setIsActive(false);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!bodyContent.trim()) {
      toast.error('Body content is required');
      return;
    }

    setSaving(true);
    try {
      const payload: SavePayload = {
        title: formTitle.trim(),
        header_content: headerContent.trim(),
        body_content: bodyContent.trim(),
        is_active: isActive,
      };

      if (editingForm?.id) {
        await axiosInstance.patch(`/clinic-consent-forms/${editingForm.id}/`, payload);
        toast.success('Consent form updated');
      } else {
        await axiosInstance.post('/clinic-consent-forms/', payload);
        toast.success('Consent form created');
      }

      await loadForms();
      handleCancel();
    } catch (err: any) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const messages = Object.entries(data)
          .filter(([, v]) => v)
          .map(([key, val]) => {
            const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
            const msg = Array.isArray(val) ? val[0] : String(val);
            return key === 'detail' ? msg : `${label}: ${msg}`;
          });
        messages.forEach((msg) => toast.error(msg));
      } else {
        toast.error('Failed to save consent form');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (form: ClinicConsentForm) => {
    if (!form.id) return;
    if (!confirm('Are you sure you want to delete this consent form?')) return;

    try {
      await axiosInstance.delete(`/clinic-consent-forms/${form.id}/`);
      toast.success('Consent form deleted');
      await loadForms();
    } catch {
      toast.error('Failed to delete consent form');
    }
  };

  const handleSetActive = async (form: ClinicConsentForm) => {
    if (!form.id) return;

    try {
      await axiosInstance.patch(`/clinic-consent-forms/${form.id}/`, { is_active: true });
      toast.success('Consent form set as active');
      await loadForms();
    } catch {
      toast.error('Failed to set active consent form');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Clinic Consent Form</h2>
            <p className="text-xs text-gray-500">Create and manage your clinic&apos;s consent form</p>
          </div>
        </div>
        {!isCreating && (
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Consent Form
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {editingForm ? 'Edit Consent Form' : 'Create New Consent Form'}
          </h3>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Form Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g., Patient Consent Form"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Header Content */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Header Content
            </label>
            <textarea
              value={headerContent}
              onChange={(e) => setHeaderContent(e.target.value)}
              placeholder="Optional header text (e.g., clinic name, document type)"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Body Content */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Body / Terms Content <span className="text-red-500">*</span>
            </label>
            <textarea
              value={bodyContent}
              onChange={(e) => setBodyContent(e.target.value)}
              placeholder="Enter the consent form terms and conditions..."
              rows={8}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">
              Set as active consent form
            </label>
          </div>

          {!isActive && forms.some((f) => f.is_active) && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>There is already an active consent form. Only one can be active at a time.</span>
            </div>
          )}

          {/* Footer Notice */}
          <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
            <Eye className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              The footer with Malasakit branding is automatically added and cannot be edited.
              Historical consent records will preserve the exact content at signing time.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Consent Form'}
            </button>
          </div>
        </div>
      )}

      {/* Forms List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : forms.length === 0 && !isCreating ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-200">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
            <FileText className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">No consent forms yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Create your first clinic consent form</p>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Consent Form
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map((form) => (
            <div
              key={form.id}
              className={`bg-white rounded-xl border p-4 ${
                form.is_active ? 'border-indigo-300' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    form.is_active ? 'bg-indigo-100' : 'bg-gray-100'
                  }`}>
                    <FileText className={`w-4.5 h-4.5 ${form.is_active ? 'text-indigo-500' : 'text-gray-400'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{form.title}</h3>
                      {form.is_active && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {form.body_content?.substring(0, 80)}
                      {form.body_content?.length > 80 ? '...' : ''}
                    </p>
                    {form.created_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Created: {new Date(form.created_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {!form.is_active && (
                    <button
                      onClick={() => handleSetActive(form)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-green-600 transition-colors"
                      title="Set as active"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(form)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-indigo-600 transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(form)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConsentFormEditor;