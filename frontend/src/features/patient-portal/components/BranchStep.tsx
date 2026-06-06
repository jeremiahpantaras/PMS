import React, { useState } from 'react';
import { MapPin, Phone, Mail, Building2, CheckCircle, Star, Search, Map } from 'lucide-react';
import type { PortalBranch } from '../types/portal';
import { BranchLocationModal } from './BranchLocationModal';

interface BranchStepProps {
  branches:       PortalBranch[];
  selectedBranch: PortalBranch | null;
  onSelect:       (branch: PortalBranch) => void;
}

export const BranchStep: React.FC<BranchStepProps> = ({
  branches = [],
  selectedBranch,
  onSelect,
}) => {
  const [search, setSearch] = useState('');
  const [mapModalBranch, setMapModalBranch] = useState<PortalBranch | null>(null);

  const filtered = branches.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.city.toLowerCase().includes(search.toLowerCase()) ||
    b.province.toLowerCase().includes(search.toLowerCase()),
  );

  // Main branch always first, then alphabetical
  const sorted = [...filtered].sort((a, b) => {
    if (a.is_main_branch && !b.is_main_branch) return -1;
    if (!a.is_main_branch && b.is_main_branch) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Select a Location</h2>
        <p className="text-gray-500 text-sm mt-1">
          Choose the clinic branch you&apos;d like to visit for your appointment.
        </p>
      </div>

      {/* Search — only show when there are multiple branches */}
      {branches.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, city or province…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white
              focus:outline-none focus:ring-2 focus:ring-[#0575E6]"
          />
        </div>
      )}

      {/* Stats bar */}
      {branches.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Building2 className="w-3.5 h-3.5" />
          <span>
            {branches.length} location{branches.length !== 1 ? 's' : ''} available
            {search && ` · ${sorted.length} matching`}
          </span>
        </div>
      )}

      {/* Branch grid */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
            <Building2 className="w-7 h-7 text-gray-300" />
          </div>
          {search ? (
            <>
              <p className="text-sm font-medium text-gray-500">No locations match &quot;{search}&quot;</p>
              <button
                onClick={() => setSearch('')}
                className="mt-2 text-xs text-[#0575E6] hover:underline"
              >
                Clear search
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-500">No locations available</p>
              <p className="text-xs text-gray-400 mt-1">Please contact the clinic directly.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sorted.map((branch) => {
            const isSelected = selectedBranch?.id === branch.id;
            const hasPin = !!(branch.latitude && branch.longitude);

            return (
              <div
                key={branch.id}
                className={`
                  relative flex flex-col gap-4 rounded-2xl border-2 transition-all overflow-hidden
                  ${isSelected
                    ? 'border-green-500 bg-green-50 shadow-lg'
                    : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-md'
                  }
                `}
              >
                {/* Clickable body */}
                <button
                  onClick={() => onSelect(branch)}
                  className="flex flex-col gap-4 p-6 text-left w-full"
                >
                  {/* Selected checkmark */}
                  {isSelected && (
                    <div className="absolute top-4 right-4">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}

                  {/* Icon + Name + Badge */}
                  <div className="flex items-start gap-4">
                    <div className={`
                      w-12 h-12 rounded-xl flex items-center justify-center shrink-0 mt-0.5
                      ${isSelected || branch.is_main_branch
                        ? 'bg-primary-gradient'
                        : 'bg-green-100'
                      }
                    `}>
                      <Building2 className={`w-6 h-6 ${
                        isSelected || branch.is_main_branch ? 'text-white' : 'text-green-600'
                      }`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap pr-7">
                        <p className="text-base font-bold text-gray-900 leading-tight">
                          {branch.name}
                        </p>
                        {branch.is_main_branch && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full
                            text-[10px] font-semibold bg-green-100 text-green-700 shrink-0">
                            <Star className="w-2.5 h-2.5" />
                            Main
                          </span>
                        )}
                      </div>
                      {(branch.city || branch.province) && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {[branch.city, branch.province].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Contact details */}
                  <div className="space-y-2">
                    {branch.address && (
                      <div className="flex items-start gap-2.5 text-sm text-gray-500">
                        <MapPin className="w-4 h-4 text-[#0575E6] shrink-0 mt-0.5" />
                        <span className="leading-snug line-clamp-2">{branch.address}</span>
                      </div>
                    )}
                    {branch.phone && (
                      <div className="flex items-center gap-2.5 text-sm text-gray-500">
                        <Phone className="w-4 h-4 text-[#0575E6] shrink-0" />
                        <span>{branch.phone}</span>
                      </div>
                    )}
                    {branch.email && (
                      <div className="flex items-center gap-2.5 text-sm text-gray-500">
                        <Mail className="w-4 h-4 text-[#0575E6] shrink-0" />
                        <span className="truncate">{branch.email}</span>
                      </div>
                    )}
                  </div>
                </button>

                {/* Bottom action row */}
                <div className="flex items-center gap-2 px-6 pb-5 mt-auto">
                  {/* Select CTA */}
                  <button
                    onClick={() => onSelect(branch)}
                    className={`
                      flex-1 py-2 rounded-xl text-sm font-semibold text-center transition-colors
                      ${isSelected
                        ? 'bg-primary-gradient text-white'
                        : branch.is_main_branch
                          ? 'bg-primary-gradient text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }
                    `}
                  >
                    {isSelected ? 'Selected ✓' : 'Select Location'}
                  </button>

                  {/* View Pinned Location button */}
                  {(hasPin || branch.custom_location) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setMapModalBranch(branch); }}
                      title="View pinned location on map"
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold
                        bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition-colors shrink-0"
                    >
                      <Map className="w-4 h-4" />
                      <span className="hidden sm:inline">Map</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Location map modal */}
      <BranchLocationModal
        branch={mapModalBranch}
        isOpen={!!mapModalBranch}
        onClose={() => setMapModalBranch(null)}
      />
    </div>
  );
};