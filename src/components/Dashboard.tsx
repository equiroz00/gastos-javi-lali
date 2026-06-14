// ── components/Dashboard.tsx ──────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { ChevronDown, ArrowRightLeft, Calendar, CreditCard, Check, Trash2 } from 'lucide-react';
import { C, F, MONO, PENDING_PER, SP } from '../constants';
import { fmt, fmtS, safeN, calcNetBal, sortByDate, getWeekStart } from '../lib/helpers';
import { useIsDesktop } from '../lib/useIsDesktop';
import useAppStore from '../store/useAppStore';
import { Card } from './ui';
import ExpenseList from './ExpenseList';
import type { Expense, Payment, Period, Currency } from '../types';

// ── ActivePlans ────────────────────────────────────────────────────────────────
function ActivePlans() {
  const plans      = useAppStore(s => s.plans);
  const expenses   = useAppStore(s => s.expenses);
  const cancelPlan = useAppStore(s => s.handleCancelPlan);
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
                  ? <div style={{ fontSize:'0.68rem', color:'#b45309', fontWeight:600 }}>⚠ {pending} cuota{pending > 1 ? 's' : ''} sin período</div>
                  : <div style={{ fontSize:'0.68rem', color:'#2d9e7f', fontWeight:600 }}>✓ Todas asignadas</div>}
                <button onClick={() => cancelPlan(plan.id)} style={{ background:'transparent', border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'0.2rem 0.5rem', fontSize:'0.65rem', color:C.textMuted, cursor:'pointer', fontFamily:F }}>Cancelar</button>
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

// ── UnifiedHeader — Balance + Período + Total en un solo bloque ─────────────────
interface UnifiedHeaderProps {
  periods: Period[];
  selPeriod: string;
  setSelPeriod: (p: string) => void;
  periodExps: Expense[];
  payments: Payment[];
}

interface BalData {
  netBal: number; noDebt: boolean; laliOwes: boolean;
  javiPaid: number; laliPaid: number;
  javiOwes: number; laliOwes2: number;
  payAdj: Payment[]; total: number;
}

