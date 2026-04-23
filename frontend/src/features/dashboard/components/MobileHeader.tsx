import React from 'react';
import { Menu } from 'lucide-react';
import { useSidebar } from '@/hooks/useSidebar';
import { useAuth } from '@/hooks/useAuth';
import MESLogo from '@/assets/malasakit/malasakit-relicon.svg';

export const MobileHeader: React.FC = () => {
  const { toggleMobileSidebar } = useSidebar();
  const { user } = useAuth();

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40 px-4 flex items-center justify-between shadow-sm">
      {/* Left: Burger Menu */}
      <button
        onClick={toggleMobileSidebar}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Toggle menu"
      >
        <Menu className="w-6 h-6 text-gray-700" />
      </button>

      {/* Center: Logo */}
      <div className="flex items-center space-x-2">
        <img src={MESLogo} alt="MES Logo" className="h-8 w-auto" />
        <span className="font-bold text-lg text-gray-900">Malasakit</span>
      </div>

      {/* Right: User Avatar */}
      <div className="w-9 h-9 bg-gradient-to-r from-sky-500 to-blue-600 rounded-full flex items-center justify-center">
        <span className="text-white font-bold text-sm">
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </span>
      </div>
    </header>
  );
};