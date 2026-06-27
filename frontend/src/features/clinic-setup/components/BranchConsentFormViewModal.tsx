import React, { useState, useEffect } from 'react';
import { FileText, Loader2, Eye, X, AlertCircle } from 'lucide-react';
import { getBranchConsentForm } from '@/features/clinics/clinic.api';
import { ClinicConsentFormViewer } from '@/features/patient-portal/components/ClinicConsentFormViewer';

interface BranchConsentFormViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: number;
  branchName: string;
}

export const BranchConsentFormViewModal: React.FC<BranchConsentFormViewModalProps> = ({
  isOpen,
  onClose,
  branchId,
  branchName,
}) => {
  const [loading, setLoading] = useState(true);
  
  // Consent data
  const [consentEnabled, setConsentEnabled] = useState(false);
  const [headerContent, setHeaderContent] = useState('');
  const [bodyContent, setBodyContent] = useState('');
  
  // Audit data
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedByName, setUpdatedByName] = useState<string>('-');
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [createdByName, setCreatedByName] = useState<string>('-');

  // Live preview state
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadConsent = async () => {
      try {
        setLoading(true);
        const consent = await getBranchConsentForm(branchId);
        
        // If the backend returns {} (meaning no consent form exists yet)
        if (isMounted && consent && Object.keys(consent).length > 0) {
          setConsentEnabled(consent.is_active || false);
          setHeaderContent(consent.header_content || '');
          setBodyContent(consent.body_content || '');
          setUpdatedAt(consent.updated_at || null);
          setCreatedAt(consent.created_at || null);
          setUpdatedByName(consent.updated_by_name || 'System');
          setCreatedByName(consent.created_by_name || 'System');
        } else if (isMounted) {
          // No consent form exists yet (returned empty object)
          setConsentEnabled(false);
          setHeaderContent('');
          setBodyContent('');
          setUpdatedAt(null);
          setCreatedAt(null);
          setUpdatedByName('-');
          setCreatedByName('-');
        }
      } catch (e: any) {
        if (isMounted) {
          console.error('Failed to load branch consent', e);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (isOpen) {
      loadConsent();
    }

    return () => { isMounted = false; };
  }, [isOpen, branchId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Window */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-indigo-100/50">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">View Consent Form</h3>
              <p className="text-sm text-gray-500">Read-only view for {branchName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          
          {/* Information Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-6 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Branch</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{branchName}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Status</p>
                {consentEnabled ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Enabled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                    Disabled
                  </span>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Created By</p>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">{createdByName}</span>
                  <span className="text-xs text-gray-500">
                    {createdAt ? new Date(createdAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Last Updated By</p>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">{updatedByName}</span>
                  <span className="text-xs text-gray-500">
                    {updatedAt ? new Date(updatedAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'}
                  </span>
                </div>
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
                  <h4 className="text-sm font-semibold text-gray-800">Consent Signature Requirement</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Whether patients are required to sign this during online booking.</p>
                </div>
              </div>

              {consentEnabled && (
                <div className="space-y-4 pt-2 border-t border-gray-100 flex flex-col items-center justify-center p-8">
                  <p className="text-sm text-gray-600 text-center mb-2">
                    This consent form is active and contains content.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg shadow-sm hover:bg-indigo-700 transition-colors"
                  >
                    <Eye className="w-4 h-4" /> Open Document Preview
                  </button>
                </div>
              )}

              {!consentEnabled && (
                <div className="flex items-start gap-2 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 mt-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-gray-400" />
                  <span>Consent form is currently disabled for this branch. Patients will not be asked to sign it during booking.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end bg-gray-50/50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {previewOpen && (
        <ClinicConsentFormViewer
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          clinicName={branchName}
          title="Patient Consent Form"
          headerContent={headerContent}
          bodyContent={bodyContent}
          patientFullName="John Doe (Preview)"
          patientEmail="john.doe@example.com"
          onSigned={() => {
            // Read-only, no-op
          }}
        />
      )}
    </div>
  );
};
