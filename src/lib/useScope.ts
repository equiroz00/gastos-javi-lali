// ── src/lib/useScope.ts ───────────────────────────────────────────────────────
// Vista "Compartidos / Solo tuyo". Un solo interruptor para toda la app,
// recordado por persona (userPreferences/{usuario}.scope, como el tema).
import { useMemo } from 'react';
import useAppStore from '../store/useAppStore';
import { useExpenses } from './queries';
import { scopeExpenses } from './helpers';
import type { ScopedExpense, Scope } from './helpers';

export function useScope(): { scope: Scope; isMine: boolean; user: string | null; setScope: (s: Scope) => void } {
  const scope    = useAppStore(s => s.userScope);
  const user     = useAppStore(s => s.currentUser);
  const setScope = useAppStore(s => s.saveUserScope);
  return { scope, isMine: scope === 'mine', user, setScope };
}

// Gastos ya adaptados a la vista elegida. En "Solo tuyo" cada gasto es una
// copia cuyo monto es tu parte (ver scopeExpenses en helpers.ts): las pantallas
// suman y grafican como siempre, sin hacer su propia cuenta.
export function useScopedExpenses(): ScopedExpense[] {
  const expenses = useExpenses();
  const { scope, user } = useScope();
  return useMemo(() => scopeExpenses(expenses, scope, user), [expenses, scope, user]);
}
