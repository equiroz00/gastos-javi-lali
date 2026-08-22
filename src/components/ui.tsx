// ── components/ui.tsx ─────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import {
  Home, ShoppingCart, KeyRound, Lightbulb, Bus, Clapperboard, Users, Sparkles,
  Dumbbell, Pill, Baby, Shirt, UtensilsCrossed, Plane, PawPrint, Gift, GraduationCap,
  Wallet, Tag, Trash2, ArrowRightLeft,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { C, F, V, MONO, FS, CHART_TYPES } from '../constants';
import { fmt, safeN, catLb, todayStr, genId, allParticipants } from '../lib/helpers';
import { usePeople } from '../lib/queries';
import useAppStore from '../store/useAppStore';

// ── Category → Lucide icon mapping (keyword based, with fallback) ─────────────
const CAT_ICON_MAP: Array<[RegExp, LucideIcon]> = [
  [/hogar|casa|limpieza/i, Home],
  [/aliment|comida|super|mercado|verdul|carnic|almac[eé]n/i, ShoppingCart],
  [/restaur|comer|caf[eé]|salida.?gastron/i, UtensilsCrossed],
  [/arriend|alquil|renta|expensa/i, KeyRound],
  [/servici|luz|agua|gas|electri|internet|cable|tel[eé]fono|wifi/i, Lightbulb],
  [/transp|nafta|combust|colectivo|sube|taxi|uber|peaje|estacion|auto/i, Bus],
  [/entreten|cine|pel[ií]cul|juego|stream|netflix|spotify|m[uú]sica/i, Clapperboard],
  [/amig|social|fiesta|reuni/i, Users],
  [/cuidado|personal|belleza|peluqu|spa|cosm/i, Sparkles],
  [/gimnas|gym|deporte|fitness|entrenam/i, Dumbbell],
  [/farmac|salud|m[eé]dic|medicin|remedio|hospital|obra.?social/i, Pill],
  [/hijit|hij[oa]|beb[eé]|ni[ñn]|guarder|jard[ií]n/i, Baby],
  [/ropa|vestir|calzado|zapat|indument/i, Shirt],
  [/viaj|vacacion|vuelo|hotel/i, Plane],
  [/mascot|perro|gato|veterin/i, PawPrint],
  [/regalo|gift|cumple/i, Gift],
  [/educ|curso|colegio|universidad|estudi|libro/i, GraduationCap],
  [/ahorro|inversi|cuenta/i, Wallet],
];

export function catIconFor(category?: string): LucideIcon {
  const label = (catLb(category) || '') + ' ' + (category || '');
  for (const [re, icon] of CAT_ICON_MAP) {
    if (re.test(label)) return icon;
  }
  return Tag;
}

interface CatIconProps {
  category?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: React.CSSProperties;
}

export function CatIcon({ category, size, strokeWidth, color, style }: CatIconProps) {
  const Icon = catIconFor(category);
  return <Icon size={size || 18} strokeWidth={strokeWidth || 2} color={color || C.navy} style={style} />;
}

// ── Javi / Lali marker — colored dot (navy = Javi, accent = Lali) ─────────────
export function UserDot({ user, style }: { user: string; style?: React.CSSProperties }) {
  const isJavi = user === 'Javi';
  return <span style={{ display:'inline-block', width:'7px', height:'7px', borderRadius:'50%', background:isJavi ? C.navy : C.accent, flexShrink:0, ...style }} />;
}

// Contenedor de bloque. Es el punto donde las dos direcciones se separan, y por
// eso concentra la diferencia: como todas las pantallas ya envuelven sus bloques
// en <Card>, cambiar la variante las reescribe a todas sin tocarlas una por una.
//   panel  → tarjeta: superficie, borde de 1px y radio 10 (mockups de 2b/3b).
//   cuenta → filete: sin caja ni fondo, el bloque se separa por una regla
//            inferior y respira con el ancho completo (mockups de 2a/3a).
export function Card({ style, children }: { style?: React.CSSProperties; children?: React.ReactNode }) {
  const flat = V.surfaceMode === 'flat';
  const base: React.CSSProperties = flat
    ? { background:'transparent', border:'none', borderBottom:'1px solid '+C.border, borderRadius:0, padding:'0.15rem 0 1rem' }
    : { background:C.surface, borderRadius:V.radius+'px', padding:'1rem', border:'1px solid '+C.border };
  return <div style={{ ...base, ...style }}>{children}</div>;
}

