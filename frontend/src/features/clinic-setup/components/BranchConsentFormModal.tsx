import React, { useState, useEffect } from 'react';
import { Eye, Loader2, AlertCircle, X, ChevronDown, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBranchConsentForm, updateBranchConsentForm } from '@/features/clinics/clinic.api';
import ClinicConsentFormViewer from '@/features/patient-portal/components/ClinicConsentFormViewer';

interface BranchConsentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  // All accessible branches
  accessibleBranches: { id: number; name: string }[];
  // The initially selected branch ID
  initialBranchId: number | null;
  onSuccess: () => void;
}

export const BranchConsentFormModal: React.FC<BranchConsentFormModalProps> = ({ 
  isOpen, 
  onClose, 
  accessibleBranches,
  initialBranchId,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(initialBranchId);
  const [consentEnabled, setConsentEnabled] = useState(false);
  const [headerContent, setHeaderContent] = useState('');
  const [bodyContent, setBodyContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Determine RBAC context

  const hasMultipleAccessibleBranches = accessibleBranches.length > 1;

  // Load consent data when branch changes
  useEffect(() => {
    if (!isOpen || !selectedBranchId) return;

    let isMounted = true;
    const fetchConsent = async () => {
      try {
        setLoading(true);
        const consent = await getBranchConsentForm(selectedBranchId);
        
        // If the backend returns {} (meaning no consent form exists yet)
        if (isMounted && consent && Object.keys(consent).length > 0) {
          setConsentEnabled(consent.is_active || false);
          setHeaderContent(consent.header_content || '');
          setBodyContent(consent.body_content || '');
          setUpdatedAt(consent.updated_at || consent.created_at || null);
        } else if (isMounted) {
          // No consent form exists yet (returned empty object)
          setConsentEnabled(false);
          setHeaderContent('');
          setBodyContent('');
          setUpdatedAt(null);
        }
      } catch (e: any) {
        if (isMounted) {
          console.error('Failed to load branch consent', e);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchConsent();
    return () => { isMounted = false; };
  }, [isOpen, selectedBranchId]);

  // Sync initialBranchId when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialBranchId) {
        setSelectedBranchId(initialBranchId);
      } else if (accessibleBranches.length > 0) {
        setSelectedBranchId(accessibleBranches[0].id);
      }
    }
  }, [isOpen, initialBranchId, accessibleBranches]);

  const handleSave = async () => {
    if (!selectedBranchId) return;
    if (consentEnabled && !bodyContent.trim()) {
      toast.error('Body content is required if consent is enabled.');
      return;
    }

    try {
      setSaving(true);
      await updateBranchConsentForm(selectedBranchId, {
        title: 'Clinic Consent Form',
        header_content: headerContent.trim(),
        body_content: bodyContent.trim(),
        is_active: consentEnabled,
      });
      toast.success('Consent form updated successfully.');
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update consent form.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const selectedBranchName = accessibleBranches.find(b => b.id === selectedBranchId)?.name || 'Unknown Branch';
  
  // Format dates securely
  const formattedUpdatedDate = updatedAt ? new Date(updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Never';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Configure Clinic Consent Form</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Phase 4: Assign To Dropdown Logic */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Assign Clinic Consent Form To</label>
            {!hasMultipleAccessibleBranches ? (
              // Case A: Manager with 1 branch, or Single Branch Clinic. Auto-selected, disabled, readonly.
              <input
                type="text"
                value={selectedBranchName}
                readOnly
                disabled
                className="w-full px-3 py-2 bg-gray-100 border border-gray-200 text-gray-500 rounded-lg text-sm cursor-not-allowed"
              />
            ) : (
              // Case B / Owner: Dropdown of accessible branches
              <div className="relative">
                <select
                  value={selectedBranchId || ''}
                  onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                  className="w-full pl-3 pr-10 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {accessibleBranches.map(branch => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Phase 7: Consent Information Card */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Clinic Consent Information</p>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Assigned Branch:</p>
                <p className="text-sm font-medium text-gray-900">{selectedBranchName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Status:</p>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  {consentEnabled ? (
                    <span className="text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Enabled</span>
                  ) : (
                    <span className="text-gray-500 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Disabled</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Updated By:</p>
                <p className="text-sm font-medium text-gray-900">System</p> {/* Mocked for now since backend doesn't store this */}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Last Updated:</p>
                <p className="text-sm font-medium text-gray-900">{formattedUpdatedDate}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-gray-800">Require Consent Signature</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Enable to require patients to sign this during online booking.</p>
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

              {consentEnabled && (
                <div className="space-y-4 pt-2 border-t border-gray-100">
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
                  <div className="flex justify-start pt-2">
                    <button
                      type="button"
                      onClick={() => setPreviewOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0575E6] bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Live Preview
                    </button>
                  </div>
                </div>
              )}

              {!consentEnabled && (
                <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 mt-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Consent form is currently disabled for this branch. Patients will not be asked to sign it during booking.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold rounded-md hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {previewOpen && (
        <ClinicConsentFormViewer
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          clinicName={selectedBranchName}
          title="Patient Consent Form"
          headerContent={headerContent}
          bodyContent={bodyContent}
          patientFullName="John Doe (Preview)"
          patientEmail="john.doe@example.com"
          onSigned={() => {
            toast.success("Signature preview triggered");
          }}
        />
      )}
    </div>
  );
};
