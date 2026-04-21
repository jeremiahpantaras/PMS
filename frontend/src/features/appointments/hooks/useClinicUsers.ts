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

/**
 * Hook to fetch all clinic users (admin + practitioners + staff) for user selection.
 * Returns users in a simple format suitable for the UserSelector component.
 * 
 * NOTE: Fetches ALL users from the clinic family (not filtered by branch) since
 * block appointments can be visible across branches.
 */
export const useClinicUsers = (clinicBranchId?: number | null) => {
  const [users, setUsers] = useState<ClinicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch all users from the clinic family (no branch filter)
        // This ensures we can select users from any branch for block appointment visibility
        const response = await axiosInstance.get<UserListResponse | BackendUser[]>('/users/');
        
        // Handle both paginated and non-paginated responses
        let userList: BackendUser[] = [];
        
        if (Array.isArray(response.data)) {
          // Direct array response
          userList = response.data;
        } else if (response.data && 'results' in response.data && Array.isArray(response.data.results)) {
          // Paginated response
          userList = response.data.results;
        } else {
          console.error('[useClinicUsers] Unexpected response format:', response.data);
          throw new Error('Unexpected response format from /users/ endpoint');
        }

        // Map backend users to ClinicUser format
        const mappedUsers: ClinicUser[] = userList.map((user: BackendUser) => ({
          id: user.id,
          name: `${user.first_name} ${user.last_name}`.trim() || user.email,
          email: user.email,
          role: user.role,
          avatar: user.avatar || null,
        }));

        // Sort by role (ADMIN first, then PRACTITIONER, then STAFF) and then by name
        const roleOrder = { 'ADMIN': 1, 'PRACTITIONER': 2, 'STAFF': 3 };
        mappedUsers.sort((a, b) => {
          const roleCompare = roleOrder[a.role] - roleOrder[b.role];
          if (roleCompare !== 0) return roleCompare;
          return a.name.localeCompare(b.name);
        });

        setUsers(mappedUsers);
      } catch (err: any) {
        console.error('[useClinicUsers] Failed to fetch clinic users:', err);
        console.error('[useClinicUsers] Error details:', err.response?.data);
        setError(err.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [clinicBranchId]);

  return { users, loading, error };
};
