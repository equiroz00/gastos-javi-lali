// ── src/lib/helpers.ts ────────────────────────────────────────────────────────
import { CUR_SYM, PENDING_PER } from '../constants';
import type { Expense, Plan, Payment, Period, Currency, Responsible, UserName } from '../types';

// ── Formatting ────────────────────────────────────────────────────────────────
// Fecha local del dispositivo (no UTC): toISOString() devolvía la fecha de
// mañana entre las 21:00 y medianoche en Argentina (UTC-3).
export function todayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

// ID único — Date.now() podía colisionar entre dos dispositivos y setDoc
// sobrescribiría el documento del otro sin aviso.
export function genId(prefix?: string): string {
  const uuid = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  return prefix ? prefix + '_' + uuid : uuid;
}

// Round to 2 decimal places — used across all monetary calculations
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Full number format (no K/M abbreviation) with up to 2 decimal places
// Used in balance bubbles and anywhere precise amounts are shown
export function fmt(n: number, c?: Currency): string {
  const cur = c || 'ARS';
  const sym = (CUR_SYM as Record<string, string>)[cur] || (cur + ' ');
  return sym + Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function fmtS(n: number, c?: Currency): string {
  const cur = c || 'ARS';
  const a = Math.abs(n);
  const s = (CUR_SYM as Record<string, string>)[cur] || cur;
  return a >= 1e6 ? s + (a / 1e6).toFixed(1) + 'M'
       : a >= 1e3 ? s + (a / 1e3).toFixed(0) + 'K'
       : s + Math.round(a);
}

export function safeN(v: unknown): number {
  const n = parseFloat(String(v));
  return isFinite(n) && !isNaN(n) ? n : 0;
}

export function catEm(cat?: string): string {
  if (!cat) return '📦';
  const m = cat.match(/^(\p{Emoji})/u);
  return m ? m[1] : '📦';
}

export function catLb(cat?: string): string {
  return cat ? (cat.replace(/^\p{Emoji}\s*/u, '').trim() || cat) : 'Otro';
}

export function normCat(cat: string, cats: string[]): string {
  if (!cat || typeof cat !== 'string') return 'Otro';
  const exact = cats.find(c => c === cat.trim());
  if (exact) return exact;
  const s = cat.replace(/^\p{Emoji}\s*/u, '').trim().toLowerCase();
  const m = cats.find(c => c.replace(/^\p{Emoji}\s*/u, '').trim().toLowerCase() === s);
  return m || cat.trim();
}

export function sortByDate(exps: Expense[]): Expense[] {
  return exps.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export function pctChange(cur: number, prev: number): number | null {
  return prev === 0 ? null : Math.round((cur - prev) / prev * 100);
}

export function getWeekStart(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Calculations ──────────────────────────────────────────────────────────────
export function calcAmts(amt: string | number, resp: Responsible): { javiAmount: number; laliAmount: number } {
  const n = safeN(amt);
  if (resp === 'Javi') return { javiAmount: round2(n), laliAmount: 0 };
  if (resp === 'Lali') return { javiAmount: 0, laliAmount: round2(n) };
  return { javiAmount: round2(n / 2), laliAmount: round2(n / 2) };
}

// Divide `total` según el porcentaje de Javi (0–100). Garantiza dos cosas:
//   1. javiAmount + laliAmount === round2(total) exacto (sin centavos perdidos).
//   2. En los extremos (0% o 100%) el lado que no paga queda en CERO exacto.
// Antes el SplitModal hacía Math.round() de un lado y `total - j` del otro sin
// redondear, lo que dejaba un remanente de centavos (ej: 100% Javi sobre
// $41.509,08 dejaba $0,08 colgados en Lali).
export function divideAmount(total: number, javiPct: number): { javiAmount: number; laliAmount: number } {
  const t = round2(safeN(total));
  const pct = Math.max(0, Math.min(100, safeN(javiPct)));
  if (pct >= 100) return { javiAmount: t, laliAmount: 0 };
  if (pct <= 0)   return { javiAmount: 0, laliAmount: t };
  const javiAmount = round2(t * pct / 100);
  return { javiAmount, laliAmount: round2(t - javiAmount) };
}

export function calcBal(exps: Expense[]): number {
  return exps.reduce((b, e) => e.paidBy === 'Javi' ? b + safeN(e.laliAmount) : b - safeN(e.javiAmount), 0);
}

export function calcNetBal(exps: Expense[], payments: Payment[], currency: Currency): number {
  const gross = calcBal(exps.filter(e => (e.currency || 'ARS') === currency));
  const adj = (payments || [])
    .filter(p => (p.currency || 'ARS') === currency)
    .reduce((sum, p) => p.from === 'Lali' ? sum - safeN(p.amount) : sum + safeN(p.amount), 0);
  return gross + adj;
}

export function lastPayment(payments: Payment[], currency: Currency): Payment | null {
  const inCur = (payments || []).filter(p => (p.currency || 'ARS') === currency);
  if (!inCur.length) return null;
  return inCur.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
}

export function getPeriod(d: string, ps: Period[]): string {
  if (!ps || !ps.length) return 'Sin período';
  const dt = new Date(d + 'T12:00:00');
  for (let i = 0; i < ps.length; i++) {
    if (dt >= new Date(ps[i].start + 'T00:00:00') && dt <= new Date(ps[i].end + 'T23:59:59')) {
      return ps[i].name;
    }
  }
  return 'Sin período';
}

// ── Plans ─────────────────────────────────────────────────────────────────────
export function generatePlanExpenses(plan: Plan, periods: Period[]): Expense[] {
  const paid = plan.paidInstallments || 0;
  const remaining = plan.numInstallments - paid;
  const startIdx = periods.findIndex(p => p.name === plan.startPeriod);
  const result: Expense[] = [];
  for (let i = 0; i < remaining; i++) {
    const cuotaNum = paid + i + 1;
    const targetIdx = startIdx + i;
    const period = (startIdx >= 0 && targetIdx < periods.length) ? periods[targetIdx].name : PENDING_PER;
    // La última cuota absorbe la diferencia de redondeo para que la suma de
    // cuotas iguale exactamente el total del plan.
    const isLast = cuotaNum === plan.numInstallments;
    const amount = isLast
      ? round2(plan.totalAmount - plan.installmentAmount * (plan.numInstallments - 1))
      : plan.installmentAmount;
    const amts = isLast ? calcAmts(amount, plan.responsible)
                        : { javiAmount: plan.javiAmount, laliAmount: plan.laliAmount };
    result.push({
      id: plan.id + '-' + cuotaNum,
      description: plan.description + ' (cuota ' + cuotaNum + '/' + plan.numInstallments + ')',
      amount: amount,
      javiAmount: amts.javiAmount,
      laliAmount: amts.laliAmount,
      currency: plan.currency,
      paidBy: plan.paidBy,
      responsible: plan.responsible,
      paymentMethod: plan.paymentMethod,
      bank: plan.bank,
      category: plan.category,
      date: plan.startDate,
      period,
      planId: plan.id,
      installmentNum: cuotaNum,
      numInstallments: plan.numInstallments,
      fromPlan: true,
    });
  }
  return result;
}

export function reassignPlanExpenses(exps: Expense[], periods: Period[], plans: Plan[]): Expense[] {
  return exps.map(e => {
    if (!e.fromPlan) return e;
    const plan = plans.find(p => p.id === e.planId);
    if (!plan) return e;
    const paid = plan.paidInstallments || 0;
    const startIdx = periods.findIndex(p => p.name === plan.startPeriod);
    const posInRemaining = (e.installmentNum ?? 1) - paid - 1;
    const targetIdx = startIdx + posInRemaining;
    const period = (startIdx >= 0 && posInRemaining >= 0 && targetIdx < periods.length)
      ? periods[targetIdx].name : PENDING_PER;
    return { ...e, period };
  });
}

// ── Sanitize ──────────────────────────────────────────────────────────────────
export function sanitize(e: Partial<Expense>, cats: string[]): Expense {
  const date = (typeof e.date === 'string' && e.date.match(/^\d{4}-\d{2}-\d{2}/))
    ? e.date.substring(0, 10) : (e.date as string || todayStr());
  // 'Edinson' es un valor legacy de datos viejos, fuera del tipo UserName actual
  const paidBy: UserName = (e.paidBy === 'Javi' || String(e.paidBy) === 'Edinson') ? 'Javi' : 'Lali';
  const responsible: Responsible = (['Javi', 'Lali', 'Ambos'] as Responsible[]).includes(e.responsible as Responsible)
    ? (e.responsible as Responsible) : 'Ambos';
  return {
    ...e,
    id: String(e.id || ''),
    description: String(e.description || ''),
    amount: safeN(e.amount),
    javiAmount: safeN(e.javiAmount),
    laliAmount: safeN(e.laliAmount),
    category: normCat(e.category as string || '', cats),
    currency: (e.currency as Currency) || 'ARS',
    date,
    paidBy,
    responsible,
    period: String(e.period || 'Sin período'),
    paymentMethod: String(e.paymentMethod || ''),
    bank: String(e.bank || ''),
  } as Expense;
}
