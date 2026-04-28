import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import {
  subscriptionApi,
  type CheckoutSessionResponse,
  type SubscriptionStatusResponse,
} from '../services/subscription.api';

export const SUBSCRIPTION_QUERY_KEYS = {
  status: ['subscription', 'status'] as const,
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  const e = error as { response?: { data?: { message?: string; detail?: string; error?: string } } };
  return (
    e?.response?.data?.message ||
    e?.response?.data?.detail ||
    e?.response?.data?.error ||
    fallback
  );
};

export const useSubscriptionStatus = (enabled = true) => {
  return useQuery<SubscriptionStatusResponse>({
    queryKey: SUBSCRIPTION_QUERY_KEYS.status,
    queryFn: subscriptionApi.getStatus,
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
};

/**
 * Creates a PayMongo Checkout Session and redirects the browser to the
 * PayMongo hosted checkout page. Subscription activation happens via webhook.
 */
export const useCreateCheckout = () => {
  return useMutation<CheckoutSessionResponse, unknown, void>({
    mutationFn: subscriptionApi.createCheckout,
    onSuccess: (data) => {
      // Full page redirect to PayMongo checkout (GCash / Card)
      window.location.href = data.checkout_url;
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Unable to start payment. Please try again.'));
    },
  });
};

export const useSubscription = () => {
  const statusQuery = useSubscriptionStatus(true);
  const checkoutMutation = useCreateCheckout();

  return {
    subscription: statusQuery.data,
    isLoading: statusQuery.isLoading,
    isFetching: statusQuery.isFetching,
    isError: statusQuery.isError,
    error: statusQuery.error,
    refresh: statusQuery.refetch,
    startCheckout: checkoutMutation.mutateAsync,
    isStartingCheckout: checkoutMutation.isPending,
  };
};

