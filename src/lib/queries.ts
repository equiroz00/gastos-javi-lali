// ── src/lib/queries.ts ────────────────────────────────────────────────────────
// Hooks de lectura de datos remotos (TanStack Query). La caché la llena el
// onSnapshot de Firestore (en App.tsx) con datos ya validados por Zod; estos
// hooks solo LEEN de esa caché y se re-renderizan en vivo cuando cambia.
import { useQuery } from '@tanstack/react-query';
import type { Expense } from '../types';

export function useExpenses(): Expense[] {
  const { data } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    // No-op: los datos no vienen de acá sino del onSnapshot vía setQueryData.
    queryFn: () => Promise.resolve([] as Expense[]),
    initialData: [] as Expense[],
  });
  return data;
}
