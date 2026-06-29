// ── src/lib/schemas.ts ────────────────────────────────────────────────────────
// Validación de datos de Firestore con Zod. Estrategia "tolerante primero":
// el schema normaliza (coerce/default) para NO perder datos legacy en pantalla,
// y un schema estricto aparte detecta anomalías y las reporta a Sentry (solo
// id + nombres de campo, NUNCA montos ni descripciones — privacidad).
import { z } from 'zod';
import type { Expense, Payment, Plan } from '../types';
import { Sentry } from '../sentry';

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
  paidBy:        z.enum(['Javi', 'Lali']).catch('Javi'),
  responsible:   z.enum(['Javi', 'Lali', 'Ambos']).catch('Ambos'),
  category:      z.string().catch(''),
  paymentMethod: z.string().catch(''),
  bank:          z.string().catch(''),
  javiAmount:    z.coerce.number().catch(0),
  laliAmount:    z.coerce.number().catch(0),
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
  paidBy:      z.enum(['Javi', 'Lali']),
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
    out.push(lenient.data as Expense);
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
  from:         z.enum(['Javi', 'Lali']).catch('Lali'),
  to:           z.enum(['Javi', 'Lali']).catch('Javi'),
  period:       z.string().optional(),
  registeredAt: z.string().catch(''),
});

const PaymentStrict = z.object({
  id:       z.string().min(1),
  amount:   z.number(),
  currency: z.string().min(1),
  date:     z.string().min(1),
  from:     z.enum(['Javi', 'Lali']),
  to:       z.enum(['Javi', 'Lali']),
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
  paidBy:            z.enum(['Javi', 'Lali']).catch('Javi'),
  responsible:       z.enum(['Javi', 'Lali', 'Ambos']).catch('Ambos'),
  paymentMethod:     z.string().catch(''),
  bank:              z.string().catch(''),
  category:          z.string().catch(''),
  javiAmount:        z.coerce.number().catch(0),
  laliAmount:        z.coerce.number().catch(0),
  createdAt:         z.string().catch(''),
});

const PlanStrict = z.object({
  id:              z.string().min(1),
  totalAmount:     z.number(),
  numInstallments: z.number(),
  startPeriod:     z.string().min(1),
  currency:        z.string().min(1),
  paidBy:          z.enum(['Javi', 'Lali']),
  responsible:     z.enum(['Javi', 'Lali', 'Ambos']),
});

export function parsePlans(raw: unknown[]): Plan[] {
  const out: Plan[] = [];
  for (const r of raw) {
    const lenient = PlanSchema.safeParse(r);
    if (!lenient.success) { reportAnomaly('Plan', r, lenient.error); continue; }
    out.push(lenient.data as Plan);
    const strict = PlanStrict.safeParse(r);
    if (!strict.success) reportAnomaly('Plan', r, strict.error);
  }
  return out;
}

export function checkPlanForWrite(p: Plan): void {
  const r = PlanStrict.safeParse(p);
  if (!r.success) reportAnomaly('Plan', p, r.error);
}
