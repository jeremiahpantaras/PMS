import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter25: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how to securely record patient payments, track outstanding balances, and generate official receipts.
      </p>

      {/* IMPORTANT CONCEPT — Payment Workflow */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Payment Workflow</h3>
        
        <p className="text-gray-700 font-body mb-4">
          In Malasakit, the Payments module ensures that every financial transaction is explicitly linked to an existing invoice. This structure guarantees that patient balances are calculated accurately and provides a transparent audit trail for your clinic's accounting.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Financial Transaction Sequence</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Generated Invoice</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Record Payment</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-amber-50 rounded border border-amber-200">Update Balance</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Payment History Updated</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 25.1: Payment Workflow. Caption: 'Every recorded payment updates the invoice and becomes part of the patient's financial history.'" />
      </div>


      {/* SECTION 25.1 — Recording Payments */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        25.1 Recording Payments
      </h3>
      <p className="text-gray-700 font-body mb-6">Logging transactions against patient invoices.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            To collect funds for a consultation or procedure, staff must record the payment directly against the corresponding invoice. 
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            By clicking the <strong>Record Payment</strong> button while viewing an invoice, staff can open the payment modal. Here, they are required to input the specific <strong>Payment Amount</strong>, select the <strong>Payment Method</strong> (e.g., Cash, Credit Card, Bank Transfer), and verify the payment date. If the patient is only making a partial payment, the invoice will remain open until the total remaining balance reaches zero.
          </p>

          <ScreenshotPlaceholder label="Screenshot 25.1: Invoice Details. Highlight Record Payment button. Caption: 'Open an invoice and select Record Payment to begin recording a patient payment.'" />
          <ScreenshotPlaceholder label="Screenshot 25.2: Record Payment modal. Highlight Payment amount and payment method fields. Caption: 'Enter payment details before saving the transaction.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 25.2: Transaction Flow. Caption: 'Payments immediately update the invoice's financial status.'" />
          </div>
        </div>
      </div>

      <DocCallout type="info">
        Every recorded payment is permanently associated with its parent invoice to maintain a complete, unbroken financial audit trail for the clinic.
      </DocCallout>


      {/* SECTION 25.2 — Receipts */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        25.2 Generating Receipts
      </h3>
      <p className="text-gray-700 font-body mb-6">Providing patients with proof of payment.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Once a payment is successfully saved, the system immediately logs the transaction and can generate an official receipt. 
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The receipt serves as official confirmation for the patient. It automatically pulls in your clinic's branding and includes critical data such as the receipt number, the originating invoice number, the specific amount paid, the payment method used, and any remaining balance if it was a partial payment.
          </p>

          <ScreenshotPlaceholder label="Screenshot 25.3: Receipt preview. Highlight Receipt layout. Caption: 'Receipts provide patients with confirmation of successful payment.'" />
          <ScreenshotPlaceholder label="Screenshot 25.4: Printable receipt. Highlight Clinic branding and payment details. Caption: 'Receipts include important payment information for both the patient and the clinic.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 25.3: Receipt Generation. Caption: 'Receipts serve as official confirmation that payment has been received.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        Always verify the payment amount and method with the patient before finalizing the transaction and issuing the official receipt.
      </DocCallout>


      {/* SECTION 25.3 — Outstanding Balances */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        25.3 Outstanding Balances
      </h3>
      <p className="text-gray-700 font-body mb-6">Tracking the financial completion of an invoice.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            As payments are applied, the system dynamically recalculates the invoice's outstanding balance. This allows staff to instantly see if a patient still owes money for past services.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The invoice status acts as a quick visual indicator:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>Unpaid:</strong> No payments have been recorded yet.</li>
            <li><strong>Partially Paid:</strong> One or more payments have been made, but a remaining balance exists.</li>
            <li><strong>Paid:</strong> The remaining balance has reached zero, and the invoice is financially closed.</li>
          </ul>

          <ScreenshotPlaceholder label="Screenshot 25.5: Invoice summary. Highlight Remaining balance. Caption: 'Outstanding balances update automatically after every recorded payment.'" />
          <ScreenshotPlaceholder label="Screenshot 25.6: Paid invoice. Highlight Paid status. Caption: 'Invoices display a Paid status once the remaining balance reaches zero.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 25.4: Balance Logic. Caption: 'Invoice balances continuously update until payment is completed.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        Only authorized personnel with strict billing permissions should record or modify payments. This ensures the integrity of the clinic's financial auditing.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how to process financial transactions using the Payments module. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>How to <strong>Record Payments</strong> against specific invoices using various payment methods.</li>
        <li>How <strong>Receipts</strong> are generated to provide patients with official transaction proof.</li>
        <li>How the system dynamically calculates <strong>Outstanding Balances</strong>.</li>
        <li>How the invoice status transitions to <strong>Paid</strong> once the financial obligation is fulfilled.</li>
      </ul>
    </>
  );
};

export default Chapter25;
