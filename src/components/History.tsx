// ── components/History.tsx ────────────────────────────────────────────────────
import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { C, F, PENDING_PER, SP } from '../constants';
import { fmt, safeN, calcBal, sortByDate } from '../lib/helpers';
import { useIsDesktop } from '../lib/useIsDesktop';
import useAppStore from '../store/useAppStore';
import { Card, ScrollFilter } from './ui';
import ExpenseList from './ExpenseList';
import type { Expense } from '../types';

interface PeriodBlockProps {
  period: string;
  exps: Expense[];
  isOpen: boolean;
  isPending: boolean;
  isSelected: boolean;
  hasSelection: boolean;
  onToggle: () => void;
  onDelete: (id: string, e: Expense) => void;
  onEdit: (e: Expense) => void;
}

function PeriodBlock({ period, exps, isOpen, isPending, isSelected, hasSelection, onToggle, onDelete, onEdit }: PeriodBlockProps) {
  const total = exps.reduce((s, e) => s + safeN(e.amount), 0);
  const bal = calcBal(exps.filter(e => (e.currency || 'ARS') === 'ARS'));
  const highlighted = isOpen || isSelected;
  // Sobre fondo navy (abierto) el texto usa onNavy; sobre accent (seleccionado)
  // el blanco funciona en ambos temas. Antes todo era blanco y en el tema
  // oscuro quedaba blanco sobre blanco.
  const headerBg  = isPending ? '#fef3c7' : isSelected ? C.accent : isOpen ? C.navy : C.surface;
  const textColor = isPending ? '#92400e' : isSelected ? C.white : isOpen ? C.onNavy : C.navy;
  const subColor  = isPending ? '#b45309' : isSelected ? 'rgba(255,255,255,0.75)' : isOpen ? C.onNavy + 'B3' : C.textMuted;
  const balColor  = isSelected ? 'rgba(255,255,255,0.9)' : isOpen ? C.onNavy + 'E6' : C.accent;
  const okColor   = isSelected ? 'rgba(255,255,255,0.85)' : isOpen ? C.onNavy + 'CC' : '#2d9e7f';

  return (
    <div>
      <div
        onClick={onToggle}
        style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:headerBg, borderRadius:isOpen ? '1rem 1rem 0 0' : '1rem', padding:'0.85rem 1rem', boxShadow:'0 2px 8px rgba(0,0,0,0.08)', cursor:'pointer', border:'1px solid ' + (isPending ? '#f59e0b' : isSelected ? C.accent : isOpen ? C.navy : C.border) }}
      >
        <div>
          <div style={{ fontWeight:800, color:textColor, fontSize:'0.9rem' }}>{isPending ? 'Cuotas pendientes' : period}</div>
          <div style={{ fontSize:'0.7rem', color:subColor, marginTop:'0.1rem' }}>{exps.length} gastos · {fmt(total)}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          {!isPending && (
            Math.abs(bal) >= 1 ? (
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'0.7rem', fontWeight:800, color:balColor }}>{bal > 0 ? 'Lali debe' : 'Javi debe'}</div>
                <div style={{ fontSize:'0.7rem', fontWeight:800, color:balColor }}>{fmt(Math.abs(bal))}</div>
              </div>
            ) : (
              <div style={{ fontSize:'0.7rem', color:okColor, fontWeight:700 }}>✓ Al día</div>
            )
          )}
          <span style={{ color:subColor, fontSize:'0.85rem' }}>
            {hasSelection ? (isSelected ? '✓' : '○') : (isOpen ? '▲' : '▼')}
          </span>
        </div>
      </div>
      {highlighted && (
        <div style={{ background:C.surface, borderRadius:'0 0 1rem 1rem', boxShadow:'0 2px 8px rgba(0,0,0,0.08)', overflow:'hidden', border:'1px solid '+C.border, borderTop:'none' }}>
          <ExpenseList expenses={exps} onDelete={onDelete} onEdit={onEdit} />
        </div>
      )}
    </div>
  );
}

