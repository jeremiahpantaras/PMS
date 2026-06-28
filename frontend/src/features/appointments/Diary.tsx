import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/features/dashboard/components/DashboardLayout';
import { ChevronLeft, ChevronRight, Filter, Building2 } from 'lucide-react';
import { Calendar } from './Calendar';
import { ArrivalsList } from './components/ArrivalsList';
import { EventViewModal } from './components/EventViewModal';
import { AddEventModal } from './components/AddEventModal';
import { AddNoteModal } from './components/AddNoteModal';
import { SelectOptionModal } from './components/SelectOptionModal';
import { AppointmentModal } from './components/AppointmentModal';
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { usePractitioners } from '@/features/clinics/hooks/usePractitioners';
import { useClinicBranches } from '@/features/clinics/hooks/useClinicBranches';
import { useAuthStore } from '@/store/auth.store';
import type { BlockAppointment, Appointment } from '@/types';
import type { PractitionerAvailability } from '@/features/clinics/clinic.api';
import { useRebookMode } from './hooks/useRebookMode';
import { createAppointment } from './appointment.api';
import type { CreateAppointmentData } from '@/types';
import toast from 'react-hot-toast';
import { PRACTITIONER_REMOVED_EVENT } from '@/events/practitionerEvents';

type CalendarView = 'day' | 'week' | 'month';

