// ── src/lib/schemas.ts ────────────────────────────────────────────────────────
// Validación de datos de Firestore con Zod. Estrategia "tolerante primero":
// el schema normaliza (coerce/default) para NO perder datos legacy en pantalla,
// y un schema estricto aparte detecta anomalías y las reporta a Sentry (solo
// id + nombres de campo, NUNCA montos ni descripciones — privacidad).
import { z } from 'zod';
import type { Expense, Payment, Plan, Settings } from '../types';
import { Sentry } from '../sentry';
import { splitFromLegacy } from './helpers';

// ── Split normalizado (Sprint 11) ─────────────────────────────────────────────
const SplitEntrySchema = z.object({
  participant: z.string(),
  value:       z.coerce.number().optional(),
});
const SplitAmongSchema = z.object({
  strategy: z.enum(['iguales', 'montos', 'porcentajes', 'shares']),
  entries:  z.array(SplitEntrySchema),
});

// ── Schema TOLERANTE (el que se usa para mostrar) ─────────────────────────────
// Cada campo cae a un default si falta o es inválido → un gasto real siempre
// parsea y nunca desaparece de la UI.
export const ExpenseSchema = z.object({
  id:            z.string(),
  description:   z.string().catch(''),
  amount:        z.coerce.number().catch(0),
  currency:      z.string().catch('ARS'),
  date:          z.string().catch(''),
  period:        z.string().catch('Sin período'),
  paidBy:        z.string().min(1).catch('Javi'),
  responsible:   z.enum(['Javi', 'Lali', 'Ambos']).catch('Ambos'),
  category:      z.string().catch(''),
  paymentMethod: z.string().catch(''),
  bank:          z.string().catch(''),
  javiAmount:    z.coerce.number().catch(0),
  laliAmount:    z.coerce.number().catch(0),
  splitAmong:    SplitAmongSchema.optional(),
  visibilidad:   z.enum(['compartido', 'privado']).optional(),
  ownerId:       z.string().optional(),
  notes:           z.string().optional(),
  createdBy:       z.enum(['Javi', 'Lali']).optional(),
  createdAt:       z.string().optional(),
  fromPlan:        z.boolean().optional(),
  planId:          z.string().optional(),
  installmentNum:  z.coerce.number().optional(),
  numInstallments: z.coerce.number().optional(),
});

// ── Schema ESTRICTO (solo para detectar anomalías) ────────────────────────────
// No se usa para mostrar (no hace desaparecer gastos); solo enciende una alarma
// en Sentry cuando un doc viene con datos que la lógica de períodos no espera.
const ExpenseStrict = z.object({
  id:          z.string().min(1),
  amount:      z.number(),
  currency:    z.string().min(1),
  date:        z.string().min(1),
  period:      z.string().min(1),
  paidBy:      z.string().min(1),
  responsible: z.enum(['Javi', 'Lali', 'Ambos']),
});

// Reporta a Sentry SOLO el id del doc y los nombres de campo con problema.
// Nunca valores (montos, descripciones, etc.).
function reportAnomaly(entity: string, raw: unknown, err: z.ZodError): void {
  const id = (raw && typeof raw === 'object' && 'id' in raw)
    ? String((raw as { id: unknown }).id)
    : '(sin id)';
  const campos = err.issues.map(i => i.path.join('.') || '(raíz)');
  Sentry.captureException(new Error(entity + ' con datos inválidos en Firestore'), {
    extra: { id, campos },
  });
}

// Valida la lista cruda de un snapshot: usa el schema tolerante para mostrar
// (sin pérdida de datos) y el estricto para reportar anomalías a Sentry.
export function parseExpenses(raw: unknown[]): Expense[] {
  const out: Expense[] = [];
  for (const r of raw) {
    const lenient = ExpenseSchema.safeParse(r);
    if (!lenient.success) { reportAnomaly('Gasto', r, lenient.error); continue; }
    const e = lenient.data as Expense;
    // Fallback de transición: docs sin migrar derivan el split de los montos viejos.
    if (!e.splitAmong) e.splitAmong = splitFromLegacy(e.javiAmount, e.laliAmount);
    if (!e.visibilidad) e.visibilidad = 'compartido';
    out.push(e);
    const strict = ExpenseStrict.safeParse(r);
    if (!strict.success) reportAnomaly('Gasto', r, strict.error);
  }
  return out;
}

// Guard de ESCRITURA: valida un gasto antes de mandarlo a Firestore. No bloquea
// al usuario (el dato ya viene saneado), pero enciende una alarma en Sentry si
// algo no cuadra — "nada entra a Firestore sin validar".
export function checkExpenseForWrite(e: Expense): void {
  const r = ExpenseStrict.safeParse(e);
  if (!r.success) reportAnomaly('Gasto', e, r.error);
}

// ── Pagos entre usuarios ──────────────────────────────────────────────────────
export const PaymentSchema = z.object({
  id:           z.string(),
  date:         z.string().catch(''),
  amount:       z.coerce.number().catch(0),
  currency:     z.string().catch('ARS'),
  from:         z.string().min(1).catch('Lali'),
  to:           z.string().min(1).catch('Javi'),
  period:       z.string().optional(),
  registeredAt: z.string().catch(''),
});

