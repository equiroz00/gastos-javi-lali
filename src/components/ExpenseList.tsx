// ── components/ExpenseList.tsx ────────────────────────────────────────────────
import React, { useState } from 'react';
import { Pencil, Trash2, Clock, CreditCard, Lock } from 'lucide-react';
import { C, F, MONO, PENDING_PER } from '../constants';
import { fmt, safeN, catLb, expenseResolved } from '../lib/helpers';
import { CatIcon } from './ui';
import useAppStore from '../store/useAppStore';
import { usePlans } from '../lib/queries';
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

// ── Detalle desplegable ───────────────────────────────────────────────────────
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:'0.75rem', padding:'0.2rem 0' }}>
      <span style={{ fontSize:'0.7rem', color:C.textMuted, flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:'0.72rem', color:C.navy, fontWeight:600, textAlign:'right', minWidth:0, overflowWrap:'anywhere' }}>{children}</span>
    </div>
  );
}

function ExpenseRow({ expense: e, open, onToggle, onDelete, onEdit }: ExpenseRowProps) {
  const cur = e.currency || 'ARS';
  const r = expenseResolved(e);
  const plans          = usePlans();
  const setEditingPlan = useAppStore(s => s.setEditingPlan);
  const plan           = e.fromPlan ? plans.find(p => p.id === e.planId) : undefined;
  // Reparto: se listan solo los participantes con monto, así sirve para N personas.
  const shares = Object.entries(r).filter(([, v]) => safeN(v) > 0);
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
        {/* minWidth:0 + wrap: con montos de 7 cifras la columna J:/L: no cabía
            y empujaba la fila fuera de la pantalla en móvil. */}
        <div style={{ textAlign:'right', flexShrink:1, minWidth:0 }}>
          <div style={{ fontWeight:800, color:C.navy, fontSize:'0.9rem', fontFamily:MONO, overflowWrap:'anywhere' }}>{fmt(safeN(e.amount), cur)}</div>
          <div style={{ fontSize:'0.62rem', color:C.textMuted, fontFamily:MONO, overflowWrap:'anywhere' }}>J:{fmt(safeN(r['Javi']), cur)} / L:{fmt(safeN(r['Lali']), cur)}</div>
        </div>
      </div>
      {open && (
        <div style={{ padding:'0.6rem 1rem 0.7rem', background:C.bg, borderTop:'1px solid '+C.border }}>
          <DetailRow label="Pagó">{e.paidBy}</DetailRow>
          {shares.length > 0 && (
            <DetailRow label="Reparto">
              <span style={{ fontFamily:MONO }}>{shares.map(([p, v]) => p + ' ' + fmt(safeN(v), cur)).join(' · ')}</span>
            </DetailRow>
          )}
          <DetailRow label="Categoría">{catLb(e.category)}</DetailRow>
          {e.paymentMethod && <DetailRow label="Medio de pago">{e.paymentMethod}</DetailRow>}
          {e.bank && <DetailRow label="Banco / billetera">{e.bank}</DetailRow>}
          <DetailRow label="Período">{e.period || 'Sin período'}</DetailRow>
          {e.fromPlan && <DetailRow label="Cuota">{e.installmentNum} de {e.numInstallments}</DetailRow>}
          {e.visibilidad === 'privado' && (
            <DetailRow label="Visibilidad">
              <span style={{ display:'inline-flex', alignItems:'center', gap:'0.2rem' }}><Lock size={11} strokeWidth={2.4} />Privado</span>
            </DetailRow>
          )}

          {e.notes && (
            <div style={{ marginTop:'0.4rem', paddingTop:'0.4rem', borderTop:'1px solid '+C.border }}>
              <div style={{ fontSize:'0.7rem', color:C.textMuted, marginBottom:'0.2rem' }}>Notas</div>
              {/* pre-wrap conserva el bloque de ítems del ticket; el tope de alto
                  evita que una nota larga estire la fila del historial. */}
              <div style={{ fontSize:'0.72rem', color:C.navy, whiteSpace:'pre-wrap', overflowWrap:'anywhere', maxHeight:'8rem', overflowY:'auto', lineHeight:1.45 }}>
                {e.notes}
              </div>
            </div>
          )}

          {/* Autoría */}
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', background:C.surface, border:'1px solid '+C.border, borderRadius:'0.6rem', padding:'0.35rem 0.5rem', marginTop:'0.5rem' }}>
            <div style={{ width:'1.4rem', height:'1.4rem', borderRadius:'50%', background:C.accent, color:C.white, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.65rem', fontWeight:800, flexShrink:0 }}>
              {e.createdBy ? e.createdBy.charAt(0) : '?'}
            </div>
            <span style={{ fontSize:'0.7rem', color:C.textMuted, minWidth:0 }}>
              {e.createdBy
                ? <>Añadido por <strong style={{ color:C.navy }}>{e.createdBy}</strong></>
                : 'No se registró quién lo añadió'}
              {e.createdAt && <> · {String(e.createdAt).substring(0, 10)}</>}
            </span>
          </div>

          {/* Acciones */}
          {e.fromPlan ? (
            plan ? (
              <button onClick={() => setEditingPlan(plan)} style={{ width:'100%', marginTop:'0.5rem', padding:'0.4rem', background:C.beige, border:'none', borderRadius:'0.6rem', color:C.navy, fontWeight:700, fontSize:'0.75rem', cursor:'pointer', fontFamily:F, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35rem' }}>
                <CreditCard size={13} strokeWidth={2} />Editar o borrar el plan completo
              </button>
            ) : (
              <div style={{ marginTop:'0.5rem', fontSize:'0.68rem', color:C.textMuted, textAlign:'center' }}>
                Las cuotas se editan desde su plan, y este no está disponible.
              </div>
            )
          ) : (
            <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.5rem' }}>
              <button onClick={() => onEdit(e)} style={{ flex:1, padding:'0.4rem', background:C.beige, border:'none', borderRadius:'0.6rem', color:C.navy, fontWeight:700, fontSize:'0.75rem', cursor:'pointer', fontFamily:F, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35rem' }}>
                <Pencil size={13} strokeWidth={2} />Editar
              </button>
              <button onClick={() => onDelete(e.id, e)} style={{ flex:1, padding:'0.4rem', background:'#fde8ee', border:'none', borderRadius:'0.6rem', color:'#c0314f', fontWeight:700, fontSize:'0.75rem', cursor:'pointer', fontFamily:F, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.35rem' }}>
                <Trash2 size={13} strokeWidth={2} />Eliminar
              </button>
            </div>
          )}
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
