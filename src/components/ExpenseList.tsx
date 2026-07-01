// ── components/ExpenseList.tsx ────────────────────────────────────────────────
import React, { useState } from 'react';
import { Pencil, Trash2, Clock } from 'lucide-react';
import { C, F, MONO, PENDING_PER } from '../constants';
import { fmt, safeN, catLb, expenseResolved } from '../lib/helpers';
import { CatIcon } from './ui';
import type { Expense } from '../types';

interface ExpenseListProps {
  expenses: Expense[];
  onDelete: (id: string, e: Expense) => void;
  onEdit: (e: Expense) => void;
}

interface ExpenseRowProps {
  expense: Expense;
  open: boolean;
  onToggle: () => void;
  onDelete: ExpenseListProps['onDelete'];
  onEdit: ExpenseListProps['onEdit'];
}

function ExpenseRow({ expense: e, open, onToggle, onDelete, onEdit }: ExpenseRowProps) {
  const cur = e.currency || 'ARS';
  const r = expenseResolved(e);
  return (
    <div style={{ borderBottom:'1px solid '+C.beige }}>
      <div onClick={onToggle} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.65rem 1rem', cursor:'pointer', background:open ? C.bg : C.surface }}>
        <div style={{ flexShrink:0, width:'2.1rem', height:'2.1rem', borderRadius:'0.6rem', background:C.bg, border:'1px solid '+C.border, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <CatIcon category={e.category} size={18} color={C.navy} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.3rem', flexWrap:'wrap' }}>
            <span style={{ fontWeight:700, color:C.navy, fontSize:'0.88rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'140px' }}>{e.description || 'Sin descripción'}</span>
            {cur !== 'ARS' && (
              <span style={{ fontSize:'0.58rem', background:C.navy, color:C.onNavy, borderRadius:'999px', padding:'0.1rem 0.3rem', fontWeight:800, flexShrink:0 }}>{cur}</span>
            )}
            {e.fromPlan && (
              <span style={{ fontSize:'0.58rem', background:C.accent, color:C.white, borderRadius:'999px', padding:'0.1rem 0.4rem', fontWeight:800, flexShrink:0, display:'inline-flex', alignItems:'center', gap:'0.15rem' }}>
                <Clock size={9} strokeWidth={2.5} />{e.installmentNum}/{e.numInstallments}
              </span>
            )}
            {e.period === PENDING_PER && (
              <span style={{ fontSize:'0.58rem', background:'#f59e0b', color:C.white, borderRadius:'999px', padding:'0.15rem 0.3rem', fontWeight:800, flexShrink:0, display:'inline-flex', alignItems:'center' }}>
                <Clock size={9} strokeWidth={2.5} />
              </span>
            )}
          </div>
          <div style={{ fontSize:'0.68rem', color:C.textMuted, marginTop:'0.05rem' }}>
            {e.date} · {catLb(e.category)} ·{' '}
            <span style={{ color:e.paidBy === 'Javi' ? C.navy : C.accent, fontWeight:700 }}>{e.paidBy}</span>
          </div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontWeight:800, color:C.navy, fontSize:'0.9rem', fontFamily:MONO }}>{fmt(safeN(e.amount), cur)}</div>
          <div style={{ fontSize:'0.62rem', color:C.textMuted, fontFamily:MONO }}>J:{fmt(safeN(r['Javi']), cur)} / L:{fmt(safeN(r['Lali']), cur)}</div>
        </div>
      </div>
      {open && !e.fromPlan && (
        <div style={{ display:'flex', gap:'0.5rem', padding:'0.45rem 1rem', background:C.bg, borderTop:'1px solid '+C.border }}>
          <button onClick={() => onEdit(e)} style={{ flex:1, padding:'0.4rem', background:C.beige, border:'none', borderRadius:'0.6rem', color:C.navy, fontWeight:700, fontSize:'0.75rem', cursor:'pointer', fontFamily:F, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35rem' }}>
            <Pencil size={13} strokeWidth={2} />Editar
          </button>
          <button onClick={() => onDelete(e.id, e)} style={{ flex:1, padding:'0.4rem', background:'#fde8ee', border:'none', borderRadius:'0.6rem', color:'#c0314f', fontWeight:700, fontSize:'0.75rem', cursor:'pointer', fontFamily:F, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35rem' }}>
            <Trash2 size={13} strokeWidth={2} />Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

export default function ExpenseList({ expenses = [], onDelete, onEdit }: ExpenseListProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      {expenses.map(e => (
        <ExpenseRow
          key={e.id}
          expense={e}
          open={openId === e.id}
          onToggle={() => setOpenId(openId === e.id ? null : e.id)}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </>
  );
}
