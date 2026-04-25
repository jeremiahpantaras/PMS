import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPractitioners } from '../clinic.api';
import type { Practitioner } from '../clinic.api';
import toast from 'react-hot-toast';
import { useCallback } from 'react';

interface UsePractitionersParams {
  clinicBranchId?: number | null;
}

interface UsePractitionersReturn {
  practitioners: Practitioner[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage practitioners.
 * Uses React Query for automatic deduplication and caching — multiple
 * components calling this hook with the same branch ID make only ONE request.
 */
export const usePractitioners = (params?: UsePractitionersParams): UsePractitionersReturn => {
  const branchId = params?.clinicBranchId ?? null;
  const queryKey = ['practitioners', branchId] as const;
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await getPractitioners(branchId);
      return response.practitioners;
    },
    staleTime: 5 * 60 * 1000, // treat as fresh for 5 min
    gcTime: 10 * 60 * 1000,
    retry: 1,
    throwOnError: false,
  });

  if (error) {
    const msg = (error as any)?.response?.data?.detail || 'Failed to load practitioners';
    toast.error(msg);
  }

  const refetch = useCallback(async () => {
    await qc.invalidateQueries({ queryKey });
  }, [qc, branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    practitioners: data ?? [],
    loading: isLoading,
    error: error ? ((error as any)?.response?.data?.detail || 'Failed to load practitioners') : null,
    refetch,
  };
};