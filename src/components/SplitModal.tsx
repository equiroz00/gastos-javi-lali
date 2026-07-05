// ── components/SplitModal.tsx ─────────────────────────────────────────────────
// Reparto de un gasto entre N participantes (Sprint 13). Produce un `splitAmong`
// normalizado (estrategia iguales/montos/porcentajes/shares) + quién pagó.
import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { C, F, MONO } from '../constants';
import { fmt, safeN, round2, resolveSplit } from '../lib/helpers';
import type { SplitAmong, SplitStrategy } from '../types';

interface SplitModalProps {
  amount: number;
  currency: string;
  participants: string[];              // universo (allParticipants): Javi, Lali, etiquetas
  paidBy: string;
  splitAmong?: SplitAmong;             // para precargar el estado
  onConfirm: (paidBy: string, splitAmong: SplitAmong) => void;
  onCancel: () => void;
}

const STRATS: Array<{ key: SplitStrategy; label: string }> = [
  { key: 'iguales',     label: 'Iguales' },
  { key: 'montos',      label: 'Montos' },
  { key: 'porcentajes', label: '%' },
  { key: 'shares',      label: 'Partes' },
];

export default function SplitModal({ amount, currency, participants, paidBy: initPaidBy, splitAmong, onConfirm, onCancel }: SplitModalProps) {
  const total = round2(safeN(amount));
  const cur = currency || 'ARS';

  const initSel = splitAmong?.entries?.length
    ? splitAmong.entries.map(e => e.participant)
    : participants.filter(p => p === 'Javi' || p === 'Lali');

  const [paidBy, setPaidBy]     = useState(initPaidBy || 'Javi');
  const [selected, setSelected] = useState<string[]>(initSel.length ? initSel : [participants[0]]);
  const [strategy, setStrategy] = useState<SplitStrategy>(splitAmong?.strategy || 'iguales');
  const [values, setValues]     = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    splitAmong?.entries?.forEach(e => { if (e.value != null) v[e.participant] = String(e.value); });
    return v;
  });

  const buildSplit = (): SplitAmong => ({
    strategy,
    entries: selected.map(p => strategy === 'iguales' ? { participant: p } : { participant: p, value: safeN(values[p]) }),
  });
  const resolved = resolveSplit(total, buildSplit());

  function toggle(p: string) {
    setSelected(sel => sel.includes(p) ? (sel.length > 1 ? sel.filter(x => x !== p) : sel) : [...sel, p]);
  }

  // Aviso de consistencia según la estrategia.
  const sumValues = selected.reduce((s, p) => s + safeN(values[p]), 0);
  let hint = '';
  if (strategy === 'montos' && Math.abs(sumValues - total) >= 0.01) {
    const diff = round2(total - sumValues);
    hint = diff > 0 ? `Faltan ${fmt(diff, cur)} por asignar` : `Te pasaste por ${fmt(-diff, cur)}`;
  } else if (strategy === 'porcentajes' && Math.abs(sumValues - 100) >= 0.1 && sumValues > 0) {
    hint = `Los porcentajes suman ${round2(sumValues)}% (se reparte proporcional)`;
  }

  const inpStyle: React.CSSProperties = {
    width: '5.5rem', border: '1px solid ' + C.border, borderRadius: '0.55rem',
    padding: '0.4rem 0.5rem', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
    fontFamily: MONO, color: C.navy, background: C.surface, textAlign: 'right',
  };
  const chip = (active: boolean): React.CSSProperties => ({
    padding: '0.4rem 0.7rem', borderRadius: '999px', border: '1.5px solid ' + (active ? C.accent : C.border),
    background: active ? C.accent + '1A' : 'transparent', color: active ? C.navy : C.textMuted,
    fontWeight: active ? 800 : 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: F,
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background: C.surface, borderRadius: '1.5rem 1.5rem 0 0', padding: '1.25rem 1.15rem 1.75rem', width: '100%', maxWidth: '480px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 -8px 32px rgba(0,0,0,0.25)', fontFamily: F }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 900, color: C.navy, fontSize: '1rem', margin: 0 }}>¿Cómo se divide?</h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex', padding: '0.25rem' }}>
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {/* ¿Quién pagó? */}
        <p style={{ fontSize: '0.78rem', color: C.textMuted, fontWeight: 700, margin: '0 0 0.4rem' }}>¿Quién pagó?</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
          {participants.map(p => (
            <button key={p} onClick={() => setPaidBy(p)} style={chip(paidBy === p)}>{p}</button>
          ))}
        </div>

        {/* ¿Entre quiénes? */}
        <p style={{ fontSize: '0.78rem', color: C.textMuted, fontWeight: 700, margin: '0 0 0.4rem' }}>¿Entre quiénes se divide?</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
          {participants.map(p => {
            const on = selected.includes(p);
            return (
              <button key={p} onClick={() => toggle(p)} style={chip(on)}>
                {on && <Check size={12} strokeWidth={3} style={{ marginRight: '0.2rem', verticalAlign: '-1px' }} />}{p}
              </button>
            );
          })}
        </div>

        {/* Estrategia */}
        <p style={{ fontSize: '0.78rem', color: C.textMuted, fontWeight: 700, margin: '0 0 0.4rem' }}>Estrategia</p>
        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1rem' }}>
          {STRATS.map(s => {
            const active = strategy === s.key;
            return (
              <button key={s.key} onClick={() => setStrategy(s.key)}
                style={{ flex: 1, padding: '0.45rem 0', borderRadius: '0.7rem', border: '1.5px solid ' + (active ? C.navy : C.border), background: active ? C.navy : 'transparent', color: active ? C.onNavy : C.navy, fontWeight: active ? 800 : 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: F }}>
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Filas por participante: input (según estrategia) + monto resuelto */}
        <div style={{ background: C.bg, borderRadius: '0.9rem', border: '1px solid ' + C.border, padding: '0.5rem 0.75rem', marginBottom: '0.6rem' }}>
          {selected.map(p => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0' }}>
              <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 700, color: C.navy }}>{p}</span>
              {strategy !== 'iguales' && (
                <input type="number" style={inpStyle} value={values[p] ?? ''} placeholder="0"
                  onChange={e => setValues(v => ({ ...v, [p]: e.target.value }))} />
              )}
              {strategy === 'porcentajes' && <span style={{ fontSize: '0.75rem', color: C.textMuted }}>%</span>}
              <span style={{ minWidth: '5rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: 800, color: C.navy, fontFamily: MONO }}>{fmt(safeN(resolved[p]), cur)}</span>
            </div>
          ))}
        </div>

        {/* Total + aviso */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '1.1rem' }}>
          <span style={{ fontSize: '0.72rem', color: hint ? C.warn : C.textMuted, fontWeight: 600 }}>{hint}</span>
          <span style={{ fontSize: '0.8rem', color: C.textMuted, fontWeight: 700 }}>Total: <strong style={{ color: C.navy, fontFamily: MONO }}>{fmt(total, cur)}</strong></span>
        </div>

        {/* Confirmar */}
        <button onClick={() => onConfirm(paidBy, buildSplit())}
          style={{ width: '100%', padding: '0.9rem', background: C.gradMain, color: C.white, border: 'none', borderRadius: '1rem', fontWeight: 900, fontSize: '0.95rem', cursor: 'pointer', fontFamily: F }}>
          Confirmar división
        </button>
      </div>
    </div>
  );
}
