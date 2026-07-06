// ── components/Stats.tsx ──────────────────────────────────────────────────────
import React, { useState } from 'react';
import { BarChart3, TrendingUp, Trophy, CreditCard, Layers, Calendar } from 'lucide-react';
import { CatIcon } from './ui';
import { useIsDesktop } from '../lib/useIsDesktop';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, PieChart, Pie, Cell,
  AreaChart, Area,
} from 'recharts';
import { C, F, PALETTE, PENDING_PER, DEFAULT_CATS , MONO, SP, FS } from '../constants';
import { fmtS, fmt, safeN, catEm, catLb, normCat, pctChange, sortByDate, expenseResolved } from '../lib/helpers';
import useAppStore from '../store/useAppStore';
import { useExpenses, useSettings, useCustomCats } from '../lib/queries';
import { Card, ScrollFilter, ChartSelector } from './ui';
import type { Expense, Currency } from '../types';

const PERSONALIZADO = 'Personalizado';

// ── Types ──────────────────────────────────────────────────────────────────────
interface CatRow  { label: string; emoji: string; value: number; pct: number; }
interface PMRow   { name: string; value: number; pct: number; }
interface PerRow  { period: string; javi: number; lali: number; [key: string]: number | string; }

// ── Small chart helpers ────────────────────────────────────────────────────────
function TablaCategoria({ data, cur }: { data: CatRow[]; cur: Currency }) {
  return (
    <div>
      {data.map((c, i) => (
        <div key={c.label} style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem' }}>
          <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:PALETTE[i % PALETTE.length], flexShrink:0 }} />
          <span style={{ flex:1, fontSize:'0.78rem', color:C.navy, fontWeight:600, display:'flex', alignItems:'center', gap:'0.35rem' }}><CatIcon category={c.label} size={14} color={C.navy} />{c.label}</span>
          <span style={{ fontSize:'0.78rem', color:C.navy, fontWeight:700 }}>{fmtS(c.value, cur)}</span>
          <span style={{ fontSize:'0.7rem', color:C.textMuted, width:'2.5rem', textAlign:'right' }}>{c.pct}%</span>
        </div>
      ))}
    </div>
  );
}

function TablaPM({ data, cur }: { data: PMRow[]; cur: Currency }) {
  return (
    <div>
      {data.map((p, i) => (
        <div key={p.name} style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.45rem' }}>
          <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:PALETTE[i % PALETTE.length], flexShrink:0 }} />
          <span style={{ flex:1, fontSize:'0.78rem', color:C.navy, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</span>
          <span style={{ fontSize:'0.78rem', fontWeight:700, color:C.navy }}>{fmtS(p.value, cur)}</span>
          <span style={{ fontSize:'0.7rem', color:C.textMuted, width:'2.5rem', textAlign:'right' }}>{p.pct}%</span>
        </div>
      ))}
    </div>
  );
}

function CategoryChart({ data, type, cur }: { data: CatRow[]; type: string; cur: Currency }) {
  if (!data.length) return null;
  const tt = { formatter: (v: number) => fmtS(v, cur), contentStyle: { fontFamily:F, fontSize:'0.78rem', borderRadius:'0.6rem', border:'1px solid '+C.border, background:C.surface } };
  if (type === 'Tabla') return <TablaCategoria data={data} cur={cur} />;
  if (type === 'Barras') return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ top:0, right:40, bottom:0, left:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.beige} horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => fmtS(v, cur)} tick={{ fontSize:9, fontFamily:F, fill:C.textMuted }} />
        <YAxis type="category" dataKey="label" tick={{ fontSize:9, fontFamily:F, fill:C.navy }} width={90} />
        <Tooltip {...tt} />
        <Bar dataKey="value" radius={[0,4,4,0]}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
  if (type === 'Radar') return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={data.map(d => ({ subject: d.label, value: d.value }))} outerRadius="68%">
        <PolarGrid stroke={C.beige} />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize:8, fontFamily:F, fill:C.navy }} />
        <PolarRadiusAxis tick={false} axisLine={false} />
        <Radar dataKey="value" stroke={C.navy} strokeWidth={2} fill={C.accent} fillOpacity={0.45} dot={{ fill:C.navy, r:3 }} isAnimationActive={false} />
        <Tooltip {...tt} />
      </RadarChart>
    </ResponsiveContainer>
  );
  if (type === 'Torta') return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={46} outerRadius={80} paddingAngle={1} label={(p) => p.pct + '%'} fontSize={9}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip {...tt} />
      </PieChart>
    </ResponsiveContainer>
  );
  return null;
}

