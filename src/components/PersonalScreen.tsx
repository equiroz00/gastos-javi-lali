// ── components/PersonalScreen.tsx ─────────────────────────────────────────────
// Vista "Personal" (Sprint 12): "¿cuánto gasté YO este ciclo?".
// Mi consumo = mis gastos privados (completos) + mi parte de los compartidos
// (según el reparto real, resolveSplit). Los privados del otro NO están en la
// caché (dual-query), así que este cálculo solo ve lo que me corresponde.
import React, { useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, Lock, Users } from 'lucide-react';
import { C, V, MONO, SP, FS, PALETTE, PENDING_PER, DEFAULT_CATS } from '../constants';
import { fmt, fmtS, safeN, catLb, normCat, pctChange, expenseResolved } from '../lib/helpers';
import { Card, ScrollFilter, CatIcon, ScreenHeader, AmountBand, BandPills, SectionLabel, bandColors } from './ui';
import useAppStore from '../store/useAppStore';
import { useExpenses, useSettings, useCustomCats } from '../lib/queries';
import type { Expense, Currency, UserName } from '../types';

// Fila "de dónde viene" con mini-barra de proporción.
function SourceRow({ icon, label, value, total, cur, color }: {
  icon: React.ReactNode; label: string; value: number; total: number; cur: Currency; color: string;
}) {
  const pct = total > 0 ? Math.round(value / total * 100) : 0;
  return (
    <div style={{ marginBottom:'0.7rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.45rem', marginBottom:'0.3rem' }}>
        <span style={{ color, display:'flex' }}>{icon}</span>
        <span style={{ flex:1, fontSize:'0.8rem', color:C.navy, fontWeight:600 }}>{label}</span>
        <span style={{ fontSize:'0.8rem', color:C.navy, fontWeight:800, fontFamily:MONO }}>{fmtS(value, cur)}</span>
        <span style={{ fontSize:'0.7rem', color:C.textMuted, width:'2.6rem', textAlign:'right' }}>{pct}%</span>
      </div>
      <div style={{ height:'6px', background:C.beige, borderRadius:'999px', overflow:'hidden' }}>
        <div style={{ width:pct+'%', height:'100%', background:color, borderRadius:'999px' }} />
      </div>
    </div>
  );
}

