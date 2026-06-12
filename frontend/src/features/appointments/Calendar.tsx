import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Globe } from 'lucide-react';
import {
  format, startOfWeek, addDays,
  startOfMonth, endOfMonth, endOfWeek,
  isSameMonth, isSameDay,
} from 'date-fns';
import { useAppointmentModal }   from './hooks/useAppointmentModal';
import { useDragSelection }      from './hooks/useDragSelection';
import { useCalendarData }       from './hooks/useCalendarData.ts';
import { useCalendarSocket }     from './hooks/useCalendarSocket';
import { useBlockHover }         from './hooks/useBlockHover';
import { useNoteHover }          from './hooks/useNoteHover';
import { useNoteDrag }           from './hooks/useNoteDrag';
import { useResize }             from './hooks/useResize';
import { useAppointmentDrag }    from './hooks/useAppointmentDrag';
import { useBlockAppointmentDrag } from './hooks/useBlockAppointmentDrag';
import { useAppointmentHover }   from './hooks/useAppointmentHover';
import { useBlockConflictDetection } from './hooks/useBlockConflictDetection';
import { AppointmentModal }      from './components/AppointmentModal';
import { AppointmentView }       from './components/AppointmentView';
import { DayStatsBlock }         from './components/DayStatsBlock';
import { AppointmentHoverCard }  from './components/AppointmentHoverCard';
import { BlockHoverCard }        from './components/BlockHoverCard';
import { NoteHoverCard }         from './components/NoteHoverCard';
import { NoteModal }             from './components/NoteModal';
import { ConflictModal }         from './components/ConflictModal';
import { APPOINTMENT_STATUS_COLORS } from '@/types';
import type { Appointment, BlockAppointment, CalendarNote } from '@/types';
import { rescheduleAppointment }      from './appointment.api';
import { updateBlockAppointment }     from './appointment.api';
import { updateCalendarNote }         from './appointment.api';
import toast                          from 'react-hot-toast';
import type { PractitionerAvailability, DutyDay } from '@/features/clinics/clinic.api';

type CalendarView = 'day' | 'week' | 'month';

