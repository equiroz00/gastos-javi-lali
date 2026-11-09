// ── src/lib/helpers.ts ────────────────────────────────────────────────────────
import { CUR_SYM, PENDING_PER } from '../constants';
import type { Expense, Plan, Payment, Period, Currency, Responsible, UserName, SplitAmong, Visibility } from '../types';

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

// 'YYYY-MM-DD' → 'dd/mm'. Devuelve '' si la fecha no viene en ese formato, para
// no mostrar basura cuando un período quedó a medio configurar.
export function shortDate(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? m[3] + '/' + m[2] : '';
}

// Rango de un ciclo de facturación en formato corto: '15/07 – 14/08'.
export function periodRange(p?: { start?: string; end?: string }): string {
  const a = shortDate(p?.start);
  const b = shortDate(p?.end);
  return a && b ? a + ' – ' + b : '';
}

// Resumen de tarjeta al que va una compra: el primer día de cierre posterior o
// igual a la fecha del gasto. Si el mes no llega a ese día (cierre 31 en
// febrero) se usa el último día del mes.
//
// Es informativo: NO decide el `period` del gasto — eso lo sigue haciendo
// getPeriod con los ciclos configurados. Sirve para saber, al cargar con una
// tarjeta puntual, en qué resumen va a aparecer.
export function nextClosingDate(dateISO: string, closingDay?: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateISO || '');
  if (!m || !closingDay || closingDay < 1 || closingDay > 31) return '';
  const year0 = Number(m[1]);
  const month0 = Number(m[2]) - 1;
  const day = Number(m[3]);
  // Día 0 del mes siguiente = último día de este mes.
  const lastDayOf = (y: number, mo: number) => new Date(y, mo + 1, 0).getDate();
  const closeIn = (y: number, mo: number) => Math.min(closingDay, lastDayOf(y, mo));

  let y = year0, mo = month0;
  if (day > closeIn(y, mo)) {
    mo += 1;
    if (mo > 11) { mo = 0; y += 1; }
  }
  return y + '-' + String(mo + 1).padStart(2, '0') + '-' + String(closeIn(y, mo)).padStart(2, '0');
}

// Encabezado del bloque de ítems en las notas. Se exporta porque el formulario
// lo usa para reconocer y reemplazar el bloque anterior si se re-escanea.
export const ITEMS_NOTE_HEADER = 'Ítems del ticket:';

// Ítems leídos de una factura, formateados para dejarlos en las notas del gasto.
// Sin esto la información se perdía al guardar: el recuadro del escaneo es solo
// visual y no se persiste en ningún lado.
export function buildItemsNote(
  items: Array<{ descripcion: string; monto: number }> | undefined,
  cur?: Currency,
): string {
  if (!items || !items.length) return '';
  const lines = items
    .filter(i => i && String(i.descripcion || '').trim())
    .map(i => '• ' + String(i.descripcion).trim() + ' — ' + fmt(safeN(i.monto), cur));
  return lines.length ? ITEMS_NOTE_HEADER + '\n' + lines.join('\n') : '';
}

