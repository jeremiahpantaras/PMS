import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Mail } from 'lucide-react';
import { ConsentFormTemplate } from './ConsentFormTemplate';
import type { PatientConsentRecord, PatientConsentDocumentRecord } from '../patient.api';
import { formatDate } from '../patientProfile.utils.tsx';
import { getMyClinic } from '@/features/clinics/clinic.api';

/** Unified consent type — accepts either the legacy PatientConsent or the new PatientConsentDocument. */
export type ViewableConsent = PatientConsentRecord | PatientConsentDocumentRecord;

/** Type guard: returns true if the consent is a PatientConsentDocumentRecord. */
function isConsentDocument(c: ViewableConsent): c is PatientConsentDocumentRecord {
  return 'signed_at' in c && 'signer_full_name' in c;
}

interface ViewConsentFormModalProps {
  isOpen: boolean;
  consent: ViewableConsent;
  onClose: () => void;
  onSendEmail: () => void;
}

export const ViewConsentFormModal: React.FC<ViewConsentFormModalProps> = ({
  isOpen,
  consent,
  onClose,
  onSendEmail,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [clinicLogo, setClinicLogo] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) return;
    getMyClinic().then((p) => setClinicLogo(p.logo_url ?? undefined)).catch(() => {});
  }, [isOpen]);

  // ── Normalize fields across both consent types ────────────────────────────
  const isDoc = isConsentDocument(consent);

  const title       = isDoc ? consent.title : 'Data Privacy Consent Form';
  const signerName  = isDoc ? consent.signer_full_name : consent.full_name;
  const signerEmail = isDoc ? consent.signer_email : consent.email;
  const dateSigned  = formatDate(isDoc ? consent.signed_at : consent.created_at);
  const clinicName  = consent.clinic_name ?? 'Clinic';
  const bodyText    = isDoc ? consent.body_snapshot : consent.consent_text;
  const headerHtml  = isDoc ? consent.header_snapshot : '';
  const isClinicConsent = isDoc && consent.type === 'CLINIC_CONSENT';

  const handlePrint = () => {
    if (!printRef.current) return;

    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} – ${signerName}</title>
          <style>
            @page { size: letter; margin: 0; }
            body { margin: 0; padding: 0; background: white; }
            * { box-sizing: border-box; }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-225 max-h-[95vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Signed by {signerName} · {dateSigned}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSendEmail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              Send Email
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Document ── */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
          <div className="flex justify-center">
            {/* Shadow wrapper gives the paper feel */}
            <div className="shadow-2xl rounded-sm" ref={printRef}>
              <ConsentFormTemplate
                clinicName={clinicName}
                clinicLogo={clinicLogo}
                patientName={signerName}
                patientEmail={signerEmail}
                dateSigned={dateSigned}
                consentText={bodyText}
                signature={consent.signature}
                title={title}
                headerContent={headerHtml || undefined}
                documentType={isClinicConsent ? 'Clinic Consent Form' : 'Data Privacy Consent Form'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
