import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PieChart, Pie, Cell
} from "recharts";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#F2F3F4', beige: '#DED1C6', accent: '#A77693', navy: '#174871', white: '#FFFFFF',
  gradMain: 'linear-gradient(135deg,#174871,#A77693)',
  gradJavi: 'linear-gradient(135deg,#174871,#1e5c9b)',
  gradLali: 'linear-gradient(135deg,#A77693,#c490a8)',
  textMuted: '#8a7a85', border: '#DED1C6',
};
const F = "'Nunito',sans-serif";
const PALETTE = ['#174871','#A77693','#4a9d8f','#d4875a','#7b5fa0','#c4965a','#5a8fa0','#a05a6e','#4a7a5a','#9a7040'];
const DEFAULT_CATS = ['🏠 Hogar','🍕 Alimentación','🔑 Arriendo','💡 Servicios Públicos','🚌 Transporte','🎬 Entretenimiento','👥 Amigos','💆 Cuidado Personal','💪 Gimnasio','💊 Farmacia','👶 Hijito','👕 Ropa'];
const PAY_METHODS  = ['Efectivo','TC Visa Laura','TC Master Card Laura','TC Visa Extensión','TC Master Card Extensión','Dinero en Cuenta','TC Visa Javi','TC Amex Javi','TC Amex Laura'];
const BANKS        = ['Banco Nación','Banco Provincia','Banco Ciudad','Banco Credicoop','Galicia','Macro','Supervielle','Patagonia','Comafi','Hipotecario','Naranja X','Santander','BBVA','HSBC','Itaú','ICBC','Mercado Pago','Ualá','Brubank','Lemon','Personal Pay','Otro'];
const BASE_CURS    = ['ARS','USD','EUR'];
const CUR_SYM      = { ARS: '$', USD: 'US$', EUR: '€' };
const CUOTA_OPTS   = [3, 6, 9, 12, 18, 24];
const CHART_TYPES  = ['Tabla','Barras','Radar','Torta'];
const PENDING_PER  = '⏳ Pendiente';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt    = (n, c = 'ARS') => `${CUR_SYM[c] || c + ' '}${Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtS   = (n, c = 'ARS') => { const a = Math.abs(n), s = CUR_SYM[c] || c; return a >= 1e6 ? `${s}${(a/1e6).toFixed(1)}M` : a >= 1e3 ? `${s}${(a/1e3).toFixed(0)}K` : `${s}${Math.round(a)}`; };
const todayStr   = () => new Date().toISOString().split('T')[0];
const safeN      = v => { const n = parseFloat(v); return isFinite(n) && !isNaN(n) ? n : 0; };
const catEm      = cat => { if (!cat) return '📦'; const m = cat.match(/^(\p{Emoji})/u); return m ? m[1] : '📦'; };
const catLb      = cat => cat ? cat.replace(/^\p{Emoji}\s*/u, '').trim() || cat : 'Otro';
const normCat    = (cat, cats) => {
  if (!cat || typeof cat !== 'string') return '📦 Otro';
  if (cats.find(c => c === cat.trim())) return cat.trim();
  const s = cat.replace(/^\p{Emoji}\s*/u, '').trim().toLowerCase();
  const m = cats.find(c => c.replace(/^\p{Emoji}\s*/u, '').trim().toLowerCase() === s);
  return m || cat.trim();
};
const calcAmts = (amt, resp) => {
  const n = safeN(amt);
  if (resp === 'Javi') return { javiAmount: n, laliAmount: 0 };
  if (resp === 'Lali') return { javiAmount: 0, laliAmount: n };
  return { javiAmount: n/2, laliAmount: n/2 };
};
const calcBal  = exps => exps.reduce((b, e) => e.paidBy === 'Javi' ? b + safeN(e.laliAmount) : b - safeN(e.javiAmount), 0);
const getPeriod = (d, ps) => {
  if (!ps || !ps.length) return 'Sin período';
  const dt = new Date(d + 'T12:00:00');
  for (const p of ps) {
    if (dt >= new Date(p.start + 'T00:00:00') && dt <= new Date(p.end + 'T23:59:59')) return p.name;
  }
  return 'Sin período';
};
const getWeekStart = () => {
  const d = new Date(), day = d.getDay(), diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff); d.setHours(0, 0, 0, 0); return d;
};
const sortByDate = exps => [...exps].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

// ── Plan helpers ──────────────────────────────────────────────────────────────
const generatePlanExpenses = (plan, periods) => {
  const startIdx = periods.findIndex(p => p.name === plan.startPeriod);
  return Array.from({ length: plan.numInstallments }, (_, i) => {
    const targetIdx = startIdx + i;
    const period = startIdx >= 0 && targetIdx < periods.length ? periods[targetIdx].name : PENDING_PER;
    return {
      id: `${plan.id}-${i+1}`,
      description: `${plan.description} (cuota ${i+1}/${plan.numInstallments})`,
      amount: plan.installmentAmount, javiAmount: plan.javiAmount, laliAmount: plan.laliAmount,
      currency: plan.currency, paidBy: plan.paidBy, responsible: plan.responsible,
      paymentMethod: plan.paymentMethod, bank: plan.bank, category: plan.category,
      date: plan.startDate, period, planId: plan.id, installmentNum: i + 1,
      numInstallments: plan.numInstallments, fromPlan: true,
    };
  });
};

const reassignPlanExpenses = (exps, periods, plans) =>
  exps.map(e => {
    if (!e.fromPlan) return e;
    const plan = plans.find(p => p.id === e.planId);
    if (!plan) return e;
    const startIdx = periods.findIndex(p => p.name === plan.startPeriod);
    const targetIdx = startIdx + (e.installmentNum - 1);
    const period = startIdx >= 0 && targetIdx < periods.length ? periods[targetIdx].name : PENDING_PER;
    return { ...e, period };
  });

// ── Storage ───────────────────────────────────────────────────────────────────
const store = {
  get: (k, fb = null) => { try { const v = localStorage.getItem(k); return v != null ? JSON.parse(v) : fb; } catch { return fb; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};

const sanitize = (e, cats) => ({
  ...e,
  description: String(e.description || ''),
  amount: safeN(e.amount), javiAmount: safeN(e.javiAmount), laliAmount: safeN(e.laliAmount),
  category: normCat(e.category, cats), currency: e.currency || 'ARS',
  date: typeof e.date === 'string' && e.date.match(/^\d{4}-\d{2}-\d{2}/) ? e.date.substring(0, 10) : (e.date || todayStr()),
  paidBy: e.paidBy === 'Javi' || e.paidBy === 'Edinson' ? 'Javi' : 'Lali',
  responsible: ['Javi','Lali','Ambos'].includes(e.responsible) ? e.responsible : 'Ambos',
});

// ── Font ──────────────────────────────────────────────────────────────────────
function useFont() {
  useEffect(() => {
    const l = document.createElement('link');
    l.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap';
    l.rel = 'stylesheet';
    document.head.appendChild(l);
    document.body.style.fontFamily = F;
    document.body.style.background = C.bg;
    return () => { document.body.style.fontFamily = ''; document.body.style.background = ''; };
  }, []);
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{ background: C.white, borderRadius: '1.1rem', padding: '1rem', boxShadow: '0 2px 8px rgba(23,72,113,0.08)', border: `1px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}

function ChartSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
      {CHART_TYPES.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{ padding: '0.25rem 0.65rem', fontSize: '0.7rem', borderRadius: '999px', border: '1px solid', cursor: 'pointer', fontFamily: F, fontWeight: value === t ? 800 : 500, background: value === t ? C.navy : 'transparent', borderColor: value === t ? C.navy : C.border, color: value === t ? C.white : C.navy }}>
          {t}
        </button>
      ))}
    </div>
  );
}