// Opciones de un desplegable editable (medio de pago, banco): base + las que
// agregó el usuario, sin duplicados y en orden alfabético español.
// `current` es el valor del gasto que se está editando: se incluye aunque ya no
// esté en las listas para que un gasto viejo (ej. 'Efectivo', 'Banco Nación')
// no cambie solo de valor al abrir el formulario y guardar.
export function mergeOptions(base: string[], custom: string[], current?: string): string[] {
  const all = new Set<string>();
  base.forEach(v => { if (v && v.trim()) all.add(v.trim()); });
  custom.forEach(v => { if (v && v.trim()) all.add(v.trim()); });
  if (current && current.trim()) all.add(current.trim());
  return Array.from(all).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
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

// ── Split normalizado (Sprint 11) ─────────────────────────────────────────────
// Resuelve el monto que le corresponde a cada participante según la estrategia.
// Garantiza suma EXACTA a 2 decimales: la última entry absorbe el remanente de
// redondeo (mismo patrón que divideAmount / generatePlanExpenses).
export function resolveSplit(amount: number, split: SplitAmong): Record<string, number> {
  const total = round2(safeN(amount));
  const entries = (split && split.entries) ? split.entries : [];
  const out: Record<string, number> = {};
  if (!entries.length) return out;
  const last = entries.length - 1;

  if (split.strategy === 'montos') {
    // Montos explícitos: se respetan literales (no se redistribuye remanente; el
    // que reparte es responsable de que sumen el total). Reproduce exacto los
    // montos legacy vía splitFromLegacy.
    entries.forEach(e => { out[e.participant] = round2(safeN(e.value)); });
    return out;
  }

  // iguales / porcentajes / shares → reparto proporcional por pesos
  let weights = entries.map(e => split.strategy === 'iguales' ? 1 : safeN(e.value));
  let totalW = weights.reduce((s, w) => s + w, 0);
  // Sin pesos cargados (todos 0) → reparto equitativo, NO todo al último.
  if (totalW <= 0) { weights = entries.map(() => 1); totalW = entries.length; }
  let assigned = 0;
  entries.forEach((e, i) => {
    if (i < last) { const v = round2(total * weights[i] / totalW); out[e.participant] = v; assigned += v; }
  });
  out[entries[last].participant] = round2(total - assigned);
  return out;
}

// Sintetiza el split normalizado desde los montos legacy (javiAmount/laliAmount).
// Lo usan el parser de lectura (fallback de docs sin migrar) y la migración.
export function splitFromLegacy(javiAmount: number, laliAmount: number): SplitAmong {
  return {
    strategy: 'montos',
    entries: [
      { participant: 'Javi', value: round2(safeN(javiAmount)) },
      { participant: 'Lali', value: round2(safeN(laliAmount)) },
    ],
  };
}

// Monto resuelto por participante para un gasto, usando su splitAmong (o el
// sintetizado desde los montos legacy si aún no está). Reemplaza leer
// e.javiAmount / e.laliAmount directamente.
export function expenseResolved(e: Expense): Record<string, number> {
  return resolveSplit(safeN(e.amount), e.splitAmong ?? splitFromLegacy(e.javiAmount, e.laliAmount));
}

// ── Vista "Compartidos / Solo tuyo" ───────────────────────────────────────────
// ÚNICO lugar que decide "cuánto de este gasto es mío". Inicio, Stats e
// Historial no hacen su propia cuenta: usan scopeExpenses.
export type Scope = 'shared' | 'mine';

// Copia de un gasto vista como "solo tuyo": el monto ya es tu parte. Guarda el
// original (_orig) para editar/borrar — nunca se debe escribir la copia — y el
// total real (_fullAmount) para mostrarlo chico al lado.
export type ScopedExpense = Expense & { _orig?: Expense; _fullAmount?: number };

export function myShare(e: Expense, user: string): number {
  if (e.visibilidad === 'privado') {
    // Un privado es 100% de su dueño. (La caché solo trae los privados propios,
    // pero se chequea igual: nunca contar como mío un privado ajeno.)
    const owner = e.splitAmong?.entries?.[0]?.participant ?? e.paidBy;
    return owner === user ? round2(safeN(e.amount)) : 0;
  }
  return round2(safeN(expenseResolved(e)[user]));
}

export function scopeExpenses(exps: Expense[], scope: Scope, user: string | null): ScopedExpense[] {
  if (scope !== 'mine' || !user) return exps;
  const out: ScopedExpense[] = [];
  for (const e of exps) {
    const share = myShare(e, user);
    if (share <= 0) continue; // solo los gastos donde tengo parte
    out.push({
      ...e,
      amount: share,
      // El reparto de la copia es coherente con su monto (100% mío). Así, si
      // algún cálculo de reparto se aplicara sobre la copia, tampoco mezcla.
      javiAmount: user === 'Javi' ? share : 0,
      laliAmount: user === 'Lali' ? share : 0,
      splitAmong: { strategy: 'iguales', entries: [{ participant: user }] },
      _orig: e,
      _fullAmount: safeN(e.amount),
    });
  }
  return out;
}

// El gasto real detrás de una copia "solo tuyo" (o el mismo si no es copia).
export function originalOf(e: Expense): Expense {
  return (e as ScopedExpense)._orig ?? e;
}

export function calcBal(exps: Expense[]): number {
  return exps.reduce((b, e) => {
    if (e.visibilidad === 'privado') return b; // los privados no generan deuda entre los dos
    const r = expenseResolved(e);
    return e.paidBy === 'Javi' ? b + safeN(r['Lali']) : b - safeN(r['Javi']);
  }, 0);
}

export function calcNetBal(exps: Expense[], payments: Payment[], currency: Currency): number {
  const gross = calcBal(exps.filter(e => (e.currency || 'ARS') === currency));
  const adj = (payments || [])
    .filter(p => (p.currency || 'ARS') === currency)
    .reduce((sum, p) => p.from === 'Lali' ? sum - safeN(p.amount) : sum + safeN(p.amount), 0);
  return gross + adj;
}

// Universo de participantes: los dos titulares (implícitos) + las etiquetas de
// Config. Se usa para los selectores de la UI (quién pagó / entre quiénes).
// Valida el nombre de una persona nueva antes de guardarla. Lo usan la
// división de gastos y Configuración, así ambos aplican la misma regla.
// Normaliza espacios y rechaza duplicados sin distinguir mayúsculas ni tildes
// ("caro" o "Cáro" no crean una segunda "Caro").
export function validatePersonName(raw: string, existing: string[]): { ok: true; name: string } | { ok: false; error: string } {
  const name = (raw || '').replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, error: 'Escribí un nombre.' };
  if (name.length > 30) return { ok: false, error: 'Máximo 30 caracteres.' };
  const key = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const dup = existing.find(p => key(p) === key(name));
  if (dup) return { ok: false, error: dup + ' ya está en la lista.' };
  return { ok: true, name };
}

