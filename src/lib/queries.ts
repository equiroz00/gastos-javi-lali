// ── src/lib/queries.ts ────────────────────────────────────────────────────────
// Hooks de lectura de datos remotos (TanStack Query). La caché la llena el
// onSnapshot de Firestore (en App.tsx) con datos ya validados por Zod; estos
// hooks solo LEEN de esa caché y se re-renderizan en vivo cuando cambia.
import { useQuery } from '@tanstack/react-query';
import type { Expense, Payment, Plan, Settings } from '../types';

export function useExpenses(): Expense[] {
  const { data } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    // No-op: los datos no vienen de acá sino del onSnapshot vía setQueryData.
    queryFn: () => Promise.resolve([] as Expense[]),
    initialData: [] as Expense[],
  });
  return data;
}

export function usePayments(): Payment[] {
  const { data } = useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: () => Promise.resolve([] as Payment[]),
    initialData: [] as Payment[],
  });
  return data;
}

export function usePlans(): Plan[] {
  const { data } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: () => Promise.resolve([] as Plan[]),
    initialData: [] as Plan[],
  });
  return data;
}

const SETTINGS_INIT: Settings = { periods: [], theme: 'default', font: 'Nunito' };

export function useSettings(): Settings {
  const { data } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => Promise.resolve(SETTINGS_INIT),
    initialData: SETTINGS_INIT,
  });
  return data;
}

export function useCustomCats(): string[] {
  const { data } = useQuery<string[]>({
    queryKey: ['customCats'],
    queryFn: () => Promise.resolve([] as string[]),
    initialData: [] as string[],
  });
  return data;
}
