import axiosInstance from '@/lib/axios';

export interface ReportDateRange {
  start_date?: string; // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
}

// ─── Uninvoiced Bookings ──────────────────────────────────────────────────────

export interface UninvoicedBookingItem {
  appointment_id:       number;
  date:                 string;
  start_time:           string;
  end_time:             string;
  appointment_type:     string;
  appointment_status:   string;
  patient_id:           number;
  patient_name:         string;
  patient_number:       string;
  practitioner_name:    string;
  branch_name:          string | null;
  days_since_completed: number | null;
  invoice_status:       string | null;
  invoice_number:       string | null;
}

export interface UninvoicedBookingsSummary {
  overdue_count:    number;
  this_week_count:  number;
  no_invoice_count: number;
  draft_only_count: number;
  practitioners:    string[];
  branches:         string[];
}

export interface UninvoicedBookingsResponse {
  report_type:  string;
  tab:          string;
  start_date:   string;
  end_date:     string;
  total_count:  number;
  generated_at: string;
  filters:      Record<string, unknown>;
  results:      UninvoicedBookingItem[];
}

export interface UninvoicedBookingsPrintResponse extends UninvoicedBookingsResponse {
  summary: UninvoicedBookingsSummary;
}

// ── Single, clean interface (removed duplicate) ───────────────────────────────
export interface UninvoicedBookingsParams extends ReportDateRange {
  status?:          string;   // 'ALL' | 'COMPLETED' | 'CONFIRMED' | etc.
  practitioner_id?: number;
  branch_id?:       number;
}

export const getUninvoicedBookings = async (
  params?: UninvoicedBookingsParams
): Promise<UninvoicedBookingsResponse> => {
  console.log(
    '%c[reports.api] GET /reports/uninvoiced_bookings/',
    'color: blue',
    'params →', params
  );
  const response = await axiosInstance.get('/reports/uninvoiced_bookings/', {
    params: {
      status: 'ALL', // default — can be overridden by params
      ...params,
    },
  });
  return response.data;
};

// NOTE: getUninvoicedBookingsPrint is kept for backward compat but
// UninvoicedBookings.tsx now builds print HTML from local state instead.
export const getUninvoicedBookingsPrint = async (
  params?: UninvoicedBookingsParams
): Promise<UninvoicedBookingsPrintResponse> => {
  const response = await axiosInstance.get('/reports/uninvoiced_bookings/print/', {
    params: {
      status: 'ALL',
      ...params,
    },
  });
  return response.data;
};

// ─── Cancellations ────────────────────────────────────────────────────────────

export interface CancellationItem {
  appointment_id:    number;
  date:              string;
  start_time:        string;
  end_time:          string;
  cancelled_at:      string | null;
  appointment_type:  string;
  status:            string;
  patient_id:        number;
  patient_name:      string;
  patient_number:    string;
  practitioner_name: string;
  branch_name:       string | null;
  cancelled_by:      string | null;
  reason:            string | null;
}

export interface CancellationsSummary {
  with_reason_count:    number;
  without_reason_count: number;
  practitioners:        string[];
  branches:             string[];
}

export interface CancellationsResponse {
  report_type:     string;
  tab:             string;
  start_date:      string;
  end_date:        string;
  total_count:     number;
  cancelled_count: number;
  no_show_count:   number;
  generated_at:    string;
  filters:         Record<string, unknown>;
  results:         CancellationItem[];
}

export interface CancellationsPrintResponse extends CancellationsResponse {
  summary: CancellationsSummary;
}

export interface CancellationsParams extends ReportDateRange {
  include_no_show?:  boolean;
  practitioner_id?:  number;
  branch_id?:        number;
}

export const getCancellations = async (
  params?: CancellationsParams
): Promise<CancellationsResponse> => {
  const response = await axiosInstance.get('/reports/cancellations/', { params });
  return response.data;
};

export const getCancellationsPrint = async (
  params?: CancellationsParams
): Promise<CancellationsPrintResponse> => {
  const response = await axiosInstance.get('/reports/cancellations/print/', { params });
  return response.data;
};

// ─── Clients & Cases ──────────────────────────────────────────────────────────

export interface UpcomingBooking {
  appointment_id:    number;
  date:              string;
  start_time:        string;
  appointment_type:  string;
  status:            string;
  practitioner_name: string;
  service_name:      string;
}

