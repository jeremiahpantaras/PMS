import logging
from datetime import date
from typing import Dict, List
from collections import defaultdict
from django.db.models import Q
from apps.clinics.models import Practitioner
from apps.appointments.models import Appointment, BlockAppointment

logger = logging.getLogger(__name__)

DAY_MAP = {
    0: 'Mon',
    1: 'Tue',
    2: 'Wed',
    3: 'Thu',
    4: 'Fri',
    5: 'Sat',
    6: 'Sun'
}

def time_to_mins(t) -> int:
    return t.hour * 60 + t.minute

def subtract_interval(working_ranges: List[tuple], subtract_start: int, subtract_end: int) -> List[tuple]:
    """Subtract an interval (subtract_start, subtract_end) from a list of working ranges."""
    if subtract_end <= subtract_start:
        return working_ranges
        
    new_ranges = []
    for r_start, r_end in working_ranges:
        if subtract_end <= r_start or subtract_start >= r_end:
            new_ranges.append((r_start, r_end))
        else:
            if r_start < subtract_start:
                new_ranges.append((r_start, subtract_start))
            if r_end > subtract_end:
                new_ranges.append((subtract_end, r_end))
    return new_ranges

def calculate_daily_availability(practitioner: Practitioner, target_date: date, blocks: List[BlockAppointment]) -> int:
    """
    Returns the total available consulting minutes for a practitioner on a specific date.
    Excludes:
    - Out of schedule time
    - Lunch breaks
    - Manual BlockAppointments
    """
    day_key = DAY_MAP[target_date.weekday()]
    
    if day_key not in (practitioner.duty_days or []):
        return 0

    working_ranges = []

    if practitioner.duty_schedule and day_key in practitioner.duty_schedule:
        # Split-shift mode
        for block in practitioner.duty_schedule[day_key]:
            sh, sm = map(int, block['start'].split(':'))
            eh, em = map(int, block['end'].split(':'))
            working_ranges.append((sh * 60 + sm, eh * 60 + em))
    else:
        # Legacy mode
        sh = time_to_mins(practitioner.duty_start_time)
        eh = time_to_mins(practitioner.duty_end_time)
        working_ranges.append((sh, eh))
        
    # Always subtract standard lunch if defined
    if practitioner.lunch_start_time and practitioner.lunch_end_time:
        lsh = time_to_mins(practitioner.lunch_start_time)
        leh = time_to_mins(practitioner.lunch_end_time)
        working_ranges = subtract_interval(working_ranges, lsh, leh)

    # Subtract all manual blocks
    for b in blocks:
        bsh = time_to_mins(b.start_time)
        beh = time_to_mins(b.end_time)
        working_ranges = subtract_interval(working_ranges, bsh, beh)

    # Sum up the remaining minutes
    return sum(max(0, r_end - r_start) for r_start, r_end in working_ranges)


def get_occupancy_stats(clinic_id: int, start_date: date, end_date: date, practitioner_ids: List[int] = None) -> Dict:
    """
    Calculate occupancy metrics for all practitioners in a clinic for a date range.
    Returns:
    {
      "YYYY-MM-DD": {
        practitioner_id: {
            "available_minutes": int,
            "occupied_minutes": int,
            "occupancy_pct": int,
            "total_clients": int,
            "new_clients": int
        }
      }
    }
    """
    prac_qs = Practitioner.objects.filter(
        clinic_id=clinic_id,
        is_deleted=False,
        is_accepting_patients=True
    )
    if practitioner_ids:
        prac_qs = prac_qs.filter(id__in=practitioner_ids)
        
    practitioners = list(prac_qs)
    p_ids = [p.id for p in practitioners]

    block_qs = BlockAppointment.objects.filter(
        clinic_id=clinic_id,
        is_deleted=False,
        date__range=[start_date, end_date]
    ).filter(Q(practitioner__isnull=True) | Q(practitioner_id__in=p_ids))

    blocks_by_date = defaultdict(list)
    for b in block_qs:
        blocks_by_date[b.date].append(b)

    appt_qs = Appointment.objects.filter(
        clinic_id=clinic_id,
        is_deleted=False,
        date__range=[start_date, end_date],
        practitioner_id__in=p_ids
    ).select_related('service')

    appts_by_date_and_prac = defaultdict(lambda: defaultdict(list))
    for appt in appt_qs:
        appts_by_date_and_prac[appt.date][appt.practitioner_id].append(appt)

    from datetime import timedelta
    results = defaultdict(dict)
    
    curr = start_date
    while curr <= end_date:
        day_blocks = blocks_by_date[curr]
        
        for p in practitioners:
            p_blocks = [b for b in day_blocks if b.practitioner_id is None or b.practitioner_id == p.id]
            avail = calculate_daily_availability(p, curr, p_blocks)
            
            p_appts = appts_by_date_and_prac[curr][p.id]
            
            # Sum up durations for all appointments (regardless of status per user instruction)
            occupied_mins = 0
            for a in p_appts:
                if a.start_time and a.end_time:
                    s_mins = a.start_time.hour * 60 + a.start_time.minute
                    e_mins = a.end_time.hour * 60 + a.end_time.minute
                    occupied_mins += max(0, e_mins - s_mins)
            
            unique_patients = set(a.patient_id for a in p_appts)
            new_patients = set(a.patient_id for a in p_appts if a.appointment_type == 'INITIAL')
            
            occupancy_pct = 0
            if avail > 0:
                occupancy_pct = min(100.0, round((occupied_mins / avail) * 100, 2))
                
            results[curr.strftime('%Y-%m-%d')][p.id] = {
                "available_minutes": avail,
                "occupied_minutes": occupied_mins,
                "occupancy_pct": occupancy_pct,
                "total_clients": len(unique_patients),
                "new_clients": len(new_patients)
            }
            
        curr += timedelta(days=1)
        
    return dict(results)