function PMChart({ data, type, cur }: { data: PMRow[]; type: string; cur: Currency }) {
  if (!data.length) return null;
  const tt = { formatter: (v: number) => fmtS(v, cur), contentStyle: { fontFamily:F, fontSize:'0.78rem', borderRadius:'0.6rem', border:'1px solid '+C.border, background:C.surface } };
  if (type === 'Tabla') return <TablaPM data={data} cur={cur} />;
  if (type === 'Barras') return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ top:0, right:40, bottom:0, left:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.beige} horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => fmtS(v, cur)} tick={{ fontSize:9, fontFamily:F, fill:C.textMuted }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize:8, fontFamily:F, fill:C.navy }} width={95} />
        <Tooltip {...tt} />
        <Bar dataKey="value" radius={[0,4,4,0]}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
  if (type === 'Radar') {
    const rd = data.map(d => ({ subject: d.name, value: d.value }));
    return (
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={rd} outerRadius="68%">
          <PolarGrid stroke={C.beige} />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize:8, fontFamily:F, fill:C.navy }} />
          <PolarRadiusAxis tick={false} axisLine={false} />
          <Radar dataKey="value" stroke={C.navy} strokeWidth={2} fill={C.accent} fillOpacity={0.45} dot={{ fill:C.navy, r:3 }} isAnimationActive={false} />
          <Tooltip {...tt} />
        </RadarChart>
      </ResponsiveContainer>
    );
  }
  if (type === 'Torta') return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={46} outerRadius={80} paddingAngle={1} label={(p) => p.pct + '%'} fontSize={9}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip {...tt} />
      </PieChart>
    </ResponsiveContainer>
  );
  return null;
}

// ── Projected spending card ────────────────────────────────────────────────────
function ProyeccionCard({ filtered, period, cur, configPeriods }: {
  filtered: Expense[]; period: string; cur: Currency;
  configPeriods: Array<{ name: string; start: string; end: string }>;
}) {
  if (period === 'Todos' || !filtered.length) return null;
  const periodCfg = configPeriods.find(p => p.name === period);
  if (!periodCfg) return null;

  const start  = new Date(periodCfg.start + 'T00:00:00');
  const end    = new Date(periodCfg.end   + 'T23:59:59');
  const today  = new Date();

  // Only show projection for current/ongoing periods
  if (today > end) return null;

  const totalDays   = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  const elapsed     = Math.max(1, Math.round((today.getTime() - start.getTime()) / 86400000));
  const pctElapsed  = Math.min(100, Math.round(elapsed / totalDays * 100));
  const total       = filtered.reduce((s, e) => s + safeN(e.amount), 0);
  const dailyAvg    = total / elapsed;
  const projected   = Math.round(dailyAvg * totalDays);
  const remaining   = totalDays - elapsed;

  return (
    <Card>
      <h3 style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:800, color:C.navy, margin:'0 0 0.75rem', fontSize:'0.9rem' }}>
        <TrendingUp size={15} strokeWidth={2.2} color={C.accent} />Proyección al cierre
      </h3>
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.75rem' }}>
        <div style={{ flex:1, background:C.bg, borderRadius:'0.75rem', padding:'0.6rem', border:'1px solid '+C.border }}>
          <div style={{ fontSize:'0.63rem', color:C.textMuted, marginBottom:'0.2rem' }}>Gastado hasta hoy</div>
          <div style={{ fontWeight:800, color:C.navy, fontSize:'0.95rem' }}>{fmtS(total, cur)}</div>
          <div style={{ fontSize:'0.65rem', color:C.textMuted }}>{elapsed}d de {totalDays}d ({pctElapsed}%)</div>
        </div>
        <div style={{ flex:1, background:C.gradMain, borderRadius:'0.75rem', padding:'0.6rem' }}>
          <div style={{ fontSize:'0.63rem', color:'rgba(255,255,255,0.75)', marginBottom:'0.2rem' }}>Proyección total</div>
          <div style={{ fontWeight:800, color:C.white, fontSize:'0.95rem' }}>{fmtS(projected, cur)}</div>
          <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.7)' }}>{fmtS(dailyAvg, cur)}/día · {remaining}d restantes</div>
        </div>
      </div>
      {/* Progress bar */}
      <div style={{ background:C.beige, borderRadius:'999px', height:'8px', overflow:'hidden', position:'relative' }}>
        <div style={{ width: pctElapsed + '%', height:'100%', background:C.gradMain, borderRadius:'999px', transition:'width 0.4s' }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.65rem', color:C.textMuted, marginTop:'0.3rem' }}>
        <span>{periodCfg.start}</span>
        <span>{periodCfg.end}</span>
      </div>
    </Card>
  );
}

