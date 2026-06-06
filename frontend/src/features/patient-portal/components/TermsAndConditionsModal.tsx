import React from 'react';
import { X } from 'lucide-react';

interface TermsAndConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsAndConditionsModal: React.FC<TermsAndConditionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Terms & Conditions</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close terms modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4 text-sm text-gray-700 leading-relaxed">
          <p>
            By booking an appointment through this portal, you confirm that the information provided is accurate and complete.
            You agree to attend your appointment on time and provide reasonable notice for cancellations or rescheduling.
          </p>

          <p>
            The clinic may update schedules, practitioner assignments, or service availability when necessary.
            In such cases, the clinic will make reasonable efforts to notify you through the contact details you provided.
          </p>

          <p>
            Medical advice, diagnosis, and treatment recommendations are provided by licensed practitioners based on available clinical data.
            Outcomes may vary across individuals, and no guarantees are implied regarding treatment results.
          </p>

          <p>
            You understand that urgent medical concerns should be directed to emergency services or the nearest hospital,
            and not solely through this online booking system.
          </p>

          <p>
            Continued use of this portal and completion of a booking constitute acceptance of these terms and applicable clinic policies.
          </p>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary px-4 py-2 text-sm font-medium rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
