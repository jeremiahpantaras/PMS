import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { clinicServicesApi, type ClinicService, type ClinicServicePayload } from '../services/clinic-services.api';
import toast from 'react-hot-toast';

export const useClinicServices = () => {
  const queryClient = useQueryClient();
  const [services,  setServices]  = useState<ClinicService[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  /** Invalidate all React Query caches keyed under 'clinic-services'
   *  so that other consumers (e.g. useAppointmentServices) refetch. */
  const invalidateServiceCaches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['clinic-services'] });
  }, [queryClient]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await clinicServicesApi.list();
      setServices(data);
    } catch {
      setError('Failed to load services.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createService = async (payload: ClinicServicePayload) => {
    try {
      const created = await clinicServicesApi.create(payload);
      setServices((prev) => [...prev, created]);
      invalidateServiceCaches();
      toast.success(`Service "${created.name}" created.`);
      return created;
    } catch (err: any) {
      const detail = err?.response?.data;
      const message = typeof detail === 'string'
        ? detail
        : JSON.stringify(detail);
      toast.error(`Failed to create: ${message}`);
      throw err;
    }
  };

  const updateService = async (id: number, payload: Partial<ClinicServicePayload>) => {
    try {
      const updated = await clinicServicesApi.update(id, payload);
      setServices((prev) => prev.map((s) => (s.id === id ? updated : s)));
      invalidateServiceCaches();
      toast.success(`Service "${updated.name}" updated.`);
      return updated;
    } catch (err: any) {
      const detail = err?.response?.data;
      const message = typeof detail === 'string'
        ? detail
        : JSON.stringify(detail);
      toast.error(`Failed to update: ${message}`);
      throw err;
    }
  };

  const toggleActive = async (id: number) => {
    const res = await clinicServicesApi.toggleActive(id);
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: res.is_active } : s)),
    );
    invalidateServiceCaches();
  };

  const deleteService = async (id: number, name: string) => {
    await clinicServicesApi.remove(id);
    setServices((prev) => prev.filter((s) => s.id !== id));
    invalidateServiceCaches();
    toast.success(`Service "${name}" removed.`);
  };

  return {
    services,
    loading,
    error,
    reload: load,
    createService,
    updateService,
    toggleActive,
    deleteService,
  };
};