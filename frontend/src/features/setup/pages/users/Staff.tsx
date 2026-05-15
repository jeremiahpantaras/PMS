import React, { useState } from 'react';
import { Users, UserPlus, RefreshCw, Search } from 'lucide-react';
import { StaffTable }              from './components/StaffTable';
import { CreateStaffAccountModal } from '../../components/modals/CreateStaffAccountModal';
import { useStaffManagement }      from '../../hooks/useStaffManagement';
import type { CreateStaffData, StaffMember } from '../../types/staff.types';
import { useAuthStore }            from '@/store/auth.store';

export const Staff: React.FC = () => {
  const [isModalOpen, setIsModalOpen]     = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  const currentUser = useAuthStore(s => s.user);

  const {
    staff, loading, error,
    createStaff, updateStaff, deleteStaff,
    toggleStaffStatus, refreshStaff,
  } = useStaffManagement();

  const handleModalSubmit = async (data: CreateStaffData) => {
    if (selectedStaff) await updateStaff(selectedStaff.id, data);
    else               await createStaff(data);
  };

  const handleEdit = (s: StaffMember) => {
    setSelectedStaff(s);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedStaff(null);
  };

  const filteredStaff = staff.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      s.first_name.toLowerCase().includes(q) ||
      s.last_name.toLowerCase().includes(q)  ||
      s.email.toLowerCase().includes(q)      ||
      (s.position          ?? '').toLowerCase().includes(q) ||
      (s.clinic_branch_name ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Staff</h1>
            <p className="text-xs text-gray-400">Manage staff members and practitioners</p>
          </div>
        </div>
        <button
          onClick={() => { setSelectedStaff(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors text-sm font-semibold shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          New Staff Member
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, position…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition"
          />
        </div>

        <span className="text-xs text-gray-400 font-medium px-1">
          {filteredStaff.length} member{filteredStaff.length !== 1 ? 's' : ''}
        </span>

        <button
          onClick={refreshStaff}
          disabled={loading}
          className="p-2 border border-gray-200 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* ── Table ── */}
      <StaffTable
        staff={filteredStaff}
        loading={loading}
        currentUserId={currentUser?.id}
        onEdit={handleEdit}
        onDelete={async id => await deleteStaff(id)}
        onToggleStatus={async (id, isActive) => await toggleStaffStatus(id, isActive)}
      />

      {/* ── Modal ── */}
      <CreateStaffAccountModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
        editingStaff={selectedStaff}
        currentUserId={currentUser?.id}
      />
    </div>
  );
};