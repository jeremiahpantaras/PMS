import React from 'react';
import { Clock, ChevronRight, CheckCircle } from 'lucide-react';
import type { PortalService } from '../types/portal';

interface ServiceCardProps {
  service:    PortalService;
  isSelected: boolean;
  onSelect:   () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, isSelected, onSelect }) => {
  const priceNum = parseFloat(service.price);
  const priceStr = `₱ ${priceNum.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`;

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors ${
        isSelected ? 'bg-green-50' : 'hover:bg-gray-50'
      }`}
    >
      {/* Thumbnail */}
      <div
        className="w-14 h-14 rounded-xl shrink-0 overflow-hidden"
        style={{ backgroundColor: service.image_url ? undefined : (service.color_hex ?? '#0EA5E9') + '22' }}
      >
        {service.image_url ? (
          <img src={service.image_url} alt={service.name} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-lg font-bold"
            style={{ color: service.color_hex ?? '#0EA5E9' }}
          >
            {service.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${isSelected ? 'text-[#0575E6]' : 'text-gray-900'}`}>
          {service.name}
        </p>
        {service.description && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{service.description}</p>
        )}
        <div className="flex items-center gap-1 mt-1">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-gray-400">{service.duration_minutes} min</span>
        </div>
      </div>

      {/* Price + Select */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        <p className="font-bold text-gray-800 text-sm">{priceStr}</p>
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            isSelected
              ? 'bg-primary-gradient text-white'
              : 'bg-gray-800 text-white hover:bg-gray-700'
          }`}
        >
          {isSelected
            ? <><CheckCircle className="w-3 h-3" /> Selected</>
            : <>Select <ChevronRight className="w-3 h-3" /></>
          }
        </button>
      </div>
    </div>
  );
};