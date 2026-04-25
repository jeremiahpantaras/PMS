import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Mail, Loader2, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { PMSInvoiceTemplate } from '@/components/invoices/PMSInvoiceTemplate';
import type { InvoiceClinicInfo, NextAppointmentInfo } from '@/components/invoices/PMSInvoiceTemplate';
import type { Invoice } from '@/types/billing';
import { useClinicSettings } from '@/hooks/useClinicSettings';
import { getPractitioners } from '@/features/clinics/clinic.api';
import { getContacts } from '@/features/contacts/contact.api';
import axiosInstance from '@/lib/axios';

interface EmailSuggestion {
  name: string;
  email: string;
  role: string;
}

interface SendInvoiceEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: number;
  invoiceNumber: string;
  patientName: string;
  patientEmail: string;
  appointmentDate: string;
  appointmentType: string;
  invoice?: Invoice;
  clinic?: InvoiceClinicInfo;
  nextAppointment?: NextAppointmentInfo | null;
}

export const SendInvoiceEmailModal: React.FC<SendInvoiceEmailModalProps> = ({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  patientName,
  patientEmail,
  appointmentDate,
  appointmentType,
  invoice,
  clinic,
  nextAppointment,
}) => {
  const [emails, setEmails] = useState<string[]>([patientEmail]);
  const [emailInput, setEmailInput] = useState('');
  const [subject, setSubject] = useState(`Invoice #${invoiceNumber} - Appointment Invoice`);
  const [body, setBody] = useState(
    `Dear ${patientName},\n\n` +
    `Thank you for your visit. Please find attached your invoice for the ${appointmentType} appointment on ${appointmentDate}.\n\n` +
    `Invoice Number: ${invoiceNumber}\n` +
    `If you have any questions, please don't hesitate to contact us.\n\n` +
    `Best regards,\n` +
    `Clinic Team`
  );
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { emailEnabled } = useClinicSettings();

  // Email suggestions state
  const [allSuggestions, setAllSuggestions] = useState<EmailSuggestion[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<EmailSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Auto-generate PDF from PMSInvoiceTemplate on mount
  const generatePdf = useCallback(async () => {
    if (!invoice) return;
    setIsGeneratingPdf(true);
    try {
      // A4 dimensions at 96 DPI
      const A4_WIDTH_PX = 794;  // 210mm
      const A4_HEIGHT_PX = 1122; // 297mm

      // Create an offscreen container at exact A4 width
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = `${A4_WIDTH_PX}px`;
      container.style.minHeight = `${A4_HEIGHT_PX}px`;
      container.style.background = 'white';
      container.style.zIndex = '-1';
      container.style.overflow = 'hidden';
      document.body.appendChild(container);

      // Render the template into the offscreen container
      const root = createRoot(container);
      await new Promise<void>((resolve) => {
        root.render(
          <PMSInvoiceTemplate
            invoice={invoice}
            clinic={clinic}
            showPaymentHistory={true}
            nextAppointment={nextAppointment}
            className="!max-w-none"
          />
        );
        // Wait for render + images to load
        setTimeout(resolve, 1000);
      });

      // Force the inner template to fill the full container width
      const templateEl = container.firstElementChild as HTMLElement;
      if (templateEl) {
        templateEl.style.maxWidth = 'none';
        templateEl.style.width = '100%';
      }

      // Capture to canvas at exact A4 width with optimized scale
      const captureHeight = Math.max(container.scrollHeight, A4_HEIGHT_PX);
      const canvas = await html2canvas(container, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: A4_WIDTH_PX,
        height: captureHeight,
        windowWidth: A4_WIDTH_PX,
      });

      // Convert to PDF with JPEG compression for smaller file size
      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      // If content exceeds one page, scale to fit single page
      const maxHeight = 297;
      if (pdfHeight > maxHeight) {
        // Scale to fit height, but always stretch to full width
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, maxHeight);
      } else {
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }

      // Convert to File
      const pdfBlob = pdf.output('blob');
      const pdfFile = new File([pdfBlob], `Invoice_${invoiceNumber}.pdf`, {
        type: 'application/pdf',
      });

      setAttachment(pdfFile);

      // Cleanup
      root.unmount();
      document.body.removeChild(container);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      setErrorMessage('Failed to auto-generate invoice PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [invoice, clinic, nextAppointment, invoiceNumber]);

  useEffect(() => {
    if (isOpen && invoice) {
      generatePdf();
    }
  }, [isOpen, invoice, generatePdf]);

  // Fetch email suggestions on modal open
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const fetchEmailSuggestions = async () => {
      try {
        // Fetch practitioners
        const practitionersData = await getPractitioners();
        const practitionerSuggestions = practitionersData.practitioners.map(p => ({
          name: p.name,
          email: p.email,
          role: p.role || 'PRACTITIONER',
        }));

        // Fetch staff/admin users
        interface User {
          email: string;
          first_name: string;
          last_name: string;
          role: string;
        }
        const usersResponse = await axiosInstance.get('/users/');
        const users = usersResponse.data.results || usersResponse.data;
        const userSuggestions = (users as User[])
          .filter((u: User) => u.email && (u.role === 'STAFF' || u.role === 'ADMIN'))
          .map((u: User) => ({
            name: `${u.first_name} ${u.last_name}`,
            email: u.email,
            role: u.role,
          }));

        // Fetch active contacts with emails
        const contactsData = await getContacts({ is_active: true, page_size: 100 });
        const contactSuggestions = contactsData.results
          .filter((c) => c.email)
          .map((c) => ({
            name: c.full_name,
            email: c.email!,
            role: c.contact_type_display,
          }));

        // Combine and deduplicate
        const combined = [...practitionerSuggestions, ...userSuggestions, ...contactSuggestions];
        const uniqueSuggestions = Array.from(
          new Map(combined.map(s => [s.email, s])).values()
        );

        if (!cancelled) setAllSuggestions(uniqueSuggestions);
      } catch (err) {
        // Silently fail - suggestions are optional
        if (!cancelled) console.error('Failed to fetch email suggestions:', err);
      }
    };

    fetchEmailSuggestions();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          emailInputRef.current && !emailInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEmailInput = (value: string) => {
    setEmailInput(value);
    
    // Check if user pressed space to add email
    if (value.endsWith(' ')) {
      const emailToAdd = value.trim();
      if (emailToAdd && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToAdd) && !emails.includes(emailToAdd)) {
        setEmails([...emails, emailToAdd]);
        setEmailInput('');
        setShowSuggestions(false);
      } else if (!emailToAdd) {
        setEmailInput('');
      }
      return;
    }
    
    // Filter suggestions as user types
    if (value.length > 0) {
      const filtered = allSuggestions.filter(s =>
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

  const handleSuggestionSelect = (suggestion: EmailSuggestion) => {
    if (!emails.includes(suggestion.email)) {
      setEmails([...emails, suggestion.email]);
    }
    setEmailInput('');
    setShowSuggestions(false);
    setFilteredSuggestions([]);
    emailInputRef.current?.focus();
  };

  const removeEmail = (emailToRemove: string) => {
    setEmails(emails.filter(e => e !== emailToRemove));
  };

  const handleSend = async () => {
    if (emails.length === 0) {
      setErrorMessage('Please enter at least one recipient email address');
      return;
    }

    setIsSending(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('access_token');
      
      // Join emails with comma (no spaces) for backend
      const emailsToSend = emails.join(',');
      
      const formData = new FormData();
      formData.append('to_email', emailsToSend);
      formData.append('subject', subject);
      formData.append('body', body);

      // If user attached a file, include it
      if (attachment) {
        formData.append('attachment', attachment);
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/invoices/${invoiceId}/send-email/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to send email');
      }

      setSuccessMessage('Invoice sent successfully!');
      setTimeout(() => {
        onClose();
        setSuccessMessage('');
        setAttachment(null);
      }, 2000);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || 'Failed to send email. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
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
                <h2 className="text-base font-bold text-gray-900">Send Invoice Email</h2>
                <p className="text-xs text-gray-500">Invoice #{invoiceNumber}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Success Message */}
            {successMessage && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                {successMessage}
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            {/* Email notifications disabled warning */}
            {!emailEnabled && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  Email notifications are currently disabled in Clinic Settings. Enable Email Notifications to send emails.
                </p>
              </div>
            )}

            {/* To Email */}
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                To <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus-within:outline-none focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-transparent bg-white flex flex-wrap gap-2 items-center">
                  {/* Email Chips */}
                  {emails.map((email, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-100 text-sky-700 rounded-lg text-xs font-medium"
                    >
                      <span className="truncate">{email}</span>
                      <button
                        onClick={() => removeEmail(email)}
                        className="ml-0.5 hover:bg-sky-200 rounded p-0.5 transition-colors"
                        type="button"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  
                  {/* Input for new email */}
                  <input
                    ref={emailInputRef}
                    type="text"
                    value={emailInput}
                    onChange={(e) => handleEmailInput(e.target.value)}
                    onFocus={() => emailInput.length > 0 && setShowSuggestions(true)}
                    placeholder={emails.length === 0 ? "patient@example.com" : "Add more emails..."}
                    className="flex-1 min-w-[150px] outline-none bg-transparent text-sm"
                  />
                </div>
                
                {/* Dropdown Suggestions */}
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto"
                  >
                    {filteredSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSuggestionSelect(suggestion)}
                        className="w-full flex items-start gap-2 px-3 py-2 hover:bg-sky-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
                        type="button"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{suggestion.name}</p>
                          <p className="text-xs text-gray-500 truncate">{suggestion.email}</p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded whitespace-nowrap ml-2">
                          {suggestion.role}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Auto-generated PDF Attachment */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-600">Attachment</label>
              
              {isGeneratingPdf && (
                <div className="flex items-center gap-3 p-3 bg-sky-50 border border-sky-200 rounded-lg">
                  <Loader2 className="w-4 h-4 text-sky-600 animate-spin flex-shrink-0" />
                  <span className="text-sm text-sky-700">Generating invoice PDF...</span>
                </div>
              )}

              {!isGeneratingPdf && attachment && (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <FileText className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-green-700 truncate">{attachment.name}</span>
                  <span className="text-xs text-green-500 flex-shrink-0">
                    ({(attachment.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}

              {!isGeneratingPdf && !attachment && !invoice && (
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-sm text-amber-700">Invoice data not available for PDF generation.</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || isGeneratingPdf || !emailEnabled}
              title={!emailEnabled ? 'Email notifications are currently disabled in Clinic Settings.' : undefined}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
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