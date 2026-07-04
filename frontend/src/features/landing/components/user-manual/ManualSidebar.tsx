import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { getSidebarStructure } from '../../data/manual-registry';

interface ManualSidebarProps {
  activeChapterId: string;
}

export const ManualSidebar: React.FC<ManualSidebarProps> = ({ activeChapterId }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const structure = getSidebarStructure();

  return (
    <div className="w-full lg:w-1/4 shrink-0">
      <div className="sticky top-32 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
        {/* Mobile Toggle Button */}
        <button 
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="flex lg:hidden items-center justify-between w-full text-lg font-semibold text-trust-harbor font-heading border-b border-gray-200 pb-2"
        >
          Table of Contents
          {isMobileOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        
        {/* Desktop Header */}
        <h3 className="hidden lg:block text-lg font-semibold text-trust-harbor mb-4 font-heading border-b border-gray-200 pb-2">
          Table of Contents
        </h3>

        {/* Nav Links */}
        <nav className={`space-y-6 lg:block overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar ${isMobileOpen ? 'block mt-6' : 'hidden'}`}>
          {structure.map((part, index) => (
            <div key={index} className="space-y-2">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider font-body mb-2">
                {part.partTitle}
              </h4>
              <ul className="space-y-1.5">
                {part.chapters.map((ch) => {
                  const isActive = ch.id === activeChapterId;
                  return (
                    <li key={ch.id}>
                      <a 
                        href={`#${ch.id}`} 
                        onClick={() => setIsMobileOpen(false)}
                        className={`flex items-start text-sm font-medium transition-colors font-body py-1 ${
                          isActive 
                            ? 'text-care-blue font-semibold' 
                            : 'text-gray-600 hover:text-trust-harbor'
                        }`}
                      >
                        {isActive && <ChevronRight className="w-4 h-4 mt-0.5 mr-1 shrink-0 text-care-blue" />}
                        <span className={isActive ? 'ml-0' : 'ml-5'}>
                          {ch.title}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
};
