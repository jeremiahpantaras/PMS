import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

import { createPortalConsent, fetchPortal, submitBooking } from '../portal.api';
import { PortalSidebar }                     from '../components/PortalSidebar';
import { BranchStep }                        from '../components/BranchStep';
import { PractitionerStep }                  from '../components/PractitionerStep';
import { ServiceList }                       from '../components/ServiceList';
import { PortalAvailabilityCalendar }        from '../components/PortalAvailabilityCalendar';
import { PatientDetailsForm }                from '../components/PatientDetailsForm';
import { TermsAndConditionsModal }           from '../components/TermsAndConditionsModal';
import { ConsentFormModal }                  from '../components/ConsentFormModal';
import { PortalFooterActions }               from '../components/PortalFooterActions';

import type {
  PortalData,
  PortalBranch,
  PortalPractitioner,
  PortalService,
  PortalCategory,
  BookingPayload,
} from '../types/portal';
import type { PatientFormData } from '../components/PatientDetailsForm';
import { isValidPHPhone } from '@/utils/phoneFormatter';

// ── After branch is picked, 4-step inner flow ─────────────────────────────────
type InnerStep = 'practitioner' | 'services' | 'datetime' | 'details';

const INNER_STEP_NUMBER: Record<InnerStep, number> = {
  practitioner: 2,
  services:     3,
  datetime:     4,
  details:      5,
};

const EMPTY_FORM: PatientFormData = {
  first_name:   '',
  last_name:    '',
  email:        '',
  phone:        '',
  notes:        '',
  date_of_birth: '',
};

