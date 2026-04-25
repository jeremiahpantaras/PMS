import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getClinicBranches } from '../clinic.api';
import type { ClinicBranch } from '@/types/clinic';
import toast from 'react-hot-toast';
import { useCallback } from 'react';

interface UseClinicBranchesReturn {
  branches: ClinicBranch[];
  mainClinicId: number | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const CLINIC_BRANCHES_QUERY_KEY = ['clinic-branches'] as const;

/**
 * Hook to fetch and manage clinic branches.
 * Uses React Query for automatic deduplication and caching — multiple
 * components calling this hook simultaneously make only ONE network request.
 */
export const useClinicBranches = (): UseClinicBranchesReturn => {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: CLINIC_BRANCHES_QUERY_KEY,
    queryFn: async () => {
      const response = await getClinicBranches();
      return response;
    },
    staleTime: 5 * 60 * 1000, // treat as fresh for 5 min
    gcTime: 10 * 60 * 1000,
    retry: 1,
    throwOnError: false,
  });

  if (error) {
    const msg = (error as any)?.response?.data?.detail || 'Failed to load clinic branches';
    toast.error(msg);
  }

  const refetch = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: CLINIC_BRANCHES_QUERY_KEY });
  }, [qc]);

  return {
    branches: data?.branches ?? [],
    mainClinicId: data?.main_clinic_id ?? null,
    loading: isLoading,
    error: error ? ((error as any)?.response?.data?.detail || 'Failed to load clinic branches') : null,
    refetch,
  };
};