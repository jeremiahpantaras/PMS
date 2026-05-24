import React, { useState } from 'react';
import { ShieldCheck, Check, X, Loader2, AlertTriangle } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import type { User, UserRole } from '@/types/auth';
import toast from 'react-hot-toast';

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  {
    value:       'ADMIN',
    label:       'Admin / Owner',
    description: 'Full system access. Can manage all users, settings, and data.',
  },
  {
    value:       'PRACTITIONER',
    label:       'Practitioner',
    description: 'Clinical access. Appears in practitioner lists for appointments.',
  },
  {
    value:       'STAFF',
    label:       'Staff',
    description: 'General staff access. Can manage front-desk tasks and patients.',
  },
];

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN:            'bg-violet-100 text-violet-700 border-violet-200',
  ADMIN_ASSISTANT:  'bg-purple-100 text-purple-700 border-purple-200',
  PRACTITIONER:     'bg-teal-100 text-teal-700 border-teal-200',
  STAFF:            'bg-sky-100 text-sky-700 border-sky-200',
  FINANCE:          'bg-amber-100 text-amber-700 border-amber-200',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface ProfileRolesCardProps {
  /** The user whose roles are being managed. */
  user:          User;
  /** Whether the viewer is an admin (can edit). */
  canEdit:       boolean;
  /** Called after a successful roles update to refresh user in parent. */
  onRolesUpdate: (updatedUser: User) => void;
}

export const ProfileRolesCard: React.FC<ProfileRolesCardProps> = ({
  user,
  canEdit,
  onRolesUpdate,
}) => {
  const currentRoles = (user.roles && user.roles.length > 0) ? user.roles : [user.role];

  const [editing,   setEditing]   = useState(false);
  const [selected,  setSelected]  = useState<UserRole[]>(currentRoles);
  const [isSaving,  setIsSaving]  = useState(false);

  const handleToggle = (role: UserRole) => {
    setSelected(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role],
    );
  };

  const handleSave = async () => {
    if (selected.length === 0) {
      toast.error('At least one role must be selected.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await axiosInstance.put<User>(
        `/users/${user.id}/roles/`,
        { roles: selected },
      );
      onRolesUpdate(response.data);
      setEditing(false);
      toast.success('Roles updated successfully.');
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Failed to update roles.';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setSelected(currentRoles);
    setEditing(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-violet-50 border border-violet-100 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Assigned Roles</h2>
            <p className="text-xs text-gray-400">Multi-role access — all roles are additive</p>
          </div>
        </div>

        {canEdit && !editing && (
          <button
            onClick={() => { setSelected(currentRoles); setEditing(true); }}
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 border border-sky-200 hover:bg-sky-50 rounded-lg px-3 py-1.5 transition"
          >
            Edit Roles
          </button>
        )}

        {editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || selected.length === 0}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg px-3 py-1.5 transition"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
          </div>
        )}
      </div>

      {/* ── View Mode ── */}
      {!editing && (
        <div className="flex flex-wrap gap-2">
          {currentRoles.map(role => (
            <span
              key={role}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${ROLE_COLORS[role]}`}
            >
              <ShieldCheck className="w-3 h-3" />
              {ROLE_OPTIONS.find(r => r.value === role)?.label ?? role}
            </span>
          ))}
          {currentRoles.length === 0 && (
            <span className="text-xs text-gray-400 italic">No roles assigned</span>
          )}
        </div>
      )}

      {/* ── Edit Mode ── */}
      {editing && (
        <div className="space-y-2">
          {selected.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              At least one role must remain selected.
            </div>
          )}

          {ROLE_OPTIONS.map(({ value, label, description }) => {
            const isSelected = selected.includes(value);
            return (
              <label
                key={value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition
                  ${isSelected
                    ? 'border-sky-300 bg-sky-50'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 accent-sky-600 w-4 h-4 shrink-0"
                  checked={isSelected}
                  onChange={() => handleToggle(value)}
                />
                <div>
                  <span className={`text-sm font-semibold ${isSelected ? 'text-sky-800' : 'text-gray-700'}`}>
                    {label}
                  </span>
                  <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};
