import React from 'react';
import { Edit2, Trash2, Mail, Phone, ToggleLeft, ToggleRight } from 'lucide-react';
import type { StaffMember } from '../../../types/staff.types';
import { DISCIPLINE_OPTIONS } from '../../../types/staff.types';

interface Props {
  staff:          StaffMember;
  currentUserId?: number;
  onEdit:         (s: StaffMember) => void;
  onDelete:       (staff: StaffMember) => void;
  onToggleStatus: (id: number, isActive: boolean) => void;
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN:           'bg-amber-50  text-amber-700  border-amber-200',
  ADMIN_ASSISTANT: 'bg-violet-50 text-violet-700 border-violet-200',
  PRACTITIONER:    'bg-purple-50 text-purple-700 border-purple-200',
  STAFF:           'bg-sky-50    text-sky-700    border-sky-200',
  FINANCE:         'bg-green-50  text-green-700  border-green-200',
  READ_ONLY:       'bg-gray-50   text-gray-500   border-gray-200',
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN:           'Administrator',
  ADMIN_ASSISTANT: 'Admin Asst.',
  PRACTITIONER:    'Practitioner',
  STAFF:           'Staff',
  FINANCE:         'Finance',
  READ_ONLY:       'Read-Only',
};

export const StaffTableRow: React.FC<Props> = ({
  staff, currentUserId, onEdit, onDelete, onToggleStatus,
}) => {
  const disciplineLabel =
    DISCIPLINE_OPTIONS.find(d => d.value === staff.discipline)?.label ?? staff.discipline;

  const initials = `${staff.first_name[0] ?? ''}${staff.last_name[0] ?? ''}`.toUpperCase();
  const effectiveRoles = staff.roles && staff.roles.length > 0 ? staff.roles : [staff.role];
  const isMe     = currentUserId != null && staff.id === currentUserId;
  const isAdmin  = effectiveRoles.includes('ADMIN');
  // Show the assigned branch name when present; fall back to 'All Branches' only
  // for admins who have no specific branch assignment.
  const branchLabel = staff.clinic_branch_name ?? (isAdmin ? 'All Branches' : null);

  return (
    <tr className="hover:bg-sky-50/40 transition-colors">

      {/* Name + Avatar */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center text-xs font-bold text-sky-700 flex-shrink-0">
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-gray-900 text-sm leading-tight">
                {staff.title} {staff.first_name} {staff.last_name}
              </p>
              {isMe && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 leading-none">
                  Me
                </span>
              )}
            </div>
            {staff.nickname && (
              <p className="text-xs text-gray-400">"{staff.nickname}"</p>
            )}
            {branchLabel && (
              <p className="text-xs text-gray-400 mt-0.5">{branchLabel}</p>
            )}
          </div>
        </div>
      </td>

      {/* Position */}
      <td className="px-4 py-3 text-gray-600 text-sm">
        {staff.position || '—'}
      </td>

      {/* Discipline */}
      <td className="px-4 py-3">
        <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-slate-50 text-slate-600 border-slate-200">
          {disciplineLabel}
        </span>
      </td>

      {/* Contact */}
      <td className="px-4 py-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="truncate max-w-[180px]">{staff.email}</span>
          </div>
          {staff.phone && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Phone className="w-3 h-3 flex-shrink-0" />
              <span>{staff.phone}</span>
            </div>
          )}
        </div>
      </td>

      {/* Role(s) — multi-role badges */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {((staff.roles && staff.roles.length > 0) ? staff.roles : [staff.role]).map(r => (
            <span
              key={r}
              className={`px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_BADGE[r] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}
            >
              {ROLE_LABEL[r] ?? r}
            </span>
          ))}
        </div>
      </td>

      {/* Status toggle */}
      <td className="px-4 py-3">
        <button
          onClick={() => onToggleStatus(staff.id, !staff.is_active)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            staff.is_active
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : 'bg-gray-50   text-gray-500   border-gray-200   hover:bg-gray-100'
          }`}
        >
          {staff.is_active
            ? <><ToggleRight className="w-3.5 h-3.5" /> Active</>
            : <><ToggleLeft  className="w-3.5 h-3.5" /> Inactive</>}
        </button>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onEdit(staff)}
            className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(staff)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};