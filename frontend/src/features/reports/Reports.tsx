import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/features/dashboard/components/DashboardLayout';
import { BarChart3, ChevronRight, ArrowLeft, Lock } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import type { FeatureKey } from '@/types/auth';
import { UninvoicedBookings } from './pages/administration/UninvoicedBookings';
import { Cancellations }      from './pages/administration/Cancellations';
import { ClientCases }        from './pages/clinic/ClientCases';
import { ClinicalNotes }      from './pages/clinic/ClinicalNotes';
import { ProvidersPractice }  from './pages/clinic/ProvidersPractice';
import { InventoryItems }       from './pages/financials/InventoryItems';
import { AppointmentCosts }     from './pages/financials/AppointmentCosts';
import { BankingReport }        from './pages/financials/BankingReport';
import { AgeingDebtsReport }    from './pages/financials/AgeingDebtsReport';
import { RevenueReport }        from './pages/financials/RevenueReport';
import { CategoriesReport }     from './pages/financials/CategoriesReport';
import { AccountCreditsReport } from './pages/financials/AccountCreditsReport';
import { BulkFinancialReport }  from './pages/financials/BulkFinancialReport';
import { Occupancy }            from './pages/performance/Occupancy';
import { BusinessPerformance }  from './pages/performance/BusinessPerformance';
import { Outcome }              from './pages/performance/Outcome';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportMenu =
  | 'uninvoiced_bookings'
  | 'cancellations'
  | 'clients_cases'
  | 'clinical_notes'
  | 'providers_practice'
  | 'inventory_items'
  | 'appointment_costs'
  | 'banking'
  | 'ageing_debts'
  | 'revenue'
  | 'categories'
  | 'account_credits'
  | 'bulk_financial'
  | 'occupancy'
  | 'business_performance'
  | 'outcome_measures';

interface MenuItem {
  id:    ReportMenu;
  label: string;
}

interface SectionCard {
  id:         string;
  title:      string;
  featureKey: FeatureKey;
  items:      MenuItem[];
  cardBg:     string;
  headerBg:   string;
  titleColor: string;
  accentColor: string;
  rowHover:   string;
}

// ─── RBAC key map ─────────────────────────────────────────────────────────────
// 'none' → card visible but all items locked (opacity + lock icon)
// 'view' → items accessible; FeatureAccessGuard applied on subpage
// 'edit' → full interaction

const CARD_FEATURE_KEY: Record<string, FeatureKey> = {
  administration: 'reports_administration',
  clinic:         'reports_clinic',
  financial:      'reports_financial',
  performance:    'reports_performance',
};

// ─── Card / menu data ─────────────────────────────────────────────────────────

const CARDS: SectionCard[] = [
  {
    id:          'administration',
    title:       'Administration',
    featureKey:  'reports_administration',
    cardBg:      'bg-white border-2 border-orange-100',
    headerBg:    'bg-orange-50',
    titleColor:  'text-orange-700',
    accentColor: 'bg-orange-500',
    rowHover:    'hover:bg-orange-50 hover:text-orange-800',
    items: [
      { id: 'uninvoiced_bookings', label: 'Uninvoiced Bookings' },
      { id: 'cancellations',       label: 'Cancellations'       },
    ],
  },
  {
    id:          'clinic',
    title:       'Clinic',
    featureKey:  'reports_clinic',
    cardBg:      'bg-white border-2 border-blue-100',
    headerBg:    'bg-blue-50',
    titleColor:  'text-blue-700',
    accentColor: 'bg-blue-500',
    rowHover:    'hover:bg-blue-50 hover:text-blue-800',
    items: [
      { id: 'clients_cases',      label: 'Clients & Cases'      },
      { id: 'clinical_notes',     label: 'Clinical Notes'       },
      { id: 'providers_practice', label: 'Providers & Practice' },
    ],
  },
  {
    id:          'financial',
    title:       'Financial',
    featureKey:  'reports_financial',
    cardBg:      'bg-white border-2 border-green-100',
    headerBg:    'bg-green-50',
    titleColor:  'text-green-700',
    accentColor: 'bg-green-500',
    rowHover:    'hover:bg-green-50 hover:text-green-800',
    items: [
      { id: 'inventory_items',   label: 'Inventory Items'      },
      { id: 'appointment_costs', label: 'Appointment Costs'    },
      { id: 'banking',           label: 'Banking'              },
      { id: 'ageing_debts',      label: 'Ageing Debts'        },
      { id: 'revenue',           label: 'Revenue'              },
      { id: 'categories',        label: 'Categories'           },
      { id: 'account_credits',   label: 'Account Credits'      },
      { id: 'bulk_financial',    label: '⬇ Export All (PDF)'  },
    ],
  },
  {
    id:          'performance',
    title:       'Performance',
    featureKey:  'reports_performance',
    cardBg:      'bg-white border-2 border-purple-100',
    headerBg:    'bg-purple-50',
    titleColor:  'text-purple-700',
    accentColor: 'bg-purple-500',
    rowHover:    'hover:bg-purple-50 hover:text-purple-800',
    items: [
      { id: 'occupancy',            label: 'Occupancy'            },
      { id: 'business_performance', label: 'Business Performance' },
      { id: 'outcome_measures',     label: 'Outcome Measures'     },
    ],
  },
];

const REPORT_LABELS: Record<ReportMenu, string> = {
  uninvoiced_bookings: 'Uninvoiced Bookings',
  cancellations:       'Cancellations',
  clients_cases:       'Clients & Cases',
  clinical_notes:      'Clinical Notes',
  providers_practice:  'Providers & Practice',
  inventory_items:     'Inventory Items',
  appointment_costs:   'Appointment Costs',
  banking:             'Banking',
  ageing_debts:        'Ageing Debts',
  revenue:             'Revenue',
  categories:          'Categories',
  account_credits:     'Account Credits',
  bulk_financial:      'Bulk Financial Export',
  occupancy:           'Occupancy',
  business_performance:'Business Performance',
  outcome_measures:    'Outcome Measures',
};

const SECTION_FOR_MENU: Record<ReportMenu, string> = {
  uninvoiced_bookings: 'Administration',
  cancellations:       'Administration',
  clients_cases:       'Clinic',
  clinical_notes:      'Clinic',
  providers_practice:  'Clinic',
  inventory_items:     'Financial',
  appointment_costs:   'Financial',
  banking:             'Financial',
  ageing_debts:        'Financial',
  revenue:             'Financial',
  categories:          'Financial',
  account_credits:     'Financial',
  bulk_financial:      'Financial',
  occupancy:           'Performance',
  business_performance:'Performance',
  outcome_measures:    'Performance',
};

// ─── Restricted card overlay ──────────────────────────────────────────────────

const RestrictedOverlay: React.FC<{ title: string }> = ({ title }) => (
  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/70 backdrop-blur-[2px]">
    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
      <Lock className="w-5 h-5 text-gray-400" />
    </div>
    <div className="text-center px-4">
      <p className="text-sm font-semibold text-gray-500">{title}</p>
      <p className="text-xs text-gray-400 mt-0.5">Access restricted</p>
    </div>
  </div>
);

// ─── Single report card ───────────────────────────────────────────────────────

interface ReportCardProps {
  card:        SectionCard;
  isRestricted: boolean;
  onSelect:    (cardId: string, menuId: ReportMenu) => void;
}

