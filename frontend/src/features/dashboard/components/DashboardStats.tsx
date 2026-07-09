import React from 'react';
import { Users, Calendar, UserPlus, XCircle } from 'lucide-react';
import type { DashboardStats as StatsType } from '../types/dashboard.types';

interface DashboardStatsProps {
  stats: StatsType;
  isLoading?: boolean;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ 
  stats, 
  isLoading
}) => {
  const cards = [
    {
      id: 'occupancy',
      title: "Today's Occupancy",
      value: `${stats.todayOccupancy.current}/${stats.todayOccupancy.total}`,
      subtitle: `${Number(stats.todayOccupancy.percentage.toFixed(2))}% Capacity`,
      icon: Users,
      gradient: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      trend: stats.todayOccupancy.percentage > 70 ? 'high' : 'normal'
    },
    {
      id: 'bookings',
      title: "Today's Bookings",
      value: stats.todayBookings.toString(),
      subtitle: 'Appointments scheduled',
      icon: Calendar,
      gradient: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      borderColor: 'border-green-200',
      trend: 'normal'
    },
    {
      id: 'newClients',
      title: "Today's New Clients",
      value: stats.todayNewClients.toString(),
      subtitle: 'First-time patients',
      icon: UserPlus,
      gradient: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      borderColor: 'border-purple-200',
      trend: 'normal'
    },
    {
      id: 'cancellations',
      title: "Today's Cancellations",
      value: stats.todayCancellations.toString(),
      subtitle: 'Appointments cancelled',
      icon: XCircle,
      gradient: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600',
      borderColor: 'border-red-200',
      trend: stats.todayCancellations > 5 ? 'high' : 'normal'
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 animate-pulse min-h-[160px]">
            <div className="h-10 w-10 bg-gray-200 rounded-xl mb-3"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className={`
              bg-white rounded-2xl border border-gray-100 
              p-4 sm:p-5 hover:shadow-md shadow-sm transition-all duration-300 group 
              flex flex-col justify-between overflow-hidden min-h-[160px]
            `}
          >
            {/* Top Section: Icon + Badge */}
            <div className="flex items-start justify-between mb-3 flex-shrink-0">
              {/* Icon */}
              <div className={`${card.bgColor} w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0`}>
                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${card.iconColor}`} />
              </div>

              {/* Trend Indicator */}
              {card.trend === 'high' && (
                <div className="px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-yellow-100 text-yellow-800 flex items-center gap-1 flex-shrink-0">
                  <span>⚠️</span>
                  <span className="hidden sm:inline">High</span>
                </div>
              )}
            </div>

            {/* Bottom Section: Content */}
            <div className="flex flex-col min-w-0 flex-1">
              {/* Title */}
              <h3 className="text-[10px] sm:text-xs font-semibold text-gray-600 mb-1.5 sm:mb-2 uppercase tracking-wide truncate">
                {card.title}
              </h3>

              {/* Value */}
              <p 
                className={`
                  text-2xl sm:text-3xl lg:text-4xl font-bold 
                  bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent 
                  mb-1 leading-tight truncate
                `}
              >
                {card.value}
              </p>

              {/* Subtitle */}
              <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                {card.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};