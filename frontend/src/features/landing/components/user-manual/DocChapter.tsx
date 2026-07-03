import React, { useMemo } from 'react';
import { Clock, ArrowLeft, ArrowRight } from 'lucide-react';
import { getAdjacentChapters, getChapterConfig } from '../../data/manual-registry';

interface DocChapterProps {
  id: string;
  children: React.ReactNode;
}

export const DocChapter: React.FC<DocChapterProps> = ({ id, children }) => {
  const config = getChapterConfig(id);
  const { prev, next } = getAdjacentChapters(id);

  // Calculate rough reading time based on registry string length
  const readingTime = useMemo(() => {
    if (!config?.searchIndex) return 1;
    const words = config.searchIndex.split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200)); // 200 words per minute
  }, [config?.searchIndex]);

  if (!config) return null;

  return (
    <div className="w-full">
      {/* Chapter Header */}
      <div className="mb-8 pb-4">
        <h2 className="text-3xl font-bold text-trust-harbor font-heading mb-2">
          Chapter {config.chapterNumber}: {config.title}
        </h2>
        <div className="flex items-center text-gray-500 font-body text-sm mb-4">
          <Clock className="w-4 h-4 mr-1.5" />
          <span>{readingTime} min read</span>
        </div>
      </div>

      {/* Chapter Content */}
      <div className="space-y-8">
        {children}
      </div>

      {/* Chapter Navigation */}
      <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col sm:flex-row justify-between gap-4">
        {prev ? (
          <a
            href={`#${prev.id}`}
            className="flex-1 flex flex-col items-start p-4 rounded-xl border border-gray-200 hover:border-care-blue hover:shadow-md transition-all group"
          >
            <span className="text-sm text-gray-500 font-body mb-1 flex items-center">
              <ArrowLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" />
              Previous Chapter
            </span>
            <span className="font-semibold text-trust-harbor group-hover:text-care-blue font-display">
              {prev.title}
            </span>
          </a>
        ) : <div className="flex-1" />}

        {next ? (
          <a
            href={`#${next.id}`}
            className="flex-1 flex flex-col items-end p-4 rounded-xl border border-gray-200 hover:border-care-blue hover:shadow-md transition-all group text-right"
          >
            <span className="text-sm text-gray-500 font-body mb-1 flex items-center justify-end w-full">
              Next Chapter
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </span>
            <span className="font-semibold text-trust-harbor group-hover:text-care-blue font-display">
              {next.title}
            </span>
          </a>
        ) : <div className="flex-1" />}
      </div>
    </div>
  );
};