export interface ClientCaseItem {
  patient_id:         number;
  patient_name:       string;
  patient_number:     string;
  gender:             string;
  date_of_birth:      string | null;
  phone:              string | null;
  email:              string | null;
  registered_on:      string;
  is_new_this_period: boolean;
  total_bookings:     number;
  range_bookings:     number;
  upcoming_bookings:  UpcomingBooking[];
}

export interface ClientCasesResponse {
  report_type:           string;
  tab:                   string;
  start_date:            string;
  end_date:              string;
  total_patients:        number;
  new_clients_count:     number;
  total_range_bookings:  number;
  results:               ClientCaseItem[];
}

export interface ClientCasesParams extends ReportDateRange {
  new_only?: boolean;
}

export const getClientsCases = async (
  params?: ClientCasesParams
): Promise<ClientCasesResponse> => {
  const response = await axiosInstance.get('/reports/clients_cases/', { params });
  return response.data;
};

// ─── Clinical Notes ───────────────────────────────────────────────────────────

export interface ClinicalNotesMissingItem {
  appointment_id:    number;
  date:              string;
  start_time:        string;
  end_time:          string;
  appointment_type:  string;
  status:            string;
  note_status:       'MISSING' | 'UNSIGNED_DRAFT';
  note_id?:          number;
  patient_id:        number;
  patient_name:      string;
  patient_number:    string;
  practitioner_name: string;
  service_name:      string;
  branch_name:       string | null;
  days_since:        number;
}

export interface ClinicalNotesResponse {
  report_type:         string;
  tab:                 string;
  start_date:          string;
  end_date:            string;
  total_count:         number;
  missing_note_count:  number;
  unsigned_note_count: number;
  results:             ClinicalNotesMissingItem[];
}

export interface ClinicalNotesParams extends ReportDateRange {
  practitioner_id?:  number;
  include_unsigned?: boolean;
}

export const getClinicalNotes = async (
  params?: ClinicalNotesParams
): Promise<ClinicalNotesResponse> => {
  const response = await axiosInstance.get('/reports/clinical_notes/', { params });
  return response.data;
};

// ─── Inventory Financial Report ───────────────────────────────────────────────

export interface InventoryFinancialItem {
  product_id:    number;
  name:          string;
  sku:           string;
  category:      string;
  item_type:     string;
  unit:          string;
  quantity:      number;
  reorder_level: number;
  unit_cost:     number;
  selling_price: number;
  total_value:   number;
  stock_flag:    'ok' | 'low' | 'out';
}

export interface InventoryFinancialSummary {
  total_inventory_value: number;
  low_stock_count:       number;
  out_of_stock_count:    number;
  total_items:           number;
}

export interface InventoryCategoryBreakdown {
  category:    string;
  total_value: number;
}

export interface InventoryCategory {
  id:   number;
  name: string;
}

export interface InventoryFinancialResponse {
  report_type:        string;
  tab:                string;
  generated_at:       string;
  filters:            Record<string, unknown>;
  summary:            InventoryFinancialSummary;
  category_breakdown: InventoryCategoryBreakdown[];
  categories:         InventoryCategory[];
  items:              InventoryFinancialItem[];
}

export interface InventoryFinancialParams {
  category_id?:  number;
  stock_status?: 'all' | 'low' | 'out';
}

export const getInventoryFinancial = async (
  params?: InventoryFinancialParams
): Promise<InventoryFinancialResponse> => {
  const response = await axiosInstance.get('/reports/inventory_financial/', { params });
  return response.data;
};

// ─── Appointment Costs Report ─────────────────────────────────────────────────

export interface AppointmentCostItem {
  invoice_id:        number;
  invoice_number:    string;
  invoice_date:      string;
  patient_id:        number;
  patient_name:      string;
  patient_number:    string;
  practitioner_name: string;
  appointment_type:  string;
  appointment_date:  string;
  total_amount:      number;
  paid_amount:       number;
  balance_due:       number;
  payment_status:    string;
  payment_method:    string;
}

export interface AppointmentCostsSummary {
  total_revenue:       number;
  paid_total:          number;
  unpaid_total:        number;
  outstanding_balance: number;
  total_invoices:      number;
  paid_count:          number;
  unpaid_count:        number;
  partial_count:       number;
}

export interface AppointmentCostsResponse {
  report_type:  string;
  tab:          string;
  start_date:   string;
  end_date:     string;
  generated_at: string;
  filters:      Record<string, unknown>;
  summary:      AppointmentCostsSummary;
  appointments: AppointmentCostItem[];
}

