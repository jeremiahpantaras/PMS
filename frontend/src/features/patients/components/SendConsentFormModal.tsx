import React, { useState, useEffect, useRef } from 'react';
import { X, Mail, Loader2, FileText, CheckCircle } from 'lucide-react';
import { getPractitioners, getMyClinic } from '@/features/clinics/clinic.api';
import { getContacts } from '@/features/contacts/contact.api';
import axiosInstance from '@/lib/axios';
import { ConsentFormTemplate } from './ConsentFormTemplate';
import type { ViewableConsent } from './ViewConsentFormModal';

/** Type guard: returns true if the consent is a PatientConsentDocumentRecord. */
function isConsentDocument(c: ViewableConsent): c is import('../patient.api').PatientConsentDocumentRecord {
  return 'signed_at' in c && 'signer_full_name' in c;
}

interface EmailSuggestion {
  name: string;
  email: string;
  role: string;
}

interface SendConsentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  consent: ViewableConsent;
}

export const SendConsentFormModal: React.FC<SendConsentFormModalProps> = ({
  isOpen,
  onClose,
  patientId,
  consent,
}) => {
  // ── Normalize fields across both consent types ──────────────────────────
  const isDoc = isConsentDocument(consent);
  const title       = isDoc ? consent.title : 'Data Privacy Consent Form';
  const signerName  = isDoc ? consent.signer_full_name : consent.full_name;
  const signerEmail = isDoc ? consent.signer_email : consent.email;
  const bodyText    = isDoc ? consent.body_snapshot : consent.consent_text;
  const headerHtml  = isDoc ? consent.header_snapshot : '';
  const isClinicConsent = isDoc && consent.type === 'CLINIC_CONSENT';

  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [subject, setSubject] = useState(`${title} – ${signerName}`);
  const [body, setBody] = useState(
    `Dear ${signerName},\n\nPlease find attached your signed ${title}.\n\nBest regards,\nClinic Team`
  );
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [clinicLogo, setClinicLogo] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [allSuggestions, setAllSuggestions] = useState<EmailSuggestion[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<EmailSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    setEmails(signerEmail ? [signerEmail] : []);
    setEmailInput('');
    setErrorMessage('');
    setSuccessMessage('');
    setAttachment(null);
    setSubject(`${title} – ${signerName}`);
    setBody(
      `Dear ${signerName},\n\nPlease find attached your signed ${title}.\n\nBest regards,\nClinic Team`
    );
    setIsGeneratingPdf(true);

    getMyClinic().then((p) => setClinicLogo(p.logo_url ?? undefined)).catch(() => {});

    let cancelled = false;

    // ── Fetch email suggestions ──────────────────────────────────────────────
    const fetchSuggestions = async () => {
      try {
        const practitionersData = await getPractitioners();
        const practitionerSugg = practitionersData.practitioners.map((p) => ({
          name: p.name,
          email: p.email,
          role: p.role || 'PRACTITIONER',
        }));

        interface User { email: string; first_name: string; last_name: string; role: string; }
        const usersResp = await axiosInstance.get('/users/');
        const users = usersResp.data.results || usersResp.data;
        const userSugg = (users as User[])
          .filter((u) => u.email && (u.role === 'STAFF' || u.role === 'ADMIN'))
          .map((u) => ({
            name: `${u.first_name} ${u.last_name}`,
            email: u.email,
            role: u.role,
          }));

        // Fetch active contacts with emails
        const contactsData = await getContacts({ is_active: true, page_size: 100 });
        const contactSugg = contactsData.results
          .filter((c) => c.email)
          .map((c) => ({
            name: c.full_name,
            email: c.email!,
            role: c.contact_type_display,
          }));

        const combined = Array.from(
          new Map([...practitionerSugg, ...userSugg, ...contactSugg].map((s) => [s.email, s])).values()
        );
        if (!cancelled) setAllSuggestions(combined);
      } catch {
        // suggestions are optional — silent fail
      }
    };

    fetchSuggestions();

    // ── Generate PDF from ConsentFormTemplate ────────────────────────────────
    const generatePdf = async () => {
      try {
        const A4_W = 816;
        const A4_H = 1056;
        const container = document.createElement('div');
        container.style.cssText = `position:fixed;left:-9999px;top:0;width:${A4_W}px;min-height:${A4_H}px;background:white;z-index:-1;overflow:hidden;`;
        document.body.appendChild(container);

        const { createRoot } = await import('react-dom/client');
        const root = createRoot(container);

        const dateField = isDoc ? consent.signed_at : consent.created_at;
        const dateSigned = dateField
          ? new Date(dateField).toLocaleDateString('en-PH', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

        await new Promise<void>((resolve) => {
          root.render(
            <ConsentFormTemplate
              clinicName={consent.clinic_name ?? 'Clinic'}
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
          );
          setTimeout(resolve, 800);
        });

        const captureH = Math.max(container.scrollHeight, A4_H);
        const html2canvas = (await import('html2canvas-pro')).default;
        const canvas = await html2canvas(container, {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: A4_W,
          height: captureH,
          windowWidth: A4_W,
        });

        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF('p', 'mm', 'letter');
        const pdfW = 215.9; // letter width in mm
        const pdfH = (canvas.height * pdfW) / canvas.width;
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, pdfW, Math.min(pdfH, 279.4));

        const blob = pdf.output('blob');
        const slug = signerName.replace(/\s+/g, '-').toLowerCase();
        const file = new File([blob], `consent-form-${slug}.pdf`, { type: 'application/pdf' });

        root.unmount();
        document.body.removeChild(container);

        if (!cancelled) setAttachment(file);
      } catch {
        if (!cancelled) setErrorMessage('Failed to generate PDF. Email will be sent without attachment.');
      } finally {
        if (!cancelled) setIsGeneratingPdf(false);
      }
    };

    generatePdf();

    return () => {
      cancelled = true;
    };
  }, [isOpen, consent]);

  // ── Close suggestions when clicking outside ──────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        emailInputRef.current && !emailInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const addEmail = (value: string) => {
    const candidate = value.trim();
    if (!candidate || !isValidEmail(candidate) || emails.includes(candidate)) return;
    setEmails((prev) => [...prev, candidate]);
  };

  const handleEmailInput = (value: string) => {
    setEmailInput(value);

    if (/[\s,;]$/.test(value)) {
      const emailToAdd = value.trim().replace(/[;,]$/, '').trim();
      if (emailToAdd) addEmail(emailToAdd);
      setEmailInput('');
      setShowSuggestions(false);
      setFilteredSuggestions([]);
      return;
    }

    if (value.length > 0) {
      const filtered = allSuggestions.filter(
        (s) =>
          s.email.toLowerCase().includes(value.toLowerCase()) ||
          s.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredSuggestions(allSuggestions);
      setShowSuggestions(allSuggestions.length > 0);
    }
  };

  const handleSuggestionSelect = (s: EmailSuggestion) => {
    addEmail(s.email);
    setEmailInput('');
    setShowSuggestions(false);
    setFilteredSuggestions([]);
    emailInputRef.current?.focus();
  };

  const handleSend = async () => {
    setErrorMessage('');

    const trimmed = emailInput.trim();
    let recipients = emails;
    if (trimmed) {
      if (!isValidEmail(trimmed)) {
        setErrorMessage('Please enter a valid email address before sending.');
        return;
      }
      if (!emails.includes(trimmed)) {
        recipients = [...emails, trimmed];
        setEmails(recipients);
      }
      setEmailInput('');
    }

    if (recipients.length === 0) {
      setErrorMessage('Please enter at least one valid email address.');
      return;
    }

    const wordCount = body.trim().split(/\s+/).length;
    if (wordCount > 500) {
      setErrorMessage('Message body exceeds 500 words. Please shorten it.');
      return;
    }

    setIsSending(true);
    try {
      const formData = new FormData();
      formData.append('to', recipients.join(','));
      formData.append('subject', subject);
      formData.append('body', body);
      if (attachment) formData.append('attachment', attachment);

      await axiosInstance.post(`/patients/${patientId}/email_consent/`, formData, {
        timeout: 90_000,
      });

      setSuccessMessage(`Consent form sent to ${recipients.join(', ')}`);
      setTimeout(() => {
        onClose();
        setSuccessMessage('');
      }, 2000);
    } catch (err: unknown) {
      const axiosMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErrorMessage(axiosMsg || 'Failed to send email. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60" onClick={onClose} />
      <div className="fixed inset-0 z-60 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Send Consent Form</h2>
                <p className="text-xs text-gray-500">{signerName}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {successMessage && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            {/* To */}
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                To <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-transparent bg-white flex flex-wrap gap-2 items-center">
                  {emails.map((email, idx) => (
                    <div
                      key={`${email}-${idx}`}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-100 text-sky-700 rounded-lg text-xs font-medium"
                    >
                      <span className="truncate">{email}</span>
                      <button
                        onClick={() => setEmails((prev) => prev.filter((e) => e !== email))}
                        className="ml-0.5 hover:bg-sky-200 rounded p-0.5 transition-colors"
                        type="button"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <input
                    ref={emailInputRef}
                    type="text"
                    value={emailInput}
                    onChange={(e) => handleEmailInput(e.target.value)}
                    onFocus={() => emailInput.length > 0 && setShowSuggestions(true)}
                    placeholder={emails.length === 0 ? 'email@example.com' : 'Add more emails…'}
                    className="flex-1 min-w-37.5 outline-none bg-transparent text-sm"
                  />
                </div>

                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto"
                  >
                    {filteredSuggestions.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionSelect(s)}
                        className="w-full flex items-start gap-2 px-3 py-2 hover:bg-sky-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                          <p className="text-xs text-gray-500 truncate">{s.email}</p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded whitespace-nowrap ml-2">
                          {s.role}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Type an email then press space/comma/semicolon, or pick from suggestions.
              </p>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-600">Message</label>
                <span className={`text-xs ${wordCount > 500 ? 'text-red-500' : 'text-gray-400'}`}>
                  {wordCount}/500 words
                </span>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Attachment */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Attachment</label>
              {isGeneratingPdf && (
                <div className="flex items-center gap-3 p-3 bg-sky-50 border border-sky-200 rounded-xl">
                  <Loader2 className="w-4 h-4 text-sky-600 animate-spin shrink-0" />
                  <span className="text-sm text-sky-700">Generating consent form PDF…</span>
                </div>
              )}
              {!isGeneratingPdf && attachment && (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  <FileText className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-sm text-green-700 truncate flex-1">{attachment.name}</span>
                  <span className="text-xs text-green-500 shrink-0">
                    ({(attachment.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}
              {!isGeneratingPdf && !attachment && (
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-sm text-amber-700">
                    PDF generation failed. Email will be sent without attachment.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || isGeneratingPdf}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send Email
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
