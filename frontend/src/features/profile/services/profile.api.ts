import axiosInstance from '@/lib/axios';
import type { User } from '@/types/auth';

export interface UpdateProfileData {
  first_name?: string;
  last_name?:  string;
  phone?:      string;
  avatar?:    File;  // Optional avatar file for combined update
  remove_avatar?: boolean;  // Flag to remove avatar
}

export type PasswordRotation = 'none' | 'weekly' | 'monthly' | 'yearly';

export interface ResetPasswordData {
  refresh_token?: string;
}

export interface UpdatePasswordData {
  type:      'auto' | 'manual';
  password?: string;           // required when type === 'manual'
  rotation:  PasswordRotation;
}

export interface UpdatePasswordResponse {
  detail:     string;
  email_sent: boolean;
  rotation:   PasswordRotation;
}

export interface ResetPasswordResponse {
  detail:     string;
  email_sent: boolean;
}

/** Get current authenticated user's profile */
export const getMyProfile = async (): Promise<User> => {
  const response = await axiosInstance.get<User>('/auth/me/');
  return response.data;
};

/** Update profile fields (PATCH) — optionally with avatar */
export const updateMyProfile = async (data: UpdateProfileData): Promise<User> => {
  // If avatar is included or remove_avatar, use FormData
  if (data.avatar || data.remove_avatar) {
    console.log('[profile.api] updateMyProfile with avatar:', data.avatar?.name, 'remove:', data.remove_avatar);
    const formData = new FormData();
    if (data.first_name) formData.append('first_name', data.first_name);
    if (data.last_name) formData.append('last_name', data.last_name);
    if (data.phone) formData.append('phone', data.phone);
    if (data.avatar) formData.append('avatar', data.avatar);
    if (data.remove_avatar) formData.append('remove_avatar', 'true');
    const response = await axiosInstance.patch<User>('/users/me/', formData);
    return response.data;
  }
  // No avatar - use JSON
  console.log('[profile.api] updateMyProfile JSON only');
  const response = await axiosInstance.patch<User>('/users/me/', data, {
    headers: { 'Content-Type': 'application/json' },
  });
  return response.data;
};

/** Upload avatar — multipart/form-data */
export const uploadAvatar = async (file: File): Promise<User> => {
  const formData = new FormData();
  formData.append('avatar', file);
  const response = await axiosInstance.patch<User>('/users/me/', formData);
  // Let axios set Content-Type with boundary automatically — do NOT set manually
  return response.data;
};

/** Remove avatar — JSON signal to backend */
export const removeAvatar = async (): Promise<User> => {
  const response = await axiosInstance.patch<User>(
    '/users/me/',
    { remove_avatar: true },
    { headers: { 'Content-Type': 'application/json' } }
  );
  return response.data;
};

/** Reset password — sends new temp password to user's email, forces logout */
export const resetPassword = async (
  data: ResetPasswordData
): Promise<ResetPasswordResponse> => {
  const response = await axiosInstance.post<ResetPasswordResponse>(
    '/auth/reset-password/',
    data
  );
  return response.data;
};

/** Account-settings password update — auto-generate or manual, with rotation */
export const updatePassword = async (
  data: UpdatePasswordData
): Promise<UpdatePasswordResponse> => {
  const response = await axiosInstance.post<UpdatePasswordResponse>(
    '/auth/update-password/',
    data
  );
  return response.data;
};