// ── Category comparison vs previous period ─────────────────────────────────────
function CatComparacion({ filtered, prevExps, allCatsFull, cur }: {
  filtered: Expense[]; prevExps: Expense[]; allCatsFull: string[]; cur: Currency;
}) {
  if (!prevExps.length) return null;

  // Build category totals for current and previous period
  const curr: Record<string, number> = {};
  filtered.forEach(e => {
    const k = catLb(normCat(e.category, allCatsFull));
    curr[k] = (curr[k] || 0) + safeN(e.amount);
  });
  const prev: Record<string, number> = {};
  prevExps.forEach(e => {
    const k = catLb(normCat(e.category, allCatsFull));
    prev[k] = (prev[k] || 0) + safeN(e.amount);
  });

  const allKeys = Array.from(new Set([...Object.keys(curr), ...Object.keys(prev)]));
  const rows = allKeys
    .map(k => {
      const c = curr[k] || 0;
      const p = prev[k] || 0;
      const pct = pctChange(c, p);
      return { label: k, cur: c, prev: p, pct };
    })
    .filter(r => r.cur > 0 || r.prev > 0)
    .sort((a, b) => b.cur - a.cur);

  return (
    <Card>
      <h3 style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:800, color:C.navy, margin:'0 0 0.75rem', fontSize:'0.9rem' }}>
        <BarChart3 size={15} strokeWidth={2.2} color={C.accent} />Categorías vs período anterior
      </h3>
      {rows.map(r => {
        const up   = r.pct !== null && r.pct > 0;
        const down = r.pct !== null && r.pct < 0;
        const arrow = up ? '▲' : down ? '▼' : '–';
        const arrowColor = up ? C.danger : down ? C.ok : C.textMuted;
        return (
          <div key={r.label} style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem', padding:'0.45rem 0.6rem', background:C.bg, borderRadius:'0.65rem', border:'1px solid '+C.border }}>
            <span style={{ flex:1, fontSize:'0.78rem', color:C.navy, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.label}</span>
            <span style={{ fontSize:'0.78rem', color:C.navy, fontWeight:700, flexShrink:0 }}>{fmtS(r.cur, cur)}</span>
            {r.pct !== null ? (
              <span style={{ fontSize:'0.72rem', fontWeight:800, color:arrowColor, flexShrink:0, minWidth:'3.5rem', textAlign:'right' }}>
                {arrow} {Math.abs(r.pct)}%
              </span>
            ) : (
              <span style={{ fontSize:'0.7rem', color:C.textMuted, flexShrink:0, minWidth:'3.5rem', textAlign:'right' }}>nuevo</span>
            )}
          </div>
        );
      })}
      <div style={{ fontSize:'0.68rem', color:C.textMuted, marginTop:'0.25rem', textAlign:'center' }}>
        ▲ subió · ▼ bajó vs período anterior
      </div>
    </Card>
  );
}

