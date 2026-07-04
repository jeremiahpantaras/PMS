import React from 'react';
import { DocCallout } from '../DocCallout';
import { ScreenshotPlaceholder } from '../ScreenshotPlaceholder';

const Chapter3: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        This chapter teaches you how to access your Malasakit account, recover your password if needed, understand session behavior, and safely sign out after use.
      </p>

      {/* SECTION 3.1 — Signing In */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-12 mb-4 border-b border-gray-100 pb-2">
        3.1 Signing In
      </h3>
      <p className="text-gray-700 font-body mb-6">Learn how to log into an existing Malasakit account.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 1: Navigate to the Landing Page</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Click the <strong>Sign In</strong> button located in the navigation bar.
          </p>
          <ScreenshotPlaceholder label="Screenshot 3.1: Landing Page - Highlight Navigation Bar and Sign In button. Caption: 'Click the Sign In button to access your existing Malasakit account.'" />
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 2: The Sign In Page</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-4">
            The Sign In page will open, presenting several fields:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body mb-6">
            <li><strong>Email Address:</strong> Enter the email associated with your account.</li>
            <li><strong>Password:</strong> Enter your secret password. You can click the eye icon to show or hide the password text.</li>
            <li><strong>Forgot Password:</strong> Click this link if you cannot remember your password.</li>
            <li><strong>Sign In button:</strong> Submits your credentials to authenticate your session.</li>
          </ul>
          <ScreenshotPlaceholder label="Screenshot 3.2: Sign In Page - Highlight Email field, Password field, Forgot Password link, and Sign In button. Caption: 'Enter your registered email address and password.'" />
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 3: Successful Authentication</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            After entering your credentials and clicking <strong>Sign In</strong>, the system will verify your account. Upon successful authentication, you are securely redirected to the Dashboard.
          </p>
          <ScreenshotPlaceholder label="Screenshot 3.3: Dashboard - Highlight Dashboard, Sidebar, User Profile. Caption: 'After successful authentication, you will be redirected to the Dashboard.'" />
        </div>
      </div>

      <DocCallout type="info">
        For security purposes, always verify that you are signing in through the official Malasakit website URL.
      </DocCallout>

      <DocCallout type="tip">
        Use a strong password and avoid sharing your login credentials with others.
      </DocCallout>


      {/* SECTION 3.2 — Forgot Password */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        3.2 Forgot Password
      </h3>
      <p className="text-gray-700 font-body mb-6">Learn how to recover access to your account.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 1: Click Forgot Password</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            On the Sign In page, locate and click the <strong>Forgot password?</strong> link above the password field.
          </p>
          <ScreenshotPlaceholder label="Screenshot 3.4: Sign In Page - Highlight Forgot Password link. Caption: 'Click Forgot Password if you cannot remember your password.'" />
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 2: Enter Email Address</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Enter your registered email address. This email must exactly match the account used during registration. Then, click the <strong>Send Verification Code</strong> button.
          </p>
          <ScreenshotPlaceholder label="Screenshot 3.5: Forgot Password Page - Highlight Email field and Continue/Send button. Caption: 'Enter the email address associated with your Malasakit account.'" />
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 3: Verification Code Sent</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            After submission, Malasakit will securely send a 6-digit One-Time Password (OTP) to your inbox. You will be redirected to the OTP Verification screen where you can input the code to securely reset your password.
          </p>
          <ScreenshotPlaceholder label="Screenshot 3.6: Password Recovery Confirmation - Highlight Confirmation message. Caption: 'A recovery email or verification code has been sent.'" />
        </div>
      </div>

      <DocCallout type="important">
        If recovery emails do not arrive:
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li>Check your Spam or Junk folder.</li>
          <li>Verify that the email was spelled correctly.</li>
          <li>Wait a few minutes before requesting another reset code.</li>
        </ul>
      </DocCallout>


      {/* SECTION 3.3 — Session Management */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        3.3 Session Management
      </h3>
      <p className="text-gray-700 font-body mb-6">Understand how Malasakit manages user sessions securely.</p>

      <div className="space-y-6 text-gray-700 font-body leading-relaxed mb-6">
        <p>
          When you log into Malasakit, an authenticated session is created. This session allows you to access authorized system modules, such as your Dashboard and patient records.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Authentication Session:</strong> Your session securely verifies your identity across all pages.</li>
          <li><strong>Automatic Expiration:</strong> For security, Malasakit actively monitors your session. If you are inactive for an extended period (nearly 2 hours), a warning modal will appear. If no action is taken, your session will automatically time out and log you out to protect clinical data.</li>
          <li><strong>Multiple Browser Tabs:</strong> If you log out from one tab, your session is ended globally across all tabs.</li>
        </ul>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8 mb-6">
        <ScreenshotPlaceholder label="Screenshot 3.7: Dashboard - Highlight Logged-in user. Caption: 'A signed-in user has access to the authorized system modules.'" />
      </div>

      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8 mb-8">
        <ScreenshotPlaceholder label="Optional Illustration Placeholder: Workflow Diagram (Sign In -> Authenticated Session -> Dashboard Access -> Logout)" />
      </div>

      <DocCallout type="info">
        Users should avoid leaving their account open on shared or public computers. Always explicitly sign out when stepping away.
      </DocCallout>


      {/* SECTION 3.4 — Logout */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        3.4 Logout
      </h3>
      <p className="text-gray-700 font-body mb-6">Learn how to safely end your session.</p>

      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 1: Locate the User Profile Menu</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            From the Dashboard (or any authenticated page), locate your Profile Avatar in the top-right corner of the navigation bar.
          </p>
          <ScreenshotPlaceholder label="Screenshot 3.8: Dashboard - Highlight Profile Avatar / User Menu. Caption: 'Open the user profile menu located at the top-right corner.'" />
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 2: Click Logout</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            Click the avatar to reveal the dropdown menu. Click the <strong>Logout</strong> option. You will be prompted to confirm your choice. Confirming will securely end your active session and erase all authentication tokens from the browser.
          </p>
          <ScreenshotPlaceholder label="Screenshot 3.9: User Dropdown - Highlight Logout option. Caption: 'Select Logout to securely end your session.'" />
        </div>

        <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
          <h4 className="text-xl font-semibold text-trust-harbor font-heading mb-4">Step 3: Successful Logout</h4>
          <p className="text-gray-700 font-body leading-relaxed mb-6">
            After successfully logging out, you are immediately redirected back to the Landing Page. A brief notification will confirm that you have been securely signed out.
          </p>
          <ScreenshotPlaceholder label="Screenshot 3.10: Landing Page - Caption: 'You have successfully signed out of your account.'" />
        </div>
      </div>

      <DocCallout type="warning">
        Always log out after using Malasakit on shared or public devices to protect patient and clinic information.
      </DocCallout>

      {/* CHAPTER SUMMARY */}
      <h3 className="text-2xl font-semibold text-trust-harbor font-heading mt-16 mb-4 border-b border-gray-100 pb-2">
        Summary
      </h3>
      <p className="text-gray-700 font-body leading-relaxed mb-4">
        In this chapter, you learned how to securely manage your Malasakit access. You should now know how to:
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
        <li>Sign into your account from the landing page.</li>
        <li>Recover a forgotten password via email verification.</li>
        <li>Understand session behavior and automatic inactivity timeouts.</li>
        <li>Safely log out to protect your account.</li>
      </ul>
    </>
  );
};

export default Chapter3;
