import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DashboardLayout } from '@/features/dashboard/components/DashboardLayout';
import { ChevronLeft, ChevronRight, Filter, Building2, Users } from 'lucide-react';
import { Calendar } from './Calendar';
import { ArrivalsList } from './components/ArrivalsList';
import { EventViewModal } from './components/EventViewModal';
import { AddEventModal } from './components/AddEventModal';
import { SelectOptionModal } from './components/SelectOptionModal';
import { AppointmentModal } from './components/AppointmentModal';
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { usePractitioners } from '@/features/clinics/hooks/usePractitioners';
import { useClinicBranches } from '@/features/clinics/hooks/useClinicBranches';
import { useAuthStore } from '@/store/auth.store';
import type { BlockAppointment, Appointment } from '@/types';
import type { PractitionerAvailability } from '@/features/clinics/clinic.api';

type CalendarView = 'day' | 'week' | 'month';

export const Diary: React.FC = () => {
  // Get user info early for role-based logic
  const { user } = useAuthStore();
  const isAdmin        = user?.role === 'ADMIN';
  const isPractitioner = user?.role === 'PRACTITIONER';
  const isStaff        = user?.role === 'STAFF';

  const [currentDate, setCurrentDate] = useState(new Date());
  // Default to week view for practitioners / staff
  const [view, setView] = useState<CalendarView>('week');
  const [selectedPractitioner, setSelectedPractitioner] = useState<number | string | null>(null);
  const [selectedClinicBranch, setSelectedClinicBranch] = useState<number | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [calendarReadyDate, setCalendarReadyDate] = useState<Date | null>(null);

  // ── Admin Compare Mode State ────────────────────────────────────────────────
  const [compareMode, setCompareMode] = useState(false);
  const [comparePractitioners, setComparePractitioners] = useState<[number | string | null, number | string | null]>([null, null]);
  const [showCompareDropdownA, setShowCompareDropdownA] = useState(false);
  const [showCompareDropdownB, setShowCompareDropdownB] = useState(false);

  // Guard: only auto-select assigned clinic branch once on initial load
  const hasAutoSelectedBranch = useRef(false);

  // Fetch clinic branches
  const { branches, loading: loadingBranches } = useClinicBranches();

  // Fetch practitioners — automatically filtered by selectedClinicBranch
  const { practitioners, loading: loadingPractitioners } = usePractitioners({
    clinicBranchId: selectedClinicBranch,
  });

  // Cache the logged-in user's availability AND branch assignment so they
  // survive branch switches (switching tabs refetches practitioners for that branch,
  // losing data about the user's home branch).
  const [cachedOwnAvailability, setCachedOwnAvailability] = useState<PractitionerAvailability | null>(null);
  const [cachedOwnBranchId, setCachedOwnBranchId] = useState<number | null>(null);
  // The practitioner-list id of the logged-in user's own entry (e.g. Practitioner pk or 'staff-{id}')
  const [cachedOwnId, setCachedOwnId] = useState<number | string | null>(null);

  // Single effect: cache own availability + home branch, and auto-navigate to it once.
  useEffect(() => {
    if (!(isPractitioner || isStaff) || practitioners.length === 0) return;

    let own;
    if (isPractitioner && user?.practitioner_id) {
      own = practitioners.find(p => p.id === user.practitioner_id);
    } else if (isStaff) {
      own = practitioners.find(p => {
        const maybeUserId = (p as { user_id?: number }).user_id;
        return p.role === 'STAFF' && maybeUserId === user?.id;
      });
    }
    if (!own) return;

    if (own.availability) setCachedOwnAvailability(own.availability);
    if (cachedOwnId == null) setCachedOwnId(own.id);

    if (own.clinic_branch_id != null) {
      if (cachedOwnBranchId == null) setCachedOwnBranchId(own.clinic_branch_id);

      // Auto-open the user's assigned clinic tab on first page load
      if (!hasAutoSelectedBranch.current) {
        hasAutoSelectedBranch.current = true;
        setSelectedClinicBranch(own.clinic_branch_id);
        setSelectedPractitioner(own.id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPractitioner, isStaff, user?.practitioner_id, user?.id, practitioners]);

  // True when the currently selected branch tab is the user's own home clinic.
  const isOwnAssignedClinic =
    (isPractitioner || isStaff) && cachedOwnBranchId !== null && selectedClinicBranch === cachedOwnBranchId;

  // Compute the availability to pass to Calendar
  const practitionerAvailabilityForCalendar = useMemo(() => {
    if (!selectedPractitioner) return undefined;

    // Find in current practitioners list (works for both number and string ids)
    const practitionerInList = practitioners.find(p => p.id === selectedPractitioner);
    if (practitionerInList?.availability) {
      return practitionerInList.availability;
    }

    // Fallback to cached own availability for practitioner/staff in their home clinic
    if ((isPractitioner || isStaff) && cachedOwnAvailability) {
      return cachedOwnAvailability;
    }

    return undefined;
  }, [selectedPractitioner, practitioners, isPractitioner, isStaff, cachedOwnAvailability]);

  // Build a full availability map for ALL practitioners so Calendar can colour
  // every slot correctly even when no specific practitioner is selected.
  const availabilityMap = useMemo<Record<number, PractitionerAvailability>>(() => {
    const map: Record<number, PractitionerAvailability> = {};
    practitioners.forEach(p => {
      if (typeof p.id === 'number' && p.availability) map[p.id] = p.availability;
    });
    // Also include the cached availability for the logged-in practitioner so
    // switching branches never causes their own schedule to disappear.
    if (isPractitioner && user?.practitioner_id && cachedOwnAvailability) {
      map[user.practitioner_id] = cachedOwnAvailability;
    }
    return map;
  }, [practitioners, isPractitioner, user, cachedOwnAvailability]);

  // Which availability map to pass as allAvailabilities to Calendar:
  // - Admin: pass map only when a single manual filter is active (compare handled separately)
  // - Practitioner/Staff: single-practitioner overlay via practitionerAvailability prop;
  //   allAvailabilities always undefined (avoids showing every branch practitioner)
  const calendarAllAvailabilities = useMemo(() => {
    if (!isAdmin) return undefined;
    if (compareMode) return undefined;
    if (selectedPractitioner) return availabilityMap;
    return undefined;
  }, [isAdmin, compareMode, selectedPractitioner, availabilityMap]);

  // ── Compare mode availability ───────────────────────────────────────────────
  const compareAvailabilityA = useMemo(
    () => (comparePractitioners[0] != null
      ? practitioners.find(p => p.id === comparePractitioners[0])?.availability
      : undefined),
    [comparePractitioners, practitioners],
  );
  const compareAvailabilityB = useMemo(
    () => (comparePractitioners[1] != null
      ? practitioners.find(p => p.id === comparePractitioners[1])?.availability
      : undefined),
    [comparePractitioners, practitioners],
  );
  const comparePractitionerAName = useMemo(
    () => practitioners.find(p => p.id === comparePractitioners[0])?.name ?? 'Practitioner A',
    [practitioners, comparePractitioners],
  );
  const comparePractitionerBName = useMemo(
    () => practitioners.find(p => p.id === comparePractitioners[1])?.name ?? 'Practitioner B',
    [practitioners, comparePractitioners],
  );
  const comparePractitionerNames = useMemo<[string, string]>(
    () => [comparePractitionerAName, comparePractitionerBName],
    [comparePractitionerAName, comparePractitionerBName],
  );

  const handlePrevious = useCallback(() => {
    setCurrentDate(prev => {
      if (view === 'day') return subDays(prev, 1);
      if (view === 'week') return subWeeks(prev, 1);
      return subMonths(prev, 1);
    });
  }, [view]);

  const handleNext = useCallback(() => {
    setCurrentDate(prev => {
      if (view === 'day') return addDays(prev, 1);
      if (view === 'week') return addWeeks(prev, 1);
      return addMonths(prev, 1);
    });
  }, [view]);

  const handleToday = useCallback(() => setCurrentDate(new Date()), []);

  const handleDateChange = useCallback((date: Date) => {
    setCurrentDate(date);
    if (view === 'month') setView('day');
  }, [view]);

  const handlePractitionerSelect = (practitionerId: number | string | null) => {
    setSelectedPractitioner(practitionerId);
    setShowFilterDropdown(false);
  };

  const handleClinicBranchSelect = (branchId: number | null) => {
    setSelectedClinicBranch(branchId);
    // Always reset compare state when switching tabs
    setCompareMode(false);
    setComparePractitioners([null, null]);

    if ((isPractitioner || isStaff) && cachedOwnBranchId !== null) {
      // If switching back to the user's own assigned clinic, restore their filter.
      // In any other tab, clear the filter so the calendar starts clean.
      if (branchId === cachedOwnBranchId) {
        setSelectedPractitioner(cachedOwnId);
      } else {
        setSelectedPractitioner(null);
      }
    } else {
      // Admin: always clear filter when switching branches
      setSelectedPractitioner(null);
    }
  };

  // ── Admin Compare Mode Handlers ─────────────────────────────────────────────
  const handleSetCompareMode = (enabled: boolean) => {
    setCompareMode(enabled);
    if (!enabled) setComparePractitioners([null, null]);
  };

  const handleComparePractitionerASelect = (id: number | string | null) => {
    setComparePractitioners([id, comparePractitioners[1]]);
    setShowCompareDropdownA(false);
  };

  const handleComparePractitionerBSelect = (id: number | string | null) => {
    setComparePractitioners([comparePractitioners[0], id]);
    setShowCompareDropdownB(false);
  };

  const isDuplicateComparePractitioner =
    comparePractitioners[0] !== null &&
    comparePractitioners[1] !== null &&
    comparePractitioners[0] === comparePractitioners[1];

  const dateRangeText = useMemo(() => {
    if (view === 'day') return format(currentDate, 'EEEE, MMMM d, yyyy');
    if (view === 'week') {
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay() + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'MMMM yyyy');
  }, [view, currentDate]);

  const currentMonth = new Date();
  const nextMonth = addMonths(currentMonth, 1);

  const handleMiniCalendarSelect = (date: Date) => {
    setCurrentDate(date);
    setView('day');
  };

  const selectedPractitionerName = useMemo(
    () => practitioners.find(p => p.id === selectedPractitioner)?.name,
    [practitioners, selectedPractitioner],
  );
  const selectedBranchName = useMemo(
    () => branches.find(b => b.id === selectedClinicBranch)?.name,
    [branches, selectedClinicBranch],
  );

  // ── Modal State ─────────────────────────────────────────────────────────────
  // Select-option modal (admin double-click / drag-select on calendar)
  const [showSelectOptionModal, setShowSelectOptionModal] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<{
    date: Date; time: string; hour: number; minutes: number; duration: number;
  } | null>(null);
  // Appointment creation (from SelectOptionModal "Create New Appointment")
  const [showCreateAppointmentModal, setShowCreateAppointmentModal] = useState(false);
  // Block appointment creation (from SelectOptionModal "Add Block Appointment")
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [eventRefreshKey, setEventRefreshKey] = useState(0);
  // Increment to trigger Calendar to refetch regular appointments
  const [appointmentRefreshKey, setAppointmentRefreshKey] = useState(0);

  // Appointments from Calendar for conflict detection
  const [calendarAppointments, setCalendarAppointments] = useState<Appointment[]>([]);

  // Event View Modal State
  const [showEventViewModal, setShowEventViewModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<BlockAppointment | null>(null);

  const handleEventClick = useCallback((event: BlockAppointment) => {
    setSelectedEvent(event);
    setShowEventViewModal(true);
  }, []);

  const handleEventUpdated = useCallback(() => {
    // Increment the refresh key to trigger Calendar to refetch block appointments
    setEventRefreshKey(prev => prev + 1);
  }, []);

  const handleEventDeleted = useCallback(() => {
    // Increment the refresh key to trigger Calendar to refetch block appointments
    setEventRefreshKey(prev => prev + 1);
  }, []);

  const handleEventCreated = useCallback((_event: BlockAppointment) => {
    void _event;
    // Increment the refresh key to trigger Calendar to refetch block appointments
    setEventRefreshKey(prev => prev + 1);
  }, []);

  const handleRecurringCreated = useCallback(() => {
    setAppointmentRefreshKey(prev => prev + 1);
  }, []);

  // ── Slot action (double-click or drag-select) → SelectOptionModal ──────
  // Available to all users: Admin, Practitioner, Staff
  const handleSlotAction = useCallback((slot: {
    date: Date; time: string; hour: number; minutes: number; duration: number;
  }) => {
    setPendingSlot(slot);
    setShowSelectOptionModal(true);
  }, []);

  const calendarCompareMode = useMemo(
    () => (isAdmin || isPractitioner || isStaff) && compareMode && !isDuplicateComparePractitioner && (view === 'day' || view === 'week'),
    [isAdmin, isPractitioner, isStaff, compareMode, isDuplicateComparePractitioner, view],
  );

  const handleSelectOptionClose = () => {
    setShowSelectOptionModal(false);
    setPendingSlot(null);
  };

  const handleSelectNewAppointment = () => {
    setShowSelectOptionModal(false);
    setShowCreateAppointmentModal(true);
  };

  const handleSelectBlockAppointment = () => {
    if (!pendingSlot) return;
    setShowSelectOptionModal(false);
    setShowAddEventModal(true);
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">

        {/* ── Branch Tabs ── */}
        {branches.length > 0 && (
          <div className="flex-shrink-0 bg-clinical-cloud border-b border-gray-200">
            <div className="flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">

              {/* All Branches */}
              <button
                onClick={() => handleClinicBranchSelect(null)}
                disabled={loadingBranches}
                className={`
                  relative flex items-center gap-2 px-6 py-3 text-sm font-medium whitespace-nowrap
                  transition-all duration-200 border-b-2
                  ${selectedClinicBranch === null
                    ? 'bg-white text-care-blue border-care-blue shadow-sm'
                    : 'bg-transparent text-steady-slate border-transparent hover:text-trust-harbor hover:bg-gray-100/50'
                  }
                  ${loadingBranches ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <Building2 className="w-4 h-4" />
                <span>All Branches</span>
              </button>

              {/* Individual Branch Tabs */}
              {branches.map((branch) => (
                <button
                  key={branch.id}
                  onClick={() => handleClinicBranchSelect(branch.id)}
                  disabled={loadingBranches}
                  className={`
                    relative flex items-center gap-2 px-6 py-3 text-sm font-medium whitespace-nowrap
                    transition-all duration-200 border-b-2
                    ${selectedClinicBranch === branch.id
                      ? 'bg-white text-care-blue border-care-blue shadow-sm'
                      : 'bg-transparent text-steady-slate border-transparent hover:text-trust-harbor hover:bg-gray-100/50'
                    }
                    ${loadingBranches ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <Building2 className="w-4 h-4" />
                  <span>{branch.name}</span>
                  {branch.is_main_branch && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                      Main
                    </span>
                  )}
                  <span className="text-xs text-gray-400">• {branch.city}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Main Content ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left Sidebar */}
          <div className="w-56 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
            {/* Current Month Mini Calendar */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 text-center">
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              <MiniCalendar
                date={currentMonth}
                selectedDate={currentDate}
                onDateSelect={handleMiniCalendarSelect}
              />
            </div>

            {/* Next Month Mini Calendar */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 text-center">
                {format(nextMonth, 'MMMM yyyy')}
              </h3>
              <MiniCalendar
                date={nextMonth}
                selectedDate={currentDate}
                onDateSelect={handleMiniCalendarSelect}
              />
            </div>

            {/* Arrivals Section */}
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Today's Arrivals</h3>
              <ArrivalsList calendarReadyDate={calendarReadyDate} />
            </div>
          </div>

          {/* Main Calendar Area */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Header Controls */}
            <div className="flex-shrink-0 border-b border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">

                {/* Navigation + Practitioner Filter */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={handleToday}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Today
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={handlePrevious}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleNext}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  <h2 className="text-lg font-semibold text-trust-harbor">
                    {dateRangeText}
                  </h2>

                  {/* Active branch badge */}
                  {selectedBranchName && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-care-blue/10 text-care-blue border border-care-blue/20">
                      <Building2 className="w-3 h-3" />
                      {selectedBranchName}
                    </span>
                  )}

                  {/* Practitioner Filter / Compare Mode */}
                  <div className="flex items-center gap-2 flex-wrap">

                    {/* ── Compare Mode Toggle (Admin + Practitioner + Staff, Day/Week only) ── */}
                    {(isAdmin || isPractitioner || isStaff) && (view === 'day' || view === 'week') && (
                      <div className="flex items-center rounded-lg overflow-hidden border border-gray-200 bg-gray-50 text-xs font-medium">
                        <button
                          onClick={() => handleSetCompareMode(false)}
                          className={`px-3 py-1.5 transition-colors ${!compareMode ? 'bg-white text-care-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Single
                        </button>
                        <button
                          onClick={() => handleSetCompareMode(true)}
                          className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${compareMode ? 'bg-white text-care-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          <Users className="w-3 h-3" />
                          Compare
                        </button>
                      </div>
                    )}

                    {!compareMode ? (
                      /* ── Single Practitioner Filter Dropdown ── */
                      <div className="relative">
                        <button
                          onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                          disabled={loadingPractitioners}
                          className={`
                            flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors
                            ${selectedPractitioner
                              ? 'bg-care-blue/10 text-care-blue border-care-blue/30 hover:bg-care-blue/20'
                              : 'bg-white text-trust-harbor border-gray-300 hover:bg-gray-50'
                            }
                            ${loadingPractitioners ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                        >
                          <Filter className="w-4 h-4" />
                          {loadingPractitioners
                            ? 'Loading...'
                            : selectedPractitionerName
                              || ((isPractitioner || isStaff) && isOwnAssignedClinic ? 'My Schedule' : 'All Practitioners')
                          }
                        </button>

                        {showFilterDropdown && !loadingPractitioners && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
                            <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-20 max-h-80 overflow-y-auto">

                              {selectedClinicBranch && (
                                <div className="px-4 py-2 bg-care-blue/10 border-b border-care-blue/20">
                                  <p className="text-xs font-semibold text-care-blue">
                                    Showing practitioners for: {selectedBranchName}
                                  </p>
                                </div>
                              )}

                              {/* Default option: "My Schedule" for practitioners in own clinic,
                                  "All in [Branch]" or "All Practitioners" otherwise */}
                              <button
                                onClick={() => handlePractitionerSelect(
                                  (isPractitioner || isStaff) && isOwnAssignedClinic && cachedOwnId
                                    ? cachedOwnId
                                    : null
                                )}
                                className={`
                                  w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors
                                  ${(isPractitioner || isStaff) && isOwnAssignedClinic
                                    ? selectedPractitioner === cachedOwnId ? 'bg-care-blue/10 text-care-blue font-semibold' : 'text-gray-700'
                                    : selectedPractitioner === null ? 'bg-care-blue/10 text-care-blue font-semibold' : 'text-gray-700'
                                  }
                                `}
                              >
                                <div className="flex items-center justify-between">
                                  <span>
                                    {(isPractitioner || isStaff) && isOwnAssignedClinic
                                      ? 'My Schedule'
                                      : selectedClinicBranch
                                        ? `All in ${selectedBranchName}`
                                        : 'All Practitioners'
                                    }
                                  </span>
                                  {((isPractitioner || isStaff) && isOwnAssignedClinic
                                    ? selectedPractitioner === cachedOwnId
                                    : selectedPractitioner === null) && (
                                    <span className="text-care-blue text-base">✓</span>
                                  )}
                                </div>
                              </button>

                              <div className="border-t border-gray-200" />

                              {practitioners.length === 0 ? (
                                <div className="px-4 py-6 text-sm text-gray-500 text-center">
                                  <p className="font-medium">No practitioners found</p>
                                  {selectedClinicBranch && (
                                    <p className="text-xs mt-1 text-gray-400">
                                      No staff assigned to this branch yet.
                                    </p>
                                  )}
                                </div>
                              ) : (
                                practitioners.map((practitioner) => (
                                  <button
                                    key={practitioner.id}
                                    onClick={() => handlePractitionerSelect(practitioner.id)}
                                    className={`
                                      w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors
                                      ${selectedPractitioner === practitioner.id
                                        ? 'bg-care-blue/10 text-care-blue font-semibold'
                                        : 'text-gray-700'
                                      }
                                    `}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="truncate">
                                          {practitioner.name}
                                          {practitioner.id === cachedOwnId && (
                                            <span className="ml-1.5 text-xs text-care-blue font-medium">(me)</span>
                                          )}
                                        </div>
                                        {practitioner.specialization && (
                                          <div className="text-xs text-gray-500 mt-0.5 truncate">
                                            {practitioner.specialization}
                                          </div>
                                        )}
                                        {!selectedClinicBranch && practitioner.clinic_branch_name && (
                                          <div className="text-xs text-care-blue mt-0.5 flex items-center gap-1">
                                            <Building2 className="w-3 h-3" />
                                            {practitioner.clinic_branch_name}
                                          </div>
                                        )}
                                      </div>
                                      {selectedPractitioner === practitioner.id && (
                                        <span className="text-care-blue flex-shrink-0 text-base">✓</span>
                                      )}
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      /* ── Compare Mode: Two Practitioner Dropdowns ── */
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Practitioner A Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setShowCompareDropdownA(!showCompareDropdownA)}
                            disabled={loadingPractitioners}
                            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors
                              ${comparePractitioners[0]
                                ? 'bg-care-blue/10 text-care-blue border-care-blue/30 hover:bg-care-blue/20'
                                : 'bg-white text-trust-harbor border-gray-300 hover:bg-gray-50'
                              }
                              ${loadingPractitioners ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                          >
                            <span className="text-xs font-bold mr-0.5 text-care-blue">A:</span>
                            {loadingPractitioners ? 'Loading…' : (comparePractitionerAName !== 'Practitioner A' ? comparePractitionerAName : 'Select A')}
                          </button>
                          {showCompareDropdownA && !loadingPractitioners && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setShowCompareDropdownA(false)} />
                              <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 z-20 max-h-72 overflow-y-auto">
                                <div className="px-4 py-2 bg-care-blue/10 border-b border-care-blue/20">
                                  <p className="text-xs font-semibold text-care-blue">Select Practitioner A</p>
                                </div>
                                {practitioners.map((p) => (
                                  <button
                                    key={p.id}
                                    onClick={() => handleComparePractitionerASelect(p.id)}
                                    disabled={p.id === comparePractitioners[1]}
                                    className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors
                                      ${comparePractitioners[0] === p.id ? 'bg-care-blue/10 text-care-blue font-semibold' : 'text-gray-700'}
                                      ${p.id === comparePractitioners[1] ? 'opacity-40 cursor-not-allowed' : ''}
                                    `}
                                  >
                                    <div className="truncate">{p.name}{p.id === cachedOwnId && <span className="ml-1 text-xs text-care-blue">(me)</span>}</div>
                                    {p.specialization && <div className="text-xs text-gray-500 truncate">{p.specialization}</div>}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        <span className="text-gray-400 font-bold text-sm">vs</span>

                        {/* Practitioner B Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setShowCompareDropdownB(!showCompareDropdownB)}
                            disabled={loadingPractitioners}
                            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors
                              ${comparePractitioners[1]
                                ? 'bg-violet-50 text-violet-700 border-violet-300 hover:bg-violet-100'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                              }
                              ${loadingPractitioners ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                          >
                            <span className="text-xs font-bold mr-0.5 text-violet-600">B:</span>
                            {loadingPractitioners ? 'Loading…' : (comparePractitionerBName !== 'Practitioner B' ? comparePractitionerBName : 'Select B')}
                          </button>
                          {showCompareDropdownB && !loadingPractitioners && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setShowCompareDropdownB(false)} />
                              <div className="absolute left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 z-20 max-h-72 overflow-y-auto">
                                <div className="px-4 py-2 bg-violet-50 border-b border-violet-100">
                                  <p className="text-xs font-semibold text-violet-700">Select Practitioner B</p>
                                </div>
                                {practitioners.map((p) => (
                                  <button
                                    key={p.id}
                                    onClick={() => handleComparePractitionerBSelect(p.id)}
                                    disabled={p.id === comparePractitioners[0]}
                                    className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors
                                      ${comparePractitioners[1] === p.id ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-gray-700'}
                                      ${p.id === comparePractitioners[0] ? 'opacity-40 cursor-not-allowed' : ''}
                                    `}
                                  >
                                    <div className="truncate">{p.name}{p.id === cachedOwnId && <span className="ml-1 text-xs text-violet-500">(me)</span>}</div>
                                    {p.specialization && <div className="text-xs text-gray-500 truncate">{p.specialization}</div>}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Duplicate validation warning */}
                        {isDuplicateComparePractitioner && (
                          <span className="text-xs text-red-600 font-medium">
                            ⚠ Select two different practitioners
                          </span>
                        )}
                      </div>
                    )}

                    {/* Clear single filter:
                        - Not shown when practitioner is in own clinic viewing own schedule (that's the default)
                        - Shown when a non-default practitioner is manually selected */}
                    {!compareMode && selectedPractitioner !== null &&
                      !((isPractitioner || isStaff) && isOwnAssignedClinic && selectedPractitioner === cachedOwnId) && (
                      <button
                        onClick={() => {
                          if ((isPractitioner || isStaff) && isOwnAssignedClinic && cachedOwnId) {
                            setSelectedPractitioner(cachedOwnId);
                          } else {
                            setSelectedPractitioner(null);
                          }
                          setShowFilterDropdown(false);
                        }}
                        className="text-xs text-care-blue hover:text-trust-harbor font-medium"
                      >
                        {(isPractitioner || isStaff) && isOwnAssignedClinic ? 'My Schedule' : 'Clear filter'}
                      </button>
                    )}
                  </div>
                </div>

                {/* View Switcher */}
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  {(['day', 'week', 'month'] as CalendarView[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => {
                        setView(v);
                        if (v === 'month') handleSetCompareMode(false);
                      }}
                      className={`
                        px-4 py-2 text-sm font-medium rounded-md transition-all capitalize
                        ${view === v
                          ? 'bg-white text-care-blue shadow-sm'
                          : 'text-steady-slate hover:text-trust-harbor'
                        }
                      `}
                    >
                      {v}
                    </button>
                  ))}
                </div>

                {/* Add Event Button removed — admin uses double-click / drag-select on calendar */}
              </div>
            </div>

            {/* Calendar */}
            <div className="flex-1 overflow-hidden p-4 bg-clinical-cloud">
              <Calendar
                view={view}
                currentDate={currentDate}
                onDateChange={handleDateChange}
                selectedPractitionerId={compareMode ? null : selectedPractitioner}
                selectedClinicBranchId={selectedClinicBranch}
                refreshKey={eventRefreshKey}
                appointmentRefreshKey={appointmentRefreshKey}
                onRecurringCreated={handleRecurringCreated}
                onEventClick={handleEventClick}
                onSlotAction={handleSlotAction}
                onAppointmentsReady={setCalendarAppointments}
                onCalendarReady={setCalendarReadyDate}
                practitionerAvailability={compareMode ? undefined : practitionerAvailabilityForCalendar}
                allAvailabilities={calendarAllAvailabilities}
                compareMode={calendarCompareMode}
                compareAvailabilityA={compareAvailabilityA}
                compareAvailabilityB={compareAvailabilityB}
                comparePractitionerNames={comparePractitionerNames}
                comparePractitionerIdA={typeof comparePractitioners[0] === 'number' ? comparePractitioners[0] : null}
                comparePractitionerIdB={typeof comparePractitioners[1] === 'number' ? comparePractitioners[1] : null}
              />
            </div>

            {/* Select Option Modal — All users: double-click / drag-select on calendar */}
            <SelectOptionModal
              isOpen={showSelectOptionModal}
              onClose={handleSelectOptionClose}
              onSelectNewAppointment={handleSelectNewAppointment}
              onSelectBlockAppointment={handleSelectBlockAppointment}
            />

            {/* Appointment Modal — opened via SelectOptionModal "Create New Appointment" */}
            <AppointmentModal
              isOpen={showCreateAppointmentModal}
              onClose={() => { setShowCreateAppointmentModal(false); setPendingSlot(null); }}
              onCreated={() => {
                setShowCreateAppointmentModal(false);
                setPendingSlot(null);
                setAppointmentRefreshKey(prev => prev + 1);
              }}
              selectedSlot={pendingSlot}
              selectedClinicBranchId={selectedClinicBranch}
            />

            {/* Add Event Modal — opened via SelectOptionModal "Add Block Appointment" */}
            {(() => {
              const startH = pendingSlot ? String(pendingSlot.hour).padStart(2, '0') : '09';
              const startM = pendingSlot ? String(pendingSlot.minutes).padStart(2, '0') : '00';
              const endMin = pendingSlot
                ? pendingSlot.hour * 60 + pendingSlot.minutes + pendingSlot.duration
                : 600;
              const endH  = String(Math.floor(endMin / 60)).padStart(2, '0');
              const endMm = String(endMin % 60).padStart(2, '0');
              return (
                <AddEventModal
                  isOpen={showAddEventModal}
                  onClose={() => { setShowAddEventModal(false); setPendingSlot(null); }}
                  onCreated={(event) => {
                    setShowAddEventModal(false);
                    setPendingSlot(null);
                    handleEventCreated(event);
                  }}
                  selectedClinicBranchId={selectedClinicBranch}
                  initialDate={pendingSlot?.date}
                  initialTime={pendingSlot ? `${startH}:${startM}` : undefined}
                  initialEndTime={pendingSlot ? `${endH}:${endMm}` : undefined}
                  appointments={calendarAppointments}
                />
              );
            })()}

            {/* Event View Modal (for admin to view/edit/delete events) */}
            <EventViewModal
              isOpen={showEventViewModal}
              onClose={() => {
                setShowEventViewModal(false);
                setSelectedEvent(null);
              }}
              event={selectedEvent}
              onUpdated={handleEventUpdated}
              onDeleted={handleEventDeleted}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

// ─── MiniCalendar ─────────────────────────────────────────────────────────────

interface MiniCalendarProps {
  date: Date;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({ date, selectedDate, onDateSelect }) => {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthEnd   = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const startDay   = (monthStart.getDay() + 6) % 7;
  const daysInMonth = monthEnd.getDate();

  const weeks: (number | null)[][] = [];
  let days: (number | null)[] = [];

  for (let i = 0; i < startDay; i++) days.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
    if (days.length === 7) { weeks.push(days); days = []; }
  }
  if (days.length > 0) {
    while (days.length < 7) days.push(null);
    weeks.push(days);
  }

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="text-xs">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((d, i) => (
          <div key={i} className="text-center font-medium text-gray-500 py-1">{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
          {week.map((day, di) => {
            if (day === null) return <div key={di} className="aspect-square" />;
            const dayDate  = new Date(date.getFullYear(), date.getMonth(), day);
            const isSelected =
              selectedDate.getDate() === day &&
              selectedDate.getMonth() === date.getMonth() &&
              selectedDate.getFullYear() === date.getFullYear();
            const isToday =
              new Date().getDate() === day &&
              new Date().getMonth() === date.getMonth() &&
              new Date().getFullYear() === date.getFullYear();
            return (
              <button
                key={di}
                onClick={() => onDateSelect(dayDate)}
                className={`
                  aspect-square flex items-center justify-center rounded-md transition-all hover:bg-gray-100
                  ${isSelected ? 'bg-care-blue text-white hover:bg-care-blue/90' : ''}
                  ${isToday && !isSelected ? 'bg-care-blue/10 text-care-blue font-semibold' : ''}
                  ${!isSelected && !isToday ? 'text-gray-700' : ''}
                `}
              >
                {day}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};  