import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter24: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how to streamline clinic billing by generating multiple invoices for eligible appointments in a single automated batch operation.
      </p>

      {/* IMPORTANT CONCEPT — Bulk Invoicing Workflow */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Bulk Invoicing Workflow</h3>
        
        <p className="text-gray-700 font-body mb-4">
          For high-volume clinics, individually generating invoices for every appointment can be incredibly time-consuming. <strong>Bulk Invoicing</strong> allows authorized finance staff to safely query the system for unbilled, completed appointments and generate their corresponding invoices simultaneously.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Batch Processing Sequence</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Select Filters</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Load Eligible Appointments</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-amber-50 rounded border border-amber-200">Review Batch</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Generate Invoices</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Invoices Created</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 24.1: Bulk Invoicing Workflow. Caption: 'Bulk Invoicing streamlines billing by generating multiple invoices in a single operation.'" />
      </div>


      {/* SECTION 24.1 — Batch Creation */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        24.1 Batch Creation
      </h3>
      <p className="text-gray-700 font-body mb-6">Filtering and identifying eligible unbilled appointments.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The bulk invoicing process begins on the <strong>Bulk Invoicing</strong> page. Users must first apply system filters to query for specific appointments. Typical filters allow staff to narrow down the search by Date Range, Clinic Branch, Practitioner, or Appointment Status.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Once filters are applied, the system automatically runs an eligibility check. It strictly returns <em>only</em> those appointments that do not currently have a linked invoice. Appointments that have already been billed are completely excluded from the batch list, preventing any possibility of duplicate invoicing.
          </p>

          <ScreenshotPlaceholder label="Screenshot 24.1: Bulk Invoicing page. Highlight Filter panel. Caption: 'Select filters to locate appointments eligible for bulk invoice generation.'" />
          <ScreenshotPlaceholder label="Screenshot 24.2: Eligible appointment list. Highlight Appointments ready for invoicing. Caption: 'Only appointments that qualify for invoicing are displayed in the batch list.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 24.2: Filter Workflow. Caption: 'Bulk Invoicing automatically prepares a list of appointments that can be invoiced.'" />
          </div>
        </div>
      </div>

      <DocCallout type="info">
        Malasakit inherently prevents duplicate billing. Appointments that already have invoices are automatically excluded from new batch generation.
      </DocCallout>


      {/* SECTION 24.2 — Review */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        24.2 Reviewing the Batch
      </h3>
      <p className="text-gray-700 font-body mb-6">Verifying data before initiating mass creation.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Before executing the mass generation, staff should carefully review the loaded batch. The system presents a detailed Appointment Summary table displaying critical information for each pending invoice:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>Patient Name</strong></li>
            <li><strong>Practitioner</strong></li>
            <li><strong>Clinic Branch</strong></li>
            <li><strong>Scheduled Services</strong></li>
            <li><strong>Total Charges</strong></li>
          </ul>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            This verification step is crucial. It allows finance staff to spot anomalous charges, missing services, or incorrect branch assignments before permanently writing the financial records to the database.
          </p>

          <ScreenshotPlaceholder label="Screenshot 24.3: Batch review list. Highlight Appointment summary table. Caption: 'Review every appointment before generating invoices.'" />
          <ScreenshotPlaceholder label="Screenshot 24.4: Batch summary. Highlight Total appointments selected. Caption: 'The batch summary provides an overview of invoices that will be generated.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 24.3: Review Workflow. Caption: 'Verifying the batch reduces billing errors before invoice generation.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        Always review the selected appointments and their associated services before generating invoices to ensure absolute billing accuracy.
      </DocCallout>


      {/* SECTION 24.3 — Generation */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        24.3 Invoice Generation
      </h3>
      <p className="text-gray-700 font-body mb-6">Executing the bulk creation process.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Once the batch is verified, clicking <strong>Run Bulk Invoice</strong> begins the generation process. The system displays a live Progress Indicator as it sequentially builds each financial record in the background.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Malasakit's generation engine is resilient. If a specific appointment fails validation during processing (e.g., if a practitioner edits the appointment concurrently), the system will safely skip it and continue processing the rest of the batch.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Upon completion, a <strong>Success Summary</strong> is displayed, detailing the total number of successfully created invoices versus any failures. The newly minted invoices are immediately available across the system, appearing within the corresponding Appointment Details and Patient Cases timelines.
          </p>

          <ScreenshotPlaceholder label="Screenshot 24.5: Generate button. Highlight Run Bulk Invoice button. Caption: 'Begin invoice generation after reviewing the selected appointments.'" />
          <ScreenshotPlaceholder label="Screenshot 24.6: Generation progress. Highlight Progress indicator or loading state. Caption: 'The system displays generation progress while creating invoices.'" />
          <ScreenshotPlaceholder label="Screenshot 24.7: Generation completed. Highlight Success summary. Caption: 'A completion summary shows how many invoices were successfully generated.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 24.4: Generation Flow. Caption: 'Bulk invoice generation processes appointments efficiently while tracking progress.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        Bulk Invoicing creates permanent financial records en masse. Only authorized staff should execute this operation, and the batch must always be verified prior to starting.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how to save administrative time using the Bulk Invoicing module. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>How to properly query for eligible unbilled appointments using <strong>System Filters</strong>.</li>
        <li>How the system's eligibility rules automatically prevent <strong>duplicate invoicing</strong>.</li>
        <li>The importance of utilizing the <strong>Review Batch</strong> phase to catch billing discrepancies.</li>
        <li>How to execute the mass generation and interpret the <strong>Completion Summary</strong>.</li>
      </ul>
    </>
  );
};

export default Chapter24;
