import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter18: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how to manage the lifecycle of an appointment, handle reschedules and cancellations, and accurately track patient attendance.
      </p>

      {/* IMPORTANT CONCEPT — Appointment Lifecycle */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">The Appointment Lifecycle</h3>
        
        <p className="text-gray-700 font-body mb-4">
          Creating an appointment is only the beginning. As patients confirm, arrive, complete their treatment, or fail to show up, the appointment must be updated to reflect its true state. This active management keeps the clinic schedule accurate while ensuring that Patient Cases, Occupancy statistics, Clinical Notes, and Invoices remain perfectly synchronized.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Lifecycle Progression</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-amber-50 rounded border border-amber-200">Pending</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Confirmed</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Arrived</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Completed</span>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 text-[12px] text-gray-500 font-mono">
            <span>Exceptions:</span>
            <span className="px-2 py-1 bg-gray-50 rounded border border-gray-200">Rescheduled</span>
            <span className="px-2 py-1 bg-gray-50 rounded border border-gray-200">Cancelled</span>
            <span className="px-2 py-1 bg-red-50 text-red-700 rounded border border-red-200">DNA</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 18.1: Appointment Lifecycle. Caption: 'Appointments progress through different stages depending on patient attendance and clinic workflow.'" />
      </div>


      {/* SECTION 18.1 — Appointment Status */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        18.1 Managing Status
      </h3>
      <p className="text-gray-700 font-body mb-6">Tracking the patient's journey through the clinic.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Authorized clinic staff can update an appointment's status directly from the Appointment Details modal. Malasakit tracks two distinct layers of status to ensure accurate reporting:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>Booking Status:</strong> Indicates the overall state of the booking (<em>Pending, Confirmed, Cancelled, Completed</em>).</li>
            <li><strong>Arrival Status:</strong> Indicates the physical attendance of the patient on the day of the appointment (<em>No Status, Arrived, DNA</em>).</li>
          </ul>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            When a status is updated, the Calendar immediately refreshes to reflect the change visually (e.g., changing colors or displaying checkmarks for Arrived patients).
          </p>

          <ScreenshotPlaceholder label="Screenshot 18.1: Appointment Details modal. Highlight Appointment status section. Caption: 'Appointment status reflects the patient's current stage within the clinical workflow.'" />
          <ScreenshotPlaceholder label="Screenshot 18.2: Status selection menu. Highlight Available status options. Caption: 'Authorized users can update appointment status according to clinic workflow.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 18.2: Status Progression. Caption: 'Appointments progress through defined workflow stages during patient treatment.'" />
          </div>
        </div>
      </div>

      <DocCallout type="info">
        Appointment status updates automatically synchronize with other areas of the system. For instance, only Completed or Confirmed appointments correctly reflect in historical Occupancy statistics and Patient Cases.
      </DocCallout>


      {/* SECTION 18.2 — Reschedule */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        18.2 Rescheduling
      </h3>
      <p className="text-gray-700 font-body mb-6">Moving an appointment to a new date and time.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            When a patient requests a different time slot, you should <strong>Reschedule</strong> the appointment rather than deleting and recreating it. Rescheduling preserves the appointment's history and ensures any linked clinical notes or prepayments remain attached.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            To reschedule, open the Appointment Details, choose the Reschedule action, and select a new available date and time. Malasakit will perform the standard availability validation against the practitioner's Duty Hours before confirming the move.
          </p>

          <ScreenshotPlaceholder label="Screenshot 18.3: Appointment Details showing the Reschedule action. Highlight Reschedule option. Caption: 'Appointments can be moved to another available schedule.'" />
          <ScreenshotPlaceholder label="Screenshot 18.4: Reschedule dialog. Highlight New date and time selection. Caption: 'Select a new available schedule before confirming the reschedule.'" />
          <ScreenshotPlaceholder label="Screenshot 18.5: Calendar after rescheduling. Highlight Updated appointment location. Caption: 'The Calendar immediately reflects the rescheduled appointment.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 18.3: Reschedule Flow. Caption: 'Rescheduling preserves appointment history while updating the schedule.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        Always verify practitioner availability before confirming a rescheduled appointment, especially if moving the patient to a completely different week.
      </DocCallout>


      {/* SECTION 18.3 — Cancellation */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        18.3 Cancellation
      </h3>
      <p className="text-gray-700 font-body mb-6">Removing appointments from the active schedule.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Appointments may be cancelled when a consultation will no longer occur. To prevent accidental deletions, the system requires you to confirm the cancellation and provide a brief cancellation reason.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Once cancelled, the appointment is removed from the active Calendar grid, immediately freeing up the practitioner's time slot for other patients. However, the cancelled record remains visible within the Patient Case to preserve a complete historical audit of the patient's activity.
          </p>

          <ScreenshotPlaceholder label="Screenshot 18.6: Appointment Details showing the Cancel Appointment action. Highlight Cancel button. Caption: 'Appointments may be cancelled when the consultation will no longer occur.'" />
          <ScreenshotPlaceholder label="Screenshot 18.7: Cancellation confirmation dialog. Highlight Confirmation message. Caption: 'The system requests confirmation before permanently updating appointment status.'" />
          <ScreenshotPlaceholder label="Screenshot 18.8: Calendar after cancellation. Highlight Updated calendar. Caption: 'Cancelled appointments are immediately reflected throughout the scheduling system.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 18.4: Cancellation Flow. Caption: 'Cancellation automatically updates all connected scheduling components.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        Cancelled appointments remain part of the patient's historical activity in their Patient Case, ensuring front desk staff can review how often a patient cancels their bookings.
      </DocCallout>


      {/* SECTION 18.4 — DNA (Did Not Arrive) */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        18.4 Did Not Arrive (DNA)
      </h3>
      <p className="text-gray-700 font-body mb-6">Handling no-shows and missed appointments.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            When a patient fails to attend a scheduled appointment without prior cancellation, the Arrival Status should be explicitly marked as <strong>DNA (Did Not Arrive)</strong>.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Marking an appointment as DNA is a critical administrative action. Visually, the Calendar overrides the appointment color to bright red, instantly alerting clinic staff to the missed visit. Behind the scenes, the system tracks this DNA status to power clinic reporting, calculate true practitioner utilization, and accurately build the patient's attendance history. 
          </p>

          <ScreenshotPlaceholder label="Screenshot 18.9: Appointment marked as DNA. Highlight DNA status. Caption: 'Appointments can be marked as Did Not Arrive when the patient misses the consultation.'" />
          <ScreenshotPlaceholder label="Screenshot 18.10: Appointment Details showing Arrival Status. Highlight Attendance controls. Caption: 'Attendance status helps clinics accurately monitor patient visits.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 18.5: DNA Tracking. Caption: 'DNA appointments remain part of the patient's appointment history while supporting clinic reporting.'" />
          </div>
        </div>
      </div>

      <DocCallout type="info">
        Recording DNA appointments accurately is essential. It improves occupancy reporting and provides a clear audit trail for patients who chronically miss their scheduled treatments.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how to manage the lifecycle of an appointment. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>The difference between <strong>Booking Status</strong> and <strong>Arrival Status</strong>.</li>
        <li>How to safely <strong>Reschedule</strong> appointments while preserving linked clinical data.</li>
        <li>How to <strong>Cancel</strong> appointments to free up calendar slots while preserving patient history.</li>
        <li>Why marking missed appointments as <strong>DNA (Did Not Arrive)</strong> is critical for accurate clinic reporting.</li>
      </ul>
    </>
  );
};

export default Chapter18;
