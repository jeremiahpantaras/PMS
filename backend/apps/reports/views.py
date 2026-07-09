import logging

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Sum, Avg, Q, Prefetch
from django.utils import timezone
from datetime import date, datetime, timedelta

from .models import Report
from .serializers import ReportSerializer
from apps.appointments.models import Appointment
from apps.billing.models import Invoice, Payment
from apps.patients.models import Patient
from apps.records.models import ClinicalNote

logger = logging.getLogger(__name__)



# ─── Helpers ──────────────────────────────────────────────────────────────────

def _parse_date(value, fallback: date) -> date:
    if not value:
        return fallback
    try:
        return datetime.strptime(str(value), '%Y-%m-%d').date()
    except ValueError:
        return fallback


def _default_range():
    today = timezone.now().date()
    return today.replace(day=1), today


def _appointment_qs(clinic):
    return (
        Appointment.objects
        .filter(clinic=clinic, is_deleted=False)
        .select_related(
            'patient',
            'practitioner__user',
            'service',
            'branch',
        )
    )


def _serialize_appointment_base(appt) -> dict:
    today = timezone.now().date()
    return {
        'appointment_id':    appt.id,
        'date':              str(appt.date),
        'start_time':        str(appt.start_time),
        'end_time':          str(appt.end_time),
        'appointment_type':  appt.appointment_type,
        'status':            appt.status,
        'patient_id':        appt.patient_id,
        'patient_name':      appt.patient.get_full_name() if appt.patient else '',
        'patient_number':    appt.patient.patient_number if appt.patient else '',
        'practitioner_name': (
            appt.practitioner.user.get_full_name()
            if appt.practitioner and appt.practitioner.user
            else ''
        ),
        'service_name':  appt.service.name  if appt.service  else '',
        'branch_name':   appt.branch.name   if appt.branch   else None,
    }


# ─── ViewSet ──────────────────────────────────────────────────────────────────

