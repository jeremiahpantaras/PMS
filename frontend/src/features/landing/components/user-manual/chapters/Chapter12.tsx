import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter12: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how centralized patient records power appointments, clinical documentation, and billing across the entire Malasakit ecosystem.
      </p>

      {/* IMPORTANT CONCEPT — Patient Record Lifecycle */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">The Patient Record Lifecycle</h3>
        
        <p className="text-gray-700 font-body mb-4">
          Every patient has a centralized medical profile. Rather than creating duplicate records every time a patient visits a new clinic branch or sees a new practitioner, Malasakit uses this single profile as the foundation for the entire clinical journey.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Centralized Integration</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-sky-50 text-sky-800 font-bold rounded border border-sky-200">Patient Created</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Profile</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Appointments</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Clinical Notes</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Invoices</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Reports</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 12.1: Patient Record Lifecycle. Caption: 'A patient record follows the entire clinical journey, from registration through treatment and reporting.'" />
      </div>


      {/* SECTION 12.1 — Patient Profiles */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        12.1 Patient Profiles
      </h3>
      <p className="text-gray-700 font-body mb-6">The central source of truth for patient demographics.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The Patient Profile is where all administrative and medical information is stored. When a profile is updated, those changes automatically reflect across all connected modules, ensuring front desk staff, practitioners, and finance users are always looking at the latest data.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>Personal & Contact Information:</strong> Name, phone numbers, and emails used for system notifications and communication.</li>
            <li><strong>Demographics:</strong> Address and birthdate.</li>
            <li><strong>Profile Overview:</strong> A summary view of the patient's history with the clinic.</li>
          </ul>

          <ScreenshotPlaceholder label="Screenshot 12.1: Patient List page. Highlight Patient list, Search, Patient selection. Caption: 'The Patient Records module displays all patients available to the logged-in user based on their permissions.'" />
          <ScreenshotPlaceholder label="Screenshot 12.2: Patient Profile page. Highlight Patient information, Contact details, Patient summary. Caption: 'Each patient has a centralized profile containing essential clinic information.'" />
          <ScreenshotPlaceholder label="Screenshot 12.3: Edit Patient Profile. Highlight Editable profile fields. Caption: 'Patient information can be updated whenever changes occur.'" />
        </div>
      </div>

      <DocCallout type="info">
        Patient records are shared across appointments, clinical notes, billing, and other connected modules, drastically reducing duplicate data entry.
      </DocCallout>


      {/* SECTION 12.2 — Branch Visibility */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        12.2 Branch Visibility
      </h3>
      <p className="text-gray-700 font-body mb-6">How patient privacy is maintained across locations.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            To strictly enforce patient privacy, a user's ability to view a patient record is governed by their Role and Branch Assignments. 
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-5 rounded-xl border border-gray-200 bg-gray-50">
              <h5 className="font-bold text-gray-900 mb-2 border-b border-gray-200 pb-2">Owner</h5>
              <p className="text-sm text-gray-600 mb-2">Can access all patients from all clinic branches system-wide.</p>
            </div>

            <div className="p-5 rounded-xl border border-gray-200 bg-gray-50">
              <h5 className="font-bold text-gray-900 mb-2 border-b border-gray-200 pb-2">Manager & Front Desk</h5>
              <p className="text-sm text-gray-600 mb-2">Can access patients who belong to their explicitly assigned clinic branches.</p>
            </div>

            <div className="p-5 rounded-xl border border-gray-200 bg-gray-50">
              <h5 className="font-bold text-gray-900 mb-2 border-b border-gray-200 pb-2">Practitioner</h5>
              <p className="text-sm text-gray-600 mb-2">Can access patients associated with appointments in their assigned clinic branch.</p>
            </div>
          </div>

          <ScreenshotPlaceholder label="Screenshot 12.4: Patient List filtered by branch. Highlight Branch filter or branch label. Caption: 'Patient visibility follows clinic branch assignments and user permissions.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 12.2: Branch Visibility. Caption: 'Patient visibility is restricted according to role permissions and assigned clinic branches.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        Users absolutely cannot access patient records belonging to clinic branches outside their assigned scope unless their specific role grants broader organizational access.
      </DocCallout>


      {/* SECTION 12.3 — Practitioner Relationships */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        12.3 Practitioner Relationships
      </h3>
      <p className="text-gray-700 font-body mb-6">How patients connect with healthcare providers.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            In Malasakit, practitioners do not permanently "own" patient records. Instead, practitioners interact with patients through <strong>Appointments</strong>. A single patient may see multiple practitioners across different specialties over time. 
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The appointment acts as the critical bridge that links the Patient, the Practitioner, the Clinical Note, and the resulting Invoice.
          </p>

          <ScreenshotPlaceholder label="Screenshot 12.5: Appointment Details. Highlight Patient and Practitioner. Caption: 'Appointments establish the temporary relationship between patients and practitioners.'" />
          <ScreenshotPlaceholder label="Screenshot 12.6: Clinical Note linked to appointment. Highlight Patient, Practitioner, Appointment, Clinical Note. Caption: 'Clinical Notes are linked to both the patient and the appointment where treatment occurred.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 12.3: Patient Relationship Model. Caption: 'Appointments connect patients with practitioners and related clinical records.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        Keeping appointments and clinical notes properly linked ensures a complete, chronological, and highly accurate patient treatment history for future providers to review.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how patient records form the core of the Malasakit System. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>How the Patient Profile stores demographics and centralizes data to prevent duplication.</li>
        <li>How branch assignments enforce strict patient privacy rules across different staff roles.</li>
        <li>How appointments serve as the bridge connecting patients with practitioners, clinical notes, and invoices.</li>
        <li>That a single patient record supports the entire clinical lifecycle, from registration through reporting.</li>
      </ul>
    </>
  );
};

export default Chapter12;
