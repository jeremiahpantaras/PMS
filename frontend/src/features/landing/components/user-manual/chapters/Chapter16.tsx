import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter16: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how to schedule new appointments, navigate practitioner availability, and avoid scheduling conflicts.
      </p>

      {/* IMPORTANT CONCEPT — Appointment Creation Workflow */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Appointment Creation Workflow</h3>
        
        <p className="text-gray-700 font-body mb-4">
          Appointment booking is one of the core workflows in Malasakit because nearly every other clinical process—from creating Clinical Notes to generating Invoices—begins with a scheduled appointment. Every appointment must pass through a strict validation process before it is successfully confirmed.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Booking Sequence</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Patient</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Branch</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Practitioner</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-amber-50 rounded border border-amber-200">Availability Check</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-amber-50 rounded border border-amber-200">Conflict Validation</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Appointment Created</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 16.1: Appointment Creation Workflow. Caption: 'Every appointment follows a validation process before it is successfully scheduled.'" />
      </div>


      {/* SECTION 16.1 — Appointment Booking */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        16.1 Standard Booking
      </h3>
      <p className="text-gray-700 font-body mb-6">How to schedule a patient consultation.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The standard booking process links a specific patient to a practitioner for a designated service. Follow these steps to schedule a new appointment:
          </p>

          <h5 className="font-bold text-gray-900 mb-2">Step-by-Step Guide</h5>
          <ol className="list-decimal pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li>Open the <strong>Calendar</strong>.</li>
            <li>Select the desired date.</li>
            <li>Click <strong>Create Appointment</strong>.</li>
            <li>Search and select the existing <strong>patient</strong>.</li>
            <li>Select the <strong>clinic branch</strong> (if managing multiple branches).</li>
            <li>Select the <strong>practitioner</strong>.</li>
            <li>Choose the intended <strong>service</strong>.</li>
            <li>Select the specific appointment <strong>date and time</strong>.</li>
            <li>Review all entered information for accuracy.</li>
            <li>Click <strong>Save</strong> to confirm the booking.</li>
          </ol>

          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Once saved, successful appointments immediately appear as a block within the Calendar, ready for staff to track.
          </p>

          <ScreenshotPlaceholder label="Screenshot 16.1: Calendar page. Highlight Create Appointment button. Caption: 'Appointments begin by selecting Create Appointment from the Calendar.'" />
          <ScreenshotPlaceholder label="Screenshot 16.2: Create Appointment modal. Highlight Entire appointment form. Caption: 'Complete all required appointment information before saving.'" />
          <ScreenshotPlaceholder label="Screenshot 16.3: Completed appointment form. Highlight Patient, practitioner, service, date, and time. Caption: 'Review appointment information before confirming the booking.'" />
          <ScreenshotPlaceholder label="Screenshot 16.4: Appointment successfully displayed. Highlight New appointment block. Caption: 'Successfully created appointments immediately appear in the Calendar.'" />
        </div>
      </div>

      <DocCallout type="info">
        Every appointment becomes the essential foundation for generating Clinical Notes, Billing Invoices, Reports, Notifications, and maintaining chronological Patient Cases.
      </DocCallout>


      {/* SECTION 16.2 — Availability */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        16.2 Practitioner Availability
      </h3>
      <p className="text-gray-700 font-body mb-6">How the system dictates bookable time slots.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Before allowing an appointment to be created, Malasakit actively checks the practitioner's availability. This availability is strictly governed by the practitioner's <strong>Duty Hours</strong> and working schedule (as explained in Chapter 11).
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The system evaluates the practitioner's configured working hours, factors in break periods, and checks the requested appointment duration. Any time slot that falls outside these available working hours will be blocked, and the appointment cannot be booked.
          </p>

          <ScreenshotPlaceholder label="Screenshot 16.5: Available time slots. Highlight Available schedule. Caption: 'Only available appointment slots can be selected.'" />
          <ScreenshotPlaceholder label="Screenshot 16.6: Practitioner Duty Hours. Highlight Working schedule. Caption: 'Practitioner Duty Hours determine when appointments may be scheduled.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 16.2: Availability Calculation. Caption: 'Appointment availability is calculated from practitioner working hours.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        Always verify practitioner availability in the calendar before verbally confirming times with patients to avoid unnecessary cancellations or rescheduling.
      </DocCallout>


      {/* SECTION 16.3 — Conflicts */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        16.3 Conflict Detection
      </h3>
      <p className="text-gray-700 font-body mb-6">Preventing overlapping and invalid appointments.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Even if a practitioner is working on a given day, Malasakit performs a final validation check before saving to prevent double-booking.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            If a user attempts to save an appointment that overlaps with an <strong>existing appointment</strong> during the exact same time, or attempts to force a booking outside the practitioner's working hours, the system will instantly reject the save request and display a conflict warning.
          </p>

          <ScreenshotPlaceholder label="Screenshot 16.7: Scheduling conflict warning. Highlight Validation message. Caption: 'The system prevents conflicting appointments from being created.'" />
          <ScreenshotPlaceholder label="Screenshot 16.8: Occupied schedule. Highlight Existing appointment. Caption: 'Existing appointments block overlapping bookings.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 16.3: Conflict Detection. Caption: 'Every appointment is validated before it is added to the Calendar.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        Conflict detection protects practitioners from overlapping appointments and helps maintain an accurate, reliable clinic schedule that patients can trust.
      </DocCallout>


      {/* SECTION 16.4 — Practitioner Selection */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        16.4 Practitioner Selection
      </h3>
      <p className="text-gray-700 font-body mb-6">Filtering the right provider for the patient.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The practitioner list in the booking modal is intelligent. It dynamically updates to only display practitioners who are actively available based on the user's permissions and the selected clinic branch.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            For instance, selecting Branch A will automatically filter out practitioners who are only assigned to Branch B. If multiple practitioners are available for the selected branch, Front Desk staff can review their respective availability and choose the most appropriate provider for the patient's needs.
          </p>

          <ScreenshotPlaceholder label="Screenshot 16.9: Practitioner dropdown. Highlight Practitioner selection. Caption: 'Choose the practitioner responsible for the patient's consultation.'" />
          <ScreenshotPlaceholder label="Screenshot 16.10: Practitioner selected. Highlight Selected practitioner and schedule. Caption: 'Practitioner availability updates based on the selected provider.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 16.4: Practitioner Filtering. Caption: 'Practitioner selection depends on branch assignment and schedule availability.'" />
          </div>
        </div>
      </div>

      <DocCallout type="info">
        Selecting the correct practitioner ensures appointments, Clinical Notes, reports, and occupancy statistics remain perfectly accurate throughout the system.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned the critical steps required to schedule patient visits successfully. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>The standard step-by-step workflow for creating a new appointment.</li>
        <li>How the system uses Duty Hours to strictly govern appointment availability.</li>
        <li>How conflict detection prevents double-booking and safeguards practitioner schedules.</li>
        <li>How the practitioner selection list dynamically filters based on branch assignments and availability.</li>
      </ul>
    </>
  );
};

export default Chapter16;
