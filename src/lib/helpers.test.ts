// ── src/lib/helpers.test.ts ───────────────────────────────────────────────────
// Tests de la lógica de cálculo — el corazón de la app.
// Correr con: npm test  (o npm run test:watch durante desarrollo)
import { describe, it, expect } from 'vitest';
import {
  round2, safeN, fmt, fmtS, todayStr, genId,
  catEm, catLb, normCat, sortByDate, pctChange, getWeekStart,
  calcAmts, divideAmount, resolveSplit, splitFromLegacy, calcBal, calcNetBal,
  computeBalances, simplifyDebts, lastPayment, getPeriod,
  generatePlanExpenses, reassignPlanExpenses, reassignExpensePeriods, sanitize,
} from './helpers';
import { PENDING_PER, DEFAULT_CATS } from '../constants';
import type { Expense, Plan, Payment, Period } from '../types';

// ── Helpers de test ───────────────────────────────────────────────────────────
// Gasto mínimo válido; cada test pisa solo lo que le importa.
function exp(over: Partial<Expense> = {}): Expense {
  return {
    id: 'e1', description: 'Test', amount: 100, currency: 'ARS',
    date: '2026-06-01', period: 'Jun 2026', paidBy: 'Javi', responsible: 'Ambos',
    category: '🏠 Hogar', paymentMethod: 'Efectivo', bank: 'Galicia',
    javiAmount: 50, laliAmount: 50,
    ...over,
  };
}

function pay(over: Partial<Payment> = {}): Payment {
  return {
    id: 'p1', date: '2026-06-15', amount: 100, currency: 'ARS',
    from: 'Lali', to: 'Javi', registeredAt: '2026-06-15T10:00:00.000Z',
    ...over,
  };
}

const PERIODS: Period[] = [
  { name: 'May 2026', start: '2026-05-01', end: '2026-05-31' },
  { name: 'Jun 2026', start: '2026-06-01', end: '2026-06-30' },
  { name: 'Jul 2026', start: '2026-07-01', end: '2026-07-31' },
];

// ── Números y formato ─────────────────────────────────────────────────────────
describe('round2', () => {
  it('redondea a 2 decimales', () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.004)).toBe(10);
    expect(round2(33.333333)).toBe(33.33);
    expect(round2(-5.555)).toBe(-5.55); // Math.round redondea -555.5 hacia arriba
  });
});

describe('safeN', () => {
  it('convierte números y strings numéricos', () => {
    expect(safeN(42)).toBe(42);
    expect(safeN('42.5')).toBe(42.5);
    expect(safeN('-10')).toBe(-10);
  });
  it('devuelve 0 ante basura', () => {
    expect(safeN(undefined)).toBe(0);
    expect(safeN(null)).toBe(0);
    expect(safeN('')).toBe(0);
    expect(safeN('abc')).toBe(0);
    expect(safeN(NaN)).toBe(0);
    expect(safeN(Infinity)).toBe(0);
  });
});

describe('fmt / fmtS', () => {
  it('fmt usa el símbolo de la moneda y valor absoluto', () => {
    expect(fmt(1500, 'ARS')).toContain('$');
    expect(fmt(-1500, 'ARS')).toBe(fmt(1500, 'ARS')); // siempre absoluto
    expect(fmt(100, 'USD').startsWith('US$')).toBe(true);
    expect(fmt(100, 'EUR').startsWith('€')).toBe(true);
  });
  it('fmt con moneda desconocida usa el código como prefijo', () => {
    expect(fmt(100, 'BRL')).toBe('BRL 100');
  });
  it('fmtS abrevia miles y millones', () => {
    expect(fmtS(500, 'ARS')).toBe('$500');
    expect(fmtS(1500, 'ARS')).toBe('$2K');
    expect(fmtS(2500000, 'ARS')).toBe('$2.5M');
  });
});

