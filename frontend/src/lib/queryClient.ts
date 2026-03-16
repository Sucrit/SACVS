import { QueryClient } from '@tanstack/react-query';

// Create a single client instance for the entire application
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data remains fresh for 5 minutes. No background fetch is triggered if data is requested within this window.
      staleTime: 1000 * 60 * 5, 
      
      // Inactive data stays in memory for 15 minutes before being garbage collected.
      gcTime: 1000 * 60 * 15,   
      
      // Disable automatic refetching when the user switches browser tabs back and forth.
      refetchOnWindowFocus: false, 
      
      // Only retry failed requests once to avoid unnecessary network spam on definitive errors.
      retry: 1,
    },
  },
});
