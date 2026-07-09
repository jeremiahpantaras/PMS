import React from 'react';
import { TopNavigation } from './TopNavigation';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-clinical-cloud overflow-hidden flex flex-col">
      <TopNavigation />
      
      {/* Main Content Area - Full height beneath the top navbar */}
      <main className="flex-1 transition-all duration-300 ease-in-out h-[calc(100vh-64px)] overflow-hidden mt-[64px] w-full">
        {children}
      </main>
    </div>
  );
};