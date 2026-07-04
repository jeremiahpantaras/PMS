import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter9: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn how Malasakit combines Role-Based Access Control and Branch Restrictions to protect sensitive clinic information.
      </p>

      {/* IMPORTANT CONCEPT — Permission Evaluation Flow */}
      <div className="bg-sky-50 border-l-4 border-sky-500 p-6 md:p-8 rounded-r-2xl mb-12">
        <h3 className="text-xl font-bold text-sky-900 mb-4">Permission Evaluation Flow</h3>
        
        <p className="text-gray-700 font-body mb-4">
          Every action a user attempts to perform—whether viewing a page or saving data—is securely validated against two critical factors:
        </p>

        <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
          <li><strong>Assigned Role(s):</strong> Determines <em>what</em> features the user can access.</li>
          <li><strong>Assigned Clinic Branch(es):</strong> Determines <em>where</em> the user can access those features.</li>
        </ul>

        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-[0_4px_12px_rgb(14,165,233,0.1)] mb-6 text-center">
          <p className="text-sm font-semibold text-gray-800 mb-2">Evaluation Sequence</p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-sm text-gray-600 font-mono">
            <span className="px-3 py-1.5 bg-gray-50 rounded border border-gray-200">User Login</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Role & Branch Check</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Page Access</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-sky-50 rounded border border-sky-200">Data Visibility</span>
            <span className="text-sky-400">→</span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">Allowed / Denied</span>
          </div>
        </div>

        <ScreenshotPlaceholder label="Diagram 9.1: Permission Evaluation Flow. Caption: 'Every request is validated using both user roles and assigned clinic branches.'" />
      </div>


      {/* SECTION 9.1 — Role Permissions */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        9.1 Role Permissions
      </h3>
      <p className="text-gray-700 font-body mb-6">Permissions are primarily determined by user roles.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Higher-level roles generally possess broader administrative permissions, while lower-level roles focus on operational tasks. Below is a simplified comparison of what each role can access:
          </p>

          <div className="overflow-x-auto mb-8 border border-gray-200 rounded-xl">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-600">Role</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">Staff Mgmt</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">Patients & Appts</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">Calendar</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">Reports</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">Billing</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-center">Clinic Setup</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                <tr>
                  <td className="px-4 py-3 font-medium text-gray-900">Owner</td>
                  <td className="px-4 py-3 text-center text-emerald-600">✔</td>
                  <td className="px-4 py-3 text-center text-emerald-600">✔</td>
                  <td className="px-4 py-3 text-center text-emerald-600">✔</td>
                  <td className="px-4 py-3 text-center text-emerald-600">✔</td>
                  <td className="px-4 py-3 text-center text-emerald-600">✔</td>
                  <td className="px-4 py-3 text-center text-emerald-600">✔</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-gray-900">Manager</td>
                  <td className="px-4 py-3 text-center text-emerald-600">✔</td>
                  <td className="px-4 py-3 text-center text-emerald-600">✔</td>
                  <td className="px-4 py-3 text-center text-emerald-600">✔</td>
                  <td className="px-4 py-3 text-center text-emerald-600">✔</td>
                  <td className="px-4 py-3 text-center text-emerald-600">✔</td>
                  <td className="px-4 py-3 text-center text-red-500">✘</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-gray-900">Practitioner</td>
                  <td className="px-4 py-3 text-center text-red-500">✘</td>
                  <td className="px-4 py-3 text-center text-emerald-600">✔</td>
                  <td className="px-4 py-3 text-center text-emerald-600">✔</td>
                  <td className="px-4 py-3 text-center text-emerald-600">Own</td>
                  <td className="px-4 py-3 text-center text-red-500">✘</td>
                  <td className="px-4 py-3 text-center text-red-500">✘</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-gray-900">Front Desk</td>
                  <td className="px-4 py-3 text-center text-red-500">✘</td>
                  <td className="px-4 py-3 text-center text-emerald-600">✔</td>
                  <td className="px-4 py-3 text-center text-emerald-600">✔</td>
                  <td className="px-4 py-3 text-center text-red-500">✘</td>
                  <td className="px-4 py-3 text-center text-red-500">✘</td>
                  <td className="px-4 py-3 text-center text-red-500">✘</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-gray-900">Finance</td>
                  <td className="px-4 py-3 text-center text-red-500">✘</td>
                  <td className="px-4 py-3 text-center text-emerald-600">View Only</td>
                  <td className="px-4 py-3 text-center text-emerald-600">View Only</td>
                  <td className="px-4 py-3 text-center text-emerald-600">Financial</td>
                  <td className="px-4 py-3 text-center text-emerald-600">✔</td>
                  <td className="px-4 py-3 text-center text-red-500">✘</td>
                </tr>
              </tbody>
            </table>
          </div>

          <ScreenshotPlaceholder label="Screenshot 9.1: User Profile showing assigned roles. Caption: 'User permissions are determined by assigned roles.'" />
          <ScreenshotPlaceholder label="Diagram 9.2: Role Hierarchy. Caption: 'Higher-level roles generally have broader permissions, while lower-level roles focus on operational tasks.'" />
        </div>
      </div>

      <DocCallout type="info">
        A user may possess multiple roles. In this case, their permissions are merged, granting them the highest level of access provided by their role combination.
      </DocCallout>


      {/* SECTION 9.2 — Branch Restrictions */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        9.2 Branch Restrictions
      </h3>
      <p className="text-gray-700 font-body mb-6">How location assignments isolate clinic data.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Even if a user possesses the correct role to perform an action, they must also be explicitly authorized to perform that action <strong>at that specific clinic branch</strong>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="p-5 rounded-xl border border-gray-200 bg-gray-50">
              <h5 className="font-bold text-gray-900 mb-2 border-b border-gray-200 pb-2">Example 1: Manager</h5>
              <p className="text-sm text-gray-600 mb-2">Assigned to Branch 1 & Branch 2</p>
              <ul className="text-sm space-y-1">
                <li className="text-emerald-600">✔ Visible: Branch 1 data</li>
                <li className="text-emerald-600">✔ Visible: Branch 2 data</li>
                <li className="text-red-500">✘ Hidden: Branch 3 data</li>
              </ul>
            </div>

            <div className="p-5 rounded-xl border border-gray-200 bg-gray-50">
              <h5 className="font-bold text-gray-900 mb-2 border-b border-gray-200 pb-2">Example 2: Practitioner</h5>
              <p className="text-sm text-gray-600 mb-2">Assigned to Branch 2</p>
              <ul className="text-sm space-y-1">
                <li className="text-emerald-600">✔ Visible: Branch 2 Patients</li>
                <li className="text-emerald-600">✔ Visible: Branch 2 Calendar</li>
                <li className="text-emerald-600">✔ Visible: Branch 2 Reports</li>
                <li className="text-red-500">✘ Hidden: Branch 1 & 3 data</li>
              </ul>
            </div>
          </div>

          <ScreenshotPlaceholder label="Screenshot 9.2: Branch Selector. Caption: 'Users only see clinic branches assigned to their account.'" />
          <ScreenshotPlaceholder label="Screenshot 9.3: Calendar View. Highlight the assigned branch and disabled 'All Branches' tab. Caption: 'Practitioners can only access the calendar for their assigned clinic branch.'" />
          <ScreenshotPlaceholder label="Diagram 9.3: Branch Visibility. Caption: 'Branch assignments control which clinic data is visible to each user.'" />
        </div>
      </div>

      <DocCallout type="important">
        Branch restrictions apply throughout the entire system. This includes patients, appointments, reports, consent forms, public links, QR codes, and notifications.
      </DocCallout>


      {/* SECTION 9.3 — Access Control Layers */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        9.3 Access Control Layers
      </h3>
      <p className="text-gray-700 font-body mb-6">How Malasakit controls module access.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            To ensure bulletproof security, Malasakit evaluates user permissions using a two-layer security approach:
          </p>

          <h5 className="font-bold text-gray-900 mb-2">1. Frontend Route Protection</h5>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            The user interface automatically adapts to your permissions. If you lack the required role, unauthorized menus will appear completely disabled or entirely hidden from the sidebar. You will be actively prevented from navigating to those pages.
          </p>

          <h5 className="font-bold text-gray-900 mb-2">2. Backend API Protection</h5>
          <p className="text-gray-700 font-body leading-relaxed mb-4">
            Even if a technically savvy user attempts to bypass the frontend by manually typing a restricted URL into the browser, the backend server acts as the ultimate gatekeeper. Every single request sent to the database is verified, and unauthorized requests are permanently rejected.
          </p>

          <ScreenshotPlaceholder label="Screenshot 9.4: Disabled Setup Menu. Highlight disabled administrative modules. Caption: 'Restricted modules remain visible but cannot be accessed by unauthorized users.'" />
          <ScreenshotPlaceholder label="Screenshot 9.5: Access Denied page. Highlight access denied message. Caption: 'Unauthorized users are prevented from opening restricted pages.'" />
          <ScreenshotPlaceholder label="Diagram 9.4: Access Control Layers. Caption: 'Both frontend and backend validations protect sensitive clinic information.'" />
        </div>
      </div>

      <DocCallout type="warning">
        Frontend restrictions improve the user experience by hiding irrelevant buttons, but backend authorization provides the actual security. Unauthorized API requests are strictly denied.
      </DocCallout>


      {/* SECTION 9.4 — Security */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        9.4 Security
      </h3>
      <p className="text-gray-700 font-body mb-6">How Malasakit safeguards clinic data.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            System security is maintained through secure session management and branch isolation. This guarantees patient privacy by ensuring that only authorized personnel interact with sensitive information.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>Authentication:</strong> All users must log in using encrypted credentials before any data is exposed.</li>
            <li><strong>Authorization (JWT):</strong> The system continuously verifies an active, authorized session for every action taken.</li>
            <li><strong>Branch Isolation:</strong> Patients, clinical notes, and financial records are permanently segmented by clinic branch.</li>
          </ul>

          <ScreenshotPlaceholder label="Screenshot 9.6: Login screen. Highlight secure login. Caption: 'All users must authenticate before accessing clinic information.'" />
          <ScreenshotPlaceholder label="Screenshot 9.7: Protected module (example: Billing). Highlight restricted access based on role. Caption: 'Sensitive modules are available only to authorized users.'" />
          <ScreenshotPlaceholder label="Diagram 9.5: Security Overview. Caption: 'Every secure action follows authentication and authorization checks before access is granted.'" />
        </div>
      </div>

      <DocCallout type="tip">
        Regularly review staff roles and branch assignments to ensure users only have access to the information required for their day-to-day responsibilities.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how Malasakit keeps your clinic information safe. You should now understand:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>How role permissions determine feature access across different staff members.</li>
        <li>How branch restrictions control patient and financial data visibility.</li>
        <li>The difference between frontend user-interface restrictions and backend security.</li>
        <li>How authentication and authorization work together to protect patient privacy.</li>
        <li>Why different users experience entirely different views of the system dashboard.</li>
      </ul>
    </>
  );
};

export default Chapter9;
