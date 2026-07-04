import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter8: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how clinic owners and managers configure new staff accounts, assign roles, and securely grant branch access.
      </p>

      {/* IMPORTANT CONCEPT — Staff Account Creation Workflow */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Staff Account Creation Workflow</h3>
        
        <p className="text-gray-700 font-body mb-4">
          Every staff member must have an account before accessing Malasakit. When creating a staff account, administrators configure four main components:
        </p>

        <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
          <li><strong>Personal Information</strong> (Name, birth date, contact details)</li>
          <li><strong>Login Credentials</strong> (Email and temporary password)</li>
          <li><strong>User Roles</strong> (e.g., Practitioner, Manager, Front Desk)</li>
          <li><strong>Clinic Branch(es)</strong> (The specific locations the user can access)</li>
        </ul>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center">
          <p className="text-sm font-semibold text-gray-800 mb-2">Configuration Flow</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-sm text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Create Staff Account</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Assign Role(s)</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Assign Branch(es)</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-green-50 text-green-700 font-bold rounded border border-green-200">Save Account</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 8.1: Staff Creation Workflow. Caption: 'Every staff account is configured with both roles and clinic branch assignments.'" />
      </div>


      {/* SECTION 8.1 — Opening Staff Management */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        8.1 Opening Staff Management
      </h3>
      <p className="text-gray-700 font-body mb-6">Locate the user administration dashboard.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            To manage users, navigate to <strong>Clinic Setup</strong> in the sidebar and click on <strong>Staff</strong>. This page displays all existing staff members, their assigned roles, and their authorized branches.
          </p>
          <ScreenshotPlaceholder label="Screenshot 8.1: Staff Management page - Highlight Staff List and Create Staff Account button. Caption: 'Open the Staff Management page to create and manage staff accounts.'" />
          <ScreenshotPlaceholder label="Screenshot 8.2: Create Staff Account button - Highlight action button. Caption: 'Click Create Staff Account to register a new staff member.'" />
        </div>
      </div>


      {/* SECTION 8.2 — Completing Staff Information */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        8.2 Completing Staff Information
      </h3>
      <p className="text-gray-700 font-body mb-6">Enter the user's personal and contact details.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-4">
            The first section of the modal collects the staff member's personal information:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>First Name, Last Name, Middle Name, Nickname:</strong> The user's full name as it will appear in the system and on clinical notes.</li>
            <li><strong>Gender & Date of Birth:</strong> Basic demographic information.</li>
            <li><strong>Email Address:</strong> Used for system login and receiving the initial temporary password.</li>
            <li><strong>Contact Number:</strong> A valid phone number for clinic communications.</li>
          </ul>
          <ScreenshotPlaceholder label="Screenshot 8.3: Create Staff Account Modal - Highlight Personal Information section. Caption: 'Enter the staff member's personal information.'" />
        </div>
      </div>

      <DocCallout type="tip">
        Use the staff member's official work email to simplify password recovery and ensure system notifications are routed correctly.
      </DocCallout>


      {/* SECTION 8.3 — Assigning User Roles */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        8.3 Assigning User Roles
      </h3>
      <p className="text-gray-700 font-body mb-6">Define what features the user can access.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-4">
            Select one or more roles from the Clinical Role section to define the staff member's system permissions. Available operational roles include:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>Manager (Admin Assistant):</strong> Branch management and administration.</li>
            <li><strong>Practitioner:</strong> Clinical operations and patient care.</li>
            <li><strong>Staff (Front Desk):</strong> Patient scheduling and registration.</li>
            <li><strong>Finance:</strong> Billing, invoicing, and reports.</li>
          </ul>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            A single user may hold multiple roles simultaneously (e.g., a Practitioner who is also a Manager). Their permissions will be combined. Note that <strong>Owner (Administrator)</strong> accounts are typically created during the initial clinic registration process.
          </p>
          <ScreenshotPlaceholder label="Screenshot 8.4: Role Selection - Highlight Role selector cards. Caption: 'Assign one or more roles to define the staff member's permissions.'" />
        </div>
      </div>

      <DocCallout type="info">
        A user's final permissions are determined by the combination of their assigned roles and their assigned clinic branches.
      </DocCallout>


      {/* SECTION 8.4 — Creating a Manager Account */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        8.4 Creating a Manager Account
      </h3>
      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            When selecting the <strong>Manager</strong> role, you must assign the user to one or multiple clinic branches. Managers possess administrative capabilities but are strictly limited to managing data within their assigned branches.
          </p>
          <ScreenshotPlaceholder label="Screenshot 8.5: Manager Role Selected - Highlight Manager role and Assigned Branch selector. Caption: 'Managers may be assigned to one or multiple clinic branches.'" />
        </div>
      </div>


      {/* SECTION 8.5 — Creating a Practitioner Account */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        8.5 Creating a Practitioner Account
      </h3>
      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            When creating a <strong>Practitioner</strong>, you must assign them to their primary working branch. This guarantees that their appointment calendar, patient list, and clinical notes are exclusively tied to that specific clinic location. Practitioners cannot access the "All Branches" calendar.
          </p>
          <ScreenshotPlaceholder label="Screenshot 8.6: Practitioner Role Selected - Highlight Practitioner role and Assigned Branch. Caption: 'Practitioners are assigned to their working clinic branch during account creation.'" />
        </div>
      </div>

      <DocCallout type="important">
        Practitioners only access patients, appointments, calendars, and reports belonging to their assigned clinic branch.
      </DocCallout>


      {/* SECTION 8.6 — Creating a Front Desk Account */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        8.6 Creating a Front Desk Account
      </h3>
      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Select the <strong>Staff</strong> role to create a Front Desk user. After assigning them to specific branches, they will be able to register patients, manage schedules, and monitor online bookings specifically for those locations.
          </p>
          <ScreenshotPlaceholder label="Screenshot 8.7: Front Desk Role - Highlight Front Desk role and Assigned Branch. Caption: 'Front Desk users manage appointments and patients for assigned clinic branches.'" />
        </div>
      </div>


      {/* SECTION 8.7 — Creating a Finance Account */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        8.7 Creating a Finance Account
      </h3>
      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Select the <strong>Finance</strong> role for billing and invoicing staff. By restricting their branch assignments, you ensure they only view and process financial information generated by their authorized locations.
          </p>
          <ScreenshotPlaceholder label="Screenshot 8.8: Finance Role - Highlight Finance role and Assigned Branch. Caption: 'Finance staff manage billing for assigned clinic branches.'" />
        </div>
      </div>


      {/* SECTION 8.8 — Branch Assignment */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        8.8 Branch Assignment Logic
      </h3>
      <p className="text-gray-700 font-body mb-6">Understand how locations are granted.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Depending on the roles selected, the branch assignment component will allow either a single location or multiple locations.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>Single Branch Assignment:</strong> Typically used for Practitioners to firmly root their clinical calendar and availability to one physical location.</li>
            <li><strong>Multiple Branch Assignment:</strong> Available for Managers, Front Desk, and Finance staff who oversee operations across several clinic branches.</li>
          </ul>

          <ScreenshotPlaceholder label="Screenshot 8.9: Assigned Branch Selector - Highlight Branch selection component. Caption: 'Assign one or more clinic branches depending on the staff member's responsibilities.'" />
          <ScreenshotPlaceholder label="Screenshot 8.10: Branch Assignment Completed - Highlight selected branches. Caption: 'Selected clinic branches determine which data the staff member can access.'" />
          <ScreenshotPlaceholder label="Diagram 8.2: Branch Assignment Flow. Caption: 'Branch assignments determine which clinic data each staff member can access.'" />
        </div>
      </div>


      {/* SECTION 8.9 — Saving the Staff Account */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        8.9 Saving the Staff Account
      </h3>
      <p className="text-gray-700 font-body mb-6">Finalize the configuration and activate the user.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Once all fields are complete, click <strong>Save</strong>. The system will validate the information and automatically generate the account. The new staff member will immediately appear in your Staff List, and an email containing their temporary password will be dispatched. Their role permissions and branch restrictions take effect instantly.
          </p>
          <ScreenshotPlaceholder label="Screenshot 8.11: Save Button - Highlight Save button. Caption: 'Click Save to create the new staff account.'" />
          <ScreenshotPlaceholder label="Screenshot 8.12: Updated Staff List - Highlight newly created staff member. Caption: 'The new staff member now appears in the Staff Management list.'" />
        </div>
      </div>

      <DocCallout type="warning">
        Always verify assigned roles and clinic branches before saving. Incorrect assignments may allow users to access unintended clinic data or restrict access to required features.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how to successfully onboard new employees into the Malasakit System. You should now know how to:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>Navigate to the Staff Management page.</li>
        <li>Complete a new user's personal information.</li>
        <li>Assign clinical and administrative roles.</li>
        <li>Correctly assign single or multiple branches based on the user's role.</li>
        <li>Save the account to trigger automated login instructions.</li>
      </ul>
    </>
  );
};

export default Chapter8;
