import React from 'react';
import { X, User, Phone, MapPin, Heart, Calendar, Edit, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Patient } from '@/types';

interface PatientDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onEdit: () => void;
}

export const PatientDetailsModal: React.FC<PatientDetailsModalProps> = ({
  isOpen,
  onClose,
  patient,
  onEdit,
}) => {
  const navigate = useNavigate();

  if (!isOpen || !patient) return null;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const getGenderLabel = (gender: string) =>
    ({ M: 'Male', F: 'Female', O: 'Other' }[gender] ?? gender);

  const handleViewFullDetails = () => {
    onClose();
    navigate(`/patients/${patient.id}/profile`);
  };

  const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
    </div>
  );

  const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sky-600">{icon}</span>
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] pointer-events-auto overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-12 h-12 bg-sky-600 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0">
                  {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900">{patient.full_name}</h2>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                      patient.is_active
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}>
                      {patient.is_active ? '● Active' : '● Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ID: <span className="font-mono font-medium text-gray-700">{patient.patient_number}</span>
                    <span className="mx-1.5 text-gray-300">·</span>
                    {getGenderLabel(patient.gender)}
                    <span className="mx-1.5 text-gray-300">·</span>
                    {patient.age} years old
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Close modal">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Personal Information */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <SectionHeader icon={<User className="w-4 h-4" />} title="Personal Information" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                <InfoRow label="Full Name" value={patient.full_name} />
                <InfoRow label="Date of Birth" value={`${formatDate(patient.date_of_birth)} (${patient.age} yrs)`} />
                <InfoRow label="Gender" value={getGenderLabel(patient.gender)} />
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <SectionHeader icon={<MapPin className="w-4 h-4" />} title="Contact Information" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                <InfoRow label="Email" value={patient.email || '—'} />
                <InfoRow label="Phone" value={patient.phone} />
                <InfoRow label="City" value={patient.city} />
                <InfoRow label="Province" value={patient.province} />
                <InfoRow label="Postal Code" value={patient.postal_code || '—'} />
                <div className="col-span-2 md:col-span-3">
                  <InfoRow label="Address" value={patient.address} />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <SectionHeader icon={<Phone className="w-4 h-4" />} title="Emergency Contact" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                <InfoRow label="Name" value={patient.emergency_contact_name} />
                <InfoRow label="Phone" value={patient.emergency_contact_phone} />
                <InfoRow label="Relationship" value={patient.emergency_contact_relationship} />
              </div>
            </div>

            {/* Medical Information */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <SectionHeader icon={<Heart className="w-4 h-4" />} title="Medical Information" />
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 pb-3 border-b border-gray-100">
                  <InfoRow label="PhilHealth #" value={patient.philhealth_number || '—'} />
                  <InfoRow label="HMO Provider" value={patient.hmo_provider || '—'} />
                  <InfoRow label="HMO #" value={patient.hmo_number || '—'} />
                </div>
                <InfoRow label="Medical Conditions" value={patient.medical_conditions || 'None reported'} />
                <InfoRow label="Allergies"           value={patient.allergies || 'None reported'} />
                <InfoRow label="Current Medications" value={patient.medications || 'None reported'} />
              </div>
            </div>

            {/* Timestamps */}
            <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-100 pt-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Created: {formatDate(patient.created_at)}
              </span>
              <span>Last Updated: {formatDate(patient.updated_at)}</span>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
            <button
              onClick={handleViewFullDetails}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Full Profile & History
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit Client
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};