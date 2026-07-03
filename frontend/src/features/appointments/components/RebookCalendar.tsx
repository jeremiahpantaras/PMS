import React, { useState, useEffect } from 'react';
import {
  format, addMonths, subMonths,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, X, Loader2 } from 'lucide-react';
import { getRebookingSlots, type RebookingDetails } from '@/services/rebook.api';

interface RebookCalendarProps {
  token: string;
  details: RebookingDetails;
  onConfirm: (date: string, startTime: string, endTime: string) => void;
  onCancel: () => void;
}

const fmt12 = (slot: string): string => {
  const [h, m] = slot.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

export const RebookCalendar: React.FC<RebookCalendarProps> = ({
  token,
  details,
  onConfirm,
  onCancel,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (!selectedDate) return;
    setAvailableSlots([]);
    setSelectedSlot('');
    setLoadingSlots(true);

    getRebookingSlots(token, selectedDate)
      .then((r) => setAvailableSlots(r.slots ?? []))
      .catch(() => setAvailableSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, token]);

  const gridStart = startOfWeek(startOfMonth(calMonth), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(calMonth), { weekStartsOn: 1 });
  const weeks: Date[][] = [];
  let cur = gridStart;
  while (cur <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(cur); cur = addDays(cur, 1); }
    weeks.push(week);
  }

  const handleDateClick = (date: Date) => {
    const str = format(date, 'yyyy-MM-dd');
    if (str < todayStr || !isSameMonth(date, calMonth)) return;
    setSelectedDate(str);
  };

  const visibleSlots = availableSlots.filter(s => {
    const [h] = s.split(':').map(Number);
    return h >= 6 && h < 21;
  });

  const morningSlots = visibleSlots.filter(s => {
    const [h] = s.split(':').map(Number);
    return h < 12;
  });
  const afternoonSlots = visibleSlots.filter(s => {
    const [h] = s.split(':').map(Number);
    return h >= 13;
  });

  const handleConfirm = () => {
    if (!selectedDate || !selectedSlot) return;
    const [h, m] = selectedSlot.split(':').map(Number);
    const duration = details.duration_minutes || 60;
    const endMins = h * 60 + m + duration;
    const endH = Math.floor(endMins / 60) % 24;
    const endM = endMins % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    onConfirm(selectedDate, selectedSlot, endTime);
  };

  const weekDayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-green-50 border-b border-green-100">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] sm:text-[10px] font-bold text-[#0575E6] uppercase tracking-wider">
            Reschedule Your Appointment
          </p>
          <p className="text-xs sm:text-sm font-bold text-gray-800 truncate">{details.service_name}</p>
          {details.practitioner_name && (
            <p className="text-[9px] sm:text-[10px] text-gray-500 truncate">with {details.practitioner_name}</p>
          )}
        </div>
        <div className="hidden md:flex items-center gap-1 text-[10px] text-[#0575E6] font-medium bg-green-100 rounded-full px-2 py-0.5 mr-2 whitespace-nowrap">
          <Clock className="w-2.5 h-2.5" />
          {details.duration_minutes} min
        </div>
        <div className="flex items-center gap-2">
          <span className="md:hidden text-[9px] text-[#0575E6] font-medium bg-green-100 rounded-full px-1.5 py-0.5 whitespace-nowrap">
            {details.duration_minutes}m
          </span>
          <button
            onClick={onCancel}
            className="p-1 rounded-md hover:bg-green-100 text-gray-400 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-2 sm:p-4 space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCalMonth(subMonths(calMonth, 1))}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs sm:text-sm font-semibold text-gray-700">
            {format(calMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCalMonth(addMonths(calMonth, 1))}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7">
          {weekDayLabels.map((d) => (
            <div key={d} className="text-[9px] sm:text-[10px] font-semibold text-gray-400 pb-1 text-center">
              {d}
            </div>
          ))}
        </div>

        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {week.map((date, di) => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const isToday = isSameDay(date, new Date());
                const isSelected = dateStr === selectedDate;
                const isPast = dateStr < todayStr;
                const isOtherMonth = !isSameMonth(date, calMonth);

                return (
                  <button
                    key={di}
                    onClick={() => handleDateClick(date)}
                    disabled={isPast || isOtherMonth}
                    className={`
                      h-8 w-full flex items-center justify-center
                      text-xs font-medium rounded-md transition-all
                      ${isPast || isOtherMonth
                        ? 'text-gray-300 cursor-not-allowed bg-gray-50'
                        : isSelected
                          ? 'bg-primary-gradient text-white shadow-sm'
                          : isToday
                            ? 'bg-green-100 text-green-700 font-bold hover:bg-green-200'
                            : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    {format(date, 'd')}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {selectedDate && (
          <div className="border-t border-gray-100 pt-2 sm:pt-3 space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-gray-400" />
                <p className="text-[9px] sm:text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Available Times — {format(new Date(selectedDate + 'T00:00:00'), 'EEE, MMM d')}
                </p>
              </div>
              <span className="text-[9px] sm:text-[10px] text-gray-400 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {details.duration_minutes} min
              </span>
            </div>

            {loadingSlots && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-4 h-4 text-[#0575E6] animate-spin" />
              </div>
            )}

            {!loadingSlots && visibleSlots.length === 0 && (
              <p className="text-[10px] sm:text-[11px] text-gray-400 text-center py-4 bg-gray-50 rounded-md">
                No available slots for this date. Try another day.
              </p>
            )}

            {!loadingSlots && morningSlots.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Morning
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {morningSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`
                        px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold rounded-lg sm:rounded-xl border transition-all
                        ${selectedSlot === slot
                          ? 'bg-primary-gradient text-white border-transparent shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-[#0575E6] hover:bg-green-50'
                        }
                      `}
                    >
                      {fmt12(slot)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loadingSlots && afternoonSlots.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Afternoon
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {afternoonSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`
                        px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold rounded-lg sm:rounded-xl border transition-all
                        ${selectedSlot === slot
                          ? 'bg-primary-gradient text-white border-transparent shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-[#0575E6] hover:bg-green-50'
                        }
                      `}
                    >
                      {fmt12(slot)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {selectedDate && selectedSlot && (
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={handleConfirm}
              className="btn-primary w-full py-2 sm:py-3 text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl shadow-sm"
            >
              Confirm — {format(new Date(selectedDate + 'T00:00:00'), 'MMM d')} at {fmt12(selectedSlot)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};