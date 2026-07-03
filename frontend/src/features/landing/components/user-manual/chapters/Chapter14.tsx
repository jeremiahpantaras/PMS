import React from 'react';
import { DocCallout } from '../DocCallout';

const Chapter14: React.FC = () => {
  return (
    <>
      <p className="text-xl text-gray-500 font-body mb-8">
        Learn about patient cases in the Malasakit System.
      </p>

      <DocCallout type="info" title="Under Construction">
        This documentation chapter is currently being written. Below are the topics that will be covered in this section.
      </DocCallout>

      <div className="space-y-6">
        <h3 className="text-2xl font-semibold text-trust-harbor font-heading pt-6">Topics Covered</h3>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 font-body">
          <li>Timeline</li>
          <li>History</li>
          <li>Clinical Notes</li>
          <li>Invoices</li>
        </ul>
      </div>
    </>
  );
};

export default Chapter14;