export default function PersonalScreen() {
  const expenses    = useExpenses();
  const settings    = useSettings();
  const customCats  = useCustomCats();
  const currentUser = useAppStore(s => s.currentUser) as UserName;

  const allCatsFull   = [...DEFAULT_CATS, ...(customCats || [])];
  const configPeriods = settings.periods || [];
  const allPeriodNames = [...new Set([
    ...configPeriods.map(p => p.name),
    ...expenses.filter(e => e.period && e.period !== PENDING_PER).map(e => e.period),
  ])];
  const allCurrencies = [...new Set(expenses.map(e => e.currency || 'ARS'))];

  const [period, setPeriod] = useState('Todos');
  const [cur, setCur]       = useState<Currency>('ARS');

  // Mi parte de un gasto: si es privado (mío) va completo; si es compartido, mi
  // porción resuelta del split.
  const myShare = (e: Expense): number =>
    e.visibilidad === 'privado' ? safeN(e.amount) : safeN(expenseResolved(e)[currentUser]);

  const byPer    = period === 'Todos' ? expenses : expenses.filter(e => e.period === period);
  const filtered = byPer.filter(e => (e.currency || 'ARS') === cur && e.period !== PENDING_PER);

  const total      = filtered.reduce((s, e) => s + myShare(e), 0);
  const privado    = filtered.filter(e => e.visibilidad === 'privado').reduce((s, e) => s + safeN(e.amount), 0);
  const compartido = total - privado;

  // vs. período anterior (solo cuando hay un período concreto seleccionado)
  let prevTotal = 0;
  if (period !== 'Todos') {
    const idx = configPeriods.findIndex(p => p.name === period);
    if (idx > 0) {
      const prevName = configPeriods[idx - 1].name;
      prevTotal = expenses
        .filter(e => e.period === prevName && (e.currency || 'ARS') === cur && e.period !== PENDING_PER)
        .reduce((s, e) => s + myShare(e), 0);
    }
  }
  const delta = pctChange(total, prevTotal);

  // Por categoría (según mi parte)
  const byCat: Record<string, number> = {};
  filtered.forEach(e => { const k = catLb(normCat(e.category, allCatsFull)); byCat[k] = (byCat[k] || 0) + myShare(e); });
  const cats = Object.entries(byCat)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, pct: total > 0 ? Math.round(value / total * 100) : 0 }));

  const title = (
    <h2 style={{ display:'flex', alignItems:'center', gap:'0.45rem', fontWeight:900, fontSize:FS.title, color:C.navy, marginBottom:SP.md }}>
      <Wallet size={20} strokeWidth={2.3} color={C.accent} />Lo mío
    </h2>
  );
  const filters = (
    <>
      <ScrollFilter items={['Todos', ...allPeriodNames]} selected={period} onSelect={setPeriod} />
      {allCurrencies.length > 1 && <ScrollFilter items={allCurrencies} selected={cur} onSelect={(c: string) => setCur(c as Currency)} />}
    </>
  );

  if (!filtered.length) return (
    <div style={{ padding:SP.lg, paddingBottom:SP.xxl }}>
      {title}{filters}
      <Card style={{ marginTop:SP.md }}>
        <p style={{ color:C.textMuted, textAlign:'center', margin:'0.85rem 0', fontSize:'0.85rem' }}>No hay gastos tuyos en este período.</p>
      </Card>
    </div>
  );

  // ── "Estado de cuenta" (mockup 2a) ────────────────────────────────────────
  // El titular y el desglose privado/compartido viven DENTRO de la banda, con
  // dos barras de proporción; las categorías bajan a filas con filete.
  const bandBar = (label: string, icon: React.ReactNode, value: number, color: string) => {
    const pct = total > 0 ? Math.round(value / total * 100) : 0;
    const B = bandColors();
    return (
      <div style={{ marginTop:'0.7rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.75rem', color:B.on }}>
          <span style={{ display:'flex', alignItems:'center', gap:'0.35rem' }}>{icon}{label}</span>
          <span style={{ fontFamily:MONO, fontWeight:700 }}>{fmtS(value, cur)}</span>
        </div>
        <div style={{ height:'6px', borderRadius:'999px', background:B.on+'2E', marginTop:'0.3rem', overflow:'hidden' }}>
          <span style={{ display:'block', width:pct+'%', height:'100%', background:color }} />
        </div>
      </div>
    );
  };

  if (V.heroBand) return (
    <div style={{ padding:SP.lg, paddingBottom:SP.xxl }}>
      <div style={{ margin:'-'+SP.lg+' -'+SP.lg+' '+SP.lg }}>
        <ScreenHeader crumb="Lo mío" current={period === 'Todos' ? 'Todos los períodos' : period} />
        <AmountBand
          eyebrow={'Gastaste vos ' + (period === 'Todos' ? 'en total' : 'este ciclo')}
          amount={fmt(total, cur)}
          aside={<BandPills items={['Todos', ...allPeriodNames]} selected={period} onSelect={setPeriod} />}
        >
          {delta !== null && (
            <div style={{ display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.75rem', fontWeight:700, color: delta > 0 ? C.danger : C.ok, marginTop:'0.35rem' }}>
              {delta > 0 ? <TrendingUp size={14} strokeWidth={2.4} /> : <TrendingDown size={14} strokeWidth={2.4} />}
              {Math.abs(delta)}% vs. ciclo anterior
            </div>
          )}
          {bandBar('Tu parte compartida', <Users size={13} strokeWidth={2.2} />, compartido, C.accent)}
          {bandBar('Privados tuyos',      <Lock  size={13} strokeWidth={2.2} />, privado,    C.beige)}
        </AmountBand>
      </div>

      {cats.length > 0 && (
        <>
          <SectionLabel style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
            <span>Tus categorías</span>
            <span style={{ fontSize:'0.64rem', fontWeight:500, letterSpacing:0, textTransform:'none', color:C.textMuted }}>sobre tu parte</span>
          </SectionLabel>
          {cats.map((c, i) => (
            <div key={c.label} style={{ padding:'0.7rem 0', borderBottom: i < cats.length - 1 ? '1px solid '+C.border : 'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
                <CatIcon category={c.label} size={15} color={C.textMuted} />
                <span style={{ flex:1, fontSize:'0.8rem', fontWeight:600, color:C.navy }}>{c.label}</span>
                <span style={{ fontFamily:MONO, fontSize:'0.8rem', fontWeight:700, color:C.navy }}>{fmtS(c.value, cur)}</span>
              </div>
              <div style={{ height:'5px', borderRadius:'999px', background:C.beige, marginTop:'0.4rem', overflow:'hidden' }}>
                <span style={{ display:'block', width:c.pct+'%', height:'100%', background:PALETTE[i % PALETTE.length] }} />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );

  return (
    <div style={{ padding:SP.lg, paddingBottom:SP.xxl }}>
      {title}
      {filters}
      <div style={{ display:'flex', flexDirection:'column', gap:SP.md, marginTop:SP.md }}>

        {/* Titular: cuánto gasté yo */}
        <Card>
          <div style={{ fontSize:'0.78rem', color:C.textMuted, fontWeight:700 }}>
            Gastaste vos {period === 'Todos' ? 'en total' : 'este ciclo'}
          </div>
          <div style={{ fontSize:FS.amount, fontWeight:900, color:C.navy, fontFamily:MONO, letterSpacing:'-0.02em', margin:'0.2rem 0 0.15rem' }}>
            {fmt(total, cur)}
          </div>
          {delta !== null && (
            <div style={{ display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.75rem', fontWeight:700, color: delta > 0 ? C.danger : C.ok }}>
              {delta > 0 ? <TrendingUp size={14} strokeWidth={2.4} /> : <TrendingDown size={14} strokeWidth={2.4} />}
              {Math.abs(delta)}% vs. ciclo anterior
            </div>
          )}
        </Card>

        {/* De dónde viene: privado vs. mi parte de lo compartido */}
        <Card>
          <h3 style={{ fontWeight:800, color:C.navy, margin:'0 0 0.85rem', fontSize:'0.9rem' }}>De dónde viene</h3>
          <SourceRow icon={<Lock size={14} strokeWidth={2.2} />}  label="Gastos privados"            value={privado}    total={total} cur={cur} color={C.accent} />
          <SourceRow icon={<Users size={14} strokeWidth={2.2} />} label="Mi parte de lo compartido"  value={compartido} total={total} cur={cur} color={C.navy} />
        </Card>

        {/* Por categoría */}
        {cats.length > 0 && (
          <Card>
            <h3 style={{ fontWeight:800, color:C.navy, margin:'0 0 0.85rem', fontSize:'0.9rem' }}>Por categoría</h3>
            {cats.map((c, i) => (
              <div key={c.label} style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.55rem' }}>
                <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:PALETTE[i % PALETTE.length], flexShrink:0 }} />
                <span style={{ flex:1, fontSize:'0.78rem', color:C.navy, fontWeight:600, display:'flex', alignItems:'center', gap:'0.35rem' }}>
                  <CatIcon category={c.label} size={14} color={C.navy} />{c.label}
                </span>
                <span style={{ fontSize:'0.78rem', color:C.navy, fontWeight:700, fontFamily:MONO }}>{fmtS(c.value, cur)}</span>
                <span style={{ fontSize:'0.7rem', color:C.textMuted, width:'2.5rem', textAlign:'right' }}>{c.pct}%</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