export interface AppointmentCostsParams extends ReportDateRange {
  payment_status?:  'ALL' | 'PAID' | 'UNPAID' | 'PARTIALLY_PAID';
  practitioner_id?: number;
}

export const getAppointmentCosts = async (
  params?: AppointmentCostsParams
): Promise<AppointmentCostsResponse> => {
  const response = await axiosInstance.get('/reports/appointment_costs/', { params });
  return response.data;
};

// ─── Banking Report ───────────────────────────────────────────────────────────

export interface BankingPaymentItem {
  payment_id:       number;
  date:             string;
  payment_method:   string;
  receipt_number:   string;
  reference_number: string;
  patient_name:     string;
  invoice_number:   string;
  description:      string;
  amount:           number;
  notes:            string;
}

export interface BankingSummary {
  method_totals:      Record<string, number>;
  grand_total:        number;
  total_transactions: number;
}

export interface BankingResponse {
  report_type:  string;
  tab:          string;
  start_date:   string;
  end_date:     string;
  generated_at: string;
  filters:      Record<string, unknown>;
  summary:      BankingSummary;
  payments:     BankingPaymentItem[];
}

export interface BankingParams extends ReportDateRange {
  payment_method?:  string;
  branch_id?:       number;
  practitioner_id?: number;
}

export const getBanking = async (
  params?: BankingParams
): Promise<BankingResponse> => {
  const response = await axiosInstance.get('/reports/banking/', { params });
  return response.data;
};

// ─── Ageing Debts Report ──────────────────────────────────────────────────────

export interface AgeingDebtItem {
  id?:             number;
  source?:         'invoice' | 'debt_entry' | 'unbilled_appointment';
  invoice_id:      number | null;
  invoice_number:  string | null;
  invoice_date:    string | null;
  due_date:        string | null;
  patient_id:      number;
  patient_name:    string;
  patient_number:  string;
  total_amount:    number;
  amount_paid:     number;
  balance_due:     number;
  status:          string;
  days_overdue:    number;
  bucket:          'CURRENT' | '0_30' | '31_60' | '61_90' | '90_plus';
  category?:       string;
  notes?:          string;
  appointment_id?:     number | null;
  appointment_date?:   string | null;
  appointment_type?:   string;
  practitioner_name?:  string;
  practitioner_id?:   number | null;
  CURRENT:        number;
  '0_30':         number;
  '31_60':         number;
  '61_90':         number;
  '90_plus':       number;
}

export interface AgeingDebtsSummary {
  total_outstanding: number;
  total_invoices:    number;
  bucket_totals: {
    CURRENT:   number;
    '0_30':    number;
    '31_60':   number;
    '61_90':   number;
    '90_plus': number;
  };
}

export interface AgeingDebtsResponse {
  report_type:  string;
  tab:          string;
  generated_at: string;
  filters:      Record<string, unknown>;
  summary:      AgeingDebtsSummary;
  debts:        AgeingDebtItem[];
}

export interface AgeingDebtsParams {
  branch_id?:       number;
  practitioner_id?: number;
}

export const getAgeingDebts = async (
  params?: AgeingDebtsParams
): Promise<AgeingDebtsResponse> => {
  const response = await axiosInstance.get('/reports/ageing_debts/', { params });
  return response.data;
};

// ─── Ageing Debt Entries (Manual) ───────────────────────────────────────────

export interface AgeingDebtEntryItem {
  id:             number;
  source:         'debt_entry';
  patient_id:     number;
  patient_name:   string;
  patient_number: string;
  invoice_number: string;
  invoice_date:   string | null;
  due_date:       string | null;
  total_amount:   number;
  amount_paid:    number;
  balance_due:    number;
  category:       string;
  category_display: string;
  status:         string;
  status_display: string;
  bucket:         string;
  bucket_display: string;
  notes:          string;
  created_by_name: string | null;
  paid_by_name:   string | null;
  paid_at:        string | null;
  created_at:     string;
  updated_at:     string;
}

export interface AgeingDebtEntryCreateInput {
  patient:        number;
  invoice_number: string;
  invoice_date:   string;
  due_date:       string;
  total_amount:   number;
  category:       string;
  notes?:         string;
}

export interface AgeingDebtEntryUpdateInput {
  invoice_number?: string;
  invoice_date?:   string;
  due_date?:       string;
  total_amount?:   number;
  category?:       string;
  status?:         string;
  notes?:         string;
}

