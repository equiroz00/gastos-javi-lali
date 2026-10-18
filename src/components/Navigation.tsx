// ── components/Navigation.tsx ─────────────────────────────────────────────────
// Navegación de la app: barra inferior (móvil), menú lateral plegable (web) y
// botón flotante de "Agregar". Es la misma en las dos variantes de interfaz:
// las variantes se distinguen por el contenido (filetes vs. tarjetas), no por
// el menú.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Home, BarChart2, Wallet, ClipboardList, Settings2, Plus, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { C, F, V, SHELL_MAXW } from '../constants';
import { bandColors, contentBg } from './ui';

export interface NavItem { id: string; label: string; Icon: LucideIcon; }

// "Agregar" ya no es una pestaña: es el botón flotante (AddFab).
export const NAV_ITEMS: NavItem[] = [
  { id:'dashboard', label:'Inicio',    Icon:Home          },
  { id:'stats',     label:'Stats',     Icon:BarChart2     },
  { id:'personal',  label:'Personal',  Icon:Wallet        },
  { id:'history',   label:'Historial', Icon:ClipboardList },
  { id:'settings',  label:'Config',    Icon:Settings2     },
];

// Fondo del área de contenido (definido en ui.tsx, lo usa también la grilla).
// La pestaña activa del menú web se pinta de este color para "fundirse".
export { contentBg };

// ── Barra inferior (móvil) ────────────────────────────────────────────────────
// La pestaña activa sube a una burbuja que asoma sobre la barra, abrazada por
// una "colina" de la misma barra con un anillo transparente entre ambas.
//
// Se dibuja con SVG: la barra + la colina forman una figura, y encima va un
// anillo del color de acento que separa la burbuja de la colina. Colina, anillo
// y burbuja se desplazan juntos con una transición de `transform`, que funciona
// igual en Chrome y Safari.
//
// El anillo se PINTA (no es un recorte transparente): en la referencia funciona
// porque detrás hay un azul fuerte, pero acá el fondo de la app suele ser
// blanco, como la barra — un anillo transparente desaparecía y la burbuja
// quedaba como un círculo blanco suelto. Pintado con el acento, además marca
// con claridad en qué pestaña se está.
const BAR_H = 64;   // alto de la barra
const TOP   = 40;   // espacio por encima de la barra para la colina
const R_BUB = 26;   // radio de la burbuja
const GAP   = 5;    // ancho del anillo transparente
const R_HILL = 38;  // radio del arco superior de la colina (= burbuja + anillo + borde)
// Margen lateral interno. Calculado para que, con la primera o la última
// pestaña activa, el pie de la colina caiga donde ya terminó la curva de la
// esquina de la barra (radio 18). Con menos margen la colina se recortaba
// contra el borde y la barra perdía su esquina redondeada.
const PAD   = 32;
const EASE  = 'transform 0.34s cubic-bezier(.3,.7,.2,1)';

// Colina centrada en x=0, con y relativa al borde superior de la barra. Arco
// concéntrico a la burbuja (borde parejo de R_HILL - R_BUB - GAP) y curvas en S
// que bajan tangentes hasta la barra.
const ax = +(R_HILL * Math.cos(Math.PI / 6)).toFixed(1); // 32.9
const ay = +(R_HILL * Math.sin(Math.PI / 6)).toFixed(1); // 19
// Pie de la colina a 48px del centro (más angosta que antes): sumado al margen
// PAD, deja la colina dentro de la parte recta de la barra.
const FOOT = 48;
const HILL_PATH =
  `M -${FOOT} 0 C -${FOOT - 11} 0 -${(ax + 5).toFixed(1)} -10.3 -${ax} -${ay} ` +
  `A ${R_HILL} ${R_HILL} 0 0 1 ${ax} -${ay} ` +
  `C ${(ax + 5).toFixed(1)} -10.3 ${FOOT - 11} 0 ${FOOT} 0 Z`;

