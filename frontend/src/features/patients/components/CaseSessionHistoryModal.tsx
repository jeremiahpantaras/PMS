import React, { useState, useEffect } from 'react';
import { X, History, Activity, Plus, Minus, XCircle } from 'lucide-react';
import { getCaseSessionLogs } from '../patientCases.api';
import type { PatientCaseSessionLog } from '@/types/patient';
import { format } from 'date-fns';

interface CaseSessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: number;
  caseTitle: string;
}

export const CaseSessionHistoryModal: React.FC<CaseSessionHistoryModalProps> = ({
  isOpen,
  onClose,
  caseId,
  caseTitle,
}) => {
  const [logs, setLogs] = useState<PatientCaseSessionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen, caseId]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await getCaseSessionLogs(caseId);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load logs', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderActionIcon = (action: string) => {
    switch (action) {
      case 'ADDED_SESSIONS':
        return <Plus className="w-4 h-4 text-emerald-600" />;
      case 'REMOVED_SESSIONS':
        return <Minus className="w-4 h-4 text-red-600" />;
      case 'REMOVED_LIMIT':
        return <XCircle className="w-4 h-4 text-amber-600" />;
      default:
        return <Activity className="w-4 h-4 text-sky-600" />;
    }
  };

  const renderActionBadge = (action: string) => {
    switch (action) {
      case 'ADDED_SESSIONS':
        return <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide border border-emerald-100">Added</span>;
      case 'REMOVED_SESSIONS':
        return <span className="bg-red-50 text-red-700 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide border border-red-100">Removed</span>;
      case 'REMOVED_LIMIT':
        return <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide border border-amber-100">Limit Removed</span>;
      default:
        return <span className="bg-gray-50 text-gray-700 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide border border-gray-200">{action}</span>;
    }
  };

  const formatLimitChange = (prev: number | null, next: number | null) => {
    const p = prev === null ? 'Unlimited' : prev;
    const n = next === null ? 'Unlimited' : next;
    return `${p} → ${n}`;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl pointer-events-auto flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <History className="w-5 h-5 text-slate-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 leading-tight">Session History</h3>
                <p className="text-sm text-gray-500 truncate">{caseTitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar max-h-[330px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin mb-4" />
                <p className="text-sm text-gray-500">Loading history logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
                  <Activity className="w-8 h-8 text-slate-300" />
                </div>
                <h4 className="text-base font-medium text-gray-900 mb-1">No History Yet</h4>
                <p className="text-sm text-gray-500 max-w-sm">
                  There are no manual changes recorded for this session's limit.
                </p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-6 top-6 bottom-6 w-px bg-slate-200" />
                <div className="space-y-6">
                  {logs.map((log) => (
                    <div key={log.id} className="relative flex gap-5 group">
                      <div className="relative mt-1">
                        <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm relative z-10 group-hover:border-slate-300 transition-colors">
                          {renderActionIcon(log.action)}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            {renderActionBadge(log.action)}
                            <span className="text-sm font-medium text-gray-900">
                              {log.amount ? `${log.amount} Sessions` : 'Limit'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                            {format(new Date(log.created_at), "MMM d, yyyy h:mm a")}
                          </span>
                        </div>
                        
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">By</span>
                            <span className="font-medium text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                              {log.user_name || 'System'}
                            </span>
                          </div>
                          
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Limit Change</span>
                            <span className="font-medium text-slate-700">
                              {formatLimitChange(log.previous_limit, log.new_limit)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
