import { QueryClient } from "@tanstack/react-query";

/** Cliente único do React Query (usado pelo App e por invalidações fora de componentes). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min
      gcTime: 1000 * 60 * 30, // 30 min
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
