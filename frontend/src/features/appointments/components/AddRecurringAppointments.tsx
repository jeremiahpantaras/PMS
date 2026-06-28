import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Repeat, Save, CheckCircle, AlertCircle, RefreshCw, Building2, ChevronUp, ChevronDown, Stethoscope } from 'lucide-react';
import { format, addWeeks, addMonths, addYears, eachDayOfInterval, addDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { billingApi, type ClinicService } from '@/features/billing/billing.api';
import { checkRecurringAvailability } from '../appointment.api';
import type { Appointment } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onSave?: (recurringData: RecurringAppointmentData) => void;
}

export interface RecurringAppointmentData {
  service_id: number;
  duration_minutes: number;
  dates: string[];
  practitioner_id: number | null;
  start_time: string;
}

// Day options for selection
const DAYS_OF_WEEK = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
];

// Frequency options
const FREQUENCY_OPTIONS = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

interface TimeSlot {
  date: string;
  day_name: string;
  time: string;
  status: 'AVAILABLE' | 'BOOKED' | 'UNAVAILABLE';
}

export const AddRecurringAppointments: React.FC<Props> = ({
  isOpen,
  onClose,
  appointment,
  onSave,
}) => {
  // Form state
  const [selectedServiceId, setSelectedServiceId] = useState<number | ''>('');
  const [duration, setDuration] = useState<number>(30);
  const [frequency, setFrequency] = useState<'WEEKLY' | 'MONTHLY' | 'YEARLY'>('WEEKLY');
  const [repetitions, setRepetitions] = useState<number>(4);
  // Allow empty string so the user can clear and retype
  const [repetitionsStr, setRepetitionsStr] = useState<string>('4');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState<string>('09:00');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Track whether slots are stale (form changed since last check)
  const [slotsStale, setSlotsStale] = useState(false);

  // Fetch clinic services
  const { data: clinicServices = [], isLoading: loadingServices } = useQuery<ClinicService[]>({
    queryKey: ['clinic-services'],
    queryFn: () => billingApi.getClinicServices(),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && appointment) {
      if (appointment.service) {
        const matchingService = clinicServices.find(s => s.id === appointment.service);
        if (matchingService) {
          setSelectedServiceId(matchingService.id);
          setDuration(matchingService.duration_minutes);
        }
      } else if (clinicServices.length > 0) {
        setSelectedServiceId(clinicServices[0].id);
        setDuration(clinicServices[0].duration_minutes);
      }
      if (appointment.duration_minutes) setDuration(appointment.duration_minutes);
      setRepetitions(4);
      setRepetitionsStr('4');
      const appointmentDate  = new Date(appointment.date);
      const dayOfWeek        = appointmentDate.getDay();
      const adjustedDay      = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      setSelectedDays([adjustedDay]);
      const formattedTime = appointment.start_time ? appointment.start_time.substring(0, 5) : '09:00';
      setStartTime(formattedTime);
      setAvailableSlots([]);
      setSlotsStale(false);
    }
  }, [isOpen, appointment, clinicServices]);

  // Update duration when service changes
  useEffect(() => {
    if (selectedServiceId) {
      const service = clinicServices.find(s => s.id === selectedServiceId);
      if (service) setDuration(service.duration_minutes);
    }
  }, [selectedServiceId, clinicServices]);

  // Mark slots stale whenever key form fields change after a check has been done
  useEffect(() => {
    if (availableSlots.length > 0) setSlotsStale(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frequency, repetitions, selectedDays, startTime, duration]);

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleRepetitionsChange = (raw: string) => {
    setRepetitionsStr(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 52) setRepetitions(parsed);
  };

  const handleRepetitionsBlur = () => {
    const parsed = parseInt(repetitionsStr, 10);
    if (isNaN(parsed) || parsed < 1) { setRepetitions(1); setRepetitionsStr('1'); }
    else if (parsed > 52)             { setRepetitions(52); setRepetitionsStr('52'); }
    else                              { setRepetitions(parsed); setRepetitionsStr(String(parsed)); }
  };

  const stepRepetitions = (delta: number) => {
    const next = Math.max(1, Math.min(52, repetitions + delta));
    setRepetitions(next);
    setRepetitionsStr(String(next));
  };

  const calculateEndDate = (start: string, freq: string, reps: number): Date => {
    const startD = new Date(start);
    switch (freq) {
      case 'WEEKLY':  return addWeeks(startD, reps);
      case 'MONTHLY': return addMonths(startD, reps);
      case 'YEARLY':  return addYears(startD, reps);
      default:        return addWeeks(startD, reps);
    }
  };

  const handleCheckAvailability = async () => {
    if (!appointment || selectedDays.length === 0) return;
    setIsCheckingAvailability(true);
    setSlotsStale(false);

    const nextDayDate = addDays(new Date(appointment.date), 1);
    const startDate   = format(nextDayDate, 'yyyy-MM-dd');
    const end         = calculateEndDate(startDate, frequency, repetitions);
    const dates       = eachDayOfInterval({ start: new Date(startDate), end });

    const filteredDates = dates.filter(date => {
      const dow         = date.getDay();
      const adjustedDay = dow === 0 ? 6 : dow - 1;
      return selectedDays.includes(adjustedDay);
    });
    const dateStrings = filteredDates.map(date => format(date, 'yyyy-MM-dd'));

    try {
      const formattedStartTime = startTime.substring(0, 5);
      const response = await checkRecurringAvailability({
        practitioner_id: appointment.practitioner,
        dates: dateStrings,
        start_time: formattedStartTime,
        duration_minutes: duration,
      });
      const slots: TimeSlot[] = response.slots.map(slot => ({
        date:     slot.date,
        day_name: slot.day_name,
        time:     slot.time,
        status:   slot.status === 'BOOKED' ? 'BOOKED' : 'AVAILABLE',
      }));
      setAvailableSlots(slots);
    } catch {
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const fallbackSlots: TimeSlot[] = filteredDates.map(date => {
        const dow         = date.getDay();
        const adjustedDay = dow === 0 ? 6 : dow - 1;
        return {
          date:     format(date, 'yyyy-MM-dd'),
          day_name: dayNames[adjustedDay],
          time:     startTime,
          status:   'AVAILABLE' as const,
        };
      });
      setAvailableSlots(fallbackSlots);
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const handleSave = async () => {
    if (!appointment || !selectedServiceId || selectedDays.length === 0 || repetitions < 1) return;
    setIsSaving(true);

    let finalDates: string[] = [];

    // If slots are fresh, take ONLY the available previewed dates
    if (!slotsStale && availableSlots.length > 0) {
      finalDates = availableSlots
        .filter(slot => slot.status === 'AVAILABLE')
        .map(slot => slot.date);
    } else {
      // Otherwise fallback to generating the dates exactly like the preview
      const nextDayDate = addDays(new Date(appointment.date), 1);
      const startDate   = format(nextDayDate, 'yyyy-MM-dd');
      const end         = calculateEndDate(startDate, frequency, repetitions);
      const datesInterval = eachDayOfInterval({ start: new Date(startDate), end });
  
      const filteredDates = datesInterval.filter(date => {
        const dow         = date.getDay();
        const adjustedDay = dow === 0 ? 6 : dow - 1;
        return selectedDays.includes(adjustedDay);
      });
      finalDates = filteredDates.map(d => format(d, 'yyyy-MM-dd'));
    }

    console.log('[DEBUG Frontend] Payload sent: generated dates', finalDates);

    const recurringData: RecurringAppointmentData = {
      service_id:       Number(selectedServiceId),
      duration_minutes: duration,
      dates:            finalDates,
      practitioner_id:  appointment.practitioner || null,
      start_time:       startTime.substring(0, 5),
    };
    try {
      onSave?.(recurringData);
      onClose();
    } catch (error) {
      console.error('Failed to save recurring appointments:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !appointment) return null;

  const formattedDate      = format(new Date(appointment.date), 'MMM d, yyyy');
  const frequencyLabel     = FREQUENCY_OPTIONS.find(f => f.value === frequency)?.label || 'Weekly';
  const repetitionLabel    = frequency === 'WEEKLY' ? 'weeks' : frequency === 'MONTHLY' ? 'months' : 'years';
  const isFormValid        = selectedServiceId && selectedDays.length > 0 && repetitions >= 1;
  const availableCount     = availableSlots.filter(s => s.status === 'AVAILABLE').length;
  const bookedCount        = availableSlots.filter(s => s.status === 'BOOKED').length;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ───────────────────────────────────────────────────── */}
          <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Repeat className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Add Recurring Appointments</h2>
                <p className="text-xs text-teal-100">
                  {appointment.patient_name} · {formattedDate}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* ── Content ──────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* ── Left Column ─────────────────────────────────────────── */}
              <div className="space-y-5">

                {/* Current appointment summary */}
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-sky-600 uppercase tracking-widest mb-3">
                    Source Appointment
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <Calendar className="w-3.5 h-3.5 text-sky-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Date</p>
                        <p className="text-xs font-semibold text-gray-800">{formattedDate}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="w-3.5 h-3.5 text-sky-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Time</p>
                        <p className="text-xs font-semibold text-gray-800">{startTime}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <User className="w-3.5 h-3.5 text-sky-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Practitioner</p>
                        <p className="text-xs font-semibold text-gray-800">{appointment.practitioner_name || 'Unassigned'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Building2 className="w-3.5 h-3.5 text-sky-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Branch</p>
                        <p className="text-xs font-semibold text-gray-800">{appointment.location_name || 'Main'}</p>
                      </div>
                    </div>
                    <div className="col-span-2 flex items-start gap-2">
                      <Stethoscope className="w-3.5 h-3.5 text-sky-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Service</p>
                        <p className="text-xs font-semibold text-gray-800">{appointment.service_name || appointment.appointment_type || 'General'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recurring options */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Recurring Options
                    </p>
                  </div>
                  <div className="p-4 space-y-4">

                    {/* Appointment type */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Appointment Type <span className="text-red-500">*</span>
                      </label>
                      {loadingServices ? (
                        <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Loading services…
                        </div>
                      ) : (
                        <select
                          value={selectedServiceId}
                          onChange={e => setSelectedServiceId(e.target.value ? Number(e.target.value) : '')}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                        >
                          <option value="">Select a service…</option>
                          {clinicServices.map(service => (
                            <option key={service.id} value={service.id}>
                              {service.name} (₱{parseFloat(service.price).toLocaleString()})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Duration (minutes) <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="15"
                          step="15"
                          value={duration}
                          onChange={e => setDuration(Math.max(15, parseInt(e.target.value) || 15))}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                        <span className="text-xs text-gray-400 whitespace-nowrap">min</span>
                      </div>
                    </div>

                    {/* Start time */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Start Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={e => setStartTime(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </div>

                    {/* Frequency */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Frequency <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-1.5 p-1 bg-gray-100 rounded-lg">
                        {FREQUENCY_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFrequency(opt.value as 'WEEKLY' | 'MONTHLY' | 'YEARLY')}
                            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                              frequency === opt.value
                                ? 'bg-white text-teal-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Repetitions — stepper */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Number of {repetitionLabel} <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden w-full focus-within:ring-2 focus-within:ring-teal-400">
                        <input
                          type="number"
                          min="1"
                          max="52"
                          value={repetitionsStr}
                          onChange={e => handleRepetitionsChange(e.target.value)}
                          onBlur={handleRepetitionsBlur}
                          placeholder="e.g. 4"
                          className="flex-1 px-3 py-2 text-sm bg-white focus:outline-none min-w-0"
                        />
                        <div className="flex flex-col border-l border-gray-200">
                          <button
                            type="button"
                            onClick={() => stepRepetitions(1)}
                            className="px-2 py-1 hover:bg-gray-50 text-gray-500 hover:text-teal-600 transition-colors"
                            aria-label="Increase"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => stepRepetitions(-1)}
                            className="px-2 py-1 hover:bg-gray-50 text-gray-500 hover:text-teal-600 transition-colors border-t border-gray-200"
                            aria-label="Decrease"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {repetitions > 0 && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          {frequencyLabel} for {repetitions} {repetitionLabel}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Right Column ─────────────────────────────────────────── */}
              <div className="space-y-5">
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Availability Check
                    </p>
                  </div>
                  <div className="p-4 space-y-4">

                    {/* Day selector */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2">
                        Days of the Week <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-1.5 flex-wrap">
                        {DAYS_OF_WEEK.map(day => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleDay(day.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              selectedDays.includes(day.value)
                                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-teal-300 hover:text-teal-600'
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Check button */}
                    <button
                      onClick={handleCheckAvailability}
                      disabled={selectedDays.length === 0 || isCheckingAvailability}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
                    >
                      {isCheckingAvailability ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Checking…
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          {slotsStale && availableSlots.length > 0 ? 'Re-check Availability' : 'Check Availability'}
                        </>
                      )}
                    </button>

                    {/* Stale warning */}
                    {slotsStale && availableSlots.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        Settings changed — re-check availability to update results.
                      </div>
                    )}

                    {/* Summary stats */}
                    {availableSlots.length > 0 && !slotsStale && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-center">
                          <p className="text-base font-bold text-gray-700">{availableSlots.length}</p>
                          <p className="text-[10px] text-gray-400">Total</p>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
                          <p className="text-base font-bold text-green-700">{availableCount}</p>
                          <p className="text-[10px] text-green-600">Available</p>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
                          <p className="text-base font-bold text-red-700">{bookedCount}</p>
                          <p className="text-[10px] text-red-500">Booked</p>
                        </div>
                      </div>
                    )}

                    {/* Availability table */}
                    {availableSlots.length > 0 && (
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                            {frequencyLabel} schedule · {repetitions} {repetitionLabel}
                          </p>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left text-gray-400 font-semibold">#</th>
                                <th className="px-3 py-2 text-left text-gray-400 font-semibold">Date</th>
                                <th className="px-3 py-2 text-left text-gray-400 font-semibold">Day</th>
                                <th className="px-3 py-2 text-left text-gray-400 font-semibold">Time</th>
                                <th className="px-3 py-2 text-left text-gray-400 font-semibold">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {availableSlots.map((slot, idx) => (
                                <tr
                                  key={`${slot.date}-${idx}`}
                                  className={`${slot.status === 'BOOKED' ? 'bg-red-50/50' : 'hover:bg-gray-50'}`}
                                >
                                  <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                                  <td className="px-3 py-2 text-gray-800 font-semibold">
                                    {format(new Date(slot.date), 'MMM d, yyyy')}
                                  </td>
                                  <td className="px-3 py-2 text-gray-500">{slot.day_name}</td>
                                  <td className="px-3 py-2 text-gray-500">{slot.time}</td>
                                  <td className="px-3 py-2">
                                    {slot.status === 'AVAILABLE' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                                        <CheckCircle className="w-2.5 h-2.5" />
                                        Available
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                                        <AlertCircle className="w-2.5 h-2.5" />
                                        Booked
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {selectedDays.length > 0 && !isCheckingAvailability && availableSlots.length === 0 && (
                      <div className="text-center py-6 text-gray-400 text-xs">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                        Click "Check Availability" to preview the schedule
                      </div>
                    )}

                    {selectedDays.length === 0 && (
                      <div className="text-center py-6 text-gray-400 text-xs">
                        Select at least one day of the week first
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
            <div className="text-xs text-gray-400">
              Recurring appointments will start from{' '}
              <span className="font-semibold text-gray-600">
                {format(addDays(new Date(appointment.date), 1), 'MMM d, yyyy')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!isFormValid || isSaving}
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Recurring
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};