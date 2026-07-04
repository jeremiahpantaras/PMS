import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter10: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how to correctly configure healthcare professionals so they can begin accepting and managing patient appointments.
      </p>

      {/* IMPORTANT CONCEPT — Practitioner Configuration Workflow */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Practitioner Configuration Workflow</h3>
        
        <p className="text-gray-700 font-body mb-4">
          A practitioner profile represents a healthcare professional providing services within your clinic. A properly configured profile ensures that:
        </p>

        <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6 font-medium">
          <li>Patients can book appointments with the correct practitioner.</li>
          <li>Appointment calendars remain accurate and prevent double-booking.</li>
          <li>Duty hours and availability are respected system-wide.</li>
          <li>Online booking only displays practitioners available for the selected clinic branch.</li>
        </ul>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Configuration Sequence</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Create Account</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Assign Role</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Assign Branch</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Set Availability</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Ready</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 10.1: Practitioner Configuration Workflow. Caption: 'Every practitioner must have a complete profile before accepting appointments.'" />
      </div>


      {/* SECTION 10.1 — Creating a Practitioner */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        10.1 Creating a Practitioner
      </h3>
      <p className="text-gray-700 font-body mb-6">Initialize the provider's system access.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Practitioners are created through the <strong>Staff Management</strong> module. When adding a new user, selecting the <strong>Practitioner</strong> role triggers the system to automatically generate a corresponding clinical profile.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li>Open the <strong>Staff Management</strong> page.</li>
            <li>Click <strong>Create Staff Account</strong>.</li>
            <li>Complete the user's personal information.</li>
            <li>Select the <strong>Practitioner</strong> clinical role.</li>
            <li>Click <strong>Save</strong>.</li>
          </ul>
          <ScreenshotPlaceholder label="Screenshot 10.1: Create Staff Account modal. Highlight Practitioner role and Save button. Caption: 'Select the Practitioner role when creating a new healthcare provider.'" />
          <ScreenshotPlaceholder label="Screenshot 10.2: Completed practitioner account before saving. Highlight Personal information and Practitioner role. Caption: 'Complete the required information before saving the practitioner account.'" />
        </div>
      </div>

      <DocCallout type="info">
        Practitioners are regular staff accounts that have been granted additional permissions related to appointments, calendars, patients, and clinical documentation.
      </DocCallout>


      {/* SECTION 10.2 — Branch Assignment */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        10.2 Branch Assignment
      </h3>
      <p className="text-gray-700 font-body mb-6">Anchor the practitioner to a physical clinic location.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            A practitioner must be assigned to the specific clinic branch where they physically provide services. This branch assignment dictates exactly where the practitioner's availability and appointment calendar will appear.
          </p>
          
          <ScreenshotPlaceholder label="Screenshot 10.3: Branch Assignment selector. Highlight Assigned clinic branch. Caption: 'Assign practitioners to the clinic branch where they provide services.'" />
          <ScreenshotPlaceholder label="Diagram 10.2: Branch Assignment. Caption: 'Branch assignments determine where practitioners appear throughout the system.'" />
        </div>
      </div>

      <DocCallout type="important">
        Patients using a clinic branch's unique public booking link will only see practitioners who are actively assigned to that specific branch.
      </DocCallout>


      {/* SECTION 10.3 — Practitioner Profile */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        10.3 Practitioner Profile
      </h3>
      <p className="text-gray-700 font-body mb-6">Manage professional information.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The practitioner profile stores professional details that are utilized throughout the system. This data feeds into the appointment calendar, clinical notes, system reports, and the public-facing online booking portal.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>Name & Title:</strong> Displayed to patients during booking.</li>
            <li><strong>Discipline / Position:</strong> Defines the healthcare specialty (e.g., Physical Therapy).</li>
            <li><strong>Contact Details:</strong> Used for internal clinic communications.</li>
          </ul>

          <ScreenshotPlaceholder label="Screenshot 10.4: Practitioner profile page. Highlight Profile information. Caption: 'The practitioner profile stores professional information used throughout the system.'" />
          <ScreenshotPlaceholder label="Screenshot 10.5: Edit practitioner profile. Highlight Editable profile fields. Caption: 'Administrators can update practitioner information whenever necessary.'" />
        </div>
      </div>

      <DocCallout type="tip">
        Keep practitioner profiles updated to ensure patients always see accurate, professional information during the online appointment booking process.
      </DocCallout>


      {/* SECTION 10.4 — Practitioner Availability */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        10.4 Practitioner Availability
      </h3>
      <p className="text-gray-700 font-body mb-6">Configure duty hours to define appointment slots.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Availability settings dictate exactly when a practitioner is allowed to see patients. By defining working days and duty hours, you automatically structure the appointment calendar and restrict when patients can book online.
          </p>

          <h5 className="font-bold text-gray-900 mb-2">Calendar Visibility & Occupancy</h5>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Configured duty hours are visually rendered directly onto the appointment calendar. Furthermore, Malasakit uses these exact duty hours to calculate daily occupancy percentages (e.g., comparing booked hours against total available hours).
          </p>

          <ScreenshotPlaceholder label="Screenshot 10.6: Practitioner availability settings. Highlight Working days, Start time, End time. Caption: 'Configure the practitioner's working schedule and availability.'" />
          <ScreenshotPlaceholder label="Screenshot 10.7: Calendar displaying practitioner duty hours. Highlight Duty hours shown in the calendar. Caption: 'Configured availability is reflected directly in the appointment calendar.'" />
          <ScreenshotPlaceholder label="Screenshot 10.8: Calendar occupancy statistics. Highlight Occupancy %, Number of Clients, Number of New Clients. Caption: 'Occupancy statistics are calculated based on the practitioner's configured duty hours.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 10.3: Availability Flow. Caption: 'Duty hours directly determine available appointment slots and occupancy calculations.'" />
          </div>
        </div>
      </div>

      <DocCallout type="warning">
        Incorrect availability settings may prevent patients from booking appointments online, or produce highly inaccurate occupancy statistics on your daily reports.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how to configure healthcare providers within your clinic. You should now know how to:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>Create practitioner accounts via Staff Management.</li>
        <li>Assign practitioners to the correct clinic branches.</li>
        <li>Configure professional practitioner profiles.</li>
        <li>Set practitioner availability and duty hours.</li>
        <li>Understand how duty hours directly affect online bookings and calendar occupancy calculations.</li>
      </ul>
    </>
  );
};

export default Chapter10;
