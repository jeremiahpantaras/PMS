import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/features/dashboard/components/DashboardLayout';
import { ArrowLeft, Building2, Package, Users, CreditCard, Bell } from 'lucide-react';
import { SetupCard as SetupCardComponent } from './components/SetupCard';
import { FeatureAccessGuard } from '@/components/auth/FeatureAccessGuard';
import { usePermissions } from '@/hooks/usePermissions';
import type { SetupCard } from './types/setup.types';
import type { FeatureKey } from '@/types/auth';

// Import all subpage components
import { PracticeOption1 } from './pages/practice/Locations';
import { PracticeOption2 } from './pages/practice/Invoicing';
import { Inventory } from './pages/items/Inventory';
import { Staff } from './pages/users/Staff';
import { Permissions } from './pages/users/Permissions';
import { Subscription } from './pages/account/Subscription';
import CommunicationSettings from './pages/communication/CommunicationSettings';
import CommunicationLogs from './pages/communication/CommunicationLogs';
import { ConsentFormEditor } from './pages/practice/ConsentFormEditor';

// ─── Card → Feature key mapping ───────────────────────────────────────────────
// Each Setup card maps to its own granular RBAC feature key.
// 'none'  → card options are disabled / locked in the grid
// 'view'  → card is accessible; FeatureAccessGuard makes subpage read-only
// 'edit'  → full interaction

const CARD_FEATURE_KEY: Record<string, FeatureKey> = {
  practice:      'setup_practice',
  items:         'setup_items',
  users:         'setup_users',
  account:       'setup_account',
  communication: 'setup_communication',
};

const CARD_FEATURE_LABEL: Record<string, string> = {
  practice:      'Setup – Practice',
  items:         'Setup – Items',
  users:         'Setup – Users',
  account:       'Setup – Account',
  communication: 'Setup – Communication',
};

// Define setup cards
const SETUP_CARDS: SetupCard[] = [
  {
    id: 'practice',
    title: 'Practice',
    icon: Building2,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    options: [
      { id: 'option1', label: 'Locations', component: PracticeOption1 },
      { id: 'option2', label: 'Invoicing', component: PracticeOption2 },
      { id: 'consent-form', label: 'Consent Form', component: ConsentFormEditor },
    ],
  },
  {
    id: 'items',
    title: 'Items',
    icon: Package,
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    options: [
      { id: 'Inventory', label: 'Inventory', component: Inventory },
    ],
  },
  {
    id: 'users',
    title: 'Users',
    icon: Users,
    color: 'bg-teal-500',
    bgColor: 'bg-teal-50',
    options: [
      { id: 'staff', label: 'Staff', component: Staff },
      { id: 'permissions', label: 'Permissions', component: Permissions },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    icon: CreditCard,
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-50',
    options: [
      { id: 'subscription', label: 'Subscription', component: Subscription },
    ],
  },
  {
    id: 'communication',
    title: 'Communication',
    icon: Bell,
    color: 'bg-sky-500',
    bgColor: 'bg-sky-50',
    options: [
      { id: 'comm-settings', label: 'Settings', component: CommunicationSettings },
      { id: 'comm-logs', label: 'Logs', component: CommunicationLogs },
    ],
  },
];

export const Setup: React.FC = () => {
  const [selectedCard,   setSelectedCard]   = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const { accessLevel, isOwner } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * Returns all option IDs for a card whose feature key has 'none' access.
   * These IDs are forwarded to SetupCardComponent as `restrictedOptionIds`
   * so the card grid shows the disabled / lock-icon state.
   */
  const getRestrictedOptionIds = (cardId: string): string[] => {
    if (isOwner) return [];
    const featureKey = CARD_FEATURE_KEY[cardId];
    if (!featureKey || accessLevel(featureKey) !== 'none') return [];
    return SETUP_CARDS.find((c) => c.id === cardId)?.options.map((o) => o.id) ?? [];
  };

  // Handle deep-link navigation via URL params (?card=X&option=Y)
  React.useEffect(() => {
    if (selectedCard || selectedOption) return;

    const params = new URLSearchParams(location.search);
    const card   = params.get('card');
    const option = params.get('option');

    if (!card || !option) return;

    const targetCard   = SETUP_CARDS.find((c) => c.id === card);
    const targetOption = targetCard?.options.find((opt) => opt.id === option);
    if (!targetCard || !targetOption) return;

    // Block deep-link into a fully restricted card
    const featureKey = CARD_FEATURE_KEY[card];
    if (!isOwner && featureKey && accessLevel(featureKey) === 'none') return;

    setSelectedCard(card);
    setSelectedOption(option);
    navigate('/setup', { replace: true });
  }, [location.search, isOwner, accessLevel, selectedCard, selectedOption, navigate]);

  const handleOptionClick = (cardId: string, optionId: string) => {
    // Defense-in-depth: card button is already disabled for 'none' access,
    // but guard here too so programmatic calls are also blocked.
    const featureKey = CARD_FEATURE_KEY[cardId];
    if (!isOwner && featureKey && accessLevel(featureKey) === 'none') return;

    setSelectedCard(cardId);
    setSelectedOption(optionId);
  };

  const handleBackToCards = () => {
    setSelectedCard(null);
    setSelectedOption(null);
    if (location.search) {
      navigate('/setup', { replace: true });
    }
  };

  // Resolve the active subpage component
  const activeCard      = selectedCard ? SETUP_CARDS.find((c) => c.id === selectedCard) : null;
  const ActiveComponent = activeCard && selectedOption
    ? activeCard.options.find((opt) => opt.id === selectedOption)?.component
    : null;

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
                <span className="text-sm font-medium">Back to Setup</span>
              </button>
            </div>

            {/* Subpage content — FeatureAccessGuard enforces view vs edit access.
                'view' → pointer-events-none overlay + toast ("view only").
                'edit' → full interaction. */}
            <div className="flex-1 overflow-y-auto">
              {selectedCard && CARD_FEATURE_KEY[selectedCard] ? (
                <FeatureAccessGuard
                  feature={CARD_FEATURE_KEY[selectedCard]}
                  required="edit"
                  featureLabel={CARD_FEATURE_LABEL[selectedCard]}
                >
                  <ActiveComponent />
                </FeatureAccessGuard>
              ) : (
                <ActiveComponent />
              )}
            </div>
          </div>

        ) : (
          <>
            {/* ── Page Header ── */}
            <div className="shrink-0 border-b border-gray-200 bg-white/80 backdrop-blur-sm px-8 py-6">
              <h1 className="text-2xl font-bold text-gray-900">Setup</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Configure your practice settings and preferences
              </p>
            </div>

            {/* ── Cards Grid — 2 cols × 3 rows ── */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-4xl mx-auto">
                <div className="grid grid-cols-2 gap-6">
                  {SETUP_CARDS.map((card) => (
                    <SetupCardComponent
                      key={card.id}
                      card={card}
                      onOptionClick={handleOptionClick}
                      restrictedOptionIds={getRestrictedOptionIds(card.id)}
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