const DAY_MAP: Record<number, DutyDay> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const formatTime12Hour = (time: string): string => {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${h12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// ── Module-level availability evaluator for compare mode ──────────────────────
// Evaluates a single slot against an explicit availability object.
// Used by renderTimeSlotCompare so each column can have its own availability.
const evalSlotAvailability = (
  slot: { hour: number; minutes: number },
  date: Date,
  avail: PractitionerAvailability | undefined,
): { isAvailable: boolean; isLunch: boolean; dayAvailable: boolean } => {
  if (!avail) return { isAvailable: true, isLunch: false, dayAvailable: true };
  const dayOfWeek = DAY_MAP[date.getDay()];
  const dayAvailable = avail.duty_days.includes(dayOfWeek);
  if (!dayAvailable) return { isAvailable: false, isLunch: false, dayAvailable: false };

  const slotMins   = slot.hour * 60 + slot.minutes;
  const lunchStart = timeToMinutes(avail.lunch_start_time);
  const lunchEnd   = timeToMinutes(avail.lunch_end_time);
  const isLunch    = slotMins >= lunchStart && slotMins < lunchEnd;

  // ── Split-shift mode: check against duty_schedule blocks ──────────────────
  if (avail.duty_schedule) {
    const blocks = avail.duty_schedule[dayOfWeek] ?? [];
    if (blocks.length === 0) return { isAvailable: false, isLunch: false, dayAvailable: true };
    const inAnyBlock = blocks.some(
      b => slotMins >= timeToMinutes(b.start) && slotMins < timeToMinutes(b.end),
    );
    return { isAvailable: inAnyBlock && !isLunch, isLunch: isLunch && inAnyBlock, dayAvailable: true };
  }

  // ── Legacy single-block mode ───────────────────────────────────────────────
  const dutyStart = timeToMinutes(avail.duty_start_time);
  const dutyEnd   = timeToMinutes(avail.duty_end_time);
  if (slotMins < dutyStart || slotMins >= dutyEnd) return { isAvailable: false, isLunch: false, dayAvailable: true };
  return { isAvailable: !isLunch, isLunch, dayAvailable: true };
};

interface CalendarProps {
  view:                   CalendarView;
  currentDate:            Date;
  onDateChange:           (date: Date) => void;
  selectedPractitionerId: number | string | null;
  selectedClinicBranchId: number | null;
  refreshKey?: number;
  onEventClick?: (event: BlockAppointment) => void;
  onAppointmentsReady?: (appointments: Appointment[]) => void;
  onCalendarReady?: (date: Date) => void;
  practitionerAvailability?: PractitionerAvailability;
  /** Full availability map for ALL practitioners: { practitionerId: availability } */
  allAvailabilities?: Record<number, PractitionerAvailability>;
  // ── Compare Mode (Admin only, Day/Week views) ───────────────────────────
  compareMode?: boolean;
  compareAvailabilityA?: PractitionerAvailability;
  compareAvailabilityB?: PractitionerAvailability;
  comparePractitionerNames?: [string, string];
  comparePractitionerIdA?: number | null;
  comparePractitionerIdB?: number | null;
  /** Admin-only: intercept double-click / drag-select instead of opening AppointmentModal internally */
  onSlotAction?: (slot: { date: Date; time: string; hour: number; minutes: number; duration: number; practitionerId?: number | null }, anchorRect?: DOMRect) => void;
  /** Increment to trigger a refetch of appointments (e.g. after creating one from outside Calendar) */
  appointmentRefreshKey?: number;
  /** Called after recurring appointments are saved, so parent can trigger a refetch */
  onRecurringCreated?: () => void;
  /** Called when the real-time WebSocket connection status changes. */
  onLiveStatusChange?: (isLive: boolean) => void;
  /** Called when the user clicks "Rebook Appointment" in AppointmentView. */
  onRebook?: (appointment: Appointment) => void;
  /** When true, changes cursor to crosshair and shows rebook ghost on hover. */
  rebookMode?: boolean;
  /** Label shown in the rebook ghost tooltip (patient + service). */
  rebookPreviewLabel?: string;
  /** Multi-practitioner list for Day View split-column layout.
   * When provided with 1+ entries and no specific practitioner filter,
   * Day View renders one column per practitioner. */
  multiPractitioners?: Array<{
    id: number | string;
    name: string;
    specialization: string | null;
    availability?: PractitionerAvailability;
  }>;
}

// isColorDark / hexToRgba removed — replaced by solid color styling

// Colour palette for multi-practitioner day-view column headers (cycles if >8 practitioners)
const COL_HEADER_COLORS = [
  { bg: 'bg-sky-50',     text: 'text-sky-700',     sub: 'text-sky-500'     },
  { bg: 'bg-violet-50',  text: 'text-violet-700',   sub: 'text-violet-500'  },
  { bg: 'bg-emerald-50', text: 'text-emerald-700',  sub: 'text-emerald-500' },
  { bg: 'bg-amber-50',   text: 'text-amber-700',    sub: 'text-amber-500'   },
  { bg: 'bg-rose-50',    text: 'text-rose-700',     sub: 'text-rose-500'    },
  { bg: 'bg-indigo-50',  text: 'text-indigo-700',   sub: 'text-indigo-500'  },
  { bg: 'bg-teal-50',    text: 'text-teal-700',     sub: 'text-teal-500'    },
  { bg: 'bg-orange-50',  text: 'text-orange-700',   sub: 'text-orange-500'  },
];

type BlockColors =
  | { useHex: true;  hex: string; bgStyle: React.CSSProperties; textColor: string; subTextColor: string; label: string | null; }
  | { useHex: false; hex: null;   bg: string; border: string; text: string; label: string | null; };

// ── Drag Ghost Overlay ────────────────────────────────────────────────────────
interface DragGhostProps {
  appointment: Appointment;
  position:    { x: number; y: number };
}

interface CalendarSlot {
  hour: number;
  quarter: number;
  minutes: number;
  label: string;
  time: string;
  isLunchBreak: boolean;
}

const DragGhost: React.FC<DragGhostProps> = ({ appointment, position }) => (
  <div
    className="fixed pointer-events-none z-[9999] opacity-90 shadow-2xl"
    style={{
      left:      position.x - 80,
      top:       position.y - 20,
      width:     160,
      transform: 'rotate(2deg)',
    }}
  >
    <div className="bg-sky-500 text-white rounded-lg px-3 py-2 text-xs font-semibold shadow-lg border-2 border-sky-300">
      <div className="truncate">{appointment.patient_name}</div>
      <div className="text-sky-200 mt-0.5 truncate">
        {formatTime12Hour(appointment.start_time)} · {appointment.service_name ?? appointment.appointment_type}
      </div>
      <div className="mt-1 flex items-center gap-1 text-sky-100">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Drop to reschedule
      </div>
    </div>
  </div>
);

// ── Overlap-aware column layout ───────────────────────────────────────────────
// Given appointments and block appointments for one day/column, assigns each
// item a left/right style so overlapping items are displayed side-by-side
// within a single calendar column (no extra grid columns needed).
const computeColumnLayout = (
  apts:   { id: number; start_time: string; end_time: string }[],
  blocks: { id: number; start_time: string; end_time: string }[],
  notes:  { id: number; start_time: string; end_time: string }[] = [],
): {
  aptStyles:   Map<number, { left: string; right: string }>;
  blockStyles: Map<number, { left: string; right: string }>;
  noteStyles:  Map<number, { left: string; right: string }>;
} => {
  const t2m = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  type LItem = { id: number; type: 'apt' | 'block' | 'note'; start: number; end: number };

  const items: LItem[] = [
    ...apts.map(a   => ({ id: a.id, type: 'apt'   as const, start: t2m(a.start_time), end: t2m(a.end_time) })),
    ...blocks.map(b => ({ id: b.id, type: 'block' as const, start: t2m(b.start_time), end: t2m(b.end_time) })),
    ...notes.map(n  => ({ id: n.id, type: 'note'  as const, start: t2m(n.start_time), end: t2m(n.end_time) })),
  ].sort((a, b) => a.start - b.start || b.end - a.end);

  // Greedy column assignment: each item goes into the first column whose last
  // item ends at or before the current item's start.
  const colEnds: number[] = [];
  const assigned: { item: LItem; col: number }[] = [];
  for (const item of items) {
    let col = colEnds.findIndex(end => end <= item.start);
    if (col === -1) col = colEnds.length;
    colEnds[col] = item.end;
    assigned.push({ item, col });
  }

  const aptStyles   = new Map<number, { left: string; right: string }>();
  const blockStyles = new Map<number, { left: string; right: string }>();
  const noteStyles  = new Map<number, { left: string; right: string }>();

  for (const { item, col } of assigned) {
    // Find the max column index among all items that overlap with this one to
    // determine how many concurrent columns this item participates in.
    let maxCol = col;
    for (const { item: other, col: otherCol } of assigned) {
      if (other === item) continue;
      if (item.start < other.end && item.end > other.start) maxCol = Math.max(maxCol, otherCol);
    }
    const total    = maxCol + 1;
    // Cards occupy the left 90% of the column; right 10% stays as the action zone.
    const leftPct  = (col / total) * 90;
    const rightPct = 100 - ((col + 1) / total) * 90;
    const style    = {
      left:  `calc(${leftPct.toFixed(2)}% + 2px)`,
      right: `calc(${rightPct.toFixed(2)}% + 2px)`,
    };
    if (item.type === 'apt')   aptStyles.set(item.id, style);
    else if (item.type === 'block') blockStyles.set(item.id, style);
    else                       noteStyles.set(item.id, style);
  }
  return { aptStyles, blockStyles, noteStyles };
};

const CalendarComponent: React.FC<CalendarProps> = ({
  view,
  currentDate,
  onDateChange,
  selectedPractitionerId,
  selectedClinicBranchId,
  refreshKey,
  onEventClick,
  onAppointmentsReady,
  onCalendarReady,
  practitionerAvailability,
  allAvailabilities,
  compareMode = false,
  compareAvailabilityA,
  compareAvailabilityB,
  comparePractitionerNames,
  comparePractitionerIdA,
  comparePractitionerIdB,
  onSlotAction,
  appointmentRefreshKey,
  onRecurringCreated,
  onLiveStatusChange,
  onRebook,
  rebookMode = false,
  rebookPreviewLabel,
  multiPractitioners,
}) => {
  // Staff entries have string ids (e.g. 'staff-5') — appointment hooks need a numeric id or null.
  // Pass null for String ids so appointment filtering is effectively disabled for Staff.
  const numericPractitionerId: number | null =
    typeof selectedPractitionerId === 'number' ? selectedPractitionerId : null;

  // ── AVAILABILITY HELPER FUNCTIONS ──────────────────────────────────────────
  // Whether the allAvailabilities map has any entries
  const hasAvailabilityMap = allAvailabilities != null && Object.keys(allAvailabilities).length > 0;

  // Check if a given date is a duty day.
  // Single-practitioner mode: uses practitionerAvailability.
  // Multi-practitioner mode: true if ANY practitioner works that day.
  const isDutyDay = useCallback((date: Date): boolean => {
    const dayOfWeek = DAY_MAP[date.getDay()];
    if (practitionerAvailability) {
      return practitionerAvailability.duty_days.includes(dayOfWeek);
    }
    if (allAvailabilities && Object.keys(allAvailabilities).length > 0) {
      return Object.values(allAvailabilities).some(avail => avail.duty_days.includes(dayOfWeek));
    }
    return true; // No availability info = all days open
  }, [practitionerAvailability, allAvailabilities]);

  // Check if a given time slot falls within any practitioner's duty hours.
  const isDutyHour = useCallback((hour: number, minutes: number, forDate?: Date): boolean => {
    const slotMins = hour * 60 + minutes;
    if (practitionerAvailability) {
      // Split-shift mode
      if (practitionerAvailability.duty_schedule && forDate) {
        const dayKey = DAY_MAP[forDate.getDay()];
        const blocks = practitionerAvailability.duty_schedule[dayKey] ?? [];
        return blocks.some(b => slotMins >= timeToMinutes(b.start) && slotMins < timeToMinutes(b.end));
      }
      const dutyStart = timeToMinutes(practitionerAvailability.duty_start_time);
      const dutyEnd   = timeToMinutes(practitionerAvailability.duty_end_time);
      return slotMins >= dutyStart && slotMins < dutyEnd;
    }
    if (allAvailabilities && Object.keys(allAvailabilities).length > 0) {
      return Object.values(allAvailabilities).some(avail => {
        if (avail.duty_schedule && forDate) {
          const dayKey = DAY_MAP[forDate.getDay()];
          const blocks = avail.duty_schedule[dayKey] ?? [];
          return blocks.some(b => slotMins >= timeToMinutes(b.start) && slotMins < timeToMinutes(b.end));
        }
        const dutyStart = timeToMinutes(avail.duty_start_time);
        const dutyEnd   = timeToMinutes(avail.duty_end_time);
        return slotMins >= dutyStart && slotMins < dutyEnd;
      });
    }
    return true;
  }, [practitionerAvailability, allAvailabilities]);

  // Check if slot is during lunch break.
  // In multi-practitioner mode we skip lunch-break coloring (each prac has different hours).
  const isLunchBreak = useCallback((hour: number, minutes: number): boolean => {
    if (practitionerAvailability) {
      const slotMins  = hour * 60 + minutes;
      const lunchStart = timeToMinutes(practitionerAvailability.lunch_start_time);
      const lunchEnd   = timeToMinutes(practitionerAvailability.lunch_end_time);
      return slotMins >= lunchStart && slotMins < lunchEnd;
    }
    // Multi-practitioner mode: practitioners have different lunch hours — skip visualization
    if (hasAvailabilityMap) return false;
    // Default fallback (no availability configured at all)
    const slotMins = hour * 60 + minutes;
    return slotMins >= 720 && slotMins < 780;
  }, [practitionerAvailability, hasAvailabilityMap]);

  const { isOpen, selectedSlot, openModal, closeModal } = useAppointmentModal();

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isViewOpen,           setIsViewOpen]           = useState(false);

  // ── Rebook ghost — tracks mouse position when rebookMode is active ────────
  const [rebookGhostPos, setRebookGhostPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!rebookMode) { setRebookGhostPos(null); return; }
    const onMove = (e: MouseEvent) => setRebookGhostPos({ x: e.clientX, y: e.clientY });
    const onLeave = () => setRebookGhostPos(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, [rebookMode]);

  // ── Hover card ────────────────────────────────────────────────────────────
  const {
    hoverState,
    onMouseEnter:   onCardMouseEnter,
    onMouseLeave:   onCardMouseLeave,
    onPopoverEnter: onHoverCardEnter,
    onPopoverLeave: onHoverCardLeave,
    hideHover,
  } = useAppointmentHover();

  // ── Block hover card ───────────────────────────────────────────────────────────
  const {
    blockHoverState,
    onBlockMouseEnter,
    onBlockMouseLeave,
    onBlockPopoverEnter,
    onBlockPopoverLeave,
    hideBlockHover,
  } = useBlockHover();

  // ── Note hover card ────────────────────────────────────────────────────────
  const {
    noteHoverState,
    onNoteMouseEnter,
    onNoteMouseLeave,
    onNotePopoverEnter,
    onNotePopoverLeave,
    hideNoteHover,
  } = useNoteHover();

  // ── Note modal state ───────────────────────────────────────────────────────
  const [selectedNote,    setSelectedNote]    = useState<CalendarNote | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  const openNoteModal = useCallback((note: CalendarNote) => {
    hideNoteHover();
    setSelectedNote(note);
    setIsNoteModalOpen(true);
  }, [hideNoteHover]);

  const closeNoteModal = useCallback(() => {
    setSelectedNote(null);
    setIsNoteModalOpen(false);
  }, []);



  // Helper: detect portal-originated appointments (primary: booking_source field;
  // fallback: old heuristic for appointments created before the migration).
  const isPortalBooking = (apt: Appointment): boolean =>
    apt.booking_source === 'portal' ||
    (apt.created_by === null && !!apt.notes?.startsWith('Created from portal booking'));

  const PORTAL_MINT_HEX = '#0575E6';

  const getBlockColors = (apt: Appointment): BlockColors => {
    // ── DNA → RED (highest-priority visual override) ──────────────────────
    // Business rule: DNA is never a soft marker. Both arrival_status=DNA and
    // status=DNA must display RED so staff immediately spot missed appointments
    // across all calendar and diary views.
    if (apt.arrival_status === 'DNA' || apt.status === 'DNA') {
      const dnaRed = '#DC2626';
      return {
        useHex: true,
        hex:    dnaRed,
        bgStyle: {
          backgroundColor: dnaRed,
          borderColor:     '#B91C1C',
          boxShadow:       '0 1px 4px rgba(185,28,28,0.35)',
        },
        textColor:    '#ffffff',
        subTextColor: '#fecaca',
        label: apt.service_name ?? apt.chief_complaint ?? null,
      };
    }
    // Check if appointment has an invoice - use orange color
    if (apt.has_invoice) {
      const orangeHex = '#f97316';
      return {
        useHex: true,
        hex:    orangeHex,
        bgStyle: {
          backgroundColor: orangeHex,
          borderColor:     '#ea650d',
          boxShadow:       '0 1px 3px rgba(0,0,0,0.15)',
        },
        textColor:    '#ffffff',
        subTextColor: '#fed7aa',
        label: apt.service_name ?? apt.chief_complaint ?? null,
      };
    }
    // Check if appointment has arrived - use purple color
    if (apt.arrival_status === 'ARRIVED') {
      const purpleHex = '#8B5CF6';
      return {
        useHex: true,
        hex:    purpleHex,
        bgStyle: {
          backgroundColor: purpleHex,
          borderColor:     '#7c3aed',
          boxShadow:       '0 1px 3px rgba(0,0,0,0.15)',
        },
        textColor:    '#ffffff',
        subTextColor: '#ede9fe',
        label: apt.service_name ?? apt.chief_complaint ?? null,
      };
    }
    // Portal booking — blue is the default for online bookings.
    // Once a practitioner manually changes the Consultation Type,
    // service_overridden=true and we fall through to the service color below.
    if (isPortalBooking(apt) && !apt.service_overridden) {
      return {
        useHex: true,
        hex:    PORTAL_MINT_HEX,
        bgStyle: {
          backgroundColor: PORTAL_MINT_HEX,
          borderColor:     '#5FEBB3',
          boxShadow:       '0 1px 3px rgba(0,0,0,0.15)',
        },
        textColor:    '#FFFFFF',
        subTextColor: '#FFFFFF',
        label: apt.service_name ?? apt.chief_complaint ?? null,
      };
    }
    if (apt.service_color) {
      return {
        useHex: true,
        hex:    apt.service_color,
        bgStyle: {
          backgroundColor: apt.service_color,
          borderColor:     apt.service_color,
          boxShadow:       '0 1px 3px rgba(0,0,0,0.15)',
        },
        textColor:    '#ffffff',
        subTextColor: '#f3f4f6',
        label: apt.service_name ?? apt.chief_complaint ?? null,
      };
    }
    const c = APPOINTMENT_STATUS_COLORS[apt.status];
    return {
      useHex: false,
      hex:    null,
      bg:     c.bg,
      border: c.border,
      text:   c.text,
      label:  apt.chief_complaint ?? null,
    };
  };

  // Memoized date range — avoids creating new Date objects on every render,
  // keeping useCalendarData's string-based deps stable.
  const { startDate, endDate } = useMemo(() => {
    if (view === 'day') {
      return { startDate: currentDate, endDate: currentDate };
    } else if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      return { startDate: weekStart, endDate: addDays(weekStart, 6) };
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd   = endOfMonth(currentDate);
      return {
        startDate: startOfWeek(monthStart, { weekStartsOn: 1 }),
        endDate:   endOfWeek(monthEnd,     { weekStartsOn: 1 }),
      };
    }
  }, [view, currentDate]);

  const {
    appointments,
    updateAppointmentInState,
    addAppointmentToState,
    removeAppointmentFromState,
    refetchAppointments: refetch,
    blockAppointments,
    updateBlockAppointmentInState,
    addBlockAppointmentToState,
    removeBlockAppointmentFromState,
    refetchBlockAppointments,
    notes,
    addNoteToState,
    removeNoteFromState,
    updateNoteInState,
  } = useCalendarData({
    startDate,
    endDate,
    practitionerId: numericPractitionerId,
    clinicBranchId: selectedClinicBranchId,
    blockClinicBranchId: null,
  });

  // ── Real-time WebSocket sync ────────────────────────────────────────────────
  // Filtering (practitioner + branch) is enforced inside useAppointments so
  // addAppointmentToState / updateAppointmentInState are already filter-aware.
  // No manual guard needed here — any event that doesn't match the current
  // practitioner or branch is silently dropped by the hook.
  const handleWsAppointmentCreated = useCallback((apt: Appointment) => {
    addAppointmentToState(apt);
  }, [addAppointmentToState]);

  const { isConnected: isLive } = useCalendarSocket({
    onAppointmentCreated: handleWsAppointmentCreated,
    onAppointmentUpdated: updateAppointmentInState,
    onAppointmentDeleted: removeAppointmentFromState,
    onBlockCreated:       addBlockAppointmentToState,
    onBlockUpdated:       updateBlockAppointmentInState,
    onBlockDeleted:       removeBlockAppointmentFromState,
    onNoteCreated:        addNoteToState,
    onNoteUpdated:        updateNoteInState,
    onNoteDeleted:        removeNoteFromState,
  });

  // Propagate live status to parent (e.g. Diary toolbar indicator).
  useEffect(() => {
    onLiveStatusChange?.(isLive);
  }, [isLive, onLiveStatusChange]);

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const apt of appointments) {
      if (apt.status === 'CANCELLED') continue;
      if (!map[apt.date]) map[apt.date] = [];
      map[apt.date].push(apt);
    }
    return map;
  }, [appointments]);

  const notesByDate = useMemo(() => {
    const map: Record<string, CalendarNote[]> = {};
    if (!Array.isArray(notes)) return map;
    for (const note of notes) {
      if (!map[note.date]) map[note.date] = [];
      map[note.date].push(note);
    }
    return map;
  }, [notes]);

  const blockAppointmentsByDate = useMemo(() => {
    const map: Record<string, BlockAppointment[]> = {};
    if (!Array.isArray(blockAppointments)) return map;

    for (const block of blockAppointments) {
      // Branch-tab scoping depends on visibility_type:
      //   ALL      → show in every branch tab (global event)
      //   SELECTED → show in every branch tab (backend already restricts who sees it)
      //   SELF     → show only in the branch where the event was created
      if (selectedClinicBranchId !== null && block.visibility_type === 'SELF' && block.clinic !== selectedClinicBranchId) {
        continue;
      }

      if (!map[block.date]) map[block.date] = [];
      map[block.date].push(block);
    }

    return map;
  }, [blockAppointments, selectedClinicBranchId]);

  // ── Conflict detection for block appointments (must be after appointments is defined) ─────────────────────────────────
  const { getFirstConflict } = useBlockConflictDetection(appointments);
  // When a drag-drop lands in a multi-prac column we capture the target
  // practitioner before the async reschedule flow begins.
  const dropTargetPractIdRef = useRef<number | null>(null);

  const [rescheduleTarget, setRescheduleTarget] = useState<{
    type: 'appointment' | 'block' | 'note';
    appointment?: Appointment;
    block?: BlockAppointment;
    note?: CalendarNote;
    newDate:              Date;
    newHour:              number;
    newMinutes:           number;
    targetPractitionerId?: number | null; // set when dropped into a different practitioner column
  } | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // ── Conflict detection state ─────────────────────────────────────────────────
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictingAppointment, setConflictingAppointment] = useState<{
    appointment: Appointment;
    blockStartTime: string;
    blockEndTime: string;
  } | null>(null);
  const [pendingBlockDrop, setPendingBlockDrop] = useState<{
    block: BlockAppointment;
    newDate: Date;
    newHour: number;
    newMinutes: number;
  } | null>(null);

  // Use refreshKey to trigger re-fetch when events are created
  React.useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      refetchBlockAppointments();
    }
  }, [refreshKey, refetchBlockAppointments]);

  // Trigger appointment refetch when appointmentRefreshKey changes (e.g. created from Diary-level modal)
  React.useEffect(() => {
    if (appointmentRefreshKey && appointmentRefreshKey > 0) {
      refetch();
    }
  }, [appointmentRefreshKey, refetch]);

  // Expose appointments to parent via callback
  React.useEffect(() => {
    if (onAppointmentsReady && appointments.length > 0) {
      onAppointmentsReady(appointments);
    }
  }, [appointments, onAppointmentsReady]);

  // Notify parent when calendar has loaded with the current date
  const calendarReadyCalled = React.useRef(false);
  React.useEffect(() => {
    if (!calendarReadyCalled.current && onCalendarReady) {
      calendarReadyCalled.current = true;
      onCalendarReady(currentDate);
    }
  }, [currentDate, onCalendarReady]);

  // O(1) lookup for block appointments by date (pre-indexed in memoized map)
  const getBlockAppointmentsForDate = useCallback((date: Date): BlockAppointment[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return blockAppointmentsByDate[dateStr] ?? [];
  }, [blockAppointmentsByDate]);

  // O(1) lookup for notes by date
  const getNotesForDate = useCallback((date: Date): CalendarNote[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return notesByDate[dateStr] ?? [];
  }, [notesByDate]);

  // Helper to get style for block appointment
  // Calculate block appointment position based on current view
  // For Day view with filtered slots, offset is based on duty_start_time
  // For Week view, offset is always 6 AM (all hours shown)
  // Uses h-6 (1.5rem) per 15-minute slot for Nookal-style grid
  const getBlockAppointmentStyle = (block: BlockAppointment, forDayView = false) => {
    const [sH, sM] = block.start_time.split(':').map(Number);
    const [eH, eM] = block.end_time.split(':').map(Number);
    
    let startSlotIndex: number;
    let endSlotIndex: number;
    
    if (forDayView && practitionerAvailability) {
      // Day view with filtered slots: offset based on duty_start_time
      const dutyStartMins = timeToMinutes(practitionerAvailability.duty_start_time);
      const blockStartMins = sH * 60 + sM;
      const blockEndMins = eH * 60 + eM;
      startSlotIndex = Math.floor((blockStartMins - dutyStartMins) / 15);
      endSlotIndex = Math.floor((blockEndMins - dutyStartMins) / 15);
    } else {
      // Week view or no availability: offset from 6 AM (original behavior)
      startSlotIndex = (sH - 6) * 4 + Math.floor(sM / 15);
      endSlotIndex = (eH - 6) * 4 + Math.floor(eM / 15);
    }
    
    const durationSlots = Math.max(endSlotIndex - startSlotIndex, 1);
    // h-6 = 1.5rem per slot
    return {
      top:    `${startSlotIndex * 1.5}rem`,
      height: `${durationSlots * 1.5}rem`,
    };
  };

  // ── Note position style (mirrors getBlockAppointmentStyle) ────────────────
  const getNoteStyle = (note: CalendarNote, forDayView = false) => {
    const [sH, sM] = note.start_time.split(':').map(Number);
    const [eH, eM] = note.end_time.split(':').map(Number);
    let startSlotIndex: number;
    let endSlotIndex:   number;
    if (forDayView && practitionerAvailability) {
      const dutyStartMins = timeToMinutes(practitionerAvailability.duty_start_time);
      startSlotIndex = Math.floor((sH * 60 + sM - dutyStartMins) / 15);
      endSlotIndex   = Math.floor((eH * 60 + eM - dutyStartMins) / 15);
    } else {
      startSlotIndex = (sH - 6) * 4 + Math.floor(sM / 15);
      endSlotIndex   = (eH - 6) * 4 + Math.floor(eM / 15);
    }
    const durationSlots = Math.max(endSlotIndex - startSlotIndex, 1);
    return {
      top:    `${startSlotIndex * 1.5}rem`,
      height: `${durationSlots * 1.5}rem`,
    };
  };

  // ── Drag-to-reschedule ────────────────────────────────────────────────────
  const handleRescheduleRequest = useCallback((
    appointment: Appointment,
    newDate:     Date,
    newHour:     number,
    newMinutes:  number,
  ) => {
    const targetPractitionerId = dropTargetPractIdRef.current;
    dropTargetPractIdRef.current = null;
    setRescheduleTarget({ type: 'appointment', appointment, newDate, newHour, newMinutes, targetPractitionerId });
  }, []);

  const handleBlockRescheduleRequest = useCallback((
    block: BlockAppointment,
    newDate:     Date,
    newHour:     number,
    newMinutes:  number,
  ) => {
    // Calculate the new end time based on original duration
    const [startH, startM] = block.start_time.split(':').map(Number);
    const [endH, endM] = block.end_time.split(':').map(Number);
    const originalDuration = (endH * 60 + endM) - (startH * 60 + startM);
    const newEndTotalMins = newHour * 60 + newMinutes + originalDuration;
    const newEndH = Math.floor(newEndTotalMins / 60);
    const newEndM = newEndTotalMins % 60;
    
    const newStartTime = `${String(newHour).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
    const newEndTime = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`;
    const newDateStr = format(newDate, 'yyyy-MM-dd');
    
    // Check for conflicts with existing appointments
    const conflict = getFirstConflict({
      date: newDateStr,
      start_time: newStartTime,
      end_time: newEndTime,
    });
    
    if (conflict) {
      // Store pending block drop and show conflict modal
      setPendingBlockDrop({ block, newDate, newHour, newMinutes });
      setConflictingAppointment(conflict);
      setShowConflictModal(true);
    } else {
      // No conflict, proceed with reschedule
      setRescheduleTarget({ type: 'block', block, newDate, newHour, newMinutes });
    }
  }, [getFirstConflict]);

  const { dragState, startHold, cancelHold, onDragMove, onDropOnSlot } =
    useAppointmentDrag(handleRescheduleRequest);

  const {
    blockDragState,
    startBlockHold,
    cancelBlockHold,
    onBlockDragMove,
    onBlockDropOnSlot,
  } = useBlockAppointmentDrag(handleBlockRescheduleRequest);

  const handleNoteRescheduleRequest = useCallback((
    note: CalendarNote,
    newDate: Date,
    newHour: number,
    newMinutes: number,
  ) => {
    setRescheduleTarget({ type: 'note', note, newDate, newHour, newMinutes });
  }, []);

  const {
    noteDragState,
    startNoteDrag,
    cancelNoteDrag,
    onNoteDragMove,
    onNoteDropOnSlot,
  } = useNoteDrag(handleNoteRescheduleRequest);

  // ── Resize ────────────────────────────────────────────────────────────────
  const {
    isResizing,
    startResize,
    onResizeMove,
    commitResize,
    cancelResize,
    getPreviewTimes,
  } = useResize();

  // Commit resize: call API directly (no confirm dialog needed)
  const handleResizeCommit = useCallback(async () => {
    const result = commitResize();
    if (!result) return;
    const { type, id, date, start_time, end_time } = result;
    try {
      if (type === 'appointment') {
        const apt = appointments.find(a => a.id === id);
        if (!apt) return;
        const updated = await rescheduleAppointment(id, { date, start_time, end_time });
        updateAppointmentInState(updated);
        toast.success('Appointment resized');
      } else if (type === 'block') {
        const updated = await updateBlockAppointment(id, { date, start_time, end_time });
        updateBlockAppointmentInState(updated);
        toast.success('Event resized');
      } else if (type === 'note') {
        const updated = await updateCalendarNote(id, { date, start_time, end_time });
        updateNoteInState(updated);
        toast.success('Note resized');
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : undefined;
      toast.error(msg ?? 'Failed to resize.');
    }
  }, [commitResize, appointments, updateAppointmentInState,
      updateBlockAppointmentInState, updateNoteInState]);

  const confirmReschedule = async () => {
    if (!rescheduleTarget) return;
    const { type, appointment, block, newDate, newHour, newMinutes } = rescheduleTarget;

    setIsRescheduling(true);
    try {
      if (type === 'appointment' && appointment) {
        // Compute duration from start/end — never trust duration_minutes (may be stale after resize)
        const [origStartH, origStartM] = appointment.start_time.split(':').map(Number);
        const [origEndH,   origEndM]   = appointment.end_time.split(':').map(Number);
        const durationMins = Math.max((origEndH * 60 + origEndM) - (origStartH * 60 + origStartM), 15);
        const endTotalMins = newHour * 60 + newMinutes + durationMins;
        const endH         = Math.floor(endTotalMins / 60);
        const endM         = endTotalMins % 60;

        const { targetPractitionerId } = rescheduleTarget;
        const updatedPractitioner =
          targetPractitionerId != null && targetPractitionerId !== appointment.practitioner
            ? { practitioner: targetPractitionerId }
            : {};

        const updated = await rescheduleAppointment(appointment.id, {
          date:       format(newDate, 'yyyy-MM-dd'),
          start_time: `${String(newHour).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`,
          end_time:   `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
          ...updatedPractitioner,
        });
        updateAppointmentInState(updated);
        refetch(); // Refresh appointments to ensure all views update
        toast.success(
          `Rescheduled to ${format(newDate, 'MMM d')} at ` +
          `${String(newHour).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`
        );
      } else if (type === 'block' && block) {
        // Calculate end time based on original duration
        const [startH, startM] = block.start_time.split(':').map(Number);
        const [endH, endM] = block.end_time.split(':').map(Number);
        const originalDuration = (endH * 60 + endM) - (startH * 60 + startM);
        const newEndTotalMins = newHour * 60 + newMinutes + originalDuration;
        const newEndH = Math.floor(newEndTotalMins / 60);
        const newEndM = newEndTotalMins % 60;

        // Build optimistic update from known block data — safe even if API
        // response body is missing fields (e.g. old cached serializer format).
        const optimisticBlock = {
          ...block,
          date:       format(newDate, 'yyyy-MM-dd'),
          start_time: `${String(newHour).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`,
          end_time:   `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`,
        };
        // Apply immediately so the card moves without waiting for the response.
        updateBlockAppointmentInState(optimisticBlock);

        const updated = await updateBlockAppointment(block.id, {
          date:       optimisticBlock.date,
          start_time: optimisticBlock.start_time,
          end_time:   optimisticBlock.end_time,
        });
        // Reconcile with server response (includes updated modified_by etc.)
        // Guard: only update if the response contains a valid id.
        if (updated?.id) updateBlockAppointmentInState(updated);
        refetchBlockAppointments();
        toast.success(
          `Event rescheduled to ${format(newDate, 'MMM d')} at ` +
          `${String(newHour).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`
        );
      } else if (type === 'note' && rescheduleTarget?.note) {
        const n = rescheduleTarget.note;
        const [nStartH, nStartM] = n.start_time.split(':').map(Number);
        const [nEndH, nEndM]     = n.end_time.split(':').map(Number);
        const duration = (nEndH * 60 + nEndM) - (nStartH * 60 + nStartM);
        const newEndTotalMins = newHour * 60 + newMinutes + duration;
        const newEndH = Math.floor(newEndTotalMins / 60);
        const newEndM = newEndTotalMins % 60;

        const updated = await updateCalendarNote(n.id, {
          date:       format(newDate, 'yyyy-MM-dd'),
          start_time: `${String(newHour).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`,
          end_time:   `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`,
        });
        updateNoteInState(updated);
        toast.success(`Note moved to ${format(newDate, 'MMM d')} at ${String(newHour).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`);
      }
    } catch (err: unknown) {
      const errorMessage = err && typeof err === 'object' && 'response' in err 
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail 
        : 'Failed to reschedule';
      toast.error(errorMessage ?? 'Failed to reschedule.');
    } finally {
      setIsRescheduling(false);
      setRescheduleTarget(null);
    }
  };

  // ── Drag selection ────────────────────────────────────────────────────────
  const {
    selection,
    startSelection,
    updateSelection,
    endSelection,
    clearSelection,
    isSlotSelected,
    getSelectionDuration,
    getSelectionStartTime,
  } = useDragSelection();

  const isDraggingRef    = useRef(false);
  const dragStartTimeRef = useRef<number>(0);

  const generateTimeSlots = useCallback((availability?: PractitionerAvailability) => {
    const slots = [];

    // Helper to calculate total minutes and check if it's lunch time
    const slotMins = (h: number, q: number) => h * 60 + q * 15;
    const lunchStart = availability 
      ? timeToMinutes(availability.lunch_start_time) 
      : 12 * 60;
    const lunchEnd = availability 
      ? timeToMinutes(availability.lunch_end_time) 
      : 13 * 60;

    // Generate slots from 6 AM to 8 PM
    for (let hour = 6; hour <= 20; hour++) {
      for (let quarter = 0; quarter < 4; quarter++) {
        const minutes = quarter * 15;
        const totalMins = slotMins(hour, quarter);
        const isLunch = totalMins >= lunchStart && totalMins < lunchEnd;
        
        const h12     = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const period  = hour >= 12 ? 'PM' : 'AM';
        
        slots.push({
          hour,
          quarter,
          minutes,
          label:        quarter === 0 ? `${h12} ${period}` : '',
          time:         `${hour}:${minutes.toString().padStart(2, '0')}`,
          isLunchBreak: isLunch,
        });
      }
    }

    return slots;
  }, []);

  const timeSlots = useMemo(() => generateTimeSlots(practitionerAvailability), [generateTimeSlots, practitionerAvailability]);

  // ── FILTERED TIME SLOTS FOR DAY VIEW ──────────────────────────────────────
  // Only show duty hours in Day view (completely hide non-duty hours)
  const dayViewTimeSlots = useMemo(() => {
    if (!practitionerAvailability) return timeSlots; // No filtering if no availability set
    
    const dutyStart = timeToMinutes(practitionerAvailability.duty_start_time);
    const dutyEnd = timeToMinutes(practitionerAvailability.duty_end_time);
    
    return timeSlots.filter(slot => {
      const slotMins = slot.hour * 60 + slot.minutes;
      return slotMins >= dutyStart && slotMins < dutyEnd;
    });
  }, [timeSlots, practitionerAvailability]);

  const getAppointmentsForDate = useCallback((date: Date): Appointment[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointmentsByDate[dateStr] ?? [];
  }, [appointmentsByDate]);

  const getAppointmentsForDay = useCallback((date: Date): Appointment[] =>
    getAppointmentsForDate(date), [getAppointmentsForDate]);

  // Calculate appointment position based on current view
  // For Day view with filtered slots, offset is based on duty_start_time
  // For Week view, offset is always 6 AM (all hours shown)
  // Uses h-6 (1.5rem) per 15-minute slot for Nookal-style grid
  const getAppointmentStyle = (apt: Appointment, forDayView = false) => {
    const [sH, sM] = apt.start_time.split(':').map(Number);
    const [eH, eM] = apt.end_time.split(':').map(Number);
    // Always derive duration from start/end times — never trust duration_minutes
    const durationMins  = Math.max((eH * 60 + eM) - (sH * 60 + sM), 15);
    const durationSlots = durationMins / 15;

    let startSlotIndex: number;
    if (forDayView && practitionerAvailability) {
      const dutyStartMins = timeToMinutes(practitionerAvailability.duty_start_time);
      startSlotIndex = Math.floor((sH * 60 + sM - dutyStartMins) / 15);
    } else {
      startSlotIndex = (sH - 6) * 4 + Math.floor(sM / 15);
    }

    // h-6 = 1.5rem per slot
    return {
      top:    `${startSlotIndex * 1.5}rem`,
      height: `${durationSlots * 1.5}rem`,
    };
  };

  // ── Time column label ─────────────────────────────────────────────────────
  // Time label with consistent h-6 height for 15-min grid alignment
  const renderTimeLabel = (slot: typeof timeSlots[0], i: number) => {
    const isLunch = slot.isLunchBreak;
    if (isLunch) {
      const lunchStart = practitionerAvailability?.lunch_start_time || '12:00';
      const [lH, lM] = lunchStart.split(':').map(Number);
      const isFirstLunchSlot = slot.hour === lH && slot.minutes === lM;
      return (
        <div
          key={i}
          className={`h-6 px-2 text-right flex items-center justify-end
            ${slot.quarter === 0 ? 'border-t border-amber-400' : 'border-t border-amber-300'}
            bg-amber-100`}
        >
          {isFirstLunchSlot && (
            <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wide whitespace-nowrap">
              Lunch Break
            </span>
          )}
        </div>
      );
    }
    return (
      <div
        key={i}
        className={`h-6 px-3 text-xs font-medium text-right flex items-center justify-end
          ${slot.quarter === 0 ? 'border-t border-gray-300' : 'border-t border-gray-100'}
          bg-gray-50 text-gray-500`}
      >
        {slot.label}
      </div>
    );
  };

  const handleAppointmentClick = (apt: Appointment) => {
    if (dragState.isDragging || dragState.isHolding || blockDragState.isDragging || blockDragState.isHolding || noteDragState.isDragging || isResizing) return;
    hideHover();
    setSelectedAppointment(apt);
    setIsViewOpen(true);
  };

  const handleMouseDown = (_date: Date, slot: CalendarSlot) => {
    if (dragState.isDragging || blockDragState.isDragging || noteDragState.isDragging || isResizing) return;
    isDraggingRef.current    = false;
    dragStartTimeRef.current = Date.now();
    startSelection(slot);
  };

  const handleMouseEnter = (slot: CalendarSlot) => {
    if (dragState.isDragging || blockDragState.isDragging || noteDragState.isDragging || isResizing) return;
    if (selection.isSelecting) {
      const cur   = slot.hour * 4 + slot.quarter;
      const start = selection.startSlot
        ? selection.startSlot.hour * 4 + selection.startSlot.quarter
        : -1;
      if (cur !== start) isDraggingRef.current = true;
      updateSelection(slot);
    }
  };

  const handleMouseUp = (date: Date) => {
    if ((dragState.isDragging && dragState.draggedAppointment) || (blockDragState.isDragging && blockDragState.draggedBlock) || (noteDragState.isDragging && noteDragState.draggedNote) || isResizing) return;

    if (selection.startSlot) {
      const duration  = getSelectionDuration();
      const startTime = getSelectionStartTime();
      if (isDraggingRef.current && duration > 15 && startTime) {
        const slotInfo = {
          date,
          time:    `${startTime.hour}:${startTime.minutes.toString().padStart(2, '0')}`,
          hour:    startTime.hour,
          minutes: startTime.minutes,
          duration,
        };
        if (onSlotAction) {
          onSlotAction(slotInfo);
        } else {
          openModal(slotInfo);
        }
      }
    }
    endSelection();
    clearSelection();
    isDraggingRef.current = false;
  };

  const handleSlotMouseUp = (date: Date, slot: { hour: number; minutes: number }) => {
    if (dragState.isDragging) {
      onDropOnSlot(date, slot.hour, slot.minutes);
      return;
    }
    if (blockDragState.isDragging) {
      onBlockDropOnSlot(date, slot.hour, slot.minutes);
      return;
    }
    if (noteDragState.isDragging) {
      onNoteDropOnSlot(date, slot.hour, slot.minutes);
      return;
    }
    handleMouseUp(date);
  };

  const handleDoubleClick = (date: Date, slot: CalendarSlot, element?: HTMLElement) => {
    if (dragState.isDragging || dragState.isHolding || blockDragState.isDragging || blockDragState.isHolding || noteDragState.isDragging || isResizing) return;
    if (onSlotAction) {
      const rect = element?.getBoundingClientRect();
      onSlotAction({ date, time: slot.time, hour: slot.hour, minutes: slot.minutes, duration: 15, practitionerId: numericPractitionerId }, rect);
      return;
    }
    openModal({ date, time: slot.time, hour: slot.hour, minutes: slot.minutes, duration: 15 });
  };

  // ── Column-aware variants for multi-practitioner day view ─────────────────
  // These are identical to handleDoubleClick / handleMouseUp but pass the
  // column's practitioner id through onSlotAction so Diary can pre-fill it.
  const handleColumnDoubleClick = (date: Date, slot: CalendarSlot, practId: number | null, element?: HTMLElement) => {
    if (dragState.isDragging || dragState.isHolding || blockDragState.isDragging || blockDragState.isHolding || noteDragState.isDragging || isResizing) return;
    if (onSlotAction) {
      const rect = element?.getBoundingClientRect();
      onSlotAction({ date, time: slot.time, hour: slot.hour, minutes: slot.minutes, duration: 15, practitionerId: practId }, rect);
      return;
    }
    openModal({ date, time: slot.time, hour: slot.hour, minutes: slot.minutes, duration: 15 });
  };

  // Handles mouseUp on individual time slots inside a multi-prac column.
  // Unlike handleColumnMouseUp, this properly routes drag-drops and captures
  // the target practitioner for cross-column practitioner reassignment.
  const handleColumnSlotMouseUp = (
    date: Date,
    slot: { hour: number; minutes: number },
    practId: number | null,
  ) => {
    if (dragState.isDragging && dragState.draggedAppointment) {
      dropTargetPractIdRef.current = practId;
      onDropOnSlot(date, slot.hour, slot.minutes);
      return;
    }
    if (blockDragState.isDragging && blockDragState.draggedBlock) {
      dropTargetPractIdRef.current = practId;
      onBlockDropOnSlot(date, slot.hour, slot.minutes);
      return;
    }
    if (noteDragState.isDragging && noteDragState.draggedNote) {
      dropTargetPractIdRef.current = practId;
      onNoteDropOnSlot(date, slot.hour, slot.minutes);
      return;
    }
    if (isResizing) return;
    handleColumnMouseUp(date, practId);
  };

  const handleColumnMouseUp = (date: Date, practId: number | null) => {
    if ((dragState.isDragging && dragState.draggedAppointment) || (blockDragState.isDragging && blockDragState.draggedBlock) || (noteDragState.isDragging && noteDragState.draggedNote) || isResizing) return;
    if (selection.startSlot) {
      const duration  = getSelectionDuration();
      const startTime = getSelectionStartTime();
      if (isDraggingRef.current && duration > 15 && startTime) {
        const slotInfo = {
          date,
          time:    `${startTime.hour}:${startTime.minutes.toString().padStart(2, '0')}`,
          hour:    startTime.hour,
          minutes: startTime.minutes,
          duration,
          practitionerId: practId,
        };
        if (onSlotAction) {
          onSlotAction(slotInfo);
        } else {
          openModal(slotInfo);
        }
      }
    }
    endSelection();
    clearSelection();
    isDraggingRef.current = false;
  };

  const handleAppointmentCreated = (appointment: Appointment) => {
    addAppointmentToState(appointment);
  };

  const handleModalClose = () => closeModal();
  const handleViewClose  = () => { setIsViewOpen(false); setSelectedAppointment(null); };

  const getWeekDays = (date: Date) => {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const getMonthDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd   = endOfMonth(currentDate);
    const start      = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end        = endOfWeek(monthEnd,     { weekStartsOn: 1 });
    const rows: Date[][] = [];
    let days: Date[]     = [];
    let day = start;
    while (day <= end) {
      for (let i = 0; i < 7; i++) { days.push(day); day = addDays(day, 1); }
      rows.push(days);
      days = [];
    }
    return rows;
  };

  // ── Shared overlays ───────────────────────────────────────────────────────
  const dragOverlays = (
    <>
      {dragState.isDragging && dragState.ghostPosition && dragState.draggedAppointment && (
        <DragGhost appointment={dragState.draggedAppointment} position={dragState.ghostPosition} />
      )}
      {blockDragState.isDragging && blockDragState.ghostPosition && blockDragState.draggedBlock && (
        <div
          className="fixed pointer-events-none z-[9999] opacity-90 shadow-2xl"
          style={{
            left:      blockDragState.ghostPosition.x - 80,
            top:       blockDragState.ghostPosition.y - 20,
            width:     160,
            transform: 'rotate(2deg)',
          }}
        >
          <div className="bg-gray-800 text-white rounded-lg px-3 py-2 text-xs font-semibold shadow-lg border-2 border-gray-600">
            <div className="truncate">{blockDragState.draggedBlock.event_name}</div>
            <div className="text-gray-300 mt-0.5 truncate">
              {formatTime12Hour(blockDragState.draggedBlock.start_time)} · {formatTime12Hour(blockDragState.draggedBlock.end_time)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-gray-400">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Drop to reschedule
            </div>
          </div>
        </div>
      )}
      {noteDragState.isDragging && noteDragState.ghostPosition && noteDragState.draggedNote && (
        <div
          className="fixed pointer-events-none z-[9999] opacity-90 shadow-2xl"
          style={{
            left:      noteDragState.ghostPosition.x - 80,
            top:       noteDragState.ghostPosition.y - 20,
            width:     160,
            transform: 'rotate(-1deg)',
          }}
        >
          <div className="bg-orange-500 text-white px-3 py-2 text-xs font-semibold shadow-lg border-2 border-orange-600">
            <div className="truncate">📌 {noteDragState.draggedNote.message}</div>
            <div className="text-orange-200 mt-0.5 truncate">
              {formatTime12Hour(noteDragState.draggedNote.start_time)} · {formatTime12Hour(noteDragState.draggedNote.end_time)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-orange-300">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Drop to move note
            </div>
          </div>
        </div>
      )}
      {/* Rebook mode ghost — follows cursor when placing a rebook */}
      {rebookMode && rebookGhostPos && (
        <div
          className="fixed pointer-events-none z-[9999] opacity-90 shadow-2xl"
          style={{
            left:      rebookGhostPos.x - 80,
            top:       rebookGhostPos.y - 20,
            width:     180,
            transform: 'rotate(-1.5deg)',
          }}
        >
          <div className="bg-emerald-600 text-white rounded-lg px-3 py-2 text-xs font-semibold shadow-lg border-2 border-emerald-400">
            <div className="truncate">{rebookPreviewLabel ?? 'Rebook'}</div>
            <div className="text-emerald-200 mt-0.5 truncate">Click slot to rebook</div>
            <div className="mt-1 flex items-center gap-1 text-emerald-100">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              ESC to cancel
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ── Hover card overlay ────────────────────────────────────────────────────
  const hoverCardOverlay = hoverState.visible && hoverState.appointment && hoverState.anchorRect && (
    <AppointmentHoverCard
      appointment={hoverState.appointment}
      anchorRect={hoverState.anchorRect}
      onEnter={onHoverCardEnter}
      onLeave={onHoverCardLeave}
    />
  );

  // ── Block hover card overlay ───────────────────────────────────────────────────
  const blockHoverCardOverlay = blockHoverState.visible && blockHoverState.block && blockHoverState.anchorRect && (
    <BlockHoverCard
      block={blockHoverState.block}
      anchorRect={blockHoverState.anchorRect}
      onEnter={onBlockPopoverEnter}
      onLeave={onBlockPopoverLeave}
    />
  );

  // ── Note hover card overlay ────────────────────────────────────────────────
  const noteHoverCardOverlay = noteHoverState.visible && noteHoverState.note && noteHoverState.anchorRect && (
    <NoteHoverCard
      note={noteHoverState.note}
      anchorRect={noteHoverState.anchorRect}
      onEnter={onNotePopoverEnter}
      onLeave={onNotePopoverLeave}
    />
  );

  // ── Note modal overlay ─────────────────────────────────────────────────────
  const noteModalOverlay = (
    <NoteModal
      note={selectedNote}
      isOpen={isNoteModalOpen}
      onClose={closeNoteModal}
      onDeleted={(id) => { removeNoteFromState(id); closeNoteModal(); }}
      onUpdated={(updated) => { updateNoteInState(updated); setSelectedNote(updated); }}
    />
  );

  // ── Reschedule confirmation modal ─────────────────────────────────────────
  const rescheduleModal = rescheduleTarget && (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-sm mx-4 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-2">Confirm Reschedule</h3>
        {rescheduleTarget.type === 'appointment' && rescheduleTarget.appointment ? (
          <>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-semibold">{rescheduleTarget.appointment.patient_name}</span>
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
              <div className="flex items-center gap-2 text-gray-500">
                <span className="font-medium text-gray-700">From:</span>
                {rescheduleTarget.appointment.date} at {formatTime12Hour(rescheduleTarget.appointment.start_time)}
              </div>
              <div className="flex items-center gap-2 text-sky-600">
                <span className="font-medium">To:</span>
                {format(rescheduleTarget.newDate, 'yyyy-MM-dd')} at{' '}
                {formatTime12Hour(`${String(rescheduleTarget.newHour).padStart(2, '0')}:${String(rescheduleTarget.newMinutes).padStart(2, '0')}`)}
              </div>
            </div>
          </>
        ) : rescheduleTarget.type === 'block' && rescheduleTarget.block ? (
          <>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-semibold">{rescheduleTarget.block.event_name}</span>
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
              <div className="flex items-center gap-2 text-gray-500">
                <span className="font-medium text-gray-700">From:</span>
                {rescheduleTarget.block.date} at {formatTime12Hour(rescheduleTarget.block.start_time)} - {formatTime12Hour(rescheduleTarget.block.end_time)}
              </div>
              <div className="flex items-center gap-2 text-sky-600">
                <span className="font-medium">To:</span>
                {format(rescheduleTarget.newDate, 'yyyy-MM-dd')} at{' '}
                {formatTime12Hour(`${String(rescheduleTarget.newHour).padStart(2, '0')}:${String(rescheduleTarget.newMinutes).padStart(2, '0')}`)}
              </div>
            </div>
          </>
        ) : rescheduleTarget.type === 'note' && rescheduleTarget.note ? (
          <>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-semibold">📌 Note</span>
            </p>
            <div className="bg-orange-50 rounded-lg p-3 mb-4 text-sm space-y-1">
              <div className="flex items-center gap-2 text-gray-500">
                <span className="font-medium text-gray-700">From:</span>
                {rescheduleTarget.note.date} at {formatTime12Hour(rescheduleTarget.note.start_time)}
              </div>
              <div className="flex items-center gap-2 text-orange-600">
                <span className="font-medium">To:</span>
                {format(rescheduleTarget.newDate, 'yyyy-MM-dd')} at{' '}
                {formatTime12Hour(`${String(rescheduleTarget.newHour).padStart(2, '0')}:${String(rescheduleTarget.newMinutes).padStart(2, '0')}`)}
              </div>
            </div>
          </>
        ) : null}
        <div className="flex gap-3">
          <button
            onClick={() => setRescheduleTarget(null)}
            disabled={isRescheduling}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={confirmReschedule}
            disabled={isRescheduling}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isRescheduling ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Saving…
              </>
            ) : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Shared modals ─────────────────────────────────────────────────────────
  const sharedModals = (
    <>
      <AppointmentModal
        isOpen={isOpen}
        onClose={handleModalClose}
        onCreated={handleAppointmentCreated}
        selectedSlot={selectedSlot}
        selectedClinicBranchId={selectedClinicBranchId}
        defaultPractitionerId={typeof selectedPractitionerId === 'number' ? selectedPractitionerId : null}
      />
      <AppointmentView
        isOpen={isViewOpen}
        onClose={handleViewClose}
        appointment={selectedAppointment}
        onUpdated={(updated) => {
          updateAppointmentInState(updated);
          setSelectedAppointment(updated);
          // When arrival_status changes (e.g. DNA → Arrived / No Status),
          // force a full refetch so every card in every view reflects the new
          // color immediately — the optimistic update handles the current render,
          // the refetch reconciles any other cached or stale data.
          const prev = appointments.find(a => a.id === updated.id);
          if (prev && prev.arrival_status !== updated.arrival_status) {
            refetch();
          }
        }}
        onRecurringCreated={onRecurringCreated}
        onRebook={onRebook}
      />
      {/* Conflict Modal for block drag/reschedule */}
      <ConflictModal
        isOpen={showConflictModal}
        conflictingAppointment={conflictingAppointment}
        onBlockExisting={() => {
          // Proceed with the block reschedule despite conflict
          setShowConflictModal(false);
          setConflictingAppointment(null);
          // If there was a pending block drop, proceed with reschedule
          if (pendingBlockDrop) {
            setRescheduleTarget({
              type: 'block',
              block: pendingBlockDrop.block,
              newDate: pendingBlockDrop.newDate,
              newHour: pendingBlockDrop.newHour,
              newMinutes: pendingBlockDrop.newMinutes,
            });
            setPendingBlockDrop(null);
          }
        }}
        onRescheduleExisting={() => {
          // Cancel block creation, prompt user to reschedule existing appointment
          setShowConflictModal(false);
          setConflictingAppointment(null);
          setPendingBlockDrop(null);
          // Show toast for rescheduling
          if (conflictingAppointment) {
            toast('Please drag the existing appointment to a new time before creating the block appointment.', {
              icon: '📅',
              duration: 5000,
            });
          }
        }}
        onCancel={() => {
          // Cancel block creation
          setShowConflictModal(false);
          setConflictingAppointment(null);
          setPendingBlockDrop(null);
        }}
      />
    </>
  );

  // ── Appointment Card — Day/Week ───────────────────────────────────────────
  // compact = true for week view (smaller cards)
  // forDayView = true when rendering in Day view (filtered slots)
  const renderTimelineCard = (apt: Appointment, compact = false, forDayView = false, positionOverride?: { left: string; right: string }) => {
    const col       = getBlockColors(apt);
    const isDragged = dragState.draggedAppointment?.id === apt.id;
    const isHeld    = dragState.isHolding && dragState.draggedAppointment?.id === apt.id;
    const canDrag   = apt.status !== 'CANCELLED' && apt.status !== 'COMPLETED';

    // Live resize preview — overrides original times while dragging
    const resizeOvr    = getPreviewTimes('appointment', apt.id);
    const displayStart = resizeOvr?.start_time ?? apt.start_time;
    const displayEnd   = resizeOvr?.end_time   ?? apt.end_time;

    // Recompute position/height from preview times when resizing
    let baseStyle: { top: string; height: string };
    if (resizeOvr) {
      const [sH, sM] = displayStart.split(':').map(Number);
      const [eH, eM] = displayEnd.split(':').map(Number);
      const startSlot = forDayView && practitionerAvailability
        ? Math.floor((sH * 60 + sM - timeToMinutes(practitionerAvailability.duty_start_time)) / 15)
        : (sH - 6) * 4 + Math.floor(sM / 15);
      const durationSlots = Math.max(((eH * 60 + eM) - (sH * 60 + sM)) / 15, 1);
      baseStyle = { top: `${startSlot * 1.5}rem`, height: `${durationSlots * 1.5}rem` };
    } else {
      baseStyle = getAppointmentStyle(apt, forDayView);
    }

    const anyDragging = dragState.isDragging || blockDragState.isDragging;
    const containerStyle: React.CSSProperties = {
      ...baseStyle,
      position:     'absolute',
      left:         positionOverride?.left  ?? '4px',
      right:        positionOverride?.right ?? 'calc(10% + 2px)',
      zIndex:       isDragged ? 5 : (resizeOvr ? 15 : 10),
      overflow:     'hidden',
      borderRadius: '0',
      border:       resizeOvr ? '2px solid rgba(255,255,255,0.7)' : '1px solid transparent',
      padding:      compact ? '2px 6px' : '6px 8px',
      cursor:       canDrag ? (dragState.isDragging ? 'grabbing' : 'grab') : 'pointer',
      transition:   resizeOvr ? 'none' : 'filter 0.15s, opacity 0.15s, transform 0.15s',
      opacity:      isDragged ? 0.35 : 1,
      transform:    isHeld ? 'scale(1.03)' : 'scale(1)',
      pointerEvents: anyDragging ? 'none' : 'auto',
      ...(col.useHex ? col.bgStyle : {}),
    };

    return (
      <div
        key={apt.id}
        style={containerStyle}
        onMouseEnter={(e) => { if (!dragState.isDragging && !isResizing) onCardMouseEnter(apt, e); }}
        onMouseLeave={() => { if (!dragState.isDragging && !isResizing) onCardMouseLeave(); }}
        onMouseDown={canDrag ? (e) => { e.stopPropagation(); hideHover(); startHold(apt, e); } : (e) => e.stopPropagation()}
        onMouseUp={canDrag ? (e) => { if (isResizing) return; e.stopPropagation(); if (!dragState.isDragging) { cancelHold(); handleAppointmentClick(apt); } } : (e) => { if (!isResizing) e.stopPropagation(); }}
        onClick={(e) => { e.stopPropagation(); if (!canDrag && !dragState.isDragging) handleAppointmentClick(apt); }}
        className={`hover:brightness-90 select-none transition-all duration-150 shadow-sm rounded-none group relative ${!col.useHex ? `${col.bg} ${col.border}` : ''}`}
        title={canDrag ? 'Drag to reschedule · Drag edges to resize' : undefined}
      >
        {/* TOP RESIZE HANDLE */}
        {canDrag && (
          <div
            className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-20 opacity-0 group-hover:opacity-100 bg-white/20 transition-opacity select-none"
            onMouseDown={(e) => { e.stopPropagation(); startResize('appointment', apt.id, 'top', apt.start_time, apt.end_time, apt.date, e); }}
          />
        )}
        {isHeld && (
          <div
            className="absolute inset-0 pointer-events-none border-2 border-sky-400 animate-pulse"
            style={{ zIndex: 20 }}
          />
        )}
        <div>
          <div
            className="text-xs font-semibold truncate"
            style={col.useHex ? { color: col.textColor } : {}}
          >
            <span className={!col.useHex ? col.text : ''}>{apt.patient_name}</span>
          </div>
          {!compact && (
            <div
              className="text-xs truncate mt-0.5"
              style={col.useHex ? { color: col.subTextColor } : {}}
            >
              <span className={!col.useHex ? 'text-white/80' : ''}>
                {formatTime12Hour(displayStart)} – {formatTime12Hour(displayEnd)}
              </span>
            </div>
          )}
          {compact && (
            <div
              className="text-xs truncate"
              style={col.useHex ? { color: col.subTextColor } : {}}
            >
              <span className={!col.useHex ? 'text-white/80' : ''}>{formatTime12Hour(displayStart)}</span>
            </div>
          )}
          {col.label && !compact && (
            <div
              className="text-xs truncate mt-1 font-medium"
              style={col.useHex ? { color: col.subTextColor } : {}}
            >
              <span className={!col.useHex ? 'text-white/80' : ''}>{col.label}</span>
            </div>
          )}
          {col.label && compact && (
            <div
              className="text-xs truncate"
              style={col.useHex ? { color: col.subTextColor } : {}}
            >
              <span className={!col.useHex ? 'text-white/80' : ''}>{col.label}</span>
            </div>
          )}
          {!compact && isPortalBooking(apt) && (
            <div
              className="flex items-center gap-0.5 mt-1"
              style={col.useHex ? { color: col.subTextColor } : {}}
            >
              <Globe className="w-2.5 h-2.5 flex-shrink-0" />
              <span className={`text-[10px] font-medium italic ${!col.useHex ? 'text-white/70' : ''}`}>Online Booking</span>
            </div>
          )}
        </div>
        {/* BOTTOM RESIZE HANDLE with expand indicator */}
        {canDrag && (
          <div
            className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize z-20 opacity-0 group-hover:opacity-100 transition-opacity select-none flex items-end justify-end pr-0.5 pb-0.5"
            onMouseDown={(e) => { e.stopPropagation(); startResize('appointment', apt.id, 'bottom', apt.start_time, apt.end_time, apt.date, e); }}
          >
            <svg width="7" height="7" viewBox="0 0 7 7" fill="currentColor" className="text-black/70">
              <path d="M0 7 L7 0 L7 7 Z" />
            </svg>
          </div>
        )}
      </div>
    );
  };

  // Helper to check if there's a conflict between appointment and any block
  // ── Block Appointment Card — Day/Week ────────────────────────────────────────
  // compact = true for week view (smaller cards)
  // forDayView = true when rendering in Day view (filtered slots)
  const renderBlockTimelineCard = (block: BlockAppointment, compact = false, forDayView = false, positionOverride?: { left: string; right: string }) => {
    const isDragged   = blockDragState.draggedBlock?.id === block.id;
    const isHeld      = blockDragState.isHolding && blockDragState.draggedBlock?.id === block.id;
    const resizeOvr   = getPreviewTimes('block', block.id);
    const displayStart = resizeOvr?.start_time ?? block.start_time;
    const displayEnd   = resizeOvr?.end_time   ?? block.end_time;

    let baseStyle: { top: string; height: string };
    if (resizeOvr) {
      const [sH, sM] = displayStart.split(':').map(Number);
      const [eH, eM] = displayEnd.split(':').map(Number);
      const startSlot = forDayView && practitionerAvailability
        ? Math.floor((sH * 60 + sM - timeToMinutes(practitionerAvailability.duty_start_time)) / 15)
        : (sH - 6) * 4 + Math.floor(sM / 15);
      const durationSlots = Math.max(((eH * 60 + eM) - (sH * 60 + sM)) / 15, 1);
      baseStyle = { top: `${startSlot * 1.5}rem`, height: `${durationSlots * 1.5}rem` };
    } else {
      baseStyle = getBlockAppointmentStyle(block, forDayView);
    }

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!blockDragState.isDragging && !isResizing) onEventClick?.(block);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      hideBlockHover();
      if (!isResizing) startBlockHold(block, e);
    };

    const handleMouseUp = (e: React.MouseEvent) => {
      if (isResizing) return;
      e.stopPropagation();
      if (!blockDragState.isDragging) cancelBlockHold();
    };

    const handleMouseEnter = (e: React.MouseEvent) => {
      if (!blockDragState.isDragging && !isResizing) onBlockMouseEnter(block, e);
    };

    const handleMouseLeave = () => {
      if (!blockDragState.isDragging && !isResizing) onBlockMouseLeave();
    };

    const anyDragging = dragState.isDragging || blockDragState.isDragging;
    const containerStyle: React.CSSProperties = {
      ...baseStyle,
      position:        'absolute',
      left:            positionOverride?.left  ?? '4px',
      right:           positionOverride?.right ?? 'calc(10% + 2px)',
      zIndex:          isDragged ? 5 : (resizeOvr ? 15 : 10),
      overflow:        'hidden',
      borderRadius:    '0',
      backgroundColor: isDragged ? '#6b7280' : '#1f2937',
      border:          resizeOvr ? '2px solid rgba(255,255,255,0.5)' : undefined,
      cursor:          blockDragState.isDragging ? 'grabbing' : 'grab',
      opacity:         isDragged ? 0.35 : 1,
      transform:       isHeld ? 'scale(1.03)' : 'scale(1)',
      transition:      resizeOvr ? 'none' : 'filter 0.15s, opacity 0.15s, transform 0.15s',
      pointerEvents:   anyDragging ? 'none' : 'auto',
    };

    return (
      <div
        key={`block-${block.id}`}
        style={containerStyle}
        className="border border-gray-600 px-2 py-1 transition-all select-none hover:bg-gray-700 group relative"
        title="Drag to reschedule · Drag edges to resize"
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* TOP RESIZE HANDLE */}
        <div
          className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-20 opacity-0 group-hover:opacity-100 bg-white/20 transition-opacity select-none"
          onMouseDown={(e) => { e.stopPropagation(); startResize('block', block.id, 'top', block.start_time, block.end_time, block.date, e); }}
        />
        {isHeld && (
          <div
            className="absolute inset-0 border-2 border-sky-400 animate-pulse pointer-events-none"
            style={{ zIndex: 20 }}
          />
        )}
        <div className="text-xs font-semibold text-white truncate">
          {block.event_name}
        </div>
        {!compact && (
          <div className="text-xs text-gray-300 truncate mt-0.5">
            {formatTime12Hour(displayStart)} - {formatTime12Hour(displayEnd)}
          </div>
        )}
        {!compact && block.created_by_name && (
          <div className="text-xs text-gray-400 truncate">
            Created by {block.created_by_name}
          </div>
        )}
        {/* BOTTOM RESIZE HANDLE with expand indicator */}
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize z-20 opacity-0 group-hover:opacity-100 transition-opacity select-none flex items-end justify-end pr-0.5 pb-0.5"
          onMouseDown={(e) => { e.stopPropagation(); startResize('block', block.id, 'bottom', block.start_time, block.end_time, block.date, e); }}
        >
          <svg width="7" height="7" viewBox="0 0 7 7" fill="currentColor" className="text-black/70">
            <path d="M0 7 L7 0 L7 7 Z" />
          </svg>
        </div>
      </div>
    );
  };

  // ── Note Card — Day/Week ──────────────────────────────────────────────────
  const renderNoteTimelineCard = (
    note: CalendarNote,
    compact = false,
    forDayView = false,
    positionOverride?: { left: string; right: string },
  ) => {
    void compact;
    const isDragged   = noteDragState.isDragging && noteDragState.draggedNote?.id === note.id;
    const isHeld      = noteDragState.isHolding && !noteDragState.isDragging && noteDragState.draggedNote?.id === note.id;
    const resizeOvr   = getPreviewTimes('note', note.id);
    const displayStart = resizeOvr?.start_time ?? note.start_time;
    const displayEnd   = resizeOvr?.end_time   ?? note.end_time;

    let baseNoteStyle: { top: string; height: string };
    if (resizeOvr) {
      const [sH, sM] = displayStart.split(':').map(Number);
      const [eH, eM] = displayEnd.split(':').map(Number);
      const startSlot = forDayView && practitionerAvailability
        ? Math.floor((sH * 60 + sM - timeToMinutes(practitionerAvailability.duty_start_time)) / 15)
        : (sH - 6) * 4 + Math.floor(sM / 15);
      const durationSlots = Math.max(((eH * 60 + eM) - (sH * 60 + sM)) / 15, 1);
      baseNoteStyle = { top: `${startSlot * 1.5}rem`, height: `${durationSlots * 1.5}rem` };
    } else {
      baseNoteStyle = getNoteStyle(note, forDayView);
    }

    const anyDragging = dragState.isDragging || blockDragState.isDragging || noteDragState.isDragging;
    const defaultRight = positionOverride ? positionOverride.right : 'calc(10% + 2px)';
    const style: React.CSSProperties = {
      ...baseNoteStyle,
      position:        'absolute',
      left:            positionOverride?.left ?? '4px',
      right:           defaultRight,
      zIndex:          isDragged ? 5 : (resizeOvr ? 15 : 8),
      overflow:        'hidden',
      borderRadius:    '0',
      backgroundColor: isDragged ? '#c2410c' : '#f97316',
      borderColor:     '#ea580c',
      border:          resizeOvr ? '2px solid #fed7aa' : '1px solid #ea580c',
      padding:         '4px 8px',
      cursor:          noteDragState.isDragging ? 'grabbing' : 'grab',
      boxShadow:       '0 1px 3px rgba(0,0,0,0.15)',
      pointerEvents:   anyDragging ? 'none' : 'auto',
      opacity:         isDragged ? 0.35 : 1,
      transform:       isHeld ? 'scale(1.03)' : 'scale(1)',
      transition:      resizeOvr ? 'none' : 'filter 0.15s, opacity 0.15s, transform 0.15s',
    };

    const handleNoteMouseEnter = (e: React.MouseEvent) => {
      if (!noteDragState.isDragging && !noteDragState.isHolding && !isResizing) {
        (e.currentTarget as HTMLElement).style.backgroundColor = '#ea580c';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
        onNoteMouseEnter(note, e);
      }
    };

    const handleNoteMouseLeave = (e: React.MouseEvent) => {
      (e.currentTarget as HTMLElement).style.backgroundColor = isDragged ? '#c2410c' : '#f97316';
      (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.15)';
      onNoteMouseLeave();
    };

    return (
      <div
        key={`note-${note.id}`}
        style={style}
        className="select-none group relative"
        title="Drag to move · Drag edges to resize · Click to view"
        onMouseDown={(e) => { e.stopPropagation(); if (!isResizing) { hideNoteHover(); startNoteDrag(note, e); } }}
        onMouseUp={(e) => {
          if (isResizing) return;
          e.stopPropagation();
          if (!noteDragState.isDragging) {
            cancelNoteDrag();
            openNoteModal(note);
          }
        }}
        onMouseEnter={handleNoteMouseEnter}
        onMouseLeave={handleNoteMouseLeave}
      >
        {/* TOP RESIZE HANDLE */}
        <div
          className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-20 opacity-0 group-hover:opacity-100 bg-white/30 transition-opacity select-none"
          onMouseDown={(e) => { e.stopPropagation(); startResize('note', note.id, 'top', note.start_time, note.end_time, note.date, e); }}
        />
        {isHeld && (
          <div
            className="absolute inset-0 pointer-events-none border-2 border-orange-300 animate-pulse"
            style={{ zIndex: 20 }}
          />
        )}
        <div className="text-xs font-medium text-white leading-tight line-clamp-3 whitespace-pre-wrap break-words">
          {note.message}
        </div>
        {note.created_by_name && (
          <div className="text-[10px] text-orange-200 truncate mt-0.5">
            {note.created_by_name}
          </div>
        )}
        {/* BOTTOM RESIZE HANDLE with expand indicator */}
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize z-20 opacity-0 group-hover:opacity-100 transition-opacity select-none flex items-end justify-end pr-0.5 pb-0.5"
          onMouseDown={(e) => { e.stopPropagation(); startResize('note', note.id, 'bottom', note.start_time, note.end_time, note.date, e); }}
        >
          <svg width="7" height="7" viewBox="0 0 7 7" fill="currentColor" className="text-black/70">
            <path d="M0 7 L7 0 L7 7 Z" />
          </svg>
        </div>
      </div>
    );
  };

  // ── Note Card — Month ──────────────────────────────────────────────────────
  const renderNoteMonthCard = (note: CalendarNote) => (
    <div
      key={`note-month-${note.id}`}
      className="bg-orange-400 hover:bg-orange-500 text-white text-xs px-2 py-1 rounded-sm shadow-sm truncate cursor-pointer transition-colors duration-150"
      title={note.message}
      onClick={(e) => { e.stopPropagation(); openNoteModal(note); }}
    >
      <span className="font-medium">📌 </span>
      {formatTime12Hour(note.start_time)} · {note.message}
    </div>
  );

  // ── Appointment Card — Month ──────────────────────────────────────────────
  const renderMonthCard = (apt: Appointment) => {
    const col       = getBlockColors(apt);
    const isDragged = dragState.draggedAppointment?.id === apt.id;
    const isHeld    = dragState.isHolding && dragState.draggedAppointment?.id === apt.id;
    const canDrag   = apt.status !== 'CANCELLED' && apt.status !== 'COMPLETED';

    const containerStyle: React.CSSProperties = col.useHex ? {
      backgroundColor: col.hex,
      borderColor:     col.hex,
      borderLeftColor: col.hex,
      borderLeftWidth: '3px',
      boxShadow:       '0 1px 3px rgba(0,0,0,0.15)',
      opacity:         isDragged ? 0.35 : 1,
      transform:       isHeld ? 'scale(1.02)' : 'scale(1)',
      cursor:          canDrag ? (dragState.isDragging ? 'grabbing' : 'grab') : 'pointer',
    } : {
      opacity:   isDragged ? 0.35 : 1,
      cursor:    canDrag ? (dragState.isDragging ? 'grabbing' : 'grab') : 'pointer',
      transform: isHeld ? 'scale(1.02)' : 'scale(1)',
    };

    return (
      <div
        key={apt.id}
        onMouseEnter={(e) => { if (!dragState.isDragging) onCardMouseEnter(apt, e); }}
        onMouseLeave={() => { if (!dragState.isDragging) onCardMouseLeave(); }}
        onMouseDown={canDrag ? (e) => { e.stopPropagation(); hideHover(); startHold(apt, e); } : undefined}
        onMouseUp={canDrag ? () => { if (!dragState.isDragging) { cancelHold(); handleAppointmentClick(apt); } } : undefined}
        onClick={(e) => { e.stopPropagation(); if (!canDrag && !dragState.isDragging) handleAppointmentClick(apt); }}
        style={containerStyle}
        className={`border px-2 py-1 transition-all duration-150 select-none hover:brightness-90 shadow-sm ${!col.useHex ? `${col.bg} ${col.border}` : ''}`}
        title={canDrag ? 'Drag to reschedule' : undefined}
      >
        {isHeld && (
          <div className="absolute inset-0 pointer-events-none border-2 border-sky-400 animate-pulse" />
        )}
        <div
          className="text-xs font-semibold truncate"
          style={col.useHex ? { color: col.textColor } : {}}
        >
          <span className={!col.useHex ? col.text : ''}>
            {formatTime12Hour(apt.start_time)} · {apt.patient_name}
          </span>
        </div>
        {apt.service_name && (
          <div
            className="text-xs truncate mt-0.5"
            style={col.useHex ? { color: col.subTextColor } : {}}
          >
            <span className={!col.useHex ? 'text-white/80' : ''}>{apt.service_name}</span>
          </div>
        )}
      </div>
    );
  };

  // ── Shared time-slot renderer (drop target) ───────────────────────────────
  // ── Nookal-style time slot renderer with 15-min intervals ───────────────────
  const renderTimeSlot = (slot: typeof timeSlots[0], date: Date, i: number, showLunchLabel = true, hasEvents = false) => {    const isSelected   = isSlotSelected(slot);
    const isDropTarget = dragState.isDragging;
    const isLunch      = isLunchBreak(slot.hour, slot.minutes);
    
    // Check availability using our helper functions
    const dayAvailable = isDutyDay(date);
    const hourAvailable = isDutyHour(slot.hour, slot.minutes, date);
    const isAvailable = dayAvailable && hourAvailable && !isLunch;

    // Lunch break rendering (only on duty days within duty hours)
    if (isLunch && dayAvailable && hourAvailable) {
      const lunchStart = practitionerAvailability?.lunch_start_time || '12:00';
      const lunchEnd = practitionerAvailability?.lunch_end_time || '13:00';
      const [lH, lM] = lunchStart.split(':').map(Number);
      const isFirstLunchSlot = slot.hour === lH && slot.minutes === lM;
      return (
        <div
          key={i}
          data-slot-date={format(date, 'yyyy-MM-dd')}
          data-slot-hour={slot.hour}
          data-slot-minute={slot.minutes}
          onMouseDown={() => handleMouseDown(date, slot)}
          onMouseEnter={() => handleMouseEnter(slot)}
          onMouseUp={() => handleSlotMouseUp(date, slot)}
          onDoubleClick={(e) => handleDoubleClick(date, slot, e.currentTarget as HTMLElement)}
          className={`h-6 relative select-none bg-amber-400 cursor-pointer border-r border-amber-500
            ${slot.quarter === 0 ? 'border-t border-amber-500' : 'border-t border-amber-400'}`}
        >
          {isFirstLunchSlot && showLunchLabel && (
            <div className="absolute inset-0 flex items-center px-2 z-10 pointer-events-none">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wide whitespace-nowrap">
                Lunch &nbsp;·&nbsp; {formatTime12Hour(lunchStart)} – {formatTime12Hour(lunchEnd)}
              </span>
            </div>
          )}
        </div>
      );
    }

    // Determine background class based on availability
    // COLOR RULES (Nookal-style):
    // - AVAILABLE (Duty Hours) → bg-white
    // - NOT AVAILABLE → bg-trust-harbor (non-duty hours/days)
    let slotBgClass = '';
    let slotTitle = 'Double-click or drag to add';

    if (!isAvailable) {
      // Non-duty hours or non-duty day = trust-harbor tint
      slotBgClass = 'bg-trust-harbor/30';
      if (!dayAvailable) {
        slotTitle = 'Non-duty day (click to add anyway)';
      } else if (!hourAvailable) {
        slotTitle = 'Outside duty hours (click to add anyway)';
      }
    } else if (isSelected) {
      slotBgClass = 'bg-sky-200 hover:bg-sky-300';
    } else if (isDropTarget) {
      slotBgClass = 'bg-white hover:bg-emerald-100';
    } else {
      // Available slot = PURE WHITE
      slotBgClass = 'bg-white hover:bg-sky-50';
    }

    // Border styling for clear 15-minute grid
    // Hour boundaries get thicker borders for visual clarity
    const borderClass = slot.quarter === 0 
      ? 'border-t border-gray-300' 
      : 'border-t border-gray-100';

    return (
      <div
        key={i}
        data-slot-date={format(date, 'yyyy-MM-dd')}
        data-slot-hour={slot.hour}
        data-slot-minute={slot.minutes}
        onMouseDown={() => handleMouseDown(date, slot)}
        onMouseEnter={() => handleMouseEnter(slot)}
        onMouseUp={() => handleSlotMouseUp(date, slot)}
        onDoubleClick={(e) => handleDoubleClick(date, slot, e.currentTarget as HTMLElement)}
        className={`h-6 transition-colors relative select-none cursor-pointer border-r border-gray-200 flex
          ${borderClass}
          ${slotBgClass}`}
        title={slotTitle}
      >
        {/* Left 90% — appointment/event area (drag, select, double-click) */}
        <div className="w-[90%] h-full relative">
          {isSelected && (
            <div className="absolute inset-0 bg-sky-200 pointer-events-none" />
          )}
          {isDropTarget && (
            <div className="absolute inset-0 border-b border-dashed border-emerald-300 pointer-events-none" />
          )}
        </div>
        {/* Right 10% — quick-action strip (only on slots with events) */}
        {hasEvents && (
          <div
            className="w-[10%] h-full cursor-pointer border-l border-gray-100/80 hover:bg-blue-50/60 transition-colors duration-100 flex items-center justify-center group/strip"
            onMouseDown={e => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (onSlotAction) {
                // Include the active practitioner filter so note/event creation
                // from the occupied-slot strip also inherits practitioner ownership.
                onSlotAction({ date, time: slot.time, hour: slot.hour, minutes: slot.minutes, duration: 15, practitionerId: numericPractitionerId });
              } else {
                openModal({ date, time: slot.time, hour: slot.hour, minutes: slot.minutes, duration: 15 });
              }
            }}
            title="Click to add appointment, block, or note"
          >
            <span className="text-[9px] text-gray-300 group-hover/strip:text-blue-400 font-bold leading-none select-none transition-colors">+</span>
          </div>
        )}
      </div>
    );
  };

  // ── Compare-mode time slot renderer ──────────────────────────────────────
  // Like renderTimeSlot but evaluates against an EXPLICIT availability object
  // instead of the component-level hooks. Used for each column in Compare Mode.
  const renderTimeSlotCompare = (
    slot: typeof timeSlots[0],
    date: Date,
    i: number,
    avail: PractitionerAvailability | undefined,
    colKey: string,
    hasEvents = false,
  ) => {
    const { isAvailable, isLunch, dayAvailable } = evalSlotAvailability(slot, date, avail);
    const isSelected   = isSlotSelected(slot);
    const isDropTarget = dragState.isDragging;

    if (isLunch && dayAvailable && avail) {
      return (
        <div
          key={`${colKey}-${i}`}
          data-slot-date={format(date, 'yyyy-MM-dd')}
          data-slot-hour={slot.hour}
          data-slot-minute={slot.minutes}
          onMouseDown={() => handleMouseDown(date, slot)}
          onMouseEnter={() => handleMouseEnter(slot)}
          onMouseUp={() => handleSlotMouseUp(date, slot)}
          onDoubleClick={(e) => handleDoubleClick(date, slot, e.currentTarget as HTMLElement)}
          className={`h-6 relative select-none bg-amber-400 cursor-pointer border-r border-amber-500
            ${slot.quarter === 0 ? 'border-t border-amber-500' : 'border-t border-amber-400'}`}
        />
      );
    }

    let slotBgClass = '';
    if (!isAvailable) {
      slotBgClass = 'bg-trust-harbor/30';
    } else if (isSelected) {
      slotBgClass = 'bg-sky-200 hover:bg-sky-300';
    } else if (isDropTarget) {
      slotBgClass = 'bg-white hover:bg-emerald-100';
    } else {
      slotBgClass = 'bg-white hover:bg-sky-50';
    }

    const borderClass = slot.quarter === 0 ? 'border-t border-gray-300' : 'border-t border-gray-100';

    return (
      <div
        key={`${colKey}-${i}`}
        data-slot-date={format(date, 'yyyy-MM-dd')}
        data-slot-hour={slot.hour}
        data-slot-minute={slot.minutes}
        onMouseDown={() => handleMouseDown(date, slot)}
        onMouseEnter={() => handleMouseEnter(slot)}
        onMouseUp={() => handleSlotMouseUp(date, slot)}
        onDoubleClick={(e) => handleDoubleClick(date, slot, e.currentTarget as HTMLElement)}
        className={`h-6 transition-colors relative select-none cursor-pointer border-r border-gray-200 flex ${borderClass} ${slotBgClass}`}
      >
        <div className="w-[90%] h-full relative">
          {isSelected && <div className="absolute inset-0 bg-sky-200 pointer-events-none" />}
          {isDropTarget && <div className="absolute inset-0 border-b border-dashed border-emerald-300 pointer-events-none" />}
        </div>
        {hasEvents && (
          <div
            className="w-[10%] h-full cursor-pointer border-l border-gray-100/80 hover:bg-blue-50/60 transition-colors duration-100 flex items-center justify-center group/strip"
            onMouseDown={e => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (onSlotAction) {
                onSlotAction({ date, time: slot.time, hour: slot.hour, minutes: slot.minutes, duration: 15 });
              } else {
                openModal({ date, time: slot.time, hour: slot.hour, minutes: slot.minutes, duration: 15 });
              }
            }}
            title="Click to add appointment, block, or note"
          >
            <span className="text-[9px] text-gray-300 group-hover/strip:text-blue-400 font-bold leading-none select-none transition-colors">+</span>
          </div>
        )}
      </div>
    );
  };

  // ── Global resize listeners — fire everywhere, not just inside the wrapper ──
  // Kept in refs so the effect closure always sees the latest version without
  // tearing down and re-attaching the listeners on every render.
  const handleResizeCommitRef = useRef(handleResizeCommit);
  const onResizeMoveRef       = useRef(onResizeMove);
  const cancelResizeRef       = useRef(cancelResize);
  handleResizeCommitRef.current = handleResizeCommit;
  onResizeMoveRef.current       = onResizeMove;
  cancelResizeRef.current       = cancelResize;

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: MouseEvent) => {
      // Synthesise a minimal React-compatible event shape for onResizeMove
      onResizeMoveRef.current(e as unknown as React.MouseEvent);
    };
    const onUp = () => { void handleResizeCommitRef.current(); };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
  }, [isResizing]);

  // ── Global mouse-move / mouse-up on the calendar wrapper ─────────────────
  const calendarWrapperProps = {
    style: (isResizing
      ? ({ cursor: 'ns-resize', userSelect: 'none' } as React.CSSProperties)
      : rebookMode
        ? ({ cursor: 'crosshair' } as React.CSSProperties)
        : undefined),
    onMouseMove: (e: React.MouseEvent) => {
      if (isResizing) return; // handled by document listener above
      onDragMove(e);
      onBlockDragMove(e);
      onNoteDragMove(e);
    },
    onMouseUp: () => {
      if (isResizing) return; // handled by document listener above
      if (!dragState.isDragging) cancelHold();
      if (!blockDragState.isDragging) cancelBlockHold();
      if (!noteDragState.isDragging) cancelNoteDrag();
    },
    onMouseLeave: () => {
      if (isResizing) return; // resize commits on mouseup anywhere — don't cancel on leave
      if (!dragState.isDragging) cancelHold();
      if (!blockDragState.isDragging) cancelBlockHold();
      if (!noteDragState.isDragging) cancelNoteDrag();
    },
  };

  // ── DAY VIEW ──────────────────────────────────────────────────────────────
  if (view === 'day') {

    // ── COMPARE MODE (Day) ───────────────────────────────────────────────────
    if (compareMode) {
      const nameA = comparePractitionerNames?.[0] ?? 'Practitioner A';
      const nameB = comparePractitionerNames?.[1] ?? 'Practitioner B';
      const dayAppts = getAppointmentsForDate(currentDate);
      const dayBlocks = getBlockAppointmentsForDate(currentDate);
      const colAAppts = dayAppts.filter(a =>
        comparePractitionerIdA != null ? a.practitioner === comparePractitionerIdA : true
      );
      const colBAppts = dayAppts.filter(a =>
        comparePractitionerIdB != null ? a.practitioner === comparePractitionerIdB : true
      );
      // Blocks scoped to a practitioner only appear in that practitioner's column;
      // clinic-wide blocks (practitioner_id === null) appear in every column.
      // Participant blocks also appear in a practitioner's column when their
      // practitioner ID is in participant_practitioner_ids.
      const colABlocks = dayBlocks.filter(b =>
        b.practitioner_id === null ||
        b.practitioner_id === comparePractitionerIdA ||
        (comparePractitionerIdA != null && b.participant_practitioner_ids?.includes(comparePractitionerIdA))
      );
      const colBBlocks = dayBlocks.filter(b =>
        b.practitioner_id === null ||
        b.practitioner_id === comparePractitionerIdB ||
        (comparePractitionerIdB != null && b.participant_practitioner_ids?.includes(comparePractitionerIdB))
      );

      return (
        <div {...calendarWrapperProps} className="h-full flex flex-col">
          <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden">

            {/* Day header */}
            <div className="flex-shrink-0 p-3 border-b border-gray-200 bg-gray-50 text-center">
              <h3 className="text-base font-semibold text-gray-900">
                {format(currentDate, 'EEEE, MMMM d, yyyy')}
              </h3>
              <p className="text-xs text-sky-600 font-medium mt-0.5">Compare Mode — side-by-side schedules</p>
            </div>

            {/* Practitioner column headers */}
            <div className="flex-shrink-0 grid grid-cols-[80px_1fr_1fr] border-b border-gray-200">
              <div className="bg-gray-50 border-r border-gray-200" />
              {/* Prac A header */}
              <div className="py-3 px-4 bg-sky-50 border-r border-gray-200 text-center">
                <div className="text-sm font-bold text-sky-700 truncate">{nameA}</div>
                <div className="flex items-center justify-center gap-2 mt-1 text-xs text-sky-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-white border border-sky-300 inline-block" />
                    Duty
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 bg-trust-harbor/30 inline-block" />
                    Off
                  </span>
                </div>
              </div>
              {/* Prac B header */}
              <div className="py-3 px-4 bg-violet-50 text-center">
                <div className="text-sm font-bold text-violet-700 truncate">{nameB}</div>
                <div className="flex items-center justify-center gap-2 mt-1 text-xs text-violet-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-white border border-violet-300 inline-block" />
                    Duty
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 bg-trust-harbor/30 inline-block" />
                    Off
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="grid grid-cols-[80px_1fr_1fr]">
                {/* Time column */}
                <div className="border-r border-gray-200 sticky left-0 bg-gray-50 z-10">
                  {timeSlots.map((slot, i) => renderTimeLabel(slot, i))}
                </div>
                {/* Practitioner A column */}
                <div className="border-r border-gray-200 relative" onMouseUp={() => handleMouseUp(currentDate)}>
                  {timeSlots.map((slot, i) => {
                    const slotMin = slot.hour * 60 + slot.minutes;
                    const occupied = [...colAAppts, ...colABlocks].some(ev => {
                      const [sh, sm] = ev.start_time.split(':').map(Number);
                      const [eh, em] = ev.end_time.split(':').map(Number);
                      return sh * 60 + sm < slotMin + 15 && eh * 60 + em > slotMin;
                    });
                    return renderTimeSlotCompare(slot, currentDate, i, compareAvailabilityA, 'a', occupied);
                  })}
                  {colAAppts.map(apt => renderTimelineCard(apt, false, false))}
                  {colABlocks.map(block => renderBlockTimelineCard(block, false, false))}
                </div>
                {/* Practitioner B column */}
                <div className="relative" onMouseUp={() => handleMouseUp(currentDate)}>
                  {timeSlots.map((slot, i) => {
                    const slotMin = slot.hour * 60 + slot.minutes;
                    const occupied = [...colBAppts, ...colBBlocks].some(ev => {
                      const [sh, sm] = ev.start_time.split(':').map(Number);
                      const [eh, em] = ev.end_time.split(':').map(Number);
                      return sh * 60 + sm < slotMin + 15 && eh * 60 + em > slotMin;
                    });
                    return renderTimeSlotCompare(slot, currentDate, i, compareAvailabilityB, 'b', occupied);
                  })}
                  {colBAppts.map(apt => renderTimelineCard(apt, false, false))}
                  {colBBlocks.map(block => renderBlockTimelineCard(block, false, false))}
                </div>
              </div>
            </div>
          </div>
          {sharedModals}
          {dragOverlays}
          {rescheduleModal}
          {hoverCardOverlay}
          {blockHoverCardOverlay}
          {noteHoverCardOverlay}
          {noteModalOverlay}
        </div>
      );
    }

    // ── MULTI-PRACTITIONER DAY VIEW ─────────────────────────────────────────
    // Triggered when All-Practitioners mode is active and a practitioners list
    // is provided. Renders one column per practitioner side-by-side.
    if (!selectedPractitionerId && multiPractitioners && multiPractitioners.length > 0) {
      const pCount   = multiPractitioners.length;
      const gridCols = `80px repeat(${pCount}, minmax(0, 1fr))`;
      const minWidth = 80 + pCount * 180;
      const dayAppts  = getAppointmentsForDate(currentDate);
      const dayBlocks = getBlockAppointmentsForDate(currentDate);
      const dayNotes  = getNotesForDate(currentDate);

      // Per-column slot renderer — mirrors renderTimeSlotCompare but routes
      // double-click / mouse-up through the column-aware handlers so the
      // practitioner id is forwarded to onSlotAction.
      const renderColumnSlot = (
        slot: typeof timeSlots[0],
        date: Date,
        i: number,
        avail: PractitionerAvailability | undefined,
        colKey: string,
        hasEvents: boolean,
        practId: number | null,
      ) => {
        const { isAvailable, isLunch, dayAvailable } = evalSlotAvailability(slot, date, avail);
        const isSelected   = isSlotSelected(slot);
        const isDropTarget = dragState.isDragging;

        if (isLunch && dayAvailable && avail) {
          const [lH, lM] = avail.lunch_start_time.split(':').map(Number);
          const isFirstLunchSlot = slot.hour === lH && slot.minutes === lM;
          return (
            <div
              key={`${colKey}-${i}`}
              data-slot-date={format(date, 'yyyy-MM-dd')}
              data-slot-hour={slot.hour}
              data-slot-minute={slot.minutes}
              onMouseDown={() => handleMouseDown(date, slot)}
              onMouseEnter={() => handleMouseEnter(slot)}
              onMouseUp={() => handleColumnSlotMouseUp(date, slot, practId)}
              onDoubleClick={(e) => handleColumnDoubleClick(date, slot, practId, e.currentTarget as HTMLElement)}
              className={`h-6 relative select-none bg-amber-400 cursor-pointer border-r border-amber-500 ${slot.quarter === 0 ? 'border-t border-amber-500' : 'border-t border-amber-400'}`}
            >
              {isFirstLunchSlot && (
                <div className="absolute inset-0 flex items-center px-2 z-10 pointer-events-none">
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wide whitespace-nowrap">Lunch</span>
                </div>
              )}
            </div>
          );
        }

        let slotBgClass = '';
        if (!isAvailable) {
          slotBgClass = 'bg-trust-harbor/30';
        } else if (isSelected) {
          slotBgClass = 'bg-sky-200 hover:bg-sky-300';
        } else if (isDropTarget) {
          slotBgClass = 'bg-white hover:bg-emerald-100';
        } else {
          slotBgClass = 'bg-white hover:bg-sky-50';
        }

        const borderClass = slot.quarter === 0 ? 'border-t border-gray-300' : 'border-t border-gray-100';

        return (
          <div
            key={`${colKey}-${i}`}
            data-slot-date={format(date, 'yyyy-MM-dd')}
            data-slot-hour={slot.hour}
            data-slot-minute={slot.minutes}
            onMouseDown={() => handleMouseDown(date, slot)}
            onMouseEnter={() => handleMouseEnter(slot)}
            onMouseUp={() => handleColumnSlotMouseUp(date, slot, practId)}
            onDoubleClick={(e) => handleColumnDoubleClick(date, slot, practId, e.currentTarget as HTMLElement)}
            className={`h-6 transition-colors relative select-none cursor-pointer border-r border-gray-200 flex ${borderClass} ${slotBgClass}`}
          >
            <div className="w-[90%] h-full relative">
              {isSelected && <div className="absolute inset-0 bg-sky-200 pointer-events-none" />}
              {isDropTarget && <div className="absolute inset-0 border-b border-dashed border-emerald-300 pointer-events-none" />}
            </div>
            {hasEvents && (
              <div
                className="w-[10%] h-full cursor-pointer border-l border-gray-100/80 hover:bg-blue-50/60 transition-colors duration-100 flex items-center justify-center group/strip"
                onMouseDown={e => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSlotAction) {
                    onSlotAction({ date, time: slot.time, hour: slot.hour, minutes: slot.minutes, duration: 15, practitionerId: practId });
                  } else {
                    openModal({ date, time: slot.time, hour: slot.hour, minutes: slot.minutes, duration: 15 });
                  }
                }}
                title="Click to add appointment, block, or note"
              >
                <span className="text-[9px] text-gray-300 group-hover/strip:text-blue-400 font-bold leading-none select-none transition-colors">+</span>
              </div>
            )}
          </div>
        );
      };

      return (
        <div {...calendarWrapperProps} className="h-full flex flex-col">
          <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden">

            {/* Date header */}
            <div className="shrink-0 px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                {format(currentDate, 'EEEE, MMMM d, yyyy')}
              </h3>
              <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full font-medium">
                {pCount} practitioner{pCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Practitioner column headers */}
            <div
              className="shrink-0 border-b border-gray-200 overflow-x-auto"
              style={{ display: 'grid', gridTemplateColumns: gridCols, minWidth: `${minWidth}px` }}
            >
              <div className="bg-gray-50 border-r border-gray-200" />
              {multiPractitioners.map((p, idx) => {
                const colors = COL_HEADER_COLORS[idx % COL_HEADER_COLORS.length];
                return (
                  <div key={String(p.id)} className={`py-3 px-3 ${colors.bg} border-l border-gray-200 text-center`}>
                    <div className={`text-sm font-bold ${colors.text} truncate`}>{p.name}</div>
                    {p.specialization && (
                      <div className={`text-xs ${colors.sub} truncate mt-0.5`}>{p.specialization}</div>
                    )}
                    {p.availability && (
                      <div className={`text-[11px] ${colors.sub} mt-1`}>
                        {formatTime12Hour(p.availability.duty_start_time)} – {formatTime12Hour(p.availability.duty_end_time)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Scrollable grid body */}
            <div className="flex-1 overflow-y-auto min-h-0 overflow-x-auto">
              <div style={{ display: 'grid', gridTemplateColumns: gridCols, minWidth: `${minWidth}px` }}>
                {/* Time column */}
                <div className="border-r border-gray-200 sticky left-0 bg-gray-50 z-10">
                  {timeSlots.map((slot, i) => renderTimeLabel(slot, i))}
                </div>
                {/* Practitioner columns */}
                {multiPractitioners.map((p) => {
                  const practId  = typeof p.id === 'number' ? p.id : null;
                  const colAppts = practId != null ? dayAppts.filter(a => a.practitioner === practId) : [];
                  // Notes with a practitioner assigned show only in that column;
                  // notes with practitioner===null are clinic-wide and appear in every column.
                  const colNotes = dayNotes.filter(
                    n => n.practitioner === null || n.practitioner === undefined || n.practitioner === practId,
                  );
                  // Blocks scoped to a practitioner only appear in that practitioner's column;
                  // clinic-wide blocks (practitioner_id === null) appear in every column.
                  // Participant blocks also appear when the practitioner is a participant.
                  const colBlocks = dayBlocks.filter(b =>
                    b.practitioner_id === null ||
                    b.practitioner_id === practId ||
                    (practId != null && b.participant_practitioner_ids?.includes(practId))
                  );
                  const { aptStyles, blockStyles, noteStyles } = computeColumnLayout(colAppts, colBlocks, colNotes);
                  return (
                    <div
                      key={String(p.id)}
                      className="border-l border-gray-200 relative"
                      onMouseUp={() => handleColumnMouseUp(currentDate, practId)}
                    >
                      {timeSlots.map((slot, i) => {
                        const slotMin  = slot.hour * 60 + slot.minutes;
                        const occupied = [...colAppts, ...colBlocks, ...colNotes].some(ev => {
                          const [sh, sm] = ev.start_time.split(':').map(Number);
                          const [eh, em] = ev.end_time.split(':').map(Number);
                          return sh * 60 + sm < slotMin + 15 && eh * 60 + em > slotMin;
                        });
                        return renderColumnSlot(slot, currentDate, i, p.availability, String(p.id), occupied, practId);
                      })}
                      {colAppts.map(apt   => renderTimelineCard(apt, false, false, aptStyles.get(apt.id)))}
                      {colBlocks.map(block => renderBlockTimelineCard(block, false, false, blockStyles.get(block.id)))}
                      {colNotes.map(note   => renderNoteTimelineCard(note, false, false, noteStyles.get(note.id)))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stats footer — one DayStatsBlock per column */}
            <div
              className="shrink-0 border-t border-gray-200 overflow-x-auto"
              style={{ display: 'grid', gridTemplateColumns: gridCols, minWidth: `${minWidth}px` }}
            >
              <div className="bg-gray-50 border-r border-gray-200" />
              {multiPractitioners.map((p) => {
                const practId  = typeof p.id === 'number' ? p.id : null;
                const colAppts = practId != null ? dayAppts.filter(a => a.practitioner === practId) : [];
                return (
                  <DayStatsBlock
                    key={String(p.id)}
                    date={currentDate}
                    appointments={colAppts}
                    availability={p.availability}
                    compact
                  />
                );
              })}
            </div>
          </div>
          {sharedModals}
          {dragOverlays}
          {rescheduleModal}
          {hoverCardOverlay}
          {blockHoverCardOverlay}
          {noteHoverCardOverlay}
          {noteModalOverlay}
        </div>
      );
    }

    // ── SINGLE-PRACTITIONER DAY VIEW (default) ──────────────────────────────
    const dayOfWeek = DAY_MAP[currentDate.getDay()];
    const isDayAvailable = !practitionerAvailability || practitionerAvailability.duty_days.includes(dayOfWeek);
    // Users can still click and create appointments on non-duty days/hours

    return (
      <div {...calendarWrapperProps} className="h-full flex flex-col">
        <div className={`flex flex-col h-full rounded-xl border overflow-hidden ${isDayAvailable ? 'bg-white border-gray-200' : 'bg-trust-harbor/5 border-trust-harbor/20'}`}>
          <div className={`flex-shrink-0 p-4 border-b ${isDayAvailable ? 'border-gray-200 bg-gray-50' : 'border-trust-harbor/20 bg-trust-harbor/10'}`}>
            <div className="text-center">
              <h3 className={`text-lg font-semibold ${isDayAvailable ? 'text-gray-900' : 'text-trust-harbor'}`}>
                {format(currentDate, 'EEEE, MMMM d, yyyy')}
              </h3>
              {!isDayAvailable && (
                <p className="text-sm text-trust-harbor mt-1">
                  ⚠️ Non-duty day (appointments can still be added)
                </p>
              )}
              {dragState.isDragging && (
                <p className="text-xs text-emerald-600 font-medium mt-1 animate-pulse">
                  🗓 Hover a time slot and release to reschedule
                </p>
              )}
              {blockDragState.isDragging && (
                <p className="text-xs text-emerald-600 font-medium mt-1 animate-pulse">
                  🗓 Hover a time slot and release to reschedule event
                </p>
              )}
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {(() => {
              const dayAppts  = getAppointmentsForDate(currentDate);
              const dayBlocks = getBlockAppointmentsForDate(currentDate);
              const dayNotes  = getNotesForDate(currentDate);
              const slotsToRender = isDayAvailable ? dayViewTimeSlots : timeSlots;
              const { aptStyles, blockStyles, noteStyles } = computeColumnLayout(dayAppts, dayBlocks, dayNotes);
              return (
                <div className="grid grid-cols-[80px_1fr]">
                  {/* Time column */}
                  <div className="border-r border-gray-200 sticky left-0 bg-gray-50 z-10">
                    {slotsToRender.map((slot, i) => renderTimeLabel(slot, i))}
                  </div>
                  {/* Day column — cards auto-offset when overlapping */}
                  <div className="relative" onMouseUp={() => handleMouseUp(currentDate)}>
                    {slotsToRender.map((slot, i) => {
                      const slotMin = slot.hour * 60 + slot.minutes;
                      const occupied = [...dayAppts, ...dayBlocks, ...dayNotes].some(ev => {
                        const [sh, sm] = ev.start_time.split(':').map(Number);
                        const [eh, em] = ev.end_time.split(':').map(Number);
                        return sh * 60 + sm < slotMin + 15 && eh * 60 + em > slotMin;
                      });
                      return renderTimeSlot(slot, currentDate, i, true, occupied);
                    })}
                    {dayAppts.map(apt   => renderTimelineCard(apt, false, isDayAvailable, aptStyles.get(apt.id)))}
                    {dayBlocks.map(block => renderBlockTimelineCard(block, false, isDayAvailable, blockStyles.get(block.id)))}
                    {dayNotes.map(note   => renderNoteTimelineCard(note, false, isDayAvailable, noteStyles.get(note.id)))}
                  </div>
                </div>
              );
            })()}
          </div>
          {/* ── Day statistics footer ── */}
          <DayStatsBlock
            date={currentDate}
            appointments={getAppointmentsForDate(currentDate)}
            availability={practitionerAvailability}
          />
        </div>
        {sharedModals}
        {dragOverlays}
        {rescheduleModal}
        {hoverCardOverlay}
        {blockHoverCardOverlay}
        {noteHoverCardOverlay}
        {noteModalOverlay}
      </div>
    );
  }

  // ── WEEK VIEW ─────────────────────────────────────────────────────────────
  if (view === 'week') {
    const weekDays = getWeekDays(currentDate);

    // ── COMPARE MODE (Week) ─────────────────────────────────────────────────
    if (compareMode) {
      const nameA = comparePractitionerNames?.[0] ?? 'Practitioner A';
      const nameB = comparePractitionerNames?.[1] ?? 'Practitioner B';
      // 14 data columns (2 per day) + 1 time col
      const gridCols = `80px repeat(14, 1fr)`;

      return (
        <div {...calendarWrapperProps} className="h-full flex flex-col">
          <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden">

            {dragState.isDragging && (
              <div className="flex-shrink-0 bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs text-emerald-700 font-medium text-center animate-pulse">
                🗓 Hover a time slot and release to reschedule
              </div>
            )}

            {/* Scrollable body — header is sticky inside so it always aligns with columns */}
            <div className="flex-1 overflow-y-auto min-h-0 [scrollbar-gutter:stable]">
              {/* Compare banner — sticky inside scroll container */}
              <div
                className="sticky top-0 z-20 border-b border-gray-200 bg-gray-50"
                style={{ display: 'grid', gridTemplateColumns: gridCols }}
              >
                <div className="p-2 border-r border-gray-200 flex items-center justify-center bg-gray-50">
                  <span className="text-xs font-semibold text-gray-500">Wk</span>
                </div>
                {weekDays.map(day => (
                  <React.Fragment key={day.toISOString()}>
                    {/* Prac A sub-header */}
                    <div className={`p-2 text-center border-l border-gray-200 bg-sky-50 ${isSameDay(day, new Date()) ? 'ring-inset ring-1 ring-sky-300' : ''}`}>
                      <div className="text-xs font-semibold text-sky-700 truncate leading-tight">
                        {nameA.split(' ')[0]}
                      </div>
                      <div className="text-xs text-gray-500 leading-tight">{format(day, 'EEE d')}</div>
                    </div>
                    {/* Prac B sub-header */}
                    <div className={`p-2 text-center border-l border-gray-200 bg-violet-50 ${isSameDay(day, new Date()) ? 'ring-inset ring-1 ring-violet-300' : ''}`}>
                      <div className="text-xs font-semibold text-violet-700 truncate leading-tight">
                        {nameB.split(' ')[0]}
                      </div>
                      <div className="text-xs text-gray-500 leading-tight">{format(day, 'EEE d')}</div>
                    </div>
                  </React.Fragment>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: gridCols }}>
                {/* Time column */}
                <div className="border-r border-gray-200 sticky left-0 bg-gray-50 z-10">
                  {timeSlots.map((slot, i) => renderTimeLabel(slot, i))}
                </div>
                {/* Day columns — 2 sub-columns per day */}
                {weekDays.map(day => {
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const dayAppts  = getAppointmentsForDate(day);
                  const dayBlocks = getBlockAppointmentsForDate(day);
                  const dayNotes  = getNotesForDate(day);
                  const colAAppts = dayAppts.filter(a =>
                    comparePractitionerIdA != null ? a.practitioner === comparePractitionerIdA : true
                  );
                  const colBAppts = dayAppts.filter(a =>
                    comparePractitionerIdB != null ? a.practitioner === comparePractitionerIdB : true
                  );
                  // Blocks: clinic-wide (practitioner_id===null) appear in every column;
                  // practitioner-scoped blocks appear only in the matching column.
                  // Participant blocks also appear when the practitioner is a participant.
                  const colABlocks = dayBlocks.filter(b =>
                    b.practitioner_id === null ||
                    b.practitioner_id === comparePractitionerIdA ||
                    (comparePractitionerIdA != null && b.participant_practitioner_ids?.includes(comparePractitionerIdA))
                  );
                  const colBBlocks = dayBlocks.filter(b =>
                    b.practitioner_id === null ||
                    b.practitioner_id === comparePractitionerIdB ||
                    (comparePractitionerIdB != null && b.participant_practitioner_ids?.includes(comparePractitionerIdB))
                  );
                  // Notes: clinic-wide (practitioner===null) appear in every column;
                  // practitioner-scoped notes appear only in the matching column.
                  const colANotes = dayNotes.filter(n =>
                    n.practitioner === null || n.practitioner === undefined || n.practitioner === comparePractitionerIdA
                  );
                  const colBNotes = dayNotes.filter(n =>
                    n.practitioner === null || n.practitioner === undefined || n.practitioner === comparePractitionerIdB
                  );
                  return (
                    <React.Fragment key={day.toISOString()}>
                      {/* Prac A sub-column */}
                      <div className="border-l border-gray-200 relative">
                        {timeSlots.map((slot, i) => {
                          const slotMin = slot.hour * 60 + slot.minutes;
                          const occupied = [...colAAppts, ...colABlocks, ...colANotes].some(ev => {
                            const [sh, sm] = ev.start_time.split(':').map(Number);
                            const [eh, em] = ev.end_time.split(':').map(Number);
                            return sh * 60 + sm < slotMin + 15 && eh * 60 + em > slotMin;
                          });
                          return renderTimeSlotCompare(slot, day, i, compareAvailabilityA, `a-${dayStr}`, occupied);
                        })}
                        {colAAppts.map(apt   => renderTimelineCard(apt, true))}
                        {colABlocks.map(block => renderBlockTimelineCard(block, true))}
                        {colANotes.map(note   => renderNoteTimelineCard(note, true))}
                      </div>
                      {/* Prac B sub-column */}
                      <div className="border-l border-gray-200 relative">
                        {timeSlots.map((slot, i) => {
                          const slotMin = slot.hour * 60 + slot.minutes;
                          const occupied = [...colBAppts, ...colBBlocks, ...colBNotes].some(ev => {
                            const [sh, sm] = ev.start_time.split(':').map(Number);
                            const [eh, em] = ev.end_time.split(':').map(Number);
                            return sh * 60 + sm < slotMin + 15 && eh * 60 + em > slotMin;
                          });
                          return renderTimeSlotCompare(slot, day, i, compareAvailabilityB, `b-${dayStr}`, occupied);
                        })}
                        {colBAppts.map(apt   => renderTimelineCard(apt, true))}
                        {colBBlocks.map(block => renderBlockTimelineCard(block, true))}
                        {colBNotes.map(note   => renderNoteTimelineCard(note, true))}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
          {sharedModals}
          {dragOverlays}
          {rescheduleModal}
          {hoverCardOverlay}
          {blockHoverCardOverlay}
          {noteHoverCardOverlay}
          {noteModalOverlay}
        </div>
      );
    }

    return (
      <div {...calendarWrapperProps} className="h-full flex flex-col">
        <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden">

          {dragState.isDragging && (
            <div className="flex-shrink-0 bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs text-emerald-700 font-medium text-center animate-pulse">
              🗓 Hover a time slot and release to reschedule
            </div>
          )}

          {/* ── Scrollable body (header is sticky inside to stay aligned with columns) ── */}
          <div className="flex-1 overflow-y-auto min-h-0 [scrollbar-gutter:stable]">
            {/* Sticky day-header row — lives inside scroll container so columns always align */}
            <div className="sticky top-0 z-20 grid grid-cols-[80px_repeat(7,1fr)] border-b border-gray-200 bg-gray-50">
              <div className="p-4 border-r border-gray-200 bg-gray-50" />
              {weekDays.map(day => {
                const isAvailableDay = isDutyDay(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`p-4 text-center border-l border-gray-200 ${!isAvailableDay ? 'bg-trust-harbor/20' : 'bg-white'}`}
                  >
                    <div className={`text-xs font-medium uppercase ${!isAvailableDay ? 'text-trust-harbor' : 'text-gray-500'}`}>{format(day, 'EEE')}</div>
                    <div className={`text-sm font-semibold mt-1 ${!isAvailableDay ? 'text-trust-harbor' : ''} ${isSameDay(day, new Date()) ? 'bg-sky-600 text-white w-6 h-6 rounded-full flex items-center justify-center mx-auto text-xs' : 'text-gray-700'}`}>
                      {format(day, 'd')}
                    </div>
                    {!isAvailableDay && (
                      <div className="text-xs text-trust-harbor/70 mt-1">Non-duty</div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-[80px_repeat(7,1fr)]">
              {/* Time column */}
              <div className="border-r border-gray-200 sticky left-0 bg-gray-50 z-10">
                {timeSlots.map((slot, i) => renderTimeLabel(slot, i))}
              </div>
              {/* Day columns — cards auto-offset when overlapping */}
              {weekDays.map(day => {
                const dayAppts  = getAppointmentsForDate(day);
                const allDayBlocks = getBlockAppointmentsForDate(day);
                const allDayNotes  = getNotesForDate(day);

                // Practitioner-scoping: when a specific practitioner is selected,
                // only show blocks/notes belonging to that practitioner or clinic-wide
                // (practitioner_id === null). This mirrors the Day View multi-prac
                // column isolation logic (lines 2509-2516).
                // Also include blocks where the practitioner is a participant.
                const dayBlocks = numericPractitionerId !== null
                  ? allDayBlocks.filter(b =>
                      b.practitioner_id === null ||
                      b.practitioner_id === numericPractitionerId ||
                      b.participant_practitioner_ids?.includes(numericPractitionerId)
                    )
                  : allDayBlocks;
                const dayNotes = numericPractitionerId !== null
                  ? allDayNotes.filter(n =>
                      n.practitioner === null || n.practitioner === undefined ||
                      n.practitioner === numericPractitionerId
                    )
                  : allDayNotes;

                const { aptStyles, blockStyles, noteStyles } = computeColumnLayout(dayAppts, dayBlocks, dayNotes);
                return (
                  <div key={day.toISOString()} className="border-l border-gray-200 relative">
                    {timeSlots.map((slot, i) => {
                      const slotMin = slot.hour * 60 + slot.minutes;
                      const occupied = [...dayAppts, ...dayBlocks, ...dayNotes].some(ev => {
                        const [sh, sm] = ev.start_time.split(':').map(Number);
                        const [eh, em] = ev.end_time.split(':').map(Number);
                        return sh * 60 + sm < slotMin + 15 && eh * 60 + em > slotMin;
                      });
                      return renderTimeSlot(slot, day, i, false, occupied);
                    })}
                    {dayAppts.map(apt   => renderTimelineCard(apt, true, false, aptStyles.get(apt.id)))}
                    {dayBlocks.map(block => renderBlockTimelineCard(block, true, false, blockStyles.get(block.id)))}
                    {dayNotes.map(note   => renderNoteTimelineCard(note, true, false, noteStyles.get(note.id)))}
                  </div>
                );
              })}
            </div>
          </div>
          {/* ── Weekly statistics footer row ── */}
          <div className="shrink-0 border-t border-gray-200 grid grid-cols-[80px_repeat(7,1fr)] pb-18">
            <div className="bg-gray-50 border-r border-gray-200" />
            {weekDays.map(day => (
              <DayStatsBlock
                key={day.toISOString()}
                date={day}
                appointments={getAppointmentsForDate(day)}
                availability={practitionerAvailability}
                compact
              />
            ))}
          </div>
        </div>
        {sharedModals}
        {dragOverlays}
        {rescheduleModal}
        {hoverCardOverlay}
        {blockHoverCardOverlay}
        {noteHoverCardOverlay}
        {noteModalOverlay}
      </div>
    );
  }

  // ── MONTH VIEW ────────────────────────────────────────────────────────────
  if (view === 'month') {
    const monthDays    = getMonthDays();
    const weekDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return (
      <div {...calendarWrapperProps}>
        <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden">
          {dragState.isDragging && (
            <div className="flex-shrink-0 bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs text-emerald-700 font-medium text-center animate-pulse">
              🗓 Release on a date cell to reschedule (time will be set to original time)
            </div>
          )}
          {blockDragState.isDragging && (
            <div className="flex-shrink-0 bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs text-emerald-700 font-medium text-center animate-pulse">
              🗓 Release on a date cell to reschedule event (time will be set to original time)
            </div>
          )}

          <div className="flex-shrink-0 grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {weekDayNames.map(d => (
              <div key={d} className="p-4 text-center text-sm font-semibold text-gray-700 border-r border-gray-200 last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-auto">
            {monthDays.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-gray-200 last:border-b-0">
                {week.map(day => {
                  const dayAppts      = getAppointmentsForDay(day);
                  const dayBlockAppts = getBlockAppointmentsForDate(day);
                  const dayNoteItems  = getNotesForDate(day);
                  const count         = dayAppts.length + dayBlockAppts.length + dayNoteItems.length;
                  const isDropTarget  = dragState.isDragging || blockDragState.isDragging;

                  // Use our helper function to check if this is a duty day
                  const isAvailableDay = isDutyDay(day);

                  // Determine background color based on availability
                  // Nookal-style: Duty days = WHITE, Non-duty days = PURPLE
                  let dayBgClass = '';
                  if (!isAvailableDay) {
                    dayBgClass = 'bg-purple-200'; // Non-duty day = PURPLE
                  } else if (!isSameMonth(day, currentDate)) {
                    dayBgClass = 'bg-gray-50'; // Different month
                  } else if (isSameDay(day, new Date())) {
                    dayBgClass = 'bg-sky-50'; // Today
                  } else {
                    dayBgClass = 'bg-white'; // Available duty day = WHITE
                  }

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => {
                        // ALL days are clickable (no disabled state)
                        if (dragState.isDragging && dragState.draggedAppointment) {
                          const [origH, origM] = dragState.draggedAppointment.start_time.split(':').map(Number);
                          onDropOnSlot(day, origH, origM);
                          return;
                        }
                        if (blockDragState.isDragging && blockDragState.draggedBlock) {
                          const [origH, origM] = blockDragState.draggedBlock.start_time.split(':').map(Number);
                          onBlockDropOnSlot(day, origH, origM);
                          return;
                        }
                        onDateChange(day);
                      }}
                      className={`min-h-[120px] p-2 border-r border-gray-200 last:border-r-0 transition-colors relative cursor-pointer
                        ${dayBgClass}
                        ${isDropTarget ? 'hover:bg-emerald-50 hover:border-emerald-300' : 'hover:brightness-95'}
                      `}
                    >
                      {isDropTarget && (
                        <div className="absolute inset-0 border-2 border-dashed border-emerald-300 pointer-events-none opacity-0 hover:opacity-100 transition-opacity" />
                      )}
                      <div className="flex items-center justify-between mb-1">
                        <div className={`text-sm font-medium
                          ${!isSameMonth(day, currentDate) ? 'text-gray-400' : !isAvailableDay ? 'text-purple-600' : 'text-gray-700'}
                          ${isSameDay(day, new Date()) ? 'bg-sky-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold' : ''}`}
                        >
                          {format(day, 'd')}
                        </div>
                        {count > 0 && (
                          <div className="bg-green-600 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full">
                            {count}
                          </div>
                        )}
                      </div>
                      {!isAvailableDay && (
                        <div className="text-xs text-purple-600 mb-1">Non-duty day</div>
                      )}
                      <div className="space-y-1 mt-2 relative">
                        {/* Regular appointments */}
                        {dayAppts.slice(0, 3).map(apt => renderMonthCard(apt))}
                        {/* Block appointments */}
                        {dayBlockAppts.slice(0, 2).map(block => {
                          const handleBlockClick = (e: React.MouseEvent) => {
                            e.stopPropagation();
                            if (!blockDragState.isDragging) {
                              onEventClick?.(block);
                            }
                          };
                          const handleBlockMouseEnter = (e: React.MouseEvent) => {
                            if (!blockDragState.isDragging) {
                              onBlockMouseEnter(block, e);
                            }
                          };
                          const handleBlockMouseLeave = () => {
                            if (!blockDragState.isDragging) {
                              onBlockMouseLeave();
                            }
                          };
                          const handleBlockMouseDown = (e: React.MouseEvent) => {
                            e.stopPropagation();
                            hideBlockHover();
                            startBlockHold(block, e);
                          };
                          return (
                            <div
                              key={block.id}
                              onClick={handleBlockClick}
                              onMouseEnter={handleBlockMouseEnter}
                              onMouseLeave={handleBlockMouseLeave}
                              onMouseDown={handleBlockMouseDown}
                              className="bg-gray-800 text-white text-xs px-2 py-1 truncate font-medium border border-gray-600 hover:bg-gray-700 cursor-pointer transition-all duration-150 shadow-sm"
                              title="Hold 2s to drag and reschedule"
                            >
                              <div className="font-semibold">{block.event_name}</div>
                              <div className="text-gray-300">
                                {formatTime12Hour(block.start_time)} - {formatTime12Hour(block.end_time)}
                              </div>
                              {block.created_by_name && (
                                <div className="text-gray-400">
                                  Created by {block.created_by_name}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {count > 3 && (
                          <div className="text-xs text-gray-500 font-medium px-2">+{count - 3} more</div>
                        )}
                        {/* Notes */}
                        {dayNoteItems.slice(0, 2).map(note => renderNoteMonthCard(note))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {sharedModals}
        {dragOverlays}
        {rescheduleModal}
        {hoverCardOverlay}
        {blockHoverCardOverlay}
        {noteHoverCardOverlay}
        {noteModalOverlay}
      </div>
    );
  }

  return null;
};

export const Calendar = React.memo(CalendarComponent);
Calendar.displayName = 'Calendar';