import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter13: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how to add new patients into Malasakit while maintaining data quality and preventing duplicate medical records.
      </p>

      {/* IMPORTANT CONCEPT — Patient Registration Workflow */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Patient Registration Workflow</h3>
        
        <p className="text-gray-700 font-body mb-4">
          Every patient must be registered before appointments, clinical notes, invoices, or consent forms can be created. This registration process establishes the patient's master profile, which is used throughout the entire system.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Registration Sequence</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Patient Info</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Validation</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-amber-50 rounded border border-amber-200">Duplicate Check</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200 font-bold">Record Created</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Clinical Journey</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 13.1: Patient Registration Workflow. Caption: 'Every patient registration creates a centralized record that will be used across all clinical workflows.'" />
      </div>


      {/* SECTION 13.1 — Manual Registration */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        13.1 Manual Registration
      </h3>
      <p className="text-gray-700 font-body mb-6">How staff members add patients into the database.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Manual registration is typically performed by Owners, Managers, or authorized Front Desk staff when a patient calls the clinic or walks in for the first time. 
          </p>
          
          <h5 className="font-bold text-gray-900 mb-2">Step-by-Step Registration</h5>
          <ul className="list-decimal pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li>Navigate to the <strong>Patient Records</strong> page.</li>
            <li>Click the <strong>Add Patient</strong> (or Register Patient) button.</li>
            <li>Complete the patient information form, paying close attention to required fields.</li>
            <li>Review all entered information for accuracy.</li>
            <li>Click <strong>Save</strong> to create the patient record.</li>
          </ul>

          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Once saved, the patient immediately becomes available system-wide for appointment scheduling.
          </p>

          <ScreenshotPlaceholder label="Screenshot 13.1: Patient Records page. Highlight Add Patient button. Caption: 'Begin manual patient registration by selecting the Add Patient button.'" />
          <ScreenshotPlaceholder label="Screenshot 13.2: Create Patient modal. Highlight Personal Information, Contact Information, Required fields. Caption: 'Complete the patient's registration information before saving.'" />
          <ScreenshotPlaceholder label="Screenshot 13.3: Completed registration form. Highlight Completed patient information. Caption: 'Review all entered information before creating the patient record.'" />
          <ScreenshotPlaceholder label="Screenshot 13.4: Patient successfully added to list. Highlight New patient entry. Caption: 'The newly registered patient immediately becomes available throughout the system.'" />
        </div>
      </div>

      <DocCallout type="info">
        Only complete and highly accurate patient information should be entered to maintain reliable clinical and billing records.
      </DocCallout>


      {/* SECTION 13.2 — Online Registration */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        13.2 Online Registration
      </h3>
      <p className="text-gray-700 font-body mb-6">How patients register themselves from home.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Malasakit supports self-service registration through the public booking portal. When a new patient accesses a clinic branch's unique Public Booking Link or scans the branch's QR Code, they are required to register themselves before confirming an appointment.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="p-5 rounded-xl border border-gray-200 bg-gray-50">
              <h5 className="font-bold text-gray-900 mb-2 border-b border-gray-200 pb-2">The Patient Experience</h5>
              <ol className="list-decimal pl-5 text-sm space-y-1 text-gray-700">
                <li>Patient opens the booking portal.</li>
                <li>Enters their personal & contact details.</li>
                <li>System validates the information.</li>
                <li>Profile is automatically generated.</li>
                <li>Patient proceeds to book an appointment.</li>
              </ol>
            </div>

            <div className="p-5 rounded-xl border border-sky-100 bg-sky-50">
              <h5 className="font-bold text-sky-900 mb-2 border-b border-sky-200 pb-2">Branch Assignment</h5>
              <p className="text-sm text-gray-700">
                Patient registrations generated online are automatically associated with the specific clinic branch through which the booking link was accessed.
              </p>
            </div>
          </div>

          <ScreenshotPlaceholder label="Screenshot 13.5: Clinic Public Booking page. Highlight Patient registration form. Caption: 'Patients can register themselves through the clinic's public booking portal.'" />
          <ScreenshotPlaceholder label="Screenshot 13.6: Patient entering registration details. Highlight Online registration fields. Caption: 'Patients complete their own registration before booking an appointment.'" />
          <ScreenshotPlaceholder label="Screenshot 13.7: Booking confirmation. Highlight Successful patient creation. Caption: 'Once registration is complete, the patient proceeds directly to appointment booking.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 13.2: Online Registration Workflow. Caption: 'Online registration automatically creates the patient profile before scheduling appointments.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        Encouraging patients to use the online registration portal heavily reduces front desk workload and minimizes manual data entry errors.
      </DocCallout>


      {/* SECTION 13.3 — Duplicate Detection */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        13.3 Duplicate Detection
      </h3>
      <p className="text-gray-700 font-body mb-6">How the system prevents fragmented medical records.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            To prevent fragmented clinical history and messy billing, Malasakit actively checks for existing records before allowing a new patient to be created. 
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            When staff members enter a patient's information, the system performs a background validation. If it detects that a patient with matching critical identifiers already exists in the database, it intercepts the save process and warns the user.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            When this warning appears, staff should pause, review the existing matching patient record, and confirm whether they are dealing with a returning patient (in which case they should simply book the appointment under the existing profile) or a new patient with identical details.
          </p>

          <ScreenshotPlaceholder label="Screenshot 13.8: Duplicate patient warning. Highlight Duplicate detection message. Caption: 'The system alerts users when a possible duplicate patient record is detected.'" />
          <ScreenshotPlaceholder label="Screenshot 13.9: Existing patient search result. Highlight Matching patient record. Caption: 'Review existing patient records before creating a new registration.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 13.3: Duplicate Detection. Caption: 'Duplicate detection helps maintain clean and accurate patient records.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        Always review duplicate warnings before forcing the creation of a new patient. Accidental duplicate records scatter a single patient's appointments, clinical notes, and billing history across multiple disconnected profiles.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned the mechanisms for successfully registering patients into Malasakit. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>How clinic staff manually register patients using the <strong>Add Patient</strong> functionality.</li>
        <li>How the public <strong>Online Booking Portal</strong> acts as a self-service registration tool for new patients.</li>
        <li>How patients registering online are automatically associated with the correct clinic branch.</li>
        <li>How the <strong>Duplicate Detection</strong> system protects data quality by warning staff before a redundant record is created.</li>
      </ul>
    </>
  );
};

export default Chapter13;