export function MobileNav({ view, onSelect }: { view: string; onSelect: (id: string) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(360);

  // La geometría de la colina está en píxeles, así que hace falta el ancho real.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setW(el.getBoundingClientRect().width || 360);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const idx    = Math.max(0, NAV_ITEMS.findIndex(it => it.id === view));
  const hasActive = NAV_ITEMS.some(it => it.id === view);
  const slot   = (w - PAD * 2) / NAV_ITEMS.length;
  const cx     = PAD + slot * (idx + 0.5);
  const Active = NAV_ITEMS[idx].Icon;
  // En el tema Oscuro la sombra no se ve sobre negro y la barra (surface) se
  // confundía con el fondo: se usa un tono más claro para que se despegue.
  const barFill = C.dark ? C.beige : C.surface;

  return (
    <nav
      ref={wrapRef}
      aria-label="Navegación principal"
      style={{
        position:'fixed', left:'50%', transform:'translateX(-50%)', zIndex:20,
        bottom:'calc(10px + env(safe-area-inset-bottom))',
        width:'calc(100% - 24px)', maxWidth:'calc(' + SHELL_MAXW + ' - 24px)',
        height:TOP + BAR_H, fontFamily:F, pointerEvents:'none',
      }}
    >
      <svg width={w} height={TOP + BAR_H} style={{ position:'absolute', inset:0, overflow:'visible', filter:'drop-shadow(0 6px 18px rgba(0,0,0,0.16))' }} aria-hidden="true">
        <defs>
          {/* La colina no puede asomar por fuera de los costados de la barra. */}
          <clipPath id="navclip"><rect x={0} y={0} width={w} height={TOP + BAR_H} /></clipPath>
        </defs>
        <g clipPath="url(#navclip)">
          <rect x={0} y={TOP} width={w} height={BAR_H} rx={18} fill={barFill} />
          {hasActive && (
            <path d={HILL_PATH} fill={barFill} style={{ transform:`translate(${cx}px, ${TOP}px)`, transition:EASE }} />
          )}
        </g>
        {hasActive && (
          <circle r={R_BUB + GAP} cx={0} cy={0} fill={C.accent}
            style={{ transform:`translate(${cx}px, ${TOP}px)`, transition:EASE }} />
        )}
      </svg>

      {/* Burbuja con el ícono activo: relleno tenue + trazo de acento, como en la referencia. */}
      {hasActive && (
        <div
          aria-hidden="true"
          style={{
            position:'absolute', left:0, top:TOP - R_BUB, width:R_BUB * 2, height:R_BUB * 2,
            borderRadius:'50%', background:barFill, display:'flex', alignItems:'center', justifyContent:'center',
            transform:`translateX(${cx - R_BUB}px)`, transition:EASE,
            boxShadow:'0 4px 12px rgba(0,0,0,0.12)',
          }}
        >
          <Active size={24} strokeWidth={2} color={C.accent} fill={C.accent + '38'} />
        </div>
      )}

      <div style={{ position:'absolute', left:PAD, right:PAD, top:TOP, height:BAR_H, display:'flex', pointerEvents:'auto' }}>
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = id === view;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              aria-current={active ? 'page' : undefined}
              style={{
                flex:1, border:'none', background:'none', cursor:'pointer', fontFamily:F,
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end',
                gap:'0.25rem', padding:'0 0 0.6rem', minWidth:0,
              }}
            >
              {/* El ícono de la activa vive en la burbuja; acá se deja el hueco
                  para que todas las etiquetas queden alineadas. */}
              <Icon size={22} strokeWidth={1.8} color={C.textMuted} style={{ opacity: active ? 0 : 1, transition:'opacity 0.2s' }} />
              <span style={{ fontSize:'0.64rem', lineHeight:1, color: active ? C.navy : C.textMuted, fontWeight: active ? 800 : 500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%' }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// Alto total que ocupa la barra inferior (para dejar espacio al contenido y
// ubicar el botón flotante por encima).
export const MOBILE_NAV_SPACE = 10 + BAR_H + TOP;

// ── Botón flotante "Agregar" ──────────────────────────────────────────────────
// En móvil va arriba de la barra, a la derecha, por encima de la zona donde
// puede asomar la burbuja (si la pestaña activa es la última, no choca). En web
// va abajo a la derecha. No se muestra dentro del propio formulario.
export function AddFab({ onClick, isDesktop }: { onClick: () => void; isDesktop: boolean }) {
  const size = isDesktop ? 60 : 56;
  const pos: React.CSSProperties = isDesktop
    ? { right:'28px', bottom:'28px' }
    // En pantallas anchas el contenido móvil se centra (SHELL_MAXW): el botón
    // se queda dentro de esa columna en vez de irse al borde de la ventana.
    : { right:'max(16px, calc(50% - 320px + 16px))', bottom:`calc(${MOBILE_NAV_SPACE + 12}px + env(safe-area-inset-bottom))` };
  return (
    <button
      onClick={onClick}
      aria-label="Agregar gasto"
      title="Agregar gasto"
      style={{
        position:'fixed', ...pos, zIndex:25, width:size, height:size, borderRadius:'50%',
        border:'none', background:C.accent, color:C.white, cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 8px 22px ' + C.accent + '66, 0 2px 6px rgba(0,0,0,0.18)',
      }}
    >
      <Plus size={isDesktop ? 28 : 26} strokeWidth={2.6} />
    </button>
  );
}

// ── Menú lateral (web) ────────────────────────────────────────────────────────
// Ancho con íconos y nombres, o plegado a solo íconos (se recuerda por
// dispositivo). La opción activa es una pestaña del color del contenido que se
// "funde" con él: a la derecha no tiene borde, y arriba y abajo lleva dos
// esquinas cóncavas que suavizan la unión con el panel. Es una sola pieza que
// se desliza hasta la opción elegida.
const ITEM_H   = 46;
const ITEM_GAP = 4;
const FILLET   = 14;  // radio de las esquinas cóncavas
const W_OPEN   = 220;
const W_CLOSED = 76;
const COLLAPSE_KEY = 'nav.collapsed';

function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
}

export function DesktopSidebar({ view, onSelect, currentUser }: {
  view: string; onSelect: (id: string) => void; currentUser: string | null;
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* modo privado: no se recuerda */ }
  }, [collapsed]);

  const B   = bandColors();
  const CB  = contentBg();
  const idx = NAV_ITEMS.findIndex(it => it.id === view);
  const width = collapsed ? W_CLOSED : W_OPEN;
  const TabIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      style={{
        width, flexShrink:0, background:B.bg, color:B.on, height:'100vh', position:'sticky', top:0,
        display:'flex', flexDirection:'column', fontFamily:F, transition:'width 0.25s ease', overflow:'hidden',
      }}
    >
      {/* Marca */}
      <div style={{ display:'flex', alignItems:'center', gap:'0.65rem', padding:'1.1rem 0 1.4rem', paddingLeft: collapsed ? 0 : '1.2rem', justifyContent: collapsed ? 'center' : 'flex-start', minHeight:'36px' }}>
        <div style={{ width:36, height:36, borderRadius:10, background:C.accent, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Wallet size={19} strokeWidth={2.2} color={C.white} />
        </div>
        {!collapsed && (
          <div style={{ fontWeight:800, fontSize:'1.02rem', letterSpacing:'-0.01em', whiteSpace:'nowrap' }}>Javi &amp; Lali</div>
        )}
      </div>

      {/* Opciones + pestaña activa deslizante */}
      <nav aria-label="Navegación principal" style={{ position:'relative', paddingLeft:'12px' }}>
        {idx >= 0 && (
          <div
            aria-hidden="true"
            style={{
              position:'absolute', left:'12px', right:'-1px', top:0, height:ITEM_H,
              background:CB, borderRadius:'14px 0 0 14px',
              transform:`translateY(${idx * (ITEM_H + ITEM_GAP)}px)`, transition:'transform 0.3s cubic-bezier(.3,.7,.2,1)',
            }}
          >
            <span style={{ position:'absolute', right:0, top:-FILLET, width:FILLET, height:FILLET,
              background:`radial-gradient(circle at 0 0, transparent ${FILLET}px, ${CB} ${FILLET + 0.5}px)` }} />
            <span style={{ position:'absolute', right:0, bottom:-FILLET, width:FILLET, height:FILLET,
              background:`radial-gradient(circle at 0 100%, transparent ${FILLET}px, ${CB} ${FILLET + 0.5}px)` }} />
          </div>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:ITEM_GAP, position:'relative' }}>
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = id === view;
            return (
              <button
                key={id}
                onClick={() => onSelect(id)}
                title={collapsed ? label : undefined}
                aria-current={active ? 'page' : undefined}
                style={{
                  height:ITEM_H, border:'none', background:'transparent', cursor:'pointer', fontFamily:F,
                  display:'flex', alignItems:'center', gap:'0.75rem',
                  padding: collapsed ? 0 : '0 1rem', justifyContent: collapsed ? 'center' : 'flex-start',
                  color: active ? C.navy : B.dim, fontWeight: active ? 800 : 600, fontSize:'0.86rem',
                  transition:'color 0.2s', whiteSpace:'nowrap',
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} color={active ? C.accent : B.dim} fill={active ? C.accent + '30' : 'none'} style={{ flexShrink:0 }} />
                {!collapsed && label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Pie: usuario + plegar */}
      <div style={{ marginTop:'auto', padding:'1rem 0', display:'flex', flexDirection:'column', alignItems: collapsed ? 'center' : 'stretch', gap:'0.6rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', paddingLeft: collapsed ? 0 : '1.2rem', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <span style={{ width:30, height:30, borderRadius:'50%', background:B.on + '26', color:B.on, fontSize:'0.75rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {(currentUser || '?').charAt(0)}
          </span>
          {!collapsed && <span style={{ fontSize:'0.8rem', fontWeight:600 }}>{currentUser}</span>}
        </div>
        <button
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expandir menú' : 'Plegar menú'}
          title={collapsed ? 'Expandir menú' : 'Plegar menú'}
          style={{
            alignSelf: collapsed ? 'center' : 'flex-start', marginLeft: collapsed ? 0 : '0.75rem',
            height:'34px', padding: collapsed ? 0 : '0 0.6rem', width: collapsed ? '34px' : 'auto',
            border:'none', borderRadius:'9px', background:'transparent', color:B.dim, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', gap:'0.45rem', fontFamily:F, fontSize:'0.75rem', fontWeight:600,
          }}
        >
          <TabIcon size={18} strokeWidth={2} />
          {!collapsed && 'Plegar menú'}
        </button>
      </div>
    </aside>
  );
}
