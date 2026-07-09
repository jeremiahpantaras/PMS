import React from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { DashboardStats } from './DashboardStats';
import { BookingsPerTypeChart } from './BookingsPerTypeChart';
import { WeeklyBookingsChart } from './WeeklyBookingsChart';
import { LiveOccupancyWidget } from './LiveOccupancyWidget';
import { ClinicianPerformance } from './ClinicianPerformance';
import { AlertCircle, RefreshCw } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';

export const DashboardContent: React.FC = () => {
  const { user } = useAuth();
  const { data, isLoading, error, refresh } = useDashboardData();

  const hour = new Date().getHours();
  let timeOfDay = 'evening';
  if (hour < 12) timeOfDay = 'morning';
  else if (hour < 18) timeOfDay = 'afternoon';

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 max-w-md">
          <div className="flex items-center gap-3 mb-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-bold text-red-900">Error Loading Dashboard</h3>
          </div>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header - Fixed */}
      <div
        className="flex-shrink-0 border-b border-gray-200 bg-white/80 backdrop-blur-sm p-4 md:p-6 lg:px-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1 font-heading">
              Hi there, {user?.first_name || 'User'}!
            </h1>
            <p className="text-sm text-gray-500 font-body">
              Good {timeOfDay}. Here are the Clinic details for today
            </p>
          </div>
          {!isLoading && (
            <button
              onClick={refresh}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-steady-slate rounded-2xl hover:bg-clinical-cloud transition-colors text-sm font-medium font-body"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Bento Grid Layout - Scrollable content with bottom padding */}
      <div
        className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-8 md:pb-10"
      >
        <div className="flex flex-col gap-6">
          {/* Top Row: KPI Cards */}
          <div className="w-full">
            <DashboardStats
              stats={
                data?.stats || {
                  todayOccupancy: { current: 0, total: 0, percentage: 0 },
                  todayBookings: 0,
                  todayNewClients: 0,
                  todayCancellations: 0,
                }
              }
              isLoading={isLoading}
            />
          </div>

          {/* Bottom Area: 70/30 Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (70%) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <WeeklyBookingsChart data={data?.weeklyBookings || []} isLoading={isLoading} />
              <BookingsPerTypeChart data={data?.bookingsByType || []} isLoading={isLoading} />
            </div>

            {/* Right Column (30%) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <LiveOccupancyWidget />
              <ClinicianPerformance />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};