describe('todayStr', () => {
  it('devuelve la fecha LOCAL en formato YYYY-MM-DD', () => {
    const now = new Date();
    const expected = now.getFullYear() + '-'
      + String(now.getMonth() + 1).padStart(2, '0') + '-'
      + String(now.getDate()).padStart(2, '0');
    expect(todayStr()).toBe(expected);
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('genId', () => {
  it('genera IDs únicos', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => genId()));
    expect(ids.size).toBe(1000);
  });
  it('aplica el prefijo', () => {
    expect(genId('plan')).toMatch(/^plan_/);
    expect(genId()).not.toContain('_undefined');
  });
});

// ── Categorías ────────────────────────────────────────────────────────────────
describe('catEm / catLb / normCat', () => {
  it('extrae emoji y etiqueta', () => {
    expect(catEm('🏠 Hogar')).toBe('🏠');
    expect(catEm('Sin emoji')).toBe('📦');
    expect(catEm(undefined)).toBe('📦');
    expect(catLb('🏠 Hogar')).toBe('Hogar');
    expect(catLb(undefined)).toBe('Otro');
  });
  it('normCat encuentra la categoría exacta o por nombre sin emoji', () => {
    expect(normCat('🏠 Hogar', DEFAULT_CATS)).toBe('🏠 Hogar');
    expect(normCat('hogar', DEFAULT_CATS)).toBe('🏠 Hogar');
    expect(normCat('HOGAR', DEFAULT_CATS)).toBe('🏠 Hogar');
  });
  it('normCat conserva categorías desconocidas y maneja vacío', () => {
    expect(normCat('Inexistente', DEFAULT_CATS)).toBe('Inexistente');
    expect(normCat('', DEFAULT_CATS)).toBe('Otro');
  });
});

// ── Orden y variación ─────────────────────────────────────────────────────────
describe('sortByDate', () => {
  it('ordena descendente sin mutar el original', () => {
    const a = exp({ id: 'a', date: '2026-01-01' });
    const b = exp({ id: 'b', date: '2026-03-01' });
    const c = exp({ id: 'c', date: '2026-02-01' });
    const orig = [a, b, c];
    const sorted = sortByDate(orig);
    expect(sorted.map(e => e.id)).toEqual(['b', 'c', 'a']);
    expect(orig.map(e => e.id)).toEqual(['a', 'b', 'c']); // no muta
  });
});

describe('pctChange', () => {
  it('calcula el porcentaje de cambio', () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(100, 100)).toBe(0);
  });
  it('devuelve null si el anterior es 0 (no división por cero)', () => {
    expect(pctChange(100, 0)).toBeNull();
  });
});

describe('getWeekStart', () => {
  it('devuelve el lunes de esta semana a las 00:00', () => {
    const ws = getWeekStart();
    expect(ws.getDay()).toBe(1); // lunes
    expect(ws.getHours()).toBe(0);
    expect(ws.getMinutes()).toBe(0);
    expect(ws.getTime()).toBeLessThanOrEqual(Date.now());
    // Como máximo 7 días atrás
    expect(Date.now() - ws.getTime()).toBeLessThan(7 * 24 * 3600 * 1000);
  });
});

// ── División del gasto ────────────────────────────────────────────────────────
describe('calcAmts', () => {
  it('Ambos divide 50/50', () => {
    expect(calcAmts(100, 'Ambos')).toEqual({ javiAmount: 50, laliAmount: 50 });
  });
  it('responsable único carga todo a esa persona', () => {
    expect(calcAmts(100, 'Javi')).toEqual({ javiAmount: 100, laliAmount: 0 });
    expect(calcAmts(100, 'Lali')).toEqual({ javiAmount: 0, laliAmount: 100 });
  });
  it('redondea a 2 decimales en montos impares', () => {
    const r = calcAmts(99.99, 'Ambos');
    expect(r.javiAmount).toBe(50);   // round2(49.995) = 50
    expect(r.laliAmount).toBe(50);
  });
  it('acepta string como monto', () => {
    expect(calcAmts('200', 'Ambos')).toEqual({ javiAmount: 100, laliAmount: 100 });
  });
});

