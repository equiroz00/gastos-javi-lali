// ── components/Dashboard.tsx ──────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { ChevronDown, ArrowRightLeft, Calendar, CreditCard, Check, Trash2, Pencil } from 'lucide-react';
import { C, F, V, MONO, PENDING_PER, SP, FS } from '../constants';
import { fmt, fmtS, safeN, computeBalances, simplifyDebts, expenseResolved, sortByDate, getWeekStart, pctChange, lastPayment, periodRange } from '../lib/helpers';
import { useIsDesktop } from '../lib/useIsDesktop';
import useAppStore from '../store/useAppStore';
import { useExpenses, usePayments, usePlans, useSettings } from '../lib/queries';
import { Card, DonutRing } from './ui';
import ExpenseList from './ExpenseList';
import type { Expense, Payment, Period, Currency } from '../types';

// ── Moneda primaria de un conjunto de gastos (la de mayor total) ────────────────
function primaryCurrency(exps: Expense[]): Currency {
  const byCur: Record<string, number> = {};
  exps.forEach(e => { const c = e.currency || 'ARS'; byCur[c] = (byCur[c] || 0) + safeN(e.amount); });
  const curs = Object.keys(byCur).sort((a, b) => byCur[b] - byCur[a]);
  return curs[0] || 'ARS';
}

