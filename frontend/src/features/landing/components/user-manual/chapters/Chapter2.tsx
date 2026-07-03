import React from 'react';
import { DocCallout } from '../DocCallout';

import Step1Img from '@/assets/manual/getting-started/step1-landing-page-navbar.png';
import Step2Img from '@/assets/manual/getting-started/step2-owner-registration.png';
import Step3Img from '@/assets/manual/getting-started/step3-verification-email.png';
import Step4Img from '@/assets/manual/getting-started/step4-otp-verification.png';
import Step5Img from '@/assets/manual/getting-started/step5-create-password.png';
import Step6Img from '@/assets/manual/getting-started/step6-clinic-setup-intro.png';
import Step7Img from '@/assets/manual/getting-started/step7-clinic-information.png';
import Step8Img from '@/assets/manual/getting-started/step8-save-clinic-setup.png';
import Step9Img from '@/assets/manual/getting-started/step9-owner-dashboard.png';

const Chapter2: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-4">Creating Your Owner Account and Setting Up Your Clinic</p>
      <p className="text-gray-700 font-body leading-relaxed mb-8">
        This guide walks new clinic owners through the complete registration and clinic setup process.
      </p>

      {/* Step 1 */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
        <h3 className="text-2xl font-semibold text-trust-harbor font-heading mb-4">1. Open the Malasakit Landing Page</h3>
        <div className="text-gray-700 font-body leading-relaxed space-y-4 mb-6">
          <p>When you first access the Malasakit website, you will be presented with the Landing Page.</p>
          <p>At the top of the page is the Navigation Bar, which contains several menu links for exploring the website.</p>
          <p>If you are a first-time clinic owner setting up a new account, click the <strong>Sign Up</strong> button.</p>
        </div>
        <div className="mt-6 w-full flex justify-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden p-2">
          <img src={Step1Img} alt="Landing Page" className="w-full max-h-[500px] object-contain rounded-lg shadow-sm" />
        </div>
      </div>

      {/* Step 2 */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
        <h3 className="text-2xl font-semibold text-trust-harbor font-heading mb-4">2. Create Your Owner Account</h3>
        <div className="text-gray-700 font-body leading-relaxed space-y-4 mb-6">
          <p>The Owner Registration form requires the following information:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Owner Name:</strong> The full name of the primary clinic administrator.</li>
            <li><strong>Clinic Name:</strong> The official name of your clinic.</li>
            <li><strong>Email Address:</strong> A valid email address that will be used for communication and login.</li>
          </ul>
          <p>Once all fields are filled out, click <strong>Create Account</strong> to submit your registration.</p>
        </div>
        <div className="mt-6 w-full flex justify-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden p-2">
          <img src={Step2Img} alt="Owner Registration Form" className="w-full max-h-[500px] object-contain rounded-lg shadow-sm" />
        </div>
      </div>

      {/* Step 3 */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
        <h3 className="text-2xl font-semibold text-trust-harbor font-heading mb-4">3. Verify Your Email Address</h3>
        <div className="text-gray-700 font-body leading-relaxed space-y-4 mb-6">
          <p>After submitting the registration, an OTP (One-Time Password) is automatically sent to your registered email address.</p>
          <ol className="list-decimal pl-6 space-y-2">
            <li>Open your email inbox.</li>
            <li>Locate the verification email from Malasakit.</li>
            <li>Copy the OTP provided in the email.</li>
          </ol>
          <DocCallout type="tip">
            If you don't see the email within a few minutes, please check your Spam or Junk folders.
          </DocCallout>
        </div>
        <div className="mt-6 w-full flex justify-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden p-2">
          <img src={Step3Img} alt="Verification Email" className="w-full max-h-[500px] object-contain rounded-lg shadow-sm" />
        </div>
      </div>

      {/* Step 4 */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
        <h3 className="text-2xl font-semibold text-trust-harbor font-heading mb-4">4. Enter the Verification Code</h3>
        <div className="text-gray-700 font-body leading-relaxed space-y-4 mb-6">
          <ol className="list-decimal pl-6 space-y-2">
            <li>Return to the Malasakit verification screen.</li>
            <li>Enter the OTP you received in your email.</li>
            <li>Click <strong>Verify</strong>.</li>
          </ol>
          <p>Successful verification confirms ownership of the registered email address and allows you to proceed.</p>
        </div>
        <div className="mt-6 w-full flex justify-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden p-2">
          <img src={Step4Img} alt="OTP Verification Screen" className="w-full max-h-[500px] object-contain rounded-lg shadow-sm" />
        </div>
      </div>

      {/* Step 5 */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
        <h3 className="text-2xl font-semibold text-trust-harbor font-heading mb-4">5. Create Your Password</h3>
        <div className="text-gray-700 font-body leading-relaxed space-y-4 mb-6">
          <p>After successful OTP verification, you will be prompted to create a password for your account.</p>
          <p>For security purposes, we highly recommend using a strong password that includes:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Uppercase and lowercase letters</li>
            <li>Numbers</li>
            <li>Symbols (e.g., @, #, $, %)</li>
          </ul>
          <p>Once submitted successfully, your account becomes active.</p>
        </div>
        <div className="mt-6 w-full flex justify-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden p-2">
          <img src={Step5Img} alt="Create Password Screen" className="w-full max-h-[500px] object-contain rounded-lg shadow-sm" />
        </div>
      </div>

      {/* Step 6 */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
        <h3 className="text-2xl font-semibold text-trust-harbor font-heading mb-4">6. Clinic Setup</h3>
        <div className="text-gray-700 font-body leading-relaxed space-y-4 mb-6">
          <p>After creating your password successfully, the system automatically redirects you to the <strong>Clinic Setup</strong> page.</p>
          <p>This setup process is required before you can start using the system features.</p>
        </div>
        <div className="mt-6 w-full flex justify-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden p-2">
          <img src={Step6Img} alt="Clinic Setup Page" className="w-full max-h-[500px] object-contain rounded-lg shadow-sm" />
        </div>
      </div>

      {/* Step 7 */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
        <h3 className="text-2xl font-semibold text-trust-harbor font-heading mb-4">7. Configure Your Clinic</h3>
        <div className="text-gray-700 font-body leading-relaxed space-y-4 mb-6">
          <p>Complete all required clinic information to properly configure your system profile.</p>
          <p>Examples of information you will need to provide include:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Clinic Name</li>
            <li>Address and Contact Details</li>
            <li>Operating Hours</li>
            <li>Services offered</li>
          </ul>
          <p>Please ensure you complete all required information accurately.</p>
        </div>
        <div className="mt-6 w-full flex justify-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden p-2">
          <img src={Step7Img} alt="Clinic Information Form" className="w-full max-h-[500px] object-contain rounded-lg shadow-sm" />
        </div>
      </div>

      {/* Step 8 */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
        <h3 className="text-2xl font-semibold text-trust-harbor font-heading mb-4">8. Save Clinic Configuration</h3>
        <div className="text-gray-700 font-body leading-relaxed space-y-4 mb-6">
          <p>Once all required information has been entered:</p>
          <ol className="list-decimal pl-6 space-y-2">
            <li>Review your details to ensure accuracy.</li>
            <li>Click <strong>Save Clinic Setup</strong>.</li>
          </ol>
          <p>The system validates the provided information and provisions your clinic in the database.</p>
        </div>
        <div className="mt-6 w-full flex justify-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden p-2">
          <img src={Step8Img} alt="Save Clinic Setup" className="w-full max-h-[500px] object-contain rounded-lg shadow-sm" />
        </div>
      </div>

      {/* Step 9 */}
      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8">
        <h3 className="text-2xl font-semibold text-trust-harbor font-heading mb-4">9. Welcome to Malasakit</h3>
        <div className="text-gray-700 font-body leading-relaxed space-y-4 mb-6">
          <p>Congratulations! After your clinic has been created successfully:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your Owner account is fully activated.</li>
            <li>The clinic workspace has been set up successfully.</li>
            <li>You are automatically logged into the system.</li>
            <li>The system redirects you to your new Owner Dashboard.</li>
          </ul>
          <p>This marks the completion of the onboarding process. You can now begin managing your clinic, inviting staff, and registering patients.</p>
        </div>
        <div className="mt-6 w-full flex justify-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden p-2">
          <img src={Step9Img} alt="Owner Dashboard" className="w-full max-h-[500px] object-contain rounded-lg shadow-sm" />
        </div>
      </div>
    </>
  );
};

export default Chapter2;
