import React, { useState, useEffect } from 'react';
import { Eye, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBranchConsentForm, updateBranchConsentForm } from '@/features/clinics/clinic.api';
import ClinicConsentFormViewer from '@/features/patient-portal/components/ClinicConsentFormViewer';

interface BranchConsentFormEditorProps {
  branchId: number;
  branchName: string;
}

export const BranchConsentFormEditor: React.FC<BranchConsentFormEditorProps> = ({ branchId, branchName }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [consentEnabled, setConsentEnabled] = useState(false);
  const [headerContent, setHeaderContent] = useState('');
  const [bodyContent, setBodyContent] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchConsent = async () => {
      try {
        setLoading(true);
        const consent = await getBranchConsentForm(branchId);
        if (isMounted && consent) {
          setConsentEnabled(consent.is_active);
          setHeaderContent(consent.header_content || '');
          setBodyContent(consent.body_content || '');
        }
      } catch (e: any) {
        if (isMounted && e.response?.status !== 404) {
          console.error('Failed to load branch consent', e);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchConsent();
    return () => { isMounted = false; };
  }, [branchId]);

  const handleSave = async () => {
    if (consentEnabled && !bodyContent.trim()) {
      toast.error('Body content is required if consent is enabled.');
      return;
    }

    try {
      setSaving(true);
      await updateBranchConsentForm(branchId, {
        title: 'Clinic Consent Form',
        header_content: headerContent.trim(),
        body_content: bodyContent.trim(),
        is_active: consentEnabled,
      });
      toast.success('Consent form updated successfully.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to update consent form.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-4 rounded-md border border-gray-200 space-y-4">
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">{branchName} Consent Form</h4>
          <p className="text-xs text-gray-500 mt-0.5">Configure the standard consent form required for online bookings at this branch.</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={consentEnabled} 
            onChange={(e) => setConsentEnabled(e.target.checked)} 
          />
          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {consentEnabled ? (
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Header Content <span className="text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={headerContent}
              onChange={(e) => setHeaderContent(e.target.value)}
              rows={3}
              placeholder="e.g. Acknowledgment of Policies and Procedures"
              className="w-full px-3 py-2 rounded-md border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Body Content <span className="text-red-500">*</span>
            </label>
            <textarea
              value={bodyContent}
              onChange={(e) => setBodyContent(e.target.value)}
              rows={6}
              placeholder="Enter the main terms and conditions..."
              className="w-full px-3 py-2 rounded-md border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0575E6] bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" /> Live Preview
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold rounded-md hover:opacity-90 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save Consent Form'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-xs text-blue-700 mt-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Consent form is currently disabled for this branch. Patients will not be asked to sign it during booking.</span>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold rounded-md hover:opacity-90 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      )}

      {previewOpen && (
        <ClinicConsentFormViewer
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          clinicName={branchName}
          headerHtml={headerContent}
          bodyHtml={bodyContent}
        />
      )}
    </div>
  );
};
