import { useState, useEffect } from 'react';
import { axiosInstance } from '@/lib/axios';

export interface ClinicUser {
  id: number;          // The actual user ID from the backend
  name: string;
  email: string;
  role: 'ADMIN' | 'PRACTITIONER' | 'STAFF';
  avatar?: string | null;  // Avatar URL
}

interface BackendUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: 'ADMIN' | 'PRACTITIONER' | 'STAFF';
  avatar?: string | null;
}

interface UserListResponse {
  results?: BackendUser[];
  count?: number;
  // Direct array response (if pagination is disabled)
  [key: number]: BackendUser;
  length?: number;
}

let cachedClinicUsers: ClinicUser[] | null = null;
let usersRequestInFlight: Promise<ClinicUser[]> | null = null;

const mapAndSortUsers = (userList: BackendUser[]): ClinicUser[] => {
  const mappedUsers: ClinicUser[] = userList.map((user: BackendUser) => ({
    id: user.id,
    name: `${user.first_name} ${user.last_name}`.trim() || user.email,
    email: user.email,
    role: user.role,
    avatar: user.avatar || null,
  }));

  const roleOrder = { ADMIN: 1, PRACTITIONER: 2, STAFF: 3 };
  mappedUsers.sort((a, b) => {
    const roleCompare = roleOrder[a.role] - roleOrder[b.role];
    if (roleCompare !== 0) return roleCompare;
    return a.name.localeCompare(b.name);
  });

  return mappedUsers;
};

const fetchClinicUsers = async (): Promise<ClinicUser[]> => {
  if (cachedClinicUsers) return cachedClinicUsers;
  if (usersRequestInFlight) return usersRequestInFlight;

  usersRequestInFlight = (async () => {
    const response = await axiosInstance.get<UserListResponse | BackendUser[]>('/users/');

    let userList: BackendUser[] = [];
    if (Array.isArray(response.data)) {
      userList = response.data;
    } else if (response.data && 'results' in response.data && Array.isArray(response.data.results)) {
      userList = response.data.results;
    } else {
      throw new Error('Unexpected response format from /users/ endpoint');
    }

    const users = mapAndSortUsers(userList);
    cachedClinicUsers = users;
    return users;
  })();

  try {
    return await usersRequestInFlight;
  } finally {
    usersRequestInFlight = null;
  }
};

export const resetClinicUsersCache = () => {
  cachedClinicUsers = null;
  usersRequestInFlight = null;
};

/**
 * Hook to fetch all clinic users (admin + practitioners + staff) for user selection.
 * Returns users in a simple format suitable for the UserSelector component.
 * 
 * NOTE: Fetches ALL users from the clinic family (not filtered by branch) since
 * block appointments can be visible across branches.
 */
export const useClinicUsers = (clinicBranchId?: number | null) => {
  const [users, setUsers] = useState<ClinicUser[]>(cachedClinicUsers ?? []);
  const [loading, setLoading] = useState(!cachedClinicUsers);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchUsers = async () => {
      if (cachedClinicUsers) {
        setUsers(cachedClinicUsers);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const fetchedUsers = await fetchClinicUsers();
        if (!isMounted) return;
        setUsers(fetchedUsers);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load users');
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    fetchUsers();

    return () => {
      isMounted = false;
    };
  }, [clinicBranchId]);

  return { users, loading, error };
};