describe('divideAmount', () => {
  it('100% Javi deja a Lali en CERO exacto, incluso con centavos (bug reportado)', () => {
    // $41.509,08 al 100% Javi dejaba $0,08 colgados en Lali
    const r = divideAmount(41509.08, 100);
    expect(r).toEqual({ javiAmount: 41509.08, laliAmount: 0 });
    expect(r.javiAmount + r.laliAmount).toBe(41509.08);
  });
  it('0% Javi deja a Javi en CERO exacto y todo a Lali', () => {
    expect(divideAmount(41509.08, 0)).toEqual({ javiAmount: 0, laliAmount: 41509.08 });
  });
  it('50/50 reparte y suma exacto (a 2 decimales)', () => {
    const r = divideAmount(100.01, 50);
    expect(r.javiAmount).toBe(50.01);
    expect(r.laliAmount).toBe(50);
    expect(round2(r.javiAmount + r.laliAmount)).toBe(100.01);
  });
  it('porcentaje arbitrario: las partes siempre suman el total', () => {
    for (const pct of [10, 33, 67, 99]) {
      const r = divideAmount(12345.67, pct);
      expect(round2(r.javiAmount + r.laliAmount)).toBe(12345.67);
      expect(r.javiAmount).toBeGreaterThanOrEqual(0);
      expect(r.laliAmount).toBeGreaterThanOrEqual(0);
    }
  });
  it('porcentajes fuera de rango se recortan a 0–100', () => {
    expect(divideAmount(100, 150)).toEqual({ javiAmount: 100, laliAmount: 0 });
    expect(divideAmount(100, -20)).toEqual({ javiAmount: 0, laliAmount: 100 });
  });
});

// ── Split normalizado ─────────────────────────────────────────────────────────
describe('resolveSplit', () => {
  it('iguales reparte en partes iguales', () => {
    expect(resolveSplit(100, { strategy: 'iguales', entries: [{ participant: 'Javi' }, { participant: 'Lali' }] }))
      .toEqual({ Javi: 50, Lali: 50 });
  });
  it('iguales con remanente: la última entry lo absorbe (suma exacta)', () => {
    const r = resolveSplit(100, { strategy: 'iguales', entries: [{ participant: 'A' }, { participant: 'B' }, { participant: 'C' }] });
    expect([r.A, r.B, r.C]).toEqual([33.33, 33.33, 33.34]);
    expect(round2(r.A + r.B + r.C)).toBe(100);
  });
  it('montos usa los valores literales', () => {
    expect(resolveSplit(100, { strategy: 'montos', entries: [{ participant: 'Javi', value: 60 }, { participant: 'Lali', value: 40 }] }))
      .toEqual({ Javi: 60, Lali: 40 });
  });
  it('montos respeta los valores aunque no sumen el total (no redistribuye)', () => {
    expect(resolveSplit(100, { strategy: 'montos', entries: [{ participant: 'Javi', value: 10 }, { participant: 'Lali', value: 10 }] }))
      .toEqual({ Javi: 10, Lali: 10 });
  });
  it('porcentajes reparte por %', () => {
    expect(resolveSplit(100, { strategy: 'porcentajes', entries: [{ participant: 'Javi', value: 70 }, { participant: 'Lali', value: 30 }] }))
      .toEqual({ Javi: 70, Lali: 30 });
  });
  it('shares reparte proporcional a los pesos', () => {
    expect(resolveSplit(90, { strategy: 'shares', entries: [{ participant: 'A', value: 2 }, { participant: 'B', value: 1 }] }))
      .toEqual({ A: 60, B: 30 });
  });
  it('un solo participante recibe todo (caso gasto privado)', () => {
    expect(resolveSplit(123.45, { strategy: 'iguales', entries: [{ participant: 'Javi' }] })).toEqual({ Javi: 123.45 });
  });
  it('suma exacta con centavos en cualquier estrategia', () => {
    const r = resolveSplit(100.01, { strategy: 'porcentajes', entries: [{ participant: 'A', value: 33 }, { participant: 'B', value: 33 }, { participant: 'C', value: 34 }] });
    expect(round2(r.A + r.B + r.C)).toBe(100.01);
  });
});

describe('splitFromLegacy', () => {
  it('convierte javiAmount/laliAmount a montos equivalentes', () => {
    expect(splitFromLegacy(60, 40)).toEqual({ strategy: 'montos', entries: [{ participant: 'Javi', value: 60 }, { participant: 'Lali', value: 40 }] });
  });
  it('resolveSplit del split sintetizado reproduce los montos', () => {
    expect(resolveSplit(100, splitFromLegacy(70, 30))).toEqual({ Javi: 70, Lali: 30 });
  });
});

