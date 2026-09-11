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
    <div className="w-full h-full">
      <div className="lg:p-6 lg:pt-8 h-full flex flex-col">
        {/* Mobile Toggle Button */}
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="flex lg:hidden items-center justify-between w-full text-lg font-semibold text-trust-harbor font-heading border-b border-gray-200 pb-2 bg-gray-50/50 p-6 rounded-2xl border"
        >
          Table of Contents
          {isMobileOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {/* Desktop Header */}
        <h3 className="hidden lg:block text-lg font-bold text-trust-harbor mb-6 font-heading tracking-wide uppercase text-sm border-b border-gray-100 pb-3">
          Table of Contents
        </h3>

        {/* Nav Links */}
        <nav className={`space-y-6 lg:block overflow-y-auto flex-1 pb-20 custom-scrollbar ${isMobileOpen ? 'block mt-6 bg-gray-50/50 p-6 rounded-2xl border border-gray-100' : 'hidden'}`}>
          {structure.map((part, index) => (
            <div key={index} className="space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider font-body">
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
                        className={`flex items-start text-sm font-medium transition-colors font-body py-1.5 px-2 rounded-lg ${isActive
                            ? 'bg-blue-50 text-care-blue font-semibold'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-trust-harbor'
                          }`}
                      >
                        {isActive && <ChevronRight className="w-4 h-4 mt-0.5 mr-1 shrink-0 text-care-blue" />}
                        <span className={isActive ? 'ml-0' : 'ml-1'}>
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
