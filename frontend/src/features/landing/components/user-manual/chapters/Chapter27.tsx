import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter27: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how to monitor practitioner utilization, measure appointment capacity, and generate printable operational reports across your clinic branches.
      </p>

      {/* IMPORTANT CONCEPT — Occupancy Calculation */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Occupancy Calculation</h3>
        
        <p className="text-gray-700 font-body mb-4">
          In Malasakit, occupancy is <em>not</em> merely a simple count of appointments. Instead, it measures true practitioner utilization by comparing the total duration of booked appointments against the practitioner's configured <strong>Available Duty Hours</strong>. This reflects the actual percentage of available working time that has been booked.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Calculation Workflow</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Practitioner Duty Hours</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Available Working Time</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-amber-50 rounded border border-amber-200">Booked Appointments</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Occupancy %</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 27.1: Occupancy Calculation Workflow. Caption: 'Occupancy is calculated from practitioner duty hours rather than the number of appointments.'" />
      </div>


      {/* SECTION 27.1 — Report Filters */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        27.1 Report Filters
      </h3>
      <p className="text-gray-700 font-body mb-6">Narrowing data to generate targeted analytics.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            To generate meaningful insights, users must utilize the report filters located at the top of the Occupancy page. You can combine these filters to perform highly detailed analyses:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="p-5 bg-sky-50 rounded-xl border border-sky-200">
              <h4 className="font-bold text-sky-900 mb-2">Time & Date Range</h4>
              <p className="text-sm text-gray-700">Select quick presets like <em>Today</em>, <em>This Week</em>, or <em>This Month</em>, or define a specific <em>Custom Range</em> (From Date → To Date).</p>
            </div>
            <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-2">Branch Visibility</h4>
              <p className="text-sm text-gray-700"><strong>Owners</strong> can select and view any clinic branch. <strong>Managers</strong> can only select their explicitly assigned branches; all others remain hidden.</p>
            </div>
            <div className="p-5 bg-gray-50 rounded-xl border border-gray-200 md:col-span-2">
              <h4 className="font-bold text-gray-900 mb-2">Practitioner Selection</h4>
              <p className="text-sm text-gray-700">Filter the report to evaluate a single practitioner, multiple selected practitioners, or the entire staff roster at once.</p>
            </div>
          </div>

          <ScreenshotPlaceholder label="Screenshot 27.1: Occupancy Report page. Highlight Filter panel. Caption: 'Use report filters to generate occupancy reports for specific time periods, branches, and practitioners.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 27.2: Filter Workflow. Caption: 'Report filters allow users to generate targeted occupancy analytics.'" />
          </div>
        </div>
      </div>

      <DocCallout type="info">
        Combining multiple filters (e.g., specific date range + specific branch + specific practitioner) provides the most precise occupancy analysis.
      </DocCallout>


      {/* SECTION 27.2 — Practitioner Occupancy */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        27.2 Practitioner Occupancy
      </h3>
      <p className="text-gray-700 font-body mb-6">Evaluating individual scheduling efficiency.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The generated report breaks down performance on a per-practitioner basis. If a practitioner's configured duty hours are from 8:00 AM to 5:00 PM, and every available minute is booked with appointments, the system will display <strong>100% Occupancy</strong>.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Alongside the core occupancy percentage, the report provides supplementary statistics to contextualize the workload:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>Number of Clients:</strong> The total raw count of patient appointments.</li>
            <li><strong>New Clients:</strong> The number of first-time patients seen within the selected period.</li>
          </ul>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            It is critical to note that these patient counts are independent of the occupancy percentage (e.g., 5 lengthy procedures might result in 100% occupancy, while 15 quick consultations might only result in 60% occupancy).
          </p>

          <ScreenshotPlaceholder label="Screenshot 27.2: Practitioner Occupancy table. Highlight Occupancy percentage. Caption: 'Occupancy percentages are calculated from practitioner duty hours.'" />
          <ScreenshotPlaceholder label="Screenshot 27.3: Occupancy statistics. Highlight Clients and New Clients. Caption: 'Client statistics complement occupancy metrics by showing practitioner workload.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 27.3: Occupancy Logic. Caption: 'Occupancy and patient statistics provide a complete picture of practitioner utilization.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        A high appointment count does not necessarily indicate high occupancy. True occupancy entirely depends on the ratio of booked time against the practitioner's available working hours.
      </DocCallout>


      {/* SECTION 27.3 — Branch Occupancy */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        27.3 Branch Occupancy
      </h3>
      <p className="text-gray-700 font-body mb-6">Aggregating utilization across an entire clinic location.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            While individual metrics are useful, administrators often need a macro perspective. Branch Occupancy reports mathematically aggregate the utilization of all selected practitioners within a specific location to produce a single operational view.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Role-Based Access Control determines the scope of this multi-branch reporting:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>Owners</strong> can compare aggregate occupancy across <em>all</em> clinic branches simultaneously to assess organizational health.</li>
            <li><strong>Managers</strong> are restricted to generating reports strictly for the specific clinic branches they are assigned to manage.</li>
          </ul>

          <ScreenshotPlaceholder label="Screenshot 27.4: Branch filter. Highlight Branch selector. Caption: 'Owners may generate reports for any branch, while Managers only access assigned branches.'" />
          <ScreenshotPlaceholder label="Screenshot 27.5: Branch occupancy report. Highlight Branch occupancy summary. Caption: 'Branch reports summarize practitioner utilization across an entire clinic location.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 27.4: Branch Aggregation. Caption: 'Branch occupancy combines practitioner utilization into a single operational view.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        Role-Based Access Control automatically limits Managers to viewing reports only for assigned clinic branches, protecting sensitive operational data across the wider organization.
      </DocCallout>


      {/* SECTION 27.4 — Printing Reports */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        27.4 Printing Reports
      </h3>
      <p className="text-gray-700 font-body mb-6">Generating standardized operational documents.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            To ensure reporting consistency during management meetings or operational reviews, Malasakit uses backend-generated HTML templates for printing. 
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            When you click Print, the backend server processes your filters and formats the data into a standardized layout before passing it back to your browser's Print Preview. This guarantees that printed reports always look professional, regardless of the device or web browser you are using.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The final printed document typically includes the clinic header, a summary of the applied filters (Date Range, Branch), the practitioner statistics, and a generated timestamp for auditing purposes.
          </p>

          <ScreenshotPlaceholder label="Screenshot 27.6: Print Preview. Highlight Printable occupancy report. Caption: 'Printable reports are generated using standardized backend templates.'" />
          <ScreenshotPlaceholder label="Screenshot 27.7: Printed report layout. Highlight Header and occupancy table. Caption: 'Printed reports provide a professional summary suitable for management and operational reviews.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 27.5: Print Workflow. Caption: 'The backend generates the printable layout while the browser handles printing.'" />
          </div>
        </div>
      </div>

      <DocCallout type="info">
        Using backend-generated templates ensures that all printed reports maintain strict formatting consistency, making them ideal for saving as PDFs or sharing externally.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how to measure clinic capacity using Occupancy Reports. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>How occupancy is calculated by comparing booked time against <strong>Practitioner Duty Hours</strong>.</li>
        <li>How to apply targeted <strong>Filters</strong> (Date Range, Branch, Practitioner) to isolate specific analytics.</li>
        <li>How <strong>Role-Based Access Control</strong> dictates whether users can run multi-branch aggregate reports.</li>
        <li>How the system uses <strong>Backend Templates</strong> to produce highly consistent, professional printed reports.</li>
      </ul>
    </>
  );
};

export default Chapter27;
