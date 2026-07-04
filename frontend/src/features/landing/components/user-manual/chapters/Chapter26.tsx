import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter26: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how to monitor clinic performance, track daily operations, and analyze business trends using the centralized Dashboard.
      </p>

      {/* IMPORTANT CONCEPT — Dashboard Overview */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Dashboard Overview</h3>
        
        <p className="text-gray-700 font-body mb-4">
          The Dashboard serves as your clinic's primary operational hub. Upon signing in, it instantly consolidates complex clinic data—such as appointments, patient growth, and financial metrics—into easy-to-read widgets, statistics, and charts. This enables owners and managers to make rapid, data-driven decisions.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Data Visualization Flow</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Clinic Activity</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Dashboard Widgets</span>
            <span className="text-sky-400">→</span>
            <div className="flex flex-col gap-1">
              <span className="px-3 py-1 bg-amber-50 rounded border border-amber-200">KPIs</span>
              <span className="px-3 py-1 bg-amber-50 rounded border border-amber-200">Charts</span>
            </div>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Business Insights</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 26.1: Dashboard Overview. Caption: 'The Dashboard transforms clinic data into meaningful insights for daily decision-making.'" />
      </div>


      {/* SECTION 26.1 — KPIs */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        26.1 Key Performance Indicators (KPIs)
      </h3>
      <p className="text-gray-700 font-body mb-6">At-a-glance operational metrics.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Positioned at the top of the dashboard, KPI cards provide instant access to the clinic's most critical pulse points. These cards automatically recalculate in real-time as clinic activity occurs throughout the day.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Depending on your role and permissions, your dashboard may display KPIs such as:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>Today's Appointments:</strong> Total patients scheduled for the current day.</li>
            <li><strong>Total Patients:</strong> The overall size of the clinic's patient registry.</li>
            <li><strong>Revenue:</strong> Gross financial intake for a designated period.</li>
            <li><strong>Outstanding Invoices:</strong> Total uncollected funds requiring follow-up.</li>
          </ul>

          <ScreenshotPlaceholder label="Screenshot 26.1: Dashboard overview. Highlight KPI cards. Caption: 'KPI cards provide a quick overview of the clinic's most important operational metrics.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 26.2: KPI Flow. Caption: 'Key Performance Indicators summarize important clinic information in a single view.'" />
          </div>
        </div>
      </div>

      <DocCallout type="info">
        Dashboard KPIs refresh automatically as clinic activity changes, providing up-to-date operational information without requiring manual page reloads.
      </DocCallout>


      {/* SECTION 26.2 — Statistics */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        26.2 Statistical Summaries
      </h3>
      <p className="text-gray-700 font-body mb-6">Monitoring trends over selected time periods.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Beneath the immediate KPIs, Statistical Widgets summarize clinic activity over broader time horizons (e.g., weekly or monthly). These summaries help administrators identify trends and evaluate overall clinic health.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Common statistical summaries include metrics like <strong>Completed Appointments</strong> versus <strong>Cancelled Appointments</strong>, tracking <strong>DNA (Did Not Attend)</strong> rates to evaluate patient compliance, and measuring the volume of <strong>Online Bookings</strong> versus manual front-desk registrations.
          </p>

          <ScreenshotPlaceholder label="Screenshot 26.2: Statistics section. Highlight Summary cards. Caption: 'Statistical summaries help monitor clinic activity and operational performance.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 26.3: Statistics Flow. Caption: 'Statistics transform operational data into meaningful summaries.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        Review dashboard statistics regularly. Identifying a sudden spike in cancellations or DNA rates early allows management to proactively address operational issues.
      </DocCallout>


      {/* SECTION 26.3 — Charts */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        26.3 Visual Analytics
      </h3>
      <p className="text-gray-700 font-body mb-6">Identifying patterns through visual graphs.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Visual representations make it significantly easier to identify patterns compared to viewing raw spreadsheet numbers. The Dashboard's Charts transform operational data into actionable visual insights.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Interactive charts may visualize <strong>Appointment Trends</strong> (identifying peak days or hours), track <strong>Patient Growth</strong> over quarters, or analyze <strong>Revenue Trends</strong> to project future financial health. Users can often interact with these charts by adjusting date ranges or hovering over specific data points for exact figures.
          </p>

          <ScreenshotPlaceholder label="Screenshot 26.3: Dashboard charts. Highlight Primary analytics chart. Caption: 'Charts visualize clinic performance over time.'" />
          <ScreenshotPlaceholder label="Screenshot 26.4: Dashboard analytics. Highlight Trend graphs. Caption: 'Visual analytics help identify performance patterns and operational trends.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 26.4: Visual Analytics. Caption: 'Charts convert operational data into actionable visual insights.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        While charts are excellent for high-level decision-making, they should always be interpreted together with detailed Reports for comprehensive financial or clinical analysis.
      </DocCallout>


      {/* SECTION 26.4 — Role-Based Visibility */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        26.4 Role-Based Dashboard Visibility
      </h3>
      <p className="text-gray-700 font-body mb-6">How permissions shape the dashboard experience.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Because Malasakit utilizes strict Role-Based Access Control (RBAC), the Dashboard dynamically adapts its widgets and data scope based on the logged-in user's role and assigned branch:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="p-5 bg-sky-50 rounded-xl border border-sky-200">
              <h4 className="font-bold text-sky-900 mb-2">Owner</h4>
              <p className="text-sm text-gray-700">Views an organization-wide dashboard aggregating data across <em>all</em> clinic branches.</p>
            </div>
            <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-2">Manager</h4>
              <p className="text-sm text-gray-700">Views statistics and KPIs exclusively for their specifically assigned clinic branch(es).</p>
            </div>
            <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-2">Practitioner</h4>
              <p className="text-sm text-gray-700">Views personal operational data, focusing on their specific appointments, workload, and schedule.</p>
            </div>
            <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-2">Front Desk & Finance</h4>
              <p className="text-sm text-gray-700">Front Desk sees operational appointment metrics, while Finance sees restricted billing summaries.</p>
            </div>
          </div>

          <ScreenshotPlaceholder label="Screenshot 26.5: Dashboard viewed by an Owner. Highlight Organization-wide statistics. Caption: 'Owners can view organization-wide dashboard information across all clinic branches.'" />
          <ScreenshotPlaceholder label="Screenshot 26.6: Dashboard viewed by a Manager. Highlight Branch-specific statistics. Caption: 'Managers only see dashboard information for their assigned clinic branches.'" />
        </div>
      </div>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how to interpret clinic performance using the Dashboard. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>How <strong>KPI Cards</strong> summarize the most critical metrics in real-time.</li>
        <li>How <strong>Statistical Summaries</strong> help monitor operational activity and patient compliance over time.</li>
        <li>How visual <strong>Charts</strong> transform raw data into actionable business insights.</li>
        <li>How the system enforces <strong>Role-Based Visibility</strong> to restrict dashboard scope for Managers and Practitioners.</li>
      </ul>
    </>
  );
};

export default Chapter26;