export interface AgeingDebtEntrySummary {
  total_outstanding: number;
  by_status: { status: string; count: number; total: number }[];
  by_bucket: { bucket: string; count: number; total: number }[];
}

export const getAgeingDebtEntries = async (): Promise<AgeingDebtEntryItem[]> => {
  const response = await axiosInstance.get('/ageing-debt-entries/');
  return response.data.results ?? response.data;
};

export const getAgeingDebtEntry = async (id: number): Promise<AgeingDebtEntryItem> => {
  const response = await axiosInstance.get(`/ageing-debt-entries/${id}/`);
  return response.data;
};

export const createAgeingDebtEntry = async (
  data: AgeingDebtEntryCreateInput
): Promise<AgeingDebtEntryItem> => {
  const response = await axiosInstance.post('/ageing-debt-entries/', data);
  return response.data;
};

export const updateAgeingDebtEntry = async (
  id: number,
  data: AgeingDebtEntryUpdateInput
): Promise<AgeingDebtEntryItem> => {
  const response = await axiosInstance.patch(`/ageing-debt-entries/${id}/`, data);
  return response.data;
};

export const deleteAgeingDebtEntry = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/ageing-debt-entries/${id}/`);
};

export const recordDebtPayment = async (
  id: number,
  data: { amount: number }
): Promise<AgeingDebtEntryItem> => {
  const response = await axiosInstance.post(`/ageing-debt-entries/${id}/record-payment/`, data);
  return response.data;
};

export const markDebtEntryPaid = async (id: number): Promise<AgeingDebtEntryItem> => {
  const response = await axiosInstance.post(`/ageing-debt-entries/${id}/mark-paid/`);
  return response.data;
};

export const writeOffDebtEntry = async (id: number): Promise<AgeingDebtEntryItem> => {
  const response = await axiosInstance.post(`/ageing-debt-entries/${id}/write-off/`);
  return response.data;
};

export const getAgeingDebtEntrySummary = async (): Promise<AgeingDebtEntrySummary> => {
  const response = await axiosInstance.get('/ageing-debt-entries/summary/');
  return response.data;
};

// ─── Revenue Report ───────────────────────────────────────────────────────────

export interface RevenueServiceItem {
  service_type: string;
  quantity:     number;
  total_amount: number;
  item_count:   number;
}

export interface RevenueSummary {
  total_revenue:  number;
  total_paid:     number;
  total_balance:  number;
  total_services: number;
  total_invoices: number;
}

export interface RevenueResponse {
  report_type:  string;
  tab:          string;
  start_date:   string;
  end_date:     string;
  generated_at: string;
  filters:      Record<string, unknown>;
  summary:      RevenueSummary;
  services:     RevenueServiceItem[];
}

export const getRevenue = async (
  params?: ReportDateRange
): Promise<RevenueResponse> => {
  const response = await axiosInstance.get('/reports/revenue/', { params });
  return response.data;
};

// ─── Categories Report ────────────────────────────────────────────────────────

export interface CategoryReportItem {
  category:       string;
  total_revenue:  number;
  total_payments: number;
  outstanding:    number;
  invoice_count:  number;
}

export interface CategoriesSummary {
  total_revenue:    number;
  total_payments:   number;
  outstanding:      number;
  total_categories: number;
}

export interface CategoriesResponse {
  report_type:  string;
  tab:          string;
  start_date:   string;
  end_date:     string;
  generated_at: string;
  filters:      Record<string, unknown>;
  summary:      CategoriesSummary;
  categories:   CategoryReportItem[];
}

export const getCategories = async (
  params?: ReportDateRange
): Promise<CategoriesResponse> => {
  const response = await axiosInstance.get('/reports/categories/', { params });
  return response.data;
};

// ─── Account Credits Report ───────────────────────────────────────────────────

export interface AccountCreditItem {
  patient_id:      number;
  patient_name:    string;
  patient_number:  string;
  credit_created:  number;
  credit_used:     number;
  credit_refunded: number;
  balance:         number;
  invoice_count:   number;
}

export interface AccountCreditsSummary {
  total_credit_created: number;
  total_credit_used:    number;
  total_balance:        number;
  total_accounts:       number;
}

export interface AccountCreditsResponse {
  report_type:  string;
  tab:          string;
  start_date:   string;
  end_date:     string;
  generated_at: string;
  filters:      Record<string, unknown>;
  summary:      AccountCreditsSummary;
  accounts:     AccountCreditItem[];
}

export const getAccountCredits = async (
  params?: ReportDateRange
): Promise<AccountCreditsResponse> => {
  const response = await axiosInstance.get('/reports/account_credits/', { params });
  return response.data;
};

// ─── Financial Bulk Export ────────────────────────────────────────────────────

export interface BulkBankingData {
  summary: BankingSummary;
  payments: BankingPaymentItem[];
}

export interface BulkAgeingData {
  summary: AgeingDebtsSummary;
  debts: {
    invoice_id:     number;
    invoice_number: string;
    invoice_date:   string;
    patient_name:   string;
    patient_number: string;
    total_amount:   number;
    amount_paid:    number;
    balance_due:    number;
    status:         string;
    days_overdue:   number;
    bucket:         string;
  }[];
}

export interface BulkRevenueData {
  summary: RevenueSummary;
  services: RevenueServiceItem[];
}

export interface BulkCategoriesData {
  summary: CategoriesSummary;
  categories: CategoryReportItem[];
}

export interface BulkAccountCreditsData {
  summary: AccountCreditsSummary;
  accounts: AccountCreditItem[];
}

export interface BulkFinancialExportResponse {
  report_type:     string;
  start_date:      string;
  end_date:        string;
  generated_at:    string;
  clinic_name:     string;
  generated_by:    string;
  banking:         BulkBankingData;
  ageing_debts:    BulkAgeingData;
  revenue:         BulkRevenueData;
  categories:      BulkCategoriesData;
  account_credits: BulkAccountCreditsData;
}

export const getFinancialBulkExport = async (
  params?: ReportDateRange
): Promise<BulkFinancialExportResponse> => {
  const response = await axiosInstance.get('/reports/financial_bulk_export/', { params });
  return response.data;
};

// ─── Performance: Occupancy ───────────────────────────────────────────────────

export interface OccupancyPractitionerRow {
  practitioner_id:    number;
  practitioner_name:  string;
  branch_name:        string;
  scheduled_minutes:  number;
  occupied_minutes:   number;
  completed_minutes:  number;
  cancelled_minutes:  number;
  dna_minutes:        number;
  occupancy_pct:      number;   // 0–100
  utilization_pct:    number;   // 0–100
  appointment_count:  number;
  service_count:      number;
}

export interface OccupancyDailyPoint {
  date:              string;   // YYYY-MM-DD
  occupied_minutes:  number;
  scheduled_minutes: number;
  occupancy_pct:     number;
}

export interface OccupancyResponse {
  report_type:    string;
  start_date:     string;
  end_date:       string;
  generated_at:   string;
  filters:        Record<string, unknown>;
  practitioners:  OccupancyPractitionerRow[];
  daily_trend:    OccupancyDailyPoint[];
  branch_chart:   { branch_name: string; occupancy_pct: number }[];
  summary: {
    overall_occupancy_pct:   number;
    overall_utilization_pct: number;
    total_scheduled_minutes: number;
    total_occupied_minutes:  number;
    total_completed_minutes: number;
    total_cancelled_minutes: number;
    total_dna_minutes:       number;
    total_appointments:      number;
  };
}

export interface OccupancyParams extends ReportDateRange {
  practitioner_id?: number;
  branch_id?:       number;
}

export const getOccupancy = async (
  params?: OccupancyParams
): Promise<OccupancyResponse> => {
  const response = await axiosInstance.get('/reports/occupancy/', { params });
  return response.data;
};

export const printOccupancyReport = async (
  params?: OccupancyParams
): Promise<string> => {
  const response = await axiosInstance.get('/reports/occupancy/print/', {
    params,
    responseType: 'text',
  });
  return response.data;
};

// ── Drill Down ────────────────────────────────────────────────────────────────
export interface OccupancyDrillDownParams extends ReportDateRange {
  practitioner_id?: number;
  branch_id?:       number;
  page?:            number;
}

export interface OccupancyDrillDownItem {
  appointment_id:    number;
  date:              string;
  time:              string;
  patient_name:      string;
  consultation_type: string;
  status:            string;
  branch:            string;
}

export const getOccupancyDrillDown = async (
  params?: OccupancyDrillDownParams
): Promise<{ count: number; next: string | null; previous: string | null; results: OccupancyDrillDownItem[] }> => {
  const response = await axiosInstance.get('/reports/occupancy_drill_down/', { params });
  return response.data;
};

// ─── Performance: Business Performance ───────────────────────────────────────

export interface BusinessPractitionerRow {
  practitioner_id:           number;
  practitioner_name:         string;
  total_appointments:        number;
  completed_appointments:    number;
  cancelled_appointments:    number;
  no_show_appointments:      number;
  cancellation_rate:         number;   // 0–100
  no_show_rate:              number;   // 0–100
  revenue:                   number;
  revenue_per_appointment:   number;
  new_clients:               number;
  returning_clients:         number;
}

export interface BusinessRevenueTrendPoint {
  date:    string;
  revenue: number;
}

export interface BusinessAppointmentTrendPoint {
  date:  string;
  count: number;
}

export interface BusinessPerformanceResponse {
  report_type:   string;
  start_date:    string;
  end_date:      string;
  generated_at:  string;
  filters:       Record<string, unknown>;
  summary: {
    total_revenue:               number;
    total_appointments:          number;
    completed_appointments:      number;
    cancelled_appointments:      number;
    no_show_appointments:        number;
    cancellation_rate:           number;
    no_show_rate:                number;
    avg_revenue_per_appointment: number;
    new_clients:                 number;
    returning_clients:           number;
  };
  practitioners:        BusinessPractitionerRow[];
  revenue_trend:        BusinessRevenueTrendPoint[];
  appointment_trend:    BusinessAppointmentTrendPoint[];
}

export interface BusinessPerformanceParams extends ReportDateRange {
  practitioner_id?: number;
  branch_id?:       number;
}

export const getBusinessPerformance = async (
  params?: BusinessPerformanceParams
): Promise<BusinessPerformanceResponse> => {
  const response = await axiosInstance.get('/reports/business_performance/', { params });
  return response.data;
};

// ─── Performance: Outcome Measures ───────────────────────────────────────────

export interface OutcomePractitionerRow {
  practitioner_id:     number;
  practitioner_name:   string;
  total_notes:         number;
  completed_notes:     number;
  missing_notes:       number;
  note_completion_pct: number;  // 0–100
}

export interface OutcomePatientRow {
  patient_id:          number;
  patient_name:        string;
  patient_number:      string;
  total_appointments:  number;
  completed_notes:     number;
  missing_notes:       number;
  note_completion_pct: number;
  last_appointment:    string | null;
}

export interface OutcomeMeasuresResponse {
  report_type:   string;
  start_date:    string;
  end_date:      string;
  generated_at:  string;
  filters:       Record<string, unknown>;
  summary: {
    total_completed_appointments: number;
    total_notes:                  number;
    missing_notes:                number;
    overall_completion_pct:       number;
    total_patients:               number;
  };
  by_practitioner: OutcomePractitionerRow[];
  by_patient:      OutcomePatientRow[];
}

export interface OutcomeMeasuresParams extends ReportDateRange {
  practitioner_id?: number;
  branch_id?:       number;
}

export const getOutcomeMeasures = async (
  params?: OutcomeMeasuresParams
): Promise<OutcomeMeasuresResponse> => {
  const response = await axiosInstance.get('/reports/outcome_measures/', { params });
  return response.data;
};

// ─── Providers & Practice Report ─────────────────────────────────────────────

export interface ProvidersPracticeRow {
  practitioner_id:             number;
  practitioner_name:           string;
  total_appointments:          number;
  completed_appointments:      number;
  cancelled_appointments:      number;
  no_show_appointments:        number;
  consultations:               number;
  classes:                     number;
  revenue:                     number;
  avg_revenue_per_appointment: number;
  forward_booking_rate:        number;   // 0–100
  avg_session_duration_min:    number;
}

export interface ProvidersPracticeSummary {
  total_revenue:            number;
  avg_revenue_per_provider: number;
  total_appointments:       number;
  total_completed:          number;
  total_cancelled:          number;
  total_no_show:            number;
  total_consultations:      number;
  avg_forward_booking_pct:  number;
}

export interface ProvidersPracticeResponse {
  report_type:  string;
  tab:          string;
  start_date:   string;
  end_date:     string;
  generated_at: string;
  filters:      Record<string, unknown>;
  summary:      ProvidersPracticeSummary;
  providers:    ProvidersPracticeRow[];
}

export interface ProvidersPracticeParams extends ReportDateRange {
  practitioner_id?: number;
  branch_id?:       number;
}

export const getProvidersPractice = async (
  params?: ProvidersPracticeParams
): Promise<ProvidersPracticeResponse> => {
  const response = await axiosInstance.get('/reports/providers_practice/', { params });
  return response.data;
};