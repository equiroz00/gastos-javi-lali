// ── src/constants.ts ──────────────────────────────────────────────────────────
import type { ThemeConfig, FontConfig, ThemeKey, FontKey } from './types.js';

export const THEMES: Record<ThemeKey, ThemeConfig> = {
  default:    { label:'Original',   emoji:'💜', bg:'#F2F3F4', surface:'#FFFFFF', navy:'#174871', accent:'#A77693', beige:'#DED1C6', textMuted:'#8a7a85', border:'#DED1C6', white:'#FFFFFF', gradMain:'linear-gradient(135deg,#174871,#A77693)', gradJavi:'linear-gradient(135deg,#174871,#1e5c9b)', gradLali:'linear-gradient(135deg,#A77693,#c490a8)' },
  amanecer:   { label:'Amanecer',   emoji:'🌅', bg:'#f0f0fa', surface:'#ffffff', navy:'#2d3250', accent:'#f9b17a', beige:'#e4e4f5', textMuted:'#676fad', border:'#dcdcf0', white:'#FFFFFF', gradMain:'linear-gradient(135deg,#2d3250,#424769)', gradJavi:'linear-gradient(135deg,#424769,#2d3250)', gradLali:'linear-gradient(135deg,#f9b17a,#e09850)' },
  bosque:     { label:'Bosque',     emoji:'🌿', bg:'#051f20', surface:'#0b2b26', navy:'#daf1de', accent:'#8eb69b', beige:'#163832', textMuted:'#6a9a7a', border:'#1e4035', white:'#FFFFFF', gradMain:'linear-gradient(135deg,#163832,#235347)', gradJavi:'linear-gradient(135deg,#235347,#163832)', gradLali:'linear-gradient(135deg,#8eb69b,#5a8a6b)' },
  oceano:     { label:'Océano',     emoji:'🌊', bg:'#0f2027', surface:'#1a3040', navy:'#e0f0f8', accent:'#4ab8c8', beige:'#1e3545', textMuted:'#7aaaba', border:'#243d50', white:'#FFFFFF', gradMain:'linear-gradient(135deg,#0f2027,#2c5364)', gradJavi:'linear-gradient(135deg,#2c5364,#0f2027)', gradLali:'linear-gradient(135deg,#4ab8c8,#2a98a8)' },
  moca:       { label:'Moca',       emoji:'☕', bg:'#2e1f1b', surface:'#3d2a25', navy:'#f0e0d8', accent:'#c4856a', beige:'#4a3530', textMuted:'#9a7868', border:'#503a35', white:'#FFFFFF', gradMain:'linear-gradient(135deg,#2e1f1b,#5e4b43)', gradJavi:'linear-gradient(135deg,#5e4b43,#2e1f1b)', gradLali:'linear-gradient(135deg,#c4856a,#a06050)' },
  noche:      { label:'Noche',      emoji:'🌙', bg:'#17181d', surface:'#292c35', navy:'#fcd9b8', accent:'#e09145', beige:'#35383f', textMuted:'#9a9080', border:'#3a3d46', white:'#FFFFFF', gradMain:'linear-gradient(135deg,#292c35,#17181d)', gradJavi:'linear-gradient(135deg,#e09145,#c07530)', gradLali:'linear-gradient(135deg,#fcd9b8,#e8b890)' },
  // ── Temas nuevos ──────────────────────────────────────────────────────────
  carbon:     { label:'Carbón',     emoji:'🖤', bg:'#1C1C1C', surface:'#272727', navy:'#E8E2D8', accent:'#C5BFAE', beige:'#242424', textMuted:'#9A9088', border:'#363636', white:'#FFFFFF', gradMain:'linear-gradient(135deg,#2A2520,#3A3530)', gradJavi:'linear-gradient(135deg,#C5BFAE,#A8A29A)', gradLali:'linear-gradient(135deg,#8A8480,#C5BFAE)' },
  selva:      { label:'Selva',      emoji:'🌱', bg:'#3D402F', surface:'#474A38', navy:'#EDE8DE', accent:'#D59A7A', beige:'#434637', textMuted:'#8A9A80', border:'#505444', white:'#FFFFFF', gradMain:'linear-gradient(135deg,#3D402F,#6B7F64)', gradJavi:'linear-gradient(135deg,#6B7F64,#3D402F)', gradLali:'linear-gradient(135deg,#D59A7A,#9C0D0F)' },
  madera:     { label:'Madera',     emoji:'🪵', bg:'#2D1E17', surface:'#3A2820', navy:'#EDE0D5', accent:'#9D8A7C', beige:'#3D2B22', textMuted:'#7A6558', border:'#4A3328', white:'#FFFFFF', gradMain:'linear-gradient(135deg,#523F31,#796254)', gradJavi:'linear-gradient(135deg,#523F31,#2D1E17)', gradLali:'linear-gradient(135deg,#796254,#9D8A7C)' },
  pergamino:  { label:'Pergamino',  emoji:'📜', bg:'#EAE0D2', surface:'#F5F0E8', navy:'#2D2D2D', accent:'#A68763', beige:'#D7C9AE', textMuted:'#7A6E62', border:'#C8BAA4', white:'#FFFFFF', gradMain:'linear-gradient(135deg,#2D2D2D,#A68763)', gradJavi:'linear-gradient(135deg,#2D2D2D,#4A4A4A)', gradLali:'linear-gradient(135deg,#A68763,#D7C9AE)' },
};

export const FONTS: Record<FontKey, FontConfig> = {
  Nunito:        { label:'Nunito',          url:'Nunito:wght@400;600;700;800;900',           css:"'Nunito',sans-serif" },
  Montserrat:    { label:'Montserrat',      url:'Montserrat:wght@400;600;700;800;900',       css:"'Montserrat',sans-serif" },
  Quicksand:     { label:'Quicksand',       url:'Quicksand:wght@400;600;700',                css:"'Quicksand',sans-serif" },
  Jost:          { label:'Jost',            url:'Jost:wght@400;600;700;800;900',             css:"'Jost',sans-serif" },
  Syne:          { label:'Syne',            url:'Syne:wght@400;600;700;800',                 css:"'Syne',sans-serif" },
  Exo2:          { label:'Exo 2',           url:'Exo+2:wght@400;600;700;800;900',            css:"'Exo 2',sans-serif" },
  Monda:         { label:'Monda',           url:'Monda:wght@400;700',                        css:"'Monda',sans-serif" },
  Forum:         { label:'Forum',           url:'Forum',                                     css:"'Forum',serif" },
  Alice:         { label:'Alice',           url:'Alice',                                     css:"'Alice',serif" },
  EBGaramond:    { label:'EB Garamond',     url:'EB+Garamond:wght@400;600;700;800',          css:"'EB Garamond',serif" },
  JuliusSansOne: { label:'Julius Sans One', url:'Julius+Sans+One',                           css:"'Julius Sans One',sans-serif" },
  ZenDots:       { label:'Zen Dots',        url:'Zen+Dots',                                  css:"'Zen Dots',sans-serif" },
  Oswald:        { label:'Oswald',          url:'Oswald:wght@400;600;700',                   css:"'Oswald',sans-serif" },
};

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

export function applyTheme(themeKey: string, fontKey: string): void {
  const t = THEMES[themeKey as ThemeKey] || THEMES.default;
  (Object.keys(t) as (keyof ThemeConfig)[]).forEach(k => { (C as Record<string, string>)[k] = t[k]; });
  const fd = FONTS[fontKey as FontKey] || FONTS.Nunito;
  F = fd.css;
}
