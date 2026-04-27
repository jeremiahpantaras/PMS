import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Mail } from 'lucide-react';
import { ConsentFormTemplate } from './ConsentFormTemplate';
import type { PatientConsentRecord } from '../patient.api';
import { formatDate } from '../patientProfile.utils.tsx';
import { getMyClinic } from '@/features/clinics/clinic.api';

interface ViewConsentFormModalProps {
  isOpen: boolean;
  consent: PatientConsentRecord;
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

  const handlePrint = () => {
    if (!printRef.current) return;

    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Consent Form – ${consent.full_name}</title>
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

  const dateSigned = formatDate(consent.created_at);
  const clinicName = consent.clinic_name ?? 'Clinic';

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
            <h2 className="text-base font-bold text-gray-900">Data Privacy Consent Form</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Signed by {consent.full_name} · {dateSigned}
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
                patientName={consent.full_name}
                patientEmail={consent.email}
                dateSigned={dateSigned}
                consentText={consent.consent_text}
                signature={consent.signature}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
