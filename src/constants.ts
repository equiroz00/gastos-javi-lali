// ── src/constants.ts ──────────────────────────────────────────────────────────
import type { ThemeConfig, FontConfig, ThemeKey, FontKey } from './types';

export const THEMES: Record<ThemeKey, ThemeConfig> = {
  default: { label:'Original', emoji:'💜', bg:'#F2F3F4', surface:'#FFFFFF', navy:'#174871', accent:'#A77693', beige:'#E4DAD2', textMuted:'#8a7a85', border:'#E2D8CF', white:'#FFFFFF', gradMain:'linear-gradient(135deg,#174871,#A77693)', gradJavi:'linear-gradient(135deg,#174871,#1e5c9b)', gradLali:'linear-gradient(135deg,#A77693,#c490a8)' },
  oscuro:  { label:'Oscuro',   emoji:'🌑', bg:'#0F1115', surface:'#191C22', navy:'#F4F4F5', accent:'#10B981', beige:'#23272F', textMuted:'#8B909B', border:'#262A32', white:'#FFFFFF', gradMain:'linear-gradient(135deg,#1A1D24,#23272F)', gradJavi:'linear-gradient(135deg,#10B981,#0E9F6E)', gradLali:'linear-gradient(135deg,#A78BFA,#8B5CF6)' },
};

export const FONTS: Record<FontKey, FontConfig> = {
  Nunito:      { label:'Nunito',        url:'Nunito:wght@400;600;700;800;900',                  css:"'Nunito',sans-serif" },
  PlusJakarta: { label:'Plus Jakarta',  url:'Plus+Jakarta+Sans:wght@400;500;600;700;800',       css:"'Plus Jakarta Sans',sans-serif" },
  Jost:        { label:'Jost',          url:'Jost:wght@400;600;700;800;900',                    css:"'Jost',sans-serif" },
};

// Monospaced font for monetary figures — loaded always, used regardless of body font
export const MONO = "'JetBrains Mono',ui-monospace,monospace";

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
  if (key === 'default' || key === 'oscuro') return key;
  return LEGACY_DARK.indexOf(key) >= 0 ? 'oscuro' : 'default';
}
export function coerceFont(key: string): string {
  if (key === 'Nunito' || key === 'PlusJakarta' || key === 'Jost') return key;
  return 'Nunito';
}

export function applyTheme(themeKey: string, fontKey: string): void {
  const t = THEMES[coerceTheme(themeKey) as ThemeKey] || THEMES.default;
  (Object.keys(t) as (keyof ThemeConfig)[]).forEach(k => { (C as Record<string, string>)[k] = t[k]; });
  const fd = FONTS[coerceFont(fontKey) as FontKey] || FONTS.Nunito;
  F = fd.css;
}
