import React, { useEffect, useState, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ManualSidebar } from './components/user-manual/ManualSidebar';
import { ManualSearch } from './components/user-manual/ManualSearch';
import { DocChapter } from './components/user-manual/DocChapter';
import { getChapterConfig } from './data/manual-registry';

export const UserManualPage: React.FC = () => {
  const location = useLocation();
  const [activeChapterId, setActiveChapterId] = useState<string>('chapter-1');

  useEffect(() => {
    // When the hash changes, extract the chapter ID
    const hash = location.hash.replace('#', '');
    if (hash && getChapterConfig(hash)) {
      setActiveChapterId(hash);
    } else if (!hash) {
      // Default to chapter-1 if no hash is present
      setActiveChapterId('chapter-1');
      window.history.replaceState(null, '', '#chapter-1');
    }
  }, [location.hash]);

  // Ensure the page starts at the top when navigating between chapters
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeChapterId]);

  const activeConfig = getChapterConfig(activeChapterId);
  const ActiveComponent = activeConfig?.component;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      
      {/* Desktop Sidebar (Fixed Left) */}
      <div className="hidden lg:block fixed left-0 top-0 bottom-0 w-[20rem] xl:w-[22rem] pt-28 bg-gray-50/30 border-r border-gray-100 z-40">
        <ManualSidebar activeChapterId={activeChapterId} />
      </div>

      {/* Main Content */}
      <main className="flex-1 pt-32 pb-20 w-full px-4 sm:px-6 lg:pl-[22rem] xl:pl-[26rem] lg:pr-12 xl:pr-24">
        <div className="w-full max-w-5xl">
          {/* Header */}
          <div className="mb-10 pb-8 border-b border-gray-100">
            <h1 className="text-4xl md:text-5xl font-bold text-trust-harbor font-heading mb-4">Documentation</h1>
            <p className="text-lg md:text-xl text-gray-600 font-body max-w-3xl">
              Welcome to the official documentation for the Malasakit System. Here you will find step-by-step guides on how to use and navigate the platform.
            </p>
          </div>

          {/* Search */}
          <ManualSearch />

          <div className="flex flex-col mt-12 gap-12">
            {/* Mobile Sidebar */}
            <div className="block lg:hidden w-full">
              <ManualSidebar activeChapterId={activeChapterId} />
            </div>

            {/* Content Area */}
            <div className="w-full min-h-[500px]">
              <Suspense fallback={
                <div className="animate-pulse space-y-8">
                  <div className="h-10 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="space-y-4 mt-8">
                    <div className="h-4 bg-gray-100 rounded w-full"></div>
                    <div className="h-4 bg-gray-100 rounded w-full"></div>
                    <div className="h-4 bg-gray-100 rounded w-5/6"></div>
                  </div>
                </div>
              }>
                {ActiveComponent && (
                  <DocChapter id={activeChapterId}>
                    <ActiveComponent />
                  </DocChapter>
                )}
              </Suspense>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
};
