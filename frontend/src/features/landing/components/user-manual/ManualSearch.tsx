import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { manualRegistry } from '../../data/manual-registry';
import type { ManualChapterConfig } from '../../data/manual-registry';

export const ManualSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ManualChapterConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matches = manualRegistry.filter((ch) => 
      ch.title.toLowerCase().includes(lowerQuery) || 
      ch.searchIndex.toLowerCase().includes(lowerQuery)
    );
    setResults(matches);
    setIsOpen(true);
  }, [query]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full max-w-2xl mx-auto mb-12" ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the User Manual..."
          className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-care-blue/20 focus:border-care-blue text-base font-body transition-all"
        />
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 max-h-96 overflow-y-auto">
          {results.map((ch) => (
            <a
              key={ch.id}
              href={`#${ch.id}`}
              onClick={() => {
                setIsOpen(false);
                setQuery('');
              }}
              className="flex items-center justify-between p-4 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors group"
            >
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider font-body mb-1 block">
                  {ch.partTitle}
                </span>
                <span className="text-sm font-semibold text-trust-harbor font-display group-hover:text-care-blue transition-colors">
                  Chapter {ch.chapterNumber}: {ch.title}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-care-blue transition-colors" />
            </a>
          ))}
        </div>
      )}
      
      {isOpen && query.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-8 text-center z-50">
          <p className="text-gray-500 font-body">No results found for "{query}"</p>
        </div>
      )}
    </div>
  );
};
