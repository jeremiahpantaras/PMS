import React, { useState, useEffect } from 'react';
import {
  format, addMonths, subMonths,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, X, Coffee } from 'lucide-react';
import { fetchAvailableSlots } from '../portal.api';
import type { PortalService, PortalPractitioner, PortalAvailability } from '../types/portal';

const DAY_MAP: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

interface PortalAvailabilityCalendarProps {
  token:        string;
  service:      PortalService;
  practitioner: PortalPractitioner | null;
  onConfirm:    (date: string, slot: string) => void;
  onClose:      () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert "HH:MM" → "h:MM AM/PM" */
const fmt12 = (slot: string): string => {
  const [h, m] = slot.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

/** Return true if this "HH:MM" slot falls in the lunch window [12:00, 13:00) */
const isLunchSlot = (slot: string): boolean => {
  const [h, m] = slot.split(':').map(Number);
  return (h === 12) || (h === 13 && m === 0);
};

/** Return true if this "HH:MM" slot is within clinic hours [06:00, 21:00) */
const isWithinClinicHours = (slot: string): boolean => {
  const [h] = slot.split(':').map(Number);
  return h >= 6 && h < 21;
};

/** Check if a date is within practitioner's duty days (supports duty_schedule keys) */
const isWithinDutyDays = (date: Date, availability: PortalAvailability | undefined): boolean => {
  if (!availability) return true;
  const dayName = DAY_MAP[date.getDay()];
  // duty_schedule keys define the active days when present
  if (availability.duty_schedule && Object.keys(availability.duty_schedule).length > 0) {
    return dayName in availability.duty_schedule;
  }
  if (!availability.duty_days?.length) return true;
  return availability.duty_days.includes(dayName as any);
};

/** Check if a slot is within practitioner's duty hours (supports split-shift blocks) */
const isWithinDutyHours = (slot: string, date: Date, availability: PortalAvailability | undefined): boolean => {
  if (!availability) return true;
  const [h, m] = slot.split(':').map(Number);
  const slotMins = h * 60 + m;
  const dayName  = DAY_MAP[date.getDay()];

  // Split-shift: check against specific day blocks
  if (availability.duty_schedule) {
    const dayBlocks = availability.duty_schedule[dayName as keyof typeof availability.duty_schedule];
    if (dayBlocks && dayBlocks.length > 0) {
      return dayBlocks.some(block => {
        const [startH, startM] = block.start.split(':').map(Number);
        const [endH, endM]     = block.end.split(':').map(Number);
        return slotMins >= startH * 60 + startM && slotMins < endH * 60 + endM;
      });
    }
  }
  // Legacy single-block
  const [startH, startM] = availability.duty_start_time.split(':').map(Number);
  const [endH, endM]     = availability.duty_end_time.split(':').map(Number);
  return slotMins >= startH * 60 + startM && slotMins < endH * 60 + endM;
};

/** Check if a slot is within practitioner's lunch break */
const isWithinLunchBreak = (slot: string, availability: PortalAvailability | undefined): boolean => {
  if (!availability) return isLunchSlot(slot);
  const [h, m] = slot.split(':').map(Number);
  const slotMins = h * 60 + m;
  const [lunchStartH, lunchStartM] = availability.lunch_start_time.split(':').map(Number);
  const [lunchEndH, lunchEndM] = availability.lunch_end_time.split(':').map(Number);
  const lunchStartMins = lunchStartH * 60 + lunchStartM;
  const lunchEndMins = lunchEndH * 60 + lunchEndM;
  return slotMins >= lunchStartMins && slotMins < lunchEndMins;
};

export const PortalAvailabilityCalendar: React.FC<PortalAvailabilityCalendarProps> = ({
  token,
  service,
  practitioner,
  onConfirm,
  onClose,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [calMonth,       setCalMonth]       = useState(new Date());
  const [selectedDate,   setSelectedDate]   = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot,   setSelectedSlot]   = useState<string>('');
  const [loadingSlots,   setLoadingSlots]   = useState(false);

  // ── Fetch available slots whenever date changes ──────────────────────────
  useEffect(() => {
    if (!selectedDate) return;
    setAvailableSlots([]);
    setSelectedSlot('');
    setLoadingSlots(true);

    fetchAvailableSlots(token, service.id, selectedDate, practitioner?.id ?? null)
      .then((r) => setAvailableSlots(r.slots ?? []))
      .catch(() => setAvailableSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, token, service.id, practitioner?.id]);

  // ── Calendar grid ────────────────────────────────────────────────────────
  const gridStart = startOfWeek(startOfMonth(calMonth), { weekStartsOn: 1 });
  const gridEnd   = endOfWeek(endOfMonth(calMonth),     { weekStartsOn: 1 });
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
    if (!isWithinDutyDays(date, practitioner?.availability)) return;
    setSelectedDate(str);
  };

  // ── Filter + split slots into morning / afternoon ─────────────────────────
  const practitionerAvailability = practitioner?.availability;
  const visibleSlots = availableSlots.filter(
    s => isWithinClinicHours(s)
      && !isWithinLunchBreak(s, practitionerAvailability)
      && isWithinDutyHours(s, selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date(), practitionerAvailability)
  );

  const morningSlots   = visibleSlots.filter(s => {
    const [h] = s.split(':').map(Number);
    return h < 12;
  });
  const afternoonSlots = visibleSlots.filter(s => {
    const [h] = s.split(':').map(Number);
    return h >= 13;
  });

  // Were any slots removed because they fell in lunch / outside hours?
  const hiddenCount = availableSlots.length - visibleSlots.length;

  // Check if a date is unavailable due to duty days
  const isDateUnavailable = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (dateStr < todayStr) return true;
    if (!isSameMonth(date, calMonth)) return true;
    if (!isWithinDutyDays(date, practitionerAvailability)) return true;
    return false;
  };

  const weekDayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden w-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-sky-50 border-b border-sky-100">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">
            Pick Date &amp; Time
          </p>
          <p className="text-xs font-bold text-gray-800 truncate">{service.name}</p>
          {practitioner?.id != null && (
            <p className="text-[10px] text-gray-500 truncate">with {practitioner.full_name}</p>
          )}
        </div>
        {/* Clinic hours badge */}
        <div className="hidden sm:flex items-center gap-1 text-[10px] text-sky-600 font-medium bg-sky-100 rounded-full px-2 py-0.5 mr-2 whitespace-nowrap">
          <Clock className="w-2.5 h-2.5" />
          {practitionerAvailability?.duty_schedule
            ? 'Split-shift schedule'
            : practitionerAvailability
            ? `${fmt12(practitionerAvailability.duty_start_time)} – ${fmt12(practitionerAvailability.duty_end_time)}`
            : '6 AM – 9 PM'
          }
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1 rounded-md hover:bg-sky-100 text-gray-400 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-3">

        {/* ── Month navigation ── */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCalMonth(subMonths(calMonth, 1))}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-700">
            {format(calMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCalMonth(addMonths(calMonth, 1))}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* ── Weekday labels ── */}
        <div className="grid grid-cols-7">
          {weekDayLabels.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 pb-1">
              {d}
            </div>
          ))}
        </div>

        {/* ── Days grid ── */}
        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((date, di) => {
                const dateStr    = format(date, 'yyyy-MM-dd');
                const isToday    = isSameDay(date, new Date());
                const isSelected = dateStr === selectedDate;

                return (
                  <button
                    key={di}
                    onClick={() => handleDateClick(date)}
                    disabled={isDateUnavailable(date)}
                    className={`
                      h-8 w-full flex items-center justify-center
                      text-xs font-medium rounded-md transition-all
                      ${isDateUnavailable(date)
                        ? 'text-gray-300 cursor-not-allowed bg-gray-50'
                        : isSelected
                          ? 'bg-sky-500 text-white shadow-sm'
                          : isToday
                            ? 'bg-sky-100 text-sky-700 font-bold hover:bg-sky-200'
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

        {/* ── Available time slots ── */}
        {selectedDate && (
          <div className="border-t border-gray-100 pt-3 space-y-3">

            {/* Label row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-gray-400" />
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Available Times — {format(new Date(selectedDate + 'T00:00:00'), 'EEE, MMM d')}
                </p>
              </div>
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {service.duration_minutes} min
              </span>
            </div>

            {/* Loading */}
            {loadingSlots && (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-500" />
              </div>
            )}

            {/* No slots */}
            {!loadingSlots && visibleSlots.length === 0 && (
              <p className="text-[11px] text-gray-400 text-center py-4 bg-gray-50 rounded-md">
                No available slots for this date. Try another day.
              </p>
            )}

            {/* ── Morning slots ── */}
            {!loadingSlots && morningSlots.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Morning
                </p>
                <div className="flex flex-wrap gap-2">
                  {morningSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`
                        px-3 py-2 text-xs font-semibold rounded-xl border transition-all
                        ${selectedSlot === slot
                          ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-sky-400 hover:bg-sky-50'
                        }
                      `}
                    >
                      {fmt12(slot)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Lunch break banner ── */}
            {!loadingSlots && visibleSlots.length > 0 && practitionerAvailability && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Coffee className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                    Lunch Break
                  </p>
                  <p className="text-[10px] text-amber-600">
                    {fmt12(practitionerAvailability.lunch_start_time)} – {fmt12(practitionerAvailability.lunch_end_time)} · No appointments available
                  </p>
                </div>
              </div>
            )}

            {/* ── Afternoon slots ── */}
            {!loadingSlots && afternoonSlots.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Afternoon
                </p>
                <div className="flex flex-wrap gap-2">
                  {afternoonSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`
                        px-3 py-2 text-xs font-semibold rounded-xl border transition-all
                        ${selectedSlot === slot
                          ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-sky-400 hover:bg-sky-50'
                        }
                      `}
                    >
                      {fmt12(slot)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Note if backend returned slots outside clinic hours */}
            {!loadingSlots && hiddenCount > 0 && (
              <p className="text-[10px] text-gray-400 text-center">
                {hiddenCount} slot{hiddenCount > 1 ? 's' : ''} outside clinic hours hidden
              </p>
            )}
          </div>
        )}

        {/* ── Confirm button ── */}
        {selectedDate && selectedSlot && (
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={() => onConfirm(selectedDate, selectedSlot)}
              className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              Confirm — {format(new Date(selectedDate + 'T00:00:00'), 'MMM d')} at {fmt12(selectedSlot)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};