import React, { useState, useEffect } from 'react';
 import { ChevronDown, UserX, Stethoscope } from 'lucide-react';
import { ServiceCard } from './ServiceCard';
import type { PortalCategory, PortalService, PortalPractitioner } from '../types/portal';

// Discipline label map — mirrors PractitionerStep
const DISCIPLINE_LABELS: Record<string, string> = {
  OCCUPATIONAL_THERAPY:        'Occupational Therapy',
  SPEECH_LANGUAGE_PATHOLOGIST: 'Speech Language Pathologist',
  PHYSICAL_THERAPY:            'Physical Therapy',
  OSTEOPATHY:                  'Osteopathy',
  DENTISTRY:                   'Dentistry',
  MD_GENERAL_PRACTITIONER:     'MD: General Practitioner',
};

interface ServiceListProps {
  categories:           PortalCategory[];
  selectedService:      PortalService | null;
  selectedPractitioner: PortalPractitioner | null;
  onSelectService:      (service: PortalService) => void;
}

export const ServiceList: React.FC<ServiceListProps> = ({
  categories,
  selectedService,
  selectedPractitioner,
  onSelectService,
}) => {
  const [expandedCategory, setExpandedCategory] = useState<number | null | 'none'>(
    categories.length > 0 ? (categories[0].id ?? 'none') : 'none',
  );

  // Auto-expand first category when categories change (e.g. practitioner changed)
  useEffect(() => {
    setExpandedCategory(categories.length > 0 ? (categories[0].id ?? 'none') : 'none');
  }, [categories]);

  const disciplineLabel = selectedPractitioner?.discipline
    ? (DISCIPLINE_LABELS[selectedPractitioner.discipline] ?? selectedPractitioner.discipline)
    : null;

  // ── No practitioner selected — locked state ─────────────────────────────
  if (!selectedPractitioner) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <UserX className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-base font-semibold text-gray-500">No practitioner selected</p>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">
          Please select a practitioner first to see available services.
        </p>
      </div>
    );
  }

  // ── Practitioner selected but no matching services ──────────────────────
  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mb-4">
          <Stethoscope className="w-8 h-8 text-[#5CDB95]" />
        </div>
        <p className="text-base font-semibold text-gray-600">
          No services available
        </p>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">
          {disciplineLabel
            ? `No services are currently configured for ${disciplineLabel}.`
            : 'No services are currently available for this practitioner.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Select a Service</h2>
        <p className="text-sm text-gray-500 mt-1">
          Choose the type of appointment you&apos;d like to book.
        </p>
        {disciplineLabel && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-full">
            <Stethoscope className="w-3 h-3 text-[#5CDB95]" />
            <span className="text-xs font-medium text-[#0575E6]">{disciplineLabel} services</span>
          </div>
        )}
      </div>

      {categories.map((cat) => {
        const catKey     = cat.id ?? 'none';
        const isExpanded = expandedCategory === catKey;

        return (
          <div
            key={catKey}
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-md"
          >
            {/* Category header */}
            <button
              onClick={() => setExpandedCategory(isExpanded ? null : catKey)}
              className="w-full flex items-center justify-between px-5 py-4 font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
            >
              <div className="text-left">
                <span className="text-base font-medium">{cat.name}</span>
                {cat.description && (
                  <p className="text-xs text-gray-400 font-normal mt-0.5">{cat.description}</p>
                )}
              </div>
              <ChevronDown
                className={`w-5 h-5 text-gray-400 transition-transform shrink-0 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Service cards */}
            {isExpanded && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {cat.services.map((svc) => (
                  <ServiceCard
                    key={svc.id}
                    service={svc}
                    isSelected={selectedService?.id === svc.id}
                    onSelect={() => onSelectService(svc)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};