import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ChevronDown, X, Check, Layers } from 'lucide-react';
import type { ClinicService } from '@/features/manage/services/clinic-services.api';

interface ServiceSelectorProps {
  services:    ClinicService[];
  value:       number | '';
  onChange:    (id: number | '') => void;
  disabled?:   boolean;
  error?:      string;
  loading?:    boolean;
  placeholder?: string;
  /** Optional size variant for contexts where compact display is needed */
  compact?:    boolean;
}

const fmtPrice = (price: string) => {
  const n = parseFloat(price);
  if (!n) return null;
  return `₱${n.toLocaleString()}`;
};

const fmtDuration = (mins: number) => {
  if (!mins) return null;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

/**
 * ServiceSelector — enterprise-grade searchable service combobox.
 *
 * Replaces the plain <select> for Consultation Type in both
 * AppointmentModal (create) and InlineAppointmentCard (edit).
 *
 * Features:
 * - Full-text search filter
 * - Color swatch per service row
 * - Duration + price sub-text per row
 * - Selected service preview badge
 * - Keyboard navigation (↑ ↓ Enter Escape)
 * - Disabled state for terminal appointments
 */
export const ServiceSelector: React.FC<ServiceSelectorProps> = ({
  services,
  value,
  onChange,
  disabled = false,
  error,
  loading = false,
  placeholder = '— Select a service —',
  compact = false,
}) => {
  const [isOpen,        setIsOpen]        = useState(false);
  const [search,        setSearch]        = useState('');
  const [highlightIdx,  setHighlightIdx]  = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef    = useRef<HTMLInputElement>(null);
  const listRef      = useRef<HTMLUListElement>(null);

  const selected = value !== '' ? services.find(s => s.id === value) ?? null : null;

  const filtered = services.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(search.toLowerCase()))
  );

  // Reset highlight when filter changes
  useEffect(() => { setHighlightIdx(0); }, [search]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const select = useCallback((svc: ClinicService | null) => {
    onChange(svc ? svc.id : '');
    setIsOpen(false);
    setSearch('');
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx(i => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightIdx]) select(filtered[highlightIdx]);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[highlightIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx]);

  const triggerCls = [
    'w-full flex items-center gap-2 text-left transition-all duration-150',
    compact
      ? 'px-3 py-2 text-sm border rounded-lg'
      : 'px-3 py-2.5 text-sm border rounded-lg',
    disabled
      ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
      : error
        ? 'bg-red-50 border-red-300 text-gray-800 cursor-pointer hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400'
        : isOpen
          ? 'bg-white border-sky-400 ring-2 ring-sky-100 text-gray-800 cursor-pointer'
          : 'bg-white border-gray-200 text-gray-800 cursor-pointer hover:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200',
  ].join(' ');

  return (
    <div ref={containerRef} className="relative w-full" onKeyDown={handleKeyDown}>
      {/* ── Trigger Button ── */}
      <button
        type="button"
        id="service-selector-trigger"
        className={triggerCls}
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen(o => !o)}
      >
        {loading ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin flex-shrink-0" />
            <span className="text-gray-400 flex-1">Loading services…</span>
          </>
        ) : selected ? (
          <>
            {/* Color swatch */}
            <span
              className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/10"
              style={{ backgroundColor: selected.color_hex || '#0284c7' }}
            />
            {/* Name */}
            <span className="flex-1 font-medium text-gray-800 truncate">{selected.name}</span>
            {/* Meta pills */}
            <span className="flex items-center gap-1.5 flex-shrink-0">
              {fmtDuration(selected.duration_minutes) && (
                <span className="text-[11px] text-sky-600 font-semibold bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded-full">
                  {fmtDuration(selected.duration_minutes)}
                </span>
              )}
              {fmtPrice(selected.price) && (
                <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                  {fmtPrice(selected.price)}
                </span>
              )}
            </span>
          </>
        ) : (
          <>
            <Layers className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
            <span className="text-gray-400 flex-1">{placeholder}</span>
          </>
        )}
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${
            disabled ? 'text-gray-300' : 'text-gray-400'
          } ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Dropdown ── */}
      {isOpen && (
        <div
          className="absolute z-50 top-full left-0 mt-1.5 w-full min-w-[280px] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
          role="listbox"
          aria-label="Select a service"
        >
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search services…"
              className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder-gray-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="p-0.5 hover:bg-gray-200 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>

          {/* Clear option */}
          {value !== '' && (
            <button
              type="button"
              onClick={() => select(null)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 transition-colors border-b border-gray-100"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear selection</span>
            </button>
          )}

          {/* Service list */}
          <ul ref={listRef} className="max-h-56 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-gray-400">
                No services match "{search}"
              </li>
            ) : (
              filtered.map((svc, idx) => {
                const isSelected   = svc.id === value;
                const isHighlighted = idx === highlightIdx;
                const durLabel  = fmtDuration(svc.duration_minutes);
                const priceLabel = fmtPrice(svc.price);

                return (
                  <li
                    key={svc.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => select(svc)}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    className={[
                      'w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                      isHighlighted ? 'bg-sky-50' : 'hover:bg-gray-50',
                    ].join(' ')}
                  >
                    {/* Color dot */}
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/10"
                      style={{ backgroundColor: svc.color_hex || '#94a3b8' }}
                    />

                    {/* Name + description */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${isSelected ? 'font-semibold text-sky-700' : 'font-medium text-gray-800'}`}>
                        {svc.name}
                      </p>
                      {(durLabel || priceLabel) && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {[durLabel, priceLabel].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>

                    {/* Checkmark for active selection */}
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                    )}
                  </li>
                );
              })
            )}
          </ul>

          {/* Footer count */}
          {filtered.length > 0 && (
            <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50 text-right">
              <span className="text-[10px] text-gray-400">
                {filtered.length} service{filtered.length !== 1 ? 's' : ''}
                {search ? ` found for "${search}"` : ' available'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error text */}
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}

      {/* Selected service preview badge (full details) */}
      {selected && (
        <div
          className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-sm"
          style={{ backgroundColor: selected.color_hex || '#0284c7' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 flex-shrink-0" />
          <span>{selected.name}</span>
          {fmtDuration(selected.duration_minutes) && (
            <>
              <span className="opacity-60">·</span>
              <span className="opacity-90">{fmtDuration(selected.duration_minutes)}</span>
            </>
          )}
          {fmtPrice(selected.price) && (
            <>
              <span className="opacity-60">·</span>
              <span className="opacity-90">{fmtPrice(selected.price)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
