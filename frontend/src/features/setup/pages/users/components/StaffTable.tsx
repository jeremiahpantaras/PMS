import React from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { StaffTableRow } from './StaffTableRow';
import type { StaffMember } from '../../../types/staff.types';

interface Props {
  staff:          StaffMember[];
  loading:        boolean;
  currentUserId?: number;
  onEdit:         (s: StaffMember) => void;
  onDelete:       (id: number) => void;
  onToggleStatus: (id: number, isActive: boolean) => void;
}

export const StaffTable: React.FC<Props> = ({
  staff, loading, currentUserId, onEdit, onDelete, onToggleStatus,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading staff…
      </div>
    );
  }

  if (staff.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Users className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">No staff members found</p>
        <p className="text-xs mt-1">Try adjusting your search or add a new staff member</p>
      </div>
    );
  }

  const th = (label: string, align: 'left' | 'right' = 'left') => (
    <th className={`px-4 py-3 text-${align} text-xs font-semibold text-gray-500 uppercase tracking-wide select-none`}>
      {label}
    </th>
  );

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {th('Name')}
            {th('Position')}
            {th('Discipline')}
            {th('Contact')}
            {th('Role(s)')}
            {th('Status')}
            {th('Actions', 'right')}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {staff.map(s => (
            <StaffTableRow
              key={s.id}
              staff={s}
              currentUserId={currentUserId}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleStatus={onToggleStatus}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};