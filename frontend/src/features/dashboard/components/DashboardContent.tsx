import React from 'react';
import { useSidebar } from '@/hooks/useSidebar';
import { useDashboardData } from '../hooks/useDashboardData';
import { DashboardStats } from './DashboardStats';
import { BookingsPerTypeChart } from './BookingsPerTypeChart';
import { WeeklyBookingsChart } from './WeeklyBookingsChart';
import { LiveOccupancyWidget } from './LiveOccupancyWidget';
import { ClinicianPerformance } from './ClinicianPerformance';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const DashboardContent: React.FC = () => {
  const { isMobile, isExpanded } = useSidebar();
  const { data, isLoading, error, refresh } = useDashboardData();

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
        className="flex-shrink-0 border-b border-gray-200 bg-white/80 backdrop-blur-sm"
        style={{
          padding: isMobile ? '1rem' : isExpanded ? '1.5rem 2rem' : '1.5rem',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-trust-harbor mb-1 font-heading">
              Dashboard Overview
            </h1>
            <p className="text-sm text-steady-slate font-body">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
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
        className="flex-1 overflow-y-auto"
        style={{
          padding: isMobile ? '1rem' : isExpanded ? '2rem' : '1.5rem',
          paddingBottom: isMobile ? '2rem' : '2.5rem', // ✅ Added extra bottom padding
        }}
      >
        {isMobile ? (
          // Mobile: Stack vertically
          <div className="space-y-4">
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
            <LiveOccupancyWidget />
            <BookingsPerTypeChart data={data?.bookingsByType || []} isLoading={isLoading} />
            <WeeklyBookingsChart  data={data?.weeklyBookings  || []} isLoading={isLoading} />
            <ClinicianPerformance />
          </div>
        ) : (
          // Desktop: Bento Grid (12 columns)
          <div className="grid grid-cols-12 gap-6">
            {/* Left Column: Stats Cards */}
            <div className="col-span-12 lg:col-span-4 xl:col-span-3 flex flex-col gap-6">
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
                layout="vertical"
              />
              {/* Live Occupancy — sits below stats in the left column */}
              <LiveOccupancyWidget />
            </div>

            {/* Right Column: Charts */}
            <div className="col-span-12 lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
              <BookingsPerTypeChart data={data?.bookingsByType || []} isLoading={isLoading} />
              <WeeklyBookingsChart  data={data?.weeklyBookings  || []} isLoading={isLoading} />
              {/* Clinician Performance — full width of right column */}
              <ClinicianPerformance />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};