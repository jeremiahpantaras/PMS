import React, { useState, useMemo } from 'react';
import { X, Calendar, Clock, FileText, Users, Globe, User } from 'lucide-react';
import { format } from 'date-fns';
import { createBlockAppointment } from '../appointment.api';
import { useClinicBranches } from '@/features/clinics/hooks/useClinicBranches';
import { useBlockConflictDetection } from '../hooks/useBlockConflictDetection';
import { useClinicUsers } from '../hooks/useClinicUsers';
import { ConflictModal } from './ConflictModal';
import { UserSelector } from './UserSelector';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';
import type { BlockAppointment, Appointment, CreateBlockAppointmentData } from '@/types';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (event: BlockAppointment) => void;
  selectedClinicBranchId?: number | null;
  initialDate?: Date;
  initialTime?: string;
  initialEndTime?: string;
  appointments?: Appointment[];
  /** Practitioner this block is scoped to. Comes from the column the user clicked/dragged in. */
  practitionerId?: number | null;
}

interface FormData {
  event_name: string;
  date: string;
  start_time: string;
  end_time: string;
  notes: string;
  visibility_type: 'ALL' | 'SELECTED' | 'SELF';
  visible_to_user_ids: number[];
}

export const AddEventModal: React.FC<AddEventModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  selectedClinicBranchId,
  initialDate,
  initialTime,
  initialEndTime,
  appointments = [],
  practitionerId = null,
}) => {
  const { user: currentUser } = useAuthStore();
  const { branches } = useClinicBranches();
  const { users, loading: loadingUsers } = useClinicUsers(selectedClinicBranchId);
  
  // Filter out current user from selection
  const filteredUsers = useMemo(() => {
    return users.filter(user => user.id !== currentUser?.id);
  }, [users, currentUser?.id]);
  
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Conflict detection
  const { getFirstConflict } = useBlockConflictDetection(appointments);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictingAppointment, setConflictingAppointment] = useState<{
    appointment: Appointment;
    blockStartTime: string;
    blockEndTime: string;
  } | null>(null);
  const [pendingBlockData, setPendingBlockData] = useState<{
    clinicId: number;
    event_name: string;
    date: string;
    start_time: string;
    end_time: string;
    notes: string;
    visibility_type: 'ALL' | 'SELECTED' | 'SELF';
    visible_to_user_ids: number[];
  } | null>(null);

  const getInitialFormData = (): FormData => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const startTime = initialTime || '09:00';
    const endTime = initialEndTime || (initialTime ? calculateEndTime(initialTime, 60) : '10:00');

    return {
      event_name: '',
      date: initialDate ? format(initialDate, 'yyyy-MM-dd') : today,
      start_time: startTime,
      end_time: endTime,
      notes: '',
      visibility_type: 'ALL',
      visible_to_user_ids: [],
    };
  };

  const [formData, setFormData] = useState<FormData>(getInitialFormData);

  // Reset form when modal opens with new initial values
  React.useEffect(() => {
    if (isOpen) {
      const startTime = initialTime || '09:00';
      const endTime   = initialEndTime || (initialTime ? calculateEndTime(initialTime, 60) : '10:00');
      setFormData({
        event_name: '',
        date:       initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        start_time: startTime,
        end_time:   endTime,
        notes:      '',
        visibility_type: 'ALL',
        visible_to_user_ids: [],
      });
      setErrors({});
      setShowConflictModal(false);
      setConflictingAppointment(null);
      setPendingBlockData(null);
    }
  }, [isOpen, initialDate, initialTime, initialEndTime]);

  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.event_name.trim()) {
      newErrors.event_name = 'Event name is required';
    }
    if (!formData.date) {
      newErrors.date = 'Date is required';
    }
    if (!formData.start_time) {
      newErrors.start_time = 'Start time is required';
    }
    if (!formData.end_time) {
      newErrors.end_time = 'End time is required';
    }
    // Validate end time is after start time
    if (formData.start_time && formData.end_time) {
      if (formData.end_time <= formData.start_time) {
        newErrors.end_time = 'End time must be after start time';
      }
    }
    // Validate visibility
    if (formData.visibility_type === 'SELECTED' && formData.visible_to_user_ids.length === 0) {
      newErrors.visible_to_user_ids = 'Select at least one user';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // Check for conflicts with existing appointments
    const conflict = getFirstConflict({
      date: formData.date,
      start_time: formData.start_time,
      end_time: formData.end_time,
    });

    if (conflict) {
      // Store pending data and show conflict modal
      setPendingBlockData({
        clinicId: selectedClinicBranchId || branches[0]?.id || 0,
        event_name: formData.event_name,
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        notes: formData.notes,
        visibility_type: formData.visibility_type,
        visible_to_user_ids: formData.visible_to_user_ids,
      });
      setConflictingAppointment(conflict);
      setShowConflictModal(true);
      return;
    }

    // No conflict, proceed with creation
    await createBlockEvent();
  };

  const createBlockEvent = async () => {
    if (!pendingBlockData && !formData.event_name) return;
    
    setSaving(true);
    try {
      // Determine which clinic to use
      const clinicId = selectedClinicBranchId || branches[0]?.id;
      if (!clinicId) {
        toast.error('No clinic branch available');
        setSaving(false);
        return;
      }

      const blockData = pendingBlockData || {
        clinicId,
        event_name: formData.event_name,
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        notes: formData.notes,
        visibility_type: formData.visibility_type,
        visible_to_user_ids: formData.visible_to_user_ids,
      };

      const payload: CreateBlockAppointmentData = {
        clinic: blockData.clinicId,
        event_name: blockData.event_name,
        date: blockData.date,
        start_time: blockData.start_time,
        end_time: blockData.end_time,
        notes: blockData.notes,
        visibility_type: blockData.visibility_type,
        // Scope to the practitioner whose column was clicked (null = clinic-wide)
        practitioner: practitionerId ?? null,
      };

      // Only include visible_to_user_ids if visibility_type is SELECTED
      if (blockData.visibility_type === 'SELECTED') {
        payload.visible_to_user_ids = blockData.visible_to_user_ids;
      }

      const created = await createBlockAppointment(payload);

      toast.success('Event created successfully');
      onCreated?.(created);
      onClose();
      setPendingBlockData(null);
    } catch (err: unknown) {
      console.error('Failed to create event:', err);
      const msg = err && typeof err === 'object' && 'response' in err 
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail 
        : 'Failed to create event';
      toast.error(msg ?? 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Add Event</h2>
            <p className="text-sm text-gray-500">Block a time slot in the calendar</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* LEFT COLUMN - Event Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4" />
                Event Details
              </h3>

              {/* Event Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.event_name}
                  onChange={(e) => handleChange('event_name', e.target.value)}
                  placeholder="e.g., Staff Meeting, Clinic Holiday"
                  className={`
                    w-full px-4 py-2.5 rounded-lg border transition-colors
                    focus:ring-2 focus:ring-offset-1 focus:outline-none
                    ${errors.event_name 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                      : 'border-gray-300 focus:border-sky-500 focus:ring-sky-200'
                    }
                  `}
                />
                {errors.event_name && (
                  <p className="mt-1 text-xs text-red-500">{errors.event_name}</p>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleChange('date', e.target.value)}
                  className={`
                    w-full px-4 py-2.5 rounded-lg border transition-colors
                    focus:ring-2 focus:ring-offset-1 focus:outline-none
                    ${errors.date 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                      : 'border-gray-300 focus:border-sky-500 focus:ring-sky-200'
                    }
                  `}
                />
                {errors.date && (
                  <p className="mt-1 text-xs text-red-500">{errors.date}</p>
                )}
              </div>

              {/* Time Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Start Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => handleChange('start_time', e.target.value)}
                    className={`
                      w-full px-4 py-2.5 rounded-lg border transition-colors
                      focus:ring-2 focus:ring-offset-1 focus:outline-none
                      ${errors.start_time 
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                        : 'border-gray-300 focus:border-sky-500 focus:ring-sky-200'
                      }
                    `}
                  />
                  {errors.start_time && (
                    <p className="mt-1 text-xs text-red-500">{errors.start_time}</p>
                  )}
                </div>

                {/* End Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => handleChange('end_time', e.target.value)}
                    className={`
                      w-full px-4 py-2.5 rounded-lg border transition-colors
                      focus:ring-2 focus:ring-offset-1 focus:outline-none
                      ${errors.end_time 
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                        : 'border-gray-300 focus:border-sky-500 focus:ring-sky-200'
                      }
                    `}
                  />
                  {errors.end_time && (
                    <p className="mt-1 text-xs text-red-500">{errors.end_time}</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Add any additional details about this event..."
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:ring-offset-1 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* RIGHT COLUMN - User Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
                <Users className="w-4 h-4" />
                User Selection
              </h3>

              {/* Visibility Controls */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Who can see this event?
                </label>

                {/* Visibility Type Radio Buttons */}
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 rounded-lg border-2 border-gray-200 cursor-pointer hover:border-sky-200 hover:bg-sky-50 transition-colors">
                    <input
                      type="radio"
                      name="visibility_type"
                      value="ALL"
                      checked={formData.visibility_type === 'ALL'}
                      onChange={() => {
                        setFormData(prev => ({ ...prev, visibility_type: 'ALL' as const }));
                        if (errors.visible_to_user_ids) {
                          setErrors(prev => ({ ...prev, visible_to_user_ids: '' }));
                        }
                      }}
                      className="mt-0.5 w-4 h-4 text-sky-600 border-gray-300 focus:ring-sky-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">All Users</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Everyone in the clinic can see this block event
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg border-2 border-gray-200 cursor-pointer hover:border-amber-200 hover:bg-amber-50 transition-colors">
                    <input
                      type="radio"
                      name="visibility_type"
                      value="SELECTED"
                      checked={formData.visibility_type === 'SELECTED'}
                      onChange={() => {
                        setFormData(prev => ({ ...prev, visibility_type: 'SELECTED' as const }));
                      }}
                      className="mt-0.5 w-4 h-4 text-amber-600 border-gray-300 focus:ring-amber-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">Selected Users</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Only specific users can see this block event
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg border-2 border-gray-200 cursor-pointer hover:border-purple-200 hover:bg-purple-50 transition-colors">
                    <input
                      type="radio"
                      name="visibility_type"
                      value="SELF"
                      checked={formData.visibility_type === 'SELF'}
                      onChange={() => {
                        setFormData(prev => ({ 
                          ...prev, 
                          visibility_type: 'SELF' as const,
                          visible_to_user_ids: [] // Clear selected users
                        }));
                        if (errors.visible_to_user_ids) {
                          setErrors(prev => ({ ...prev, visible_to_user_ids: '' }));
                        }
                      }}
                      className="mt-0.5 w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">Myself Only</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Only you can see this block event (private)
                      </p>
                    </div>
                  </label>
                </div>

                {/* User Selection - Show only when SELECTED is chosen */}
                {formData.visibility_type === 'SELECTED' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Select Users <span className="text-red-500">*</span>
                    </label>
                    <div className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                      You are auto-included as the event creator.
                    </div>
                    <UserSelector
                      users={filteredUsers}
                      selectedUserIds={formData.visible_to_user_ids}
                      onSelectionChange={(ids) => {
                        setFormData(prev => ({ ...prev, visible_to_user_ids: ids }));
                        if (errors.visible_to_user_ids) {
                          setErrors(prev => ({ ...prev, visible_to_user_ids: '' }));
                        }
                      }}
                      disabled={loadingUsers}
                      error={errors.visible_to_user_ids}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-sky-500 rounded-lg hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Conflict Modal */}
      <ConflictModal
        isOpen={showConflictModal}
        conflictingAppointment={conflictingAppointment}
        onBlockExisting={async () => {
          // Proceed with creating block despite conflict
          setShowConflictModal(false);
          await createBlockEvent();
        }}
        onRescheduleExisting={() => {
          // Cancel block creation, prompt user to reschedule existing appointment
          setShowConflictModal(false);
          setConflictingAppointment(null);
          setPendingBlockData(null);
          toast('Please drag the existing appointment to a new time before creating the block appointment.', {
            icon: '📅',
            duration: 5000,
          });
        }}
        onCancel={() => {
          // Cancel block creation
          setShowConflictModal(false);
          setConflictingAppointment(null);
          setPendingBlockData(null);
        }}
      />
    </div>
  );
};