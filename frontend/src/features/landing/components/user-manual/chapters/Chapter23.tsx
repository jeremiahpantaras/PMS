import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter23: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how to generate invoices from appointments, securely record patient payments, and maintain accurate clinic financial histories.
      </p>

      {/* IMPORTANT CONCEPT — Invoice Workflow */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Invoice Workflow</h3>
        
        <p className="text-gray-700 font-body mb-4">
          In Malasakit, billing is deeply integrated with the clinic Calendar. To prevent administrative discrepancies, every invoice must be generated directly from an existing appointment. This guarantees that every consultation, procedure, or rendered service is properly documented financially.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Financial Documentation Sequence</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Completed Appointment</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Generate Invoice</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Review Bill</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-amber-50 rounded border border-amber-200">Record Payment</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Update Financial History</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 23.1: Invoice Workflow. Caption: 'Every invoice begins with an appointment and becomes part of the patient's financial record.'" />
      </div>


      {/* SECTION 23.1 — Generate Invoice */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        23.1 Generating Invoices
      </h3>
      <p className="text-gray-700 font-body mb-6">Creating financial records from completed appointments.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            When a patient's consultation concludes, front desk or finance staff can open the <strong>Appointment Details</strong> window to begin the billing process. Malasakit uses dynamic tab behavior to ensure data integrity:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li>If no invoice exists for the session, the tab will display <strong>Generate Invoice</strong>.</li>
            <li>Upon clicking Generate Invoice, the system automatically pulls the patient demographics, practitioner details, and scheduled services into a draft.</li>
            <li>Staff can review and adjust the line items before finalizing the creation.</li>
          </ul>

          <ScreenshotPlaceholder label="Screenshot 23.1: Appointment Details. Highlight Invoice tab showing Generate Invoice. Caption: 'Appointments without an existing invoice display the Generate Invoice option.'" />
          <ScreenshotPlaceholder label="Screenshot 23.2: Generate Invoice page. Highlight Invoice details before creation. Caption: 'Review invoice details before generating the final invoice.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 23.2: Generation Flow. Caption: 'Invoices are created directly from appointment records.'" />
          </div>
        </div>
      </div>

      <DocCallout type="info">
        Malasakit strictly enforces a one-to-one rule: Each appointment can have only one invoice. This fundamentally prevents accidental duplicate billing.
      </DocCallout>


      {/* SECTION 23.2 — View Invoice */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        23.2 Viewing Existing Invoices
      </h3>
      <p className="text-gray-700 font-body mb-6">Reviewing patient charges and billing status.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Once an invoice is finalized, it becomes permanently linked to both the originating appointment and the patient's holistic medical record. 
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The Appointment Details tab immediately transitions from "Generate Invoice" to <strong>View Invoice</strong>. Authorized staff can click this tab to review the complete financial breakdown, including line-item charges, subtotals, applied taxes, and the current payment status (e.g., Unpaid, Partially Paid, Paid). The same invoice can also be accessed via the <strong>Patient Cases</strong> timeline for historical review.
          </p>

          <ScreenshotPlaceholder label="Screenshot 23.3: Appointment Details. Highlight Invoice tab showing View Invoice. Caption: 'Appointments with existing invoices automatically display the View Invoice option.'" />
          <ScreenshotPlaceholder label="Screenshot 23.4: Invoice details. Highlight Invoice summary. Caption: 'Generated invoices display complete billing information for the appointment.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 23.3: View Workflow. Caption: 'Previously generated invoices remain linked to their originating appointment.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        Always review the invoice line items and totals with the patient before moving to the payment collection phase.
      </DocCallout>


      {/* SECTION 23.3 — Payments */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        23.3 Recording Payments
      </h3>
      <p className="text-gray-700 font-body mb-6">Managing collections and outstanding balances.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            To properly close an accounting cycle, clinic staff must record payments against the generated invoices. Using the <strong>Record Payment</strong> interface on the View Invoice screen, staff can log the payment amount and select the transaction method (e.g., Cash, Credit Card, Bank Transfer).
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            As payments are logged, the invoice's status and outstanding balance update dynamically. If a patient pays a fraction of the total, the status shifts to <strong>Partially Paid</strong>. Once the full balance is cleared, the system automatically marks the invoice as <strong>Paid</strong>, effectively closing the financial record for that consultation.
          </p>

          <ScreenshotPlaceholder label="Screenshot 23.5: Record Payment interface. Highlight Payment amount and payment method. Caption: 'Payments are recorded directly against the generated invoice.'" />
          <ScreenshotPlaceholder label="Screenshot 23.6: Updated invoice. Highlight Payment status. Caption: 'Invoice status updates automatically after payment is recorded.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 23.4: Payment Workflow. Caption: 'Recording payments keeps patient billing records accurate and up to date.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        Only authorized users with billing privileges (such as Finance or Management roles) should generate invoices or record payments to maintain the integrity of clinic financial records.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how to process patient billing using the Invoice module. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>How to <strong>Generate Invoices</strong> directly from completed appointments.</li>
        <li>How the system dynamically toggles between <strong>Generate Invoice</strong> and <strong>View Invoice</strong> to prevent duplicate billing.</li>
        <li>How invoices remain permanently linked to both the appointment and the overarching <strong>Patient Case</strong>.</li>
        <li>How to <strong>Record Payments</strong> and track shifting statuses like Unpaid, Partially Paid, and Paid.</li>
      </ul>
    </>
  );
};

export default Chapter23;
