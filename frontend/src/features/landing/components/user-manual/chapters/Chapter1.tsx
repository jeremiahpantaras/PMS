import React from 'react';
import { DocCallout } from '../DocCallout';

const Chapter1: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        An introduction to the Malasakit System and its core capabilities.
      </p>

      <DocCallout type="info" title="System Overview">
        Malasakit is a comprehensive, cloud-based Practice Management System designed specifically for Filipino Healthcare Providers. It streamlines clinic operations, appointment scheduling, patient records, and billing into one seamless platform.
      </DocCallout>

      <div className="space-y-6">
        <h3 className="text-2xl font-semibold text-trust-harbor font-heading">Purpose</h3>
        <p className="text-gray-700 font-body leading-relaxed">
          The primary purpose of Malasakit is to empower healthcare providers by reducing administrative burden. By automating routine tasks like scheduling, billing, and patient record management, practitioners can focus more on delivering quality care.
        </p>

        <h3 className="text-2xl font-semibold text-trust-harbor font-heading pt-6">User Roles</h3>
        <p className="text-gray-700 font-body leading-relaxed mb-4">
          The system supports multiple roles, each tailored to specific responsibilities within the clinic:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
          <li><strong>Owner:</strong> Full administrative access, including billing and system settings.</li>
          <li><strong>Manager:</strong> Operational oversight, managing staff and daily schedules.</li>
          <li><strong>Practitioner:</strong> Access to patient clinical records and personal appointment calendar.</li>
          <li><strong>Front Desk:</strong> Manages patient registration and daily bookings.</li>
        </ul>

        <h3 className="text-2xl font-semibold text-trust-harbor font-heading pt-6">Supported Platforms</h3>
        <p className="text-gray-700 font-body leading-relaxed">
          Malasakit is a web-based application. It is accessible from any modern web browser (Google Chrome, Safari, Mozilla Firefox, Microsoft Edge) on desktops, laptops, tablets, and smartphones. No installation is required.
        </p>
      </div>
    </>
  );
};

export default Chapter1;