export function allParticipants(people: string[] = []): string[] {
  return ['Javi', 'Lali', ...people.filter(p => p && p !== 'Javi' && p !== 'Lali')];
}

// ── Grafo de deudas N personas (Sprint 13) ────────────────────────────────────
// Saldo neto por participante en una moneda. Positivo = le deben; negativo = debe.
// Los privados NO generan deuda entre participantes (se excluyen). La suma da ≈ 0.
export function computeBalances(exps: Expense[], payments: Payment[], currency: Currency): Record<string, number> {
  const bal: Record<string, number> = {};
  const add = (p: string, v: number) => { if (p) bal[p] = round2((bal[p] || 0) + v); };

  for (const e of exps) {
    if (e.visibilidad === 'privado') continue;
    if ((e.currency || 'ARS') !== currency) continue;
    add(e.paidBy, safeN(e.amount));                    // el que pagó adelantó el total
    const resolved = expenseResolved(e);               // cada uno debe su parte
    for (const p of Object.keys(resolved)) add(p, -safeN(resolved[p]));
  }
  for (const p of payments || []) {
    if ((p.currency || 'ARS') !== currency) continue;
    add(p.from, safeN(p.amount));                      // quien paga reduce su deuda
    add(p.to, -safeN(p.amount));                       // a quien le pagan se le debe menos
  }
  for (const k of Object.keys(bal)) if (Math.abs(bal[k]) < 0.01) delete bal[k];
  return bal;
}