// Encabezado de sección.
//   cuenta → versalita sobre el ink con FILETE fuerte debajo: es la firma de la
//            dirección "Estado de cuenta", que no usa cajas para agrupar.
//   panel  → etiqueta chica y apagada, sin regla (la caja ya agrupa).
export function SectionLabel({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  const strong = V.sectionRule === 'strong';
  return (
    <div style={{
      fontSize:V.sectionSize+'px', fontWeight:700, letterSpacing:V.sectionLS,
      textTransform:'uppercase', fontFamily:F,
      color: strong ? C.navy : C.textMuted,
      borderBottom: strong ? '1px solid '+C.navy : 'none',
      paddingBottom: strong ? '0.55rem' : 0,
      margin: strong ? '0 0 0.15rem' : '0 0 0.4rem 0.15rem',
      ...style,
    }}>
      {children}
    </div>
  );
}

// Fila de lista separada por hairline. En 'cuenta' las filas son el material
// principal (no hay tarjetas); en 'panel' son filas de tabla densa.
export function Row({ last, style, children }: { last?: boolean; style?: React.CSSProperties; children?: React.ReactNode }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:'0.6rem',
      padding:V.rowPadY+' 0',
      borderBottom: V.rowRule && !last ? '1px solid '+C.border : 'none',
      ...style,
    }}>
      {children}
    </div>
  );
}

// Banda de acento con la cifra protagonista — exclusiva de 'cuenta'. En 'panel'
// devuelve null y la pantalla usa su propio titular, porque esa dirección no
// tiene bandas a todo el ancho.
export function AmountBand({ eyebrow, amount, children }: { eyebrow?: React.ReactNode; amount: React.ReactNode; children?: React.ReactNode }) {
  if (!V.heroBand) return null;
  return (
    <div style={{ background:C.navy, padding:'1.6rem 1.35rem 1.4rem', color:C.onNavy }}>
      {eyebrow ? (
        <div style={{ fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:C.onNavy+'99', fontFamily:F }}>{eyebrow}</div>
      ) : null}
      <div style={{ fontFamily:MONO, fontSize:FS.hero, fontWeight:700, letterSpacing:'-0.03em', marginTop:'0.3rem' }}>{amount}</div>
      {children}
    </div>
  );
}