function SegBtn({ active, color = C.navy, onClick, children }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: '0.45rem 0.2rem', fontSize: '0.72rem', borderRadius: '0.75rem', border: '1px solid', cursor: 'pointer', fontFamily: F, fontWeight: active ? 800 : 500, lineHeight: 1.3, background: active ? color : 'transparent', borderColor: active ? color : C.border, color: active ? C.white : C.navy }}>
      {children}
    </button>
  );
}

function Label({ children }) {
  return <label style={{ fontSize: '0.8rem', color: C.textMuted, fontWeight: 700, display: 'block', marginBottom: '0.35rem', marginTop: '0.75rem' }}>{children}</label>;
}

function PeriodFilter({ periods, selected, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '0.6rem', scrollbarWidth: 'none' }}>
      {periods.map(p => (
        <button key={p} onClick={() => onSelect(p)} style={{ flexShrink: 0, padding: '0.35rem 0.75rem', borderRadius: '999px', border: '1px solid', fontSize: '0.75rem', cursor: 'pointer', fontWeight: selected === p ? 800 : 500, fontFamily: F, background: selected === p ? C.navy : 'transparent', borderColor: selected === p ? C.navy : C.border, color: selected === p ? C.white : C.navy, whiteSpace: 'nowrap' }}>
          {p}
        </button>
      ))}
    </div>
  );
}

// ── Chart components ──────────────────────────────────────────────────────────
function TablaCategoria({ data, cur }) {
  return (
    <div>
      {data.map((c, i) => (
        <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: '0.78rem', color: C.navy, fontWeight: 600 }}>{c.emoji} {c.label}</span>
          <span style={{ fontSize: '0.78rem', color: C.navy, fontWeight: 700 }}>{fmtS(c.value, cur)}</span>
          <span style={{ fontSize: '0.7rem', color: C.textMuted, width: '2.5rem', textAlign: 'right' }}>{c.pct}%</span>
        </div>
      ))}
    </div>
  );
}

function TablaPM({ data, cur }) {
  return (
    <div>
      {data.map((p, i) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: '0.78rem', color: C.navy, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.navy }}>{fmtS(p.value, cur)}</span>
          <span style={{ fontSize: '0.7rem', color: C.textMuted, width: '2.5rem', textAlign: 'right' }}>{p.pct}%</span>
        </div>
      ))}
    </div>
  );
}

