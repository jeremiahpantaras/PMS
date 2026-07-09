import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { getTodayArrivals } from '../appointment.api';
import type { Appointment } from '@/types';

// Get current date in Philippine timezone (UTC+8)
// We use a fixed offset since the browser is already in Manila time
const getPhilippineToday = (): Date => {
  // The browser's local time is already Philippine time (UTC+8)
  // So we just use the browser's local date
  return new Date();
};

interface ArrivalsListProps {
  selectedDate?: Date;
  calendarReadyDate: Date | null;
}

const fmtArrivalTime = (arrivalTime: string | null): string => {
  if (!arrivalTime) return '--:-- --';
  return format(new Date(arrivalTime), 'h:mm a');
};

export const ArrivalsList: React.FC<ArrivalsListProps> = ({ calendarReadyDate }) => {
  // Don't fetch until calendar is ready with the current date
  const isCalendarReady = calendarReadyDate !== null;
  
  const { data: arrivals = [], isLoading } = useQuery({
    queryKey: ['today-arrivals'],
    queryFn: async () => {
      // Fetch all today's arrivals (backend filters by today's date in Philippine timezone)
      const allArrivals = await getTodayArrivals();
      
      // The browser's local time is already Philippine time (UTC+8)
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      
      // Filter arrivals based on both appointment date and arrival_time
      // Only show appointments where:
      // 1. arrival_status = 'ARRIVED'
      // 2. appointment date is today
      // 3. arrival_time is today (after midnight)
      const filteredArrivals = allArrivals.filter((apt: Appointment) => {
        // Only show if arrival_status is 'ARRIVED'
        if (apt.arrival_status !== 'ARRIVED') {
          return false;
        }
        
        // Check if appointment date is today (this is the key check!)
        if (apt.date !== todayStr) {
          return false;
        }
        
        // If there's an arrival_time, also check if it's after midnight of current date
        // (this handles cases where patient arrives after midnight of the appointment day)
        if (apt.arrival_time) {
          const arrivalDateTime = new Date(apt.arrival_time);
          const midnightToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
          
          // Show if arrival_time is today (after midnight)
          return arrivalDateTime >= midnightToday;
        }
        
        // Fallback: show if appointment date matches today
        return apt.date === todayStr;
      });
      
      return filteredArrivals;
    },
    enabled: isCalendarReady, // Only fetch when calendar is ready
    refetchInterval: 30000,
  });

    if (!isCalendarReady) {
    return (
      <div className="text-center text-gray-400 text-[10px] py-2">
        Loading arrivals...
      </div>
    );
  }

  // Get today's date in Philippine timezone
  const today = getPhilippineToday();

  // Limit to 3 arrivals, rest are scrollable
  const displayArrivals = arrivals.slice(0, 3);
  const hasMore = arrivals.length > 3;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (arrivals.length === 0) {
    return (
      <div className="text-center text-gray-400 text-[10px] py-2">
        No arrivals for {format(today, 'MMM d')}
      </div>
    );
  }

  return (
    <div>
      {/* Current date display */}
      <div className="text-[9px] text-gray-500 mb-1.5 uppercase tracking-wide">
        {format(today, 'MMM d, yyyy')}
      </div>
      <div className={`space-y-1.5 ${hasMore ? 'max-h-48 overflow-y-auto' : ''}`}>
      {displayArrivals.map((appointment) => (
        <div
          key={appointment.id}
          className="p-2 rounded border border-purple-100 bg-purple-50"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-gray-900 truncate">
                {appointment.practitioner_name ?? 'Unassigned'}
              </p>
              <p className="text-[9px] text-gray-500 truncate">
                {appointment.patient_name}
              </p>
            </div>
            <div className="flex-shrink-0 ml-1.5 text-right">
              <p className="text-[9px] font-medium text-purple-600">
                Arrived
              </p>
              <p className="text-[8px] text-purple-500">
                {fmtArrivalTime(appointment.arrival_time)}
              </p>
            </div>
          </div>
        </div>
      ))}
      {hasMore && (
        <p className="text-[9px] text-gray-400 text-center pt-1.5">
          +{arrivals.length - 3} more arrivals
        </p>
      )}
      </div>
    </div>
  );
};