// ── ActivePlans ────────────────────────────────────────────────────────────────
function ActivePlans() {
  const plans      = usePlans();
  const expenses   = useExpenses();
  const cancelPlan = useAppStore(s => s.handleCancelPlan);
  const editPlan   = useAppStore(s => s.setEditingPlan);
  const [search, setSearch] = useState('');
  if (!plans.length) return null;
  const filtered = search.trim() === '' ? plans : plans.filter(p => p.description.toLowerCase().indexOf(search.toLowerCase()) >= 0);
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
        <h2 style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:800, color:C.navy, fontSize:'0.88rem', margin:0 }}>
          <CreditCard size={16} strokeWidth={2.2} color={C.accent} />Cuotas activas
        </h2>
        <span style={{ fontSize:'0.68rem', color:C.textMuted }}>{plans.length} plan{plans.length !== 1 ? 'es' : ''}</span>
      </div>
      {plans.length >= 3 && (
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar cuota..."
          style={{ width:'100%', border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.5rem 0.75rem', fontSize:'0.82rem', outline:'none', fontFamily:F, color:C.navy, background:C.surface, boxSizing:'border-box', marginBottom:'0.6rem' }}
        />
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', maxHeight:plans.length >= 3 ? '280px' : undefined, overflowY:plans.length >= 3 ? 'auto' : undefined }}>
        {filtered.map(plan => {
          const planExps = expenses.filter(e => e.planId === plan.id);
          const pending  = planExps.filter(e => e.period === PENDING_PER).length;
          const assigned = plan.numInstallments - pending;
          const pct      = Math.round(assigned / plan.numInstallments * 100);
          return (
            <Card key={plan.id} style={{ padding:'0.85rem', flexShrink:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.4rem' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, color:C.navy, fontSize:'0.88rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{plan.description}</div>
                  <div style={{ fontSize:'0.7rem', color:C.textMuted, marginTop:'0.1rem' }}>{fmt(plan.installmentAmount, plan.currency)}/mes · Total: {fmt(plan.totalAmount, plan.currency)}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0, marginLeft:'0.5rem' }}>
                  <div style={{ fontWeight:800, color:C.accent, fontSize:'0.82rem' }}>{assigned}/{plan.numInstallments}</div>
                  <div style={{ fontSize:'0.65rem', color:C.textMuted }}>cuotas</div>
                </div>
              </div>
              <div style={{ background:C.beige, borderRadius:'999px', height:'6px', overflow:'hidden', marginBottom:'0.4rem' }}>
                <div style={{ width:pct + '%', height:'100%', background:C.gradMain, borderRadius:'999px', transition:'width 0.4s' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                {pending > 0
                  ? <div style={{ fontSize:'0.68rem', color:C.warn, fontWeight:600 }}>⚠ {pending} cuota{pending > 1 ? 's' : ''} sin período</div>
                  : <div style={{ fontSize:'0.68rem', color:C.ok, fontWeight:600 }}>✓ Todas asignadas</div>}
                <div style={{ display:'flex', gap:'0.35rem', flexShrink:0 }}>
                  <button onClick={() => editPlan(plan)} style={{ display:'flex', alignItems:'center', gap:'0.2rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'0.2rem 0.5rem', fontSize:'0.65rem', color:C.navy, cursor:'pointer', fontFamily:F, fontWeight:700 }}>
                    <Pencil size={11} strokeWidth={2.2} />Editar
                  </button>
                  <button onClick={() => cancelPlan(plan.id)} style={{ background:'transparent', border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'0.2rem 0.5rem', fontSize:'0.65rem', color:C.textMuted, cursor:'pointer', fontFamily:F }}>Cancelar</button>
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', fontSize:'0.8rem', color:C.textMuted, padding:'1rem' }}>No se encontraron cuotas</div>
        )}
      </div>
    </div>
  );
}

// ── ¿Quién pagó más? — movida desde Stats al Inicio ─────────────────────────────
// Calcula sobre los gastos del período en la moneda primaria.
function WhoPaidMore({ periodExps, cur }: { periodExps: Expense[]; cur: Currency }) {
  // Solo gastos compartidos: los privados no entran en la comparación entre los dos.
  const curExps  = periodExps.filter(e => (e.currency || 'ARS') === cur && e.visibilidad !== 'privado');
  const total    = curExps.reduce((s, e) => s + safeN(e.amount), 0);
  const javiPaid = curExps.filter(e => e.paidBy === 'Javi').reduce((s, e) => s + safeN(e.amount), 0);
  const laliPaid = curExps.filter(e => e.paidBy === 'Lali').reduce((s, e) => s + safeN(e.amount), 0);
  const javiResp = curExps.reduce((s, e) => s + safeN(expenseResolved(e)['Javi']), 0);
  const laliResp = curExps.reduce((s, e) => s + safeN(expenseResolved(e)['Lali']), 0);

  const javiPct = total > 0 ? Math.round(javiPaid / total * 100) : 0;
  const laliPct = total > 0 ? 100 - javiPct : 0;
  const leaderJavi = javiPaid >= laliPaid;
  const ringSegments = total > 0
    ? [{ value: javiPaid, color: C.navy }, { value: laliPaid, color: C.accent }]
    : [{ value: 1, color: C.border }];

  // Fila por persona: punto de color · nombre · monto pagado · porcentaje.
  const personRow = (name: 'Javi' | 'Lali', color: string, paid: number, pct: number, resp: number) => (
    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
      <span style={{ width:'9px', height:'9px', borderRadius:'50%', background:color, flexShrink:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'0.78rem', fontWeight:700, color:C.navy }}>{name}</div>
        <div style={{ fontSize:'0.62rem', color:C.textMuted }}>Resp. {fmtS(resp, cur)}</div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontWeight:800, color:C.navy, fontSize:'0.82rem', fontFamily:MONO }}>{fmtS(paid, cur)}</div>
        <div style={{ fontSize:'0.62rem', color:C.textMuted }}>{pct}%</div>
      </div>
    </div>
  );

  return (
    <Card>
      <h3 style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:800, color:C.navy, margin:'0 0 0.85rem', fontSize:'0.9rem' }}>
        <CreditCard size={15} strokeWidth={2.2} color={C.accent} />¿Quién pagó más?
      </h3>
      <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
        <DonutRing size={94} thickness={14} segments={ringSegments}>
          <div style={{ fontWeight:800, fontSize:'1rem', color:leaderJavi ? C.navy : C.accent, fontFamily:MONO }}>{total > 0 ? (leaderJavi ? javiPct : laliPct) : 0}%</div>
          <div style={{ fontSize:'0.56rem', color:C.textMuted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em' }}>{leaderJavi ? 'Javi' : 'Lali'}</div>
        </DonutRing>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'0.55rem' }}>
          {personRow('Javi', C.navy, javiPaid, javiPct, javiResp)}
          <div style={{ height:'1px', background:C.border }} />
          {personRow('Lali', C.accent, laliPaid, laliPct, laliResp)}
        </div>
      </div>
    </Card>
  );
}

// ── Último pago — movida desde Stats al Inicio ──────────────────────────────────
function LastPaymentCard({ payments, cur }: { payments: Payment[]; cur: Currency }) {
  const lp = lastPayment(payments, cur);
  if (!lp) {
    return (
      <Card style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', gap:'0.4rem', minHeight:'110px', color:C.textMuted }}>
        <ArrowRightLeft size={20} strokeWidth={2} color={C.textMuted} />
        <span style={{ fontSize:'0.8rem', fontWeight:700 }}>Sin pagos registrados</span>
      </Card>
    );
  }
  return (
    <Card style={{ background:'linear-gradient(135deg,#2d9e7f,#1db88c)' }}>
      <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.75)', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.05em' }}>Último pago</div>
      <div style={{ fontWeight:900, color:C.white, fontSize:'1.3rem', marginTop:'0.2rem', fontFamily:MONO }}>{fmt(safeN(lp.amount), lp.currency || 'ARS')}</div>
      <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.85)', marginTop:'0.15rem' }}>{lp.from} → {lp.to}</div>
      <div style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.65)' }}>{lp.date}</div>
    </Card>
  );
}

