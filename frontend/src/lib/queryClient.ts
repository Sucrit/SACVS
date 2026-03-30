import { QueryClient } from '@tanstack/react-query';

// Create a single client instance for the entire application
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Most app data can tolerate short-term caching, but should refresh reasonably quickly when users return.
      staleTime: 1000 * 60,

      // Inactive data stays in memory for 15 minutes before being garbage collected.
      gcTime: 1000 * 60 * 15,

      // Refetch stale queries when the user returns to the tab so we do not keep showing old data.
      refetchOnWindowFocus: true,

      // Only retry failed requests once to avoid unnecessary network spam on definitive errors.
      retry: 1,
    },
  },
});