describe('sanitize · visibilidad + splitAmong (Sprint 11)', () => {
  it('gasto sin campos nuevos → compartido con splitAmong sintetizado, sin ownerId', () => {
    const s = sanitize(exp({ javiAmount: 60, laliAmount: 40 }), DEFAULT_CATS);
    expect(s.visibilidad).toBe('compartido');
    expect(s.splitAmong).toEqual({ strategy: 'montos', entries: [{ participant: 'Javi', value: 60 }, { participant: 'Lali', value: 40 }] });
    expect(s.ownerId).toBeUndefined();
  });
  it('privado conserva ownerId; compartido lo quita', () => {
    const priv = sanitize({ ...exp(), visibilidad: 'privado', ownerId: 'uid-javi' }, DEFAULT_CATS);
    expect(priv.visibilidad).toBe('privado');
    expect(priv.ownerId).toBe('uid-javi');
    const shared = sanitize({ ...exp(), visibilidad: 'compartido', ownerId: 'uid-javi' }, DEFAULT_CATS);
    expect(shared.ownerId).toBeUndefined();
  });
});

// ── Balance ───────────────────────────────────────────────────────────────────
// Convención: balance positivo = Lali le debe a Javi.
describe('calcBal', () => {
  it('ignora los gastos privados (no generan deuda entre los dos)', () => {
    const compartido = exp({ paidBy: 'Javi', javiAmount: 50, laliAmount: 50 });
    const privado = exp({ id: 'e2', paidBy: 'Javi', amount: 200, javiAmount: 200, laliAmount: 0, visibilidad: 'privado', ownerId: 'javi-uid' });
    expect(calcBal([compartido, privado])).toBe(50); // solo cuenta el compartido (Lali debe 50)
  });
  it('usa splitAmong cuando está presente, no los montos legacy', () => {
    const e = exp({ paidBy: 'Javi', javiAmount: 0, laliAmount: 0,
      splitAmong: { strategy: 'porcentajes', entries: [{ participant: 'Javi', value: 30 }, { participant: 'Lali', value: 70 }] } });
    expect(calcBal([e])).toBe(70); // Javi pagó; Lali debe su 70% de 100
  });
  it('si Javi paga un gasto compartido, Lali le debe su mitad', () => {
    const bal = calcBal([exp({ paidBy: 'Javi', javiAmount: 50, laliAmount: 50 })]);
    expect(bal).toBe(50);
  });
  it('si Lali paga un gasto compartido, Javi le debe su mitad (negativo)', () => {
    const bal = calcBal([exp({ paidBy: 'Lali', javiAmount: 50, laliAmount: 50 })]);
    expect(bal).toBe(-50);
  });
  it('gastos cruzados se compensan', () => {
    const bal = calcBal([
      exp({ paidBy: 'Javi', javiAmount: 50, laliAmount: 50 }),
      exp({ paidBy: 'Lali', javiAmount: 50, laliAmount: 50 }),
    ]);
    expect(bal).toBe(0);
  });
  it('si Javi paga algo que es 100% responsabilidad de Lali, debe todo', () => {
    const bal = calcBal([exp({ paidBy: 'Javi', amount: 100, javiAmount: 0, laliAmount: 100 })]);
    expect(bal).toBe(100);
  });
  it('si Javi paga algo 100% suyo, no genera deuda', () => {
    const bal = calcBal([exp({ paidBy: 'Javi', amount: 100, javiAmount: 100, laliAmount: 0 })]);
    expect(bal).toBe(0);
  });
});

describe('calcNetBal', () => {
  it('descuenta los pagos de la deudora', () => {
    const exps = [exp({ paidBy: 'Javi', javiAmount: 50, laliAmount: 50 })]; // Lali debe 50
    const pays = [pay({ from: 'Lali', to: 'Javi', amount: 50 })];
    expect(calcNetBal(exps, pays, 'ARS')).toBe(0);
  });
  it('un pago de Javi aumenta lo que Lali debe', () => {
    const exps = [exp({ paidBy: 'Javi', javiAmount: 50, laliAmount: 50 })];
    const pays = [pay({ from: 'Javi', to: 'Lali', amount: 30 })];
    expect(calcNetBal(exps, pays, 'ARS')).toBe(80);
  });
  it('filtra por moneda: gastos y pagos en otra moneda no afectan', () => {
    const exps = [
      exp({ paidBy: 'Javi', javiAmount: 50, laliAmount: 50, currency: 'ARS' }),
      exp({ paidBy: 'Javi', javiAmount: 10, laliAmount: 10, currency: 'USD' }),
    ];
    const pays = [pay({ from: 'Lali', amount: 10, currency: 'USD' })];
    expect(calcNetBal(exps, pays, 'ARS')).toBe(50);
    expect(calcNetBal(exps, pays, 'USD')).toBe(0);
  });
  it('gastos sin moneda cuentan como ARS', () => {
    const exps = [exp({ paidBy: 'Javi', javiAmount: 50, laliAmount: 50, currency: undefined as never })];
    expect(calcNetBal(exps, [], 'ARS')).toBe(50);
  });
});