const ReportCard: React.FC<ReportCardProps> = ({ card, isRestricted, onSelect }) => (
  <div className={`relative rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${card.cardBg} ${
    isRestricted ? 'opacity-50' : 'hover:shadow-md hover:border-opacity-60'
  }`}>
    {isRestricted && <RestrictedOverlay title={card.title} />}

    {/* Card header */}
    <div className={`${card.headerBg} px-6 py-5 flex items-center gap-3 border-b border-gray-100`}>
      <div className={`w-2 h-8 rounded-full ${card.accentColor}`} />
      <h2 className={`text-lg font-bold ${card.titleColor}`}>{card.title}</h2>
    </div>

    {/* Menu rows */}
    <div className="p-3 space-y-1">
      {card.items.map((item) => (
        <button
          key={item.id}
          onClick={() => !isRestricted && onSelect(card.id, item.id)}
          disabled={isRestricted}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 transition-colors text-left group ${
            isRestricted
              ? 'cursor-not-allowed'
              : `${card.rowHover} cursor-pointer`
          }`}
        >
          <span>{item.label}</span>
          {!isRestricted && (
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
          )}
        </button>
      ))}
    </div>
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export const Reports: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<ReportMenu | null>(null);
  const { accessLevel, isOwner } = usePermissions();

  const handleSelect = (cardId: string, menuId: ReportMenu) => {
    // Defense-in-depth: block navigation into a fully restricted card
    const featureKey = CARD_FEATURE_KEY[cardId];
    if (!isOwner && featureKey && accessLevel(featureKey) === 'none') return;
    setActiveMenu(menuId);
  };

  const handleBack = () => {
    setActiveMenu(null);
  };

  // Memoize restricted card IDs to avoid recalculating per render
  const restrictedCardIds = useMemo(
    () => new Set(
      CARDS
        .filter((c) => !isOwner && accessLevel(c.featureKey) === 'none')
        .map((c) => c.id)
    ),
    [isOwner, accessLevel],
  );

  const renderContent = () => {
    switch (activeMenu) {
      case 'uninvoiced_bookings': return <UninvoicedBookings />;
      case 'cancellations':       return <Cancellations />;
      case 'clients_cases':       return <ClientCases />;
      case 'clinical_notes':      return <ClinicalNotes />;
      case 'providers_practice':  return <ProvidersPractice />;
      case 'inventory_items':     return <InventoryItems />;
      case 'appointment_costs':   return <AppointmentCosts />;
      case 'banking':             return <BankingReport />;
      case 'ageing_debts':        return <AgeingDebtsReport />;
      case 'revenue':             return <RevenueReport />;
      case 'categories':          return <CategoriesReport />;
      case 'account_credits':     return <AccountCreditsReport />;
      case 'bulk_financial':      return <BulkFinancialReport />;
      case 'occupancy':           return <Occupancy />;
      case 'business_performance':return <BusinessPerformance />;
      case 'outcome_measures':    return <Outcome />;
      default:                    return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">

        {/* ── Page Header ── */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-gradient rounded-xl flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              {activeMenu ? (
                <>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
                    <button
                      onClick={handleBack}
                      className="hover:text-orange-500 transition-colors"
                    >
                      Reports
                    </button>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-gray-500">{SECTION_FOR_MENU[activeMenu]}</span>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-gray-700 font-medium">{REPORT_LABELS[activeMenu]}</span>
                  </div>
                  <h1 className="text-xl font-bold text-trust-harbor">{REPORT_LABELS[activeMenu]}</h1>
                </>
              ) : (
                <>
                  <h1 className="text-xl font-bold text-trust-harbor">Reports</h1>
                  <p className="text-xs text-steady-slate">Select a report to get started</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        {activeMenu ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="shrink-0 bg-gray-50 border-b border-gray-200 px-6 py-2">
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 text-sm text-steady-slate hover:text-care-blue transition-colors font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Reports
              </button>
            </div>
            {renderContent()}
          </div>
        ) : (
          /* ── 2×2 card grid ── */
          <div className="flex-1 overflow-y-auto px-8 py-8">
            <div className="max-w-5xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {CARDS.map((card) => (
                  <ReportCard
                    key={card.id}
                    card={card}
                    isRestricted={restrictedCardIds.has(card.id)}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};
