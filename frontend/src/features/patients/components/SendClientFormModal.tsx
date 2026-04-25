import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, CheckCircle, Mail } from 'lucide-react';
import { sendClientForm } from '../patient.api';
import { getContacts } from '@/features/contacts/contact.api';

interface EmailSuggestion {
  name: string;
  email: string;
  role: string;
}

interface SendClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
  patientName: string;
  patientEmail: string;
  clinicName?: string;
}

export const SendClientFormModal: React.FC<SendClientFormModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  patientEmail,
  clinicName = 'The Clinic',
}) => {
  const [toEmail, setToEmail] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Suggestions state
  const [allSuggestions, setAllSuggestions] = useState<EmailSuggestion[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<EmailSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const DEFAULT_BODY = `Dear ${patientName},\n\nWe kindly ask you to complete this form prior to your booking so that we can ensure we have all necessary information for your session.\n\nPlease click the button below to begin:\n\n[Click Here To Start Filling Out]\n\nBest regards,\n${clinicName}`;

  useEffect(() => {
    if (!isOpen) return;
    setToEmail(patientEmail);
    setBody(DEFAULT_BODY);
    setErrorMessage('');
    setSuccessMessage('');
    setAllSuggestions([]);
    setShowSuggestions(false);

    let cancelled = false;

    const fetchSuggestions = async () => {
      try {
        const contactsData = await getContacts({ is_active: true, page_size: 100 });
        const suggestions = contactsData.results
          .filter((c) => c.email)
          .map((c) => ({
            name: c.full_name,
            email: c.email!,
            role: c.contact_type_display,
          }));
        if (!cancelled) setAllSuggestions(suggestions);
      } catch {
        // suggestions are optional — silent fail
      }
    };

    fetchSuggestions();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, patientEmail, patientName, clinicName]);

  // Close suggestions when clicking outside
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

  const handleEmailInput = (value: string) => {
    setToEmail(value);
    if (value.length > 0) {
      const filtered = allSuggestions.filter(
        (s) =>
          s.email.toLowerCase().includes(value.toLowerCase()) ||
          s.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredSuggestions(allSuggestions);
      setShowSuggestions(allSuggestions.length > 0);
    }
  };

  const handleSuggestionSelect = (suggestion: EmailSuggestion) => {
    setToEmail(suggestion.email);
    setShowSuggestions(false);
    setFilteredSuggestions([]);
    emailInputRef.current?.focus();
  };

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  const handleSend = async () => {
    setErrorMessage('');

    const to = toEmail.trim();
    if (!to) {
      setErrorMessage('Please enter a recipient email address.');
      return;
    }
    if (!isValidEmail(to)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (wordCount > 500) {
      setErrorMessage('Message body exceeds 500 words. Please shorten it.');
      return;
    }

    setIsSending(true);
    try {
      await sendClientForm(patientId, { to, body });
      setSuccessMessage(`Client form sent to ${to}`);
      setTimeout(() => {
        onClose();
        setSuccessMessage('');
      }, 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErrorMessage(msg || 'Failed to send email. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

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
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Send Client Form</h2>
                <p className="text-xs text-gray-500">{patientName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              type="button"
            >
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

            {/* Info banner */}
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700 leading-relaxed">
              A secure link will be emailed to the patient. The link expires in{' '}
              <strong>72 hours</strong> and can only be used <strong>once</strong>.
            </div>

            {/* To */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                To <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-400 mb-1">Select from Contacts or enter email manually</p>
              <div className="relative">
                <input
                  ref={emailInputRef}
                  type="email"
                  value={toEmail}
                  onChange={(e) => handleEmailInput(e.target.value)}
                  onFocus={() => {
                    if (toEmail.length === 0 && allSuggestions.length > 0) {
                      setFilteredSuggestions(allSuggestions);
                      setShowSuggestions(true);
                    }
                  }}
                  disabled={isSending}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50"
                  placeholder="patient@example.com"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto"
                  >
                    {filteredSuggestions.map((s) => (
                      <button
                        key={s.email}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); handleSuggestionSelect(s); }}
                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors"
                      >
                        <div className="text-sm font-medium text-gray-800">{s.name}</div>
                        <div className="text-xs text-gray-500">{s.email} · {s.role}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!patientEmail && (
                <p className="text-xs text-amber-600 mt-1">
                  This patient has no email on file. Please enter one above.
                </p>
              )}
            </div>

            {/* Message body */}
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
                disabled={isSending}
                rows={8}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-gray-50 font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">
                The <em>[Click Here To Start Filling Out]</em> placeholder will be replaced by a
                styled button in the actual email.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || !toEmail.trim()}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Form
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
