import React from 'react';
import { ChevronRight, Lock } from 'lucide-react';
import type { ManageCategory } from '../types/manage.types';

interface ManageCardProps {
  card: ManageCategory;
  onItemSelect: (categoryId: string, itemId: string) => void;
  /** Item IDs that should appear disabled (no-access state). */
  restrictedItemIds?: string[];
}

export const ManageCard: React.FC<ManageCardProps> = ({
  card, onItemSelect, restrictedItemIds = [],
}) => {
  const Icon = card.icon;

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden hover:border-gray-300 hover:shadow-lg transition-all duration-200">
      {/* Card Header */}
      <div className={`${card.bgColor} p-6 border-b-2 border-gray-200`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 ${card.color} rounded-xl flex items-center justify-center shadow-sm`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">{card.label}</h3>
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{card.description}</p>
          </div>
        </div>
      </div>

      {/* Card Menu Items */}
      <div className="p-4">
        <div className="space-y-1.5">
          {card.items.map((item) => {
            const isRestricted = restrictedItemIds.includes(item.id);
            return (
              <div key={item.id} className="relative group/item">
                <button
                  onClick={() => !isRestricted && onItemSelect(card.id, item.id)}
                  disabled={isRestricted}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors text-left group ${
                    isRestricted
                      ? 'opacity-40 cursor-not-allowed pointer-events-none bg-gray-50'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <span className={`text-sm font-medium ${
                    isRestricted ? 'text-gray-400' : 'text-gray-700 group-hover:text-gray-900'
                  }`}>
                    {item.label}
                  </span>
                  {isRestricted ? (
                    <Lock className="w-3.5 h-3.5 text-gray-300" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all" />
                  )}
                </button>
                {/* Tooltip for restricted items */}
                {isRestricted && (
                  <div className="invisible group-hover/item:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-30 pointer-events-none">
                    Access restricted
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