// ── Grafo de deudas N personas ────────────────────────────────────────────────
const igual = (...ps: string[]) => ({ strategy: 'iguales' as const, entries: ps.map(participant => ({ participant })) });

describe('computeBalances', () => {
  it('2 personas: el pagador queda acreedor por la parte del otro', () => {
    const exps = [exp({ paidBy: 'Javi', amount: 100, splitAmong: igual('Javi', 'Lali') })];
    expect(computeBalances(exps, [], 'ARS')).toEqual({ Javi: 50, Lali: -50 });
  });
  it('3 personas iguales: pagador acreedor, los otros deudores', () => {
    const exps = [exp({ paidBy: 'Javi', amount: 120, splitAmong: igual('Javi', 'Lali', 'Caro') })];
    expect(computeBalances(exps, [], 'ARS')).toEqual({ Javi: 80, Lali: -40, Caro: -40 });
  });
  it('excluye los gastos privados', () => {
    const exps = [exp({ paidBy: 'Javi', amount: 100, visibilidad: 'privado', ownerId: 'x', splitAmong: igual('Javi') })];
    expect(computeBalances(exps, [], 'ARS')).toEqual({});
  });
  it('filtra por moneda', () => {
    const exps = [exp({ paidBy: 'Javi', amount: 100, currency: 'USD', splitAmong: igual('Javi', 'Lali') })];
    expect(computeBalances(exps, [], 'ARS')).toEqual({});
  });
  it('los pagos saldan la deuda', () => {
    const exps = [exp({ paidBy: 'Javi', amount: 100, splitAmong: igual('Javi', 'Lali') })];
    const pays = [pay({ from: 'Lali', to: 'Javi', amount: 50 })];
    expect(computeBalances(exps, pays, 'ARS')).toEqual({});
  });
});

describe('simplifyDebts', () => {
  it('sin saldos → sin transferencias', () => {
    expect(simplifyDebts({})).toEqual([]);
    expect(simplifyDebts({ Javi: 0, Lali: 0 })).toEqual([]);
  });
  it('una deuda simple → una transferencia', () => {
    expect(simplifyDebts({ Javi: 50, Lali: -50 })).toEqual([{ from: 'Lali', to: 'Javi', amount: 50 }]);
  });
  it('un deudor y dos acreedores → 2 transferencias que suman la deuda', () => {
    const t = simplifyDebts({ Javi: 30, Lali: 30, Caro: -60 });
    expect(t.length).toBe(2);
    expect(t.every(x => x.from === 'Caro')).toBe(true);
    expect(t.reduce((s, x) => s + x.amount, 0)).toBe(60);
  });
  it('deja todos los saldos en 0 y usa ≤ n−1 transferencias', () => {
    const bal: Record<string, number> = { A: 50, B: 20, C: -30, D: -40 };
    const t = simplifyDebts(bal);
    expect(t.length).toBeLessThanOrEqual(3); // n = 4
    const settled: Record<string, number> = { ...bal };
    t.forEach(({ from, to, amount }) => { settled[from] += amount; settled[to] -= amount; });
    Object.values(settled).forEach(v => expect(Math.abs(v)).toBeLessThan(0.01));
  });
});

describe('lastPayment', () => {
  it('devuelve el pago más reciente de la moneda', () => {
    const pays = [
      pay({ id: 'a', date: '2026-01-01' }),
      pay({ id: 'b', date: '2026-03-01' }),
      pay({ id: 'c', date: '2026-02-01' }),
    ];
    expect(lastPayment(pays, 'ARS')?.id).toBe('b');
  });
  it('devuelve null si no hay pagos en esa moneda', () => {
    expect(lastPayment([pay({ currency: 'USD' })], 'ARS')).toBeNull();
    expect(lastPayment([], 'ARS')).toBeNull();
  });
});

