import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { FileText, Loader2, Edit } from 'lucide-react';
import { getClinicBranches, getMyClinic } from '@/features/clinics/clinic.api';
import type { ClinicBranch } from '@/types/clinic';
import { BranchConsentFormModal } from '@/features/clinic-setup/components/BranchConsentFormModal';
import { BranchConsentFormViewModal } from '@/features/clinic-setup/components/BranchConsentFormViewModal';

export const ConsentFormEditor: React.FC = () => {
  const [loading, setLoading] = useState(true);
  
  // Branches state
  const [clinicId, setClinicId] = useState<number | null>(null);
  const [clinicName, setClinicName] = useState<string>('');
  const [branches, setBranches] = useState<ClinicBranch[]>([]);
  
  // Consent status mapping
  const [consentStatuses, setConsentStatuses] = useState<Record<number, { 
    is_active: boolean; 
    updated_at: string | null;
    created_at: string | null;
    created_by_name: string;
    updated_by_name: string;
  }>>({});
  
  // Modal state
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedConsentBranchId, setSelectedConsentBranchId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const branchRes = await getClinicBranches().catch(() => ({ branches: [] as ClinicBranch[], main_clinic_id: 0 }));
      
      setBranches(branchRes.branches);
      
      // Load statuses
      const branchesToLoad = branchRes.branches;
      await reloadConsentStatuses(branchesToLoad);
      
    } catch (e) {
      console.error('Failed to load clinic data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reloadConsentStatuses = useCallback(async (branchesToLoad: { id: number }[]) => {
    const { getBranchConsentForm } = await import('@/features/clinics/clinic.api');
    const newStatuses: Record<number, { 
      is_active: boolean; 
      updated_at: string | null;
      created_at: string | null;
      created_by_name: string;
      updated_by_name: string;
    }> = {};
    
    await Promise.allSettled(
      branchesToLoad.map(async (b) => {
        try {
          const consent = await getBranchConsentForm(b.id);
          if (consent && Object.keys(consent).length > 0) {
            newStatuses[b.id] = {
              is_active: consent.is_active || false,
              updated_at: consent.updated_at || null,
              created_at: consent.created_at || null,
              created_by_name: consent.created_by_name || 'System',
              updated_by_name: consent.updated_by_name || 'System',
            };
          } else {
            newStatuses[b.id] = { is_active: false, updated_at: null, created_at: null, created_by_name: '-', updated_by_name: '-' };
          }
        } catch (e: any) {
          console.error(e);
          newStatuses[b.id] = { is_active: false, updated_at: null, created_at: null, created_by_name: '-', updated_by_name: '-' };
        }
      })
    );
    setConsentStatuses(prev => ({ ...prev, ...newStatuses }));
  }, []);

  const accessibleBranches = useMemo(() => {
    return branches.map(b => ({
      id: b.id,
      name: b.is_main_branch ? `${b.name} (Main Branch)` : b.name
    }));
  }, [branches]);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Clinic Consent Forms</h2>
            <p className="text-xs text-gray-500">Manage consent forms for your clinic branches</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-600">Branch Name</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Status</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Created By</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Last Modified By</th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {accessibleBranches.map((branch) => {
                const status = consentStatuses[branch.id];
                const isActive = status?.is_active ?? false;
                const updatedAt = status?.updated_at 
                  ? new Date(status.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                  : 'Never';

                return (
                  <tr key={branch.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{branch.name}</td>
                    <td className="px-6 py-4">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-gray-900 font-medium">{status?.created_by_name || '-'}</span>
                        <span className="text-xs text-gray-500">
                          {status?.created_at 
                            ? new Date(status.created_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                            : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-gray-900 font-medium">{status?.updated_by_name || '-'}</span>
                        <span className="text-xs text-gray-500">
                          {status?.updated_at 
                            ? new Date(status.updated_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                            : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedConsentBranchId(branch.id);
                            setViewModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" /> View
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedConsentBranchId(branch.id);
                            setConsentModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Suspense fallback={null}>
        {consentModalOpen && (
          <BranchConsentFormModal
            isOpen={consentModalOpen}
            onClose={() => setConsentModalOpen(false)}
            accessibleBranches={accessibleBranches}
            initialBranchId={selectedConsentBranchId}
            onSuccess={() => reloadConsentStatuses(accessibleBranches)}
          />
        )}
        {viewModalOpen && selectedConsentBranchId && (
          <BranchConsentFormViewModal
            isOpen={viewModalOpen}
            onClose={() => setViewModalOpen(false)}
            branchId={selectedConsentBranchId}
            branchName={accessibleBranches.find(b => b.id === selectedConsentBranchId)?.name || 'Unknown Branch'}
          />
        )}
      </Suspense>
    </div>
  );
};

export default ConsentFormEditor;