// Minimiza transferencias para saldar (estilo Splitwise): empareja el mayor
// acreedor con el mayor deudor y salda el mínimo entre ambos, repitiendo.
// Produce ≤ n−1 transferencias que dejan todos los saldos en 0.
export function simplifyDebts(balances: Record<string, number>): Array<{ from: string; to: string; amount: number }> {
  const creditors = Object.entries(balances).filter(([, v]) => v > 0.005).map(([p, v]) => ({ p, v: round2(v) }));
  const debtors   = Object.entries(balances).filter(([, v]) => v < -0.005).map(([p, v]) => ({ p, v: round2(-v) }));
  creditors.sort((a, b) => b.v - a.v);
  debtors.sort((a, b) => b.v - a.v);

  const out: Array<{ from: string; to: string; amount: number }> = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = round2(Math.min(debtors[i].v, creditors[j].v));
    if (pay > 0) out.push({ from: debtors[i].p, to: creditors[j].p, amount: pay });
    debtors[i].v   = round2(debtors[i].v - pay);
    creditors[j].v = round2(creditors[j].v - pay);
    if (debtors[i].v < 0.01) i++;
    if (creditors[j].v < 0.01) j++;
  }
  return out;
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

// ── Tarjetas (filtro de Historial) ────────────────────────────────────────────
// Una "tarjeta" es la combinación medio de pago + banco ("Visa · Galicia"), no
// la marca sola: así llega el resumen, y el día de cierre se configura por banco.
// Con la marca sola se mezclarían dos resúmenes distintos de la misma marca.
export function cardKey(e: Pick<Expense, 'paymentMethod' | 'bank'>): string {
  const method = (e.paymentMethod || '').trim() || 'Sin medio de pago';
  const bank   = (e.bank || '').trim();
  return bank ? method + ' · ' + bank : method;
}

// Opciones del filtro: solo las combinaciones que de verdad aparecen en los
// gastos (ofrecer "AMEX · Macro" si nunca se usó solo agrega ruido).
export function cardOptions(exps: Array<Pick<Expense, 'paymentMethod' | 'bank'>>): string[] {
  return Array.from(new Set(exps.map(cardKey))).sort((a, b) => a.localeCompare(b, 'es'));
}

// ── Plans ─────────────────────────────────────────────────────────────────────

// Reparto de un plan, apto para CUALQUIER monto (cada cuota). Iguales,
// porcentajes y partes ya son proporcionales; los "montos exactos" se cargan
// sobre el TOTAL de la compra, así que se pasan a porcentajes — aplicar el monto
// del total a cada cuota daría cualquier cosa. Los participantes con 0 se
// descartan (no participan).
export function proportionalSplit(split: SplitAmong): SplitAmong {
  if (split.strategy !== 'montos') return split;
  const entries = split.entries.filter(e => safeN(e.value) > 0);
  if (!entries.length) return { strategy: 'iguales', entries: split.entries.map(e => ({ participant: e.participant })) };
  // Se pasan a "partes" con la proporción EXACTA, simplificada (600.000 y
  // 300.000 → 2 y 1). Un porcentaje redondeado (66,67 %) hacía que cada cuota
  // se pasara unos pesos: en 9 cuotas, $30 de más para uno.
  const cents = entries.map(e => Math.round(safeN(e.value) * 100));
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const g = cents.reduce((acc, v) => gcd(acc, v), 0) || 1;
  return { strategy: 'shares', entries: entries.map((e, i) => ({ participant: e.participant, value: cents[i] / g })) };
}

// Campo viejo "responsible", derivado del reparto real (lo siguen leyendo
// partes antiguas; ya NO se usa para calcular nada).
function responsibleOf(split: SplitAmong): Responsible {
  const r = resolveSplit(100, split);
  const who = Object.keys(r).filter(k => safeN(r[k]) > 0);
  if (who.length === 1 && (who[0] === 'Javi' || who[0] === 'Lali')) return who[0];
  return 'Ambos';
}

