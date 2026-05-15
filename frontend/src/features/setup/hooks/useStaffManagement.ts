import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  toggleStaffStatus,
} from '../services/StaffService';
import type { StaffMember, CreateStaffData } from '../types/staff.types';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';

export const useStaffManagement = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-fetch whenever another admin changes a user's roles (WS-driven)
  const permissionsVersion = useAuthStore(s => s.permissionsVersion);

  // Invalidating ['practitioners'] causes Diary/Calendar to refetch with fresh
  // branch data whenever a staff member's branch or role is changed.
  const queryClient = useQueryClient();

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getStaff();
      // Include anyone with STAFF or PRACTITIONER in their roles array.
      // Admin-only users (no STAFF/PRACTITIONER role) are excluded.
      const filteredStaff = data.filter((member: StaffMember) => {
        const effectiveRoles = member.roles && member.roles.length > 0
          ? member.roles
          : [member.role];
        return effectiveRoles.includes('STAFF') || effectiveRoles.includes('PRACTITIONER');
      });
      setStaff(filteredStaff);
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Failed to load staff members';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + re-fetch on role changes pushed via WebSocket
  useEffect(() => {
    fetchStaff();
  }, [fetchStaff, permissionsVersion]);

  const handleCreateStaff = async (data: CreateStaffData) => {
    try {
      await createStaff(data);
      // Re-fetch the full list so the newly created member appears with all
      // computed fields (availability, clinic_branch_name, etc.) properly shaped.
      await fetchStaff();
      // Invalidate the practitioners cache so Diary/Calendar immediately pick up
      // the new practitioner without waiting for the 5-minute stale-time window.
      queryClient.invalidateQueries({ queryKey: ['practitioners'] });
      toast.success(`Staff member ${data.first_name} ${data.last_name} created successfully!`);
      toast.success('Login credentials have been sent to their email.', {
        duration: 5000,
        icon: '📧',
      });
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Failed to create staff member';
      toast.error(message);
      throw err;
    }
  };

  const handleUpdateStaff = async (id: number, data: Partial<CreateStaffData>) => {
    try {
      console.log('[useStaffManagement] handleUpdateStaff called', { id, data });
      const updated = await updateStaff(id, data);
      console.log('[useStaffManagement] Updated staff received:', updated);
      console.log('[useStaffManagement] Updated availability:', updated.availability);
      setStaff((prev) => prev.map((s) => (s.id === id ? updated : s)));
      // Invalidate practitioners so Diary/Calendar refetch with the updated
      // branch assignment — prevents stale branch scope in scheduling views.
      queryClient.invalidateQueries({ queryKey: ['practitioners'] });
      toast.success('Staff member updated successfully!');
      return updated;
    } catch (err: any) {
      console.error('[useStaffManagement] Update error:', err);
      console.error('[useStaffManagement] Error response:', err?.response?.data);
      const message = err.response?.data?.detail || 'Failed to update staff member';
      toast.error(message);
      throw err;
    }
  };

  const handleDeleteStaff = async (id: number) => {
    try {
      await deleteStaff(id);
      setStaff((prev) => prev.filter((s) => s.id !== id));
      queryClient.invalidateQueries({ queryKey: ['practitioners'] });
      toast.success('Staff member removed successfully!');
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Failed to remove staff member';
      toast.error(message);
      throw err;
    }
  };

  const handleToggleStatus = async (id: number, isActive: boolean) => {
    try {
      const updated = await toggleStaffStatus(id, isActive);
      setStaff((prev) => prev.map((s) => (s.id === id ? updated : s)));
      queryClient.invalidateQueries({ queryKey: ['practitioners'] });
      toast.success(`Staff member ${isActive ? 'activated' : 'deactivated'} successfully!`);
      return updated;
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Failed to update staff status';
      toast.error(message);
      throw err;
    }
  };

  return {
    staff,
    loading,
    error,
    createStaff: handleCreateStaff,
    updateStaff: handleUpdateStaff,
    deleteStaff: handleDeleteStaff,
    toggleStaffStatus: handleToggleStatus,
    refreshStaff: fetchStaff,
  };
};