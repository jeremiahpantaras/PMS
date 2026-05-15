import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient instance.
 *
 * Exported so that the auth store can call `queryClient.clear()` on logout,
 * preventing cross-clinic data leakage when a different clinic user signs in
 * on the same browser tab.
 */
export const queryClient = new QueryClient();