// El bug de la división en cuotas: entre el 24/05/2026 (división personalizada)
// y el arreglo, todo plan compartido se guardaba 50/50 sin importar lo elegido.
// Esos planes no se pueden reparar solos (lo elegido nunca se guardó): se
// marcan para que alguien los revise. Cualquier plan guardado con el código
// arreglado lleva splitReviewed: true y no se marca.
export const SPLIT_BUG_SINCE = '2026-05-24';
export function planNeedsSplitReview(p: Plan): boolean {
  if (p.splitReviewed) return false;
  if (p.visibilidad === 'privado') return false;          // los privados siempre fueron 100% del dueño
  if (!p.createdAt || p.createdAt < SPLIT_BUG_SINCE) return false;
  const r = resolveSplit(100, proportionalSplit(p.splitAmong ?? splitFromLegacy(p.javiAmount, p.laliAmount)));
  const who = Object.keys(r).filter(k => safeN(r[k]) > 0);
  return who.length === 2 && safeN(r['Javi']) === 50 && safeN(r['Lali']) === 50;
}

// Arma el documento de un plan a partir del formulario. Lo usan tanto el alta
// como la edición (antes cada una construía el objeto por su cuenta).
//
// REGLA CLAVE: el resultado NUNCA lleva un campo con valor `undefined`. El SDK de
// Firestore rechaza esos campos LANZANDO una excepción al armar el batch, antes
// del commit. Así se rompía la edición de cuotas: los planes creados antes del
// 17/08/2026 no tienen `createdBy`, el campo quedaba en undefined, y "Guardar"
// cortaba la función en seco — sin guardar, sin cerrar el editor y sin avisar.
export function buildPlan(
  id: string,
  formData: Expense,
  numInstallments: number,
  paidInstallments: number,
  startPeriod: string,
  existing?: Pick<Plan, 'createdBy' | 'createdAt'>,
): Plan {
  const installmentAmount = Math.round(safeN(formData.amount) / numInstallments);
  // EL ARREGLO: el reparto sale de la división elegida (splitAmong). Antes salía
  // del campo viejo "responsible", que el modal de división nunca actualizaba
  // bien → todo plan compartido quedaba 50/50. "responsible" queda solo como
  // respaldo para un formulario sin división cargada.
  const split = proportionalSplit(formData.splitAmong ?? (() => {
    const a = calcAmts(safeN(formData.amount), formData.responsible);
    return splitFromLegacy(a.javiAmount, a.laliAmount);
  })());
  const inst = resolveSplit(installmentAmount, split);
  const isPrivate = formData.visibilidad === 'privado';
  // Al editar se conserva quién lo creó originalmente; si el plan es anterior a
  // que existiera el campo, se deja ausente (no undefined).
  const createdBy = existing?.createdBy ?? formData.createdBy;
  return {
    id,
    description: formData.description,
    totalAmount: safeN(formData.amount),
    installmentAmount,
    numInstallments,
    paidInstallments: paidInstallments || 0,
    startPeriod,
    startDate: formData.date,
    currency: formData.currency as Currency,
    paidBy: formData.paidBy,
    responsible: responsibleOf(split),
    paymentMethod: formData.paymentMethod || '',
    bank: formData.bank || '',
    category: formData.category || '',
    // javiAmount/laliAmount: campos viejos, por cuota, derivados del reparto real.
    javiAmount: safeN(inst['Javi']),
    laliAmount: safeN(inst['Lali']),
    splitAmong: split,
    // Guardado con el código arreglado: su división es la elegida.
    splitReviewed: true,
    visibilidad: isPrivate ? 'privado' : 'compartido',
    ...(isPrivate && formData.ownerId ? { ownerId: formData.ownerId } : {}),
    ...(createdBy ? { createdBy } : {}),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
}

export function generatePlanExpenses(plan: Plan, periods: Period[]): Expense[] {
  const paid = plan.paidInstallments || 0;
  const remaining = plan.numInstallments - paid;
  const startIdx = periods.findIndex(p => p.name === plan.startPeriod);
  // Cada cuota se reparte con el MISMO reparto proporcional del plan, resuelto
  // sobre el monto de esa cuota (sumas exactas, también en la última, que
  // absorbe el redondeo). Antes la última cuota usaba "responsible" (50/50).
  const split = proportionalSplit(plan.splitAmong ?? splitFromLegacy(plan.javiAmount, plan.laliAmount));
  // Para la última cuota: lo que a cada uno le toca del TOTAL, menos lo que ya
  // pagó en las anteriores. Así el total de cada persona cierra exacto — si
  // cada cuota se redondeara por su lado, los centavos se acumulan (⅓ de cuota
  // en 9 cuotas dejaba 6 centavos de diferencia).
  const totalShare = resolveSplit(plan.totalAmount, split);
  const perInst    = resolveSplit(plan.installmentAmount, split);
  const lastSplit: SplitAmong = {
    strategy: 'montos',
    entries: Object.keys(totalShare).map(p => ({
      participant: p,
      value: round2(safeN(totalShare[p]) - safeN(perInst[p]) * (plan.numInstallments - 1)),
    })),
  };
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
    const cuotaSplit = isLast ? lastSplit : split;
    const r = resolveSplit(amount, cuotaSplit);
    const amts = { javiAmount: safeN(r['Javi']), laliAmount: safeN(r['Lali']) };
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
      // Cada cuota hereda el reparto del plan (proporcional, incluye terceros);
      // la última, el que cierra el total de cada persona.
      splitAmong: cuotaSplit,
      visibilidad: plan.visibilidad ?? 'compartido',
      ...(plan.visibilidad === 'privado' && plan.ownerId ? { ownerId: plan.ownerId } : {}),
      ...(plan.createdBy ? { createdBy: plan.createdBy } : {}),
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

// Reasigna el período de TODOS los gastos según la lista de períodos dada. Es la
// ÚNICA fuente de la lógica de re-bucketeo (la usa saveSettings y queda testeable):
//   · gastos comunes con fecha → getPeriod(fecha)  ← re-ubica los "Sin período"
//     cuando se agrega un período que ahora cubre su fecha
//   · cuotas de planes → reassignPlanExpenses (posición según el plan, no fecha)
export function reassignExpensePeriods(exps: Expense[], periods: Period[], plans: Plan[]): Expense[] {
  const recomputed = exps.map(e => ({
    ...e,
    period: (!e.fromPlan && e.date) ? getPeriod(e.date, periods) : (e.period || 'Sin período'),
  }));
  return periods.length ? reassignPlanExpenses(recomputed, periods, plans) : recomputed;
}

// ── Sanitize ──────────────────────────────────────────────────────────────────
export function sanitize(e: Partial<Expense>, cats: string[]): Expense {
  const date = (typeof e.date === 'string' && e.date.match(/^\d{4}-\d{2}-\d{2}/))
    ? e.date.substring(0, 10) : (e.date as string || todayStr());
  // 'Edinson' es un valor legacy de datos viejos, fuera del tipo UserName actual
  const paidBy: UserName = (e.paidBy === 'Javi' || String(e.paidBy) === 'Edinson') ? 'Javi' : 'Lali';
  const responsible: Responsible = (['Javi', 'Lali', 'Ambos'] as Responsible[]).includes(e.responsible as Responsible)
    ? (e.responsible as Responsible) : 'Ambos';
  const visibilidad: Visibility = e.visibilidad === 'privado' ? 'privado' : 'compartido';
  const out = {
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
    visibilidad,
    splitAmong: e.splitAmong ?? splitFromLegacy(safeN(e.javiAmount), safeN(e.laliAmount)),
  } as Expense;
  // ownerId solo tiene sentido en gastos privados; en compartidos se quita.
  if (visibilidad === 'privado' && e.ownerId) out.ownerId = e.ownerId;
  else delete out.ownerId;
  return out;
}
