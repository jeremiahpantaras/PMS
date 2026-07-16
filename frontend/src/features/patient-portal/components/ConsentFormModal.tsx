import React, { useMemo, useRef, useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { DocumentFooter } from '@/components/DocumentFooter';
import { SignaturePad, type SignaturePadRef } from '@/components/SignaturePad';

interface ConsentFormModalProps {
  isOpen: boolean;
  patientFullName: string;
  patientEmail: string;
  onClose: () => void;
  onSigned: (signatureDataUrl: string, consentText: string) => void;
}

const CONSENT_TEXT = `I hereby give my informed consent for the clinic to collect, process, and store my personal and health information for scheduling, treatment, billing, follow-up, and related healthcare operations, in accordance with applicable data protection laws including the Data Privacy Act of 2012. I understand that my information will be handled confidentially and disclosed only when legally required or with my authorization.`;

export const ConsentFormModal: React.FC<ConsentFormModalProps> = ({
  isOpen,
  patientFullName,
  patientEmail,
  onClose,
  onSigned,
}) => {
  const signaturePadRef = useRef<SignaturePadRef>(null);
  const [hasSignature, setHasSignature] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  }, []);

  const handleClear = () => {
    signaturePadRef.current?.clear();
    setHasSignature(false);
  };

  const handleAgree = () => {
    const signatureData = signaturePadRef.current?.getSignatureData();
    if (!signatureData) return;
    onSigned(signatureData, CONSENT_TEXT);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-[95vw] max-h-[95vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Data Privacy Consent</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="w-[816px] h-[1056px] max-w-full bg-white border border-gray-200 rounded-xl p-8 mx-auto">
            <header className="mb-6 text-center">
              <p className="text-sm font-semibold text-gray-700">Clinic Compliance Document</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-2">Patient Data Privacy Consent Form</h3>
            </header>

            <section className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <p className="text-gray-500">Patient Full Name</p>
                <p className="font-medium text-gray-900">{patientFullName || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{patientEmail || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Date</p>
                <p className="font-medium text-gray-900">{today}</p>
              </div>
            </section>

            <section className="mb-8 text-[15px] leading-7 text-gray-800 whitespace-pre-wrap border border-gray-200 rounded-lg p-4 bg-gray-50">
              {CONSENT_TEXT}
            </section>

            <section>
              <p className="text-sm font-semibold text-gray-700 mb-2">Patient Signature</p>
              <div className="border border-gray-300 rounded-lg bg-white">
                <SignaturePad
                  ref={signaturePadRef}
                  onChange={(isEmpty) => setHasSignature(!isEmpty)}
                />
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-gray-500">Use mouse or touch to sign above.</p>
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>

              {/* Footer */}
              <div
                style={{
                  borderTop: '1px solid #e5e7eb',
                  paddingTop: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '24px',
                }}
              >
                <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>
                  This document is a legally binding consent form generated by the clinic management system.
                </p>
                <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>Data Privacy Consent</p>
              </div>
              <DocumentFooter />
            </section>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAgree}
            disabled={!hasSignature}
            className="btn-primary px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Agree & Save Signature
          </button>
        </div>
      </div>
    </div>
  );
};