class ReportViewSet(viewsets.ModelViewSet):
    """
    Full CRUD for saved reports + live report-data endpoints.

    Live report endpoints (Administration tab):
        GET /reports/uninvoiced_bookings/
        GET /reports/cancellations/

    Live report endpoints (Clinic tab):
        GET /reports/clients_cases/
        GET /reports/clinical_notes/

    Live report endpoints (Financial tab):
        GET /reports/inventory_financial/
        GET /reports/appointment_costs/

    Print endpoints:
        GET /reports/uninvoiced_bookings/print/
        GET /reports/cancellations/print/
    """

    queryset = Report.objects.all().select_related('clinic', 'generated_by')
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['clinic', 'report_type', 'tab', 'start_date', 'end_date']
    ordering_fields = ['created_at', 'start_date']

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return self.queryset
        return self.queryset.filter(clinic=user.clinic)

    # ── Shared date-range parsing ──────────────────────────────────────────────

    def _get_date_range(self, request):
        month_start, today = _default_range()
        start = _parse_date(request.query_params.get('start_date'), month_start)
        end   = _parse_date(request.query_params.get('end_date'),   today)
        if start > end:
            start, end = end, start
        return start, end

    def _get_clinic_and_branch_ids(self, request):
        """
        Returns the user's clinic and all applicable branch IDs.
        Respects optional clinic_branch and practitioner_id filters.
        """
        user        = request.user
        clinic      = user.clinic
        main_clinic = clinic.main_clinic if hasattr(clinic, 'main_clinic') else clinic
        all_branch_ids = list(
            main_clinic.get_all_branches().values_list('id', flat=True)
        )
        return clinic, main_clinic, all_branch_ids

    # ══════════════════════════════════════════════════════════════════════════
    #  ADMINISTRATION TAB
    # ══════════════════════════════════════════════════════════════════════════

    # ── 1. Uninvoiced Bookings ─────────────────────────────────────────────────

    def _build_uninvoiced_data(self, request):
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        start, end = self._get_date_range(request)

        # ── DEBUG ─────────────────────────────────────────────────────────────
        logger.debug(
            "[UNINVOICED] clinic=%s | main_clinic=%s | branch_ids=%s | range=%s → %s",
            clinic, main_clinic, all_branch_ids, start, end
        )

        # Base queryset
        qs = (
            Appointment.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                patient__is_archived=False,
                date__range=[start, end],
            )
            .select_related(
                'patient',
                'practitioner__user',
                'clinic',
            )
            .prefetch_related('billing_invoices')
        )

        status_filter = request.query_params.get('status', 'COMPLETED')
        if status_filter == 'ALL':
            pass
        else:
            qs = qs.filter(status=status_filter)

        # ── DEBUG ─────────────────────────────────────────────────────────────
        logger.debug(
            "[UNINVOICED] status_filter=%s | appointments_in_range=%s",
            status_filter, qs.count()
        )

        practitioner_id = request.query_params.get('practitioner_id')
        branch_id       = request.query_params.get('branch_id')
        if practitioner_id:
            try:
                qs = qs.filter(practitioner_id=int(practitioner_id))
            except (ValueError, TypeError):
                pass
        if branch_id:
            try:
                qs = qs.filter(clinic_id=int(branch_id))
            except (ValueError, TypeError):
                pass

        today = timezone.now().date()
        items = []

        # ── DEBUG: count totals before invoice filter ──────────────────────
        total_appointments = qs.count()
        skipped_invoiced   = 0
        skipped_no_relation = 0

        for appt in qs.order_by('date', 'start_time'):
            all_inv = list(appt.billing_invoices.all())

            active_invoices = [
                inv for inv in all_inv
                if not getattr(inv, 'is_deleted', False)
            ]

            # ── UPDATED LOGIC ──────────────────────────────────────────────
            # Consider an appointment "properly invoiced" ONLY if it has
            # at least one invoice that is PAID, PARTIALLY_PAID, or OVERDUE.
            # DRAFT and PENDING invoices still count as "uninvoiced" since
            # no payment has been collected yet.
            INVOICED_STATUSES = ('PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED')

            has_real_invoice = any(
                inv.status in INVOICED_STATUSES
                for inv in active_invoices
            )

            if has_real_invoice:
                skipped_invoiced += 1
                logger.debug(
                    "[UNINVOICED] SKIP appt_id=%s — has paid/overdue invoice(s): %s",
                    appt.id,
                    [f"{inv.invoice_number}({inv.status})" for inv in active_invoices],
                )
                continue

            # Determine invoice_status to show:
            # Priority: PENDING > DRAFT > None
            invoice_status = None
            invoice_number = None
            if active_invoices:
                # Sort so PENDING shows before DRAFT
                priority = {'PENDING': 0, 'DRAFT': 1}
                sorted_inv = sorted(
                    active_invoices,
                    key=lambda i: priority.get(i.status, 99)
                )
                invoice_status = sorted_inv[0].status
                invoice_number = sorted_inv[0].invoice_number

            items.append({
                'appointment_id':       appt.id,
                'date':                 str(appt.date),
                'start_time':           str(appt.start_time),
                'end_time':             str(appt.end_time),
                'appointment_type':     appt.appointment_type,
                'appointment_status':   appt.status,
                'patient_id':           appt.patient_id,
                'patient_name':         appt.patient.get_full_name() if appt.patient else '',
                'patient_number':       appt.patient.patient_number if appt.patient else '',
                'practitioner_name':    (
                    appt.practitioner.user.get_full_name()
                    if appt.practitioner and appt.practitioner.user else ''
                ),
                'branch_name':          appt.clinic.name if appt.clinic else None,
                'days_since_completed': (today - appt.date).days if appt.date else None,
                'invoice_status':       invoice_status,
                'invoice_number':       invoice_number,
            })

        # ── DEBUG SUMMARY ──────────────────────────────────────────────────
        logger.debug(
            "[UNINVOICED] SUMMARY → total_appts=%s | skipped_invoiced=%s | "
            "uninvoiced_items=%s",
            total_appointments, skipped_invoiced, len(items)
        )

        # ── CRITICAL DEBUG: if 0 results, log why ─────────────────────────
        if len(items) == 0:
            logger.warning(
                "[UNINVOICED] ZERO RESULTS — "
                "branch_ids=%s | start=%s | end=%s | status_filter=%s | "
                "total_appointments_in_range=%s | skipped_because_invoiced=%s",
                all_branch_ids, start, end, status_filter,
                total_appointments, skipped_invoiced
            )

            # Extra: check if there ARE any appointments at all for this clinic
            any_appts = Appointment.objects.filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
            ).count()
            logger.warning(
                "[UNINVOICED] Total clinic appointments (all time, no date filter)=%s",
                any_appts
            )

            # Check if patient__is_archived filter is killing results
            without_archived_filter = Appointment.objects.filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                date__range=[start, end],
                status=status_filter,
            ).count()
            logger.warning(
                "[UNINVOICED] Without is_archived filter: count=%s",
                without_archived_filter
            )

        meta = {
            'report_type':  'UNINVOICED_BOOKINGS',
            'tab':          'ADMINISTRATION',
            'start_date':   str(start),
            'end_date':     str(end),
            'total_count':  len(items),
            'generated_at': timezone.now().isoformat(),
            'filters': {
                'status':           status_filter,
                'practitioner_id':  practitioner_id,
                'branch_id':        branch_id,
            },
            # ── DEBUG field — remove after debugging ──────────────────────
            '_debug': {
                'total_appointments_in_range': total_appointments,
                'skipped_invoiced':            skipped_invoiced,
                'branch_ids':                  all_branch_ids,
            }
        }
        return items, meta

    @action(detail=False, methods=['get'], url_path='uninvoiced_bookings')
    def uninvoiced_bookings(self, request):
        """
        GET /reports/uninvoiced_bookings/

        Query params:
            start_date      (YYYY-MM-DD)  default: first day of current month
            end_date        (YYYY-MM-DD)  default: today
            status          (str)         default: COMPLETED  — use ALL for any status
            practitioner_id (int)         optional
            branch_id       (int)         optional
        """
        items, meta = self._build_uninvoiced_data(request)
        return Response({**meta, 'results': items})

    @action(detail=False, methods=['get'], url_path='uninvoiced_bookings/print')
    def uninvoiced_bookings_print(self, request):
        """
        GET /reports/uninvoiced_bookings/print/
        Returns a print-ready payload (same data, extra summary block).
        """
        items, meta = self._build_uninvoiced_data(request)

        # Summary breakdowns for the print header
        overdue_count    = sum(1 for i in items if (i['days_since_completed'] or 0) > 7)
        this_week_count  = sum(1 for i in items if (i['days_since_completed'] or 0) <= 7)
        no_invoice_count = sum(1 for i in items if i['invoice_status'] is None)
        draft_count      = sum(1 for i in items if i['invoice_status'] == 'DRAFT')

        summary = {
            'overdue_count':    overdue_count,
            'this_week_count':  this_week_count,
            'no_invoice_count': no_invoice_count,
            'draft_only_count': draft_count,
            'practitioners':    list({i['practitioner_name'] for i in items if i['practitioner_name']}),
            'branches':         list({i['branch_name'] for i in items if i['branch_name']}),
        }

        return Response({**meta, 'summary': summary, 'results': items})

    # ── 2. Cancellations ──────────────────────────────────────────────────────

    def _build_cancellations_data(self, request):
        """
        Core logic for cancellations — shared between JSON and print endpoints.

        Returns a tuple: (items: list, meta: dict)
        """
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        start, end = self._get_date_range(request)

        include_no_show_param = request.query_params.get('include_no_show', 'true').lower()
        include_no_show       = include_no_show_param not in ('false', '0', 'no')

        cancel_statuses = ['CANCELLED']
        if include_no_show:
            cancel_statuses.append('NO_SHOW')

        qs = (
            Appointment.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                patient__is_archived=False,
                status__in=cancel_statuses,
                date__range=[start, end],
            )
            .select_related(
                'patient',
                'practitioner__user',
                'clinic',
                'cancelled_by',
            )
        )

        # Optional filters
        practitioner_id = request.query_params.get('practitioner_id')
        branch_id       = request.query_params.get('branch_id')
        if practitioner_id:
            try:
                qs = qs.filter(practitioner_id=int(practitioner_id))
            except (ValueError, TypeError):
                pass
        if branch_id:
            try:
                qs = qs.filter(clinic_id=int(branch_id))
            except (ValueError, TypeError):
                pass

        items = []
        for appt in qs.order_by('date', 'start_time'):
            cancelled_by_name = None
            if appt.cancelled_by:
                cancelled_by_name = appt.cancelled_by.get_full_name()

            items.append({
                'appointment_id':    appt.id,
                'date':              str(appt.date),
                'start_time':        str(appt.start_time),
                'end_time':          str(appt.end_time),
                'appointment_type':  appt.appointment_type,
                'status':            appt.status,
                'patient_id':        appt.patient_id,
                'patient_name':      appt.patient.get_full_name() if appt.patient else '',
                'patient_number':    appt.patient.patient_number if appt.patient else '',
                'practitioner_name': (
                    appt.practitioner.user.get_full_name()
                    if appt.practitioner and appt.practitioner.user else ''
                ),
                'branch_name':       appt.clinic.name if appt.clinic else None,
                'cancelled_at':      appt.cancelled_at.isoformat() if appt.cancelled_at else None,
                'cancelled_by':      cancelled_by_name,
                'reason':            appt.cancellation_reason or None,
            })

        cancelled_count = sum(1 for i in items if i['status'] == 'CANCELLED')
        no_show_count   = sum(1 for i in items if i['status'] == 'NO_SHOW')

        meta = {
            'report_type':       'CANCELLATIONS',
            'tab':               'ADMINISTRATION',
            'start_date':        str(start),
            'end_date':          str(end),
            'total_count':       len(items),
            'cancelled_count':   cancelled_count,
            'no_show_count':     no_show_count,
            'generated_at':      timezone.now().isoformat(),
            'filters': {
                'include_no_show': include_no_show,
                'practitioner_id': practitioner_id,
                'branch_id':       branch_id,
            }
        }
        return items, meta

    @action(detail=False, methods=['get'], url_path='cancellations')
    def cancellations(self, request):
        """
        GET /reports/cancellations/

        Query params:
            start_date      (YYYY-MM-DD)
            end_date        (YYYY-MM-DD)
            include_no_show (bool, default true)
            practitioner_id (int)
            branch_id       (int)
        """
        items, meta = self._build_cancellations_data(request)
        return Response({**meta, 'results': items})

    @action(detail=False, methods=['get'], url_path='cancellations/print')
    def cancellations_print(self, request):
        """
        GET /reports/cancellations/print/
        Returns a print-ready payload with extra summary block.
        """
        items, meta = self._build_cancellations_data(request)

        with_reason_count    = sum(1 for i in items if i['reason'])
        without_reason_count = sum(1 for i in items if not i['reason'])
        practitioners        = list({i['practitioner_name'] for i in items if i['practitioner_name']})
        branches             = list({i['branch_name'] for i in items if i['branch_name']})

        summary = {
            'with_reason_count':    with_reason_count,
            'without_reason_count': without_reason_count,
            'practitioners':        practitioners,
            'branches':             branches,
        }

        return Response({**meta, 'summary': summary, 'results': items})

    # ══════════════════════════════════════════════════════════════════════════
    #  CLINIC TAB
    # ══════════════════════════════════════════════════════════════════════════

    @action(detail=False, methods=['get'], url_path='clients_cases')
    def clients_cases(self, request):
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        start, end = self._get_date_range(request)
        today      = timezone.now().date()

        new_only_param = request.query_params.get('new_only', 'false').lower()
        new_only       = new_only_param in ('true', '1', 'yes')

        patients_qs = (
            Patient.objects
            .filter(clinic=clinic, is_deleted=False)
            .prefetch_related(
                Prefetch(
                    'appointments',
                    queryset=(
                        Appointment.objects
                        .filter(clinic_id__in=all_branch_ids, is_deleted=False)
                        .order_by('date', 'start_time')
                    ),
                    to_attr='all_appointments',
                )
            )
            .order_by('last_name', 'first_name')
        )

        if new_only:
            patients_qs = patients_qs.filter(created_at__date__range=[start, end])
        else:
            patients_qs = patients_qs.filter(
                Q(created_at__date__range=[start, end]) |
                Q(appointments__date__range=[start, end], appointments__is_deleted=False)
            ).distinct()

        items = []
        for patient in patients_qs:
            range_appts = [a for a in patient.all_appointments if start <= a.date <= end]
            upcoming_appts = [
                a for a in patient.all_appointments
                if a.date >= today and a.status in ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN')
            ]

            upcoming_list = []
            for appt in upcoming_appts[:10]:
                upcoming_list.append({
                    'appointment_id':    appt.id,
                    'date':              str(appt.date),
                    'start_time':        str(appt.start_time),
                    'appointment_type':  appt.appointment_type,
                    'status':            appt.status,
                    'practitioner_name': (
                        appt.practitioner.user.get_full_name()
                        if appt.practitioner and appt.practitioner.user else ''
                    ),
                    'service_name': appt.service.name if appt.service else '',
                })

            items.append({
                'patient_id':         patient.id,
                'patient_name':       patient.get_full_name(),
                'patient_number':     patient.patient_number,
                'gender':             patient.gender,
                'date_of_birth':      str(patient.date_of_birth) if patient.date_of_birth else None,
                'phone':              patient.phone or None,
                'email':              patient.email or None,
                'registered_on':      str(patient.created_at.date()),
                'is_new_this_period': start <= patient.created_at.date() <= end,
                'total_bookings':     len(patient.all_appointments),
                'range_bookings':     len(range_appts),
                'upcoming_bookings':  upcoming_list,
            })

        new_clients_count    = sum(1 for i in items if i['is_new_this_period'])
        total_range_bookings = sum(i['range_bookings'] for i in items)

        return Response({
            'report_type':          'CLIENTS_CASES',
            'tab':                  'CLINIC',
            'start_date':           str(start),
            'end_date':             str(end),
            'total_patients':       len(items),
            'new_clients_count':    new_clients_count,
            'total_range_bookings': total_range_bookings,
            'results':              items,
        })

    @action(detail=False, methods=['get'], url_path='clinical_notes')
    def clinical_notes(self, request):
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        start, end = self._get_date_range(request)
        today      = timezone.now().date()

        include_unsigned_param = request.query_params.get('include_unsigned', 'false').lower()
        include_unsigned       = include_unsigned_param in ('true', '1', 'yes')

        qs = (
            Appointment.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                patient__is_archived=False,
                status='COMPLETED',
                date__range=[start, end],
            )
            .prefetch_related(
                Prefetch(
                    'clinical_note',
                    queryset=ClinicalNote.objects.filter(is_deleted=False),
                )
            )
        )

        practitioner_id = request.query_params.get('practitioner_id')
        if practitioner_id:
            try:
                qs = qs.filter(practitioner_id=int(practitioner_id))
            except (ValueError, TypeError):
                pass

        missing_items  = []
        unsigned_items = []

        for appt in qs.order_by('date', 'start_time'):
            try:
                note = appt.clinical_note
            except ClinicalNote.DoesNotExist:
                note = None

            days_since = (today - appt.date).days if appt.date else 0

            row = {
                'appointment_id':    appt.id,
                'date':              str(appt.date),
                'start_time':        str(appt.start_time),
                'end_time':          str(appt.end_time),
                'appointment_type':  appt.appointment_type,
                'status':            appt.status,
                'patient_id':        appt.patient_id,
                'patient_name':      appt.patient.get_full_name() if appt.patient else '',
                'patient_number':    appt.patient.patient_number if appt.patient else '',
                'practitioner_name': (
                    appt.practitioner.user.get_full_name()
                    if appt.practitioner and appt.practitioner.user else ''
                ),
                'service_name':      appt.service.name if appt.service else '',
                'branch_name':       appt.branch.name  if appt.branch  else None,
                'days_since':        days_since,
            }

            if note is None:
                row['note_status'] = 'MISSING'
                missing_items.append(row)
            elif not note.is_signed:
                row['note_status'] = 'UNSIGNED_DRAFT'
                row['note_id']     = note.id
                unsigned_items.append(row)

        results = missing_items[:]
        if include_unsigned:
            results += unsigned_items

        results.sort(key=lambda x: (x['date'], x['start_time']), reverse=True)

        return Response({
            'report_type':          'CLINICAL_NOTES',
            'tab':                  'CLINIC',
            'start_date':           str(start),
            'end_date':             str(end),
            'total_count':          len(results),
            'missing_note_count':   len(missing_items),
            'unsigned_note_count':  len(unsigned_items),
            'results':              results,
        })

    # ══════════════════════════════════════════════════════════════════════════
    #  LEGACY SUMMARY ENDPOINTS
    # ══════════════════════════════════════════════════════════════════════════

    @action(detail=False, methods=['get'])
    def appointments_summary(self, request):
        clinic     = request.user.clinic
        start, end = self._get_date_range(request)
        appointments = Appointment.objects.filter(
            clinic=clinic, date__range=[start, end], is_deleted=False
        )
        summary = {
            'total_appointments': appointments.count(),
            'completed':          appointments.filter(status='COMPLETED').count(),
            'cancelled':          appointments.filter(status='CANCELLED').count(),
            'no_show':            appointments.filter(status='NO_SHOW').count(),
            'by_type':            list(appointments.values('appointment_type').annotate(count=Count('id'))),
            'by_practitioner':    list(
                appointments
                .values('practitioner__user__first_name', 'practitioner__user__last_name')
                .annotate(count=Count('id'))
            ),
        }
        return Response(summary)

    @action(detail=False, methods=['get'])
    def revenue_summary(self, request):
        clinic     = request.user.clinic
        start, end = self._get_date_range(request)
        invoices = Invoice.objects.filter(
            clinic=clinic, invoice_date__range=[start, end], is_deleted=False
        )
        payments = Payment.objects.filter(
            invoice__clinic=clinic, payment_date__range=[start, end]
        )
        summary = {
            'total_invoiced':    invoices.aggregate(total=Sum('total_amount'))['total'] or 0,
            'total_paid':        payments.aggregate(total=Sum('amount'))['total'] or 0,
            'outstanding':       invoices.aggregate(total=Sum('balance_due'))['total'] or 0,
            'by_payment_method': list(payments.values('payment_method').annotate(total=Sum('amount'))),
            'invoice_count':     invoices.count(),
            'payment_count':     payments.count(),
        }
        return Response(summary)

    @action(detail=False, methods=['get'])
    def patient_statistics(self, request):
        clinic   = request.user.clinic
        patients = Patient.objects.filter(clinic=clinic, is_deleted=False)
        summary  = {
            'total_patients':  patients.count(),
            'active_patients': patients.filter(is_active=True).count(),
            'new_this_month':  patients.filter(
                created_at__gte=timezone.now().replace(day=1)
            ).count(),
            'by_gender': list(patients.values('gender').annotate(count=Count('id'))),
        }
        return Response(summary)

    @action(detail=False, methods=['get'])
    def practitioner_performance(self, request):
        from apps.clinics.models import Practitioner
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        start, end = self._get_date_range(request)
        practitioners = Practitioner.objects.filter(
            clinic_id__in=all_branch_ids, is_deleted=False
        )
        performance = []
        for practitioner in practitioners:
            appts = Appointment.objects.filter(
                practitioner=practitioner, date__range=[start, end], is_deleted=False
            )
            performance.append({
                'practitioner':       practitioner.user.get_full_name(),
                'total_appointments': appts.count(),
                'completed':          appts.filter(status='COMPLETED').count(),
                'cancelled':          appts.filter(status='CANCELLED').count(),
                'revenue':            Invoice.objects.filter(
                    appointment__practitioner=practitioner,
                    invoice_date__range=[start, end],
                    is_deleted=False,
                ).aggregate(total=Sum('total_amount'))['total'] or 0,
            })
        return Response(performance)

    @action(detail=False, methods=['get'])
    def dashboard_metrics(self, request):
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        today       = timezone.now().date()
        month_start = today.replace(day=1)

        today_appointments = Appointment.objects.filter(
            clinic_id__in=all_branch_ids, date=today, is_deleted=False
        )
        month_revenue = Invoice.objects.filter(
            clinic_id__in=all_branch_ids, invoice_date__gte=month_start, is_deleted=False
        ).aggregate(total=Sum('total_amount'))['total'] or 0

        from apps.appointments.occupancy_service import get_occupancy_stats
        from apps.clinics.models import Practitioner
        
        active_practitioners = Practitioner.objects.filter(
            clinic_id__in=all_branch_ids, is_accepting_patients=True, is_deleted=False
        )
        
        # We only need today's data
        # For get_occupancy_stats we pass (clinic_id, start_date, end_date, practitioner_ids)
        # Wait, get_occupancy_stats takes clinic_id, not practitioner QS directly!
        occ_stats = get_occupancy_stats(clinic.id, today, today, [p.id for p in active_practitioners])
        
        total_avail = 0
        total_occ = 0
        today_str = today.strftime('%Y-%m-%d')
        if today_str in occ_stats:
            for p_id, p_stats in occ_stats[today_str].items():
                total_avail += p_stats.get('available_minutes', 0)
                total_occ += p_stats.get('occupied_minutes', 0)
                
        today_occupancy_pct = min(100.0, float(total_occ / total_avail * 100)) if total_avail > 0 else 0.0

        metrics = {
            'today_appointments': today_appointments.count(),
            'today_completed':    today_appointments.filter(status='COMPLETED').count(),
            'today_pending':      today_appointments.filter(
                status__in=['SCHEDULED', 'CONFIRMED']
            ).count(),
            'today_occupancy_pct': today_occupancy_pct,
            'month_revenue':     float(month_revenue),
            'active_patients':   Patient.objects.filter(
                clinic=clinic, is_active=True, is_deleted=False
            ).count(),
            'pending_invoices':  Invoice.objects.filter(
                clinic_id__in=all_branch_ids, status='PENDING', is_deleted=False
            ).count(),
        }
        return Response(metrics)

    @action(detail=False, methods=['get'])
    def dashboard_analytics(self, request):
        """
        Returns two datasets for the dashboard graph section:
          - bookings_per_type   : appointment counts grouped by appointment_type
          - weekly_bookings     : bookings per day for the last 7 days
        Uses all branches of the clinic.
        """
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        today = timezone.now().date()

        # ── Bookings per service/type (current month) ───────────────────────
        # Group by the linked Service name first; fall back to appointment_type
        # for legacy records that have no service FK.
        month_start = today.replace(day=1)
        base_qs = Appointment.objects.filter(
            clinic_id__in=all_branch_ids,
            date__range=[month_start, today],
            is_deleted=False,
        )

        # Appointments WITH a linked service → group by service name
        service_qs = (
            base_qs
            .filter(service__isnull=False)
            .values('service__name')
            .annotate(count=Count('id'))
        )

        # Appointments WITHOUT a linked service → group by appointment_type (legacy)
        TYPE_LABELS: dict[str, str] = {
            'CONSULTATION': 'General Consultation',
            'FOLLOW_UP':    'Follow-up Visit',
            'PROCEDURE':    'Procedure',
            'SURGERY':      'Surgery',
            'THERAPY':      'Physical Therapy',
            'VACCINATION':  'Vaccination',
            'LAB':          'Laboratory Tests',
            'IMAGING':      'Imaging',
            'OTHER':        'Other',
        }
        legacy_qs = (
            base_qs
            .filter(service__isnull=True)
            .values('appointment_type')
            .annotate(count=Count('id'))
        )

        # Merge: service rows take priority; legacy rows fill the rest
        counts: dict[str, int] = {}
        for row in service_qs:
            label = row['service__name'] or 'Unknown Service'
            counts[label] = counts.get(label, 0) + row['count']
        for row in legacy_qs:
            label = TYPE_LABELS.get(
                row['appointment_type'],
                row['appointment_type'].replace('_', ' ').title(),
            )
            counts[label] = counts.get(label, 0) + row['count']

        bookings_per_type = [
            {'type': label, 'count': cnt}
            for label, cnt in sorted(counts.items(), key=lambda x: -x[1])
        ]

        # ── Weekly bookings: last 7 days ────────────────────────────────────
        week_start = today - timedelta(days=6)
        week_qs = (
            Appointment.objects
            .filter(
                clinic_id__in=all_branch_ids,
                date__range=[week_start, today],
                is_deleted=False,
            )
            .values('date')
            .annotate(count=Count('id'))
        )
        count_by_date = {row['date']: row['count'] for row in week_qs}

        weekly_bookings = []
        for i in range(7):
            d   = week_start + timedelta(days=i)
            weekly_bookings.append({
                'day':   d.strftime('%a'),   # Mon, Tue …
                'date':  str(d),
                'count': count_by_date.get(d, 0),
            })

        return Response({
            'bookings_per_type': bookings_per_type,
            'weekly_bookings':   weekly_bookings,
        })

    # ══════════════════════════════════════════════════════════════════════════
    #  FINANCIAL TAB
    # ══════════════════════════════════════════════════════════════════════════

    # ── 1. Inventory Financial Report ─────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='inventory_financial')
    def inventory_financial(self, request):
        """
        GET /api/reports/inventory_financial/

        Query params:
            category_id  (int)    optional — filter by inventory category
            stock_status (str)    optional — 'low' | 'out' | 'all' (default: all)
        """
        from apps.inventory.models import Product, Category
        from decimal import Decimal

        clinic = request.user.clinic

        qs = (
            Product.objects
            .filter(clinic=clinic, is_archived=False, is_deleted=False)
            .select_related('category')
            .order_by('category__name', 'name')
        )

        # ── Filters ───────────────────────────────────────────────────────────
        category_id = request.query_params.get('category_id')
        if category_id:
            try:
                qs = qs.filter(category_id=int(category_id))
            except (ValueError, TypeError):
                pass

        stock_status = request.query_params.get('stock_status', 'all').lower()
        if stock_status == 'out':
            qs = qs.filter(quantity_in_stock=0)
        elif stock_status == 'low':
            # low but not zero: qty > 0 AND qty <= reorder_level
            from django.db.models import F
            qs = qs.filter(quantity_in_stock__gt=0, quantity_in_stock__lte=F('reorder_level'))

        # ── Build items ───────────────────────────────────────────────────────
        items = []
        for product in qs:
            qty        = Decimal(str(product.quantity_in_stock))
            unit_cost  = Decimal(str(product.cost_price))
            total_val  = qty * unit_cost

            stock_flag = 'ok'
            if qty == 0:
                stock_flag = 'out'
            elif product.reorder_level and qty <= Decimal(str(product.reorder_level)):
                stock_flag = 'low'

            items.append({
                'product_id':    product.id,
                'name':          product.name,
                'sku':           product.sku or '',
                'category':      product.category.name if product.category else 'Uncategorized',
                'item_type':     product.item_type,
                'unit':          product.unit,
                'quantity':      float(qty),
                'reorder_level': float(product.reorder_level),
                'unit_cost':     float(unit_cost),
                'selling_price': float(product.selling_price),
                'total_value':   float(total_val),
                'stock_flag':    stock_flag,   # 'ok' | 'low' | 'out'
            })

        # ── Summary ───────────────────────────────────────────────────────────
        total_inventory_value = sum(i['total_value'] for i in items)
        low_stock_count       = sum(1 for i in items if i['stock_flag'] == 'low')
        out_of_stock_count    = sum(1 for i in items if i['stock_flag'] == 'out')

        # Category breakdown for pie chart
        from collections import defaultdict
        by_category: dict = defaultdict(float)
        for i in items:
            by_category[i['category']] += i['total_value']
        category_breakdown = [
            {'category': cat, 'total_value': round(val, 2)}
            for cat, val in sorted(by_category.items(), key=lambda x: -x[1])
        ]

        # Available categories for filter dropdown
        categories = list(
            Category.objects
            .filter(clinic=clinic, is_active=True)
            .values('id', 'name')
            .order_by('name')
        )

        return Response({
            'report_type':  'INVENTORY_FINANCIAL',
            'tab':          'FINANCIAL',
            'generated_at': timezone.now().isoformat(),
            'filters': {
                'category_id':  category_id,
                'stock_status': stock_status,
            },
            'summary': {
                'total_inventory_value': round(total_inventory_value, 2),
                'low_stock_count':       low_stock_count,
                'out_of_stock_count':    out_of_stock_count,
                'total_items':           len(items),
            },
            'category_breakdown': category_breakdown,
            'categories':         categories,
            'items':              items,
        })

    # ── 2. Appointment Costs Report ───────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='appointment_costs')
    def appointment_costs(self, request):
        """
        GET /api/reports/appointment_costs/

        Query params:
            start_date      (YYYY-MM-DD)  default: first of current month
            end_date        (YYYY-MM-DD)  default: today
            payment_status  (str)         optional — PAID | UNPAID | PARTIALLY_PAID | ALL (default: ALL)
            practitioner_id (int)         optional
        """
        from decimal import Decimal

        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        start, end = self._get_date_range(request)

        qs = (
            Invoice.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                invoice_date__range=[start, end],
            )
            .select_related(
                'patient',
                'appointment',
                'appointment__practitioner__user',
                'appointment__service',
            )
            .order_by('-invoice_date', 'invoice_number')
        )

        # ── Filters ───────────────────────────────────────────────────────────
        payment_status = request.query_params.get('payment_status', 'ALL').upper()
        if payment_status == 'UNPAID':
            qs = qs.filter(status__in=['PENDING', 'OVERDUE', 'DRAFT'])
        elif payment_status not in ('', 'ALL'):
            qs = qs.filter(status=payment_status)

        practitioner_id = request.query_params.get('practitioner_id')
        if practitioner_id:
            try:
                qs = qs.filter(appointment__practitioner_id=int(practitioner_id))
            except (ValueError, TypeError):
                pass

        # ── Build items ───────────────────────────────────────────────────────
        items = []
        for inv in qs:
            appt = inv.appointment
            practitioner_name = ''
            appointment_type  = ''
            appointment_date  = str(inv.invoice_date)

            if appt:
                appointment_date  = str(appt.date)
                appointment_type  = appt.appointment_type
                if appt.practitioner and appt.practitioner.user:
                    practitioner_name = appt.practitioner.user.get_full_name()

            total   = float(inv.total_amount)
            paid    = float(inv.amount_paid)
            balance = float(inv.balance_due)

            items.append({
                'invoice_id':         inv.id,
                'invoice_number':     inv.invoice_number,
                'invoice_date':       str(inv.invoice_date),
                'patient_id':         inv.patient_id,
                'patient_name':       inv.patient.get_full_name() if inv.patient else '',
                'patient_number':     inv.patient.patient_number if inv.patient else '',
                'practitioner_name':  practitioner_name,
                'appointment_type':   appointment_type,
                'appointment_date':   appointment_date,
                'total_amount':       total,
                'paid_amount':        paid,
                'balance_due':        balance,
                'payment_status':     inv.status,
                'payment_method':     inv.payment_method or '',
            })

        # ── Summary totals ────────────────────────────────────────────────────
        total_revenue       = sum(i['total_amount'] for i in items)
        paid_total          = sum(i['paid_amount']  for i in items)
        unpaid_total        = sum(
            i['total_amount'] for i in items
            if i['payment_status'] in ('PENDING', 'OVERDUE', 'DRAFT')
        )
        outstanding_balance = sum(i['balance_due']  for i in items)
        paid_count          = sum(1 for i in items if i['payment_status'] == 'PAID')
        unpaid_count        = sum(1 for i in items if i['payment_status'] in ('PENDING', 'OVERDUE', 'DRAFT'))
        partial_count       = sum(1 for i in items if i['payment_status'] == 'PARTIALLY_PAID')

        return Response({
            'report_type':  'APPOINTMENT_COSTS',
            'tab':          'FINANCIAL',
            'start_date':   str(start),
            'end_date':     str(end),
            'generated_at': timezone.now().isoformat(),
            'filters': {
                'payment_status':  payment_status,
                'practitioner_id': practitioner_id,
            },
            'summary': {
                'total_revenue':       round(total_revenue, 2),
                'paid_total':          round(paid_total, 2),
                'unpaid_total':        round(unpaid_total, 2),
                'outstanding_balance': round(outstanding_balance, 2),
                'total_invoices':      len(items),
                'paid_count':          paid_count,
                'unpaid_count':        unpaid_count,
                'partial_count':       partial_count,
            },
            'appointments': items,
        })

    # ── 3. Banking Report ─────────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='banking')
    def banking(self, request):
        """
        GET /api/reports/banking/
        Tracks actual money flow: all payments grouped by payment method.

        Query params:
            start_date      (YYYY-MM-DD)
            end_date        (YYYY-MM-DD)
            payment_method  (str)   optional — CASH | GCASH | BANK_TRANSFER | etc. | ALL
            branch_id       (int)   optional
            practitioner_id (int)   optional
        """
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        start, end = self._get_date_range(request)

        qs = (
            Payment.objects
            .filter(
                invoice__clinic_id__in=all_branch_ids,
                payment_date__range=[start, end],
            )
            .select_related(
                'invoice__patient',
                'invoice__appointment',
                'received_by',
            )
            .order_by('payment_date', 'payment_method')
        )

        payment_method_filter = request.query_params.get('payment_method', '').upper()
        branch_id             = request.query_params.get('branch_id')
        practitioner_id       = request.query_params.get('practitioner_id')

        if payment_method_filter and payment_method_filter not in ('', 'ALL'):
            qs = qs.filter(payment_method=payment_method_filter)
        if branch_id:
            try:
                qs = qs.filter(invoice__clinic_id=int(branch_id))
            except (ValueError, TypeError):
                pass
        if practitioner_id:
            try:
                qs = qs.filter(invoice__appointment__practitioner_id=int(practitioner_id))
            except (ValueError, TypeError):
                pass

        items = []
        for payment in qs:
            inv          = payment.invoice
            patient_name = inv.patient.get_full_name() if inv.patient else ''
            items.append({
                'payment_id':       payment.id,
                'date':             str(payment.payment_date),
                'payment_method':   payment.payment_method,
                'receipt_number':   payment.receipt_number,
                'reference_number': payment.reference_number or '',
                'patient_name':     patient_name,
                'invoice_number':   inv.invoice_number,
                'description':      f"Invoice {inv.invoice_number}",
                'amount':           float(payment.amount),
                'notes':            payment.notes or '',
            })

        method_totals: dict = {}
        for item in items:
            m = item['payment_method']
            method_totals[m] = round(method_totals.get(m, 0.0) + item['amount'], 2)

        grand_total = round(sum(i['amount'] for i in items), 2)

        return Response({
            'report_type':  'BANKING',
            'tab':          'FINANCIAL',
            'start_date':   str(start),
            'end_date':     str(end),
            'generated_at': timezone.now().isoformat(),
            'filters': {
                'payment_method':  payment_method_filter or 'ALL',
                'branch_id':       branch_id,
                'practitioner_id': practitioner_id,
            },
            'summary': {
                'method_totals':      method_totals,
                'grand_total':        grand_total,
                'total_transactions': len(items),
            },
            'payments': items,
        })

    # ── 4. Ageing Debts Report ────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='ageing_debts')
    def ageing_debts(self, request):
        """
        GET /api/reports/ageing_debts/
        Unpaid / partially-paid invoices grouped into aging buckets,
        combined with manual ageing debt entries.

        Query params:
            branch_id       (int)   optional
            practitioner_id (int)   optional
        """
        from apps.billing.models import AgeingDebtEntry

        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        today = timezone.now().date()

        qs = (
            Invoice.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                status__in=['PENDING', 'PARTIALLY_PAID', 'OVERDUE'],
            )
            .select_related('patient', 'appointment', 'appointment__practitioner__user')
            .order_by('invoice_date', 'invoice_number')
        )

        branch_id       = request.query_params.get('branch_id')
        practitioner_id = request.query_params.get('practitioner_id')
        if branch_id:
            try:
                qs = qs.filter(clinic_id=int(branch_id))
            except (ValueError, TypeError):
                pass
        if practitioner_id:
            try:
                qs = qs.filter(appointment__practitioner_id=int(practitioner_id))
            except (ValueError, TypeError):
                pass

        bucket_totals = {'CURRENT': 0.0, '0_30': 0.0, '31_60': 0.0, '61_90': 0.0, '90_plus': 0.0}
        items = []
        source_type = 'invoice'

        for inv in qs:
            days_overdue = (today - inv.invoice_date).days
            balance      = float(inv.balance_due)

            if days_overdue <= 0:
                bucket = 'CURRENT'
            elif days_overdue <= 30:
                bucket = '0_30'
            elif days_overdue <= 60:
                bucket = '31_60'
            elif days_overdue <= 90:
                bucket = '61_90'
            else:
                bucket = '90_plus'

            bucket_totals[bucket] = round(bucket_totals[bucket] + balance, 2)

            items.append({
                'id':                 inv.id,
                'source':             'invoice',
                'invoice_id':         inv.id,
                'invoice_number':     inv.invoice_number,
                'invoice_date':       str(inv.invoice_date),
                'due_date':           str(inv.due_date) if inv.due_date else None,
                'patient_id':         inv.patient_id,
                'patient_name':       inv.patient.get_full_name() if inv.patient else '',
                'patient_number':     inv.patient.patient_number if inv.patient else '',
                'total_amount':       float(inv.total_amount),
                'amount_paid':        float(inv.amount_paid),
                'balance_due':        balance,
                'status':             inv.status,
                'days_overdue':       days_overdue,
                'bucket':             bucket,
                'appointment_id':     inv.appointment_id,
                'appointment_date':   str(inv.appointment.date) if inv.appointment else None,
                'appointment_type':  inv.appointment.appointment_type if inv.appointment else '',
                'practitioner_name':  inv.appointment.practitioner.user.get_full_name() if inv.appointment and inv.appointment.practitioner and inv.appointment.practitioner.user else '',
                'practitioner_id':    inv.appointment.practitioner_id if inv.appointment else None,
                'CURRENT':           balance if bucket == 'CURRENT' else 0.0,
                '0_30':               balance if bucket == '0_30'    else 0.0,
                '31_60':              balance if bucket == '31_60'   else 0.0,
                '61_90':              balance if bucket == '61_90'   else 0.0,
                '90_plus':            balance if bucket == '90_plus' else 0.0,
            })

        unbilled_appts = (
            Appointment.objects
            .filter(
                clinic_id__in=all_branch_ids,
                status__in=['COMPLETED', 'CHECKED_IN', 'IN_PROGRESS'],
                is_deleted=False,
            )
            .exclude(
                billing_invoices__is_deleted=False
            )
            .select_related('patient', 'practitioner__user', 'clinic')
        )

        if branch_id:
            try:
                unbilled_appts = unbilled_appts.filter(clinic_id=int(branch_id))
            except (ValueError, TypeError):
                pass

        for appt in unbilled_appts:
            days_outstanding = (today - appt.date).days

            if days_outstanding <= 0:
                bucket = 'CURRENT'
            elif days_outstanding <= 30:
                bucket = '0_30'
            elif days_outstanding <= 60:
                bucket = '31_60'
            elif days_outstanding <= 90:
                bucket = '61_90'
            else:
                bucket = '90_plus'

            bucket_totals[bucket] = round(bucket_totals[bucket] + 0.0, 2)

            items.append({
                'id':                 appt.id,
                'source':             'unbilled_appointment',
                'invoice_id':         None,
                'invoice_number':     None,
                'invoice_date':       None,
                'due_date':           None,
                'patient_id':         appt.patient_id,
                'patient_name':       appt.patient.get_full_name() if appt.patient else '',
                'patient_number':     appt.patient.patient_number if appt.patient else '',
                'total_amount':       0.0,
                'amount_paid':        0.0,
                'balance_due':        0.0,
                'status':             'UNBILLED',
                'days_overdue':       days_outstanding,
                'bucket':             bucket,
                'appointment_id':     appt.id,
                'appointment_date':   str(appt.date),
                'appointment_type':  appt.appointment_type if appt.appointment_type else '',
                'practitioner_name':  appt.practitioner.user.get_full_name() if appt.practitioner and appt.practitioner.user else '',
                'practitioner_id':    appt.practitioner_id,
                'CURRENT':           0.0,
                '0_30':               0.0,
                '31_60':              0.0,
                '61_90':              0.0,
                '90_plus':            0.0,
            })

        debt_entries = (
            AgeingDebtEntry.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
            )
            .exclude(status__in=['PAID', 'WRITTEN_OFF'])
            .select_related('patient')
            .order_by('due_date', 'invoice_number')
        )

        for entry in debt_entries:
            balance = float(entry.balance_due)
            bucket = entry.bucket or 'CURRENT'
            if bucket not in bucket_totals:
                bucket_totals[bucket] = 0.0
            bucket_totals[bucket] = round(bucket_totals[bucket] + balance, 2)

            items.append({
                'id':             entry.id,
                'source':         'debt_entry',
                'invoice_id':     None,
                'invoice_number': entry.invoice_number or f'DE-{entry.id:06d}',
                'invoice_date':   str(entry.invoice_date) if entry.invoice_date else None,
                'due_date':       str(entry.due_date) if entry.due_date else None,
                'patient_id':     entry.patient_id,
                'patient_name':   entry.patient.get_full_name() if entry.patient else '',
                'patient_number': entry.patient.patient_number if entry.patient else '',
                'total_amount':   float(entry.total_amount),
                'amount_paid':    float(entry.amount_paid),
                'balance_due':    balance,
                'status':         entry.status,
                'days_overdue':   max(0, (today - entry.due_date).days) if entry.due_date else 0,
                'bucket':         bucket,
                'category':       entry.category,
                'notes':          entry.notes,
                'CURRENT':        balance if bucket == 'CURRENT' else 0.0,
                '0_30':           balance if bucket == '0_30'    else 0.0,
                '31_60':          balance if bucket == '31_60'   else 0.0,
                '61_90':          balance if bucket == '61_90'   else 0.0,
                '90_plus':        balance if bucket == '90_plus' else 0.0,
            })

        grand_total = round(sum(i['balance_due'] for i in items), 2)

        return Response({
            'report_type':  'AGEING_DEBTS',
            'tab':          'FINANCIAL',
            'generated_at': timezone.now().isoformat(),
            'filters': {
                'branch_id':       branch_id,
                'practitioner_id': practitioner_id,
            },
            'summary': {
                'total_outstanding': grand_total,
                'total_invoices':    len(items),
                'bucket_totals':    bucket_totals,
            },
            'debts': items,
        })

    # ── 5. Revenue Report ─────────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='revenue')
    def revenue(self, request):
        """
        GET /api/reports/revenue/
        Invoice items grouped by service description.

        Query params:
            start_date  (YYYY-MM-DD)
            end_date    (YYYY-MM-DD)
        """
        from apps.billing.models import InvoiceItem

        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        start, end = self._get_date_range(request)

        active_invoice_ids = list(
            Invoice.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                invoice_date__range=[start, end],
                status__in=['PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'],
            )
            .values_list('id', flat=True)
        )

        services_qs = (
            InvoiceItem.objects
            .filter(invoice_id__in=active_invoice_ids)
            .values('description')
            .annotate(
                total_quantity=Sum('quantity'),
                total_revenue=Sum('total'),
                item_count=Count('id'),
            )
            .order_by('-total_revenue')
        )

        invoice_agg = Invoice.objects.filter(
            clinic_id__in=all_branch_ids,
            is_deleted=False,
            invoice_date__range=[start, end],
            status__in=['PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'],
        ).aggregate(
            total_revenue=Sum('total_amount'),
            total_paid=Sum('amount_paid'),
            total_balance=Sum('balance_due'),
        )

        service_items = [
            {
                'service_type': item['description'],
                'quantity':     float(item['total_quantity'] or 0),
                'total_amount': float(item['total_revenue'] or 0),
                'item_count':   item['item_count'],
            }
            for item in services_qs
        ]

        return Response({
            'report_type':  'REVENUE',
            'tab':          'FINANCIAL',
            'start_date':   str(start),
            'end_date':     str(end),
            'generated_at': timezone.now().isoformat(),
            'filters':      {},
            'summary': {
                'total_revenue':  float(invoice_agg['total_revenue']  or 0),
                'total_paid':     float(invoice_agg['total_paid']     or 0),
                'total_balance':  float(invoice_agg['total_balance']  or 0),
                'total_services': len(service_items),
                'total_invoices': len(active_invoice_ids),
            },
            'services': service_items,
        })

    # ── 6. Categories Report ──────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='categories')
    def categories_report(self, request):
        """
        GET /api/reports/categories/
        Revenue grouped by appointment type (clinical category).

        Query params:
            start_date  (YYYY-MM-DD)
            end_date    (YYYY-MM-DD)
        """
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        start, end = self._get_date_range(request)

        qs = (
            Invoice.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                invoice_date__range=[start, end],
                status__in=['PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'],
            )
            .select_related('appointment')
        )

        category_map: dict = {}
        for inv in qs:
            cat = (
                inv.appointment.appointment_type if inv.appointment else None
            ) or 'UNCATEGORIZED'
            if cat not in category_map:
                category_map[cat] = {
                    'total_revenue':  0.0,
                    'total_payments': 0.0,
                    'invoice_count':  0,
                }
            entry = category_map[cat]
            entry['total_revenue']  = round(entry['total_revenue']  + float(inv.total_amount), 2)
            entry['total_payments'] = round(entry['total_payments'] + float(inv.amount_paid),  2)
            entry['invoice_count'] += 1

        items = [
            {
                'category':       cat,
                'total_revenue':  vals['total_revenue'],
                'total_payments': vals['total_payments'],
                'outstanding':    round(vals['total_revenue'] - vals['total_payments'], 2),
                'invoice_count':  vals['invoice_count'],
            }
            for cat, vals in sorted(category_map.items(), key=lambda x: -x[1]['total_revenue'])
        ]

        grand_revenue  = round(sum(i['total_revenue']  for i in items), 2)
        grand_payments = round(sum(i['total_payments'] for i in items), 2)

        return Response({
            'report_type':  'CATEGORIES',
            'tab':          'FINANCIAL',
            'start_date':   str(start),
            'end_date':     str(end),
            'generated_at': timezone.now().isoformat(),
            'filters':      {},
            'summary': {
                'total_revenue':    grand_revenue,
                'total_payments':   grand_payments,
                'outstanding':      round(grand_revenue - grand_payments, 2),
                'total_categories': len(items),
            },
            'categories': items,
        })

    # ── 7. Account Credits Report ─────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='account_credits')
    def account_credits(self, request):
        """
        GET /api/reports/account_credits/
        Per-patient billing summary: total invoiced vs. paid vs. outstanding.

        Query params:
            start_date  (YYYY-MM-DD)
            end_date    (YYYY-MM-DD)
        """
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        start, end = self._get_date_range(request)

        qs = (
            Invoice.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                invoice_date__range=[start, end],
            )
            .select_related('patient')
            .values(
                'patient__id',
                'patient__first_name',
                'patient__last_name',
                'patient__patient_number',
            )
            .annotate(
                credit_created=Sum('total_amount'),
                credit_used=Sum('amount_paid'),
                outstanding=Sum('balance_due'),
                invoice_count=Count('id'),
            )
            .order_by('patient__last_name', 'patient__first_name')
        )

        items = [
            {
                'patient_id':      row['patient__id'],
                'patient_name':    (
                    f"{row['patient__first_name']} {row['patient__last_name']}".strip()
                ),
                'patient_number':  row['patient__patient_number'],
                'credit_created':  round(float(row['credit_created']  or 0), 2),
                'credit_used':     round(float(row['credit_used']     or 0), 2),
                'credit_refunded': 0.0,
                'balance':         round(float(row['outstanding']     or 0), 2),
                'invoice_count':   row['invoice_count'],
            }
            for row in qs
        ]

        return Response({
            'report_type':  'ACCOUNT_CREDITS',
            'tab':          'FINANCIAL',
            'start_date':   str(start),
            'end_date':     str(end),
            'generated_at': timezone.now().isoformat(),
            'filters':      {},
            'summary': {
                'total_credit_created': round(sum(i['credit_created'] for i in items), 2),
                'total_credit_used':    round(sum(i['credit_used']    for i in items), 2),
                'total_balance':        round(sum(i['balance']        for i in items), 2),
                'total_accounts':       len(items),
            },
            'accounts': items,
        })

    # ── 8. Financial Bulk Export ──────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='financial_bulk_export')
    def financial_bulk_export(self, request):
        """
        GET /api/reports/financial_bulk_export/
        Aggregates all 5 financial reports in a single response for bulk export.

        Query params:
            start_date  (YYYY-MM-DD)
            end_date    (YYYY-MM-DD)
        """
        from apps.billing.models import InvoiceItem

        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        start, end = self._get_date_range(request)
        today      = timezone.now().date()
        now_iso    = timezone.now().isoformat()

        # ── Banking ───────────────────────────────────────────────────────────
        payments_qs = (
            Payment.objects
            .filter(
                invoice__clinic_id__in=all_branch_ids,
                payment_date__range=[start, end],
            )
            .select_related('invoice__patient')
            .order_by('payment_date', 'payment_method')
        )
        payment_items = []
        for p in payments_qs:
            inv = p.invoice
            payment_items.append({
                'payment_id':       p.id,
                'date':             str(p.payment_date),
                'payment_method':   p.payment_method,
                'receipt_number':   p.receipt_number or '',
                'reference_number': p.reference_number or '',
                'patient_name':     inv.patient.get_full_name() if inv.patient else '',
                'invoice_number':   inv.invoice_number,
                'amount':           float(p.amount),
            })
        method_totals: dict = {}
        for item in payment_items:
            m = item['payment_method']
            method_totals[m] = round(method_totals.get(m, 0.0) + item['amount'], 2)
        banking_data = {
            'summary': {
                'method_totals':      method_totals,
                'grand_total':        round(sum(i['amount'] for i in payment_items), 2),
                'total_transactions': len(payment_items),
            },
            'payments': payment_items,
        }

        # ── Ageing Debts ──────────────────────────────────────────────────────
        debts_qs = (
            Invoice.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                status__in=['PENDING', 'PARTIALLY_PAID', 'OVERDUE'],
            )
            .select_related('patient')
            .order_by('invoice_date')
        )
        bucket_totals = {'0_30': 0.0, '31_60': 0.0, '61_90': 0.0, '90_plus': 0.0}
        debt_items = []
        for inv in debts_qs:
            days = (today - inv.invoice_date).days
            bal  = float(inv.balance_due)
            if days <= 30:
                bucket = '0_30'
            elif days <= 60:
                bucket = '31_60'
            elif days <= 90:
                bucket = '61_90'
            else:
                bucket = '90_plus'
            bucket_totals[bucket] = round(bucket_totals[bucket] + bal, 2)
            debt_items.append({
                'invoice_id':     inv.id,
                'invoice_number': inv.invoice_number,
                'invoice_date':   str(inv.invoice_date),
                'patient_name':   inv.patient.get_full_name() if inv.patient else '',
                'patient_number': inv.patient.patient_number if inv.patient else '',
                'total_amount':   float(inv.total_amount),
                'amount_paid':    float(inv.amount_paid),
                'balance_due':    bal,
                'status':         inv.status,
                'days_overdue':   days,
                'bucket':         bucket,
            })
        ageing_data = {
            'summary': {
                'total_outstanding': round(sum(i['balance_due'] for i in debt_items), 2),
                'total_invoices':    len(debt_items),
                'bucket_totals':     bucket_totals,
            },
            'debts': debt_items,
        }

        # ── Revenue ───────────────────────────────────────────────────────────
        active_inv_ids = list(
            Invoice.objects.filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                invoice_date__range=[start, end],
                status__in=['PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'],
            ).values_list('id', flat=True)
        )
        services_qs = (
            InvoiceItem.objects
            .filter(invoice_id__in=active_inv_ids)
            .values('description')
            .annotate(
                total_quantity=Sum('quantity'),
                total_revenue=Sum('total'),
                item_count=Count('id'),
            )
            .order_by('-total_revenue')
        )
        inv_agg = Invoice.objects.filter(
            clinic_id__in=all_branch_ids,
            is_deleted=False,
            invoice_date__range=[start, end],
            status__in=['PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'],
        ).aggregate(
            total_revenue=Sum('total_amount'),
            total_paid=Sum('amount_paid'),
            total_balance=Sum('balance_due'),
        )
        service_items = [
            {
                'service_type': i['description'],
                'quantity':     float(i['total_quantity'] or 0),
                'total_amount': float(i['total_revenue'] or 0),
                'item_count':   i['item_count'],
            }
            for i in services_qs
        ]
        revenue_data = {
            'summary': {
                'total_revenue':  float(inv_agg['total_revenue']  or 0),
                'total_paid':     float(inv_agg['total_paid']     or 0),
                'total_balance':  float(inv_agg['total_balance']  or 0),
                'total_services': len(service_items),
                'total_invoices': len(active_inv_ids),
            },
            'services': service_items,
        }

        # ── Categories ────────────────────────────────────────────────────────
        cat_qs = (
            Invoice.objects.filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                invoice_date__range=[start, end],
                status__in=['PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'],
            ).select_related('appointment')
        )
        category_map: dict = {}
        for inv in cat_qs:
            cat = (
                inv.appointment.appointment_type if inv.appointment else None
            ) or 'UNCATEGORIZED'
            if cat not in category_map:
                category_map[cat] = {'total_revenue': 0.0, 'total_payments': 0.0, 'invoice_count': 0}
            entry = category_map[cat]
            entry['total_revenue']  = round(entry['total_revenue']  + float(inv.total_amount), 2)
            entry['total_payments'] = round(entry['total_payments'] + float(inv.amount_paid),  2)
            entry['invoice_count'] += 1
        cat_items = [
            {
                'category':       cat,
                'total_revenue':  vals['total_revenue'],
                'total_payments': vals['total_payments'],
                'outstanding':    round(vals['total_revenue'] - vals['total_payments'], 2),
                'invoice_count':  vals['invoice_count'],
            }
            for cat, vals in sorted(category_map.items(), key=lambda x: -x[1]['total_revenue'])
        ]
        categories_data = {
            'summary': {
                'total_revenue':    round(sum(i['total_revenue']  for i in cat_items), 2),
                'total_payments':   round(sum(i['total_payments'] for i in cat_items), 2),
                'outstanding':      round(sum(i['outstanding']    for i in cat_items), 2),
                'total_categories': len(cat_items),
            },
            'categories': cat_items,
        }

        # ── Account Credits ───────────────────────────────────────────────────
        credits_qs = (
            Invoice.objects.filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                invoice_date__range=[start, end],
            )
            .select_related('patient')
            .values(
                'patient__id',
                'patient__first_name',
                'patient__last_name',
                'patient__patient_number',
            )
            .annotate(
                credit_created=Sum('total_amount'),
                credit_used=Sum('amount_paid'),
                outstanding=Sum('balance_due'),
                invoice_count=Count('id'),
            )
            .order_by('patient__last_name', 'patient__first_name')
        )
        credit_items = [
            {
                'patient_id':      r['patient__id'],
                'patient_name':    f"{r['patient__first_name']} {r['patient__last_name']}".strip(),
                'patient_number':  r['patient__patient_number'],
                'credit_created':  round(float(r['credit_created']  or 0), 2),
                'credit_used':     round(float(r['credit_used']     or 0), 2),
                'credit_refunded': 0.0,
                'balance':         round(float(r['outstanding']     or 0), 2),
                'invoice_count':   r['invoice_count'],
            }
            for r in credits_qs
        ]
        credits_data = {
            'summary': {
                'total_credit_created': round(sum(i['credit_created'] for i in credit_items), 2),
                'total_credit_used':    round(sum(i['credit_used']    for i in credit_items), 2),
                'total_balance':        round(sum(i['balance']        for i in credit_items), 2),
                'total_accounts':       len(credit_items),
            },
            'accounts': credit_items,
        }

        return Response({
            'report_type':  'FINANCIAL_BULK',
            'start_date':   str(start),
            'end_date':     str(end),
            'generated_at': now_iso,
            'clinic_name':  getattr(main_clinic, 'name', str(main_clinic)),
            'generated_by': request.user.get_full_name() or request.user.username,
            'banking':         banking_data,
            'ageing_debts':    ageing_data,
            'revenue':         revenue_data,
            'categories':      categories_data,
            'account_credits': credits_data,
        })

    # ══════════════════════════════════════════════════════════════════════════
    #  CLINIC TAB — PROVIDERS & PRACTICE
    # ══════════════════════════════════════════════════════════════════════════

    @action(detail=False, methods=['get'], url_path='providers_practice')
    def providers_practice(self, request):
        """
        GET /api/reports/providers_practice/

        Provider-level operational + financial performance report.
        Combines appointment metrics, revenue, and forward-booking rates.

        Role-based:
            Admin / Staff → all providers
            Practitioner  → own data only

        Query params:
            start_date      (YYYY-MM-DD)
            end_date        (YYYY-MM-DD)
            practitioner_id (int)   optional – Admin/Staff filter
            branch_id       (int)   optional
        """
        from apps.clinics.models import Practitioner

        user             = request.user
        is_practitioner  = getattr(user, 'role', '') == 'PRACTITIONER'
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        start, end = self._get_date_range(request)
        today = timezone.now().date()

        # ── Practitioner scope ────────────────────────────────────────────────
        forced_prac_id: int | None = None
        if is_practitioner:
            try:
                forced_prac_id = user.practitioner_profile.id
            except Exception:
                return Response(
                    {'detail': 'No practitioner profile found for this user.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        else:
            raw = request.query_params.get('practitioner_id')
            if raw:
                try:
                    forced_prac_id = int(raw)
                except (ValueError, TypeError):
                    pass

        branch_id_raw = request.query_params.get('branch_id')

        # ── Appointment queryset ──────────────────────────────────────────────
        # "GROUP_SESSION" and "CLASS" appointment types count as classes;
        # everything else counts as a consultation.
        CLASS_TYPES = {'GROUP_SESSION', 'CLASS'}

        appt_qs = (
            Appointment.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                date__range=[start, end],
            )
            .select_related('practitioner__user', 'patient', 'service')
        )
        if forced_prac_id is not None:
            appt_qs = appt_qs.filter(practitioner_id=forced_prac_id)
        if branch_id_raw:
            try:
                appt_qs = appt_qs.filter(clinic_id=int(branch_id_raw))
            except (ValueError, TypeError):
                pass

        # ── Invoice queryset ──────────────────────────────────────────────────
        inv_qs = (
            Invoice.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                invoice_date__range=[start, end],
                status__in=['PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'],
            )
            .select_related('appointment__practitioner__user')
        )
        if forced_prac_id is not None:
            inv_qs = inv_qs.filter(appointment__practitioner_id=forced_prac_id)
        if branch_id_raw:
            try:
                inv_qs = inv_qs.filter(clinic_id=int(branch_id_raw))
            except (ValueError, TypeError):
                pass

        # ── Forward-booking: patients in range who have a future appointment ─
        range_patient_ids: set[int] = set()
        prac_map: dict[int, dict]   = {}

        for appt in appt_qs.order_by('practitioner_id', 'date'):
            prac      = appt.practitioner
            prac_id   = prac.id   if prac else 0
            prac_name = prac.user.get_full_name() if prac and prac.user else 'Unassigned'

            if prac_id not in prac_map:
                prac_map[prac_id] = {
                    'practitioner_id':        prac_id,
                    'practitioner_name':      prac_name,
                    'total_appointments':     0,
                    'completed_appointments': 0,
                    'cancelled_appointments': 0,
                    'no_show_appointments':   0,
                    'consultations':          0,
                    'classes':                0,
                    'revenue':                0.0,
                    'duration_sum':           0,
                    'duration_cnt':           0,
                    'patient_ids':            set(),
                }

            row = prac_map[prac_id]
            row['total_appointments'] += 1

            if appt.status == 'COMPLETED':
                row['completed_appointments'] += 1
            elif appt.status == 'CANCELLED':
                row['cancelled_appointments'] += 1
            elif appt.status in ('NO_SHOW', 'DNA'):
                row['no_show_appointments'] += 1

            appt_type = (appt.appointment_type or '').upper()
            if appt_type in CLASS_TYPES:
                row['classes'] += 1
            else:
                row['consultations'] += 1

            dur = appt.duration_minutes or 0
            if dur > 0:
                row['duration_sum'] += dur
                row['duration_cnt'] += 1

            if appt.patient_id:
                row['patient_ids'].add(appt.patient_id)
                range_patient_ids.add(appt.patient_id)

        # Revenue aggregation
        for inv in inv_qs:
            prac    = inv.appointment.practitioner if inv.appointment else None
            prac_id = prac.id if prac else 0
            if prac_id in prac_map:
                prac_map[prac_id]['revenue'] += float(inv.total_amount or 0)

        # Forward booking: unique patients in range who have ≥1 future appointment
        patients_with_future = set(
            Appointment.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                patient_id__in=range_patient_ids,
                date__gt=today,
            )
            .values_list('patient_id', flat=True)
            .distinct()
        )

        # ── Build per-provider rows ───────────────────────────────────────────
        providers = []
        for row in prac_map.values():
            total   = row['total_appointments']
            revenue = round(row['revenue'], 2)
            pat_ids = row['patient_ids']

            forward_count = len(pat_ids & patients_with_future)
            fwd_rate      = round(forward_count / len(pat_ids) * 100, 2) if pat_ids else 0.0
            avg_dur       = (
                round(row['duration_sum'] / row['duration_cnt'])
                if row['duration_cnt'] else 0
            )

            providers.append({
                'practitioner_id':             row['practitioner_id'],
                'practitioner_name':           row['practitioner_name'],
                'total_appointments':          total,
                'completed_appointments':      row['completed_appointments'],
                'cancelled_appointments':      row['cancelled_appointments'],
                'no_show_appointments':        row['no_show_appointments'],
                'consultations':               row['consultations'],
                'classes':                     row['classes'],
                'revenue':                     revenue,
                'avg_revenue_per_appointment': round(revenue / total, 2) if total else 0.0,
                'forward_booking_rate':        fwd_rate,
                'avg_session_duration_min':    avg_dur,
            })

        providers.sort(key=lambda r: -r['revenue'])

        # ── Summary ───────────────────────────────────────────────────────────
        total_revenue        = round(sum(p['revenue']            for p in providers), 2)
        total_appointments   = sum(p['total_appointments']        for p in providers)
        total_completed      = sum(p['completed_appointments']    for p in providers)
        total_cancelled      = sum(p['cancelled_appointments']    for p in providers)
        total_no_show        = sum(p['no_show_appointments']      for p in providers)
        total_consultations  = sum(p['consultations']             for p in providers)
        n_providers          = len(providers)
        avg_rev_per_provider = round(total_revenue / n_providers, 2) if n_providers else 0.0
        avg_fwd_booking      = (
            round(sum(p['forward_booking_rate'] for p in providers) / n_providers, 2)
            if n_providers else 0.0
        )

        return Response({
            'report_type':  'PROVIDERS_PRACTICE',
            'tab':          'CLINIC',
            'start_date':   str(start),
            'end_date':     str(end),
            'generated_at': timezone.now().isoformat(),
            'filters': {
                'practitioner_id': forced_prac_id,
                'branch_id':       branch_id_raw,
            },
            'summary': {
                'total_revenue':            total_revenue,
                'avg_revenue_per_provider': avg_rev_per_provider,
                'total_appointments':       total_appointments,
                'total_completed':          total_completed,
                'total_cancelled':          total_cancelled,
                'total_no_show':            total_no_show,
                'total_consultations':      total_consultations,
                'avg_forward_booking_pct':  avg_fwd_booking,
            },
            'providers': providers,
        })

    # ══════════════════════════════════════════════════════════════════════════
    #  PERFORMANCE TAB
    # ══════════════════════════════════════════════════════════════════════════

    # ── 1. Occupancy Report ───────────────────────────────────────────────────

    def _calculate_daily_availability(self, prac, dt, day_blocks):
        from apps.appointments.occupancy_service import calculate_daily_availability
        return calculate_daily_availability(prac, dt, day_blocks)

    def _build_occupancy_data(self, request):
        """
        Helper method to compute occupancy metrics.
        Returns a dictionary of the report data.
        """
        from collections import defaultdict
        from apps.appointments.models import BlockAppointment
        from apps.clinics.models import Practitioner
        
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        start, end = self._get_date_range(request)

        practitioner_id = request.query_params.get('practitioner_id')
        branch_id       = request.query_params.get('branch_id')

        # Filters for branch and practitioner
        b_ids = [int(branch_id)] if branch_id else all_branch_ids
        p_ids = [int(practitioner_id)] if practitioner_id else None

        # Fetch practitioners
        prac_qs = Practitioner.objects.filter(
            clinic_id__in=b_ids,
            is_deleted=False,
            is_accepting_patients=True
        ).select_related('user', 'clinic')
        if p_ids:
            prac_qs = prac_qs.filter(id__in=p_ids)

        # Fetch blocks
        block_qs = BlockAppointment.objects.filter(
            clinic_id__in=b_ids,
            is_deleted=False,
            date__range=[start, end]
        )
        if p_ids:
            block_qs = block_qs.filter(Q(practitioner__isnull=True) | Q(practitioner_id__in=p_ids))
        
        blocks_by_date = defaultdict(list)
        for b in block_qs:
            blocks_by_date[b.date].append(b)

        # Appointments
        booked_statuses = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'DNA', 'CANCELLED', 'CHECKED_IN', 'IN_PROGRESS', 'ARRIVED']
        appt_qs = Appointment.objects.filter(
            clinic_id__in=b_ids,
            is_deleted=False,
            date__range=[start, end],
            status__in=booked_statuses,
        ).select_related('practitioner__user', 'service')
        
        if p_ids:
            appt_qs = appt_qs.filter(practitioner_id__in=p_ids)

        # Initialize practitioner data
        prac_data = {}
        for p in prac_qs:
            prac_data[p.id] = {
                'practitioner_id': p.id,
                'practitioner_name': p.user.get_full_name() if p.user else 'Unassigned',
                'branch_id': p.clinic_id,
                'branch_name': p.clinic.name if p.clinic else None,
                'scheduled_minutes': 0,
                'occupied_minutes': 0,
                'completed_minutes': 0,
                'cancelled_minutes': 0,
                'dna_minutes': 0,
                'appointment_count': 0,
                'service_ids': set(),
            }

        daily_data = defaultdict(lambda: {'scheduled_minutes': 0, 'occupied_minutes': 0})
        branch_data = defaultdict(lambda: {'scheduled_minutes': 0, 'occupied_minutes': 0})

        # Calculate scheduled (available) minutes
        curr = start
        while curr <= end:
            day_blocks = blocks_by_date[curr]
            for p in prac_qs:
                p_blocks = [b for b in day_blocks if b.practitioner_id is None or b.practitioner_id == p.id]
                avail = self._calculate_daily_availability(p, curr, p_blocks)
                
                prac_data[p.id]['scheduled_minutes'] += avail
                daily_data[curr]['scheduled_minutes'] += avail
                branch_data[p.clinic.name]['scheduled_minutes'] += avail
                
            curr += timedelta(days=1)

        # Aggregate booked minutes
        for appt in appt_qs:
            p_id = appt.practitioner_id
            if p_id not in prac_data:
                continue # Edge case
                
            dur = 0
            if appt.start_time and appt.end_time:
                s_mins = appt.start_time.hour * 60 + appt.start_time.minute
                e_mins = appt.end_time.hour * 60 + appt.end_time.minute
                dur = max(0, e_mins - s_mins)
            
            prac_data[p_id]['occupied_minutes'] += dur
            prac_data[p_id]['appointment_count'] += 1
            if appt.service_id:
                prac_data[p_id]['service_ids'].add(appt.service_id)
                
            if appt.status in ['COMPLETED', 'CHECKED_IN', 'IN_PROGRESS', 'ARRIVED']:
                prac_data[p_id]['completed_minutes'] += dur
            elif appt.status == 'CANCELLED':
                prac_data[p_id]['cancelled_minutes'] += dur
            elif appt.status == 'DNA':
                prac_data[p_id]['dna_minutes'] += dur

            daily_data[appt.date]['occupied_minutes'] += dur
            branch_data[prac_data[p_id]['branch_name']]['occupied_minutes'] += dur

        practitioners = []
        for p_id, row in prac_data.items():
            sched = row['scheduled_minutes']
            occ = row['occupied_minutes']
            comp = row['completed_minutes']
            pct = round((occ / sched * 100) if sched > 0 else 0.0, 2)
            util = round((comp / sched * 100) if sched > 0 else 0.0, 2)
            
            practitioners.append({
                'practitioner_id': row['practitioner_id'],
                'practitioner_name': row['practitioner_name'],
                'branch_name': row['branch_name'],
                'scheduled_minutes': sched,
                'occupied_minutes': occ,
                'completed_minutes': comp,
                'cancelled_minutes': row['cancelled_minutes'],
                'dna_minutes': row['dna_minutes'],
                'occupancy_pct': pct,
                'utilization_pct': util,
                'appointment_count': row['appointment_count'],
                'service_count': len(row['service_ids']),
            })
            
        practitioners.sort(key=lambda r: -r['occupancy_pct'])

        daily_trend = []
        for d in sorted(daily_data.keys()):
            row = daily_data[d]
            sched = row['scheduled_minutes']
            occ = row['occupied_minutes']
            pct = round((occ / sched * 100) if sched > 0 else 0.0, 2)
            daily_trend.append({
                'date': str(d),
                'scheduled_minutes': sched,
                'occupied_minutes': occ,
                'occupancy_pct': pct,
            })
            
        branch_chart = []
        for b_name, row in branch_data.items():
            sched = row['scheduled_minutes']
            occ = row['occupied_minutes']
            pct = round((occ / sched * 100) if sched > 0 else 0.0, 2)
            branch_chart.append({
                'branch_name': b_name,
                'occupancy_pct': pct,
            })
        branch_chart.sort(key=lambda x: -x['occupancy_pct'])

        total_sched = sum(r['scheduled_minutes'] for r in practitioners)
        total_occ   = sum(r['occupied_minutes']  for r in practitioners)
        total_comp  = sum(r['completed_minutes'] for r in practitioners)
        total_canc  = sum(r['cancelled_minutes'] for r in practitioners)
        total_dna   = sum(r['dna_minutes']       for r in practitioners)
        total_appts = sum(r['appointment_count'] for r in practitioners)
        
        overall_pct = round((total_occ / total_sched * 100) if total_sched > 0 else 0.0, 2)
        overall_util = round((total_comp / total_sched * 100) if total_sched > 0 else 0.0, 2)

        return {
            'report_type':  'OCCUPANCY',
            'tab':          'PERFORMANCE',
            'start_date':   str(start),
            'end_date':     str(end),
            'generated_at': timezone.now().isoformat(),
            'filters': {
                'practitioner_id': practitioner_id,
                'branch_id':       branch_id,
            },
            'summary': {
                'overall_occupancy_pct':   overall_pct,
                'overall_utilization_pct': overall_util,
                'total_scheduled_minutes': total_sched,
                'total_occupied_minutes':  total_occ,
                'total_completed_minutes': total_comp,
                'total_cancelled_minutes': total_canc,
                'total_dna_minutes':       total_dna,
                'total_appointments':      total_appts,
            },
            'practitioners': practitioners,
            'daily_trend':   daily_trend,
            'branch_chart':  branch_chart,
        }

    @action(detail=False, methods=['get'], url_path='occupancy')
    def occupancy(self, request):
        """
        GET /api/reports/occupancy/
        Measures provider utilisation: scheduled minutes vs occupied minutes.
        """
        data = self._build_occupancy_data(request)
        return Response(data)

    @action(detail=False, methods=['get'], url_path='occupancy/print')
    def occupancy_print(self, request):
        """
        GET /api/reports/occupancy/print/
        Returns server-side rendered HTML for printing the Occupancy Report.
        """
        from django.template.loader import render_to_string
        from django.http import HttpResponse

        data = self._build_occupancy_data(request)
        clinic, main_clinic, _ = self._get_clinic_and_branch_ids(request)

        branch_id = request.query_params.get('branch_id')
        branch_name = 'All Branches'
        if branch_id:
            try:
                branch_name = main_clinic.get_all_branches().get(id=branch_id).name
            except Exception:
                pass

        context = {
            'clinic': main_clinic,
            'branch_name': branch_name,
            'start_date': data['start_date'],
            'end_date': data['end_date'],
            'generated_by': request.user.get_full_name() if request.user else 'System',
            'generated_at': timezone.now(),
            'summary': data['summary'],
            'practitioners': data['practitioners'],
        }

        html = render_to_string('reports/occupancy_report.html', context)
        return HttpResponse(html, content_type='text/html')

    @action(detail=False, methods=['get'], url_path='occupancy_drill_down')
    def occupancy_drill_down(self, request):
        """
        GET /api/reports/occupancy_drill_down/
        Returns paginated actual appointments for a specific practitioner.
        """
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        start, end = self._get_date_range(request)

        practitioner_id = request.query_params.get('practitioner_id')
        branch_id       = request.query_params.get('branch_id')

        b_ids = [int(branch_id)] if branch_id else all_branch_ids

        booked_statuses = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'DNA', 'CANCELLED', 'CHECKED_IN', 'IN_PROGRESS', 'ARRIVED']
        qs = Appointment.objects.filter(
            clinic_id__in=b_ids,
            is_deleted=False,
            date__range=[start, end],
            status__in=booked_statuses,
        ).select_related('patient', 'service', 'clinic').order_by('-date', '-start_time')
        
        if practitioner_id:
            qs = qs.filter(practitioner_id=practitioner_id)
            
        page = self.paginate_queryset(qs)
        if page is not None:
            data = []
            for appt in page:
                data.append({
                    'appointment_id': appt.id,
                    'date': str(appt.date),
                    'time': str(appt.start_time),
                    'patient_name': appt.patient.get_full_name() if appt.patient else '',
                    'consultation_type': appt.service.name if appt.service else appt.appointment_type,
                    'status': appt.status,
                    'branch': appt.clinic.name if appt.clinic else '',
                })
            return self.get_paginated_response(data)
            
        data = []
        for appt in qs:
            data.append({
                'appointment_id': appt.id,
                'date': str(appt.date),
                'time': str(appt.start_time),
                'patient_name': appt.patient.get_full_name() if appt.patient else '',
                'consultation_type': appt.service.name if appt.service else appt.appointment_type,
                'status': appt.status,
                'branch': appt.clinic.name if appt.clinic else '',
            })
        return Response(data)

    # ── 2. Business Performance ───────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='business_performance')
    def business_performance(self, request):
        """
        GET /api/reports/business_performance/

        KPIs: revenue, appointment counts, cancellations, DNA, new vs returning clients.

        Query params:
            start_date      (YYYY-MM-DD)
            end_date        (YYYY-MM-DD)
            practitioner_id (int)   optional
            branch_id       (int)   optional
        """
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        start, end = self._get_date_range(request)

        practitioner_id_raw = request.query_params.get('practitioner_id')
        branch_id_raw       = request.query_params.get('branch_id')

        appt_qs = (
            Appointment.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                date__range=[start, end],
            )
            .select_related('practitioner__user', 'patient')
        )
        if practitioner_id_raw:
            try:
                appt_qs = appt_qs.filter(practitioner_id=int(practitioner_id_raw))
            except (ValueError, TypeError):
                pass
        if branch_id_raw:
            try:
                appt_qs = appt_qs.filter(clinic_id=int(branch_id_raw))
            except (ValueError, TypeError):
                pass

        invoice_qs = (
            Invoice.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                invoice_date__range=[start, end],
                status__in=['PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'],
            )
            .select_related('appointment__practitioner__user')
        )
        if practitioner_id_raw:
            try:
                invoice_qs = invoice_qs.filter(
                    appointment__practitioner_id=int(practitioner_id_raw)
                )
            except (ValueError, TypeError):
                pass
        if branch_id_raw:
            try:
                invoice_qs = invoice_qs.filter(clinic_id=int(branch_id_raw))
            except (ValueError, TypeError):
                pass

        # ── Per-practitioner aggregation ────────────────────────────────────
        prac_map: dict[int, dict] = {}

        for appt in appt_qs.order_by('practitioner_id', 'date'):
            prac      = appt.practitioner
            prac_id   = prac.id   if prac else 0
            prac_name = prac.user.get_full_name() if prac and prac.user else 'Unassigned'

            if prac_id not in prac_map:
                prac_map[prac_id] = {
                    'practitioner_id':        prac_id,
                    'practitioner_name':      prac_name,
                    'total_appointments':     0,
                    'completed_appointments': 0,
                    'cancelled_appointments': 0,
                    'no_show_appointments':   0,
                    'revenue':                0.0,
                    'patient_ids':            set(),
                }
            row = prac_map[prac_id]
            row['total_appointments'] += 1
            if appt.status == 'COMPLETED':
                row['completed_appointments'] += 1
            elif appt.status in ('CANCELLED',):
                row['cancelled_appointments'] += 1
            elif appt.status in ('NO_SHOW', 'DNA'):
                row['no_show_appointments'] += 1
            if appt.patient_id:
                row['patient_ids'].add(appt.patient_id)

        # Revenue per practitioner from invoices
        for inv in invoice_qs:
            prac      = inv.appointment.practitioner if inv.appointment else None
            prac_id   = prac.id   if prac else 0
            prac_name = prac.user.get_full_name() if prac and prac.user else 'Unassigned'
            if prac_id not in prac_map:
                prac_map[prac_id] = {
                    'practitioner_id':        prac_id,
                    'practitioner_name':      prac_name,
                    'total_appointments':     0,
                    'completed_appointments': 0,
                    'cancelled_appointments': 0,
                    'no_show_appointments':   0,
                    'revenue':                0.0,
                    'patient_ids':            set(),
                }
            prac_map[prac_id]['revenue'] += float(inv.total_amount or 0)

        # Identify new clients: first appointment within the range
        range_patient_ids = set()
        for row in prac_map.values():
            range_patient_ids.update(row['patient_ids'])

        new_patient_ids = set(
            Patient.objects
            .filter(
                id__in=range_patient_ids,
                created_at__date__range=[start, end],
            )
            .values_list('id', flat=True)
        )

        practitioners = []
        for row in prac_map.values():
            total     = row['total_appointments']
            cancelled = row['cancelled_appointments']
            no_show   = row['no_show_appointments']
            revenue   = round(row['revenue'], 2)
            prac_new  = len(row['patient_ids'] & new_patient_ids)
            prac_ret  = len(row['patient_ids']) - prac_new
            practitioners.append({
                'practitioner_id':         row['practitioner_id'],
                'practitioner_name':       row['practitioner_name'],
                'total_appointments':      total,
                'completed_appointments':  row['completed_appointments'],
                'cancelled_appointments':  cancelled,
                'no_show_appointments':    no_show,
                'cancellation_rate':       round(cancelled / total * 100, 2) if total else 0.0,
                'no_show_rate':            round(no_show   / total * 100, 2) if total else 0.0,
                'revenue':                 revenue,
                'revenue_per_appointment': round(revenue / total, 2) if total else 0.0,
                'new_clients':             prac_new,
                'returning_clients':       max(prac_ret, 0),
            })
        practitioners.sort(key=lambda r: -r['revenue'])

        # ── Global summary ──────────────────────────────────────────────────
        total_appts     = sum(r['total_appointments']     for r in practitioners)
        total_completed = sum(r['completed_appointments'] for r in practitioners)
        total_cancelled = sum(r['cancelled_appointments'] for r in practitioners)
        total_no_show   = sum(r['no_show_appointments']   for r in practitioners)
        total_revenue   = round(sum(r['revenue']          for r in practitioners), 2)
        total_new       = len(new_patient_ids)
        total_returning = len(range_patient_ids) - total_new

        # ── Daily revenue trend ─────────────────────────────────────────────
        rev_by_date = (
            Invoice.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                invoice_date__range=[start, end],
                status__in=['PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'],
            )
            .values('invoice_date')
            .annotate(revenue=Sum('total_amount'))
            .order_by('invoice_date')
        )
        revenue_trend = [
            {'date': str(r['invoice_date']), 'revenue': float(r['revenue'] or 0)}
            for r in rev_by_date
        ]

        # ── Daily appointment trend ─────────────────────────────────────────
        appt_by_date = (
            Appointment.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                date__range=[start, end],
            )
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )
        appointment_trend = [
            {'date': str(r['date']), 'count': r['count']}
            for r in appt_by_date
        ]

        return Response({
            'report_type':  'BUSINESS_PERFORMANCE',
            'tab':          'PERFORMANCE',
            'start_date':   str(start),
            'end_date':     str(end),
            'generated_at': timezone.now().isoformat(),
            'filters': {
                'practitioner_id': practitioner_id_raw,
                'branch_id':       branch_id_raw,
            },
            'summary': {
                'total_revenue':               total_revenue,
                'total_appointments':          total_appts,
                'completed_appointments':      total_completed,
                'cancelled_appointments':      total_cancelled,
                'no_show_appointments':        total_no_show,
                'cancellation_rate':           round(total_cancelled / total_appts * 100, 2) if total_appts else 0.0,
                'no_show_rate':                round(total_no_show   / total_appts * 100, 2) if total_appts else 0.0,
                'avg_revenue_per_appointment': round(total_revenue / total_appts, 2) if total_appts else 0.0,
                'new_clients':                 total_new,
                'returning_clients':           max(total_returning, 0),
            },
            'practitioners':       practitioners,
            'revenue_trend':       revenue_trend,
            'appointment_trend':   appointment_trend,
        })

    # ── 3. Outcome Measures ───────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='outcome_measures')
    def outcome_measures(self, request):
        """
        GET /api/reports/outcome_measures/

        Clinical note completion rates by practitioner and patient.

        Query params:
            start_date      (YYYY-MM-DD)
            end_date        (YYYY-MM-DD)
            practitioner_id (int)   optional
            branch_id       (int)   optional
        """
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        start, end = self._get_date_range(request)

        practitioner_id_raw = request.query_params.get('practitioner_id')
        branch_id_raw       = request.query_params.get('branch_id')

        # Completed appointments in range
        appt_qs = (
            Appointment.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                date__range=[start, end],
                status='COMPLETED',
            )
            .select_related('practitioner__user', 'patient')
            .prefetch_related(
                Prefetch(
                    'clinical_notes',
                    queryset=ClinicalNote.objects.filter(is_deleted=False),
                    to_attr='_notes',
                )
            )
        )
        if practitioner_id_raw:
            try:
                appt_qs = appt_qs.filter(practitioner_id=int(practitioner_id_raw))
            except (ValueError, TypeError):
                pass
        if branch_id_raw:
            try:
                appt_qs = appt_qs.filter(clinic_id=int(branch_id_raw))
            except (ValueError, TypeError):
                pass

        prac_map:    dict[int, dict] = {}
        patient_map: dict[int, dict] = {}

        for appt in appt_qs.order_by('practitioner_id', 'date'):
            has_note = bool(appt._notes)

            # Per-practitioner
            prac      = appt.practitioner
            prac_id   = prac.id   if prac else 0
            prac_name = prac.user.get_full_name() if prac and prac.user else 'Unassigned'
            if prac_id not in prac_map:
                prac_map[prac_id] = {
                    'practitioner_id':   prac_id,
                    'practitioner_name': prac_name,
                    'total_notes':       0,
                    'completed_notes':   0,
                    'missing_notes':     0,
                }
            prac_map[prac_id]['total_notes'] += 1
            if has_note:
                prac_map[prac_id]['completed_notes'] += 1
            else:
                prac_map[prac_id]['missing_notes'] += 1

            # Per-patient
            pat      = appt.patient
            pat_id   = pat.id if pat else 0
            if pat_id not in patient_map:
                patient_map[pat_id] = {
                    'patient_id':         pat_id,
                    'patient_name':       pat.get_full_name() if pat else '',
                    'patient_number':     pat.patient_number  if pat else '',
                    'total_appointments': 0,
                    'completed_notes':    0,
                    'missing_notes':      0,
                    'last_appointment':   None,
                }
            patient_map[pat_id]['total_appointments'] += 1
            if has_note:
                patient_map[pat_id]['completed_notes'] += 1
            else:
                patient_map[pat_id]['missing_notes'] += 1
            d_str = str(appt.date)
            if (patient_map[pat_id]['last_appointment'] is None
                    or d_str > patient_map[pat_id]['last_appointment']):
                patient_map[pat_id]['last_appointment'] = d_str

        by_practitioner = []
        for row in prac_map.values():
            total = row['total_notes']
            by_practitioner.append({
                'practitioner_id':   row['practitioner_id'],
                'practitioner_name': row['practitioner_name'],
                'total_notes':       total,
                'completed_notes':   row['completed_notes'],
                'missing_notes':     row['missing_notes'],
                'note_completion_pct': round(row['completed_notes'] / total * 100, 2) if total else 0.0,
            })
        by_practitioner.sort(key=lambda r: -r['note_completion_pct'])

        by_patient = []
        for row in patient_map.values():
            total = row['total_appointments']
            by_patient.append({
                'patient_id':          row['patient_id'],
                'patient_name':        row['patient_name'],
                'patient_number':      row['patient_number'],
                'total_appointments':  total,
                'completed_notes':     row['completed_notes'],
                'missing_notes':       row['missing_notes'],
                'note_completion_pct': round(row['completed_notes'] / total * 100, 2) if total else 0.0,
                'last_appointment':    row['last_appointment'],
            })
        by_patient.sort(key=lambda r: -r['missing_notes'])

        grand_total    = sum(r['total_notes']     for r in by_practitioner)
        grand_complete = sum(r['completed_notes'] for r in by_practitioner)
        grand_missing  = sum(r['missing_notes']   for r in by_practitioner)

        return Response({
            'report_type':  'OUTCOME_MEASURES',
            'tab':          'PERFORMANCE',
            'start_date':   str(start),
            'end_date':     str(end),
            'generated_at': timezone.now().isoformat(),
            'filters': {
                'practitioner_id': practitioner_id_raw,
                'branch_id':       branch_id_raw,
            },
            'summary': {
                'total_completed_appointments': grand_total,
                'total_notes':                  grand_complete,
                'missing_notes':                grand_missing,
                'overall_completion_pct':       round(grand_complete / grand_total * 100, 2) if grand_total else 0.0,
                'total_patients':               len(patient_map),
            },
            'by_practitioner': by_practitioner,
            'by_patient':      by_patient,
        })

    # ══════════════════════════════════════════════════════════════════════════
    #  DASHBOARD — CLINICIAN PERFORMANCE (time-series per provider)
    # ══════════════════════════════════════════════════════════════════════════

    @action(detail=False, methods=['get'], url_path='clinician_performance')
    def clinician_performance(self, request):
        """
        GET /api/reports/clinician_performance/

        Returns per-practitioner time-series data for the dashboard charts.
        Role-based: a PRACTITIONER user may only see their own data.

        Query params:
            start_date      (YYYY-MM-DD)  default: 30 days ago
            end_date        (YYYY-MM-DD)  default: today
            practitioner_id (int)         Admin/Staff only — filter to one provider
            granularity     (day|week)    default: day
        """
        from apps.clinics.models import Practitioner
        from collections import defaultdict

        user = request.user
        is_practitioner = getattr(user, 'role', '') == 'PRACTITIONER'

        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)

        # ── Date range ────────────────────────────────────────────────────────
        today = timezone.now().date()
        default_start = today - timedelta(days=29)
        start = _parse_date(request.query_params.get('start_date'), default_start)
        end   = _parse_date(request.query_params.get('end_date'),   today)
        if start > end:
            start, end = end, start

        # ── Practitioner filter ───────────────────────────────────────────────
        # Practitioners see only their own data regardless of query param.
        forced_practitioner_id: int | None = None
        if is_practitioner:
            try:
                forced_practitioner_id = user.practitioner_profile.id
            except Exception:
                return Response(
                    {'detail': 'No practitioner profile found for this user.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        else:
            raw = request.query_params.get('practitioner_id')
            if raw:
                try:
                    forced_practitioner_id = int(raw)
                except (ValueError, TypeError):
                    pass

        # ── Fetch practitioners in scope ──────────────────────────────────────
        prac_qs = Practitioner.objects.filter(
            clinic_id__in=all_branch_ids,
            is_deleted=False,
        ).select_related('user')
        if forced_practitioner_id is not None:
            prac_qs = prac_qs.filter(id=forced_practitioner_id)

        # ── Appointment queryset ──────────────────────────────────────────────
        appt_qs = (
            Appointment.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                date__range=[start, end],
            )
            .select_related('practitioner__user', 'patient')
        )
        if forced_practitioner_id is not None:
            appt_qs = appt_qs.filter(practitioner_id=forced_practitioner_id)

        # ── Invoice queryset for revenue ──────────────────────────────────────
        inv_qs = (
            Invoice.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                invoice_date__range=[start, end],
                status__in=['PENDING', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'],
            )
            .select_related('appointment__practitioner')
        )
        if forced_practitioner_id is not None:
            inv_qs = inv_qs.filter(appointment__practitioner_id=forced_practitioner_id)

        # ── Build date axis ────────────────────────────────────────────────────
        days_count = (end - start).days + 1
        date_labels = [str(start + timedelta(days=i)) for i in range(days_count)]

        # ── Aggregate per practitioner × date ─────────────────────────────────
        # Structure: { prac_id: { 'date_str': { counts } } }
        prac_info:         dict[int, dict]       = {}
        prac_appts:        dict[int, dict]       = defaultdict(lambda: defaultdict(int))
        prac_completed:    dict[int, dict]       = defaultdict(lambda: defaultdict(int))
        prac_dna:          dict[int, dict]       = defaultdict(lambda: defaultdict(int))
        prac_duration_sum: dict[int, dict]       = defaultdict(lambda: defaultdict(int))
        prac_duration_cnt: dict[int, dict]       = defaultdict(lambda: defaultdict(int))

        for appt in appt_qs:
            prac    = appt.practitioner
            if prac is None:
                continue
            pid     = prac.id
            d_str   = str(appt.date)

            if pid not in prac_info:
                prac_info[pid] = {
                    'id':   pid,
                    'name': prac.user.get_full_name() if prac.user else 'Unknown',
                }

            prac_appts[pid][d_str]     += 1
            if appt.status == 'COMPLETED':
                prac_completed[pid][d_str] += 1
            if appt.status in ('NO_SHOW', 'DNA'):
                prac_dna[pid][d_str] += 1
            dur = appt.duration_minutes or 0
            if dur:
                prac_duration_sum[pid][d_str] += dur
                prac_duration_cnt[pid][d_str] += 1

        # Revenue per practitioner × date
        prac_revenue: dict[int, dict] = defaultdict(lambda: defaultdict(float))
        for inv in inv_qs:
            prac = inv.appointment.practitioner if inv.appointment else None
            if prac is None:
                continue
            pid   = prac.id
            d_str = str(inv.invoice_date)
            prac_revenue[pid][d_str] = round(
                prac_revenue[pid][d_str] + float(inv.total_amount or 0), 2
            )

        # ── Build provider list for admin (all practitioners in scope) ────────
        provider_list = []
        all_prac_ids = set(p.id for p in prac_qs)
        # Ensure practitioners seen in appointments are included
        all_prac_ids.update(prac_info.keys())

        for prac in prac_qs:
            pid = prac.id
            if pid not in prac_info:
                prac_info[pid] = {
                    'id':   pid,
                    'name': prac.user.get_full_name() if prac.user else 'Unknown',
                }

        for pid in sorted(prac_info.keys()):
            info = prac_info[pid]
            appointments   = [prac_appts[pid].get(d, 0)        for d in date_labels]
            completed      = [prac_completed[pid].get(d, 0)    for d in date_labels]
            dna_counts     = [prac_dna[pid].get(d, 0)          for d in date_labels]
            revenue_series = [prac_revenue[pid].get(d, 0.0)    for d in date_labels]
            avg_duration   = [
                round(prac_duration_sum[pid].get(d, 0) / prac_duration_cnt[pid][d], 1)
                if prac_duration_cnt[pid].get(d, 0) > 0 else 0
                for d in date_labels
            ]
            dna_rate = [
                round(dna_counts[i] / appointments[i] * 100, 1) if appointments[i] > 0 else 0.0
                for i in range(len(date_labels))
            ]

            total_appts   = sum(appointments)
            total_dna     = sum(dna_counts)
            total_revenue = round(sum(revenue_series), 2)

            provider_list.append({
                'id':            pid,
                'name':          info['name'],
                'appointments':  appointments,
                'completed':     completed,
                'dna_counts':    dna_counts,
                'dna_rate':      dna_rate,
                'revenue':       revenue_series,
                'avg_duration':  avg_duration,
                # Totals for summary cards
                'total_appointments': total_appts,
                'total_dna':          total_dna,
                'overall_dna_rate':   round(total_dna / total_appts * 100, 1) if total_appts else 0.0,
                'total_revenue':      total_revenue,
            })

        provider_list.sort(key=lambda r: -r['total_appointments'])

        return Response({
            'date_labels':   date_labels,
            'start_date':    str(start),
            'end_date':      str(end),
            'generated_at':  timezone.now().isoformat(),
            'is_own_data':   is_practitioner,
            'providers':     provider_list,
        })

    # ══════════════════════════════════════════════════════════════════════════
    #  DASHBOARD — LIVE OCCUPANCY SNAPSHOT (REST, seeded on WS connect)
    # ══════════════════════════════════════════════════════════════════════════

    @action(detail=False, methods=['get'], url_path='live_occupancy')
    def live_occupancy(self, request):
        """
        GET /api/reports/live_occupancy/

        Returns a snapshot of each practitioner's status for today.
        Used to seed the LiveOccupancyWidget on initial load before the
        WebSocket stream provides diffs.
        """
        from apps.clinics.models import Practitioner
        from collections import defaultdict

        user = request.user
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        today = timezone.now().date()
        now   = timezone.now()

        prac_qs = (
            Practitioner.objects
            .filter(clinic_id__in=all_branch_ids, is_deleted=False)
            .select_related('user')
        )
        if getattr(user, 'role', '') == 'PRACTITIONER':
            try:
                prac_qs = prac_qs.filter(id=user.practitioner_profile.id)
            except Exception:
                prac_qs = prac_qs.none()

        # Today's non-cancelled appointments for these practitioners
        today_appts = (
            Appointment.objects
            .filter(
                clinic_id__in=all_branch_ids,
                date=today,
                is_deleted=False,
                status__in=[
                    'SCHEDULED', 'CONFIRMED', 'CHECKED_IN',
                    'IN_PROGRESS', 'COMPLETED', 'ARRIVED',
                ],
            )
            .select_related('practitioner', 'patient', 'service')
            .order_by('start_time')
        )

        # Index appointments by practitioner
        prac_appts_map: dict[int, list] = defaultdict(list)
        for appt in today_appts:
            if appt.practitioner_id:
                prac_appts_map[appt.practitioner_id].append(appt)

        snapshot = []
        for prac in prac_qs:
            appts = prac_appts_map.get(prac.id, [])

            # Find the appointment that is currently "active" (IN_PROGRESS / CHECKED_IN)
            active_appt = next(
                (a for a in appts if a.status in ('IN_PROGRESS', 'CHECKED_IN', 'ARRIVED')),
                None,
            )

            if active_appt:
                occupancy_status = 'occupied'
                current_patient  = (
                    active_appt.patient.get_full_name() if active_appt.patient else ''
                )
                start_time = str(active_appt.start_time)
                service    = active_appt.service.name if active_appt.service else ''
            else:
                # Check if there's a future appointment today
                future = next(
                    (
                        a for a in appts
                        if a.status in ('SCHEDULED', 'CONFIRMED')
                        and str(a.date) == str(today)
                    ),
                    None,
                )
                occupancy_status = 'available'
                current_patient  = None
                start_time       = str(future.start_time) if future else None
                service          = future.service.name if future and future.service else ''

            snapshot.append({
                'practitioner_id':   prac.id,
                'name':              prac.user.get_full_name() if prac.user else 'Unknown',
                'status':            occupancy_status,
                'current_patient':   current_patient,
                'start_time':        start_time,
                'service':           service,
                'today_total':       len(appts),
                'today_completed':   sum(1 for a in appts if a.status == 'COMPLETED'),
            })

        return Response({
            'snapshot':     snapshot,
            'generated_at': now.isoformat(),
            'date':         str(today),
        })