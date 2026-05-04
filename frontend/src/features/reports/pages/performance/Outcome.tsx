import React, { useState, useCallback } from 'react';
import { FileText, CheckCircle2, AlertCircle, Users, Stethoscope } from 'lucide-react';
import {
  getOutcomeMeasures,
  type OutcomeMeasuresResponse,
} from '../../reports.api';
import {
  DateRangePicker,
  StatCard,
  ReportLoading,
  ReportError,
  ReportEmpty,
  ReportHeader,
  formatDate,
  todayISO,
  monthStart,
} from '../../components/ReportShared';
import toast from 'react-hot-toast';

// ─── Completion progress bar ──────────────────────────────────────────────────

const CompletionBar: React.FC<{ pct: number }> = ({ pct }) => {
  const clamped = Math.min(100, Math.max(0, pct));
  const color =
    clamped >= 80 ? 'bg-green-500'
    : clamped >= 50 ? 'bg-yellow-400'
    : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-10 text-right">
        {clamped.toFixed(1)}%
      </span>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

type TabKey = 'practitioner' | 'patient';

export const Outcome: React.FC = () => {
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate,   setEndDate]   = useState(todayISO());
  const [data,      setData]      = useState<OutcomeMeasuresResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [hasRun,    setHasRun]    = useState(false);
  const [tab,       setTab]       = useState<TabKey>('practitioner');

  const run = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getOutcomeMeasures({ start_date: startDate, end_date: endDate });
      setData(result);
      setHasRun(true);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to generate Outcome Measures report';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          onApply={run}
          isLoading={isLoading}
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <ReportLoading />
        ) : error ? (
          <ReportError message={error} onRetry={run} />
        ) : !hasRun ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-purple-200">
              <FileText className="w-8 h-8 text-purple-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Outcome Measures Report</p>
            <p className="text-xs text-gray-500 max-w-xs">
              Select a date range and click <strong>Run Report</strong> to review clinical note
              completion rates by provider and patient.
            </p>
          </div>
        ) : !data || data.summary.total_completed_appointments === 0 ? (
          <ReportEmpty message="No completed appointment data found for the selected date range." />
        ) : (
          <>
            <ReportHeader
              title="Outcome Measures"
              description="Clinical note completion rates by provider and patient"
              startDate={data.start_date}
              endDate={data.end_date}
              icon={<FileText className="w-5 h-5" />}
              totalBadge={
                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {data.summary.overall_completion_pct.toFixed(1)}% Complete
                </span>
              }
            />

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard
                label="Overall Completion"
                value={`${data.summary.overall_completion_pct.toFixed(1)}%`}
                color="text-purple-700"
                bg="bg-purple-50"
                border="border-purple-200"
                icon={<CheckCircle2 className="w-4 h-4" />}
              />
              <StatCard
                label="Notes Completed"
                value={data.summary.total_notes}
                color="text-green-700"
                bg="bg-green-50"
                border="border-green-200"
                icon={<FileText className="w-4 h-4" />}
              />
              <StatCard
                label="Notes Missing"
                value={data.summary.missing_notes}
                color="text-red-700"
                bg="bg-red-50"
                border="border-red-200"
                icon={<AlertCircle className="w-4 h-4" />}
              />
              <StatCard
                label="Patients"
                value={data.summary.total_patients}
                color="text-sky-700"
                bg="bg-sky-50"
                border="border-sky-200"
                icon={<Users className="w-4 h-4" />}
              />
            </div>

            {/* Tab switcher */}
            <div className="flex gap-2 mb-4">
              {(['practitioner', 'patient'] as TabKey[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    tab === t
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700'
                  }`}
                >
                  {t === 'practitioner' ? (
                    <span className="flex items-center gap-1"><Stethoscope className="w-3 h-3" />By Practitioner</span>
                  ) : (
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />By Patient</span>
                  )}
                </button>
              ))}
            </div>

            {/* Practitioner table */}
            {tab === 'practitioner' && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-3 text-left font-semibold">Practitioner</th>
                        <th className="px-4 py-3 text-right font-semibold">Total Notes</th>
                        <th className="px-4 py-3 text-right font-semibold">Completed</th>
                        <th className="px-4 py-3 text-right font-semibold">Missing</th>
                        <th className="px-4 py-3 font-semibold min-w-45">Completion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_practitioner.map((row, idx) => (
                        <tr
                          key={row.practitioner_id}
                          className={`border-t border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">{row.practitioner_name}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{row.total_notes}</td>
                          <td className="px-4 py-3 text-right text-green-700 font-semibold">{row.completed_notes}</td>
                          <td className="px-4 py-3 text-right text-red-600">{row.missing_notes}</td>
                          <td className="px-4 py-3">
                            <CompletionBar pct={row.note_completion_pct} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Patient table */}
            {tab === 'patient' && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-3 text-left font-semibold">Patient</th>
                        <th className="px-4 py-3 text-right font-semibold">Appts</th>
                        <th className="px-4 py-3 text-right font-semibold">Completed</th>
                        <th className="px-4 py-3 text-right font-semibold">Missing</th>
                        <th className="px-4 py-3 font-semibold min-w-45">Completion</th>
                        <th className="px-4 py-3 text-right font-semibold">Last Appt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_patient.map((row, idx) => (
                        <tr
                          key={row.patient_id}
                          className={`border-t border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{row.patient_name}</div>
                            <div className="text-xs text-gray-400">#{row.patient_number}</div>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{row.total_appointments}</td>
                          <td className="px-4 py-3 text-right text-green-700 font-semibold">{row.completed_notes}</td>
                          <td className="px-4 py-3 text-right text-red-600">{row.missing_notes}</td>
                          <td className="px-4 py-3">
                            <CompletionBar pct={row.note_completion_pct} />
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500 text-xs">
                            {row.last_appointment ? formatDate(row.last_appointment) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
