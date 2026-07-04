import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter4: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how to configure your clinic's primary information immediately after account creation.
      </p>

      <DocCallout type="info" title="Why is this important?">
        The Clinic Setup is the foundation of the entire Malasakit system. Accurate clinic information ensures appointments, communications, reports, invoices, and patient-facing pages display the correct information.
      </DocCallout>

      {/* SECTION 4.1 — Clinic Information */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        4.1 Clinic Information
      </h3>
      <p className="text-gray-700 font-body mb-6">Learn how to enter your clinic's primary information in Step 1 of the onboarding process.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 1: Open Clinic Setup</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            After successfully registering a new Owner account, the system automatically redirects you to the <strong>Clinic Setup</strong> page. This page tracks your progress across four main setup steps.
          </p>
          <ScreenshotPlaceholder label="Screenshot 4.1: Entire Clinic Setup page - Highlight Clinic Setup header, Navigation, and Clinic Profile section. Caption: 'The Clinic Setup page is displayed after successful account registration.'" />
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 2: Basic Information</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-4">
            Under Step 1 (Clinic Profile), complete the required basic information fields:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>Clinic Name:</strong> The official name of your clinic (e.g., Malasakit Health Clinic). Appears on invoices and patient portals.</li>
            <li><strong>Phone:</strong> The primary contact number for the clinic. Patients will see this on booking confirmations.</li>
            <li><strong>Clinic Email:</strong> The official email address used for clinic communications.</li>
            <li><strong>Website (Optional):</strong> A link to your clinic's external website.</li>
          </ul>
          <ScreenshotPlaceholder label="Screenshot 4.2: Clinic Information section - Highlight Clinic Name, Phone, Email, Website. Caption: 'Complete the clinic's general information before continuing.'" />
        </div>
      </div>

      <DocCallout type="info">
        This basic information appears throughout the system, including invoices, reports, printed documents, emails, and patient communications.
      </DocCallout>


      {/* SECTION 4.2 — Clinic Logo */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        4.2 Clinic Logo
      </h3>
      <p className="text-gray-700 font-body mb-6">Upload your clinic's branding to personalize the patient experience.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 1: Upload Image</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            At the top of the Clinic Profile section, click <strong>Upload Logo</strong>. The system accepts PNG, JPG, and SVG formats up to 5 MB in size.
          </p>
          <ScreenshotPlaceholder label="Screenshot 4.3: Logo Upload area - Highlight Upload button and Preview area. Caption: 'Upload your clinic logo to personalize documents and patient-facing pages.'" />
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 2: Preview</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Once uploaded, a preview of your logo will appear in the thumbnail box. You can easily click "Change Logo" or "Remove" if you make a mistake. Your logo will be prominently displayed on the Patient Portal, printed Clinical Notes, Invoices, and automated Emails.
          </p>
          <ScreenshotPlaceholder label="Screenshot 4.4: Uploaded logo preview - Caption: 'After uploading, the logo preview should appear immediately.'" />
        </div>
      </div>

      <DocCallout type="tip">
        We recommend using a high-resolution PNG image with a transparent background for the best appearance on invoices and web portals.
      </DocCallout>


      {/* SECTION 4.3 — Location Details */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        4.3 Location Details
      </h3>
      <p className="text-gray-700 font-body mb-6">Configure where your clinic is physically located.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 1: Street Address & Region</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-4">
            Under the Location section, fill out your clinic's precise address. This directs patients to your physical branch.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>Street Address:</strong> Unit/Floor, Building, and Street name.</li>
            <li><strong>Province & City:</strong> Use the dropdown selectors to easily pick your region.</li>
            <li><strong>Postal Code:</strong> Enter your local ZIP/Postal code.</li>
            <li><strong>Custom Location:</strong> If your location isn't in the standard dropdown lists, click "Location not found? Enter manually" to type it out.</li>
          </ul>
          <ScreenshotPlaceholder label="Screenshot 4.5: Location Details section - Highlight Address, Province, City, and Postal Code fields. Caption: 'Enter your clinic's official address information.'" />
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 2: Pin Clinic Location</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            An interactive map is provided to pin your exact location. As you type your province and city, the map will automatically fly to your general area. Click on the map to drop a pin on your exact building.
          </p>
          <ScreenshotPlaceholder label="Screenshot 4.6: Map Picker - Highlight the Map Pin feature. Caption: 'Pin your exact clinic location for better accuracy.'" />
        </div>
      </div>

      <DocCallout type="important">
        Incorrect contact or location information may prevent patients from reaching the clinic or receiving accurate communications.
      </DocCallout>


      {/* SECTION 4.4 — Notification Preferences */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        4.4 Notification Preferences
      </h3>
      <p className="text-gray-700 font-body mb-6">Configure how the system communicates with your patients.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Email Notifications</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            At the bottom of the Clinic Profile section is a toggle for <strong>Email Notifications</strong>. Leaving this enabled ensures the system will send automated appointment reminders, booking confirmations, and welcome messages to your patients. SMS Notifications are currently under development.
          </p>
          <ScreenshotPlaceholder label="Screenshot 4.7: Preferences section - Highlight the Email Notifications toggle. Caption: 'Configure clinic communication preferences to match your operations.'" />
        </div>
      </div>

      <DocCallout type="tip">
        Notification preferences can easily be modified later in your System Settings if your clinic's requirements change.
      </DocCallout>


      {/* SECTION 4.5 — Saving Configuration */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        4.5 Saving Configuration
      </h3>
      <p className="text-gray-700 font-body mb-6">Learn how to finalize the Clinic Setup process.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 1: Review the Form</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Ensure that all required fields (marked with a red asterisk <strong>*</strong>) have been completed. If any fields are invalid (such as an incorrect phone number format), they will be highlighted in red.
          </p>
          <ScreenshotPlaceholder label="Screenshot 4.8: Completed Clinic Setup form - Highlight completed fields. Caption: 'Review all information before saving.'" />
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 2: Save Clinic Setup</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Scroll to the very bottom of the page and locate the <strong>Save Clinic Setup</strong> button. This button only becomes clickable once Step 1 (Clinic Profile) is completely filled out with valid data. Click it to finalize the process.
          </p>
          <ScreenshotPlaceholder label="Screenshot 4.9: Save button - Highlight the green Save Clinic Setup button. Caption: 'Click Save Clinic Setup to finish the initial configuration.'" />
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 3: Access Dashboard</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Upon successfully saving, a success notification will appear at the top of the screen. The system will securely initialize your workspace and automatically redirect you to your primary <strong>Owner Dashboard</strong>.
          </p>
          <ScreenshotPlaceholder label="Screenshot 4.10: Dashboard after successful setup - Caption: 'Your clinic has been successfully configured and is ready for use.'" />
        </div>
      </div>

      <DocCallout type="info" title="Congratulations!">
        Your clinic is now configured! The system foundation has been laid. From your dashboard, you can now begin adding Clinic Branches, Practitioners, Services, and eventually your first Patients.
      </DocCallout>


      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you successfully established the core foundation of your system workspace. You should now know how to:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>Configure your clinic's basic name and email.</li>
        <li>Upload a high-resolution clinic logo.</li>
        <li>Pin your clinic's exact physical location and address.</li>
        <li>Manage patient email notification preferences.</li>
        <li>Save the configuration to unlock your Owner Dashboard.</li>
      </ul>
    </>
  );
};

export default Chapter4;
