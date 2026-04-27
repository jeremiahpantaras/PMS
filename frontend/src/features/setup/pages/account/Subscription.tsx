import React, { useEffect } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useSubscription } from '@/features/setup/hooks/useSubscription';
import { getSafeDaysRemaining, isSubscriptionActive } from '@/features/setup/services/subscription.api';
import {
  MONTHLY_PLAN_PRICE,
  formatDateTime,
  formatPlanLabel,
  formatStatusLabel,
  getStatusBadgeClasses,
  getTrialProgressPercent,
} from './subscription.utils';

export const Subscription: React.FC = () => {
  const {
    subscription,
    isLoading,
    isFetching,
    isError,
    error,
    refresh,
    startCheckout,
    isStartingCheckout,
  } = useSubscription();

  const daysRemaining = getSafeDaysRemaining(subscription);
  const isActive = isSubscriptionActive(subscription);
  const trialProgress = getTrialProgressPercent(subscription);

  // Handle redirect back from PayMongo checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');

    if (payment === 'success') {
      toast.success(
        'Payment received! Your subscription is being activated. Please refresh in a moment.',
        { duration: 6000 },
      );
      // Remove query param without reloading
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh subscription status to reflect webhook activation
      setTimeout(() => refresh(), 3000);
    } else if (payment === 'cancelled') {
      toast('Payment cancelled. You can try again whenever you\'re ready.', {
        icon: '↩',
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartCheckout = async () => {
    await startCheckout();
    // On success, useCreateCheckout redirects window.location — no further action needed
  };

  const errorMessage =
    (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data?.message ||
    (error as { response?: { data?: { message?: string; detail?: string } } })?.response?.data?.detail ||
    'Failed to load subscription details.';

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 min-h-65 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading subscription details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !subscription) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-red-200 p-8">
          <div className="flex items-center gap-3 text-red-700 mb-3">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-lg font-bold">Unable to load subscription</h2>
          </div>
          <p className="text-sm text-red-600 mb-5">{errorMessage}</p>
          <button
            type="button"
            onClick={() => refresh()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-7">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Subscription</h2>
              <p className="text-sm text-gray-600">Manage your trial and monthly plan</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => refresh()}
            disabled={isFetching}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>

        {!isActive && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">Subscription access restricted</p>
              <p className="text-xs text-red-600 mt-0.5">
                Your trial has expired. Subscribe now to restore full access to Malasakit.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
          <div className="xl:col-span-2 rounded-xl border border-gray-200 p-4 md:p-5 bg-linear-to-r from-emerald-50 to-sky-50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide font-semibold text-gray-500">Current Plan</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatPlanLabel(subscription.plan)}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${getStatusBadgeClasses(subscription.status)}`}
              >
                {isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {formatStatusLabel(subscription.status)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div className="rounded-lg bg-white/80 border border-white px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Start Date</p>
                <p className="text-sm text-gray-800 mt-0.5">{formatDateTime(subscription.start_date)}</p>
              </div>
              <div className="rounded-lg bg-white/80 border border-white px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">End Date</p>
                <p className="text-sm text-gray-800 mt-0.5">{formatDateTime(subscription.end_date)}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-white/80 border border-white px-2.5 py-1 rounded-full">
                <Clock3 className="w-3.5 h-3.5 text-sky-600" />
                {daysRemaining} day{daysRemaining === 1 ? '' : 's'} remaining
              </span>
              {subscription.is_trial && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full">
                  <Sparkles className="w-3.5 h-3.5" />
                  Trial Mode
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 md:p-5 bg-white">
            <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-2">
              Plan Summary
            </p>
            <div className="space-y-2 text-sm text-gray-700">
              <p className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Full feature access
              </p>
              <p className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-600" />
                14-day trial then monthly billing
              </p>
              <p className="font-semibold text-gray-900 pt-2">
                Monthly Rate: <span className="text-emerald-700">PHP {MONTHLY_PLAN_PRICE}</span>
              </p>
            </div>
          </div>
        </div>

        {subscription.is_trial && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-sm font-semibold text-amber-800">Trial Progress</p>
              <p className="text-xs text-amber-700">{Math.round(trialProgress)}% used</p>
            </div>
            <div className="w-full h-2 rounded-full bg-amber-100 overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: `${trialProgress}%` }}
              />
            </div>
            <p className="text-xs text-amber-700 mt-2">
              Upgrade anytime to avoid access interruption after trial expiration.
            </p>
          </div>
        )}

        {/* PayMongo Checkout CTA */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Subscribe via PayMongo</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Pay securely with GCash or Credit/Debit Card. Subscription activates instantly after payment.
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartCheckout}
            disabled={isStartingCheckout || (isActive && subscription.plan === 'MONTHLY')}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isStartingCheckout ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirecting to PayMongo...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Pay PHP {MONTHLY_PLAN_PRICE} / month
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};