export default function History() {
  const isDesktop         = useIsDesktop();
  const expenses          = useAppStore(s => s.expenses);
  const settings          = useAppStore(s => s.settings);
  const requestDelete     = useAppStore(s => s.requestDelete);
  const setEditingExpense = useAppStore(s => s.setEditingExpense);

  const [search, setSearch]                   = useState('');
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [openMap, setOpenMap]                 = useState<Record<string, boolean>>({});
  const [catFilter, setCatFilter]             = useState('Todas');
  const [sortOrder, setSortOrder]             = useState<'date' | 'amount-desc' | 'amount-asc'>('date');

  // Opciones de categoría a partir de los gastos existentes
  const catOptions = ['Todas', ...Array.from(new Set(expenses.map(e => e.category).filter(Boolean)))];
  // Filtro por categoría aplicado antes de agrupar por período
  const baseExpenses = catFilter === 'Todas' ? expenses : expenses.filter(e => e.category === catFilter);

  // Orden de los gastos dentro de cada bloque / resultados de búsqueda
  function applySort(list: Expense[]): Expense[] {
    if (sortOrder === 'amount-desc') return [...list].sort((a, b) => safeN(b.amount) - safeN(a.amount));
    if (sortOrder === 'amount-asc')  return [...list].sort((a, b) => safeN(a.amount) - safeN(b.amount));
    return sortByDate(list);
  }

  const grouped: Record<string, Expense[]> = {};
  baseExpenses.forEach(e => {
    const p = e.period || 'Sin período';
    if (!grouped[p]) grouped[p] = [];
    grouped[p].push(e);
  });
  const configOrder = (settings.periods || []).map(p => p.name).slice().reverse();
  const others = Object.keys(grouped).filter(p => configOrder.indexOf(p) < 0 && p !== PENDING_PER);
  const allSorted = configOrder.filter(p => grouped[p]).concat(others).concat(grouped[PENDING_PER] ? [PENDING_PER] : []);
  const searchLower = search.toLowerCase().trim();

  const expenseMatches: Expense[] = [];
  if (searchLower) {
    baseExpenses.forEach(e => {
      const descMatch = (e.description || '').toLowerCase().indexOf(searchLower) >= 0;
      const dateMatch = (e.date || '').indexOf(searchLower) >= 0;
      const amtMatch  = String(Math.round(safeN(e.amount))).indexOf(searchLower) >= 0;
      if (descMatch || dateMatch || amtMatch) expenseMatches.push(e);
    });
  }

  const filteredPeriods = searchLower ? allSorted.filter(p => p.toLowerCase().indexOf(searchLower) >= 0) : allSorted;
  const hasSelection = selectedPeriods.length > 0;
  const displayPeriods = hasSelection ? filteredPeriods.filter(p => selectedPeriods.indexOf(p) >= 0) : filteredPeriods;

  function toggleSelect(p: string) {
    setSelectedPeriods(prev => prev.indexOf(p) >= 0 ? prev.filter(x => x !== p) : [...prev, p]);
  }
  function toggleOpen(p: string) {
    setOpenMap(prev => ({ ...prev, [p]: !prev[p] }));
  }
  const showExpMatches = !!searchLower && expenseMatches.length > 0;

  return (
    <div style={{ padding:SP.lg, paddingBottom:SP.xxl, maxWidth: isDesktop ? '760px' : undefined, margin: isDesktop ? '0 auto' : undefined, width:'100%', boxSizing:'border-box' }}>
      <h2 style={{ fontWeight:900, fontSize:'1.2rem', color:C.navy, marginBottom:SP.md }}>Historial</h2>
      <input
        value={search}
        onChange={e => { setSearch(e.target.value); setSelectedPeriods([]); }}
        placeholder="Buscar período, gasto, fecha o monto..."
        style={{ width:'100%', border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.5rem 0.75rem', fontSize:'0.82rem', outline:'none', fontFamily:F, color:C.navy, background:C.surface, boxSizing:'border-box', marginBottom:'0.6rem' }}
      />

      {/* Filtro por categoría + orden */}
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.6rem', flexWrap:'wrap', alignItems:'center' }}>
        <select
          value={catFilter}
          onChange={e => { setCatFilter(e.target.value); setSelectedPeriods([]); }}
          style={{ flex:'1 1 160px', minWidth:0, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.45rem 0.7rem', fontSize:'0.8rem', fontWeight:600, outline:'none', cursor:'pointer', fontFamily:F, color:C.navy, background:C.surface }}
        >
          {catOptions.map(c => <option key={c} value={c}>{c === 'Todas' ? 'Todas las categorías' : c}</option>)}
        </select>
        <div style={{ display:'flex', gap:'0.3rem' }}>
          {([['date', 'Fecha'], ['amount-desc', 'Mayor $'], ['amount-asc', 'Menor $']] as const).map(([val, label]) => {
            const active = sortOrder === val;
            return (
              <button
                key={val}
                onClick={() => setSortOrder(val)}
                style={{ padding:'0.4rem 0.7rem', fontSize:'0.75rem', borderRadius:'999px', border:'1px solid', cursor:'pointer', fontFamily:F, fontWeight:active ? 800 : 500, background:active ? C.navy : 'transparent', borderColor:active ? C.navy : C.border, color:active ? C.onNavy : C.navy, whiteSpace:'nowrap' }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {showExpMatches && (
        <div style={{ marginBottom:'0.75rem' }}>
          <div style={{ fontWeight:700, fontSize:'0.75rem', color:C.textMuted, marginBottom:'0.35rem' }}>
            {expenseMatches.length} gasto{expenseMatches.length !== 1 ? 's' : ''} encontrado{expenseMatches.length !== 1 ? 's' : ''}
          </div>
          <Card style={{ padding:0, overflow:'hidden' }}>
            <div style={{ maxHeight:'320px', overflowY:'auto' }}>
              <ExpenseList expenses={applySort(expenseMatches)} onDelete={requestDelete} onEdit={setEditingExpense} />
            </div>
          </Card>
        </div>
      )}

      {allSorted.length > 3 && (
        <div style={{ marginBottom:'0.6rem' }}>
          <div style={{ fontSize:'0.7rem', color:C.textMuted, marginBottom:'0.3rem', fontWeight:700 }}>
            {hasSelection ? selectedPeriods.length + ' período(s) seleccionado(s)' : 'Períodos' + (searchLower ? ' (filtrados por nombre)' : '')}
          </div>
          <ScrollFilter items={filteredPeriods} selected={selectedPeriods} onSelect={toggleSelect} multi />
          {hasSelection && (
            <button onClick={() => setSelectedPeriods([])} style={{ background:'transparent', border:'1px solid '+C.accent, borderRadius:'999px', padding:'0.2rem 0.65rem', fontSize:'0.7rem', color:C.accent, cursor:'pointer', fontFamily:F, fontWeight:700, marginTop:'0.3rem' }}>
              ✕ Limpiar selección
            </button>
          )}
        </div>
      )}

      {filteredPeriods.length === 0 && !showExpMatches ? (
        <Card style={{ textAlign:'center', padding:'3rem', color:C.textMuted }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:'0.5rem' }}>
            <Search size={32} strokeWidth={1.6} color={C.textMuted} />
          </div>
          No se encontraron resultados
        </Card>
      ) : filteredPeriods.length > 0 ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem', maxHeight:allSorted.length > 3 ? '65vh' : undefined, overflowY:allSorted.length > 3 ? 'auto' : undefined }}>
          {displayPeriods.map(period => (
            <PeriodBlock
              key={period}
              period={period}
              exps={applySort(grouped[period] || [])}
              isOpen={!!openMap[period]}
              isSelected={selectedPeriods.indexOf(period) >= 0}
              isPending={period === PENDING_PER}
              hasSelection={hasSelection}
              onToggle={() => { if (hasSelection) toggleSelect(period); else toggleOpen(period); }}
              onDelete={requestDelete}
              onEdit={setEditingExpense}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
