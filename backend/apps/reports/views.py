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

        metrics = {
            'today_appointments': today_appointments.count(),
            'today_completed':    today_appointments.filter(status='COMPLETED').count(),
            'today_pending':      today_appointments.filter(
                status__in=['SCHEDULED', 'CONFIRMED']
            ).count(),
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
        Unpaid / partially-paid invoices grouped into aging buckets.

        Query params:
            branch_id       (int)   optional
            practitioner_id (int)   optional
        """
        clinic, main_clinic, all_branch_ids = self._get_clinic_and_branch_ids(request)
        today = timezone.now().date()

        qs = (
            Invoice.objects
            .filter(
                clinic_id__in=all_branch_ids,
                is_deleted=False,
                status__in=['PENDING', 'PARTIALLY_PAID', 'OVERDUE'],
            )
            .select_related('patient')
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

        bucket_totals = {'0_30': 0.0, '31_60': 0.0, '61_90': 0.0, '90_plus': 0.0}
        items = []

        for inv in qs:
            days_overdue = (today - inv.invoice_date).days
            balance      = float(inv.balance_due)

            if days_overdue <= 30:
                bucket = '0_30'
            elif days_overdue <= 60:
                bucket = '31_60'
            elif days_overdue <= 90:
                bucket = '61_90'
            else:
                bucket = '90_plus'

            bucket_totals[bucket] = round(bucket_totals[bucket] + balance, 2)

            items.append({
                'invoice_id':     inv.id,
                'invoice_number': inv.invoice_number,
                'invoice_date':   str(inv.invoice_date),
                'due_date':       str(inv.due_date) if inv.due_date else None,
                'patient_id':     inv.patient_id,
                'patient_name':   inv.patient.get_full_name() if inv.patient else '',
                'patient_number': inv.patient.patient_number if inv.patient else '',
                'total_amount':   float(inv.total_amount),
                'amount_paid':    float(inv.amount_paid),
                'balance_due':    balance,
                'status':         inv.status,
                'days_overdue':   days_overdue,
                'bucket':         bucket,
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
                'bucket_totals':     bucket_totals,
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