export const PortalHome: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate  = useNavigate();

  // ── Portal data ──────────────────────────────────────────────────────────
  const [portal,  setPortal]  = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // ── Branch gate ──────────────────────────────────────────────────────────
  const [selectedBranch, setSelectedBranch] = useState<PortalBranch | null>(null);

  // ── Inner step (only active after branch is chosen) ──────────────────────
  const [innerStep,            setInnerStep]            = useState<InnerStep>('practitioner');
  const [selectedPractitioner, setSelectedPractitioner] = useState<PortalPractitioner | null>(null);
  const [selectedService,      setSelectedService]      = useState<PortalService | null>(null);
  const [search,               setSearch]               = useState('');

  // ── Date / time ──────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');

  // ── Patient form ─────────────────────────────────────────────────────────
  const [formData,   setFormData]   = useState<PatientFormData>(EMPTY_FORM);
  const [formError,  setFormError]  = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedConsent, setAcceptedConsent] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [consentText, setConsentText] = useState<string>('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  // ── Load portal ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetchPortal(token)
      .then(setPortal)
      .catch(() => setError('This booking page is unavailable or the link has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  // ── Branch selected → enter inner flow ───────────────────────────────────
  const handleSelectBranch = (branch: PortalBranch) => {
    setSelectedBranch(branch);
    // Reset downstream when re-choosing branch
    setSelectedPractitioner(null);
    setSelectedService(null);
    setSelectedDate('');
    setSelectedSlot('');
    setInnerStep('practitioner');
  };

  // ── Inner navigation ─────────────────────────────────────────────────────
  const handleSelectPractitioner = (p: PortalPractitioner) => {
    // Reset service & date when practitioner changes
    if (selectedPractitioner?.id !== p.id) {
      setSelectedService(null);
      setSelectedDate('');
      setSelectedSlot('');
    }
    setSelectedPractitioner(p);
  };

  const handleSelectService = (svc: PortalService) => {
    setSelectedService(svc);
    setSelectedDate('');
    setSelectedSlot('');
    setInnerStep('datetime'); // auto-advance to date/time picker
  };

  const handleInlineDateTimeConfirm = (date: string, slot: string) => {
    setSelectedDate(date);
    setSelectedSlot(slot);
    setInnerStep('details');
  };

  const handleContinue = () => {
    if (innerStep === 'practitioner' && selectedPractitioner) setInnerStep('services');
  };

  const handleBack = () => {
    if (innerStep === 'details')      { setInnerStep('datetime');     return; }
    if (innerStep === 'datetime')     { setInnerStep('services');     return; }
    if (innerStep === 'services')     { setInnerStep('practitioner'); return; }
    if (innerStep === 'practitioner') { setSelectedBranch(null);      return; }
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!token || !selectedService || !selectedDate || !selectedSlot) return;
    setFormError(null);

    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      setFormError('First and last name are required.'); return;
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setFormError('A valid email address is required.'); return;
    }
    if (!formData.phone.trim()) {
      setFormError('Phone number is required.'); return;
    }
    if (!isValidPHPhone(formData.phone)) {
      setFormError('Enter a valid Philippine mobile number (e.g. (+63) 9XX XXX XXXX).'); return;
    }
    if (!formData.date_of_birth) {
      setFormError('Date of birth is required.'); return;
    }

    const payload: BookingPayload = {
      service:               selectedService.id,
      branch:                selectedBranch?.id ?? null,
      practitioner:          selectedPractitioner?.id ?? null,
      patient_first_name:    formData.first_name,
      patient_last_name:     formData.last_name,
      patient_email:         formData.email,
      patient_phone:         formData.phone,
      patient_date_of_birth: formData.date_of_birth,
      notes:              formData.notes,
      appointment_date:   selectedDate,
      appointment_time:   selectedSlot,
    };

    if (!acceptedTerms || !acceptedConsent || !signatureData) {
      setFormError('Please complete Terms, Data Privacy Consent, and signature before booking.');
      return;
    }

    setSubmitting(true);
    try {
      const consent = await createPortalConsent(token, {
        full_name: `${formData.first_name} ${formData.last_name}`.trim(),
        email: formData.email,
        consent_text: consentText,
        signature: signatureData,
      });

      const confirmation = await submitBooking(token, {
        ...payload,
        consent_id: consent.id,
      });
      navigate(`/portal/${token}/success`, { state: { confirmation } });
    } catch (err: any) {
      setFormError(
        err.response?.data?.detail ?? 'Failed to submit booking. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canContinue = innerStep === 'practitioner' && !!selectedPractitioner;

  // ── Filter practitioners by selected branch (real practitioners only — no "Any") ──
  const branchPractitioners = React.useMemo(() => {
    const all = portal?.practitioners ?? [];
    return all.filter((p: PortalPractitioner) => {
      if (p.id === null) return false; // exclude "Any Available"
      return p.branch_id === selectedBranch?.id;
    });
  }, [portal?.practitioners, selectedBranch]);

  // ── Filter services by selected practitioner + search ────────────────────
  const filteredCategories = React.useMemo(() => {
    const praId = selectedPractitioner?.id ?? null;
    return (portal?.categories ?? [])
      .map((cat: PortalCategory) => ({
        ...cat,
        services: cat.services.filter((s: PortalService) => {
          // Search filter
          if (
            search &&
            !s.name.toLowerCase().includes(search.toLowerCase()) &&
            !s.description.toLowerCase().includes(search.toLowerCase())
          ) return false;
          // Practitioner filter: empty assigned_practitioner_ids = available to all
          const ids = s.assigned_practitioner_ids;
          if (!ids || ids.length === 0) return true;
          if (!praId) return true;
          return ids.includes(praId);
        }),
      }))
      .filter((cat: PortalCategory) => cat.services.length > 0);
  }, [portal?.categories, search, selectedPractitioner]);

  // ── Loading / error ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500" />
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center p-8">
          <p className="text-gray-600 text-lg">{error ?? 'Portal not found.'}</p>
        </div>
      </div>
    );
  }

  // ── GATE: Branch not yet selected → full-screen branch picker ────────────
  if (!selectedBranch) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">

        {/* Top header */}
        <div className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 lg:py-5 flex items-center gap-4">
          {portal.clinic_logo ? (
            <img
              src={portal.clinic_logo}
              alt={portal.clinic_name}
              className="w-10 h-10 rounded-xl object-cover border border-gray-200 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center text-white font-bold text-base shrink-0">
              {portal.clinic_name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-base lg:text-lg font-bold text-gray-900 truncate">
              {portal.heading || portal.clinic_name}
            </h1>
            {portal.description && (
              <p className="text-sm text-gray-500 truncate">{portal.description}</p>
            )}
          </div>
        </div>

        {/* Branch picker */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 max-w-4xl mx-auto w-full">
          <BranchStep
            branches={portal.branches ?? []}
            selectedBranch={null}
            onSelect={handleSelectBranch}
          />
        </div>
      </div>
    );
  }

  // ── MAIN: Branch selected → sidebar + inner steps ─────────────────────────
  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">

      {/* Sidebar — desktop only (hidden on mobile/tablet) */}
      <div className="hidden lg:block">
        <PortalSidebar
          portal={portal}
          selectedBranch={selectedBranch}
          selectedPractitioner={selectedPractitioner}
          selectedService={selectedService}
          selectedDate={selectedDate}
          selectedSlot={selectedSlot}
          currentStep={INNER_STEP_NUMBER[innerStep]}
          onChangeBranch={() => setSelectedBranch(null)}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 lg:px-8 py-3 lg:py-4 flex items-center gap-3 shadow-sm lg:shadow-none shrink-0">

          {/* Mobile/tablet: clinic logo + name + selected branch */}
          <div className="lg:hidden flex items-center gap-2.5 flex-1 min-w-0">
            {portal.clinic_logo ? (
              <img
                src={portal.clinic_logo}
                alt={portal.clinic_name}
                className="w-8 h-8 rounded-lg object-cover border border-gray-200 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {portal.clinic_name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                {portal.clinic_name}
              </p>
              {selectedBranch && (
                <p className="text-[11px] text-gray-500 leading-tight truncate">
                  {selectedBranch.name}
                </p>
              )}
            </div>
          </div>

          {/* Desktop: page heading */}
          <div className="hidden lg:block flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">
              {portal.heading || portal.clinic_name}
            </h1>
            {portal.description && (
              <p className="text-sm text-gray-500">{portal.description}</p>
            )}
          </div>

          {/* Search bar — services step */}
          {innerStep === 'services' && (
            <div className="relative flex-1 lg:flex-none lg:w-64 min-w-0 max-w-xs lg:max-w-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search services..."
                className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          )}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">

          {innerStep === 'practitioner' && (
            <PractitionerStep
              practitioners={branchPractitioners}
              selectedPractitioner={selectedPractitioner}
              onSelect={handleSelectPractitioner}
            />
          )}

          {innerStep === 'services' && (
            <ServiceList
              categories={filteredCategories}
              selectedService={selectedService}
              onSelectService={handleSelectService}
            />
          )}

          {innerStep === 'datetime' && selectedService && token && (
            <PortalAvailabilityCalendar
              token={token}
              service={selectedService}
              practitioner={selectedPractitioner}
              onConfirm={handleInlineDateTimeConfirm}
              onClose={() => setInnerStep('services')}
            />
          )}

          {innerStep === 'details' && (
            <PatientDetailsForm
              formData={formData}
              formError={formError}
              onChange={setFormData}
              acceptedTerms={acceptedTerms}
              acceptedConsent={acceptedConsent}
              signatureReady={Boolean(signatureData)}
              onTermsChange={setAcceptedTerms}
              onOpenTerms={() => setShowTermsModal(true)}
              onOpenConsent={() => setShowConsentModal(true)}
            />
          )}
        </div>

        {/* Footer actions — always visible above mobile bottom nav */}
        <div className="px-4 lg:px-8 pt-3 pb-24 lg:pb-6 bg-white border-t border-gray-200 shrink-0">
          <PortalFooterActions
            step={innerStep}
            canContinue={canContinue}
            submitting={submitting}
            onBack={handleBack}
            onContinue={handleContinue}
            onSubmit={handleSubmit}
          />
        </div>
      </main>

      {/* ── Mobile floating step indicator (hidden on desktop) ── */}
      <div className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg pointer-events-none">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3">
          <div className="flex items-center">
            {(
              [
                { number: 1, label: 'Location' },
                { number: 2, label: 'Provider' },
                { number: 3, label: 'Service'  },
                { number: 4, label: 'Date'     },
                { number: 5, label: 'Details'  },
              ] as { number: number; label: string }[]
            ).map((step, i, arr) => {
              const cur      = INNER_STEP_NUMBER[innerStep];
              const isActive = cur === step.number;
              const isDone   = cur > step.number;
              return (
                <React.Fragment key={step.number}>
                  <div className="flex flex-col items-center gap-0.5">
                    <div className={`w-2 h-2 rounded-full transition-all ${
                      isActive ? 'bg-sky-500 scale-125' : isDone ? 'bg-sky-300' : 'bg-gray-200'
                    }`} />
                    <span className={`text-[9px] leading-none whitespace-nowrap ${
                      isActive ? 'font-bold text-sky-600' : isDone ? 'font-medium text-sky-400' : 'font-medium text-gray-300'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`flex-1 h-px mx-2 transition-colors ${isDone ? 'bg-sky-300' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <TermsAndConditionsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />

      <ConsentFormModal
        isOpen={showConsentModal}
        patientFullName={`${formData.first_name} ${formData.last_name}`.trim()}
        patientEmail={formData.email}
        onClose={() => setShowConsentModal(false)}
        onSigned={(signature, legalText) => {
          setSignatureData(signature);
          setConsentText(legalText);
          setAcceptedConsent(true);
        }}
      />
    </div>
  );
};