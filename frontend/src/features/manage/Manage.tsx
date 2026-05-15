import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Stethoscope, MessageSquare } from 'lucide-react';
import { DashboardLayout } from '@/features/dashboard/components/DashboardLayout';
import { ManageCard } from './components/ManageCard';
import { FeatureAccessGuard } from '@/components/auth/FeatureAccessGuard';
import { usePermissions } from '@/hooks/usePermissions';
import type { FeatureKey } from '@/types/auth';
import type { ManageCategory } from './types/manage.types';

import { AdminMenu1 } from './pages/administration/PrintAppointments';
import { AdminMenu2 } from './pages/administration/BulkInvoicing';
import { ClinicalMenu1 } from './pages/clinical/ClinicalMenu1';
import { ClinicalMenu2 } from './pages/clinical/ClinicalMenu2';
import { ClinicServices } from './pages/clinical/ClinicServices';
import { ClinicProfile } from './pages/clinical/ClinicProfile';
import { EmailReminder } from './pages/communications/EmailReminder';
import { Records } from './pages/communications/Records';
import { Notifications } from './pages/communications/Notifications';

// Maps each card id to its RBAC feature key
// 'none'  → card items locked in grid (restrictedItemIds)
// 'view'  → card is accessible; FeatureAccessGuard makes subpage read-only
// 'edit'  → full interaction
const CARD_FEATURE_KEY: Record<string, FeatureKey> = {
  administration: 'manage_administration',
  clinical:       'manage_clinical',
  communications: 'manage_communications',
};

const CARD_FEATURE_LABEL: Record<string, string> = {
  administration: 'Manage – Administration',
  clinical:       'Manage – Clinical',
  communications: 'Manage – Communications',
};

const MANAGE_CATEGORIES: ManageCategory[] = [
  {
    id: 'administration',
    label: 'Administration',
    description: 'Reports, invoicing, and print operations',
    icon: ClipboardList,
    color: 'bg-indigo-500',
    bgColor: 'bg-indigo-50',
    items: [
      { id: 'admin1', label: 'Print Appointments', path: 'admin1', component: AdminMenu1 },
      { id: 'admin2', label: 'Bulk Invoicing',     path: 'admin2', component: AdminMenu2 },
    ],
  },
  {
    id: 'clinical',
    label: 'Clinical',
    description: 'Templates, services, and clinic configuration',
    icon: Stethoscope,
    color: 'bg-teal-500',
    bgColor: 'bg-teal-50',
    items: [
      { id: 'clinical1', label: 'Clinic Link Portal',  path: 'clinical1', component: ClinicalMenu1 },
      { id: 'clinical2', label: 'Clinical Templates',  path: 'clinical2', component: ClinicalMenu2 },
      { id: 'clinical3', label: 'Clinic Services',     path: 'clinical3', component: ClinicServices },
      { id: 'clinical4', label: 'Clinic Profile',      path: 'clinical4', component: ClinicProfile },
    ],
  },
  {
    id: 'communications',
    label: 'Communications',
    description: 'Reminders, records, and notifications',
    icon: MessageSquare,
    color: 'bg-sky-500',
    bgColor: 'bg-sky-50',
    items: [
      { id: 'comm1', label: 'Email Reminder', path: 'comm1', component: EmailReminder },
      { id: 'comm2', label: 'Records',        path: 'comm2', component: Records },
      { id: 'comm3', label: 'Notifications',  path: 'comm3', component: Notifications },
    ],
  },
];

export const Manage: React.FC = () => {
  const location = useLocation();
  const { accessLevel, isOwner } = usePermissions();

  const [activeCategory, setActiveCategory] = useState<string | null>(() => {
    const s = location.state as { activeCategory?: string; activeItem?: string } | null;
    return s?.activeCategory ?? null;
  });
  const [activeItem, setActiveItem] = useState<string | null>(() => {
    const s = location.state as { activeCategory?: string; activeItem?: string } | null;
    return s?.activeItem ?? null;
  });

  // Clear navigation state so a page refresh doesn't re-apply it
  useEffect(() => {
    if (location.state) window.history.replaceState({}, '');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Returns item IDs that should be locked (no-access) for the given card
  const getRestrictedItemIds = (cardId: string): string[] => {
    if (isOwner) return [];
    const featureKey = CARD_FEATURE_KEY[cardId];
    if (!featureKey || accessLevel(featureKey) !== 'none') return [];
    return MANAGE_CATEGORIES.find((c) => c.id === cardId)?.items.map((i) => i.id) ?? [];
  };

  const handleItemSelect = (categoryId: string, itemId: string) => {
    // Defense-in-depth: block navigation into a fully restricted card
    const featureKey = CARD_FEATURE_KEY[categoryId];
    if (!isOwner && featureKey && accessLevel(featureKey) === 'none') return;
    setActiveCategory(categoryId);
    setActiveItem(itemId);
  };

  const handleBackToCards = () => {
    setActiveCategory(null);
    setActiveItem(null);
  };

  const ActiveComponent = useMemo(() => {
    if (!activeCategory || !activeItem) return null;
    return MANAGE_CATEGORIES
      .find((cat) => cat.id === activeCategory)
      ?.items.find((item) => item.id === activeItem)?.component ?? null;
  }, [activeCategory, activeItem]);

  const activeLabel = useMemo(() => {
    if (!activeCategory || !activeItem) return '';
    return MANAGE_CATEGORIES
      .find((cat) => cat.id === activeCategory)
      ?.items.find((item) => item.id === activeItem)?.label ?? '';
  }, [activeCategory, activeItem]);

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden bg-linear-to-br from-gray-50 to-gray-100">

        {/* ── Subpage View ── */}
        {ActiveComponent ? (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Back button header */}
            <div className="shrink-0 border-b border-gray-200 bg-white/80 backdrop-blur-sm px-6 py-4">
              <button
                onClick={handleBackToCards}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Manage</span>
              </button>
              {activeLabel && (
                <h2 className="text-base font-semibold text-gray-800 mt-1 ml-6">{activeLabel}</h2>
              )}
            </div>

            {/* Subpage content — FeatureAccessGuard enforces view vs edit access.
                'view' access → pointer-events blocked + toast on first render.
                'edit' access → fully interactive. */}
            <div className="flex-1 overflow-y-auto">
              <FeatureAccessGuard
                feature={CARD_FEATURE_KEY[activeCategory ?? '']}
                required="edit"
                featureLabel={CARD_FEATURE_LABEL[activeCategory ?? '']}
              >
                <ActiveComponent />
              </FeatureAccessGuard>
            </div>
          </div>

        ) : (
          <>
            {/* ── Page Header ── */}
            <div className="shrink-0 border-b border-gray-200 bg-white/80 backdrop-blur-sm px-8 py-6">
              <h1 className="text-2xl font-bold text-gray-900">Manage</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Manage your clinic's administration, clinical settings, and communications
              </p>
            </div>

            {/* ── Cards Grid — 3 columns ── */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-5xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {MANAGE_CATEGORIES.map((card) => (
                    <ManageCard
                      key={card.id}
                      card={card}
                      onItemSelect={handleItemSelect}
                      restrictedItemIds={getRestrictedItemIds(card.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};
