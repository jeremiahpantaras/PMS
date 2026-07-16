import React, { useMemo, useRef, useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { DocumentFooter } from '@/components/DocumentFooter';
import { SignaturePad, type SignaturePadRef } from '@/components/SignaturePad';

interface ClinicConsentFormViewerProps {
  isOpen: boolean;
  clinicName: string;
  clinicLogo?: string;
  title: string;
  headerContent: string;
  bodyContent: string;
  patientFullName: string;
  patientEmail: string;
  onClose: () => void;
  onSigned: (signatureDataUrl: string) => void;
}

export const ClinicConsentFormViewer: React.FC<ClinicConsentFormViewerProps> = ({
  isOpen,
  clinicName,
  clinicLogo,
  title,
  headerContent,
  bodyContent,
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
    onSigned(signatureData);
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
          <h2 className="text-base font-semibold text-gray-900">Clinic Consent Form</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="w-[816px] max-w-full bg-white border border-gray-200 rounded-xl p-8 mx-auto">
            {/* Header */}
            <div
              style={{
                borderBottom: '2px solid #0284c7',
                paddingBottom: '16px',
                marginBottom: '28px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
              }}
            >
              <div>
                {clinicLogo ? (
                  <img
                    src={clinicLogo}
                    alt={clinicName}
                    style={{ height: '48px', maxWidth: '180px', objectFit: 'contain', display: 'block', marginBottom: '4px' }}
                  />
                ) : (
                  <p
                    style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#0369a1',
                      margin: 0,
                      lineHeight: 1.2,
                    }}
                  >
                    {clinicName}
                  </p>
                )}
                <p
                  style={{
                    fontSize: '11px',
                    color: '#6b7280',
                    margin: '4px 0 0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Clinic Compliance Document
                </p>
              </div>
              <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>{today}</p>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h1
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#111827',
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {title || 'Clinic Consent Form'}
              </h1>
            </div>

            {/* Patient Info */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px 24px',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                padding: '20px 24px',
                marginBottom: '32px',
              }}
            >
              {[
                { label: 'Patient Full Name', value: patientFullName || '—' },
                { label: 'Email Address', value: patientEmail || '—' },
                { label: 'Date', value: today },
                { label: 'Document Type', value: 'Clinic Consent Form' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ fontSize: '10px', color: '#6b7280', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {label}
                  </p>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Header Content */}
            {headerContent && (
              <div style={{ marginBottom: '24px', fontSize: '14px', color: '#374151' }}>
                <div dangerouslySetInnerHTML={{ __html: headerContent }} />
              </div>
            )}

            {/* Body Content */}
            <div
              style={{
                fontSize: '14px',
                lineHeight: 1.8,
                color: '#374151',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                padding: '20px 24px',
                marginBottom: '40px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {bodyContent}
            </div>

            {/* Signature */}
            <div
              style={{
                borderTop: '1px solid #e5e7eb',
                paddingTop: '28px',
                paddingBottom: '80px',
              }}
            >
              <p
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  margin: '0 0 10px',
                }}
              >
                Patient Signature
              </p>
              <div
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '10px',
                  backgroundColor: '#ffffff',
                  display: 'inline-block',
                  minWidth: '280px',
                }}
              >
                <SignaturePad
                  ref={signaturePadRef}
                  onChange={(isEmpty) => setHasSignature(!isEmpty)}
                />
              </div>
              <p
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#374151',
                  margin: '10px 0 0',
                }}
              >
                {patientFullName}
              </p>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>
                Signed electronically on {today}
              </p>

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
                <p style={{ fontSize: '9px', color: '#9ca3af', margin: 0 }}>{clinicName}</p>
              </div>
              <DocumentFooter />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-2">
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
              Agree & Sign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClinicConsentFormViewer;