// ── src/constants.ts ──────────────────────────────────────────────────────────
import type { ThemeConfig, FontConfig, ThemeKey, FontKey } from './types';

// onNavy = color de texto/íconos cuando el FONDO es `navy`. En el tema claro
// navy es azul → texto blanco; en el oscuro navy es casi blanco (#F4F4F5) →
// texto oscuro. Usar siempre onNavy (no `white`) sobre fondos navy, si no las
// burbujas seleccionadas quedan blanco sobre blanco en el tema oscuro.
// Budget Flow: estética iOS clara (fondo gris-sistema, tarjetas blancas, planas)
// pero conservando el violeta/morado de la marca como acento principal. navy =
// violeta oscuro legible (texto + Javi), accent = malva (Lali), igual que el
// original para no perder la identidad de pareja.
export const THEMES: Record<ThemeKey, ThemeConfig> = {
  default:    { label:'Original',    emoji:'💜', bg:'#F2F3F4', surface:'#FFFFFF', navy:'#174871', accent:'#A77693', beige:'#E4DAD2', textMuted:'#8a7a85', border:'#E2D8CF', white:'#FFFFFF', onNavy:'#FFFFFF', gradMain:'linear-gradient(135deg,#174871,#A77693)', gradJavi:'linear-gradient(135deg,#174871,#1e5c9b)', gradLali:'linear-gradient(135deg,#A77693,#c490a8)', danger:'#c0314f', warn:'#b45309', ok:'#2d9e7f' },
  budgetflow: { label:'Budget Flow', emoji:'🟣', bg:'#F2F2F7', surface:'#FFFFFF', navy:'#3D2F73', accent:'#A77693', beige:'#ECECF2', textMuted:'#8A8A8E', border:'#E4E4EC', white:'#FFFFFF', onNavy:'#FFFFFF', gradMain:'linear-gradient(135deg,#6E4DC9,#A77693)', gradJavi:'linear-gradient(135deg,#4D3B9E,#6E4DC9)', gradLali:'linear-gradient(135deg,#A77693,#C490A8)', danger:'#c0314f', warn:'#b45309', ok:'#2d9e7f' },
  oscuro:     { label:'Oscuro',      emoji:'🌑', bg:'#0F1115', surface:'#191C22', navy:'#F4F4F5', accent:'#10B981', beige:'#23272F', textMuted:'#8B909B', border:'#262A32', white:'#FFFFFF', onNavy:'#0F1115', gradMain:'linear-gradient(135deg,#1A1D24,#23272F)', gradJavi:'linear-gradient(135deg,#10B981,#0E9F6E)', gradLali:'linear-gradient(135deg,#A78BFA,#8B5CF6)', danger:'#F87171', warn:'#FBBF24', ok:'#34D399' },
};

export const FONTS: Record<FontKey, FontConfig> = {
  Nunito:      { label:'Nunito',        url:'Nunito:wght@400;600;700;800;900',                  css:"'Nunito',sans-serif" },
  PlusJakarta: { label:'Plus Jakarta',  url:'Plus+Jakarta+Sans:wght@400;500;600;700;800',       css:"'Plus Jakarta Sans',sans-serif" },
  Jost:        { label:'Jost',          url:'Jost:wght@400;600;700;800;900',                    css:"'Jost',sans-serif" },
};

// Monospaced font for monetary figures — loaded always, used regardless of body font
export const MONO = "'JetBrains Mono',ui-monospace,monospace";

// ── Sistema de layout ─────────────────────────────────────────────────────────
// Escala de espaciado (múltiplos de 4px). Usar SIEMPRE estos valores para
// paddings, gaps y márgenes — nada de números sueltos "a ojo".
//   xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32
export const SP = {
  xs:  '0.25rem',
  sm:  '0.5rem',
  md:  '0.75rem',
  lg:  '1rem',
  xl:  '1.5rem',
  xxl: '2rem',
} as const;

// Ancho máximo del contenido en escritorio. Un único valor de referencia: el
// shell lo centra con margin:0 auto y cada pantalla NO vuelve a fijar su propio
// max-width (si no se contradicen entre sí).
export const MAXW = '1040px';

export const PALETTE: string[]      = ['#174871','#A77693','#4a9d8f','#d4875a','#7b5fa0','#c4965a','#5a8fa0','#a05a6e','#4a7a5a','#9a7040'];
export const DEFAULT_CATS: string[] = ['🏠 Hogar','🍕 Alimentación','🔑 Arriendo','💡 Servicios Públicos','🚌 Transporte','🎬 Entretenimiento','👥 Amigos','💆 Cuidado Personal','💪 Gimnasio','💊 Farmacia','👶 Hijito','👕 Ropa'];
export const PAY_METHODS: string[]  = ['Efectivo','TC Visa Laura','TC Master Card Laura','TC Visa Extensión','TC Master Card Extensión','Dinero en Cuenta','TC Visa Javi','TC Amex Javi','TC Amex Laura'];
export const BANKS: string[]        = ['Banco Nación','Banco Provincia','Banco Ciudad','Banco Credicoop','Galicia','Macro','Supervielle','Patagonia','Comafi','Hipotecario','Naranja X','Santander','BBVA','HSBC','Itaú','ICBC','Mercado Pago','Ualá','Brubank','Lemon','Personal Pay','Otro'];
export const BASE_CURS: string[]    = ['ARS','USD','EUR'];
export const CUR_SYM: Record<string, string> = { ARS:'$', USD:'US$', EUR:'€' };
export const CUOTA_OPTS: number[]   = [3,6,9,12,18,24];
export const CHART_TYPES: string[]  = ['Tabla','Barras','Radar','Torta'];
export const PENDING_PER            = '⏳ Pendiente';

export const USER_MAP: Record<string, string> = {
  'h0FlnAU3wabBCTztmPXdLyFW6R42': 'Javi',
  'JjDJiAjLmVSc0WODsfvULRLT59s2': 'Lali',
};

// ── Mutable theme globals ─────────────────────────────────────────────────────
export const C: ThemeConfig = { ...THEMES.default };
export let F: string = "'Nunito',sans-serif";

// Legacy preference migration: old theme/font keys → current valid keys
const LEGACY_DARK = ['bosque','oceano','moca','noche','carbon','selva','madera'];
export function coerceTheme(key: string): string {
  if (key === 'default' || key === 'budgetflow' || key === 'oscuro') return key;
  return LEGACY_DARK.indexOf(key) >= 0 ? 'oscuro' : 'default';
}
export function coerceFont(key: string): string {
  if (key === 'Nunito' || key === 'PlusJakarta' || key === 'Jost') return key;
  return 'Nunito';
}

export function applyTheme(themeKey: string, fontKey: string): void {
  const t = THEMES[coerceTheme(themeKey) as ThemeKey] || THEMES.default;
  (Object.keys(t) as (keyof ThemeConfig)[]).forEach(k => { C[k] = t[k]; });
  const fd = FONTS[coerceFont(fontKey) as FontKey] || FONTS.Nunito;
  F = fd.css;
}