// ── Períodos ──────────────────────────────────────────────────────────────────
describe('getPeriod', () => {
  it('asigna el período que contiene la fecha', () => {
    expect(getPeriod('2026-06-15', PERIODS)).toBe('Jun 2026');
    expect(getPeriod('2026-05-10', PERIODS)).toBe('May 2026');
  });
  it('incluye los días de inicio y fin (bordes)', () => {
    expect(getPeriod('2026-06-01', PERIODS)).toBe('Jun 2026');
    expect(getPeriod('2026-06-30', PERIODS)).toBe('Jun 2026');
  });
  it('fecha fuera de todos los períodos → Sin período', () => {
    expect(getPeriod('2027-01-01', PERIODS)).toBe('Sin período');
  });
  it('sin períodos configurados → Sin período', () => {
    expect(getPeriod('2026-06-15', [])).toBe('Sin período');
  });
});

// ── Planes de cuotas ──────────────────────────────────────────────────────────
function plan(over: Partial<Plan> = {}): Plan {
  return {
    id: 'plan_1', description: 'Heladera', totalAmount: 10000,
    installmentAmount: 3333, numInstallments: 3, paidInstallments: 0,
    startPeriod: 'May 2026', startDate: '2026-05-10', currency: 'ARS',
    paidBy: 'Javi', responsible: 'Ambos', paymentMethod: 'TC Visa Javi',
    bank: 'Galicia', category: '🏠 Hogar', javiAmount: 1666.5, laliAmount: 1666.5,
    createdAt: '2026-05-10T10:00:00.000Z',
    ...over,
  };
}

describe('generatePlanExpenses', () => {
  it('genera una cuota por cada cuota restante', () => {
    const insts = generatePlanExpenses(plan(), PERIODS);
    expect(insts).toHaveLength(3);
    expect(insts.map(i => i.installmentNum)).toEqual([1, 2, 3]);
    expect(insts.every(i => i.fromPlan && i.planId === 'plan_1')).toBe(true);
  });

  it('la suma de las cuotas iguala EXACTAMENTE el total (fix de redondeo)', () => {
    // 10000 / 3 = 3333.33… → cuotas de 3333; la última absorbe la diferencia
    const insts = generatePlanExpenses(plan(), PERIODS);
    const total = insts.reduce((s, i) => s + i.amount, 0);
    expect(total).toBe(10000);
    expect(insts[0].amount).toBe(3333);
    expect(insts[1].amount).toBe(3333);
    expect(insts[2].amount).toBe(3334); // ajustada
  });

  it('la división Javi/Lali de la última cuota corresponde a su monto ajustado', () => {
    const insts = generatePlanExpenses(plan(), PERIODS);
    const last = insts[2];
    expect(last.javiAmount + last.laliAmount).toBe(last.amount);
  });

  it('asigna períodos consecutivos desde el período inicial', () => {
    const insts = generatePlanExpenses(plan(), PERIODS);
    expect(insts.map(i => i.period)).toEqual(['May 2026', 'Jun 2026', 'Jul 2026']);
  });

  it('cuotas que exceden los períodos configurados quedan pendientes', () => {
    const insts = generatePlanExpenses(plan({ numInstallments: 5, totalAmount: 5000, installmentAmount: 1000 }), PERIODS);
    expect(insts.map(i => i.period)).toEqual(['May 2026', 'Jun 2026', 'Jul 2026', PENDING_PER, PENDING_PER]);
  });

  it('período inicial inexistente → todas pendientes', () => {
    const insts = generatePlanExpenses(plan({ startPeriod: 'NoExiste' }), PERIODS);
    expect(insts.every(i => i.period === PENDING_PER)).toBe(true);
  });

  it('cuotas del pasado: solo genera las restantes, numeradas desde la siguiente', () => {
    const insts = generatePlanExpenses(plan({ numInstallments: 6, paidInstallments: 4, totalAmount: 6000, installmentAmount: 1000 }), PERIODS);
    expect(insts).toHaveLength(2);
    expect(insts.map(i => i.installmentNum)).toEqual([5, 6]);
    // La última (6/6) absorbe el redondeo respecto al total
    expect(insts[1].amount).toBe(6000 - 1000 * 5);
  });

  it('plan de 1 cuota: monto = total', () => {
    const insts = generatePlanExpenses(plan({ numInstallments: 1, totalAmount: 999, installmentAmount: 999 }), PERIODS);
    expect(insts).toHaveLength(1);
    expect(insts[0].amount).toBe(999);
  });
});