function UnifiedHeader({ periods = [], selPeriod, setSelPeriod, periodExps = [], payments: allPayments = [] }: UnifiedHeaderProps) {
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

  function balData(c: Currency): BalData {
    const netBal = calcNetBal(periodExps, filteredPayments, c);
    const curExps = periodExps.filter(e => (e.currency || 'ARS') === c);
    return {
      netBal, noDebt: Math.abs(netBal) < 1, laliOwes: netBal > 0,
      javiPaid: curExps.filter(e => e.paidBy === 'Javi').reduce((s, e) => s + safeN(e.amount), 0),
      laliPaid: curExps.filter(e => e.paidBy === 'Lali').reduce((s, e) => s + safeN(e.amount), 0),
      javiOwes: curExps.reduce((s, e) => s + safeN(e.javiAmount), 0),
      laliOwes2: curExps.reduce((s, e) => s + safeN(e.laliAmount), 0),
      payAdj: filteredPayments.filter(p => (p.currency || 'ARS') === c),
      total: byCur[c] ? byCur[c].total : 0,
    };
  }

  // ── Selector de período (chip dropdown) ──────────────────────────────────────
  const periodSelector = (
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

  // ── Fila de balance secundaria (otras monedas) ──────────────────────────────
  function secondaryRow(c: string) {
    const d = balData(c);
    return (
      <div key={c} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.6rem 0', borderTop:'1px solid '+C.border }}>
        <div>
          <div style={{ fontSize:'0.68rem', color:C.textMuted, fontWeight:600 }}>Balance {c}</div>
          {d.noDebt
            ? <div style={{ fontSize:'0.95rem', fontWeight:800, color:C.navy }}>Al día</div>
            : <div style={{ fontSize:'0.95rem', fontWeight:800, color:C.navy, fontFamily:MONO }}>{fmt(d.netBal, c)}</div>}
        </div>
        {!d.noDebt && (
          <button
            onClick={() => openPaymentModal(c, d.netBal, selPeriod === 'Todos' ? undefined : selPeriod)}
            style={{ display:'flex', alignItems:'center', gap:'0.3rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.6rem', padding:'0.35rem 0.6rem', color:C.accent, fontWeight:700, fontSize:'0.72rem', cursor:'pointer', fontFamily:F }}
          >
            <ArrowRightLeft size={13} strokeWidth={2.2} />Pagar
          </button>
        )}
      </div>
    );
  }

  // ── Panel de detalle (breakdown + pagos) ─────────────────────────────────────
  function detailPanel(c: string) {
    const d = balData(c);
    return (
      <div key={'det_' + c} style={{ marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'1px dashed '+C.border }}>
        <div style={{ fontSize:'0.66rem', color:C.textMuted, fontWeight:700, marginBottom:'0.5rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>Detalle {c}</div>
        <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.5rem' }}>
          <div style={{ flex:1, background:C.bg, borderRadius:'0.7rem', padding:'0.55rem', border:'1px solid '+C.border }}>
            <div style={{ fontSize:'0.62rem', color:C.textMuted, marginBottom:'0.15rem' }}>Javi pagó</div>
            <div style={{ fontWeight:800, color:C.navy, fontFamily:MONO, fontSize:'0.82rem' }}>{fmt(d.javiPaid, c)}</div>
          </div>
          <div style={{ flex:1, background:C.bg, borderRadius:'0.7rem', padding:'0.55rem', border:'1px solid '+C.border }}>
            <div style={{ fontSize:'0.62rem', color:C.textMuted, marginBottom:'0.15rem' }}>Lali pagó</div>
            <div style={{ fontWeight:800, color:C.navy, fontFamily:MONO, fontSize:'0.82rem' }}>{fmt(d.laliPaid, c)}</div>
          </div>
        </div>
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
                  style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer', display:'flex', alignItems:'center', padding:'0.1rem' }}
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
    <Card style={{ padding:'1rem 1.1rem' }}>
      {/* Top row: período + count + total */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.85rem', flexWrap:'wrap', gap:'0.4rem' }}>
        {periodSelector}
        <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', fontSize:'0.72rem', color:C.textMuted, fontWeight:600 }}>
          <span>{count} gastos</span>
          <span style={{ opacity:0.4 }}>·</span>
          <span>Total <span style={{ fontFamily:MONO, fontWeight:700, color:C.navy }}>{fmtS(pd.total, primary)}</span></span>
        </div>
      </div>

      {/* Hero balance (primary currency) */}
      <div style={{ marginBottom:'0.85rem' }}>
        <div style={{ fontSize:'0.68rem', color:C.textMuted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Balance{curs.length > 1 ? ' ' + primary : ''}</div>
        {pd.noDebt ? (
          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginTop:'0.2rem' }}>
            <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:C.accent, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Check size={16} strokeWidth={3} color={C.white} />
            </div>
            <span style={{ fontSize:'1.3rem', fontWeight:800, color:C.navy }}>¡Al día!</span>
          </div>
        ) : (
          <>
            <div style={{ fontSize:'0.82rem', color:C.textMuted, marginTop:'0.1rem', fontWeight:500 }}>{(pd.laliOwes ? 'Lali' : 'Javi')} le debe a {(pd.laliOwes ? 'Javi' : 'Lali')}</div>
            <div style={{ fontSize:'2.1rem', fontWeight:800, color:C.navy, fontFamily:MONO, letterSpacing:'-0.02em', lineHeight:1.05, marginTop:'0.1rem' }}>{fmt(pd.netBal, primary)}</div>
          </>
        )}
      </div>

      {/* Action row: register + detail toggle */}
      {!pd.noDebt ? (
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          <button
            onClick={() => openPaymentModal(primary, pd.netBal, selPeriod === 'Todos' ? undefined : selPeriod)}
            style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem', background:C.accent, border:'none', borderRadius:'0.8rem', padding:'0.65rem', color:C.white, fontWeight:800, fontSize:'0.85rem', cursor:'pointer', fontFamily:F }}
          >
            <ArrowRightLeft size={16} strokeWidth={2.4} />Registrar pago
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ display:'flex', alignItems:'center', gap:'0.25rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.8rem', padding:'0.65rem 0.7rem', color:C.textMuted, fontWeight:600, fontSize:'0.75rem', cursor:'pointer', fontFamily:F }}
          >
            Detalle<ChevronDown size={14} strokeWidth={2.2} style={{ transform:expanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.25rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.8rem', padding:'0.55rem', color:C.textMuted, fontWeight:600, fontSize:'0.75rem', cursor:'pointer', fontFamily:F }}
        >
          Ver detalle<ChevronDown size={14} strokeWidth={2.2} style={{ transform:expanded ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }} />
        </button>
      )}

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
  const expenses          = useAppStore(s => s.expenses);
  const settings          = useAppStore(s => s.settings);
  const plans             = useAppStore(s => s.plans);
  const payments          = useAppStore(s => s.payments);
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

  // ── Sections defined once, reused in both layouts ────────────────────────────

  const headerBlock = (
    <UnifiedHeader periods={periods} selPeriod={selPeriod} setSelPeriod={setSelPeriod} periodExps={periodExps} payments={payments} />
  );

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

  // ── DESKTOP layout ─────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ padding:SP.lg, display:'flex', flexDirection:'column', gap:SP.lg }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:SP.lg, alignItems:'start' }}>
          <div>{headerBlock}</div>
          {weekSection}
        </div>
        <div>
          {plans.length > 0 ? (
            <ActivePlans />
          ) : (
            <Card style={{ padding:SP.xl, textAlign:'center', color:C.textMuted, fontSize:'0.82rem', display:'flex', alignItems:'center', justifyContent:'center', gap:SP.sm }}>
              <CreditCard size={20} strokeWidth={2} color={C.textMuted} />
              <span style={{ fontWeight:700 }}>Sin cuotas activas</span>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ── MOBILE — Esta semana ANTES de Cuotas activas ──────────────────────────
  return (
    <div style={{ padding:SP.lg, display:'flex', flexDirection:'column', gap:SP.lg }}>
      {headerBlock}
      {weekSection}
      <ActivePlans />
    </div>
  );
}
