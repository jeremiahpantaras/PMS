import React from 'react';
import { DocCallout } from '../DocCallout';

const Chapter29: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn about patient reports in the Malasakit System.
      </p>

      <DocCallout type="info" title="Under Construction">
        This documentation chapter is currently being written. Below are the topics that will be covered in this section.
      </DocCallout>

      <div className="space-y-6">
        <h3 className="text-2xl font-semibold text-trust-harbor font-heading pt-6">Topics Covered</h3>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
          <li>New Patients</li>
          <li>Returning Patients</li>
          <li>Visits</li>
          <li>Retention</li>
        </ul>
      </div>
    </>
  );
};

export default Chapter29;
