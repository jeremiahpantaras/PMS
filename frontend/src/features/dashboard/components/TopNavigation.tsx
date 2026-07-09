import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, LogOut, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLogoutConfirm } from '@/hooks/useLogoutConfirm';
import { usePermissions } from '@/hooks/usePermissions';
import { sidebarItems } from './sidebarItems';
import MESLogo from '@/assets/malasakit/Icon - Colored.svg';

export const TopNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { open: openLogoutConfirm } = useLogoutConfirm();
  const { isOwner } = usePermissions();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const visibleMenuItems = sidebarItems.filter((item) => {
    // Legacy adminOnly gate
    if (item.adminOnly && !isOwner) return false;
    return true;
  });

  const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Administrator',
    ADMIN_ASSISTANT: 'Admin Assistant',
    PRACTITIONER: 'Practitioner',
    STAFF: 'Staff',
    FINANCE: 'Finance',
    READ_ONLY: 'Read-Only',
  };
  const roleLabel = user?.role ? ROLE_LABELS[user.role] ?? user.role : '';

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsMobileOpen(false);
  };

  const handleProfileClick = () => {
    navigate('/profile');
    setIsMobileOpen(false);
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMobileOpen(false);
    openLogoutConfirm();
  };

  return (
    <>
      {/* ── Fixed Top Navbar ── */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-primary-gradient text-white z-50 flex items-center justify-between px-4 shadow-md">
        {/* Left: Logo & Mobile Toggle */}
        <div className="flex items-center gap-4">
          {/* Mobile Hamburger */}
          <button
            onClick={() => setIsMobileOpen(true)}
            className="xl:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6 text-white" />
          </button>

          {/* Logo (Clickable to Dashboard) */}
          <button
            onClick={() => handleNavigation('/dashboard')}
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <img src={MESLogo} alt="Logo" className="w-8 h-8 filter brightness-0 invert" />
            <span className="font-bold text-lg font-heading hidden sm:block">Malasakit</span>
          </button>
        </div>

        {/* Center: Desktop Navigation */}
        <nav className="hidden xl:flex items-center gap-1 overflow-x-auto mx-4">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);

            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                className={`
                  flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap
                  ${isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-white/80'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: User Profile */}
        <div className="flex items-center">
          <div className="relative group cursor-pointer" onClick={handleProfileClick}>
            <div className="flex items-center gap-3 hover:bg-white/10 p-1.5 rounded-xl transition-colors">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-white truncate max-w-[120px]">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-white/80">{roleLabel}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-sm">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </span>
                )}
              </div>
            </div>

            {/* Dropdown Menu (Desktop Hover) */}
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right z-50">
              <div className="p-2">
                <button
                  onClick={handleProfileClick}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  My Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile Drawer ── */}
      {/* Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] xl:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className={`
          fixed top-0 left-0 bottom-0 w-64 bg-white z-[70] transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col xl:hidden
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-primary-gradient">
          <div className="flex items-center gap-2">
            <img src={MESLogo} alt="Logo" className="w-8 h-8 filter brightness-0 invert" />
            <span className="font-bold text-lg text-white font-heading">Malasakit</span>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);

            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm
                  ${isActive
                    ? 'bg-care-blue/10 text-care-blue'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-care-blue' : 'text-gray-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-care-blue/20 border border-care-blue/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-care-blue font-bold">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-900 truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-gray-500 truncate">{roleLabel}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};
