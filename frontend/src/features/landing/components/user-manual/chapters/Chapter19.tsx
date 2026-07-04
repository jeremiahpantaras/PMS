import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter19: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how the Patient Portal empowers your patients to schedule their own appointments from any device, reducing front-desk workload.
      </p>

      {/* IMPORTANT CONCEPT — Patient Portal Workflow */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Patient Portal Workflow</h3>
        
        <p className="text-gray-700 font-body mb-4">
          The Patient Portal is a self-service booking interface accessible outside of the core Malasakit dashboard. It guides patients through a seamless online scheduling experience while strictly respecting your clinic's branch assignments and practitioner Duty Hours.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center overflow-x-auto">
          <p className="text-sm font-semibold text-gray-800 mb-2">Self-Service Booking Path</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[13px] text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Patient</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Access Link or QR Code</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Select Practitioner</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-amber-50 rounded border border-amber-200">Enter Personal Details</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-amber-50 rounded border border-amber-200">Accept Terms & Consent</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Book Appointment</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 19.1: Patient Portal Workflow. Caption: 'The Patient Portal provides patients with a self-service appointment booking experience.'" />
      </div>


      {/* SECTION 19.1 — Public Links */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        19.1 Public Booking Links
      </h3>
      <p className="text-gray-700 font-body mb-6">How patients access the portal online.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Every clinic registered in Malasakit is assigned a master <strong>Public Booking Link</strong>. Patients can use this link to access the portal from their desktop or mobile device without needing to create an account or log into Malasakit.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Clinic owners and managers can copy this link from the Clinic Setup page and distribute it freely—embedding it on the clinic's official website, sharing it across social media platforms, or including it in automated email campaigns.
          </p>

          <ScreenshotPlaceholder label="Screenshot 19.1: Landing Page showing the Book Appointment entry. Highlight Public booking access. Caption: 'Patients can access the online booking portal through the clinic's public booking page.'" />
          <ScreenshotPlaceholder label="Screenshot 19.2: Patient Portal landing page. Highlight Online booking interface. Caption: 'The Patient Portal provides a simple and user-friendly booking experience.'" />
          <ScreenshotPlaceholder label="Screenshot 19.3: Clinic Public Link displayed within Clinic Setup. Highlight Public booking URL. Caption: 'Each clinic receives a unique public booking link that can be shared with patients.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 19.2: Clinic Link Access. Caption: 'Patients can access the clinic's booking system directly through the public link.'" />
          </div>
        </div>
      </div>

      <DocCallout type="info">
        Public Booking Links allow patients to schedule appointments securely at any time of day, dramatically reducing the volume of incoming scheduling calls.
      </DocCallout>


      {/* SECTION 19.2 — Branch Links */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        19.2 Branch-Specific Booking
      </h3>
      <p className="text-gray-700 font-body mb-6">Targeting specific clinic locations.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            If your clinic operates multiple locations, patients using the master clinic link will be prompted to select their preferred branch. However, you can also use <strong>Branch-Specific Links</strong> to bypass this step.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Every branch listed in your Clinic Branch Management page automatically generates its own unique Public Link and a scannable <strong>QR Code</strong>. When a patient uses a branch-specific link or scans the branch's QR Code, the Patient Portal automatically locks the location, ensuring the appointment is scheduled exactly where intended.
          </p>

          <ScreenshotPlaceholder label="Screenshot 19.4: Clinic Branch Management page. Highlight Branch Public Link. Caption: 'Each clinic branch has its own dedicated public booking link.'" />
          <ScreenshotPlaceholder label="Screenshot 19.5: Branch QR Code. Highlight Generated QR Code. Caption: 'Patients can scan the branch QR Code to open the correct booking page instantly.'" />
          <ScreenshotPlaceholder label="Screenshot 19.6: Branch-specific Patient Portal. Highlight Branch name. Caption: 'Branch-specific booking pages automatically schedule appointments for the selected clinic location.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 19.3: Branch Link Access. Caption: 'Each clinic branch provides its own independent online booking experience.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        Print and display branch-specific QR Codes at the reception desk, on clinic entrances, or in promotional brochures to make rebooking incredibly simple for walk-in patients.
      </DocCallout>


      {/* SECTION 19.3 — Practitioner Selection */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        19.3 Practitioner Availability
      </h3>
      <p className="text-gray-700 font-body mb-6">How patients choose their provider online.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Once a patient has selected a clinic branch, the Patient Portal intelligently filters the list of available practitioners. Patients will <em>only</em> see practitioners who are actively assigned to that specific branch.
          </p>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            After selecting a practitioner, the system calculates and displays the provider's available time slots based on their configured Duty Hours and existing appointments. Unavailable practitioners or fully booked time slots are automatically hidden, completely removing the risk of accidental double-booking.
          </p>

          <ScreenshotPlaceholder label="Screenshot 19.7: Practitioner selection page. Highlight Available practitioners. Caption: 'Patients can choose from practitioners assigned to the selected clinic branch.'" />
          <ScreenshotPlaceholder label="Screenshot 19.8: Available appointment schedule. Highlight Available time slots. Caption: 'Only available appointment times are displayed based on practitioner availability.'" />
          <ScreenshotPlaceholder label="Screenshot 19.9: Selected practitioner. Highlight Practitioner information. Caption: 'Selecting a practitioner automatically updates the available appointment schedule.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Diagram 19.4: Practitioner Filtering. Caption: 'Patients only see practitioners available within the selected clinic branch.'" />
          </div>
        </div>
      </div>

      <DocCallout type="important">
        Practitioner availability is strictly validated in real time before a patient can complete an online booking. If a slot is booked by front desk staff while a patient is viewing it, the portal will prevent the patient from saving the conflict.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how Malasakit extends its scheduling capabilities directly to patients. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>How the <strong>Patient Portal</strong> provides a secure, self-service online booking experience.</li>
        <li>Where to find and share your master <strong>Clinic Public Link</strong>.</li>
        <li>How <strong>Branch-Specific Links</strong> and <strong>QR Codes</strong> lock patients into booking at the correct physical location.</li>
        <li>How the portal ensures accurate scheduling by dynamically filtering <strong>Practitioners</strong> based on branch assignments and Duty Hours.</li>
      </ul>
    </>
  );
};

export default Chapter19;
