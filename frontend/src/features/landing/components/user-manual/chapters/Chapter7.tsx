import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter7: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how Malasakit utilizes a Role-Based Access Control (RBAC) system to determine which features and clinic branches each user can access.
      </p>

      {/* IMPORTANT CONCEPT — How RBAC Works */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">How RBAC Works</h3>
        
        <p className="text-gray-700 font-body mb-4">
          In Malasakit, every user account is assigned one or more roles. A user's permissions are automatically calculated based on two key factors:
        </p>
        
        <ol className="list-decimal pl-6 space-y-2 text-gray-700 font-body mb-6 font-medium">
          <li>The user's assigned role (e.g., Practitioner, Manager, Front Desk)</li>
          <li>The specific clinic branches assigned to that user</li>
        </ol>

        <p className="text-gray-700 font-body mb-6">
          This combination ensures that staff members have secure access to the tools they need while preventing them from viewing sensitive information (such as patients, appointments, and reports) outside their authorized clinic branches.
        </p>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center">
          <p className="text-sm font-semibold text-gray-800 mb-2">Permission Flow</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-sm text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">User</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Assigned Role</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">Assigned Branch</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 text-sky-700 rounded border border-sky-200 font-bold">Visible Data</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 7.1: RBAC Flow. Caption: 'Permissions are determined by user roles and assigned clinic branches.'" />
      </div>


      {/* SECTION 7.1 — Owner */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        7.1 Owner
      </h3>
      <p className="text-gray-700 font-body mb-6">The highest level of administrative access.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            <strong>Owners</strong> have full system control and unrestricted access across the entire clinic organization. They are the only users who are not restricted by branch assignments.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li>Manage clinic subscription and billing</li>
            <li>Create and manage all clinic branches</li>
            <li>Configure global clinic settings</li>
            <li>Manage all staff users and roles</li>
            <li>View all branch calendars, diaries, patients, and appointments</li>
            <li>View organization-wide financial records and reports</li>
            <li>Manage all branch consent forms, QR codes, and public links</li>
          </ul>
          <ScreenshotPlaceholder label="Screenshot 7.1: Owner Dashboard - Highlight the Dashboard, Sidebar, Branch selector, Reports, and Clinic Setup. Caption: 'Owners have unrestricted access across the entire clinic organization.'" />
        </div>
      </div>


      {/* SECTION 7.2 — Manager (Admin Assistant) */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        7.2 Manager (Admin Assistant)
      </h3>
      <p className="text-gray-700 font-body mb-6">Administrative leaders for specific clinic locations.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            <strong>Managers</strong> act as the administrators for the specific branches they are assigned to. They oversee operations, staff, and configurations within their authorized scope.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li>Manage practitioners, front desk, and finance users assigned to their branches</li>
            <li>Manage patient records and appointment schedules</li>
            <li>View branch-specific performance and financial reports</li>
            <li>Configure branch-specific consent forms</li>
            <li>Manage branch public links and QR codes</li>
          </ul>
          <ScreenshotPlaceholder label="Screenshot 7.2: Manager Dashboard - Highlight the Assigned Branch selector. Caption: 'Managers only access the clinic branches assigned to their account.'" />
          <ScreenshotPlaceholder label="Screenshot 7.3: Manager Clinic Menu - Highlight the Assigned Public Links. Caption: 'Managers only see Public Links and QR Codes for their assigned branches.'" />
        </div>
      </div>

      <DocCallout type="info">
        If a Manager is assigned to only one branch, only that branch appears. If assigned to multiple branches, they can switch between them. Managers can never access unassigned branches.
      </DocCallout>


      {/* SECTION 7.3 — Practitioner */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        7.3 Practitioner
      </h3>
      <p className="text-gray-700 font-body mb-6">Clinical professionals delivering patient care.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            <strong>Practitioners</strong> are assigned to exactly one primary clinic branch. They have access to the clinical tools required to treat patients within that branch.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li>Manage their own appointments and schedule availability</li>
            <li>Access the patient list for their assigned branch</li>
            <li>Create and securely sign clinical notes</li>
            <li>View their assigned branch calendar and diary</li>
            <li>View their own performance reports (where applicable)</li>
          </ul>
          
          <h5 className="font-bold text-gray-900 mb-2">System Limitations</h5>
          <p className="text-gray-700 font-body leading-relaxed mb-4">
            To protect clinic privacy, practitioners cannot access the "All Branches" calendar, other clinic branches, staff management, invoicing configurations, or global settings. Administrative modules in the sidebar will appear disabled or completely hidden.
          </p>
          
          <ScreenshotPlaceholder label="Screenshot 7.4: Practitioner Calendar - Highlight the assigned branch and disabled 'All Branches' tab. Caption: 'Practitioners only access the calendar of their assigned clinic branch.'" />
          <ScreenshotPlaceholder label="Screenshot 7.5: Practitioner Sidebar - Highlight disabled Setup menus. Caption: 'Restricted administrative modules appear disabled for practitioners.'" />
        </div>
      </div>

      <DocCallout type="warning">
        Practitioners cannot bypass branch restrictions by manually entering URLs. Permissions are strictly enforced on both the user interface and the backend server.
      </DocCallout>


      {/* SECTION 7.4 — Front Desk */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        7.4 Front Desk
      </h3>
      <p className="text-gray-700 font-body mb-6">The primary operators of patient scheduling.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            <strong>Front Desk</strong> users (Staff) handle day-to-day scheduling and patient intake within their assigned branches.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li>Register new patients into the system</li>
            <li>Book, update, and cancel appointments on the calendar</li>
            <li>Monitor incoming online bookings</li>
            <li>Manage patient check-ins</li>
          </ul>
          <ScreenshotPlaceholder label="Screenshot 7.6: Front Desk Dashboard - Highlight Appointments and Patient Management. Caption: 'Front Desk staff manage patient scheduling within their assigned branches.'" />
        </div>
      </div>


      {/* SECTION 7.5 — Finance */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        7.5 Finance
      </h3>
      <p className="text-gray-700 font-body mb-6">Billing and invoicing specialists.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            <strong>Finance</strong> users are granted access strictly to the financial modules of their assigned branches.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li>View, generate, and process invoices</li>
            <li>Track and record payments</li>
            <li>Manage bulk invoicing runs</li>
            <li>Generate financial reports for their assigned branches</li>
          </ul>
          <ScreenshotPlaceholder label="Screenshot 7.7: Finance Dashboard - Highlight Invoices, Payments, and Billing. Caption: 'Finance users manage billing and payments for assigned clinic branches.'" />
        </div>
      </div>


      {/* SECTION 7.6 — Branch Scope Examples */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        7.6 Branch Scope Examples
      </h3>
      <p className="text-gray-700 font-body mb-6">See how branch assignments dictate visibility.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            When a user account is created or edited, the Owner assigns them a role and a specific set of branches. Here is how that translates to system access:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-5 rounded-xl border border-gray-200 bg-gray-50">
              <h5 className="font-bold text-gray-900 mb-2 border-b border-gray-200 pb-2">Example 1: Manager</h5>
              <p className="text-sm text-gray-600 mb-2"><strong>Assigned:</strong> Branch 1 & Branch 2</p>
              <ul className="text-sm space-y-1">
                <li className="text-emerald-600">✔ Can access Branch 1</li>
                <li className="text-emerald-600">✔ Can access Branch 2</li>
                <li className="text-red-500">✘ Cannot access Branch 3</li>
              </ul>
            </div>

            <div className="p-5 rounded-xl border border-gray-200 bg-gray-50">
              <h5 className="font-bold text-gray-900 mb-2 border-b border-gray-200 pb-2">Example 2: Practitioner</h5>
              <p className="text-sm text-gray-600 mb-2"><strong>Assigned:</strong> Branch 2</p>
              <ul className="text-sm space-y-1">
                <li className="text-emerald-600">✔ Can access Branch 2</li>
                <li className="text-red-500">✘ Cannot access Branch 1</li>
                <li className="text-red-500">✘ Cannot access Branch 3</li>
                <li className="text-red-500">✘ Cannot access "All Branches"</li>
              </ul>
            </div>

            <div className="p-5 rounded-xl border border-blue-200 bg-blue-50">
              <h5 className="font-bold text-blue-900 mb-2 border-b border-blue-200 pb-2">Example 3: Owner</h5>
              <p className="text-sm text-blue-700 mb-2"><strong>Assigned:</strong> System Wide</p>
              <ul className="text-sm space-y-1">
                <li className="text-blue-700">✔ Can access every clinic branch</li>
              </ul>
            </div>
          </div>

          <ScreenshotPlaceholder label="Diagram 7.2: Branch Visibility Matrix. Caption: 'Branch visibility is determined by both user role and assigned clinic branches.'" />
          
          <div className="mt-8">
            <ScreenshotPlaceholder label="Screenshot 7.8: Create Staff Account - Highlight Role selector and Assigned Branch selector. Caption: 'Assign user roles and clinic branches when creating staff accounts.'" />
            <ScreenshotPlaceholder label="Screenshot 7.9: Edit Staff Account - Highlight existing roles and assigned branches. Caption: 'Staff roles and assigned branches can be updated as organizational needs change.'" />
          </div>
        </div>
      </div>

      <DocCallout type="tip">
        Assign users only to the branches they actively work in. This keeps calendars, patient records, reports, and notifications organized while maintaining strict data privacy across locations.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how Malasakit combines role permissions and branch assignments to provide secure, location-specific access throughout the system. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>The system-wide capabilities of the <strong>Owner</strong> role.</li>
        <li>The administrative responsibilities of a <strong>Manager</strong> within their assigned scope.</li>
        <li>The clinical permissions and restrictions applied to a <strong>Practitioner</strong>.</li>
        <li>The scheduling duties of <strong>Front Desk</strong> staff.</li>
        <li>The billing capabilities of <strong>Finance</strong> users.</li>
        <li>How branch visibility physically limits access to patients, calendars, and reports.</li>
      </ul>
    </>
  );
};

export default Chapter7;
