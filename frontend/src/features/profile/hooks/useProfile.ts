import { useState, useCallback } from 'react';
import {
  getMyProfile,
  updateMyProfile,
  resetPassword,
  updatePassword,
  type UpdateProfileData,
  type PasswordRotation,
} from '../services/profile.api';
import type { User } from '@/types/auth';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

export const useProfile = (initialUser: User | null) => {
  const [user,              setUser]              = useState<User | null>(initialUser);
  const [isSaving,          setIsSaving]          = useState(false);
  const [isResettingPw,     setIsResettingPw]     = useState(false);
  const [isUpdatingPw,      setIsUpdatingPw]      = useState(false);
  const [pendingAvatar,     setPendingAvatar]    = useState<File | null>(null);  // Avatar to be saved with profile
  const [avatarToRemove,    setAvatarToRemove]   = useState(false);  // Flag to remove avatar

  /* ── helper: persist user everywhere ── */
  const syncUser = useCallback((updated: User) => {
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
    // auth.store exposes updateUser, not setUser
    useAuthStore.getState().updateUser(updated);
  }, []);

  /* ── Refresh from server ── */
  const refresh = useCallback(async () => {
    try {
      const fresh = await getMyProfile();
      syncUser(fresh);
    } catch {
      toast.error('Failed to refresh profile');
    }
  }, [syncUser]);

  /* ── Update profile info (includes avatar if pending) ── */
  const saveProfile = useCallback(async (data: UpdateProfileData) => {
    setIsSaving(true);
    try {
      // Check if there's a pending avatar or avatar removal
      let dataToSend = { ...data };
      
      if (pendingAvatar) {
        dataToSend.avatar = pendingAvatar;
      }
      
      if (avatarToRemove) {
        dataToSend = { ...dataToSend, remove_avatar: true };
      }
      
      const updated = await updateMyProfile(dataToSend);
      
      // Clear pending avatar state after successful save
      setPendingAvatar(null);
      setAvatarToRemove(false);
      
      syncUser(updated);
      toast.success('Profile updated successfully');
      return true;
    } catch (err: unknown) {
      const error = err as { response?: { data?: unknown } };
      const msg =
        error?.response?.data instanceof Object
          ? Object.values(error?.response?.data ?? {})?.[0]
          : 'Failed to update profile';
      console.error('saveProfile error:', error?.response?.data ?? err);
      toast.error(String(msg));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [syncUser, pendingAvatar, avatarToRemove]);

  /* ── Store avatar for later save ── */
  const saveAvatar = useCallback(async (file: File) => {
    // Store the file to be saved when profile is saved
    console.log('[useProfile] saveAvatar called with:', file.name, file.size);
    setPendingAvatar(file);
    return true;
  }, []);

  /* ── Store avatar removal for later save ── */
  const deleteAvatar = useCallback(async () => {
    // Store the removal flag to be processed when profile is saved
    setAvatarToRemove(true);
    setPendingAvatar(null);  // Clear any pending upload
    return true;
  }, []);

  /* ── Clear pending avatar changes (when cancel is clicked) ── */
  const clearPendingAvatar = useCallback(() => {
    setPendingAvatar(null);
    setAvatarToRemove(false);
  }, []);

  /* ── Reset password ── */
  const doResetPassword = useCallback(async (): Promise<boolean> => {
    setIsResettingPw(true);
    try {
      const refreshToken = localStorage.getItem('refresh_token') ?? undefined;
      const res = await resetPassword({ refresh_token: refreshToken });

      if (res.email_sent) {
        toast.success(
          'New password sent to your email. You will be logged out.',
          { duration: 4000 }
        );
      } else {
        toast.error(res.detail);
        return false;
      }

      setTimeout(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        localStorage.removeItem('auth-storage');
        window.location.href = '/login';
      }, 2500);

      return true;
    } catch (err: unknown) {
      const error = err as { response?: { data?: unknown } };
      console.error('doResetPassword error:', error?.response?.data ?? err);
      const msg = error?.response?.data instanceof Object
        ? (error?.response?.data as { detail?: string })?.detail
        : 'Password reset failed';
      toast.error(msg || 'Password reset failed');
      return false;
    } finally {
      setIsResettingPw(false);
    }
  }, []);

  /* ── Account-settings password update (auto or manual + rotation) ── */
  const doUpdatePassword = useCallback(async (
    type: 'auto' | 'manual',
    password: string | undefined,
    rotation: PasswordRotation,
  ): Promise<boolean> => {
    setIsUpdatingPw(true);
    try {
      await updatePassword({ type, password, rotation });
      if (type === 'auto') {
        toast.success('New password sent to your email. You will be logged out.', { duration: 4000 });
        // Auto logout after 5 seconds — user must re-login with new temp password
        setTimeout(() => {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          localStorage.removeItem('auth-storage');
          window.location.href = '/login';
        }, 5000);
      } else {
        toast.success('Password updated successfully.');
        await refresh();
      }
      return true;
    } catch (err: unknown) {
      const error = err as { response?: { data?: unknown } };
      const msg = error?.response?.data instanceof Object
        ? (error?.response?.data as { detail?: string })?.detail
        : 'Password update failed';
      toast.error(msg || 'Password update failed');
      return false;
    } finally {
      setIsUpdatingPw(false);
    }
  }, [refresh]);

  return {
    user,
    isSaving,
    isResettingPw,
    isUpdatingPw,
    refresh,
    syncUser,
    saveProfile,
    saveAvatar,
    deleteAvatar,
    clearPendingAvatar,  // Expose for cancel button
    doResetPassword,
    doUpdatePassword,
  };
};