export const Diary: React.FC = () => {
  // Get user info early for role-based logic
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const effectiveRoles = (user?.roles && user.roles.length > 0) ? user.roles : (user?.role ? [user.role] : []);
  const isAdmin        = effectiveRoles.includes('ADMIN');
  const isPractitioner = effectiveRoles.includes('PRACTITIONER');
  const isStaff        = effectiveRoles.includes('STAFF');
  const isManager      = user?.is_manager || false;

  const isRestrictedPractitioner = isPractitioner && !isAdmin && !isManager;
  const practitionerBranchIds = useMemo(() => {
    if (!isRestrictedPractitioner) return null;
    return (user?.manager_branches || []).map((b: any) => b.id);
  }, [isRestrictedPractitioner, user?.manager_branches]);
  // ── Rebook Mode ──────────────────────────────────────────────────
  const { rebookMode, rebookData, startRebook, exitRebook } = useRebookMode();

  // Change body cursor to crosshair while in rebook mode
  useEffect(() => {
    document.body.style.cursor = rebookMode ? 'crosshair' : '';
    return () => { document.body.style.cursor = ''; };
  }, [rebookMode]);

  // ESC key exits rebook mode
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && rebookMode) exitRebook();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [rebookMode, exitRebook]);

  const [currentDate, setCurrentDate] = useState(new Date());
  // Default to week view for practitioners / staff
  const [view, setView] = useState<CalendarView>('week');
  const [selectedPractitioner, setSelectedPractitioner] = useState<number | string | null>(null);
  const [selectedClinicBranch, setSelectedClinicBranch] = useState<number | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [calendarReadyDate, setCalendarReadyDate] = useState<Date | null>(null);
  const [isCalendarLive, setIsCalendarLive] = useState(false);

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

  // Only show users with PRACTITIONER in their roles[] in filter dropdowns.
  // STAFF-only entries remain in the full `practitioners` list so their own
  // schedule can be cached, but they must not appear in the selection UI.
  const practitionerOptions = useMemo(
    () => practitioners.filter(p =>
      (p.roles ?? []).includes('PRACTITIONER') || p.role === 'PRACTITIONER'
    ),
    [practitioners],
  );

  // Cache the logged-in user's availability AND branch assignment so they
  // survive branch switches (switching tabs refetches practitioners for that branch,
  // losing data about the user's home branch).
  const [cachedOwnAvailability, setCachedOwnAvailability] = useState<PractitionerAvailability | null>(null);
  const [cachedOwnBranchId, setCachedOwnBranchId] = useState<number | null>(null);
  // The practitioner-list id of the logged-in user's own entry (e.g. Practitioner pk or 'staff-{id}')
  const [cachedOwnId, setCachedOwnId] = useState<number | string | null>(null);

  // Single effect: cache own availability + home branch, and auto-navigate to it.
  // Re-runs whenever the practitioners list changes (including after a refetch caused
  // by a branch reassignment), so the calendar always reflects the latest assignment.
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
    if (!own) {
      // Own practitioner record no longer exists in the list — either the
      // PRACTITIONER role was removed or the profile was soft-deleted.
      // Reset all own-practitioner cached state so the UI stops treating
      // this user as a practitioner (availability overlay, "My Schedule"
      // label, compare-mode eligibility, etc.).
      if (cachedOwnId != null) {
        setCachedOwnAvailability(null);
        setCachedOwnBranchId(null);
        setCachedOwnId(null);
        hasAutoSelectedBranch.current = false;
        // If the calendar was filtering on our (now-removed) practitioner
        // id, clear that filter so no stale schedule is shown.
        setSelectedPractitioner(prev =>
          prev === cachedOwnId ? null : prev
        );
      }
      return;
    }

    if (own.availability) setCachedOwnAvailability(own.availability);
    if (cachedOwnId == null) setCachedOwnId(own.id);

    // ── Branch-change detection ────────────────────────────────────────────
    // Compare the practitioner's current branch with what we last cached.
    // When they differ (branch reassignment, or "All Branches" toggle), reset
    // the auto-select guard so the calendar snaps to the new scope immediately.
    let currentBranchId = own.clinic_branch_id ?? null;
    if (isRestrictedPractitioner && practitionerBranchIds && practitionerBranchIds.length > 0) {
      // If the currently assigned branch is null or not in the allowed list, default to the first allowed branch
      if (currentBranchId == null || !practitionerBranchIds.includes(currentBranchId)) {
        currentBranchId = practitionerBranchIds[0];
      }
    }

    if (currentBranchId !== cachedOwnBranchId) {
      setCachedOwnBranchId(currentBranchId);
      hasAutoSelectedBranch.current = false; // allow re-selection on next check
    }

    if (currentBranchId != null) {
      // Branch-assigned: navigate to that branch tab.
      if (!hasAutoSelectedBranch.current) {
        hasAutoSelectedBranch.current = true;
        setSelectedClinicBranch(currentBranchId);
        setSelectedPractitioner(own.id);
      }
    } else {
      // All-branches practitioner (e.g. Admin+Practitioner with no branch).
      // Explicitly reset to the All Branches tab so switching away from a
      // previously-cached specific branch actually takes effect.
      if (!hasAutoSelectedBranch.current) {
        hasAutoSelectedBranch.current = true;
        setSelectedClinicBranch(null);
        setSelectedPractitioner(own.id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPractitioner, isStaff, user?.practitioner_id, user?.id, practitioners]);

  // ── Stale-selection guard ──────────────────────────────────────────────────
  // After every practitioners list change (e.g. post-refetch following a role
  // removal), check whether the currently selected practitioner is still in the
  // list.  If they've been removed (PRACTITIONER role revoked) clear the filter
  // immediately so the calendar doesn't keep rendering stale duty-hour shading.
  //
  // IMPORTANT: exempt the logged-in practitioner's own ID (cachedOwnId) from
  // being cleared here.  When a branch tab is selected, usePractitioners refetches
  // for that branch and the own practitioner may temporarily be absent from the
  // list (e.g. Admin+Practitioner with no branch, or slow network).  The main
  // useEffect above will always restore the correct selection; clearing it here
  // causes a race that leaves the filter stuck on "Show All".
  useEffect(() => {
    if (selectedPractitioner == null) return;
    // Never auto-clear the logged-in practitioner's own entry — the primary
    // init effect owns that state and will correct it if needed.
    if (cachedOwnId != null && selectedPractitioner === cachedOwnId) return;
    const stillPresent = practitioners.some(p => p.id === selectedPractitioner);
    if (!stillPresent) {
      setSelectedPractitioner(null);
    }
  }, [practitioners, selectedPractitioner, cachedOwnId]);

  // ── Route / State Protection Guard ───────────────────────────────────────────
  // Prevent restricted practitioners from accessing "All Branches" (null).
  // If they somehow bypass the UI, immediately force them to their first assigned branch.
  useEffect(() => {
    if (isRestrictedPractitioner && selectedClinicBranch === null) {
      if (practitionerBranchIds && practitionerBranchIds.length > 0) {
        // Reset compare mode and switch to first assigned branch
        setSelectedClinicBranch(practitionerBranchIds[0]);
        setCompareMode(false);
        setComparePractitioners([null, null]);
        
        // Restore own practitioner context if applicable
        if (cachedOwnBranchId === practitionerBranchIds[0]) {
          setSelectedPractitioner(cachedOwnId);
        } else {
          setSelectedPractitioner(null);
        }
      }
    }
  }, [isRestrictedPractitioner, selectedClinicBranch, practitionerBranchIds, cachedOwnBranchId, cachedOwnId]);

  // True when the currently selected branch tab is the user's "own" clinic:
  // - Branch-assigned practitioner/staff: their home branch tab is active.
  // - All-branches practitioner (e.g. Admin+Practitioner with no branch): the
  //   "All Branches" tab (null) is considered their home view.
  const isOwnAssignedClinic =
    (isPractitioner || isStaff) && (
      (cachedOwnBranchId !== null && selectedClinicBranch === cachedOwnBranchId) ||
      (cachedOwnBranchId === null  && selectedClinicBranch === null)
    );

  // Compute the availability to pass to Calendar
  const practitionerAvailabilityForCalendar = useMemo(() => {
    if (!selectedPractitioner) {
      // No explicit practitioner filter — overlay own schedule only when on the
      // user's home tab.  For branch-assigned Admin+Practitioners browsing a
      // different branch, isOwnAssignedClinic is false, so we return undefined
      // and the calendar renders without their availability shading.
      if (isPractitioner && cachedOwnAvailability && isOwnAssignedClinic) return cachedOwnAvailability;
      return undefined;
    }

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
  }, [selectedPractitioner, practitioners, isPractitioner, isStaff, cachedOwnAvailability, isOwnAssignedClinic]);

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
    if (view === 'month') {
      setView('day');
      // Entering Day View from mini-calendar: clear practitioner filter so
      // divided columns are the primary display on a specific branch.
      // Exception: preserve the logged-in practitioner's own filter — they
      // always view their own schedule regardless of Day View split mode.
      if (selectedClinicBranch !== null && !cachedOwnId) setSelectedPractitioner(null);
    }
  }, [view, selectedClinicBranch, cachedOwnId]);

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
      // Branch-assigned: restore own practitioner filter on home branch, clear elsewhere.
      if (branchId === cachedOwnBranchId) {
        setSelectedPractitioner(cachedOwnId);
      } else {
        setSelectedPractitioner(null);
      }
    } else if ((isPractitioner || isStaff) && cachedOwnBranchId === null) {
      // All-branches practitioner (e.g. Admin+Practitioner with no branch assignment):
      // restore own selection when returning to "All Branches" tab; clear on specific
      // branch tabs (they won't be in the branch-filtered practitioner list anyway).
      if (branchId === null) {
        setSelectedPractitioner(cachedOwnId);
      } else {
        setSelectedPractitioner(null);
      }
    } else {
      // Admin-only: always clear filter when switching branches
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
    practitionerId?: number | null;
  } | null>(null);
  // Appointment creation (from SelectOptionModal "Create New Appointment")
  const [showCreateAppointmentModal, setShowCreateAppointmentModal] = useState(false);
  // Block appointment creation (from SelectOptionModal "Add Block Appointment")
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  // Note creation (from SelectOptionModal "Add Note")
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
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

  // ── Practitioner removal → force immediate calendar refetch ───────────────────────
  // CreateStaffAccountModal emits PRACTITIONER_REMOVED_EVENT after the admin
  // confirms the role removal.  We increment both refresh keys here so
  // Calendar.tsx immediately calls refetch() + refetchBlockAppointments(),
  // clearing all stale appointment/block-out/note data from the calendar view
  // without requiring a page reload.
  useEffect(() => {
    const handlePractitionerRemoved = () => {
      // Invalidate ALL practitioner-related queries (any branchId)
      queryClient.invalidateQueries({ queryKey: ['practitioners'] });
      // Force immediate refetch of all practitioner queries
      queryClient.refetchQueries({ queryKey: ['practitioners'] });
      // Force-refetch appointments and block-outs
      setAppointmentRefreshKey(prev => prev + 1);
      setEventRefreshKey(prev => prev + 1);
    };
    window.addEventListener(PRACTITIONER_REMOVED_EVENT, handlePractitionerRemoved);
    return () => {
      window.removeEventListener(PRACTITIONER_REMOVED_EVENT, handlePractitionerRemoved);
    };
  }, [queryClient]);

  // ── Force Calendar refetch when appointment count changes (add/remove) ──────
  // Note: arrival_status changes are handled directly in Calendar.tsx's onUpdated
  // callback, which calls refetch() immediately when arrival_status differs.
  // This effect now only triggers a refetch for count changes (added/deleted
  // appointments), avoiding a double-refetch race condition for status updates.
  const prevCalendarAppointmentsRef = useRef<Appointment[]>([]);
  useEffect(() => {
    const prev = prevCalendarAppointmentsRef.current;
    // Only refetch when the count changes (an appointment was added or removed).
    // Status/color changes are handled by Calendar's onUpdated handler directly.
    const countChanged = calendarAppointments.length !== prev.length;

    if (countChanged && prev.length > 0) {
      setAppointmentRefreshKey((k) => k + 1);
    }
    prevCalendarAppointmentsRef.current = calendarAppointments;
  }, [calendarAppointments]);

  // ── Slot action (double-click or drag-select) → SelectOptionModal ──────
  // Available to all users: Admin, Practitioner, Staff
  const [anchorRect, setAnchorRect] = useState<DOMRect | undefined>();
  const handleSlotAction = useCallback((slot: {
    date: Date; time: string; hour: number; minutes: number; duration: number;
    practitionerId?: number | null;
  }, rect?: DOMRect) => {
    // In rebook mode, immediately create the appointment on this slot
    if (rebookMode && rebookData) {
      void handleRebookDrop(slot);
      return;
    }
    setAnchorRect(rect);
    setPendingSlot(slot);
    setShowSelectOptionModal(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebookMode, rebookData]);

  // ── handleRebookDrop — creates a new appointment at the given slot using rebook data ──
  const handleRebookDrop = async (slot: {
    date: Date; hour: number; minutes: number; practitionerId?: number | null;
  }) => {
    if (!rebookData || !user) return;
    const { hour, minutes } = slot;
    const endTotalMins = hour * 60 + minutes + rebookData.duration_minutes;
    const endH = Math.floor(endTotalMins / 60);
    const endM = endTotalMins % 60;
    const clinicId = selectedClinicBranch ?? user.clinic ?? 0;
    const data: CreateAppointmentData = {
      clinic:           clinicId as number,
      patient:          rebookData.patient,
      practitioner:     slot.practitionerId ?? rebookData.practitioner ?? undefined,
      service:          rebookData.service ?? undefined,
      appointment_type: rebookData.appointment_type,
      date:             format(slot.date, 'yyyy-MM-dd'),
      start_time:       `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      end_time:         `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
      duration_minutes: rebookData.duration_minutes,
      chief_complaint:  rebookData.chief_complaint,
      notes:            rebookData.notes,
      patient_notes:    rebookData.patient_notes,
    };
    try {
      await createAppointment(data);
      setAppointmentRefreshKey(prev => prev + 1);
      toast.success(`Rebooked for ${format(slot.date, 'MMM d')} at ${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
      exitRebook();
    } catch (err: unknown) {
      const detail = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : undefined;
      toast.error(detail ?? 'Failed to rebook appointment');
    }
  };

  // ── Effective Practitioner ID for Week View ──────────────────────────────────
  // When a PRACTITIONER is logged in and no filter is applied in Week View,
  // ownership should automatically default to the logged-in practitioner rather
  // than falling back to branch-wide (null).  Admin and Day View are unaffected.
  //
  //   Priority 1: selectedPractitioner (explicit filter dropdown choice)
  //   Priority 2: cachedOwnId          (logged-in practitioner, Week View only)
  //   Fallback:   null                 (branch-wide — Admin / Staff / no prac)
  const loggedInPractitionerNumericId: number | null =
    isPractitioner && typeof cachedOwnId === 'number' ? cachedOwnId : null;

  const effectivePractitionerId: number | null = useMemo(() => {
    // If an explicit filter is active, respect it regardless of view.
    if (selectedPractitioner != null) {
      return typeof selectedPractitioner === 'number' ? selectedPractitioner : null;
    }
    // In Week View, a PRACTITIONER with no filter selected defaults to themselves.
    if (view === 'week' && loggedInPractitionerNumericId != null) {
      return loggedInPractitionerNumericId;
    }
    // Admin / Staff / Month / Day View — keep null (branch-wide or slot-column-based).
    return null;
  }, [selectedPractitioner, view, loggedInPractitionerNumericId]);

  const calendarCompareMode = useMemo(
    () => (isAdmin || isPractitioner || isStaff) && compareMode && !isDuplicateComparePractitioner && (view === 'day' || view === 'week'),
    [isAdmin, isPractitioner, isStaff, compareMode, isDuplicateComparePractitioner, view],
  );

  // Day View + specific branch = multi-practitioner split column mode.
  // Active when no practitioner filter is applied: selecting a practitioner
  // exits split mode and renders a solo view for that practitioner only.
  const isDayBranchSplit = useMemo(
    () => view === 'day' && selectedClinicBranch !== null && !calendarCompareMode && practitionerOptions.length > 0 && !selectedPractitioner,
    [view, selectedClinicBranch, calendarCompareMode, practitionerOptions, selectedPractitioner],
  );

  const handleSelectOptionClose = () => {
    setShowSelectOptionModal(false);
    setPendingSlot(null);
    setSelectedPatientId(null);
  };

  const handleSelectNewAppointment = (patientId: number) => {
    setSelectedPatientId(patientId);
    setShowSelectOptionModal(false);
    setShowCreateAppointmentModal(true);
  };

  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  const getPractitionerName = useMemo(() => {
    if (!pendingSlot?.practitionerId) return undefined;
    const prac = practitioners.find(p => p.id == pendingSlot.practitionerId);
    return prac?.name;
  }, [pendingSlot, practitioners]);

  const handleSelectBlockAppointment = () => {
    if (!pendingSlot) return;
    setShowSelectOptionModal(false);
    setShowAddEventModal(true);
  };

  const handleSelectNote = () => {
    setShowSelectOptionModal(false);
    setShowAddNoteModal(true);
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
                onClick={() => {
                  if (!isRestrictedPractitioner) handleClinicBranchSelect(null);
                }}
                disabled={loadingBranches || isRestrictedPractitioner}
                title={isRestrictedPractitioner ? "Practitioners can only view their assigned branches." : undefined}
                className={`
                  relative flex items-center gap-2 px-6 py-3 text-sm font-medium whitespace-nowrap
                  transition-all duration-200 border-b-2
                  ${selectedClinicBranch === null
                    ? 'bg-white text-care-blue border-care-blue shadow-sm'
                    : 'bg-transparent text-steady-slate border-transparent hover:text-trust-harbor hover:bg-gray-100/50'
                  }
                  ${(loadingBranches || isRestrictedPractitioner) ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}
                `}
              >
                <Building2 className="w-4 h-4" />
                <span>All Branches</span>
              </button>

              {/* Individual Branch Tabs */}
              {branches.map((branch) => {
                const isUnauthorized = isRestrictedPractitioner && practitionerBranchIds && !practitionerBranchIds.includes(branch.id);
                
                return (
                  <button
                    key={branch.id}
                    onClick={() => {
                      if (!isUnauthorized) handleClinicBranchSelect(branch.id);
                    }}
                    disabled={loadingBranches || isUnauthorized}
                    className={`
                      relative flex items-center gap-2 px-6 py-3 text-sm font-medium whitespace-nowrap
                      transition-all duration-200 border-b-2
                      ${selectedClinicBranch === branch.id
                        ? 'bg-white text-care-blue border-care-blue shadow-sm'
                        : 'bg-transparent text-steady-slate border-transparent hover:text-trust-harbor hover:bg-gray-100/50'
                      }
                      ${(loadingBranches || isUnauthorized) ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}
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
                );
              })}
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
                            : selectedPractitioner
                              ? practitioners.find(p => p.id === selectedPractitioner)?.name || 'Practitioner'
                              : 'Show All'
                          }
                        </button>

                        {showFilterDropdown && !loadingPractitioners && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
                            <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-80 overflow-y-auto">

                              {selectedClinicBranch && (
                                <div className="px-4 py-2 bg-care-blue/10 border-b border-care-blue/20">
                                  <p className="text-xs font-semibold text-care-blue">
                                    Showing practitioners for: {selectedBranchName}
                                  </p>
                                </div>
                              )}

                              {/* Show All option — displays all practitioners in current branch */}
                              <button
                                onClick={() => handlePractitionerSelect(null)}
                                className={`
                                  w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors
                                  ${selectedPractitioner === null
                                    ? 'bg-care-blue/10 text-care-blue font-semibold'
                                    : 'text-gray-700'
                                  }
                                `}
                              >
                                <div className="flex items-center justify-between">
                                  <span>Show All</span>
                                  {selectedPractitioner === null && (
                                    <span className="text-care-blue text-base">✓</span>
                                  )}
                                </div>
                              </button>

                              {/* My Schedule option — for practitioners viewing their own clinic */}
                              {(isPractitioner || isStaff) && isOwnAssignedClinic && cachedOwnId && (
                                <>
                                  <div className="border-t border-gray-200" />
                                  <button
                                    onClick={() => handlePractitionerSelect(cachedOwnId)}
                                    className={`
                                      w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors
                                      ${selectedPractitioner === cachedOwnId
                                        ? 'bg-care-blue/10 text-care-blue font-semibold'
                                        : 'text-gray-700'
                                      }
                                    `}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span>My Schedule</span>
                                      {selectedPractitioner === cachedOwnId && (
                                        <span className="text-care-blue text-base">✓</span>
                                      )}
                                    </div>
                                  </button>
                                </>
                              )}

                              {practitionerOptions.length === 0 ? (
                                <div className="px-4 py-6 text-sm text-gray-500 text-center">
                                  <p className="font-medium">No practitioners found</p>
                                  {selectedClinicBranch && (
                                    <p className="text-xs mt-1 text-gray-400">
                                      No staff assigned to this branch yet.
                                    </p>
                                  )}
                                </div>
                              ) : (
                                practitionerOptions.map((practitioner) => (
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
                                {practitionerOptions.map((p) => (
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
                                {practitionerOptions.map((p) => (
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

                    {/* Clear/Show All button outside dropdown:
                        - Day View + specific branch: show 'Show All' to restore divided columns
                        - Week/Month View: hidden since "Show All" is now in dropdown */}
                    {!compareMode && selectedPractitioner !== null && view === 'day' && selectedClinicBranch !== null && (
                      <button
                        onClick={() => {
                          setSelectedPractitioner(null);
                          setShowFilterDropdown(false);
                        }}
                        className="text-xs text-care-blue hover:text-trust-harbor font-medium"
                      >
                        Show All
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
                        // Entering Day View: clear practitioner filter so divided
                        // columns are the primary display on a specific branch.
                        // Entering Day View: clear practitioner filter to enable split-column
                        // mode for admins.  Preserve the logged-in practitioner's own filter
                        // so they always see their own schedule (not the split-column layout).
                        if (v === 'day' && selectedClinicBranch !== null && !cachedOwnId) setSelectedPractitioner(null);
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

                {/* Live status indicator */}
                {isCalendarLive && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Live
                  </span>
                )}
              </div>
            </div>

            {/* Calendar */}
            <div className="flex-1 overflow-hidden p-4 bg-clinical-cloud">
              <Calendar
                view={view}
                currentDate={currentDate}
                onDateChange={handleDateChange}
                selectedPractitionerId={isDayBranchSplit || compareMode ? null : selectedPractitioner}
                selectedClinicBranchId={selectedClinicBranch}
                refreshKey={eventRefreshKey}
                appointmentRefreshKey={appointmentRefreshKey}
                onRecurringCreated={handleRecurringCreated}
                onEventClick={handleEventClick}
                onSlotAction={handleSlotAction}
                onAppointmentsReady={setCalendarAppointments}
                onCalendarReady={setCalendarReadyDate}
                onLiveStatusChange={setIsCalendarLive}
                practitionerAvailability={compareMode ? undefined : practitionerAvailabilityForCalendar}
                allAvailabilities={calendarAllAvailabilities}
                compareMode={calendarCompareMode}
                compareAvailabilityA={compareAvailabilityA}
                compareAvailabilityB={compareAvailabilityB}
                comparePractitionerNames={comparePractitionerNames}
                comparePractitionerIdA={typeof comparePractitioners[0] === 'number' ? comparePractitioners[0] : null}
                comparePractitionerIdB={typeof comparePractitioners[1] === 'number' ? comparePractitioners[1] : null}
                onRebook={startRebook}
                rebookMode={rebookMode}
                rebookPreviewLabel={
                  rebookData
                    ? `${rebookData.patient_name}${
                        rebookData.service_name ? ` · ${rebookData.service_name}` : ''
                      } · ${rebookData.duration_minutes} min`
                    : undefined
                }
                multiPractitioners={
                  isDayBranchSplit
                    ? practitionerOptions.map(p => ({
                        id: p.id,
                        name: p.name,
                        specialization: p.specialization ?? null,
                        availability: p.availability,
                      }))
                    : undefined
                }
              />
            </div>

            {/* Select Option Modal — All users: double-click / drag-select on calendar */}
            <SelectOptionModal
              isOpen={showSelectOptionModal}
              onClose={handleSelectOptionClose}
              onSelectNewAppointment={handleSelectNewAppointment}
              onSelectBlockAppointment={handleSelectBlockAppointment}
              onSelectNote={handleSelectNote}
              pendingSlot={pendingSlot}
              practitionerName={getPractitionerName}
              anchorRect={anchorRect}
            />

            {/* Appointment Modal — opened via SelectOptionModal "Create New Appointment" */}
            <AppointmentModal
              isOpen={showCreateAppointmentModal}
              onClose={() => { setShowCreateAppointmentModal(false); setPendingSlot(null); setSelectedPatientId(null); }}
              onCreated={() => {
                setShowCreateAppointmentModal(false);
                setPendingSlot(null);
                setSelectedPatientId(null);
                setAppointmentRefreshKey(prev => prev + 1);
              }}
              selectedSlot={pendingSlot}
              selectedClinicBranchId={selectedClinicBranch}
              defaultPatientId={selectedPatientId}
              defaultPractitionerId={
                // Priority 1: slot-column practitionerId (Day View split columns)
                pendingSlot?.practitionerId !== undefined
                  ? pendingSlot.practitionerId
                  // Priority 2: effectivePractitionerId encodes:
                  //   - explicit filter when active (any view)
                  //   - logged-in practitioner in Week View (no filter selected)
                  //   - null otherwise
                  // Priority 3: loggedInPractitionerNumericId covers Month View and
                  //   Day View (no split) where effectivePractitionerId is null but
                  //   the calendar still displays the logged-in practitioner's schedule.
                  //   null for admins who are not practitioners — their Show All
                  //   behavior (empty practitioner field) is preserved.
                  : (effectivePractitionerId ?? loggedInPractitionerNumericId)
              }
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
                  practitionerId={
                    // Slot-column practitionerId takes first priority (Day View split columns).
                    // Fall back to effectivePractitionerId which handles Week View
                    // practitioner-identity-from-logged-in-user when filter is empty.
                    pendingSlot?.practitionerId ?? effectivePractitionerId
                  }
                />
              );
            })()}

            {/* Add Note Modal — opened via SelectOptionModal "Add Note" */}
            {(() => {
              const startH = pendingSlot ? String(pendingSlot.hour).padStart(2, '0') : '09';
              const startM = pendingSlot ? String(pendingSlot.minutes).padStart(2, '0') : '00';
              const endMin = pendingSlot
                ? pendingSlot.hour * 60 + pendingSlot.minutes + Math.max(pendingSlot.duration, 30)
                : 600;
              const endH  = String(Math.floor(endMin / 60)).padStart(2, '0');
              const endMm = String(endMin % 60).padStart(2, '0');
              return (
                <AddNoteModal
                  isOpen={showAddNoteModal}
                  onClose={() => { setShowAddNoteModal(false); setPendingSlot(null); }}
                  onCreated={() => {
                    setShowAddNoteModal(false);
                    setPendingSlot(null);
                    // WS NOTE_CREATED event will update calendar state automatically
                  }}
                  selectedClinicBranchId={selectedClinicBranch}
                  initialDate={pendingSlot?.date}
                  initialTime={pendingSlot ? `${startH}:${startM}` : undefined}
                  initialEndTime={pendingSlot ? `${endH}:${endMm}` : undefined}
                  practitionerId={
                    // Slot-column practitionerId takes first priority (Day View split columns).
                    // Fall back to effectivePractitionerId which handles Week View
                    // practitioner-identity-from-logged-in-user when filter is empty.
                    pendingSlot?.practitionerId ?? effectivePractitionerId
                  }
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

      {/* ── Rebook Mode floating banner ── */}
      {rebookMode && rebookData && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10000 flex items-center gap-3 bg-emerald-700 text-white px-5 py-3 rounded-full shadow-2xl border border-emerald-500 select-none animate-fade-in">
          <span className="text-lg">🔁</span>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-sm">{rebookData.patient_name}</span>
            <span className="text-xs text-emerald-200">
              {rebookData.service_name
                ? `${rebookData.service_name} · ${rebookData.duration_minutes} min`
                : `${rebookData.duration_minutes} min`}
              {' · '}Click a slot to rebook · ESC to cancel
            </span>
          </div>
          <button
            onClick={exitRebook}
            className="ml-2 px-3 py-1 rounded-full bg-white text-emerald-800 text-xs font-bold hover:bg-emerald-50 transition-colors"
          >
            Done
          </button>
        </div>
      )}
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