const PaymentStrict = z.object({
  id:       z.string().min(1),
  amount:   z.number(),
  currency: z.string().min(1),
  date:     z.string().min(1),
  from:     z.string().min(1),
  to:       z.string().min(1),
});

export function parsePayments(raw: unknown[]): Payment[] {
  const out: Payment[] = [];
  for (const r of raw) {
    const lenient = PaymentSchema.safeParse(r);
    if (!lenient.success) { reportAnomaly('Pago', r, lenient.error); continue; }
    out.push(lenient.data as Payment);
    const strict = PaymentStrict.safeParse(r);
    if (!strict.success) reportAnomaly('Pago', r, strict.error);
  }
  return out;
}

export function checkPaymentForWrite(p: Payment): void {
  const r = PaymentStrict.safeParse(p);
  if (!r.success) reportAnomaly('Pago', p, r.error);
}

// ── Planes de cuotas ──────────────────────────────────────────────────────────
export const PlanSchema = z.object({
  id:                z.string(),
  description:       z.string().catch(''),
  totalAmount:       z.coerce.number().catch(0),
  installmentAmount: z.coerce.number().catch(0),
  numInstallments:   z.coerce.number().catch(0),
  paidInstallments:  z.coerce.number().catch(0),
  startPeriod:       z.string().catch(''),
  startDate:         z.string().catch(''),
  currency:          z.string().catch('ARS'),
  paidBy:            z.string().min(1).catch('Javi'),
  responsible:       z.enum(['Javi', 'Lali', 'Ambos']).catch('Ambos'),
  paymentMethod:     z.string().catch(''),
  bank:              z.string().catch(''),
  category:          z.string().catch(''),
  javiAmount:        z.coerce.number().catch(0),
  laliAmount:        z.coerce.number().catch(0),
  splitAmong:        SplitAmongSchema.optional(),
  visibilidad:       z.enum(['compartido', 'privado']).optional(),
  ownerId:           z.string().optional(),
  createdBy:         z.enum(['Javi', 'Lali']).optional(),
  createdAt:         z.string().catch(''),
});

const PlanStrict = z.object({
  id:              z.string().min(1),
  totalAmount:     z.number(),
  numInstallments: z.number(),
  startPeriod:     z.string().min(1),
  currency:        z.string().min(1),
  paidBy:          z.string().min(1),
  responsible:     z.enum(['Javi', 'Lali', 'Ambos']),
});

export function parsePlans(raw: unknown[]): Plan[] {
  const out: Plan[] = [];
  for (const r of raw) {
    const lenient = PlanSchema.safeParse(r);
    if (!lenient.success) { reportAnomaly('Plan', r, lenient.error); continue; }
    const p = lenient.data as Plan;
    if (!p.splitAmong) p.splitAmong = splitFromLegacy(p.javiAmount, p.laliAmount);
    if (!p.visibilidad) p.visibilidad = 'compartido';
    out.push(p);
    const strict = PlanStrict.safeParse(r);
    if (!strict.success) reportAnomaly('Plan', r, strict.error);
  }
  return out;
}

export function checkPlanForWrite(p: Plan): void {
  const r = PlanStrict.safeParse(p);
  if (!r.success) reportAnomaly('Plan', p, r.error);
}

// ── Configuración (doc settings/main: períodos + tema/fuente + categorías) ─────
const PeriodSchema = z.object({
  name:  z.string().catch(''),
  start: z.string().catch(''),
  end:   z.string().catch(''),
});

export const SettingsSchema = z.object({
  periods: z.array(PeriodSchema).catch([]),
  theme:   z.string().catch('default'),
  font:    z.string().catch('Nunito'),
});

// El doc settings/main trae la config compartida + las listas personalizadas.
// Devuelve cada una por separado (espejan los caches: ['settings'], ['customCats'],
// ['people'], ['customPayMethods'], ['customBanks']).
export function parseSettingsDoc(raw: unknown): {
  settings: Settings; customCats: string[]; people: string[];
  customPayMethods: string[]; customBanks: string[];
  bankClosingDays: Record<string, number>;
} {
  const parsed = SettingsSchema.safeParse(raw);
  if (!parsed.success) reportAnomaly('Config', raw, parsed.error);
  const settings = (parsed.success ? parsed.data : { periods: [], theme: 'default', font: 'Nunito' }) as Settings;
  const obj = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const strArray = (v: unknown): string[] => z.array(z.string()).catch([]).parse(v);
  // Día de cierre por banco (1–31). Se descarta cualquier valor fuera de rango
  // en vez de tumbar toda la config.
  const bankClosingDays = z.record(z.string(), z.coerce.number().int().min(1).max(31))
    .catch({}).parse(obj.bankClosingDays);
  return {
    settings,
    customCats:       strArray(obj.customCats),
    people:           strArray(obj.people),
    customPayMethods: strArray(obj.customPayMethods),
    customBanks:      strArray(obj.customBanks),
    bankClosingDays,
  };
}
