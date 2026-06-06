import React from 'react';
import { MapPin, Phone, Mail, CheckCircle, RefreshCw } from 'lucide-react';
import type { PortalData, PortalBranch, PortalPractitioner, PortalService } from '../types/portal';

const fmt12 = (slot: string) => {
  const [h, m] = slot.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m);
  return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
};

interface PortalSidebarProps {
  portal:               PortalData;
  selectedBranch:       PortalBranch | null;
  selectedPractitioner: PortalPractitioner | null;
  selectedService:      PortalService | null;
  selectedDate:         string;
  selectedSlot:         string;
  currentStep:          number;
  onChangeBranch:       () => void;
}

const STEPS = [
  { number: 2, label: 'Choose Practitioner' },
  { number: 3, label: 'Select Service'      },
  { number: 4, label: 'Date & Time'         },
  { number: 5, label: 'Your Details'        },
];

export const PortalSidebar: React.FC<PortalSidebarProps> = ({
  portal,
  selectedBranch,
  selectedPractitioner,
  selectedService,
  selectedDate,
  selectedSlot,
  currentStep,
  onChangeBranch,
}) => {
  return (
    <aside className="w-80 shrink-0 bg-white border-r border-gray-200 flex flex-col min-h-screen">

      {/* Clinic info */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          {portal.clinic_logo ? (
            <img
              src={portal.clinic_logo}
              alt={portal.clinic_name}
              className="w-12 h-12 rounded-xl object-cover border border-gray-200"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-primary-gradient flex items-center justify-center text-white font-bold text-lg">
              {portal.clinic_name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 text-sm truncate">{portal.clinic_name}</h2>
            {portal.clinic_address && (
              <p className="text-xs text-gray-500 truncate">{portal.clinic_address}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          {portal.clinic_phone && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Phone className="w-3 h-3 flex-shrink-0 text-[#0575E6]" />
              {portal.clinic_phone}
            </div>
          )}
          {portal.clinic_email && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Mail className="w-3 h-3 flex-shrink-0 text-[#0575E6]" />
              {portal.clinic_email}
            </div>
          )}
          {portal.clinic_address && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <MapPin className="w-3 h-3 flex-shrink-0 text-[#0575E6]" />
              {portal.clinic_address}
            </div>
          )}
        </div>
      </div>

      {/* Selected branch banner */}
      {selectedBranch && (
        <div className="mx-4 mt-4 bg-primary-gradient rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-white/70 font-medium uppercase tracking-wide mb-0.5">
                Selected Location
              </p>
              <p className="text-sm font-bold text-white leading-tight truncate">
                {selectedBranch.name}
              </p>
              {(selectedBranch.city || selectedBranch.province) && (
                <p className="text-xs text-white/70 mt-0.5">
                  {[selectedBranch.city, selectedBranch.province].filter(Boolean).join(', ')}
                </p>
              )}
              {selectedBranch.address && (
                <p className="text-xs text-white/70 mt-0.5 truncate">
                  {selectedBranch.address}
                </p>
              )}
            </div>
            <button
              onClick={onChangeBranch}
              className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-white bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Change
            </button>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="p-6 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Booking Steps
        </p>
        <div className="space-y-3">
          {STEPS.map((step) => {
            const isDone    = currentStep > step.number;
            const isCurrent = currentStep === step.number;
            return (
              <div key={step.number} className="flex items-center gap-3">
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                  ${isDone || isCurrent ? 'bg-primary-gradient' : 'bg-gray-100'}
                `}>
                  {isDone ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : (
                    <span className={`text-xs font-bold ${isCurrent ? 'text-white' : 'text-gray-400'}`}>
                      {step.number}
                    </span>
                  )}
                </div>
                <span className={`text-sm ${
                  isCurrent ? 'font-semibold text-gray-900'
                  : isDone  ? 'text-[#5CDB95] font-medium'
                  : 'text-gray-400'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Booking summary */}
      <div className="p-6 flex-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Your Selection
        </p>
        <div className="space-y-3">

          {selectedPractitioner && (
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-xs text-[#0575E6] font-medium">Practitioner</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {selectedPractitioner.id === null ? 'Any Available' : selectedPractitioner.full_name}
              </p>
              {selectedPractitioner.specialization && (
                <p className="text-xs text-gray-500">{selectedPractitioner.specialization}</p>
              )}
            </div>
          )}

          {selectedService && (
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-xs text-[#0575E6] font-medium">Service</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{selectedService.name}</p>
              <p className="text-xs text-gray-500">
                {selectedService.duration_minutes} min · ₱{parseFloat(selectedService.price).toLocaleString('en-PH')}
              </p>
            </div>
          )}

          {selectedDate && selectedSlot && (
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-xs text-[#0575E6] font-medium">Date &amp; Time</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                })}
              </p>
              <p className="text-xs text-gray-500">{fmt12(selectedSlot)}</p>
            </div>
          )}

          {!selectedPractitioner && !selectedService && (
            <p className="text-xs text-gray-400 italic">
              Your selections will appear here as you progress.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
};