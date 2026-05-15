import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Contact, 
  BarChart3, 
  FolderCog, 
  Settings
} from 'lucide-react';
import type { FeatureKey } from '@/types/auth';

export interface SidebarItem {
  id: string;
  label: string;
  path: string;
  icon: any;
  badge?: number;
  /** Legacy role-gate: show only to admins. Prefer featureKey when possible. */
  adminOnly?: boolean;
  /**
   * RBAC feature key — if set, this item is hidden when the user has
   * 'none' access to the feature.  ADMIN users always see everything.
   */
  featureKey?: FeatureKey;
}

export const sidebarItems: SidebarItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    featureKey: 'dashboard',
  },
  {
    id: 'diary',
    label: 'Diary',
    path: '/diary',
    icon: Calendar,
    featureKey: 'diary',
  },
  {
    id: 'clients',
    label: 'Clients',
    path: '/clients',
    icon: Users,
    featureKey: 'patients',
  },
  {
    id: 'contacts', 
    label: 'Contacts',
    path: '/contacts',
    icon: Contact,
    featureKey: 'contacts',
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/reports',
    icon: BarChart3,
    featureKey: 'reports',
  },
  {
    id: 'manage',
    label: 'Manage',
    path: '/manage',
    icon: FolderCog,
    featureKey: 'inventory',
  },
  {
    id: 'setup',
    label: 'Setup',
    path: '/setup',
    icon: Settings,
    featureKey: 'setup',
  },
];