// Anillo donut con agujero central — firma visual de Budget Flow. Los segmentos
// se dibujan con conic-gradient en proporción a su valor; el centro usa el color
// de superficie del tema (queda bien en claro y oscuro).
export function DonutRing({ segments, size = 84, thickness = 12, children }: {
  segments: Array<{ value: number; color: string }>;
  size?: number; thickness?: number; children?: React.ReactNode;
}) {
  const total = segments.reduce((s, x) => s + (x.value > 0 ? x.value : 0), 0) || 1;
  let acc = 0;
  const stops = segments.map(seg => {
    const start = (acc / total) * 100;
    acc += Math.max(0, seg.value);
    const end = (acc / total) * 100;
    return `${seg.color} ${start}% ${end}%`;
  });
  const hole = size - thickness * 2;
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:`conic-gradient(${stops.join(',')})`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <div style={{ width:hole, height:hole, borderRadius:'50%', background:C.surface, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', lineHeight:1.15 }}>
        {children}
      </div>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || 'Buscar...'}
      style={{ width:'100%', border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.5rem 0.75rem', fontSize:'0.82rem', outline:'none', fontFamily:F, color:C.navy, background:C.surface, boxSizing:'border-box', marginBottom:'0.6rem' }}
    />
  );
}

interface ScrollFilterProps {
  items: string[];
  selected: string | string[];
  onSelect: (item: string) => void;
  multi?: boolean;
}

export function ScrollFilter({ items = [], selected, onSelect, multi = false }: ScrollFilterProps) {
  return (
    <div style={{ overflowX:'auto', paddingBottom:'6px', marginBottom:'0.6rem' }}>
      <div style={{ display:'flex', gap:'0.4rem', width:'max-content' }}>
        {items.map(p => {
          const isActive = multi ? (selected as string[]).indexOf(p) >= 0 : selected === p;
          return (
            <button
              key={p}
              onClick={() => onSelect(p)}
              style={{ flexShrink:0, padding:'0.35rem 0.75rem', borderRadius:'999px', border:'1px solid', fontSize:'0.75rem', cursor:'pointer', fontWeight:isActive ? 800 : 500, fontFamily:F, background:isActive ? C.navy : 'transparent', borderColor:isActive ? C.navy : C.border, color:isActive ? C.onNavy : C.navy, whiteSpace:'nowrap' }}
            >
              {multi ? (isActive ? '✓ ' : '') + p : p}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SegBtnProps {
  active?: boolean;
  color?: string;
  onClick: () => void;
  children?: React.ReactNode;
}

export function SegBtn({ active, color, onClick, children }: SegBtnProps) {
  const bg = color || C.navy;
  // Sobre fondo navy el texto activo usa onNavy; sobre otros colores, blanco.
  const activeText = bg === C.navy ? C.onNavy : C.white;
  return (
    <button
      onClick={onClick}
      style={{ flex:1, padding:'0.45rem 0.2rem', fontSize:'0.72rem', borderRadius:'0.75rem', border:'1px solid', cursor:'pointer', fontFamily:F, fontWeight:active ? 800 : 500, lineHeight:1.3, background:active ? bg : 'transparent', borderColor:active ? bg : C.border, color:active ? activeText : C.navy }}
    >
      {children}
    </button>
  );
}

export function ChartSelector({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  return (
    <div style={{ display:'flex', gap:'0.3rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
      {CHART_TYPES.map(t => {
        const active = value === t;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            style={{ padding:'0.25rem 0.65rem', fontSize:'0.7rem', borderRadius:'999px', border:'1px solid', cursor:'pointer', fontFamily:F, fontWeight:active ? 800 : 500, background:active ? C.navy : 'transparent', borderColor:active ? C.navy : C.border, color:active ? C.onNavy : C.navy }}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

export function Toast() {
  const toast = useAppStore(s => s.toast);
  if (!toast) return null;
  return (
    <div style={{ position:'fixed', bottom:'5.5rem', left:'50%', transform:'translateX(-50%)', zIndex:200, maxWidth:'340px', width:'calc(100% - 2rem)', pointerEvents:'none' }}>
      <div style={{ background:C.navy, color:C.onNavy, borderRadius:'1rem', padding:'0.75rem 1rem', display:'flex', alignItems:'center', gap:'0.75rem', boxShadow:'0 8px 24px rgba(0,0,0,0.3)', fontFamily:F }}>
        <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:C.onNavy + '22', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <CatIcon category={toast.category} size={18} color={C.onNavy} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:'0.85rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{toast.description}</div>
          <div style={{ fontSize:'0.75rem', opacity:0.75, marginTop:'0.1rem' }}>{toast.amount} · guardado</div>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog() {
  const pendingDelete    = useAppStore(s => s.pendingDelete);
  const setPendingDelete = useAppStore(s => s.setPendingDelete);
  const confirmDelete    = useAppStore(s => s.confirmDelete);
  if (!pendingDelete) return null;
  const e = pendingDelete.expense;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem' }}>
      <div style={{ background:C.surface, borderRadius:'1.25rem', padding:'1.5rem', maxWidth:'340px', width:'100%', boxShadow:'0 8px 32px rgba(0,0,0,0.25)', fontFamily:F }}>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:'0.75rem' }}>
          <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:'#fde8ec', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Trash2 size={22} strokeWidth={2} color="#c0314f" />
          </div>
        </div>
        <h3 style={{ fontWeight:900, color:C.navy, fontSize:'1rem', margin:'0 0 0.5rem', textAlign:'center' }}>¿Eliminar este gasto?</h3>
        <div style={{ background:C.bg, borderRadius:'0.75rem', padding:'0.75rem', marginBottom:'1rem', border:'1px solid '+C.border }}>
          <div style={{ fontWeight:700, color:C.navy, fontSize:'0.88rem', marginBottom:'0.25rem' }}>{e.description || 'Sin descripción'}</div>
          <div style={{ fontSize:'0.8rem', color:C.textMuted }}>{e.date} · {fmt(safeN(e.amount), e.currency || 'ARS')}</div>
          <div style={{ fontSize:'0.8rem', color:C.textMuted }}>{catLb(e.category)}</div>
        </div>
        <p style={{ fontSize:'0.75rem', color:C.textMuted, textAlign:'center', margin:'0 0 1rem' }}>Esta acción no se puede deshacer.</p>
        <div style={{ display:'flex', gap:'0.5rem' }}>
          <button onClick={() => setPendingDelete(null)} style={{ flex:1, padding:'0.75rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.navy, fontWeight:700, fontSize:'0.88rem', cursor:'pointer', fontFamily:F }}>Cancelar</button>
          <button onClick={confirmDelete} style={{ flex:1, padding:'0.75rem', background:'#c0314f', border:'none', borderRadius:'0.75rem', color:C.white, fontWeight:700, fontSize:'0.88rem', cursor:'pointer', fontFamily:F }}>Sí, eliminar</button>
        </div>
      </div>
    </div>
  );
}

export function PaymentModal() {
  const payModal       = useAppStore(s => s.payModal);
  const setPayModal    = useAppStore(s => s.setPayModal);
  const confirmPayment = useAppStore(s => s.confirmPayment);
  const people         = usePeople();
  const participants   = allParticipants(people);
  // Hooks must always be called unconditionally — before any early return
  const currency = (payModal && payModal.currency) || 'ARS';
  const [from, setFrom] = useState('Lali');
  const [to, setTo]     = useState('Javi');
  const [amt, setAmt]   = useState('');
  const [date, setDate] = useState(todayStr());
  const [err, setErr]   = useState('');
  // Precarga desde la transferencia sugerida al abrir/cambiar el modal.
  useEffect(() => {
    if (payModal) {
      setFrom(payModal.from || 'Lali');
      setTo(payModal.to || 'Javi');
      const a = Math.abs(safeN(payModal.amount));
      setAmt(a > 0 ? String(Math.round(a)) : '');
      setErr('');
    }
  }, [payModal]);
  if (!payModal) return null;

  function submit() {
    if (!amt || parseFloat(amt) <= 0) { setErr('Ingresá un monto válido.'); return; }
    if (from === to) { setErr('Elegí dos personas distintas.'); return; }
    confirmPayment({
      id: genId('pay'), date, amount: parseFloat(amt), currency,
      from, to, period: payModal!.period || undefined,
      registeredAt: new Date().toISOString(),
    });
  }

  const inp: React.CSSProperties = { width:'100%', border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.75rem', fontSize:'0.9rem', outline:'none', boxSizing:'border-box', fontFamily:F, color:C.navy, background:C.surface };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem' }}>
      <div style={{ background:C.surface, borderRadius:'1.25rem', padding:'1.5rem', maxWidth:'340px', width:'100%', boxShadow:'0 8px 32px rgba(0,0,0,0.25)', fontFamily:F }}>
        <h3 style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:900, color:C.navy, fontSize:'1rem', margin:'0 0 0.25rem' }}>
          <ArrowRightLeft size={17} strokeWidth={2.3} color={C.accent} />Registrar pago
        </h3>
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'flex-end', margin:'0 0 1rem' }}>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:'0.72rem', color:C.textMuted, fontWeight:700, display:'block', marginBottom:'0.25rem' }}>Paga</label>
            <select value={from} onChange={e => setFrom(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
              {participants.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <span style={{ paddingBottom:'0.6rem', color:C.textMuted, fontWeight:700 }}>→</span>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:'0.72rem', color:C.textMuted, fontWeight:700, display:'block', marginBottom:'0.25rem' }}>a</label>
            <select value={to} onChange={e => setTo(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
              {participants.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <label style={{ fontSize:'0.8rem', color:C.textMuted, fontWeight:700, display:'block', marginBottom:'0.3rem' }}>Monto ({currency})</label>
        <input
          style={{ ...inp, borderColor:err ? '#c0314f' : C.border, marginBottom:'0.1rem' }}
          type="number" value={amt}
          onChange={e => { setAmt(e.target.value); setErr(''); }}
          placeholder="0"
        />
        {err
          ? <p style={{ color:C.danger, fontSize:'0.7rem', margin:'0.1rem 0 0.5rem' }}>⚠ {err}</p>
          : <div style={{ height:'0.65rem' }} />}
        <label style={{ fontSize:'0.8rem', color:C.textMuted, fontWeight:700, display:'block', marginBottom:'0.3rem', marginTop:'0.5rem' }}>Fecha</label>
        <input style={{ ...inp, marginBottom:'1rem' }} type="date" value={date} onChange={e => setDate(e.target.value)} />
        <div style={{ display:'flex', gap:'0.5rem' }}>
          <button onClick={() => setPayModal(null)} style={{ flex:1, padding:'0.75rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'0.75rem', color:C.navy, fontWeight:700, fontSize:'0.88rem', cursor:'pointer', fontFamily:F }}>Cancelar</button>
          <button onClick={submit} style={{ flex:1, padding:'0.75rem', background:C.gradMain, border:'none', borderRadius:'0.75rem', color:C.white, fontWeight:700, fontSize:'0.88rem', cursor:'pointer', fontFamily:F }}>Registrar</button>
        </div>
      </div>
    </div>
  );
}
