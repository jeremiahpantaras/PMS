import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter14: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how Patient Cases act as the centralized hub for a patient's entire medical journey, combining appointments, notes, and billing.
      </p>

      {/* IMPORTANT CONCEPT — Patient Case Lifecycle */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">The Patient Case Lifecycle</h3>
        
        <p className="text-gray-700 font-body mb-4">
          Instead of scattering patient information across multiple isolated modules, Malasakit aggregates every appointment, consultation, clinical note, and invoice into a single, comprehensive patient record. This chronological organization allows practitioners and clinic staff to instantly understand the patient's full history.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Data Aggregation Flow</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Registration</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Appointment</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Clinical Note</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Invoice</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200 font-bold">Treatment History</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Patient Timeline</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 14.1: Patient Case Lifecycle. Caption: 'Patient Cases combines every clinical activity into one complete timeline.'" />
      </div>


      {/* SECTION 14.1 — Timeline */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        14.1 The Patient Timeline
      </h3>
      <p className="text-gray-700 font-body mb-6">A chronological history of every clinical event.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The Patient Timeline automatically logs and displays patient activities in chronological order. Instead of digging through separate billing or appointment modules, practitioners can scroll through the timeline to see exactly what happened and when.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>Initial Registration:</strong> When the profile was first created.</li>
            <li><strong>Appointments:</strong> Booked, completed, or cancelled visits.</li>
            <li><strong>Clinical Notes:</strong> Documents saved by practitioners.</li>
            <li><strong>Invoices:</strong> Billing events generated from visits.</li>
          </ul>

          <ScreenshotPlaceholder label="Screenshot 14.1: Patient Cases main page. Highlight Timeline and Navigation tabs. Caption: 'The Patient Cases module provides a centralized timeline of the patient's clinical journey.'" />
          <ScreenshotPlaceholder label="Screenshot 14.2: Patient Timeline. Highlight Chronological activities. Caption: 'Events are displayed in chronological order, allowing practitioners to review patient history quickly.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 14.2: Timeline Flow. Caption: 'The patient timeline organizes every significant clinical event in chronological order.'" />
          </div>
        </div>
      </div>

      <DocCallout type="info">
        The Timeline provides a rapid overview of the patient's clinical journey without ever requiring users to search through other disconnected modules.
      </DocCallout>


      {/* SECTION 14.2 — History */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        14.2 Appointment History
      </h3>
      <p className="text-gray-700 font-body mb-6">Review previous and recurring consultations.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The Appointment History tab includes every completed visit associated with the patient. This allows practitioners to easily trace treatment progression over multiple sessions, prepare for upcoming consultations, and verify attendance records. 
          </p>

          <ScreenshotPlaceholder label="Screenshot 14.3: Appointment History. Highlight Appointment list, Visit dates, Practitioner. Caption: 'Appointment History provides a complete record of previous patient visits.'" />
          <ScreenshotPlaceholder label="Screenshot 14.4: Appointment Details. Highlight Completed consultation. Caption: 'Selecting an appointment displays its detailed information.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 14.3: Treatment History. Caption: 'Historical appointments provide a complete treatment progression for each patient.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        Always review previous appointments before beginning a new consultation to better understand the patient's ongoing care and past treatment efficacy.
      </DocCallout>


      {/* SECTION 14.3 — Clinical Notes */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        14.3 Clinical Notes
      </h3>
      <p className="text-gray-700 font-body mb-6">How medical documentation is stored.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Every Clinical Note (such as SOAP notes or practitioner documentation) is permanently linked to the specific appointment in which it was created. 
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            By viewing the Clinical Notes tab within the Patient Case, practitioners can review historical medical documentation chronologically, matching the patient's treatment progression precisely, without needing to navigate to the standalone Clinical module.
          </p>

          <ScreenshotPlaceholder label="Screenshot 14.5: Clinical Notes tab. Highlight Clinical Note list, Appointment reference. Caption: 'Clinical Notes are organized according to the appointment in which they were created.'" />
          <ScreenshotPlaceholder label="Screenshot 14.6: View Clinical Note. Highlight Practitioner, Appointment, Clinical content. Caption: 'Each Clinical Note preserves the documentation recorded during the patient's consultation.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 14.4: Note Linking Flow. Caption: 'Clinical Notes become part of the patient's permanent treatment history.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        Clinical Notes cannot exist independently—they are always strictly linked to a specific appointment to ensure medical documentation maintains accurate chronological and contextual integrity.
      </DocCallout>


      {/* SECTION 14.4 — Invoices */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        14.4 Invoices
      </h3>
      <p className="text-gray-700 font-body mb-6">Review billing records from past appointments.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Invoices generated from completed appointments automatically feed into the patient's Patient Case. This provides a clear billing history, allowing Front Desk or Finance staff to quickly verify past payments, review Invoice Numbers, and check outstanding balances directly from the patient's medical file.
          </p>

          <ScreenshotPlaceholder label="Screenshot 14.7: Invoices tab. Highlight Invoice list. Caption: 'Patient Cases displays every invoice associated with the patient's completed appointments.'" />
          <ScreenshotPlaceholder label="Screenshot 14.8: Invoice Details. Highlight Invoice Number, Appointment, Payment Status. Caption: 'Each invoice remains linked to the appointment that generated it.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 14.5: Billing History. Caption: 'Invoices become part of the patient's complete financial history.'" />
          </div>
        </div>
      </div>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you explored the power of the centralized Patient Cases module. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>How the <strong>Patient Timeline</strong> chronologically displays every clinical event from registration to recent visits.</li>
        <li>How the <strong>Appointment History</strong> tab provides a clear view of treatment progression.</li>
        <li>Why <strong>Clinical Notes</strong> are always linked to specific appointments, and how to review them historically.</li>
        <li>How <strong>Invoices</strong> are aggregated to provide a complete view of the patient's billing history directly from their case file.</li>
      </ul>
    </>
  );
};

export default Chapter14;
