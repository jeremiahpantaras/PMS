import React, { useState } from 'react';
import { Search, User } from 'lucide-react';
import type { PortalPractitioner } from '../types/portal';

// ── Discipline label map (mirrors DISCIPLINE_OPTIONS in staff.types.ts) ───────
const DISCIPLINE_LABELS: Record<string, string> = {
  OCCUPATIONAL_THERAPY:        'Occupational Therapy',
  SPEECH_LANGUAGE_PATHOLOGIST: 'Speech Language Pathologist',
  PHYSICAL_THERAPY:            'Physical Therapy',
  OSTEOPATHY:                  'Osteopathy',
  DENTISTRY:                   'Dentistry',
  MD_GENERAL_PRACTITIONER:     'MD: General Practitioner',
};

const getDisciplineLabel = (d?: string | null): string | null => {
  if (!d) return null;
  return DISCIPLINE_LABELS[d] ?? d;
};

interface PractitionerStepProps {
  practitioners:        PortalPractitioner[];
  selectedPractitioner: PortalPractitioner | null;
  onSelect:             (p: PortalPractitioner) => void;
}

export const PractitionerStep: React.FC<PractitionerStepProps> = ({
  practitioners,
  selectedPractitioner,
  onSelect,
}) => {
  const [search,       setSearch]       = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // ── Unique disciplines for filter chips ──────────────────────────────────
  const disciplines = Array.from(
    new Set(
      practitioners
        .filter((p) => p.discipline)
        .map((p) => p.discipline as string),
    ),
  );

  const filtered = practitioners.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(q)                              ||
      (p.occupation  ?? '').toLowerCase().includes(q)                    ||
      (p.position    ?? '').toLowerCase().includes(q)                    ||
      (getDisciplineLabel(p.discipline) ?? '').toLowerCase().includes(q) ||
      (p.specialization ?? '').toLowerCase().includes(q)
    );
  });

  const displayed = filtered.filter(
    (p) => !activeFilter || p.discipline === activeFilter,
  );

  // ── Group displayed practitioners by discipline ───────────────────────────
  const grouped = displayed.reduce<Record<string, PortalPractitioner[]>>((acc, p) => {
    const key = p.discipline ?? 'GENERAL';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const groupEntries = Object.entries(grouped);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Choose Practitioner</h2>
        <p className="text-gray-500 text-sm mt-1">
          Select the practitioner you&apos;d like to book with.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or specialty..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0575E6]"
        />
      </div>

      {/* Discipline filter chips */}
      {disciplines.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {disciplines.map((disc) => (
            <button
              key={disc}
              onClick={() => setActiveFilter(activeFilter === disc ? null : disc)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activeFilter === disc
                  ? 'bg-primary-gradient text-white border-transparent'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-[#0575E6]'
              }`}
            >
              {getDisciplineLabel(disc)}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {displayed.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
            <User className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">
            {search ? 'No practitioners match your search.' : 'No practitioners available at this location.'}
          </p>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="mt-2 text-xs text-[#0575E6] hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* Practitioner groups */}
      {groupEntries.length > 0 && (
        <div className="space-y-8">
          {groupEntries.map(([disciplineKey, list]) => {
            const groupLabel = disciplineKey === 'GENERAL'
              ? 'General'
              : (getDisciplineLabel(disciplineKey) ?? disciplineKey);

            return (
              <div key={disciplineKey}>
                {/* Section header */}
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    {groupLabel}
                  </h3>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Practitioner grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {list.map((p) => {
                    const isSelected      = selectedPractitioner?.id === p.id;
                    const disciplineLabel = getDisciplineLabel(p.discipline);

                    return (
                      <button
                        key={p.id}
                        onClick={() => onSelect(p)}
                        className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all text-center shadow-sm ${
                          isSelected
                            ? 'border-[#5CDB95] bg-green-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-[#5CDB95] hover:shadow-md'
                        }`}
                      >
                        {/* Avatar */}
                        <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center bg-gray-100 shrink-0">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt={p.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-10 h-10 text-gray-400" />
                          )}
                        </div>

                        {/* Info block */}
                        <div className="w-full space-y-1">
                          <p className={`text-sm font-bold leading-tight ${isSelected ? 'text-[#0575E6]' : 'text-gray-900'}`}>
                            {p.title ? `${p.title}. ${p.full_name}` : p.full_name}
                          </p>

                          {(p.occupation || p.position) && (
                            <p className={`text-xs font-semibold ${isSelected ? 'text-[#0575E6]' : 'text-gray-600'}`}>
                              {p.occupation || p.position}
                            </p>
                          )}

                          {disciplineLabel && (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium leading-snug ${
                              isSelected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {disciplineLabel}
                            </span>
                          )}

                          {!p.occupation && !p.position && !disciplineLabel && p.specialization && (
                            <p className="text-xs text-gray-500">{p.specialization}</p>
                          )}

                          {/* Services offered */}
                          {p.services && p.services.length > 0 && (
                            <div className="flex flex-wrap gap-1 justify-center mt-1">
                              {p.services.slice(0, 3).map(svc => (
                                <span
                                  key={svc.id}
                                  className="text-[9px] bg-gray-50 border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full"
                                >
                                  {svc.name}
                                </span>
                              ))}
                              {p.services.length > 3 && (
                                <span className="text-[9px] text-gray-400">+{p.services.length - 3} more</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* CTA button */}
                        <div className={`w-full py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                          isSelected ? 'bg-primary-gradient text-white' : 'bg-gray-800 text-white'
                        }`}>
                          {isSelected ? 'Selected ✓' : 'Select'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};