// ── UnifiedHeader — Balance + Período + Total en un solo bloque ─────────────────
interface UnifiedHeaderProps {
  periods: Period[];
  selPeriod: string;
  setSelPeriod: (p: string) => void;
  periodExps: Expense[];
  payments: Payment[];
  allExpenses: Expense[];
}

interface Transfer { from: string; to: string; amount: number; }
interface BalData {
  noDebt: boolean;
  balances: Record<string, number>;
  transfers: Transfer[];
  payAdj: Payment[]; total: number;
}

function UnifiedHeader({ periods = [], selPeriod, setSelPeriod, periodExps = [], payments: allPayments = [], allExpenses = [] }: UnifiedHeaderProps) {
  const openPaymentModal = useAppStore(s => s.openPaymentModal);
  const deletePayment    = useAppStore(s => s.deletePayment);
  const [expanded, setExpanded] = useState(false);

  const filteredPayments = selPeriod === 'Todos'
    ? allPayments
    : allPayments.filter(p => p.period === selPeriod);

  // Agrupar por moneda
  const byCur: Record<string, { total: number }> = {};
  periodExps.forEach(e => {
    const c = e.currency || 'ARS';
    if (!byCur[c]) byCur[c] = { total: 0 };
    byCur[c].total += safeN(e.amount);
  });
  const curs = Object.keys(byCur).sort((a, b) => byCur[b].total - byCur[a].total);
  const count = periodExps.length;

  // Grafo de deudas: computeBalances ya excluye privados y filtra por moneda.
  const payPeriod = selPeriod === 'Todos' ? undefined : selPeriod;
  const settleBtn = (t: Transfer, c: string, primary?: boolean) => (
    <button onClick={() => openPaymentModal(t.from, t.to, t.amount, c, payPeriod)}
      style={primary
        ? { display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem', background:C.accent, border:'none', borderRadius:'0.8rem', padding:'0.55rem 0.9rem', color:C.white, fontWeight:800, fontSize:'0.8rem', cursor:'pointer', fontFamily:F, whiteSpace:'nowrap' }
        : { display:'flex', alignItems:'center', gap:'0.3rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.6rem', padding:'0.35rem 0.6rem', color:C.accent, fontWeight:700, fontSize:'0.72rem', cursor:'pointer', fontFamily:F, whiteSpace:'nowrap' }}>
      <ArrowRightLeft size={13} strokeWidth={2.2} />Registrar
    </button>
  );

  function balData(c: Currency): BalData {
    const balances = computeBalances(periodExps, filteredPayments, c);
    const transfers = simplifyDebts(balances);
    return {
      noDebt: transfers.length === 0,
      balances, transfers,
      payAdj: filteredPayments.filter(p => (p.currency || 'ARS') === c),
      total: byCur[c] ? byCur[c].total : 0,
    };
  }

  // ── Selector de período (chip dropdown) ──────────────────────────────────────
  // Debajo del chip se muestran las fechas del ciclo elegido (dd/mm) para tener
  // a mano de qué días habla el balance. Va como línea aparte y no dentro del
  // <option>: el texto del seleccionado ensancharía el chip en móvil.
  const selRange = periodRange(periods.find(p => p.name === selPeriod));
  // "Estado de cuenta" convierte este bloque en la BANDA de acento con la cifra
  // protagonista (mockup 2a/3a). Sobre navy los tokens de texto habituales no
  // contrastan, así que la banda usa su propio trío ink/dim/line.
  const band = V.heroBand;
  const ink  = band ? C.onNavy : C.navy;
  const dim  = band ? C.onNavy + '99' : C.textMuted;
  const line = band ? C.onNavy + '33' : C.border;

  const periodSelector = (
    <div style={{ display:'inline-flex', flexDirection:'column', alignItems:'flex-start', minWidth:0 }}>
      <div style={{ position:'relative', display:'inline-flex', alignItems:'center' }}>
        <select
          value={selPeriod}
          onChange={e => setSelPeriod(e.target.value)}
          style={{ appearance:'none', WebkitAppearance:'none', border:'1px solid '+C.border, borderRadius:'999px', padding:'0.3rem 1.7rem 0.3rem 0.8rem', fontSize:'0.78rem', fontWeight:700, color:C.navy, background:C.bg, outline:'none', cursor:'pointer', fontFamily:F } as React.CSSProperties}
        >
          <option value="Todos">Todos los períodos</option>
          {periods.slice().reverse().map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
        <ChevronDown size={14} strokeWidth={2.2} color={C.textMuted} style={{ position:'absolute', right:'0.6rem', pointerEvents:'none' }} />
      </div>
      {selRange && (
        <span style={{ fontSize:'0.64rem', color:dim, marginTop:'0.2rem', paddingLeft:'0.85rem', fontFamily:MONO, letterSpacing:'-0.01em' }}>
          {selRange}
        </span>
      )}
    </div>
  );

  // ── Estado vacío ─────────────────────────────────────────────────────────────
  if (!curs.length) {
    return (
      <Card style={{ padding:'1rem 1.1rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
          {periodSelector}
          <span style={{ fontSize:'0.72rem', color:C.textMuted, fontWeight:600 }}>0 gastos</span>
        </div>
        <div style={{ fontSize:'1.15rem', fontWeight:800, color:C.navy, padding:'0.5rem 0' }}>Sin gastos en este período</div>
      </Card>
    );
  }

  const primary = curs[0];
  const pd = balData(primary);

  // ── Indicador de incremento/descenso vs período anterior (como en Stats) ─────
  // Compara el total de la moneda primaria con el del período anterior configurado.
  let amtPct: number | null = null;
  if (selPeriod !== 'Todos') {
    const idx = periods.findIndex(p => p.name === selPeriod);
    if (idx > 0) {
      const prevName = periods[idx - 1].name;
      const prevTotal = allExpenses
        .filter(e => e.period === prevName && (e.currency || 'ARS') === primary)
        .reduce((s, e) => s + safeN(e.amount), 0);
      amtPct = pctChange(pd.total, prevTotal);
    }
  }
  // Gastar más = rojo (▲), gastar menos = verde (▼).
  const pctColor = amtPct === null ? C.textMuted : amtPct > 0 ? C.danger : amtPct < 0 ? C.ok : C.textMuted;
  const pctArrow = amtPct === null ? '' : amtPct > 0 ? '▲' : amtPct < 0 ? '▼' : '–';

  // ── Fila de balance secundaria (otras monedas) ──────────────────────────────
  function secondaryRow(c: string) {
    const d = balData(c);
    return (
      <div key={c} style={{ padding:'0.6rem 0', borderTop:'1px solid '+C.border }}>
        <div style={{ fontSize:'0.68rem', color:C.textMuted, fontWeight:600, marginBottom:'0.25rem' }}>Balance {c}</div>
        {d.noDebt
          ? <div style={{ fontSize:'0.9rem', fontWeight:800, color:C.navy }}>Al día</div>
          : d.transfers.map((t, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'0.5rem', padding:'0.2rem 0', flexWrap:'wrap' }}>
                <span style={{ fontSize:'0.8rem', color:C.navy, minWidth:0, overflowWrap:'anywhere' }}><strong>{t.from}</strong> → <strong>{t.to}</strong> <span style={{ fontFamily:MONO, fontWeight:700 }}>{fmt(t.amount, c)}</span></span>
                <div style={{ flexShrink:0 }}>{settleBtn(t, c)}</div>
              </div>
            ))}
      </div>
    );
  }

  // ── Panel de detalle (breakdown + pagos) ─────────────────────────────────────
  function detailPanel(c: string) {
    const d = balData(c);
    return (
      <div key={'det_' + c} style={{ marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'1px dashed '+C.border }}>
        <div style={{ fontSize:'0.66rem', color:C.textMuted, fontWeight:700, marginBottom:'0.5rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>Saldos {c}</div>
        {Object.keys(d.balances).length === 0
          ? <div style={{ fontSize:'0.78rem', color:C.textMuted, marginBottom:'0.5rem' }}>Todos en cero.</div>
          : <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem', marginBottom:'0.5rem' }}>
              {Object.entries(d.balances).sort((a, b) => b[1] - a[1]).map(([p, v]) => (
                <div key={p} style={{ background:C.bg, borderRadius:'0.6rem', padding:'0.4rem 0.6rem', border:'1px solid '+C.border, fontSize:'0.75rem' }}>
                  <span style={{ color:C.navy, fontWeight:700 }}>{p}</span>{' '}
                  <span style={{ fontFamily:MONO, fontWeight:800, color: v >= 0 ? C.ok : C.danger }}>{v >= 0 ? '+' : ''}{fmt(v, c)}</span>
                </div>
              ))}
            </div>}
        {d.payAdj.length > 0 && (
          <div style={{ background:C.bg, borderRadius:'0.7rem', padding:'0.5rem 0.7rem', border:'1px solid '+C.border }}>
            <div style={{ fontSize:'0.66rem', color:C.textMuted, fontWeight:700, marginBottom:'0.3rem' }}>Pagos registrados</div>
            {d.payAdj.map(p => (
              <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'0.5rem', padding:'0.2rem 0' }}>
                <span style={{ fontSize:'0.7rem', color:C.navy }}>
                  {p.date} · {p.from} → {p.to} · <span style={{ fontFamily:MONO, fontWeight:700 }}>{fmt(safeN(p.amount), c)}</span>
                </span>
                <button
                  onClick={() => { if (window.confirm('¿Eliminar este pago?')) deletePayment(p.id); }}
                  style={{ background:'none', border:'none', color:C.danger, cursor:'pointer', display:'flex', alignItems:'center', padding:'0.1rem' }}
                >
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card style={ band
      ? { padding:'1.35rem 1.25rem 1.2rem', background:C.navy, border:'none', borderRadius:0, color:C.onNavy }
      : { padding:'1rem 1.1rem', background:C.accent + '14' } }>
      {/* Top row: período + count + total + variación */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.85rem', flexWrap:'wrap', gap:'0.4rem' }}>
        {periodSelector}
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.72rem', color:dim, fontWeight:600 }}>
          <span>{count} gastos</span>
          <span style={{ opacity:0.4 }}>·</span>
          <span>Total <span style={{ fontFamily:MONO, fontWeight:700, color:ink }}>{fmtS(pd.total, primary)}</span></span>
          {amtPct !== null && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:'0.15rem', color:pctColor, fontWeight:800 }}>
              {pctArrow} {Math.abs(amtPct)}%
            </span>
          )}
        </div>
      </div>

      {/* Hero: saldos por persona / cómo saldar (moneda primaria) */}
      <div style={{ marginBottom:'0.85rem' }}>
        <div style={{ fontSize:'0.68rem', color:dim, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Balance{curs.length > 1 ? ' ' + primary : ''}</div>
        {pd.noDebt ? (
          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginTop:'0.2rem' }}>
            <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:C.accent, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Check size={16} strokeWidth={3} color={C.white} />
            </div>
            <span style={{ fontSize:'1.3rem', fontWeight:800, color:ink }}>¡Al día!</span>
          </div>
        ) : pd.transfers.length === 1 ? (
          <>
            <div style={{ fontSize:'0.82rem', color:dim, marginTop:'0.1rem', fontWeight:500 }}>{pd.transfers[0].from} le debe a {pd.transfers[0].to}</div>
            {/* flexWrap + minWidth:0: el monto va en MONO (no se puede cortar) y
                el botón tiene nowrap, así que con 7 cifras ninguno cedía y se
                salía de la tarjeta. Ahora el monto puede encoger y, si aun así
                no entra, el botón baja a la línea siguiente. */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.6rem', marginTop:'0.1rem', flexWrap:'wrap' }}>
              <div style={{ fontSize:FS.hero, fontWeight:800, color:ink, fontFamily:MONO, letterSpacing:'-0.02em', lineHeight:1.05, minWidth:0, flex:'1 1 auto', overflowWrap:'anywhere' }}>{fmt(pd.transfers[0].amount, primary)}</div>
              <div style={{ flexShrink:0 }}>{settleBtn(pd.transfers[0], primary, true)}</div>
            </div>
          </>
        ) : (
          <div style={{ marginTop:'0.4rem' }}>
            <div style={{ fontSize:'0.72rem', color:dim, fontWeight:700, marginBottom:'0.3rem' }}>Para quedar a mano:</div>
            {pd.transfers.map((t, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem', padding:'0.4rem 0', borderTop: i ? '1px solid '+line : 'none', flexWrap:'wrap' }}>
                <span style={{ fontSize:'0.88rem', color:ink, fontWeight:600, minWidth:0, overflowWrap:'anywhere' }}>
                  <strong>{t.from}</strong> → <strong>{t.to}</strong>{' '}
                  <span style={{ fontFamily:MONO, fontWeight:800 }}>{fmt(t.amount, primary)}</span>
                </span>
                <div style={{ flexShrink:0 }}>{settleBtn(t, primary)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detalle */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.25rem', background:'transparent', border:'1px solid '+line, borderRadius:'0.8rem', padding:'0.55rem', color:dim, fontWeight:600, fontSize:'0.75rem', cursor:'pointer', fontFamily:F }}
      >
        Ver detalle<ChevronDown size={14} strokeWidth={2.2} style={{ transform:expanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }} />
      </button>

      {/* Secondary currencies */}
      {curs.length > 1 && <div style={{ marginTop:'0.6rem' }}>{curs.slice(1).map(secondaryRow)}</div>}
      {/* Expanded detail */}
      {expanded && curs.map(detailPanel)}
    </Card>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const isDesktop = useIsDesktop();
  const expenses          = useExpenses();
  const settings          = useSettings();
  const plans             = usePlans();
  const payments          = usePayments();
  const requestDelete     = useAppStore(s => s.requestDelete);
  const setEditingExpense = useAppStore(s => s.setEditingExpense);

  const periods = settings.periods || [];
  const latestPeriod = periods.length ? periods[periods.length - 1].name : '';
  const [selPeriod, setSelPeriod] = useState(latestPeriod);

  useEffect(() => { if (latestPeriod && !selPeriod) setSelPeriod(latestPeriod); }, [latestPeriod]);

  const periodExps = (selPeriod && selPeriod !== 'Todos')
    ? expenses.filter(e => e.period === selPeriod)
    : expenses.filter(e => e.period !== PENDING_PER);
  const weekStart = getWeekStart();
  const weekExps = sortByDate(expenses.filter(e => e.date && new Date(e.date + 'T12:00:00') >= weekStart && e.period !== PENDING_PER));

  const primaryCur = primaryCurrency(periodExps);

  // ── Sections defined once, reused in both layouts ────────────────────────────
  const headerBlock = (
    <UnifiedHeader periods={periods} selPeriod={selPeriod} setSelPeriod={setSelPeriod} periodExps={periodExps} payments={payments} allExpenses={expenses} />
  );
  const whoPaidBlock  = <WhoPaidMore periodExps={periodExps} cur={primaryCur} />;
  const lastPayBlock  = <LastPaymentCard payments={payments} cur={primaryCur} />;

  const weekSection = (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
        <h2 style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:800, color:C.navy, fontSize:'0.88rem', margin:0 }}>
          <Calendar size={16} strokeWidth={2.2} color={C.accent} />Esta semana
        </h2>
        <span style={{ fontSize:'0.68rem', color:C.textMuted }}>{weekExps.length} gastos</span>
      </div>
      {weekExps.length === 0 ? (
        <Card style={{ padding:'1.5rem', textAlign:'center', color:C.textMuted, fontSize:'0.85rem' }}>No hay gastos esta semana</Card>
      ) : (
        <Card style={{ padding:0, overflow:'hidden' }}>
          <div style={{ maxHeight: isDesktop ? 'calc(6 * 68px)' : 'calc(4 * 68px)', overflowY:'auto' }}>
            <ExpenseList expenses={weekExps} onDelete={requestDelete} onEdit={setEditingExpense} />
          </div>
          {weekExps.length > (isDesktop ? 6 : 4) && (
            <div style={{ textAlign:'center', padding:'0.4rem', fontSize:'0.7rem', color:C.textMuted, borderTop:'1px solid '+C.border }}>↓ Deslizá para ver más</div>
          )}
        </Card>
      )}
    </div>
  );

  const plansSection = plans.length > 0 ? (
    <ActivePlans />
  ) : (
    <Card style={{ padding:SP.xl, textAlign:'center', color:C.textMuted, fontSize:'0.82rem', display:'flex', alignItems:'center', justifyContent:'center', gap:SP.sm }}>
      <CreditCard size={20} strokeWidth={2} color={C.textMuted} />
      <span style={{ fontWeight:700 }}>Sin cuotas activas</span>
    </Card>
  );

  // ── DESKTOP layout — arriba 3 columnas, abajo 2 columnas ─────────────────────
  if (isDesktop) {
    return (
      <div style={{ padding:SP.lg, display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap:SP.lg, alignItems:'start' }}>
        {/* Col 1: balance · ¿quién pagó más? · último pago */}
        <div style={{ display:'flex', flexDirection:'column', gap:SP.lg }}>
          {headerBlock}
          {whoPaidBlock}
          {lastPayBlock}
        </div>
        {/* Col 2: esta semana · cuotas activas */}
        <div style={{ display:'flex', flexDirection:'column', gap:SP.lg }}>
          {weekSection}
          {plansSection}
        </div>
      </div>
    );
  }

  // ── MOBILE — una columna: balance, quién pagó, último pago, semana, cuotas ───
  return (
    <div style={{ padding:SP.lg, display:'flex', flexDirection:'column', gap:SP.lg }}>
      {headerBlock}
      {whoPaidBlock}
      {lastPayBlock}
      {weekSection}
      <ActivePlans />
    </div>
  );
}
