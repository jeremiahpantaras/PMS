import { axiosInstance } from '@/lib/axios';

export type AccessLevel = 'none' | 'view' | 'edit';
export type RoleTemplate = 'OWNER' | 'MANAGER' | 'FRONTDESK' | 'PRACTITIONER' | 'CUSTOM';

export interface FeaturePermissionRecord {
  id:           number;
  feature_key:  string;
  access_level: AccessLevel;
}

export interface PermissionGroup {
  id:                 number;
  name:               string;
  description:        string;
  role_template:      RoleTemplate;
  is_protected:       boolean;
  is_system_template: boolean;
  clinic:             number;
  feature_permissions: FeaturePermissionRecord[];
  permissions_map:    Record<string, AccessLevel>;
  member_count:       number;
  created_at:         string;
  updated_at:         string;
}

export interface FeatureKeyMeta {
  key:   string;
  label: string;
}

export interface CreatePermissionGroupData {
  name:          string;
  description?:  string;
  role_template: RoleTemplate;
  is_protected?: boolean;
  permissions:   Record<string, AccessLevel>;
}

export interface UpdatePermissionGroupData {
  name?:         string;
  description?:  string;
  role_template?: RoleTemplate;
  is_protected?:  boolean;
  permissions?:   Record<string, AccessLevel>;
}

/** List all permission groups for the current admin's clinic. */
export const listPermissionGroups = async (): Promise<PermissionGroup[]> => {
  const response = await axiosInstance.get<{ results: PermissionGroup[] } | PermissionGroup[]>(
    '/permission-groups/'
  );
  // Handle both paginated and non-paginated responses
  const data = response.data;
  return Array.isArray(data) ? data : (data.results ?? []);
};

/** Get a single permission group by ID. */
export const getPermissionGroup = async (id: number): Promise<PermissionGroup> => {
  const response = await axiosInstance.get<PermissionGroup>(`/permission-groups/${id}/`);
  return response.data;
};

/** Create a new permission group. */
export const createPermissionGroup = async (
  data: CreatePermissionGroupData
): Promise<PermissionGroup> => {
  const response = await axiosInstance.post<PermissionGroup>('/permission-groups/', data);
  return response.data;
};

/** Update an existing permission group. */
export const updatePermissionGroup = async (
  id: number,
  data: UpdatePermissionGroupData
): Promise<PermissionGroup> => {
  const response = await axiosInstance.patch<PermissionGroup>(`/permission-groups/${id}/`, data);
  return response.data;
};

/** Delete a permission group (must not be protected). */
export const deletePermissionGroup = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/permission-groups/${id}/`);
};

/** Duplicate a permission group with a new name. */
export const duplicatePermissionGroup = async (
  id: number,
  name: string,
  description?: string
): Promise<PermissionGroup> => {
  const response = await axiosInstance.post<PermissionGroup>(
    `/permission-groups/${id}/duplicate/`,
    { name, description }
  );
  return response.data;
};

/** Assign a user to a permission group. */
export const assignUserToGroup = async (
  groupId: number,
  userId: number
): Promise<void> => {
  await axiosInstance.post(`/permission-groups/${groupId}/assign-user/`, { user_id: userId });
};

/** Fetch all valid feature keys with their display labels. */
export const getFeatureKeys = async (): Promise<FeatureKeyMeta[]> => {
  const response = await axiosInstance.get<FeatureKeyMeta[]>(
    '/permission-groups/feature-keys/'
  );
  return response.data;
};