describe('reassignPlanExpenses', () => {
  it('reasigna períodos de cuotas según la lista nueva y no toca gastos comunes', () => {
    const insts = generatePlanExpenses(plan(), PERIODS);
    const normal = exp({ id: 'n1', period: 'Jun 2026' });
    const newPeriods: Period[] = [
      { name: 'May 2026', start: '2026-05-01', end: '2026-05-31' },
      { name: 'Jun 2026', start: '2026-06-01', end: '2026-06-30' },
      // Jul eliminado → la 3.ª cuota queda pendiente
    ];
    const out = reassignPlanExpenses([...insts, normal], newPeriods, [plan()]);
    expect(out[0].period).toBe('May 2026');
    expect(out[1].period).toBe('Jun 2026');
    expect(out[2].period).toBe(PENDING_PER);
    expect(out[3].period).toBe('Jun 2026'); // gasto normal intacto
  });
});

describe('reassignExpensePeriods (re-bucketeo al cambiar períodos)', () => {
  it('reubica un gasto "Sin período" cuando aparece un período que cubre su fecha (BUG reportado)', () => {
    // Escenario del usuario: cargó un gasto con fecha posterior al último período
    // → quedó "Sin período". Luego define un período (Jul) que cubre esa fecha.
    const orphan = exp({ id: 'orphan', date: '2026-07-15', period: 'Sin período', fromPlan: false });
    const out = reassignExpensePeriods([orphan], PERIODS, []); // PERIODS incluye Jul 2026
    expect(out[0].period).toBe('Jul 2026');
  });
  it('si la fecha sigue sin caer en ningún período, queda "Sin período"', () => {
    const orphan = exp({ id: 'o2', date: '2027-12-01', period: 'Sin período' });
    expect(reassignExpensePeriods([orphan], PERIODS, [])[0].period).toBe('Sin período');
  });
  it('corrige un gasto mal asignado a otro período según su fecha', () => {
    const mal = exp({ id: 'e3', date: '2026-05-10', period: 'Jun 2026' });
    expect(reassignExpensePeriods([mal], PERIODS, [])[0].period).toBe('May 2026');
  });
  it('las cuotas de plan se reasignan por posición (no por fecha)', () => {
    const insts = generatePlanExpenses(plan(), PERIODS);
    const out = reassignExpensePeriods(insts, PERIODS, [plan()]);
    expect(out.map(i => i.period)).toEqual(['May 2026', 'Jun 2026', 'Jul 2026']);
  });
});

// ── Sanitización ──────────────────────────────────────────────────────────────
describe('sanitize', () => {
  it('completa valores por defecto ante datos incompletos', () => {
    const s = sanitize({ id: 'x' }, DEFAULT_CATS);
    expect(s.amount).toBe(0);
    expect(s.currency).toBe('ARS');
    expect(s.responsible).toBe('Ambos');
    expect(s.period).toBe('Sin período');
    expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('recorta fechas con hora a YYYY-MM-DD', () => {
    const s = sanitize(exp({ date: '2026-06-01T15:30:00' }), DEFAULT_CATS);
    expect(s.date).toBe('2026-06-01');
  });
  it('migra el valor legacy Edinson a Javi', () => {
    const s = sanitize(exp({ paidBy: 'Edinson' as never }), DEFAULT_CATS);
    expect(s.paidBy).toBe('Javi');
  });
  it('responsable inválido cae a Ambos', () => {
    const s = sanitize(exp({ responsible: 'Nadie' as never }), DEFAULT_CATS);
    expect(s.responsible).toBe('Ambos');
  });
  it('normaliza la categoría contra la lista', () => {
    const s = sanitize(exp({ category: 'hogar' }), DEFAULT_CATS);
    expect(s.category).toBe('🏠 Hogar');
  });
  it('convierte montos string a número', () => {
    const s = sanitize(exp({ amount: '1500.50' as never }), DEFAULT_CATS);
    expect(s.amount).toBe(1500.5);
  });
});
