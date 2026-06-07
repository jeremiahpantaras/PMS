import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import {
  useFloating,
  FloatingArrow,
  offset,
  flip,
  shift,
  arrow,
  autoUpdate,
} from '@floating-ui/react';
import { getPatients, createPatient } from '@/features/patients/patient.api';
import { PatientModal } from '@/features/patients/components/PatientModal';
import type { Patient, CreatePatientData } from '@/types';

interface PendingSlot {
  date: Date;
  time: string;
  hour: number;
  minutes: number;
  duration: number;
  practitionerId?: number | null;
}

interface SelectOptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNewAppointment: (patientId: number) => void;
  onSelectBlockAppointment: () => void;
  onSelectNote: () => void;
  pendingSlot?: PendingSlot | null;
  practitionerName?: string;
  anchorRect?: DOMRect;
}

type TabType = 'appointment' | 'event' | 'note';

const fmt12 = (hour: number, minutes: number): string => {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}:${String(minutes).padStart(2, '0')} ${ampm}`;
};

const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <span className="bg-amber-100 font-semibold">{text.slice(index, index + query.length)}</span>
      {text.slice(index + query.length)}
    </>
  );
};

export const SelectOptionModal: React.FC<SelectOptionModalProps> = ({
  isOpen,
  onClose,
  onSelectNewAppointment,
  onSelectBlockAppointment,
  onSelectNote,
  pendingSlot,
  practitionerName,
  anchorRect,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('appointment');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);

  const arrowRef = useRef<SVGSVGElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { refs, floatingStyles, context } = useFloating({
    placement: 'top',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(16),
      flip(),
      shift({ padding: 8 }),
      arrow({ element: arrowRef }),
    ],
  });

  useEffect(() => {
    if (isOpen) {
      setActiveTab('appointment');
      setFirstName('');
      setLastName('');
      setPatients([]);
      setSelectedPatient(null);
      setShowDropdown(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (anchorRect && isOpen) {
      refs.setReference({
        getBoundingClientRect: () => anchorRect,
      });
    }
  }, [anchorRect, isOpen, refs]);

  const searchPatients = useCallback(async (first: string, last: string) => {
    if (first.length < 2 && last.length < 2) {
      setPatients([]);
      setShowDropdown(false);
      return;
    }
    setLoadingPatients(true);
    try {
      const searchTerm = [first, last].filter(Boolean).join(' ');
      const response = await getPatients({ search: searchTerm, is_active: true, page_size: 50 });
      setPatients(response.results || []);
      setShowDropdown(true);
    } catch {
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchPatients(firstName, lastName);
    }, 200);
    return () => clearTimeout(timer);
  }, [firstName, lastName, searchPatients]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        firstNameRef.current &&
        !firstNameRef.current.contains(e.target as Node) &&
        lastNameRef.current &&
        !lastNameRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setFirstName(patient.first_name);
    setLastName(patient.last_name);
    setShowDropdown(false);
  };

  const handleCreateAppointment = () => {
    if (selectedPatient) {
      onSelectNewAppointment(selectedPatient.id);
    }
  };

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'event') {
      onSelectBlockAppointment();
    } else if (tab === 'note') {
      onSelectNote();
    }
  };

  const handleAddNewClient = async (data: CreatePatientData): Promise<void> => {
    try {
      const newPatient = await createPatient(data);
      setSelectedPatient(newPatient);
      setFirstName(newPatient.first_name);
      setLastName(newPatient.last_name);
      setShowPatientModal(false);
      setShowDropdown(false);
    } catch {
      throw new Error('Failed to create patient');
    }
  };

  const formatDOB = (dob: string): string => {
    try {
      return format(new Date(dob), 'MMM d, yyyy');
    } catch {
      return dob;
    }
  };

  if (!isOpen) return null;

  const displayTime = pendingSlot ? fmt12(pendingSlot.hour, pendingSlot.minutes) : '';

  const popoverContent = (
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      className="z-[1000] w-[360px] bg-white rounded-[18px] border border-gray-200 shadow-[0_12px_32px_rgba(0,0,0,.12)] overflow-visible"
    >
      <FloatingArrow
        ref={arrowRef}
        context={context}
        fill="white"
        stroke="#E5E7EB"
        strokeWidth={1}
        className="w-6 h-4"
      />

      <div className="px-4 pt-3 pb-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-4">
            {(['appointment', 'event', 'note'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabClick(tab)}
                className={`text-sm font-medium pb-1.5 transition-colors relative ${
                  activeTab === tab
                    ? 'text-sky-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label="Close"
          >
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
          <span className="text-xs font-medium text-gray-600">
            {practitionerName || 'No practitioner'}
          </span>
          <span className="text-xs text-gray-400">
            {displayTime}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-3 relative">
          <div className="flex gap-2 mb-1.5">
            <input
              ref={firstNameRef}
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setSelectedPatient(null);
              }}
              onFocus={() => {
                if (patients.length > 0) setShowDropdown(true);
              }}
              placeholder="First Name"
              className="w-full px-3 py-2 text-xs border-2 border-gray-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
            />
            <input
              ref={lastNameRef}
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setSelectedPatient(null);
              }}
              onFocus={() => {
                if (patients.length > 0) setShowDropdown(true);
              }}
              placeholder="Last Name"
              className="w-full px-3 py-2 text-xs border-2 border-gray-300 rounded-lg focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
/>
          </div>
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 z-[1100] mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
            >
              {loadingPatients ? (
                <div className="px-3 py-2 text-xs text-gray-500 text-center">Searching...</div>
              ) : patients.length > 0 ? (
                <>
                  {patients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <div className="text-xs font-medium text-gray-900">
                        {highlightMatch(patient.full_name, firstName) || highlightMatch(patient.full_name, lastName)}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        DOB: {formatDOB(patient.date_of_birth)}
                      </div>
                    </button>
                  ))}
                </>
              ) : (
                <div className="px-3 py-3 text-center">
                  <p className="text-xs text-gray-400 mb-1.5">No matching clients found.</p>
                  <button
                    onClick={() => setShowPatientModal(true)}
                    className="text-xs text-sky-500 font-medium hover:text-sky-600"
                  >
                    + Add New Client
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleCreateAppointment}
          disabled={!selectedPatient}
          className={`w-full py-2 rounded-lg text-xs font-medium transition-colors ${
            selectedPatient
              ? 'bg-sky-500 text-white hover:bg-sky-600'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Create Appointment
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div
        className="fixed inset-0 z-[999]"
        onClick={onClose}
      />
      {createPortal(popoverContent, document.body)}

      <PatientModal
        isOpen={showPatientModal}
        onClose={() => setShowPatientModal(false)}
        onSave={handleAddNewClient}
        mode="create"
        prefillData={{ first_name: firstName, last_name: lastName }}
      />
    </>
  );
};