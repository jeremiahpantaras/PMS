import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter20: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how patients seamlessly schedule their own appointments through the Patient Portal, including confirmation and online rescheduling capabilities.
      </p>

      {/* IMPORTANT CONCEPT — Online Booking Workflow */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Online Booking Workflow</h3>
        
        <p className="text-gray-700 font-body mb-4">
          Online booking allows patients to schedule appointments independently while strictly enforcing your clinic's availability rules. From selecting a provider to signing mandatory consent forms, the Patient Portal handles the entire intake process automatically.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Step-by-Step Booking Process</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Open Portal Link</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Select Practitioner</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Choose Appointment</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-amber-50 rounded border border-amber-200">Enter Personal Details</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-amber-50 rounded border border-amber-200">Accept Terms & Consent</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Booking Successful</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 20.1: Online Booking Workflow. Caption: 'The Patient Portal guides patients through a simple step-by-step appointment booking process.'" />
      </div>


      {/* SECTION 20.1 — Booking Flow */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        20.1 The Booking Process
      </h3>
      <p className="text-gray-700 font-body mb-6">A frictionless scheduling experience for patients.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The Patient Portal is designed to be completely self-service, eliminating the need for back-and-forth phone calls. Once a patient accesses your clinic's public link or QR code, they are guided through the following flow:
          </p>
          
          <ol className="list-decimal pl-6 space-y-3 text-gray-700 font-body mb-6">
            <li><strong>Select Practitioner:</strong> The patient selects their preferred provider (the system only shows practitioners actively assigned to the current clinic branch).</li>
            <li><strong>Choose Appointment:</strong> The patient selects an available date and time based strictly on the practitioner's configured Duty Hours.</li>
            <li><strong>Enter Personal Details:</strong> The patient inputs their core demographic information (Name, Email, Phone Number, Date of Birth). Malasakit uses this information to intelligently match the booking to an existing Patient Record or safely create a new one.</li>
            <li><strong>Accept Terms & Consent:</strong> If your clinic has configured an active Clinic Consent Form for the branch, the patient is legally required to review and digitally sign the document before the system will allow them to finalize the booking.</li>
            <li><strong>Confirm Appointment:</strong> The patient reviews their selected time, practitioner, and details, and submits the booking.</li>
          </ol>

          <ScreenshotPlaceholder label="Screenshot 20.1: Patient Portal home page. Highlight Start Booking button. Caption: 'Patients begin the booking process through the Patient Portal.'" />
          <ScreenshotPlaceholder label="Screenshot 20.2: Practitioner selection. Highlight Available practitioners. Caption: 'Only practitioners assigned to the selected branch are displayed.'" />
          <ScreenshotPlaceholder label="Screenshot 20.3: Appointment schedule. Highlight Available appointment dates and time slots. Caption: 'Only available appointment schedules can be selected.'" />
          <ScreenshotPlaceholder label="Screenshot 20.4: Booking review page. Highlight Appointment summary and Consent Forms. Caption: 'Patients review their booking information and sign necessary consent forms before confirming the appointment.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 20.2: Booking Validation. Caption: 'Every booking is validated in real time before being confirmed.'" />
          </div>
        </div>
      </div>

      <DocCallout type="info">
        Online booking automatically checks practitioner availability at the exact moment of confirmation, entirely preventing double-booking conflicts even during high-traffic periods.
      </DocCallout>


      {/* SECTION 20.2 — Confirmation */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        20.2 Instant Confirmation
      </h3>
      <p className="text-gray-700 font-body mb-6">Finalizing the booking and updating the clinic.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The moment a patient successfully completes the booking flow, the appointment is instantly finalized. It requires no manual approval from front desk staff. 
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The patient immediately receives an on-screen success message detailing their scheduled time, location, and provider. Simultaneously, the appointment natively appears on the clinic's internal Calendar dashboard, seamlessly integrating into the practitioner's schedule for that day.
          </p>

          <ScreenshotPlaceholder label="Screenshot 20.5: Booking successful page. Highlight Success message. Caption: 'Patients receive immediate confirmation after a successful booking.'" />
          <ScreenshotPlaceholder label="Screenshot 20.6: Booking reference. Highlight Reference information. Caption: 'Patients are provided with their confirmed scheduling details.'" />
          <ScreenshotPlaceholder label="Screenshot 20.7: Calendar showing the new appointment. Highlight Newly created appointment. Caption: 'Confirmed online bookings immediately appear in the clinic Calendar.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 20.3: System Synchronization. Caption: 'Successful online bookings automatically synchronize with clinic scheduling.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        Because online bookings are instantly confirmed, staff should monitor the Calendar throughout the day to spot any new same-day appointments that patients may have booked remotely.
      </DocCallout>


      {/* SECTION 20.3 — Rescheduling */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        20.3 Online Rescheduling
      </h3>
      <p className="text-gray-700 font-body mb-6">Allowing patients to manage their own schedule.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Malasakit supports secure, self-service online rescheduling to help reduce phone volume. If a patient needs to change their appointment time, the clinic can send them a secure, single-use <strong>Rebooking Link</strong>.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Upon clicking the Rebooking Link, the patient is securely authenticated to their specific appointment. They are then presented with a specialized Rebook Calendar displaying their practitioner's current availability. The patient can either select a new available date and time or choose to fully cancel the appointment. 
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Just like standard online booking, the system rigorously validates availability. Once the patient confirms the new time, their appointment is instantly moved on the clinic's Calendar, preserving all linked clinical notes and history. If the link expires or the appointment has already been rebooked, the system will prevent further access to ensure security.
          </p>

          <ScreenshotPlaceholder label="Screenshot 20.8: Reschedule appointment page. Highlight Secure rebooking interface. Caption: 'Patients use secure, single-use links to manage their existing appointments.'" />
          <ScreenshotPlaceholder label="Screenshot 20.9: New appointment schedule. Highlight Available replacement schedule. Caption: 'Patients choose a new available appointment before confirming the reschedule.'" />
          <ScreenshotPlaceholder label="Screenshot 20.10: Reschedule confirmation. Highlight Updated booking. Caption: 'Successful rescheduling immediately updates the clinic Calendar.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 20.4: Reschedule Flow. Caption: 'Rescheduling preserves appointment history while securely updating the booking schedule.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        Online rescheduling is entirely governed by practitioner availability. Patients cannot override clinic hours or book into already-filled time slots.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how patients successfully book and manage appointments online. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>The exact <strong>step-by-step booking flow</strong> patients experience on the Patient Portal.</li>
        <li>How mandatory <strong>Terms & Consent forms</strong> are seamlessly integrated into the booking process.</li>
        <li>How successful bookings are <strong>instantly synchronized</strong> to the clinic's Calendar without requiring manual staff approval.</li>
        <li>How patients can securely manage their schedule using single-use <strong>Online Rescheduling</strong> links.</li>
      </ul>
    </>
  );
};

export default Chapter20;
