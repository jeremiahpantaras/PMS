/**
 * Permissions.tsx — Enterprise RBAC Permission Group Builder
 *
 * Allows Owners (ADMIN) to:
 *   - View all permission groups for the clinic
 *   - Create / edit / duplicate / delete groups
 *   - Set feature-level access (none / view / edit) per group
 *   - Assign users to groups
 *   - See member counts per group
 *   - Never delete a protected group (Owner)
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Shield, Plus, Edit2, Copy, Trash2, Users, ChevronDown,
  ChevronUp, Crown, UserCog, Stethoscope, RefreshCw, X,
  AlertTriangle, Save, Info, Eye,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/auth.store';
import {
  listPermissionGroups,
  createPermissionGroup,
  updatePermissionGroup,
  deletePermissionGroup,
  duplicatePermissionGroup,
  type PermissionGroup,
  type AccessLevel,
  type RoleTemplate,
} from '../../services/PermissionGroupService';

// ─── Feature key metadata ─────────────────────────────────────────────────────

const FEATURE_GROUPS: { label: string; keys: { key: string; label: string }[] }[] = [
  {
    label: 'Dashboard',
    keys: [{ key: 'dashboard', label: 'Dashboard' }],
  },
  {
    label: 'Diary & Calendar',
    keys: [
      { key: 'diary',         label: 'Diary' },
      { key: 'calendar',      label: 'Calendar' },
      { key: 'appointments',  label: 'Appointments' },
    ],
  },
  {
    label: 'Patients & Cases',
    keys: [
      { key: 'patients',     label: 'Patients' },
      { key: 'client_cases', label: 'Client Cases' },
    ],
  },
  {
    label: 'Clinical',
    keys: [
      { key: 'clinical_notes',   label: 'Clinical Notes' },
      { key: 'outcome_measures', label: 'Outcome Measures' },
      { key: 'documents',        label: 'Documents' },
    ],
  },
  {
    label: 'Billing & Finance',
    keys: [
      { key: 'invoices', label: 'Invoices' },
      { key: 'billing',  label: 'Billing' },
    ],
  },
  {
    label: 'Operations',
    keys: [
      { key: 'contacts',      label: 'Contacts' },
      { key: 'inventory',     label: 'Inventory' },
      { key: 'communication', label: 'Communication' },
      { key: 'reports',       label: 'Reports' },
    ],
  },
  {
    label: 'Administration',
    keys: [
      // 'setup' key intentionally excluded here — it controls the sidebar lock
      // icon only.  Card-level access is configured via Setup Sections below.
      { key: 'staff_management', label: 'Staff Management' },
      { key: 'permissions',      label: 'Permissions' },
      { key: 'settings',         label: 'Settings' },
      { key: 'subscriptions',    label: 'Subscriptions' },
    ],
  },
  {
    label: 'Setup Sections',
    keys: [
      { key: 'setup_practice',      label: 'Setup – Practice' },
      { key: 'setup_items',         label: 'Setup – Items' },
      { key: 'setup_users',         label: 'Setup – Users' },
      { key: 'setup_account',       label: 'Setup – Account' },
      { key: 'setup_communication', label: 'Setup – Communication' },
    ],
  },
  {
    label: 'Manage Sections',
    keys: [
      { key: 'manage_administration', label: 'Manage – Administration' },
      { key: 'manage_clinical',       label: 'Manage – Clinical' },
      { key: 'manage_communications', label: 'Manage – Communications' },
    ],
  },
  {
    label: 'Report Sections',
    keys: [
      { key: 'reports_administration', label: 'Reports – Administration' },
      { key: 'reports_clinic',         label: 'Reports – Clinic' },
      { key: 'reports_financial',      label: 'Reports – Financial' },
      { key: 'reports_performance',    label: 'Reports – Performance' },
    ],
  },
];

const ALL_FEATURE_KEYS = FEATURE_GROUPS.flatMap((g) => g.keys.map((k) => k.key));

// ─── Role display order ──────────────────────────────────────────────────────
// Controls the fixed visual hierarchy: Owner → Manager → Front Desk → Practitioner → Custom
// DISPLAY ONLY — does not affect RBAC logic or database records.

const ROLE_ORDER: Record<string, number> = {
  OWNER:           1,
  MANAGER:         2,
  ADMIN_ASSISTANT: 3,
  FRONTDESK:       4,
  PRACTITIONER:    5,
  FINANCE:         6,
  READ_ONLY:       7,
  CUSTOM:          8,
};

// ─── Role template styles ─────────────────────────────────────────────────────

const TEMPLATE_STYLES: Record<
  RoleTemplate,
  { iconBg: string; icon: React.ElementType; iconColor: string; badge: string }
> = {
  OWNER:           { iconBg: 'bg-amber-100',   icon: Crown,       iconColor: 'text-amber-600',   badge: 'bg-amber-100  text-amber-800  border-amber-200'  },
  MANAGER:         { iconBg: 'bg-sky-100',     icon: UserCog,     iconColor: 'text-sky-600',     badge: 'bg-sky-100    text-sky-800    border-sky-200'    },
  ADMIN_ASSISTANT: { iconBg: 'bg-violet-100',  icon: UserCog,     iconColor: 'text-violet-600',  badge: 'bg-violet-100 text-violet-800 border-violet-200' },
  FRONTDESK:       { iconBg: 'bg-teal-100',    icon: Users,       iconColor: 'text-teal-600',    badge: 'bg-teal-100   text-teal-800   border-teal-200'   },
  PRACTITIONER:    { iconBg: 'bg-purple-100',  icon: Stethoscope, iconColor: 'text-purple-600',  badge: 'bg-purple-100 text-purple-800 border-purple-200' },
  FINANCE:         { iconBg: 'bg-green-100',   icon: Users,       iconColor: 'text-green-600',   badge: 'bg-green-100  text-green-800  border-green-200'  },
  READ_ONLY:       { iconBg: 'bg-gray-100',    icon: Eye,         iconColor: 'text-gray-500',    badge: 'bg-gray-100   text-gray-600   border-gray-300'   },
  CUSTOM:          { iconBg: 'bg-gray-100',    icon: Shield,      iconColor: 'text-gray-500',    badge: 'bg-gray-100   text-gray-700   border-gray-200'   },
};

// ─── Access level selector ────────────────────────────────────────────────────

const ACCESS_OPTIONS: { value: AccessLevel; label: string; activeCls: string }[] = [
  { value: 'none', label: 'No Access', activeCls: 'bg-gray-100 text-gray-600 border-gray-300' },
  { value: 'view', label: 'View',      activeCls: 'bg-sky-50   text-sky-700  border-sky-300'  },
  { value: 'edit', label: 'Edit',      activeCls: 'bg-green-50 text-green-700 border-green-300' },
];

interface AccessSelectorProps {
  value:    AccessLevel;
  onChange: (v: AccessLevel) => void;
  disabled?: boolean;
}

const AccessSelector: React.FC<AccessSelectorProps> = ({ value, onChange, disabled }) => (
  <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold shrink-0">
    {ACCESS_OPTIONS.map((opt) => (
      <button
        key={opt.value}
        disabled={disabled}
        onClick={() => !disabled && onChange(opt.value)}
        className={`px-2.5 py-1 transition-colors border-r last:border-r-0 border-gray-200 ${
          value === opt.value ? opt.activeCls : 'bg-white text-gray-400 hover:bg-gray-50'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// ─── Permission Group Card ────────────────────────────────────────────────────

interface GroupCardProps {
  group:        PermissionGroup;
  isEditing:    boolean;
  editMap:      Record<string, AccessLevel>;
  canManage:    boolean;
  onEdit:       () => void;
  onSave:       () => void;
  onCancel:     () => void;
  onDuplicate:  () => void;
  onDelete:     () => void;
  onPermChange: (key: string, level: AccessLevel) => void;
  isSaving:     boolean;
}

const GroupCard: React.FC<GroupCardProps> = ({
  group, isEditing, editMap, canManage,
  onEdit, onSave, onCancel, onDuplicate, onDelete,
  onPermChange, isSaving,
}) => {
  // Collapsed by default — user opens the card they want to inspect
  const [expanded, setExpanded] = useState(false);
  const style  = TEMPLATE_STYLES[group.role_template] ?? TEMPLATE_STYLES.CUSTOM;
  const Icon   = style.icon;
  const activeMap = isEditing ? editMap : (group.permissions_map ?? {});

  const editCount = Object.values(activeMap).filter((v) => v === 'edit').length;
  const viewCount = Object.values(activeMap).filter((v) => v === 'view').length;
  const noneCount = Object.values(activeMap).filter((v) => v === 'none').length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${style.iconBg}`}>
            <Icon className={`w-4 h-4 ${style.iconColor}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-gray-900 truncate">{group.name}</h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style.badge}`}>
                {group.role_template}
              </span>
              {group.is_protected && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Protected
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
              <span>{group.member_count} member{group.member_count !== 1 ? 's' : ''}</span>
              <span className="text-green-600 font-medium">{editCount} edit</span>
              <span className="text-sky-600 font-medium">{viewCount} view</span>
              <span className="text-gray-400">{noneCount} none</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isEditing ? (
            <>
              <button
                onClick={onSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={onCancel}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {canManage && (
                <>
                  <button onClick={onEdit}      title="Edit permissions"  className="p-1.5 text-gray-400 hover:text-sky-600  rounded-lg hover:bg-sky-50  transition-colors"><Edit2  className="w-4 h-4" /></button>
                  <button onClick={onDuplicate} title="Duplicate group"   className="p-1.5 text-gray-400 hover:text-teal-600 rounded-lg hover:bg-teal-50 transition-colors"><Copy   className="w-4 h-4" /></button>
                  {!group.is_protected && (
                    <button onClick={onDelete} title="Delete group" className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  )}
                </>
              )}
              <button onClick={() => setExpanded((e) => !e)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Permissions grid — CSS max-height transition for smooth expand/collapse */}
      <div
        className={`divide-y divide-gray-50 overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
          expanded ? 'max-h-750 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {FEATURE_GROUPS.map((fg) => (
          <div key={fg.label} className="px-5 py-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">{fg.label}</p>
            <div className="space-y-2">
              {fg.keys.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-700 truncate">{label}</span>
                  <AccessSelector
                    value={((activeMap[key] as AccessLevel) ?? 'none')}
                    onChange={(v) => onPermChange(key, v)}
                    disabled={!isEditing}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Default permissions per template ────────────────────────────────────────

const TEMPLATE_DEFAULT_PERMS: Record<RoleTemplate, Record<string, AccessLevel>> = {
  OWNER:    Object.fromEntries(ALL_FEATURE_KEYS.map((k) => [k, 'edit'])) as Record<string, AccessLevel>,
  MANAGER: {
    dashboard: 'edit', appointments: 'edit', calendar: 'edit', diary: 'edit',
    clinical_notes: 'edit', client_cases: 'edit', patients: 'edit', reports: 'edit',
    inventory: 'edit', invoices: 'edit', billing: 'edit', subscriptions: 'view',
    setup: 'view', staff_management: 'edit', permissions: 'view', settings: 'view',
    documents: 'edit', outcome_measures: 'edit', contacts: 'edit', communication: 'edit',
    setup_practice: 'edit', setup_items: 'edit', setup_users: 'edit',
    setup_account: 'view', setup_communication: 'edit',
    manage_administration: 'edit', manage_clinical: 'edit', manage_communications: 'edit',
    reports_administration: 'edit', reports_clinic: 'edit',
    reports_financial: 'edit', reports_performance: 'edit',
  },
  ADMIN_ASSISTANT: {
    dashboard: 'edit', appointments: 'edit', calendar: 'edit', diary: 'edit',
    clinical_notes: 'edit', client_cases: 'edit', patients: 'edit', reports: 'edit',
    inventory: 'edit', invoices: 'edit', billing: 'edit', subscriptions: 'view',
    setup: 'view', staff_management: 'edit', permissions: 'view', settings: 'view',
    documents: 'edit', outcome_measures: 'edit', contacts: 'edit', communication: 'edit',
    setup_practice: 'edit', setup_items: 'edit', setup_users: 'edit',
    setup_account: 'view', setup_communication: 'edit',
    manage_administration: 'edit', manage_clinical: 'edit', manage_communications: 'edit',
    reports_administration: 'edit', reports_clinic: 'edit',
    reports_financial: 'edit', reports_performance: 'edit',
  },
  FRONTDESK: {
    dashboard: 'view', appointments: 'edit', calendar: 'edit', diary: 'edit',
    clinical_notes: 'view', client_cases: 'view', patients: 'edit', reports: 'view',
    inventory: 'view', invoices: 'edit', billing: 'view', subscriptions: 'none',
    setup: 'none', staff_management: 'none', permissions: 'none', settings: 'none',
    documents: 'view', outcome_measures: 'view', contacts: 'edit', communication: 'edit',
    setup_practice: 'view', setup_items: 'view', setup_users: 'none',
    setup_account: 'none', setup_communication: 'view',
    manage_administration: 'view', manage_clinical: 'view', manage_communications: 'edit',
    reports_administration: 'edit', reports_clinic: 'view',
    reports_financial: 'edit', reports_performance: 'view',
  },
  PRACTITIONER: {
    dashboard: 'view', appointments: 'edit', calendar: 'edit', diary: 'edit',
    clinical_notes: 'edit', client_cases: 'edit', patients: 'edit', reports: 'view',
    inventory: 'view', invoices: 'view', billing: 'none', subscriptions: 'none',
    setup: 'none', staff_management: 'none', permissions: 'none', settings: 'none',
    documents: 'edit', outcome_measures: 'edit', contacts: 'edit', communication: 'view',
    setup_practice: 'view', setup_items: 'none', setup_users: 'none',
    setup_account: 'none', setup_communication: 'view',
    manage_administration: 'none', manage_clinical: 'edit', manage_communications: 'view',
    reports_administration: 'none', reports_clinic: 'edit',
    reports_financial: 'none', reports_performance: 'view',
  },
  FINANCE: {
    dashboard: 'view', appointments: 'view', calendar: 'view', diary: 'none',
    clinical_notes: 'none', client_cases: 'none', patients: 'view', reports: 'view',
    inventory: 'view', invoices: 'edit', billing: 'edit', subscriptions: 'none',
    setup: 'none', staff_management: 'none', permissions: 'none', settings: 'none',
    documents: 'none', outcome_measures: 'none', contacts: 'view', communication: 'view',
    setup_practice: 'none', setup_items: 'none', setup_users: 'none',
    setup_account: 'none', setup_communication: 'none',
    manage_administration: 'edit', manage_clinical: 'none', manage_communications: 'none',
    reports_administration: 'view', reports_clinic: 'none',
    reports_financial: 'edit', reports_performance: 'view',
  },
  READ_ONLY: {
    // View access to all non-admin features; admin-only sections set to 'none'.
    dashboard: 'view', appointments: 'view', calendar: 'view', diary: 'view',
    clinical_notes: 'view', client_cases: 'view', patients: 'view', reports: 'view',
    inventory: 'view', invoices: 'view', billing: 'view', subscriptions: 'none',
    setup: 'none', staff_management: 'none', permissions: 'none', settings: 'none',
    documents: 'view', outcome_measures: 'view', contacts: 'view', communication: 'view',
    setup_practice: 'none', setup_items: 'none', setup_users: 'none',
    setup_account: 'none', setup_communication: 'none',
    manage_administration: 'none', manage_clinical: 'view', manage_communications: 'view',
    reports_administration: 'none', reports_clinic: 'view',
    reports_financial: 'none', reports_performance: 'view',
  },
  CUSTOM: Object.fromEntries(ALL_FEATURE_KEYS.map((k) => [k, 'none'])) as Record<string, AccessLevel>,
};

const TEMPLATE_OPTIONS: { value: RoleTemplate; label: string }[] = [
  { value: 'OWNER',           label: 'Owner (Full Access)' },
  { value: 'MANAGER',         label: 'Manager' },
  { value: 'ADMIN_ASSISTANT', label: 'Admin Assistant' },
  { value: 'FRONTDESK',       label: 'Frontdesk' },
  { value: 'PRACTITIONER',    label: 'Practitioner' },
  { value: 'FINANCE',         label: 'Finance' },
  { value: 'READ_ONLY',       label: 'Read-Only (View Only)' },
  { value: 'CUSTOM',          label: 'Custom (No Access)' },
];

// ─── Create Group Modal ───────────────────────────────────────────────────────

const CreateGroupModal: React.FC<{
  isOpen:   boolean;
  onClose:  () => void;
  onCreate: (name: string, template: RoleTemplate, description: string) => Promise<void>;
}> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName]         = useState('');
  const [template, setTemplate] = useState<RoleTemplate>('CUSTOM');
  const [description, setDesc]  = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    try {
      await onCreate(name.trim(), template, description.trim());
      setName(''); setTemplate('CUSTOM'); setDesc('');
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; name?: string[] } } };
      setError(e?.response?.data?.detail || e?.response?.data?.name?.[0] || 'Failed to create group.');
    } finally { setSaving(false); }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">New Permission Group</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Group Name <span className="text-rose-500">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Senior Receptionist"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Starting Template</label>
            <select value={template} onChange={(e) => setTemplate(e.target.value as RoleTemplate)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
              {TEMPLATE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-gray-400">Sets initial permissions. Customise after creating.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Optional description…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none" />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-xl hover:bg-sky-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {saving ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

const DeleteConfirmModal: React.FC<{
  group:     PermissionGroup | null;
  onClose:   () => void;
  onConfirm: () => Promise<void>;
}> = ({ group, onClose, onConfirm }) => {
  const [deleting, setDeleting] = useState(false);
  const handleConfirm = async () => { setDeleting(true); await onConfirm(); setDeleting(false); };

  if (!group) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-5 text-center space-y-3">
          <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
          </div>
          <h3 className="text-base font-bold text-gray-900">Delete Permission Group?</h3>
          <p className="text-sm text-gray-500">
            <strong className="text-gray-800">{group.name}</strong> has{' '}
            <strong>{group.member_count}</strong> member{group.member_count !== 1 ? 's' : ''}.
            They will be unassigned.
          </p>
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleConfirm} disabled={deleting}
            className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export const Permissions: React.FC = () => {
  const { isOwner, isManager, canEdit } = usePermissions();
  // Subscribe to external permission refreshes (e.g. WS-driven updates from
  // another browser session).  permissionsVersion increments each time the
  // auth store's refreshPermissions() completes successfully.
  const permissionsVersion = useAuthStore((s) => s.permissionsVersion);

  const [groups,       setGroups]       = useState<PermissionGroup[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [showCreate,   setShowCreate]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PermissionGroup | null>(null);
  const [editingId,    setEditingId]    = useState<number | null>(null);
  const [editMap,      setEditMap]      = useState<Record<string, AccessLevel>>({});
  const [isSaving,     setIsSaving]     = useState(false);

  const canManage = isOwner || isManager || canEdit('permissions');

  // Sort groups by fixed role hierarchy for consistent display order.
  // OWNER → MANAGER → FRONTDESK → PRACTITIONER → CUSTOM
  // Groups with the same template are sub-sorted by name for determinism.
  const sortedGroups = useMemo(
    () =>
      [...groups].sort((a, b) => {
        const orderA = ROLE_ORDER[a.role_template] ?? 99;
        const orderB = ROLE_ORDER[b.role_template] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      }),
    [groups],
  );

  const fetchGroups = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setGroups(await listPermissionGroups());
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      const msg = e?.response?.data?.detail || 'Failed to load permission groups.';
      setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  }, []);

  // Initial load
  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  // Re-fetch when an external session triggers a WS-driven permission refresh
  // (permissionsVersion is 0 on first render; skip to avoid duplicate initial fetch)
  const isFirstVersionRender = useRef(true);
  useEffect(() => {
    if (isFirstVersionRender.current) {
      isFirstVersionRender.current = false;
      return;
    }
    fetchGroups();
  }, [permissionsVersion, fetchGroups]);

  const startEdit   = (g: PermissionGroup) => { setEditingId(g.id); setEditMap({ ...g.permissions_map }); };
  const cancelEdit  = () => { setEditingId(null); setEditMap({}); };

  const saveEdit = async (g: PermissionGroup) => {
    // Snapshot current state for rollback on API failure
    const snapshotGroups = groups;
    const savedEditMap   = { ...editMap };

    // ── Optimistic update: apply the new permissions immediately ────────────
    // This makes the AccessSelector reflect the new values before the API
    // response arrives, giving instant visual feedback.
    setGroups((prev) =>
      prev.map((x) =>
        x.id === g.id ? { ...x, permissions_map: savedEditMap } : x,
      ),
    );
    setEditingId(null);
    setEditMap({});
    setIsSaving(true);

    try {
      await updatePermissionGroup(g.id, { permissions: savedEditMap });
      toast.success(`"${g.name}" updated.`);
    } catch (err: unknown) {
      // ── Rollback: restore previous state and re-open edit mode ────────────
      setGroups(snapshotGroups);
      setEditingId(g.id);
      setEditMap(savedEditMap);
      const e = err as { response?: { data?: { detail?: string } } };
      toast.error(e?.response?.data?.detail || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreate = async (name: string, template: RoleTemplate, description: string) => {
    const permissions = { ...TEMPLATE_DEFAULT_PERMS[template] };
    const newGroup = await createPermissionGroup({ name, role_template: template, description, permissions });
    setGroups((prev) => [...prev, newGroup]);
    toast.success(`"${name}" permission group created.`);
  };

  const handleDuplicate = async (g: PermissionGroup) => {
    let name = `${g.name} (Copy)`, idx = 2;
    while (groups.some((x) => x.name === name)) name = `${g.name} (Copy ${idx++})`;
    try {
      const duped = await duplicatePermissionGroup(g.id, name);
      setGroups((prev) => [...prev, duped]);
      toast.success(`Duplicated as "${name}".`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      toast.error(e?.response?.data?.detail || 'Failed to duplicate group.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePermissionGroup(deleteTarget.id);
      setGroups((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      toast.success(`"${deleteTarget.name}" deleted.`);
    } finally { setDeleteTarget(null); }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Permission Groups</h1>
            <p className="text-xs text-gray-400">Configure feature-level access. Assign staff via Staff Management.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchGroups} disabled={loading} className="p-2 border border-gray-200 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors disabled:opacity-50" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canManage && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-semibold shadow-sm">
              <Plus className="w-4 h-4" /> New Group
            </button>
          )}
        </div>
      </div>

      {/* Info banner for read-only users */}
      {!canManage && (
        <div className="flex items-center gap-2 text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 shrink-0" />
          View-only. Contact an Owner to make changes.
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap px-1">
        {[
          { cls: 'bg-gray-100 text-gray-500 border-gray-200',   label: 'No Access' },
          { cls: 'bg-sky-50   text-sky-700  border-sky-200',    label: 'View Only' },
          { cls: 'bg-green-50 text-green-700 border-green-200', label: 'Full Edit' },
        ].map(({ cls, label }) => (
          <span key={label} className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${cls}`}>{label}</span>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-2xl border border-gray-200 h-24 animate-pulse" />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && groups.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No permission groups yet. Create one to get started.</p>
        </div>
      )}

      {/* Group cards — rendered in fixed role hierarchy order */}
      {!loading && sortedGroups.length > 0 && (
        <div className="space-y-4">
          {sortedGroups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              isEditing={editingId === g.id}
              editMap={editMap}
              canManage={canManage}
              onEdit={() => startEdit(g)}
              onSave={() => saveEdit(g)}
              onCancel={cancelEdit}
              onDuplicate={() => handleDuplicate(g)}
              onDelete={() => setDeleteTarget(g)}
              onPermChange={(key, level) => setEditMap((prev) => ({ ...prev, [key]: level }))}
              isSaving={isSaving}
            />
          ))}
        </div>
      )}

      <CreateGroupModal isOpen={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      <DeleteConfirmModal group={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
    </div>
  );
};