function CategoryChart({ data, type, cur }) {
  if (!data.length) return null;
  if (type === 'Tabla') return <TablaCategoria data={data} cur={cur} />;
  if (type === 'Barras') {
    return (
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.beige} horizontal={false} />
          <XAxis type="number" tickFormatter={v => fmtS(v, cur)} tick={{ fontSize: 9, fontFamily: F, fill: C.textMuted }} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 9, fontFamily: F, fill: C.navy }} width={90} />
          <Tooltip formatter={v => fmtS(v, cur)} contentStyle={{ fontFamily: F, fontSize: '0.78rem', borderRadius: '0.6rem', border: `1px solid ${C.border}` }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (type === 'Radar') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={data.map(d => ({ subject: d.label, value: d.value }))}>
          <PolarGrid stroke={C.beige} />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fontFamily: F, fill: C.navy }} />
          <Radar dataKey="value" stroke={C.navy} fill={C.accent} fillOpacity={0.35} />
          <Tooltip formatter={v => fmtS(v, cur)} contentStyle={{ fontFamily: F, fontSize: '0.78rem', borderRadius: '0.6rem', border: `1px solid ${C.border}` }} />
        </RadarChart>
      </ResponsiveContainer>
    );
  }
  if (type === 'Torta') {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={({ pct }) => `${pct}%`} fontSize={9}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip formatter={v => fmtS(v, cur)} contentStyle={{ fontFamily: F, fontSize: '0.78rem', borderRadius: '0.6rem', border: `1px solid ${C.border}` }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  return null;
}

function PMChart({ data, type, cur }) {
  if (!data.length) return null;
  if (type === 'Tabla') return <TablaPM data={data} cur={cur} />;
  if (type === 'Barras') {
    return (
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.beige} horizontal={false} />
          <XAxis type="number" tickFormatter={v => fmtS(v, cur)} tick={{ fontSize: 9, fontFamily: F, fill: C.textMuted }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fontFamily: F, fill: C.navy }} width={95} />
          <Tooltip formatter={v => fmtS(v, cur)} contentStyle={{ fontFamily: F, fontSize: '0.78rem', borderRadius: '0.6rem', border: `1px solid ${C.border}` }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (type === 'Radar') {
    const radarData = data.map(d => ({ subject: d.name.split(' ').pop(), value: d.value }));
    return (
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={radarData}>
          <PolarGrid stroke={C.beige} />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fontFamily: F, fill: C.navy }} />
          <Radar dataKey="value" stroke={C.accent} fill={C.accent} fillOpacity={0.35} />
          <Tooltip formatter={v => fmtS(v, cur)} contentStyle={{ fontFamily: F, fontSize: '0.78rem', borderRadius: '0.6rem', border: `1px solid ${C.border}` }} />
        </RadarChart>
      </ResponsiveContainer>
    );
  }
  if (type === 'Torta') {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={({ pct }) => `${pct}%`} fontSize={9}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip formatter={v => fmtS(v, cur)} contentStyle={{ fontFamily: F, fontSize: '0.78rem', borderRadius: '0.6rem', border: `1px solid ${C.border}` }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  return null;
}

// ── UserSelect ────────────────────────────────────────────────────────────────
function UserSelect({ onSelect }) {
  useFont();
  return (
    <div style={{ minHeight: '100vh', background: C.gradMain, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '1.5rem', fontFamily: F }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>💑</div>
        <h1 style={{ fontSize: '1.9rem', fontWeight: 900, color: C.white, margin: 0, fontFamily: F }}>Gastos Compartidos</h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', marginTop: '0.5rem' }}>¿Quién sos?</p>
      </div>
      {['Javi', 'Lali'].map(u => (
        <button key={u} onClick={() => onSelect(u)} style={{ width: '100%', maxWidth: '280px', padding: '1.25rem', borderRadius: '1.25rem', color: u === 'Javi' ? C.white : C.navy, fontSize: '1.2rem', fontWeight: 900, border: 'none', cursor: 'pointer', fontFamily: F, background: u === 'Javi' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
          {u === 'Javi' ? '👨' : '👩'} {u}
        </button>
      ))}
    </div>
  );
}

// ── BalanceSection ────────────────────────────────────────────────────────────
function BalanceSection({ periodExps }) {
  const byCur = {};
  periodExps.forEach(e => { const c = e.currency || 'ARS'; if (!byCur[c]) byCur[c] = []; byCur[c].push(e); });
  const curs = Object.keys(byCur);
  if (!curs.length) {
    return (
      <div style={{ borderRadius: '1.25rem', padding: '1rem 1.5rem', background: C.gradMain, color: C.white, boxShadow: '0 4px 16px rgba(23,72,113,0.25)' }}>
        <p style={{ fontSize: '0.72rem', opacity: 0.8, margin: '0 0 0.15rem' }}>Balance período</p>
        <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>¡Sin gastos aún!</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {curs.map(c => {
        const bal = calcBal(byCur[c]), noDebt = Math.abs(bal) < 1, laliOwes = bal > 0;
        const bg = noDebt ? 'linear-gradient(135deg,#2d9e7f,#1db88c)' : C.gradMain;
        return (
          <div key={c} style={{ borderRadius: '1.25rem', padding: '1rem 1.5rem', background: bg, color: C.white, boxShadow: '0 4px 16px rgba(23,72,113,0.2)' }}>
            <p style={{ fontSize: '0.7rem', opacity: 0.8, margin: '0 0 0.1rem' }}>Balance {c} — período seleccionado</p>
            {noDebt
              ? <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>¡Al día! 🎉</div>
              : <><div style={{ fontSize: '1.7rem', fontWeight: 800 }}>{fmt(bal, c)}</div><div style={{ fontSize: '0.82rem', opacity: 0.9 }}>{laliOwes ? '👩 Lali' : '👨 Javi'} le debe a {laliOwes ? '👨 Javi' : '👩 Lali'}</div></>
            }
          </div>
        );
      })}
    </div>
  );
}

// ── ExpenseRow ────────────────────────────────────────────────────────────────
function ExpenseRow({ expense: e, onDelete, onEdit }) {
  const [open, setOpen] = useState(false);
  const cur = e.currency || 'ARS';
  return (
    <div style={{ borderBottom: `1px solid ${C.beige}` }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem', cursor: 'pointer', background: open ? C.bg : C.white }}>
        <div style={{ fontSize: '1.3rem', flexShrink: 0, width: '1.8rem', textAlign: 'center' }}>{catEm(e.category)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: C.navy, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{e.description || 'Sin descripción'}</span>
            {cur !== 'ARS' && <span style={{ fontSize: '0.58rem', background: C.navy, color: C.white, borderRadius: '999px', padding: '0.1rem 0.3rem', fontWeight: 800, flexShrink: 0 }}>{cur}</span>}
            {e.fromPlan && <span style={{ fontSize: '0.58rem', background: C.accent, color: C.white, borderRadius: '999px', padding: '0.1rem 0.3rem', fontWeight: 800, flexShrink: 0 }}>📅 {e.installmentNum}/{e.numInstallments}</span>}
            {e.period === PENDING_PER && <span style={{ fontSize: '0.58rem', background: '#f59e0b', color: C.white, borderRadius: '999px', padding: '0.1rem 0.3rem', fontWeight: 800, flexShrink: 0 }}>⏳</span>}
          </div>
          <div style={{ fontSize: '0.68rem', color: C.textMuted, marginTop: '0.05rem' }}>{e.date} · {catLb(e.category)} · <span style={{ color: e.paidBy === 'Javi' ? C.navy : C.accent, fontWeight: 700 }}>{e.paidBy}</span></div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 800, color: C.navy, fontSize: '0.9rem' }}>{fmt(safeN(e.amount), cur)}</div>
          <div style={{ fontSize: '0.62rem', color: C.textMuted }}>J:{fmt(safeN(e.javiAmount), cur)} / L:{fmt(safeN(e.laliAmount), cur)}</div>
        </div>
      </div>
      {open && !e.fromPlan && (
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.45rem 1rem', background: C.bg, borderTop: `1px solid ${C.border}` }}>
          <button onClick={() => onEdit(e)} style={{ flex: 1, padding: '0.35rem', background: C.beige, border: 'none', borderRadius: '0.6rem', color: C.navy, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: F }}>✏️ Editar</button>
          <button onClick={() => onDelete(e.id, e)} style={{ flex: 1, padding: '0.35rem', background: '#fde8ee', border: 'none', borderRadius: '0.6rem', color: '#c0314f', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: F }}>🗑️ Eliminar</button>
        </div>
      )}
    </div>
  );
}

// ── ActivePlans ───────────────────────────────────────────────────────────────
function ActivePlans({ plans, expenses, onCancelPlan }) {
  if (!plans.length) return null;
  return (
    <div>
      <h2 style={{ fontWeight: 800, color: C.navy, fontSize: '0.88rem', margin: '0 0 0.5rem' }}>💳 Cuotas activas</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {plans.map(plan => {
          const planExps = expenses.filter(e => e.planId === plan.id);
          const pending  = planExps.filter(e => e.period === PENDING_PER).length;
          const assigned = plan.numInstallments - pending;
          const pct = Math.round(assigned / plan.numInstallments * 100);
          return (
            <Card key={plan.id} style={{ padding: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: C.navy, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plan.description}</div>
                  <div style={{ fontSize: '0.7rem', color: C.textMuted, marginTop: '0.1rem' }}>{fmt(plan.installmentAmount, plan.currency)}/mes · Total: {fmt(plan.totalAmount, plan.currency)}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '0.5rem' }}>
                  <div style={{ fontWeight: 800, color: C.accent, fontSize: '0.82rem' }}>{assigned}/{plan.numInstallments}</div>
                  <div style={{ fontSize: '0.65rem', color: C.textMuted }}>cuotas</div>
                </div>
              </div>
              <div style={{ background: C.beige, borderRadius: '999px', height: '6px', overflow: 'hidden', marginBottom: '0.4rem' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: C.gradMain, borderRadius: '999px', transition: 'width 0.4s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {pending > 0
                  ? <div style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: 600 }}>⚠ {pending} cuota{pending > 1 ? 's' : ''} sin período</div>
                  : <div style={{ fontSize: '0.68rem', color: '#2d9e7f', fontWeight: 600 }}>✓ Todas asignadas</div>
                }
                <button onClick={() => onCancelPlan(plan.id)} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.65rem', color: C.textMuted, cursor: 'pointer', fontFamily: F }}>Cancelar</button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ expenses, settings, plans, onDelete, onEdit, onSync, onCancelPlan, syncing }) {
  const periods = settings.periods || [];
  const latestPeriod = periods.length ? periods[periods.length - 1].name : '';
  const [selPeriod, setSelPeriod] = useState(latestPeriod);
  useEffect(() => { if (latestPeriod && !selPeriod) setSelPeriod(latestPeriod); }, [latestPeriod]);

  const periodExps = selPeriod ? expenses.filter(e => e.period === selPeriod) : expenses;
  const totByCur = {};
  periodExps.forEach(e => { const c = e.currency || 'ARS'; totByCur[c] = (totByCur[c] || 0) + safeN(e.amount); });
  const curEntries = Object.entries(totByCur);
  const weekStart  = getWeekStart();
  const weekExps   = sortByDate(expenses.filter(e => e.date && new Date(e.date + 'T12:00:00') >= weekStart && e.period !== PENDING_PER));

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <BalanceSection periodExps={periodExps} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
        <Card style={{ padding: '0.75rem' }}>
          <div style={{ fontSize: '0.65rem', color: C.textMuted, marginBottom: '0.3rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Período</div>
          {periods.length > 0
            ? <select value={selPeriod} onChange={e => setSelPeriod(e.target.value)} style={{ width: '100%', border: 'none', fontSize: '0.78rem', fontWeight: 800, color: C.navy, background: 'transparent', outline: 'none', cursor: 'pointer', fontFamily: F, padding: 0 }}>
                {[...periods].reverse().map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            : <div style={{ fontWeight: 700, color: C.textMuted, fontSize: '0.78rem' }}>Sin períodos</div>
          }
          <div style={{ fontSize: '0.65rem', color: C.textMuted, marginTop: '0.2rem' }}>{periodExps.length} gastos</div>
        </Card>
        {curEntries.length <= 1
          ? <Card style={{ padding: '0.75rem' }}>
              <div style={{ fontSize: '0.65rem', color: C.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total {curEntries[0]?.[0] || 'ARS'}</div>
              <div style={{ fontWeight: 800, color: C.navy, marginTop: '0.2rem', fontSize: '0.95rem' }}>{curEntries[0] ? fmtS(curEntries[0][1], curEntries[0][0]) : '—'}</div>
            </Card>
          : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
              {curEntries.map(([c, v]) => (
                <Card key={c} style={{ padding: '0.5rem 0.6rem' }}>
                  <div style={{ fontSize: '0.6rem', color: C.textMuted, fontWeight: 700 }}>{c}</div>
                  <div style={{ fontWeight: 800, color: C.navy, fontSize: '0.82rem' }}>{fmtS(v, c)}</div>
                </Card>
              ))}
            </div>
        }
      </div>

      {settings.scriptUrl && (
        <button onClick={onSync} disabled={syncing} style={{ width: '100%', padding: '0.6rem', background: syncing ? C.beige : C.gradMain, border: 'none', borderRadius: '0.85rem', color: syncing ? C.textMuted : C.white, fontWeight: 700, fontSize: '0.82rem', cursor: syncing ? 'not-allowed' : 'pointer', fontFamily: F }}>
          {syncing ? '⟳ Sincronizando...' : '⚙️ Sincronizar configuración'}
        </button>
      )}

      <ActivePlans plans={plans} expenses={expenses} onCancelPlan={onCancelPlan} />

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h2 style={{ fontWeight: 800, color: C.navy, fontSize: '0.88rem', margin: 0 }}>📅 Esta semana</h2>
          <span style={{ fontSize: '0.68rem', color: C.textMuted }}>{weekExps.length} gastos</span>
        </div>
        {weekExps.length === 0
          ? <Card style={{ padding: '1.5rem', textAlign: 'center', color: C.textMuted, fontSize: '0.85rem' }}>No hay gastos esta semana</Card>
          : <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ maxHeight: 'calc(4 * 68px)', overflowY: 'auto' }}>
                {weekExps.map(e => <ExpenseRow key={e.id} expense={e} onDelete={onDelete} onEdit={onEdit} />)}
              </div>
              {weekExps.length > 4 && <div style={{ textAlign: 'center', padding: '0.4rem', fontSize: '0.7rem', color: C.textMuted, borderTop: `1px solid ${C.border}` }}>↕ Deslizá para ver más</div>}
            </Card>
        }
      </div>
    </div>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function Stats({ expenses, settings, allCats }) {
  const allPeriods = [...new Set([...(settings.periods?.map(p => p.name) || []), ...expenses.filter(e => e.period !== PENDING_PER).map(e => e.period).filter(Boolean)])];
  const allCurrencies = [...new Set(expenses.map(e => e.currency || 'ARS'))];
  const [period, setPeriod] = useState('Todos');
  const [cur, setCur] = useState('ARS');
  const [catChart, setCatChart] = useState('Tabla');
  const [pmChart, setPmChart] = useState('Tabla');

  const byPer   = period === 'Todos' ? expenses : expenses.filter(e => e.period === period);
  const filtered = byPer.filter(e => (e.currency || 'ARS') === cur && e.period !== PENDING_PER);

  if (!filtered.length) {
    return (
      <div style={{ padding: '1rem' }}>
        <h2 style={{ fontWeight: 900, fontSize: '1.2rem', color: C.navy, marginBottom: '0.75rem' }}>📊 Estadísticas</h2>
        <PeriodFilter periods={['Todos', ...allPeriods]} selected={period} onSelect={setPeriod} />
        {allCurrencies.length > 1 && <PeriodFilter periods={allCurrencies} selected={cur} onSelect={setCur} />}
        <Card style={{ textAlign: 'center', padding: '3rem', color: C.textMuted }}><div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📊</div>No hay datos para este período/moneda</Card>
      </div>
    );
  }

  const total     = filtered.reduce((s, e) => s + safeN(e.amount), 0);
  const javiTotal = filtered.reduce((s, e) => s + safeN(e.javiAmount), 0);
  const laliTotal = filtered.reduce((s, e) => s + safeN(e.laliAmount), 0);
  const bal       = calcBal(filtered);
  const javiPaid  = filtered.filter(e => e.paidBy === 'Javi').reduce((s, e) => s + safeN(e.amount), 0);
  const laliPaid  = filtered.filter(e => e.paidBy === 'Lali').reduce((s, e) => s + safeN(e.amount), 0);

  const byCat = {};
  filtered.forEach(e => { const k = catLb(normCat(e.category, allCats)); if (!byCat[k]) byCat[k] = { label: k, emoji: catEm(normCat(e.category, allCats)), value: 0 }; byCat[k].value += safeN(e.amount); });
  const catData = Object.values(byCat).sort((a, b) => b.value - a.value).map(c => ({ ...c, pct: total > 0 ? Math.round(c.value / total * 100) : 0 }));

  const byPM = {};
  filtered.forEach(e => { const k = e.paymentMethod || 'Otro'; byPM[k] = (byPM[k] || 0) + safeN(e.amount); });
  const pmData = Object.entries(byPM).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, pct: total > 0 ? Math.round(value / total * 100) : 0 }));

  const byP = {};
  filtered.forEach(e => { const k = e.period || 'Sin período'; if (!byP[k]) byP[k] = { period: k, javi: 0, lali: 0 }; byP[k].javi += safeN(e.javiAmount); byP[k].lali += safeN(e.laliAmount); });
  const perData = Object.values(byP);

  return (
    <div style={{ padding: '1rem', paddingBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h2 style={{ fontWeight: 900, fontSize: '1.2rem', color: C.navy, margin: 0 }}>📊 Estadísticas</h2>
      <PeriodFilter periods={['Todos', ...allPeriods]} selected={period} onSelect={setPeriod} />
      {allCurrencies.length > 1 && <PeriodFilter periods={allCurrencies} selected={cur} onSelect={setCur} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
        <Card style={{ padding: '0.75rem', background: C.gradMain }}>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL {cur}</div>
          <div style={{ fontWeight: 900, color: C.white, fontSize: '1.1rem', marginTop: '0.2rem' }}>{fmtS(total, cur)}</div>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)' }}>{filtered.length} gastos</div>
        </Card>
        <Card style={{ padding: '0.75rem', background: Math.abs(bal) < 1 ? 'linear-gradient(135deg,#2d9e7f,#1db88c)' : C.gradMain }}>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>BALANCE</div>
          {Math.abs(bal) < 1
            ? <div style={{ fontWeight: 900, color: C.white, fontSize: '1rem', marginTop: '0.2rem' }}>¡Al día! 🎉</div>
            : <><div style={{ fontWeight: 900, color: C.white, fontSize: '1.1rem', marginTop: '0.2rem' }}>{fmtS(bal, cur)}</div><div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.8)' }}>{bal > 0 ? 'Lali debe' : 'Javi debe'}</div></>
          }
        </Card>
      </div>

      <Card>
        <h3 style={{ fontWeight: 800, color: C.navy, margin: '0 0 0.75rem', fontSize: '0.9rem' }}>💳 ¿Quién pagó más?</h3>
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.6rem' }}>
          {[['Javi', C.gradJavi, javiPaid, '👨'], ['Lali', C.gradLali, laliPaid, '👩']].map(([n, bg, val, icon]) => (
            <div key={n} style={{ flex: 1, background: bg, borderRadius: '0.85rem', padding: '0.6rem', textAlign: 'center', color: C.white }}>
              <div style={{ fontSize: '1.2rem' }}>{icon}</div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{fmtS(val, cur)}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>{total > 0 ? Math.round(val / total * 100) : 0}%</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {[['Javi', C.navy, javiTotal, 'Resp. Javi'], ['Lali', C.accent, laliTotal, 'Resp. Lali']].map(([n, color, val, lbl]) => (
            <div key={n} style={{ flex: 1, background: C.bg, borderRadius: '0.75rem', padding: '0.5rem', textAlign: 'center', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: '0.65rem', color: C.textMuted }}>{lbl}</div>
              <div style={{ fontWeight: 800, color, fontSize: '0.85rem' }}>{fmtS(val, cur)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 style={{ fontWeight: 800, color: C.navy, margin: '0 0 0.5rem', fontSize: '0.9rem' }}>🗂 Gasto por categoría</h3>
        <ChartSelector value={catChart} onChange={setCatChart} />
        <CategoryChart data={catData} type={catChart} cur={cur} />
      </Card>

      <Card>
        <h3 style={{ fontWeight: 800, color: C.navy, margin: '0 0 0.5rem', fontSize: '0.9rem' }}>💳 Métodos de pago</h3>
        <ChartSelector value={pmChart} onChange={setPmChart} />
        <PMChart data={pmData} type={pmChart} cur={cur} />
      </Card>

      {period === 'Todos' && perData.length > 1 && (
        <Card>
          <h3 style={{ fontWeight: 800, color: C.navy, margin: '0 0 0.75rem', fontSize: '0.9rem' }}>📈 Evolución por período</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={perData} margin={{ top: 5, right: 5, bottom: 30, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.beige} />
              <XAxis dataKey="period" tick={{ fontSize: 9, angle: -35, textAnchor: 'end', fontFamily: F, fill: C.textMuted }} interval={0} />
              <YAxis tickFormatter={v => fmtS(v, cur)} tick={{ fontSize: 9, fontFamily: F, fill: C.textMuted }} width={45} />
              <Tooltip formatter={v => fmtS(v, cur)} contentStyle={{ fontFamily: F, fontSize: '0.78rem', borderRadius: '0.6rem', border: `1px solid ${C.border}` }} />
              <Bar dataKey="javi" name="Javi" fill={C.navy} stackId="a" />
              <Bar dataKey="lali" name="Lali" fill={C.accent} stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.5rem' }}>
            {[['Javi', C.navy], ['Lali', C.accent]].map(([n, col]) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: C.navy }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: col }} />{n}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── AddEditExpense ────────────────────────────────────────────────────────────
function AddEditExpense({ currentUser, settings, allCats, customCats, onSubmit, onSubmitPlan, onCancel, onSaveCats, initialData = null }) {
  const isEdit = !!initialData;
  const [form, setForm] = useState(initialData || { date: todayStr(), description: '', amount: '', category: allCats[0] || DEFAULT_CATS[0], paymentMethod: PAY_METHODS[0], bank: BANKS[0], paidBy: currentUser, responsible: 'Ambos', currency: 'ARS', customCurrency: '' });
  const [errors, setErrors] = useState({});
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatEmoji, setNewCatEmoji] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [useCuotas, setUseCuotas] = useState(false);
  const [numCuotas, setNumCuotas] = useState(12);
  const [customCuotas, setCustomCuotas] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const finalCuotas = customCuotas ? parseInt(customCuotas) || numCuotas : numCuotas;
  const cur = BASE_CURS.includes(form.currency) ? form.currency : (form.customCurrency || 'ARS');
  const { javiAmount, laliAmount } = calcAmts(form.amount, form.responsible);
  const showSplit = form.amount && parseFloat(form.amount) > 0;
  const installmentAmt = showSplit && useCuotas ? Math.round(parseFloat(form.amount) / finalCuotas) : 0;

  const addNewCat = () => {
    if (!newCatName.trim()) return;
    const cat = `${newCatEmoji || '📌'} ${newCatName.trim()}`;
    onSaveCats([...customCats, cat]);
    set('category', cat);
    setNewCatEmoji(''); setNewCatName(''); setShowNewCat(false);
  };

  const submit = () => {
    const e = {};
    if (!form.description.trim()) e.description = 'Requerido';
    if (!form.amount || parseFloat(form.amount) <= 0) e.amount = 'Monto inválido';
    if (Object.keys(e).length) { setErrors(e); return; }
    const finalCur = form.currency === 'Otra' ? (form.customCurrency || 'ARS') : form.currency;
    const base = { ...form, id: isEdit ? form.id : Date.now().toString(), amount: parseFloat(form.amount), javiAmount, laliAmount, currency: finalCur, period: getPeriod(form.date, settings.periods), ...(isEdit ? {} : { createdBy: currentUser, createdAt: new Date().toISOString() }) };
    if (!isEdit && useCuotas && finalCuotas > 1) { onSubmitPlan(base, finalCuotas); }
    else { onSubmit(base); }
  };

  const inpStyle = (extra = {}) => ({ width: '100%', border: `1px solid ${C.border}`, borderRadius: '0.75rem', padding: '0.75rem', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', fontFamily: F, color: C.navy, ...extra });
  const selStyle = { width: '100%', border: `1px solid ${C.border}`, borderRadius: '0.75rem', padding: '0.75rem', fontSize: '0.9rem', outline: 'none', background: C.white, boxSizing: 'border-box', fontFamily: F, color: C.navy };

  return (
    <div style={{ padding: '1rem', paddingBottom: '2rem' }}>
      <h2 style={{ fontWeight: 900, fontSize: '1.2rem', color: C.navy, marginBottom: '0.5rem' }}>{isEdit ? '✏️ Editar gasto' : 'Nuevo gasto'}</h2>

      <Label>Descripción</Label>
      <input style={inpStyle({ borderColor: errors.description ? '#c0314f' : C.border })} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ej: Almuerzo en Lo de Juan" />
      {errors.description && <p style={{ color: '#c0314f', fontSize: '0.7rem', margin: '0.15rem 0 0' }}>⚠ {errors.description}</p>}

      <Label>Monto total</Label>
      <input style={inpStyle({ borderColor: errors.amount ? '#c0314f' : C.border })} type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
      {errors.amount && <p style={{ color: '#c0314f', fontSize: '0.7rem', margin: '0.15rem 0 0' }}>⚠ {errors.amount}</p>}

      <Label>Moneda</Label>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {[...BASE_CURS, 'Otra'].map(c => (
          <button key={c} onClick={() => set('currency', c)} style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', borderRadius: '0.75rem', border: '1px solid', cursor: 'pointer', fontWeight: form.currency === c ? 800 : 500, fontFamily: F, background: form.currency === c ? C.navy : 'transparent', borderColor: form.currency === c ? C.navy : C.border, color: form.currency === c ? C.white : C.navy }}>{c}</button>
        ))}
      </div>
      {form.currency === 'Otra' && <input style={inpStyle({ marginTop: '0.4rem' })} value={form.customCurrency || ''} onChange={e => set('customCurrency', e.target.value.toUpperCase())} placeholder="Ej: BRL, GBP..." maxLength={5} />}

      <Label>Fecha</Label>
      <input style={inpStyle()} type="date" value={form.date} onChange={e => set('date', e.target.value)} />

      <Label>Categoría</Label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.4rem' }}>
        {allCats.map(c => (
          <button key={c} onClick={() => set('category', c)} style={{ padding: '0.4rem 0.2rem', fontSize: '0.7rem', borderRadius: '0.65rem', border: '1px solid', cursor: 'pointer', fontFamily: F, background: form.category === c ? C.accent : 'transparent', borderColor: form.category === c ? C.accent : C.border, color: form.category === c ? C.white : C.navy, textAlign: 'center', lineHeight: 1.3, fontWeight: form.category === c ? 700 : 400 }}>{c}</button>
        ))}
      </div>
      {!showNewCat
        ? <button onClick={() => setShowNewCat(true)} style={{ marginTop: '0.5rem', background: 'transparent', border: `1px dashed ${C.accent}`, borderRadius: '0.65rem', color: C.accent, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: '0.35rem 0.75rem', fontFamily: F, display: 'block' }}>➕ Nueva categoría</button>
        : <div style={{ marginTop: '0.5rem', background: C.bg, borderRadius: '0.75rem', padding: '0.6rem', display: 'flex', gap: '0.4rem', alignItems: 'center', border: `1px solid ${C.border}` }}>
            <input value={newCatEmoji} onChange={e => setNewCatEmoji(e.target.value)} placeholder="🏷️" style={{ width: '2.5rem', border: `1px solid ${C.border}`, borderRadius: '0.5rem', padding: '0.4rem', fontSize: '0.85rem', textAlign: 'center', outline: 'none', fontFamily: F }} />
            <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nombre..." style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: '0.5rem', padding: '0.4rem', fontSize: '0.82rem', outline: 'none', fontFamily: F, color: C.navy }} />
            <button onClick={addNewCat} style={{ background: C.accent, color: C.white, border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.6rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: F }}>OK</button>
            <button onClick={() => setShowNewCat(false)} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
          </div>
      }

      <Label>Medio de pago</Label>
      <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)} style={selStyle}>{PAY_METHODS.map(m => <option key={m}>{m}</option>)}</select>

      <Label>Banco / Billetera</Label>
      <select value={form.bank} onChange={e => set('bank', e.target.value)} style={selStyle}>{BANKS.map(b => <option key={b}>{b}</option>)}</select>

      {!isEdit && (
        <>
          <Label>¿Pago en cuotas?</Label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <SegBtn active={!useCuotas} color={C.navy} onClick={() => setUseCuotas(false)}>💵 Pago único</SegBtn>
            <SegBtn active={useCuotas} color={C.accent} onClick={() => setUseCuotas(true)}>📅 En cuotas</SegBtn>
          </div>
          {useCuotas && (
            <div style={{ background: C.bg, borderRadius: '1rem', padding: '0.85rem', marginTop: '0.5rem', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: '0.78rem', color: C.navy, fontWeight: 700, marginBottom: '0.5rem' }}>Cantidad de cuotas</div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {CUOTA_OPTS.map(n => (
                  <button key={n} onClick={() => { setNumCuotas(n); setCustomCuotas(''); }} style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', borderRadius: '0.65rem', border: '1px solid', cursor: 'pointer', fontFamily: F, fontWeight: numCuotas === n && !customCuotas ? 800 : 500, background: numCuotas === n && !customCuotas ? C.navy : 'transparent', borderColor: numCuotas === n && !customCuotas ? C.navy : C.border, color: numCuotas === n && !customCuotas ? C.white : C.navy }}>{n}</button>
                ))}
                <input type="number" value={customCuotas} onChange={e => setCustomCuotas(e.target.value)} placeholder="Otra" min={2} max={60} style={{ width: '4rem', border: `1px solid ${customCuotas ? C.navy : C.border}`, borderRadius: '0.65rem', padding: '0.35rem 0.5rem', fontSize: '0.78rem', outline: 'none', fontFamily: F, color: C.navy, background: customCuotas ? C.beige : 'transparent', textAlign: 'center' }} />
              </div>
              {showSplit && (
                <div style={{ background: C.white, borderRadius: '0.75rem', padding: '0.6rem', border: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: C.textMuted }}>Por cuota</div>
                    <div style={{ fontWeight: 900, color: C.navy, fontSize: '1.1rem' }}>{fmt(installmentAmt, cur)}</div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: C.textMuted, textAlign: 'right' }}>
                    <div>{finalCuotas} cuotas</div>
                    <div style={{ fontWeight: 700, color: C.navy }}>Total: {fmt(parseFloat(form.amount) || 0, cur)}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Label>¿Quién pagó?</Label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <SegBtn active={form.paidBy === 'Javi'} color={C.navy} onClick={() => set('paidBy', 'Javi')}>👨 Javi</SegBtn>
        <SegBtn active={form.paidBy === 'Lali'} color={C.accent} onClick={() => set('paidBy', 'Lali')}>👩 Lali</SegBtn>
      </div>

      <Label>¿Quién es responsable?</Label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <SegBtn active={form.responsible === 'Javi'} color={C.navy} onClick={() => set('responsible', 'Javi')}>👨 Javi</SegBtn>
        <SegBtn active={form.responsible === 'Ambos'} color={C.navy} onClick={() => set('responsible', 'Ambos')}>👫 Ambos</SegBtn>
        <SegBtn active={form.responsible === 'Lali'} color={C.accent} onClick={() => set('responsible', 'Lali')}>👩 Lali</SegBtn>
      </div>

      {showSplit && !useCuotas && (
        <div style={{ background: C.bg, borderRadius: '1rem', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', border: `1px solid ${C.border}` }}>
          <div style={{ textAlign: 'center', flex: 1 }}><div style={{ fontSize: '0.7rem', color: C.textMuted }}>👨 Javi</div><div style={{ fontWeight: 800, color: C.navy }}>{fmt(javiAmount, cur)}</div></div>
          <div style={{ width: '1px', background: C.border }} />
          <div style={{ textAlign: 'center', flex: 1 }}><div style={{ fontSize: '0.7rem', color: C.textMuted }}>👩 Lali</div><div style={{ fontWeight: 800, color: C.accent }}>{fmt(laliAmount, cur)}</div></div>
        </div>
      )}

      {settings.periods?.length > 0 && (
        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: C.textMuted, marginTop: '0.5rem' }}>
          Período: <strong style={{ color: C.navy }}>{getPeriod(form.date, settings.periods)}</strong>
        </div>
      )}

      <button onClick={submit} style={{ width: '100%', padding: '1rem', background: C.gradMain, color: C.white, border: 'none', borderRadius: '1rem', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', fontFamily: F, boxShadow: '0 4px 12px rgba(23,72,113,0.25)', marginTop: '1rem' }}>
        {isEdit ? 'Guardar cambios ✓' : useCuotas ? `Registrar ${finalCuotas} cuotas ✓` : 'Guardar gasto ✓'}
      </button>
      <button onClick={onCancel} style={{ width: '100%', padding: '0.75rem', background: 'none', border: 'none', color: C.textMuted, fontSize: '0.9rem', cursor: 'pointer', fontFamily: F, marginTop: '0.25rem' }}>Cancelar</button>
    </div>
  );
}

// ── History ───────────────────────────────────────────────────────────────────
function History({ expenses, settings, onDelete, onEdit }) {
  const [openPeriods, setOpenPeriods] = useState(new Set());
  const toggle = p => setOpenPeriods(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });

  const grouped = {};
  expenses.forEach(e => { const p = e.period || 'Sin período'; if (!grouped[p]) grouped[p] = []; grouped[p].push(e); });
  const configOrder = (settings.periods?.map(p => p.name) || []).slice().reverse();
  const others = Object.keys(grouped).filter(p => !configOrder.includes(p) && p !== PENDING_PER);
  const sortedPeriods = [...configOrder.filter(p => grouped[p]), ...others, ...(grouped[PENDING_PER] ? [PENDING_PER] : [])];

  return (
    <div style={{ padding: '1rem', paddingBottom: '2rem' }}>
      <h2 style={{ fontWeight: 900, fontSize: '1.2rem', color: C.navy, marginBottom: '1rem' }}>Historial</h2>
      {sortedPeriods.length === 0
        ? <Card style={{ textAlign: 'center', padding: '3rem', color: C.textMuted }}><div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>No hay gastos registrados</Card>
        : sortedPeriods.map(period => {
            const exps = sortByDate(grouped[period] || []);
            const total = exps.reduce((s, e) => s + safeN(e.amount), 0);
            const arsExps = exps.filter(e => (e.currency || 'ARS') === 'ARS');
            const bal = calcBal(arsExps);
            const isOpen = openPeriods.has(period);
            const isPending = period === PENDING_PER;
            return (
              <div key={period} style={{ marginBottom: '0.75rem' }}>
                <div onClick={() => toggle(period)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isPending ? '#fef3c7' : isOpen ? C.navy : C.white, borderRadius: isOpen ? '1rem 1rem 0 0' : '1rem', padding: '0.85rem 1rem', boxShadow: '0 2px 8px rgba(23,72,113,0.08)', cursor: 'pointer', border: `1px solid ${isPending ? '#f59e0b' : isOpen ? C.navy : C.border}` }}>
                  <div>
                    <div style={{ fontWeight: 800, color: isPending ? '#92400e' : isOpen ? C.white : C.navy, fontSize: '0.9rem' }}>{period}</div>
                    <div style={{ fontSize: '0.7rem', color: isPending ? '#b45309' : isOpen ? 'rgba(255,255,255,0.7)' : C.textMuted, marginTop: '0.1rem' }}>{exps.length} gastos · {fmt(total)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {!isPending && (Math.abs(bal) >= 1
                      ? <div style={{ textAlign: 'right' }}><div style={{ fontSize: '0.7rem', fontWeight: 800, color: isOpen ? 'rgba(255,255,255,0.9)' : C.accent }}>{bal > 0 ? 'Lali debe' : 'Javi debe'}</div><div style={{ fontSize: '0.7rem', fontWeight: 800, color: isOpen ? 'rgba(255,255,255,0.9)' : C.accent }}>{fmt(Math.abs(bal))}</div></div>
                      : <div style={{ fontSize: '0.7rem', color: isOpen ? 'rgba(255,255,255,0.8)' : '#2d9e7f', fontWeight: 700 }}>✓ Al día</div>
                    )}
                    <span style={{ color: isPending ? '#92400e' : isOpen ? 'rgba(255,255,255,0.8)' : C.textMuted, fontSize: '0.85rem' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ background: C.white, borderRadius: '0 0 1rem 1rem', boxShadow: '0 2px 8px rgba(23,72,113,0.08)', overflow: 'hidden', border: `1px solid ${C.border}`, borderTop: 'none' }}>
                    {exps.map(e => <ExpenseRow key={e.id} expense={e} onDelete={onDelete} onEdit={onEdit} />)}
                  </div>
                )}
              </div>
            );
          })
      }
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function Settings({ settings, onSave }) {
  const [scriptUrl, setScriptUrl] = useState(settings.scriptUrl || '');
  const [periods, setPeriods] = useState(settings.periods || []);
  const [np, setNp] = useState({ name: '', start: '', end: '' });
  const [periodError, setPeriodError] = useState('');
  const [saved, setSaved] = useState(false);

  const dateOverlaps = (start, end, existing) => {
    const s = new Date(start + 'T00:00:00'), e = new Date(end + 'T23:59:59');
    for (const p of existing) {
      const ps = new Date(p.start + 'T00:00:00'), pe = new Date(p.end + 'T23:59:59');
      if (s <= pe && e >= ps) return p.name;
    }
    return null;
  };

  const addPeriod = () => {
    if (!np.name || !np.start || !np.end) { setPeriodError('Completá todos los campos.'); return; }
    if (np.start > np.end) { setPeriodError('La fecha de inicio debe ser anterior a la de fin.'); return; }
    const conflict = dateOverlaps(np.start, np.end, periods);
    if (conflict) { setPeriodError(`Se superpone con "${conflict}".`); return; }
    setPeriodError(''); setPeriods(p => [...p, np]); setNp({ name: '', start: '', end: '' });
  };

  const save = () => { onSave({ ...settings, scriptUrl, periods }); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const inpStyle = { width: '100%', border: `1px solid ${C.border}`, borderRadius: '0.6rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box', fontFamily: F, color: C.navy, background: C.white };

  return (
    <div style={{ padding: '1rem', paddingBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h2 style={{ fontWeight: 900, fontSize: '1.2rem', color: C.navy, margin: 0 }}>Configuración</h2>
      <Card>
        <h3 style={{ fontWeight: 800, color: C.navy, margin: '0 0 0.5rem', fontSize: '0.95rem' }}>🔗 Google Sheets</h3>
        <p style={{ fontSize: '0.75rem', color: C.textMuted, margin: '0 0 0.6rem' }}>URL del Apps Script. Los gastos se envían automáticamente al guardar. La sincronización solo trae la configuración entre dispositivos.</p>
        <input style={inpStyle} value={scriptUrl} onChange={e => setScriptUrl(e.target.value)} placeholder="https://script.google.com/macros/s/..." />
      </Card>
      <Card>
        <h3 style={{ fontWeight: 800, color: C.navy, margin: '0 0 0.75rem', fontSize: '0.95rem' }}>📅 Períodos de cierre</h3>
        {periods.length === 0 && <p style={{ fontSize: '0.8rem', color: C.textMuted, marginBottom: '0.75rem' }}>No hay períodos configurados.</p>}
        {periods.map((p, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.bg, borderRadius: '0.6rem', padding: '0.5rem 0.75rem', marginBottom: '0.4rem', border: `1px solid ${C.border}` }}>
            <div><div style={{ fontWeight: 700, fontSize: '0.85rem', color: C.navy }}>{p.name}</div><div style={{ fontSize: '0.7rem', color: C.textMuted }}>{p.start} → {p.end}</div></div>
            <button onClick={() => setPeriods(ps => ps.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#c0314f', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '0.75rem', marginTop: '0.5rem' }}>
          <p style={{ fontSize: '0.75rem', color: C.textMuted, marginBottom: '0.4rem' }}>Agregar período:</p>
          <input style={{ ...inpStyle, marginBottom: '0.4rem' }} value={np.name} onChange={e => { setNp(p => ({ ...p, name: e.target.value })); setPeriodError(''); }} placeholder="Ej: Mar-Abr 2026" />
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <input type="date" style={{ ...inpStyle, flex: 1 }} value={np.start} onChange={e => { setNp(p => ({ ...p, start: e.target.value })); setPeriodError(''); }} />
            <input type="date" style={{ ...inpStyle, flex: 1 }} value={np.end} onChange={e => { setNp(p => ({ ...p, end: e.target.value })); setPeriodError(''); }} />
          </div>
          {periodError && <p style={{ color: '#c0314f', fontSize: '0.75rem', margin: '0 0 0.4rem', fontWeight: 600 }}>⚠ {periodError}</p>}
          <button onClick={addPeriod} style={{ width: '100%', padding: '0.5rem', background: C.navy, color: C.white, border: 'none', borderRadius: '0.6rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: F }}>+ Agregar período</button>
        </div>
      </Card>
      <button onClick={save} style={{ width: '100%', padding: '0.9rem', border: 'none', borderRadius: '1rem', fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer', fontFamily: F, background: saved ? 'linear-gradient(135deg,#2d9e7f,#1db88c)' : C.gradMain, color: C.white }}>
        {saved ? '✓ Guardado' : 'Guardar configuración'}
      </button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  useFont();
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState({ scriptUrl: '', periods: [] });
  const [customCats, setCustomCats] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [editingExpense, setEditingExpense] = useState(null);

  const allCats = [...DEFAULT_CATS, ...customCats];

  useEffect(() => {
    setCurrentUser(store.get('usr'));
    setExpenses(store.get('exp', []));
    setSettings(store.get('cfg', { scriptUrl: '', periods: [] }));
    setCustomCats(store.get('ccats', []));
    setPlans(store.get('plans', []));
    setLoading(false);
  }, []);

  const saveExpenses   = exps => { setExpenses(exps); store.set('exp', exps); };
  const savePlans      = p    => { setPlans(p); store.set('plans', p); };
  const saveCustomCats = cats => {
    setCustomCats(cats); store.set('ccats', cats);
    if (settings.scriptUrl) { try { fetch(settings.scriptUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'saveConfig', periods: settings.periods, customCats: cats }) }); } catch {} }
  };
  const selectUser = u => { setCurrentUser(u); store.set('usr', u); };
  const showMsg    = (msg, ms = 5000) => { setSyncMsg(msg); setTimeout(() => setSyncMsg(''), ms); };

  const saveSettings = s => {
    let updated = expenses.map(e => ({ ...e, period: !e.fromPlan && e.date ? getPeriod(e.date, s.periods) : (e.period || 'Sin período') }));
    if (s.periods && s.periods.length) updated = reassignPlanExpenses(updated, s.periods, plans);
    saveExpenses(updated);
    setSettings(s); store.set('cfg', s);
    if (s.scriptUrl) { try { fetch(s.scriptUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'saveConfig', periods: s.periods, customCats }) }); } catch {} }
  };

  const syncConfig = async () => {
    if (!settings.scriptUrl) { showMsg('Configurá la URL del Apps Script primero.'); return; }
    setSyncing(true);
    try {
      const res = await fetch(settings.scriptUrl, { redirect: 'follow' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const remoteConfig = Array.isArray(data) ? null : (data.config || null);
      if (remoteConfig) {
        if (remoteConfig.periods && remoteConfig.periods.length) { const ns = { ...settings, periods: remoteConfig.periods }; setSettings(ns); store.set('cfg', ns); }
        if (remoteConfig.customCats && remoteConfig.customCats.length) { setCustomCats(remoteConfig.customCats); store.set('ccats', remoteConfig.customCats); }
        showMsg('✓ Configuración sincronizada.');
      } else { showMsg('⚠ No se encontró configuración en el Sheet.'); }
    } catch { showMsg('⚠ No se pudo conectar. Verificá la URL.'); }
    setSyncing(false);
  };

  const handleAdd = async expense => {
    const s = sanitize({ ...expense, id: Date.now().toString() }, allCats);
    saveExpenses([s, ...expenses]);
    if (settings.scriptUrl) { setSyncing(true); try { await fetch(settings.scriptUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'add', ...s }) }); } catch {} setSyncing(false); }
    setView('dashboard');
  };

  const handleAddPlan = async (formData, numInstallments) => {
    const amt = safeN(formData.amount);
    const installmentAmount = Math.round(amt / numInstallments);
    const { javiAmount, laliAmount } = calcAmts(installmentAmount, formData.responsible);
    const startPeriod = getPeriod(formData.date, settings.periods);
    const plan = { id: 'plan_' + Date.now(), description: formData.description, totalAmount: amt, installmentAmount, numInstallments, startPeriod, startDate: formData.date, currency: formData.currency || 'ARS', paidBy: formData.paidBy, responsible: formData.responsible, paymentMethod: formData.paymentMethod, bank: formData.bank, category: formData.category, javiAmount, laliAmount, createdAt: new Date().toISOString() };
    const installments = generatePlanExpenses(plan, settings.periods);
    savePlans([...plans, plan]);
    saveExpenses([...installments, ...expenses]);
    if (settings.scriptUrl) { for (const inst of installments) { try { await fetch(settings.scriptUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'add', ...inst }) }); } catch {} } }
    setView('dashboard');
  };

  const handleEdit = async expense => {
    const s = sanitize(expense, allCats);
    saveExpenses(expenses.map(e => e.id === s.id ? s : e));
    if (settings.scriptUrl && expense.fromSheet) { setSyncing(true); try { await fetch(settings.scriptUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'edit', ...s }) }); } catch {} setSyncing(false); }
    setEditingExpense(null); setView('dashboard');
  };

  const handleDelete = async (id, expense) => {
    saveExpenses(expenses.filter(e => e.id !== id));
    if (settings.scriptUrl && expense && expense.fromSheet) { setSyncing(true); try { await fetch(settings.scriptUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: 'delete', id, period: expense.period }) }); } catch {} setSyncing(false); }
  };

  const handleCancelPlan = planId => {
    savePlans(plans.filter(p => p.id !== planId));
    saveExpenses(expenses.filter(e => e.planId !== planId));
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: C.textMuted, fontFamily: F, background: C.bg }}>Cargando...</div>;
  if (!currentUser) return <UserSelect onSelect={selectUser} />;

  if (editingExpense) return (
    <div style={{ minHeight: '100vh', background: C.bg, maxWidth: '480px', margin: '0 auto', fontFamily: F, overflowY: 'auto' }}>
      <AddEditExpense currentUser={currentUser} settings={settings} allCats={allCats} customCats={customCats} onSubmit={handleEdit} onSubmitPlan={handleAddPlan} onCancel={() => setEditingExpense(null)} onSaveCats={saveCustomCats} initialData={{ ...editingExpense, amount: String(editingExpense.amount) }} />
    </div>
  );

  const tabs = [{ id: 'dashboard', icon: '🏠', label: 'Inicio' }, { id: 'add', icon: '➕', label: 'Agregar' }, { id: 'stats', icon: '📊', label: 'Stats' }, { id: 'history', icon: '📋', label: 'Historial' }, { id: 'settings', icon: '⚙️', label: 'Config' }];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', maxWidth: '480px', margin: '0 auto', fontFamily: F }}>
      <div style={{ background: C.gradMain, padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 12px rgba(23,72,113,0.25)' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '1.9rem', color: C.white, lineHeight: 1.1 }}>💑 Javi & Lali</div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)' }}>Hola, <span style={{ fontWeight: 900, color: C.white }}>{currentUser}</span>{syncing && <span style={{ marginLeft: '0.5rem', opacity: 0.8 }}>⟳</span>}</div>
        </div>
        <button onClick={() => { setCurrentUser(null); store.del('usr'); }} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '0.6rem', padding: '0.35rem 0.7rem', fontSize: '0.75rem', color: C.white, cursor: 'pointer', fontFamily: F, fontWeight: 700 }}>Cambiar</button>
      </div>

      {syncMsg && (
        <div style={{ margin: '0.75rem 1rem 0', padding: '0.6rem 0.85rem', background: syncMsg.startsWith('✓') ? '#d4f5eb' : '#fdf0d5', borderRadius: '0.75rem', fontSize: '0.8rem', color: syncMsg.startsWith('✓') ? '#1a6e4f' : '#7a5c1a', fontWeight: 700, border: `1px solid ${syncMsg.startsWith('✓') ? '#a8e8cf' : '#f0d898'}` }}>
          {syncMsg}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '5rem', paddingTop: '0.75rem' }}>
        {view === 'dashboard' && <Dashboard expenses={expenses} settings={settings} plans={plans} onDelete={handleDelete} onEdit={e => setEditingExpense(e)} onSync={syncConfig} onCancelPlan={handleCancelPlan} syncing={syncing} />}
        {view === 'add' && <AddEditExpense currentUser={currentUser} settings={settings} allCats={allCats} customCats={customCats} onSubmit={handleAdd} onSubmitPlan={handleAddPlan} onCancel={() => setView('dashboard')} onSaveCats={saveCustomCats} />}
        {view === 'stats' && <Stats expenses={expenses} settings={settings} allCats={allCats} />}
        {view === 'history' && <History expenses={expenses} settings={settings} onDelete={handleDelete} onEdit={e => setEditingExpense(e)} />}
        {view === 'settings' && <Settings settings={settings} onSave={saveSettings} />}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: C.white, borderTop: `1px solid ${C.border}`, display: 'flex', boxShadow: '0 -2px 12px rgba(23,72,113,0.1)', zIndex: 10 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.5rem 0', border: 'none', background: 'none', cursor: 'pointer', fontFamily: F, color: view === t.id ? C.navy : C.textMuted, fontSize: '0.6rem', fontWeight: view === t.id ? 900 : 500, gap: '0.1rem' }}>
            <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
    </div>
  );
}