// ── Stacked area chart by category over time ───────────────────────────────────
function EvolucionArea({ allExpenses, allCatsFull, configPeriods, cur }: {
  allExpenses: Expense[]; allCatsFull: string[];
  configPeriods: Array<{ name: string }>; cur: Currency;
}) {
  if (configPeriods.length < 2) return null;

  // Top 5 categories across all periods
  const totals: Record<string, number> = {};
  allExpenses
    .filter(e => (e.currency || 'ARS') === cur && e.period !== PENDING_PER)
    .forEach(e => {
      const k = catLb(normCat(e.category, allCatsFull));
      totals[k] = (totals[k] || 0) + safeN(e.amount);
    });
  const top5 = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
  if (!top5.length) return null;

  // Build data: one row per period
  const data = configPeriods.map(p => {
    const row: Record<string, string | number> = { period: p.name };
    const periodExps = allExpenses.filter(e => e.period === p.name && (e.currency || 'ARS') === cur);
    top5.forEach(cat => {
      row[cat] = periodExps
        .filter(e => catLb(normCat(e.category, allCatsFull)) === cat)
        .reduce((s, e) => s + safeN(e.amount), 0);
    });
    return row;
  });

  const tt = {
    formatter: (v: number) => fmtS(v, cur),
    contentStyle: { fontFamily:F, fontSize:'0.75rem', borderRadius:'0.6rem', border:'1px solid '+C.border, background:C.surface },
  };

  return (
    <Card>
      <h3 style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:800, color:C.navy, margin:'0 0 0.75rem', fontSize:'0.9rem' }}>
        <TrendingUp size={15} strokeWidth={2.2} color={C.accent} />Evolución por categoría
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top:5, right:5, bottom:25, left:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.beige} />
          <XAxis dataKey="period" tick={{ fontSize:8, angle:-30, textAnchor:'end', fontFamily:F, fill:C.textMuted } as never} interval={0} />
          <YAxis tickFormatter={(v) => fmtS(v, cur)} tick={{ fontSize:8, fontFamily:F, fill:C.textMuted }} width={42} />
          <Tooltip {...tt} />
          {top5.map((cat, i) => (
            <Area
              key={cat}
              type="monotone"
              dataKey={cat}
              stackId="1"
              stroke={PALETTE[i % PALETTE.length]}
              fill={PALETTE[i % PALETTE.length]}
              fillOpacity={0.7}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem', marginTop:'0.5rem' }}>
        {top5.map((cat, i) => (
          <div key={cat} style={{ display:'flex', alignItems:'center', gap:'0.25rem', fontSize:'0.68rem', color:C.navy }}>
            <div style={{ width:'8px', height:'8px', borderRadius:'2px', background:PALETTE[i % PALETTE.length], flexShrink:0 }} />
            {cat}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Top expenses ranking ───────────────────────────────────────────────────────
function TopGastos({ filtered, cur }: { filtered: Expense[]; cur: Currency }) {
  if (!filtered.length) return null;
  const top = sortByDate([...filtered])
    .sort((a, b) => safeN(b.amount) - safeN(a.amount))
    .slice(0, 5);
  const maxAmt = safeN(top[0]?.amount || 1);

  return (
    <Card>
      <h3 style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:800, color:C.navy, margin:'0 0 0.75rem', fontSize:'0.9rem' }}>
        <Trophy size={15} strokeWidth={2.2} color={C.accent} />Top 5 gastos del período
      </h3>
      {top.map((e, i) => {
        const amt = safeN(e.amount);
        const barW = Math.round(amt / maxAmt * 100);
        return (
          <div key={e.id} style={{ marginBottom:'0.6rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.2rem' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', minWidth:0 }}>
                <span style={{ fontSize:'0.7rem', fontWeight:800, color:C.textMuted, flexShrink:0, width:'1rem' }}>#{i+1}</span>
                <span style={{ display:'flex', alignItems:'center', gap:'0.35rem', fontSize:'0.8rem', color:C.navy, fontWeight:700, overflow:'hidden', minWidth:0 }}>
                  <CatIcon category={e.category} size={14} color={C.navy} style={{ flexShrink:0 }} /><span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.description}</span>
                </span>
              </div>
              <span style={{ fontSize:'0.8rem', fontWeight:800, color:C.navy, flexShrink:0, marginLeft:'0.5rem' }}>
                {fmt(amt, cur)}
              </span>
            </div>
            <div style={{ background:C.beige, borderRadius:'999px', height:'5px', overflow:'hidden' }}>
              <div style={{ width: barW + '%', height:'100%', background:i === 0 ? C.gradMain : PALETTE[i % PALETTE.length], borderRadius:'999px' }} />
            </div>
            <div style={{ fontSize:'0.63rem', color:C.textMuted, marginTop:'0.15rem' }}>
              {e.date} · {catLb(e.category)} · {e.paidBy}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// ── Main Stats component ───────────────────────────────────────────────────────
// Las burbujas de Total / Nº gastos / Balance / Último pago / ¿Quién pagó más?
// viven ahora en la pestaña Inicio. Stats se queda solo con lo analítico.
export default function Stats() {
  const isDesktop  = useIsDesktop();
  const expenses   = useExpenses();
  const settings   = useSettings();
  const customCats = useCustomCats();

  const allCatsFull = [...DEFAULT_CATS, ...(customCats || [])];
  const configPeriods = settings.periods || [];

  const allPeriodNames = [...new Set([
    ...configPeriods.map(p => p.name),
    ...expenses.filter(e => e.period && e.period !== PENDING_PER).map(e => e.period),
  ])];

  const allCurrencies = [...new Set(expenses.map(e => e.currency || 'ARS'))];

  const [period, setPeriod] = useState('Todos');
  const [cur, setCur]       = useState<Currency>('ARS');
  const [catChart, setCatChart] = useState('Torta');
  const [pmChart, setPmChart]   = useState('Tabla');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');

  const byPer = period === PERSONALIZADO
    ? expenses.filter(e => e.date && (!customFrom || e.date >= customFrom) && (!customTo || e.date <= customTo))
    : period === 'Todos' ? expenses : expenses.filter(e => e.period === period);
  const filtered = byPer.filter(e => (e.currency || 'ARS') === cur && e.period !== PENDING_PER);

  // Gastos del período anterior (para "Categorías vs período anterior")
  let prevExps: Expense[] = [];
  if (period !== 'Todos') {
    const idx = configPeriods.findIndex(p => p.name === period);
    if (idx > 0) {
      const prevName = configPeriods[idx - 1].name;
      prevExps = expenses.filter(e => e.period === prevName && (e.currency || 'ARS') === cur && e.period !== PENDING_PER);
    }
  }

  const inp: React.CSSProperties = {
    width:'100%', border:'1px solid '+C.border, borderRadius:'0.6rem',
    padding:'0.5rem 0.75rem', fontSize:'0.85rem', outline:'none',
    boxSizing:'border-box', fontFamily:F, color:C.navy, background:C.surface,
  };

  function setThisMonth() {
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth();
    const pad = (n: number) => String(n).padStart(2, '0');
    const lastDay = new Date(y, m + 1, 0).getDate();
    setCustomFrom(y + '-' + pad(m + 1) + '-01');
    setCustomTo(y + '-' + pad(m + 1) + '-' + pad(lastDay));
  }

  const filters = (
    <>
      <ScrollFilter items={['Todos', ...allPeriodNames, PERSONALIZADO]} selected={period} onSelect={setPeriod} />
      {allCurrencies.length > 1 && <ScrollFilter items={allCurrencies} selected={cur} onSelect={(c: string) => setCur(c as Currency)} />}
      {period === PERSONALIZADO && (
        <Card style={{ marginBottom:'0.6rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:800, color:C.navy, fontSize:'0.85rem', marginBottom:'0.5rem' }}>
            <Calendar size={15} strokeWidth={2.2} color={C.accent} />Rango personalizado
          </div>
          <div style={{ display:'flex', gap:'0.4rem', marginBottom:'0.5rem' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'0.72rem', color:C.textMuted, marginBottom:'0.2rem', fontWeight:700 }}>Desde</div>
              <input type="date" style={{ ...inp, minWidth:0 }} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'0.72rem', color:C.textMuted, marginBottom:'0.2rem', fontWeight:700 }}>Hasta</div>
              <input type="date" style={{ ...inp, minWidth:0 }} value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
          <button
            onClick={setThisMonth}
            style={{ width:'100%', padding:'0.5rem', background:'transparent', color:C.navy, border:'1px solid '+C.border, borderRadius:'0.65rem', fontWeight:700, fontSize:'0.78rem', cursor:'pointer', fontFamily:F }}
          >
            Este mes
          </button>
        </Card>
      )}
    </>
  );

  if (!filtered.length) return (
    <div style={{ padding:SP.lg, paddingBottom:SP.xxl }}>
      <h2 style={{ display:'flex', alignItems:'center', gap:'0.45rem', fontWeight:900, fontSize:FS.title, color:C.navy, marginBottom:SP.md }}><BarChart3 size={20} strokeWidth={2.3} color={C.accent} />Estadísticas</h2>
      {filters}
      <Card style={{ textAlign:'center', padding:'3rem', color:C.textMuted }}>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:'0.5rem' }}><BarChart3 size={36} strokeWidth={1.6} color={C.textMuted} /></div>
        No hay datos para este período/moneda
      </Card>
    </div>
  );

  const total = filtered.reduce((s, e) => s + safeN(e.amount), 0);

  // Category data
  const byCat: Record<string, CatRow> = {};
  filtered.forEach(e => {
    const k = catLb(normCat(e.category, allCatsFull));
    if (!byCat[k]) byCat[k] = { label:k, emoji:catEm(normCat(e.category, allCatsFull)), value:0, pct:0 };
    byCat[k].value += safeN(e.amount);
  });
  const catData: CatRow[] = Object.values(byCat)
    .sort((a, b) => b.value - a.value)
    .map(c => ({ ...c, pct: total > 0 ? Math.round(c.value / total * 100) : 0 }));

  // Payment method data
  const byPM: Record<string, number> = {};
  filtered.forEach(e => { const k = e.paymentMethod || 'Otro'; byPM[k] = (byPM[k] || 0) + safeN(e.amount); });
  const pmData: PMRow[] = Object.entries(byPM)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, pct: total > 0 ? Math.round(value / total * 100) : 0 }));

  // Period evolution (for stacked bar, "Todos" view)
  const byP: Record<string, PerRow> = {};
  filtered.forEach(e => {
    const k = e.period || 'Sin período';
    if (!byP[k]) byP[k] = { period:k, javi:0, lali:0 };
    const r = expenseResolved(e);
    byP[k].javi += safeN(r['Javi']);
    byP[k].lali += safeN(r['Lali']);
  });
  const perData = Object.values(byP);

  const tt = { formatter: (v: number) => fmtS(v, cur), contentStyle: { fontFamily:F, fontSize:'0.78rem', borderRadius:'0.6rem', border:'1px solid '+C.border, background:C.surface } };

  // ── Bloques reutilizables ───────────────────────────────────────────────────
  // marginBottom para separar tarjetas apiladas dentro de una columna (escritorio)
  // y entre sí (móvil). Se evita partir tarjetas en saltos de columna.
  const WrapAvoid = ({ children }: { children: React.ReactNode }) => (
    <div style={{ breakInside:'avoid' as any, marginBottom:SP.lg }}>{children}</div>
  );

  const catCard = (
    <WrapAvoid>
      <Card>
        <h3 style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:800, color:C.navy, margin:'0 0 0.5rem', fontSize:'0.9rem' }}><Layers size={15} strokeWidth={2.2} color={C.accent} />Gasto por categoría</h3>
        <ChartSelector value={catChart} onChange={setCatChart} />
        <div style={{ height:280, overflowY:'auto' }}>
          <CategoryChart data={catData} type={catChart} cur={cur} />
        </div>
      </Card>
    </WrapAvoid>
  );

  const pmCard = (
    <WrapAvoid>
      <Card>
        <h3 style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:800, color:C.navy, margin:'0 0 0.5rem', fontSize:'0.9rem' }}><CreditCard size={15} strokeWidth={2.2} color={C.accent} />Métodos de pago</h3>
        <ChartSelector value={pmChart} onChange={setPmChart} />
        <div style={{ height:280, overflowY:'auto' }}>
          <PMChart data={pmData} type={pmChart} cur={cur} />
        </div>
      </Card>
    </WrapAvoid>
  );

  const topGastosNode      = <WrapAvoid><TopGastos filtered={filtered} cur={cur} /></WrapAvoid>;
  const proyeccionNode     = <WrapAvoid><ProyeccionCard filtered={filtered} period={period} cur={cur} configPeriods={configPeriods} /></WrapAvoid>;
  const catComparacionNode = <WrapAvoid><CatComparacion filtered={filtered} prevExps={prevExps} allCatsFull={allCatsFull} cur={cur} /></WrapAvoid>;
  const evolucionArea      = <EvolucionArea allExpenses={expenses} allCatsFull={allCatsFull} configPeriods={configPeriods} cur={cur} />;

  const evolucionJaviLaliNode = (period === 'Todos' && perData.length > 1) ? (
    <Card>
      <h3 style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:800, color:C.navy, margin:'0 0 0.75rem', fontSize:'0.9rem' }}><BarChart3 size={15} strokeWidth={2.2} color={C.accent} />Evolución Javi vs Lali</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={perData} margin={{ top:5, right:5, bottom:30, left:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.beige} />
          <XAxis dataKey="period" tick={{ fontSize:9, angle:-35, textAnchor:'end', fontFamily:F, fill:C.textMuted } as never} interval={0} />
          <YAxis tickFormatter={(v) => fmtS(v, cur)} tick={{ fontSize:9, fontFamily:F, fill:C.textMuted }} width={45} />
          <Tooltip {...tt} />
          <Bar dataKey="javi" name="Javi" fill={C.navy} stackId="a" />
          <Bar dataKey="lali" name="Lali" fill={C.accent} stackId="a" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display:'flex', gap:'1rem', justifyContent:'center', marginTop:'0.5rem' }}>
        {[['Javi', C.navy], ['Lali', C.accent]].map(([name, color]) => (
          <div key={String(name)} style={{ display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.75rem', color:C.navy }}>
            <div style={{ width:'10px', height:'10px', borderRadius:'2px', background:String(color) }} />
            {name}
          </div>
        ))}
      </div>
    </Card>
  ) : null;

  // Condiciones de presencia para armar el layout sin huecos vacíos
  const periodCfg = configPeriods.find(p => p.name === period);
  const showProy = period !== 'Todos' && !!periodCfg && new Date() <= new Date(periodCfg.end + 'T23:59:59');
  const showEvolArea = configPeriods.length >= 2;
  const canCompare = prevExps.length > 0;

  // ── DESKTOP — dos columnas según el período seleccionado ────────────────────
  if (isDesktop) {
    const colStyle: React.CSSProperties = { display:'flex', flexDirection:'column' };
    const twoCol: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap:SP.lg, alignItems:'start', marginTop:SP.md };

    // Nodos de evolución envueltos para que aporten su propio margen inferior,
    // igual que las demás tarjetas (WrapAvoid).
    const evolAreaNode = showEvolArea ? <WrapAvoid>{evolucionArea}</WrapAvoid> : null;
    const evolJaviNode = evolucionJaviLaliNode ? <WrapAvoid>{evolucionJaviLaliNode}</WrapAvoid> : null;

    let body: React.ReactNode;
    if (period === 'Todos') {
      // Col1: categoría · métodos · top 5 — Col2: evolución área · evolución Javi/Lali
      body = (
        <div style={twoCol}>
          <div style={colStyle}>{catCard}{pmCard}{topGastosNode}</div>
          <div style={colStyle}>{evolAreaNode}{evolJaviNode}</div>
        </div>
      );
    } else if (!canCompare) {
      // Primer ciclo (sin período anterior): distribución 2x2 (cat·pm / top·evolución)
      body = (
        <div style={twoCol}>
          <div style={colStyle}>{catCard}{topGastosNode}{showProy && proyeccionNode}</div>
          <div style={colStyle}>{pmCard}{evolAreaNode}</div>
        </div>
      );
    } else {
      // Ciclos posteriores: Col1 categoría · métodos · top 5 — Col2 comparación · evolución
      body = (
        <div style={twoCol}>
          <div style={colStyle}>{catCard}{pmCard}{topGastosNode}</div>
          <div style={colStyle}>{catComparacionNode}{evolAreaNode}{showProy && proyeccionNode}</div>
        </div>
      );
    }

    return (
      <div style={{ padding:SP.lg, paddingBottom:SP.xxl }}>
        <h2 style={{ display:'flex', alignItems:'center', gap:'0.45rem', fontWeight:900, fontSize:FS.title, color:C.navy, margin:'0 0 '+SP.md }}><BarChart3 size={20} strokeWidth={2.3} color={C.accent} />Estadísticas</h2>
        {filters}
        {body}
      </div>
    );
  }

  // ── MOBILE — una sola columna ──────────────────────────────────────────────
  return (
    <div style={{ padding:SP.lg, paddingBottom:SP.xxl, display:'flex', flexDirection:'column', gap:SP.md }}>
      <h2 style={{ display:'flex', alignItems:'center', gap:'0.45rem', fontWeight:900, fontSize:FS.title, color:C.navy, margin:0 }}><BarChart3 size={20} strokeWidth={2.3} color={C.accent} />Estadísticas</h2>
      {filters}
      <ProyeccionCard filtered={filtered} period={period} cur={cur} configPeriods={configPeriods} />
      {canCompare && <CatComparacion filtered={filtered} prevExps={prevExps} allCatsFull={allCatsFull} cur={cur} />}
      {catCard}
      {pmCard}
      <TopGastos filtered={filtered} cur={cur} />
      {evolucionArea}
      {evolucionJaviLaliNode}
    </div>
  );
}
