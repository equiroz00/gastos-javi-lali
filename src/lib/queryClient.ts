// ── src/lib/queryClient.ts ────────────────────────────────────────────────────
// Cliente único de TanStack Query. Los datos llegan en tiempo real desde los
// onSnapshot de Firestore (no de refetch), así que apagamos los refetch
// automáticos y marcamos todo "fresco" permanentemente: la fuente viva es el
// snapshot, que actualiza la caché con queryClient.setQueryData.
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
    },
  },
});
