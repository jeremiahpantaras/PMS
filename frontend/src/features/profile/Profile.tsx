import React, { useState } from 'react';
import { DashboardLayout }      from '@/features/dashboard/components/DashboardLayout';
import { ProfileHeader }        from './components/ProfileHeader';
import { ProfileAvatarUpload }  from './components/ProfileAvatarUpload';
import { ProfileInfoCard }      from './components/ProfileInfoCard';
import { AccountSettingsCard }  from './components/AccountSettingsCard';
import { useProfile }           from './hooks/useProfile';
import { useAuth }              from '@/hooks/useAuth';
import { Loader2 }              from 'lucide-react';

export const Profile: React.FC = () => {
  const { user: authUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);  // Track edit mode state

  const {
    user,
    isSaving,
    isResettingPw: _isResettingPw,
    isUpdatingPw,
    saveProfile,
    saveAvatar,
    deleteAvatar,
    clearPendingAvatar,
    doResetPassword: _doResetPassword,
    doUpdatePassword,
  } = useProfile(authUser ?? null);

  // Debug: Log edit mode changes
  const handleEditingChange = (editing: boolean) => {
    console.log('[Profile] Edit mode changed:', editing);
    setIsEditing(editing);
    if (!editing) {
      console.log('[Profile] Canceling edit - clearing pending avatar');
      clearPendingAvatar();
    }
  };

  if (!user) {
    return (
      <DashboardLayout>
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-sky-500 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">

        {/* ── Page Header ── */}
        <ProfileHeader user={user} />

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col xl:flex-row gap-6">

              {/* ── Left: Avatar card ── */}
              <div className="xl:w-72 flex-shrink-0">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7
                                flex flex-col items-center gap-5 sticky top-6">
                  <ProfileAvatarUpload
                    avatarUrl={user.avatar_url ?? user.avatar}
                    isUploading={false}
                    isRemoving={false}
                    onFileSelect={saveAvatar}
                    onRemove={deleteAvatar}
                    disabled={!isEditing}  // Only allow avatar changes in edit mode
                  />

                  {/* Identity summary */}
                  <div className="text-center w-full pt-4 border-t border-gray-100">
                    <p className="text-base font-bold text-gray-900 truncate">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate mt-1">{user.email}</p>
                  </div>

                  {/* Info rows */}
                  <div className="w-full space-y-3 pt-1">
                    {[
                      { label: 'Role',   value: user.role },
                      { label: 'Status', value: user.is_active ? 'Active' : 'Inactive' },
                      {
                        label: 'Joined',
                        value: new Date(user.created_at).toLocaleDateString('en-PH', {
                          year: 'numeric', month: 'short', day: 'numeric',
                        }),
                      },
                    ].map(row => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between
                                   bg-gray-50 rounded-xl px-4 py-2.5"
                      >
                        <span className="text-xs text-gray-400 font-medium">{row.label}</span>
                        <span className={`text-xs font-bold truncate ml-2 max-w-[130px] text-right
                          ${row.label === 'Status'
                            ? user.is_active
                              ? 'text-emerald-600'
                              : 'text-red-500'
                            : 'text-gray-700'
                          }`}>
                          {row.label === 'Status' && (
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 mb-0.5
                              ${user.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                          )}
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Right: Info + Reset Password ── */}
              <div className="flex-1 min-w-0 space-y-6">
                <ProfileInfoCard
                  user={user}
                  isSaving={isSaving}
                  onSave={saveProfile}
                  onEditingChange={handleEditingChange}
                />
                <AccountSettingsCard
                  currentRotation={user.password_rotation ?? 'none'}
                  isUpdating={isUpdatingPw}
                  onUpdate={doUpdatePassword}
                />
              </div>

            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};