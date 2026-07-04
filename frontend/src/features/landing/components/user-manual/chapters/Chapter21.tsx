import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter21: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how to securely document patient consultations using standardized templates and ensure every note is properly linked to an appointment.
      </p>

      {/* IMPORTANT CONCEPT — Clinical Note Workflow */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Clinical Note Workflow</h3>
        
        <p className="text-gray-700 font-body mb-4">
          Clinical Notes are the core of your clinic's electronic medical records. In Malasakit, every Clinical Note must be linked directly to an appointment. This strict relationship preserves an accurate chronological history and ensures practitioners always have context when reviewing a patient's past treatments.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Documentation Sequence</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Appointment</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Open Clinical Note</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Select Template</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-amber-50 rounded border border-amber-200">Complete Fields</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Update Patient Case</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 21.1: Clinical Note Workflow. Caption: 'Every Clinical Note is linked to a patient appointment and becomes part of the patient's permanent clinical record.'" />
      </div>


      {/* SECTION 21.1 — Templates */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        21.1 Standardized Templates
      </h3>
      <p className="text-gray-700 font-body mb-6">Ensuring consistent and accurate documentation.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            When creating a new Clinical Note, practitioners must first select an appropriate <strong>Clinical Note Template</strong>. Templates are pre-configured forms that load specific clinical sections required for a given type of consultation (e.g., SOAP Notes, Initial Assessments, Follow-ups).
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Selecting a template automatically generates the required documentation fields. This standardizes data entry across all practitioners in your clinic, ensuring that no critical medical information is accidentally omitted.
          </p>

          <ScreenshotPlaceholder label="Screenshot 21.1: Create Clinical Note modal. Highlight Template dropdown. Caption: 'Clinical Notes begin by selecting the appropriate documentation template.'" />
          <ScreenshotPlaceholder label="Screenshot 21.2: Template selected. Highlight Generated template sections. Caption: 'Selecting a template automatically loads the required clinical documentation fields.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 21.2: Template Flow. Caption: 'Templates standardize documentation across every patient consultation.'" />
          </div>
        </div>
      </div>

      <DocCallout type="info">
        Using standardized templates dramatically improves documentation consistency and accelerates clinical review during future appointments.
      </DocCallout>


      {/* SECTION 21.2 — Session Linking */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        21.2 Session Linking Workflows
      </h3>
      <p className="text-gray-700 font-body mb-6">Attaching notes to the correct consultation.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The <strong>Session</strong> field determines exactly which appointment a Clinical Note belongs to. Malasakit provides two distinct workflows for session linking, depending on where the practitioner initiates the note:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
              <h4 className="font-bold text-gray-900 mb-2">Workflow A: Manual Selection</h4>
              <p className="text-sm text-gray-600 mb-3">Initiated from <strong>Patient Cases</strong></p>
              <p className="text-sm text-gray-700">When creating a note directly from a patient's historical timeline, practitioners must manually use the Session dropdown to select the correct historical or active appointment to attach the note to.</p>
            </div>
            <div className="p-5 bg-sky-50 rounded-xl border border-sky-200">
              <h4 className="font-bold text-sky-900 mb-2">Workflow B: Automatic Linking</h4>
              <p className="text-sm text-sky-700 mb-3">Initiated from <strong>Appointment Details</strong></p>
              <p className="text-sm text-gray-700">When opening a note directly from a Calendar Appointment, the Session field is automatically populated and strictly locked (read-only). This completely eliminates the risk of accidentally attaching notes to the wrong patient or day.</p>
            </div>
          </div>

          <ScreenshotPlaceholder label="Screenshot 21.3: Clinical Note created from Patient Cases. Highlight Session dropdown. Caption: 'When creating notes from Patient Cases, practitioners manually choose the appointment session.'" />
          <ScreenshotPlaceholder label="Screenshot 21.4: Clinical Note launched from Appointment Details. Highlight Read-only Session field. Caption: 'When launched from an Appointment, the session is automatically assigned and cannot be modified.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 21.3: Session Logic. Caption: 'Session selection depends on where the Clinical Note is created.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        Workflow B (Automatic Linking) is highly recommended. Launching notes directly from the Calendar prevents catastrophic record-keeping errors.
      </DocCallout>


      {/* SECTION 21.3 — Appointment Linking */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        21.3 Medical Record Integration
      </h3>
      <p className="text-gray-700 font-body mb-6">How notes sync with the patient timeline.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Because every Clinical Note belongs to exactly one appointment, the system automatically surfaces the documentation in two critical areas:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>The Appointment Details:</strong> Found under the "Clinical Notes" tab when viewing a booking. Front desk staff or practitioners can quickly pull up today's notes without searching the entire history.</li>
            <li><strong>The Patient Case Timeline:</strong> Clinical notes interlock chronologically with invoices and past appointments to paint a complete, long-term picture of the patient's medical history.</li>
          </ul>

          <ScreenshotPlaceholder label="Screenshot 21.5: Appointment Details modal. Highlight Clinical Notes tab. Caption: 'Clinical Notes linked to an appointment appear inside the Appointment Details window.'" />
          <ScreenshotPlaceholder label="Screenshot 21.6: Clinical Note displayed within Patient Cases. Highlight Timeline. Caption: 'Linked Clinical Notes become part of the patient's chronological medical history.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 21.4: Appointment Linking. Caption: 'Appointment linking ensures every Clinical Note has a permanent clinical context.'" />
          </div>
        </div>
      </div>


      {/* SECTION 21.4 — Editing & Sharing */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        21.4 Editing, Printing, and Emailing
      </h3>
      <p className="text-gray-700 font-body mb-6">Managing existing documentation.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Authorized practitioners can open and edit existing Clinical Notes if medical information needs to be appended after a consultation. Any saved changes are instantly updated across the patient's permanent record.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            For external communications, Malasakit allows practitioners to generate a professional, standardized PDF of the Clinical Note. You can seamlessly Print the documentation for physical filing, Export the PDF for a referral, or securely Email the PDF directly to the patient or another healthcare provider using the system's built-in email modal.
          </p>

          <ScreenshotPlaceholder label="Screenshot 21.7: View Clinical Note modal. Highlight Clinical Note content. Caption: 'Practitioners can review previously documented Clinical Notes.'" />
          <ScreenshotPlaceholder label="Screenshot 21.8: Edit Clinical Note interface. Highlight Editable fields. Caption: 'Clinical Notes may be updated when additional clinical information becomes available.'" />
          <ScreenshotPlaceholder label="Screenshot 21.9: Clinical Note Print Preview. Highlight Professional PDF layout. Caption: 'Printed Clinical Notes use the standardized clinical report format.'" />
          <ScreenshotPlaceholder label="Screenshot 21.10: Send Clinical Note email modal. Highlight Email modal. Caption: 'Clinical Notes can be securely shared through email using the standardized PDF format.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 21.5: Document Flow. Caption: 'Editing Clinical Notes immediately updates the patient's permanent clinical record.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        Always review Clinical Notes carefully before printing or emailing to ensure all clinical documentation is complete, accurate, and free of sensitive internal remarks.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how to document consultations using the Clinical Notes module. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>How <strong>Clinical Note Templates</strong> standardize documentation across the clinic.</li>
        <li>The difference between Manual Session Selection and secure <strong>Automatic Session Assignment</strong>.</li>
        <li>How Clinical Notes natively integrate with <strong>Patient Cases</strong> to form a permanent medical timeline.</li>
        <li>How to seamlessly <strong>Edit, Print, and Email</strong> clinical notes as professional PDFs.</li>
      </ul>
    </>
  );
};

export default Chapter21;
