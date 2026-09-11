import { QueryClient } from "@tanstack/react-query";

/**
 * TanStack Query client for non-reactive fetching (FastAPI endpoints).
 * Convex subscriptions manage their own lifecycle and do not run through
 * this cache; the provider is still mounted once for future imperative
 * queries and mutations.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
