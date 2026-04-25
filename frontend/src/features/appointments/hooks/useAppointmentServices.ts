import { useQuery } from '@tanstack/react-query';
import { clinicServicesApi } from '@/features/manage/services/clinic-services.api';
import type { ClinicService } from '@/features/manage/services/clinic-services.api';


/**
 * Lightweight hook used inside AppointmentModal / AppointmentEditForm.
 * Fetches only active services for the appointment service picker.
 *
 * Uses React Query with the shared 'clinic-services' key — deduplicated
 * and cached across all components (including the billing invoice page).
 */
export const useAppointmentServices = () => {
  const { data, isLoading, error } = useQuery<ClinicService[]>({
    queryKey: ['clinic-services'],
    queryFn: async () => {
      const data = await clinicServicesApi.list();
      return data.filter(s => s.is_active);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    throwOnError: false,
  });

  return {
    services: data ?? [],
    loading: isLoading,
    error: error ? 'Failed to load services.' : null,
  };
};