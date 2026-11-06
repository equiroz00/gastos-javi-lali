// ── components/SplitModal.tsx ─────────────────────────────────────────────────
// Reparto de un gasto entre N participantes (Sprint 13). Produce un `splitAmong`
// normalizado (estrategia iguales/montos/porcentajes/shares) + quién pagó.
import React, { useState } from 'react';
import { X, Check, ChevronDown, Plus, UserPlus } from 'lucide-react';
import { C, F, MONO } from '../constants';
import { fmt, safeN, round2, resolveSplit, validatePersonName } from '../lib/helpers';
import { usePeople } from '../lib/queries';
import useAppStore from '../store/useAppStore';
import type { SplitAmong, SplitStrategy } from '../types';

// Los dos dueños de la app. El resto ("otros") son etiquetas guardadas en
// settings/main.people, compartidas entre los dos.
const COUPLE = ['Javi', 'Lali'];

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

  // ── Otras personas ("Otro ▾") ──────────────────────────────────────────────
  // Lista viva (usePeople): una persona agregada acá aparece al instante y queda
  // guardada para siempre, para los dos. Se suman también las que ya figuran en
  // este gasto aunque después se hayan borrado de la lista, para no perderlas.
  const people     = usePeople();
  const savePeople = useAppStore(s => s.savePeople);
  const savedOthers = people.filter(p => !COUPLE.includes(p));
  const others = [...savedOthers, ...selected.filter(p => !COUPLE.includes(p) && !savedOthers.includes(p))];
  const selectedOthers = selected.filter(p => !COUPLE.includes(p));

  const [menuOpen, setMenuOpen] = useState(false);
  const [newName, setNewName]   = useState('');
  const [nameErr, setNameErr]   = useState('');

  function addPerson() {
    const res = validatePersonName(newName, [...COUPLE, ...people]);
    if (!res.ok) { setNameErr(res.error); return; }
    savePeople([...people, res.name]);
    setSelected(sel => sel.includes(res.name) ? sel : [...sel, res.name]);
    setNewName(''); setNameErr('');
  }

  // Quién pagó: solo Javi o Lali. Si un gasto viejo figura pagado por un
  // tercero, se muestra igual para no cambiarlo sin querer al editar.
  const payers = COUPLE.includes(initPaidBy) || !initPaidBy ? COUPLE : [...COUPLE, initPaidBy];

  // Al elegir una estrategia, precargo valores sensatos (50/50, 1 y 1, montos
  // iguales) para que el preview arranque bien en vez de en cero.
  function pickStrategy(s: SplitStrategy) {
    setStrategy(s);
    if (s === 'iguales') return;
    const n = selected.length || 1;
    const per = Math.floor(100 / n);
    const next: Record<string, string> = {};
    selected.forEach((p, i) => {
      next[p] = s === 'montos'      ? String(round2(total / n))
              : s === 'porcentajes' ? String(i === n - 1 ? 100 - per * (n - 1) : per)
              : '1'; // shares
    });
    setValues(next);
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
          {payers.map(p => (
            <button key={p} onClick={() => setPaidBy(p)} style={chip(paidBy === p)}>{p}</button>
          ))}
        </div>

        {/* ¿Entre quiénes? — Javi y Lali siempre; los demás, desde "Otro ▾". */}
        <p style={{ fontSize: '0.78rem', color: C.textMuted, fontWeight: 700, margin: '0 0 0.4rem' }}>¿Entre quiénes se divide?</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: menuOpen ? '0.5rem' : '1rem', alignItems: 'center' }}>
          {COUPLE.map(p => {
            const on = selected.includes(p);
            return (
              <button key={p} onClick={() => toggle(p)} style={chip(on)}>
                {on && <Check size={12} strokeWidth={3} style={{ marginRight: '0.2rem', verticalAlign: '-1px' }} />}{p}
              </button>
            );
          })}
          {selectedOthers.map(p => (
            <button key={p} onClick={() => toggle(p)} title={'Sacar a ' + p} style={{ ...chip(true), display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              {p}<X size={12} strokeWidth={3} />
            </button>
          ))}
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-expanded={menuOpen}
            style={{ ...chip(false), borderStyle: 'dashed', color: C.navy, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            Otro <ChevronDown size={13} strokeWidth={2.5} style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>

        {menuOpen && (
          <div style={{ border: '1px solid ' + C.border, borderRadius: '0.9rem', background: C.bg, padding: '0.5rem', marginBottom: '1rem' }}>
            {others.length === 0 && (
              <p style={{ fontSize: '0.72rem', color: C.textMuted, margin: '0.25rem 0.35rem 0.5rem' }}>
                Todavía no agregaste a nadie. La persona que sumes acá queda guardada para los próximos gastos.
              </p>
            )}
            {others.map(p => {
              const on = selected.includes(p);
              return (
                <button key={p} onClick={() => toggle(p)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.45rem', background: 'none', border: 'none', borderRadius: '0.55rem', cursor: 'pointer', fontFamily: F, color: C.navy, fontSize: '0.85rem', fontWeight: on ? 800 : 600, textAlign: 'left' }}>
                  <span style={{ width: '18px', height: '18px', borderRadius: '5px', border: '2px solid ' + (on ? C.accent : C.border), background: on ? C.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {on && <Check size={12} strokeWidth={3.5} color={C.white} />}
                  </span>
                  {p}
                </button>
              );
            })}
            {/* Alta de una persona nueva: queda guardada y ya elegida. */}
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: others.length ? '0.35rem' : 0, paddingTop: others.length ? '0.5rem' : 0, borderTop: others.length ? '1px solid ' + C.border : 'none' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <UserPlus size={14} strokeWidth={2.2} color={C.textMuted} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  value={newName}
                  onChange={e => { setNewName(e.target.value); setNameErr(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPerson(); } }}
                  placeholder="Agregar persona nueva"
                  maxLength={30}
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid ' + (nameErr ? C.danger : C.border), borderRadius: '0.6rem', padding: '0.5rem 0.6rem 0.5rem 1.9rem', fontSize: '0.82rem', outline: 'none', fontFamily: F, color: C.navy, background: C.surface }}
                />
              </div>
              <button onClick={addPerson} disabled={!newName.trim()}
                style={{ flexShrink: 0, padding: '0 0.8rem', borderRadius: '0.6rem', border: 'none', background: newName.trim() ? C.navy : C.border, color: newName.trim() ? C.onNavy : C.textMuted, fontWeight: 800, fontSize: '0.8rem', cursor: newName.trim() ? 'pointer' : 'default', fontFamily: F, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Plus size={14} strokeWidth={2.8} />Agregar
              </button>
            </div>
            {nameErr && <p style={{ fontSize: '0.7rem', color: C.danger, margin: '0.35rem 0.2rem 0' }}>{nameErr}</p>}
          </div>
        )}

        {/* Estrategia */}
        <p style={{ fontSize: '0.78rem', color: C.textMuted, fontWeight: 700, margin: '0 0 0.4rem' }}>Estrategia</p>
        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1rem' }}>
          {STRATS.map(s => {
            const active = strategy === s.key;
            return (
              <button key={s.key} onClick={() => pickStrategy(s.key)}
                style={{ flex: 1, padding: '0.45rem 0', borderRadius: '0.7rem', border: '1.5px solid ' + (active ? C.navy : C.border), background: active ? C.navy : 'transparent', color: active ? C.onNavy : C.navy, fontWeight: active ? 800 : 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: F }}>
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Ayuda de la estrategia */}
        {strategy !== 'iguales' && (
          <p style={{ fontSize: '0.68rem', color: C.textMuted, margin: '-0.6rem 0 0.9rem', lineHeight: 1.35 }}>
            {strategy === 'montos'      && 'Monto exacto de cada uno (deben sumar el total).'}
            {strategy === 'porcentajes' && 'Porcentaje de cada uno (idealmente suman 100).'}
            {strategy === 'shares'      && 'Partes relativas: ej. 2 y 1 → uno paga 2/3 y el otro 1/3.'}
          </p>
        )}

        {/* Barra deslizante para el caso clásico de 2 personas en % */}
        {selected.length === 2 && strategy === 'porcentajes' && (() => {
          const a = selected[0], b = selected[1];
          const pa = Math.max(0, Math.min(100, Math.round(safeN(values[a]))));
          const sliderBg = `linear-gradient(to right, ${C.navy} 0%, ${C.navy} ${pa}%, ${C.accent} ${pa}%, ${C.accent} 100%)`;
          return (
            <div style={{ marginBottom: '1rem' }}>
              <style>{`.split-slider{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:999px;outline:none;cursor:pointer}.split-slider::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#fff;border:3px solid ${C.navy};box-shadow:0 2px 6px rgba(0,0,0,.2);cursor:pointer}.split-slider::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#fff;border:3px solid ${C.navy};cursor:pointer}`}</style>
              <input type="range" min={0} max={100} value={pa} className="split-slider" style={{ background: sliderBg }}
                onChange={e => { const v = Number(e.target.value); setValues(prev => ({ ...prev, [a]: String(v), [b]: String(100 - v) })); }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: C.textMuted, marginTop: '0.35rem', fontWeight: 700 }}>
                <span>{a} · {pa}%</span><span>{b} · {100 - pa}%</span>
              </div>
            </div>
          );
        })()}

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
