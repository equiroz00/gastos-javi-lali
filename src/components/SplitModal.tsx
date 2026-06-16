// ── components/SplitModal.tsx ─────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { X, User } from 'lucide-react';
import { C, F } from '../constants';
import { fmt, safeN, round2, divideAmount } from '../lib/helpers';

interface SplitModalProps {
  amount: number;
  currency: string;
  paidBy: string;
  javiAmount: number;
  laliAmount: number;
  onConfirm: (paidBy: string, javiAmount: number, laliAmount: number, responsible: string) => void;
  onCancel: () => void;
}

export default function SplitModal({ amount, currency, paidBy: initPaidBy, javiAmount: initJavi, laliAmount: initLali, onConfirm, onCancel }: SplitModalProps) {
  const total = round2(safeN(amount));

  // Derive initial percentage from existing amounts
  const initPct = total > 0 ? Math.round((initJavi / total) * 100) : 50;

  const [paidBy, setPaidBy]     = useState(initPaidBy || 'Javi');
  const [javiPct, setJaviPct]   = useState(initPct);
  const [javiAmt, setJaviAmt]   = useState(String(round2(initJavi)));
  const [laliAmt, setLaliAmt]   = useState(String(round2(initLali)));
  const [manualMode, setManualMode] = useState(false);

  // Sync slider → amounts. divideAmount garantiza suma exacta y cero exacto
  // en los extremos (sin centavos remanentes).
  useEffect(() => {
    if (!manualMode) {
      const { javiAmount, laliAmount } = divideAmount(total, javiPct);
      setJaviAmt(String(javiAmount));
      setLaliAmt(String(laliAmount));
    }
  }, [javiPct, total, manualMode]);

  function onJaviAmtChange(val: string) {
    setManualMode(true);
    setJaviAmt(val);
    const j = round2(safeN(val));
    const l = round2(Math.max(0, total - j));
    setLaliAmt(String(l));
    if (total > 0) setJaviPct(Math.round((j / total) * 100));
  }

  function onLaliAmtChange(val: string) {
    setManualMode(true);
    setLaliAmt(val);
    const l = round2(safeN(val));
    const j = round2(Math.max(0, total - l));
    setJaviAmt(String(j));
    if (total > 0) setJaviPct(Math.round((j / total) * 100));
  }

  function onSliderChange(val: number) {
    setManualMode(false);
    setJaviPct(val);
  }

  function handleConfirm() {
    const j = round2(safeN(javiAmt));
    const l = round2(safeN(laliAmt));
    // Tolerancia de 1 centavo para detectar los extremos pese a decimales.
    if (Math.abs(j - total) < 0.01) { onConfirm(paidBy, total, 0, 'Javi'); return; }
    if (Math.abs(l - total) < 0.01) { onConfirm(paidBy, 0, total, 'Lali'); return; }
    // División mixta: el lado Lali absorbe el remanente para sumar exacto.
    onConfirm(paidBy, j, round2(total - j), 'Ambos');
  }

  const laliPct = 100 - javiPct;
  const cur = currency || 'ARS';

  const inpStyle: React.CSSProperties = {
    width: '100%', border: '1px solid ' + C.border, borderRadius: '0.65rem',
    padding: '0.55rem 0.75rem', fontSize: '0.88rem', outline: 'none',
    boxSizing: 'border-box', fontFamily: F, color: C.navy, background: C.surface,
    textAlign: 'center',
  };

  // Slider track fill
  const sliderBg = `linear-gradient(to right, ${C.navy} 0%, ${C.navy} ${javiPct}%, ${C.accent} ${javiPct}%, ${C.accent} 100%)`;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background:C.surface, borderRadius:'1.5rem 1.5rem 0 0', padding:'1.5rem 1.25rem 2rem', width:'100%', maxWidth:'480px', boxShadow:'0 -8px 32px rgba(0,0,0,0.25)', fontFamily:F }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
          <h3 style={{ fontWeight:900, color:C.navy, fontSize:'1rem', margin:0 }}>¿Cómo se divide?</h3>
          <button onClick={onCancel} style={{ background:'none', border:'none', cursor:'pointer', color:C.textMuted, display:'flex', padding:'0.25rem' }}>
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Who paid */}
        <div style={{ marginBottom:'1.25rem' }}>
          <p style={{ fontSize:'0.78rem', color:C.textMuted, fontWeight:700, margin:'0 0 0.5rem' }}>¿Quién pagó?</p>
          <div style={{ display:'flex', gap:'0.5rem' }}>
            {['Javi', 'Lali'].map(u => (
              <button key={u} onClick={() => setPaidBy(u)}
                style={{ flex:1, padding:'0.6rem', borderRadius:'0.75rem', border:'2px solid', cursor:'pointer', fontFamily:F, fontWeight:700, fontSize:'0.85rem', transition:'all 0.15s',
                  background: paidBy === u ? (u === 'Javi' ? C.navy : C.accent) : 'transparent',
                  borderColor: paidBy === u ? (u === 'Javi' ? C.navy : C.accent) : C.border,
                  color: paidBy === u ? (u === 'Javi' ? C.onNavy : C.white) : C.navy,
                }}>
                {u === 'Javi' ? '👨 ' : '👩 '}{u}
              </button>
            ))}
          </div>
        </div>

        {/* Slider */}
        <div style={{ marginBottom:'1.25rem' }}>
          <p style={{ fontSize:'0.78rem', color:C.textMuted, fontWeight:700, margin:'0 0 0.85rem' }}>Porcentaje de responsabilidad</p>

          {/* User icons + percentages */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
            <div style={{ textAlign:'center', minWidth:'60px' }}>
              <div style={{ background:C.navy, borderRadius:'50%', width:'36px', height:'36px', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 0.25rem' }}>
                <User size={18} color={C.onNavy} strokeWidth={1.8} />
              </div>
              <div style={{ fontSize:'0.72rem', fontWeight:700, color:C.navy }}>Javi</div>
              <div style={{ fontSize:'1rem', fontWeight:900, color:C.navy }}>{javiPct}%</div>
              <div style={{ fontSize:'0.65rem', color:C.textMuted }}>{fmt(safeN(javiAmt), cur)}</div>
            </div>

            {/* Slider itself */}
            <div style={{ flex:1, margin:'0 1rem' }}>
              <style>{`
                .split-slider { -webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:999px; outline:none; cursor:pointer; }
                .split-slider::-webkit-slider-thumb { -webkit-appearance:none; width:22px; height:22px; border-radius:50%; background:white; border:3px solid ${C.navy}; box-shadow:0 2px 6px rgba(0,0,0,0.2); cursor:pointer; }
                .split-slider::-moz-range-thumb { width:22px; height:22px; border-radius:50%; background:white; border:3px solid ${C.navy}; cursor:pointer; }
              `}</style>
              <input
                type="range" min={0} max={100} value={javiPct}
                onChange={e => onSliderChange(Number(e.target.value))}
                className="split-slider"
                style={{ background: sliderBg }}
              />
            </div>

            <div style={{ textAlign:'center', minWidth:'60px' }}>
              <div style={{ background:C.accent, borderRadius:'50%', width:'36px', height:'36px', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 0.25rem' }}>
                <User size={18} color={C.white} strokeWidth={1.8} />
              </div>
              <div style={{ fontSize:'0.72rem', fontWeight:700, color:C.accent }}>Lali</div>
              <div style={{ fontSize:'1rem', fontWeight:900, color:C.accent }}>{laliPct}%</div>
              <div style={{ fontSize:'0.65rem', color:C.textMuted }}>{fmt(safeN(laliAmt), cur)}</div>
            </div>
          </div>

          {/* Quick presets */}
          <div style={{ display:'flex', gap:'0.4rem', justifyContent:'center' }}>
            {[[100,0,'Solo Javi'],[50,50,'50/50'],[0,100,'Solo Lali']].map(([j,l,label]) => {
              const active = javiPct === j;
              return (
                <button key={String(label)} onClick={() => { setManualMode(false); setJaviPct(Number(j)); }}
                  style={{ padding:'0.25rem 0.65rem', fontSize:'0.7rem', borderRadius:'999px', border:'1px solid', cursor:'pointer', fontFamily:F,
                    background: active ? C.navy : 'transparent', borderColor: active ? C.navy : C.border,
                    color: active ? C.onNavy : C.navy, fontWeight: active ? 800 : 500 }}>
                  {String(label)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Manual input */}
        <div style={{ background:C.bg, borderRadius:'1rem', padding:'0.85rem', border:'1px solid '+C.border, marginBottom:'1.25rem' }}>
          <p style={{ fontSize:'0.78rem', color:C.textMuted, fontWeight:700, margin:'0 0 0.65rem' }}>División personalizada</p>
          <div style={{ display:'flex', gap:'0.75rem', alignItems:'center' }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'0.68rem', color:C.navy, fontWeight:700, marginBottom:'0.3rem', textAlign:'center' }}>👨 Javi</div>
              <input type="number" style={inpStyle} value={javiAmt}
                onChange={e => onJaviAmtChange(e.target.value)}
                placeholder="0" />
            </div>
            <div style={{ fontSize:'0.9rem', color:C.textMuted, fontWeight:700, flexShrink:0 }}>+</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'0.68rem', color:C.accent, fontWeight:700, marginBottom:'0.3rem', textAlign:'center' }}>👩 Lali</div>
              <input type="number" style={{ ...inpStyle, borderColor:C.accent }} value={laliAmt}
                onChange={e => onLaliAmtChange(e.target.value)}
                placeholder="0" />
            </div>
            <div style={{ fontSize:'0.9rem', color:C.textMuted, fontWeight:700, flexShrink:0 }}>=</div>
            <div style={{ textAlign:'center', flexShrink:0 }}>
              <div style={{ fontSize:'0.68rem', color:C.textMuted, marginBottom:'0.3rem' }}>Total</div>
              <div style={{ fontWeight:800, color:C.navy, fontSize:'0.9rem' }}>{fmt(total, cur)}</div>
            </div>
          </div>
        </div>

        {/* Confirm */}
        <button onClick={handleConfirm}
          style={{ width:'100%', padding:'0.9rem', background:C.gradMain, color:C.white, border:'none', borderRadius:'1rem', fontWeight:900, fontSize:'0.95rem', cursor:'pointer', fontFamily:F }}>
          Confirmar división
        </button>
      </div>
    </div>
  );
}
