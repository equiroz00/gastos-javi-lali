// ── src/constants.ts ──────────────────────────────────────────────────────────
import type { ThemeConfig, FontConfig, ThemeKey, FontKey, UIVariantConfig, UIKey } from './types';

// onNavy = color de texto/íconos cuando el FONDO es `navy`. En el tema claro
// navy es azul → texto blanco; en el oscuro navy es casi blanco (#F4F4F5) →
// texto oscuro. Usar siempre onNavy (no `white`) sobre fondos navy, si no las
// burbujas seleccionadas quedan blanco sobre blanco en el tema oscuro.
// Budget Flow: estética iOS clara (fondo gris-sistema, tarjetas blancas, planas)
// pero conservando el violeta/morado de la marca como acento principal. navy =
// violeta oscuro legible (texto + Javi), accent = malva (Lali), igual que el
// original para no perder la identidad de pareja.
export const THEMES: Record<ThemeKey, ThemeConfig> = {
  default:    { label:'Original',    emoji:'💜', dark:false, bg:'#F2F3F4', surface:'#FFFFFF', navy:'#174871', accent:'#A77693', beige:'#E4DAD2', textMuted:'#8a7a85', border:'#E2D8CF', white:'#FFFFFF', onNavy:'#FFFFFF', gradMain:'linear-gradient(135deg,#174871,#A77693)', gradJavi:'linear-gradient(135deg,#174871,#1e5c9b)', gradLali:'linear-gradient(135deg,#A77693,#c490a8)', danger:'#c0314f', warn:'#b45309', ok:'#2d9e7f' },
  budgetflow: { label:'Budget Flow', emoji:'🟣', dark:false, bg:'#F2F2F7', surface:'#FFFFFF', navy:'#3D2F73', accent:'#A77693', beige:'#ECECF2', textMuted:'#8A8A8E', border:'#E4E4EC', white:'#FFFFFF', onNavy:'#FFFFFF', gradMain:'linear-gradient(135deg,#6E4DC9,#A77693)', gradJavi:'linear-gradient(135deg,#4D3B9E,#6E4DC9)', gradLali:'linear-gradient(135deg,#A77693,#C490A8)', danger:'#c0314f', warn:'#b45309', ok:'#2d9e7f' },
  oscuro:     { label:'Oscuro',      emoji:'🌑', dark:true, bg:'#0F1115', surface:'#191C22', navy:'#F4F4F5', accent:'#10B981', beige:'#23272F', textMuted:'#8B909B', border:'#262A32', white:'#FFFFFF', onNavy:'#0F1115', gradMain:'linear-gradient(135deg,#1A1D24,#23272F)', gradJavi:'linear-gradient(135deg,#10B981,#0E9F6E)', gradLali:'linear-gradient(135deg,#A78BFA,#8B5CF6)', danger:'#F87171', warn:'#FBBF24', ok:'#34D399' },
};

export const FONTS: Record<FontKey, FontConfig> = {
  Nunito:      { label:'Nunito',        url:'Nunito:wght@400;600;700;800;900',                  css:"'Nunito',sans-serif" },
  PlusJakarta: { label:'Plus Jakarta',  url:'Plus+Jakarta+Sans:wght@400;500;600;700;800',       css:"'Plus Jakarta Sans',sans-serif" },
  Jost:        { label:'Jost',          url:'Jost:wght@400;600;700;800;900',                    css:"'Jost',sans-serif" },
};

// Monospaced font for monetary figures — loaded always, used regardless of body font
export const MONO = "'JetBrains Mono',ui-monospace,monospace";

// ── Variantes de interfaz ─────────────────────────────────────────────────────
// Las dos direcciones del rediseño, expresadas SOLO como tokens de layout. No
// hay un color acá a propósito: el color sigue viniendo del tema (`C`), así que
// cualquiera de los 3 temas funciona con cualquiera de las 2 variantes.
//
// Medidas tomadas de los mockups a 1320px del documento de diseño:
//   cuenta → riel claro 64px, banda de acento con la cifra a 44–52px, secciones
//            con versalita + filete fuerte, filas separadas por hairline.
//   panel  → riel oscuro 56px, tarjetas con borde de 1px y radio 10, tablas
//            densas, pasos como pestañas, atajos de teclado a la vista.
export const UI_VARIANTS: Record<UIKey, UIVariantConfig> = {
  cuenta: {
    label:'Estado de cuenta',
    hint:'Bandas a todo el ancho, cifras grandes y filetes. Sin tarjetas.',
    railW:64, railDark:false, railIcon:40, railRadius:11,
    surfaceMode:'flat', radius:10, shellBg:'surface',
    sectionRule:'strong', sectionSize:11, sectionLS:'0.06em',
    rowRule:true, rowPadY:'0.8rem',
    heroBand:true, shortcuts:false, stepStyle:'bars', navStyle:'pill',
  },
  panel: {
    label:'Panel de trabajo',
    hint:'Tarjetas, tablas densas y atajos de teclado. Riel oscuro.',
    railW:56, railDark:true, railIcon:38, railRadius:10,
    surfaceMode:'card', radius:10, shellBg:'bg',
    sectionRule:'none', sectionSize:10.5, sectionLS:'0.04em',
    rowRule:true, rowPadY:'0.5rem',
    heroBand:false, shortcuts:true, stepStyle:'tabs', navStyle:'bar',
  },
};

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

// Ancho del contenedor de una columna (móvil/tablet). Fluido: usa el ancho
// disponible hasta un máximo cómodo, en vez de toparse seco en 480px y dejar
// franjas vacías en pantallas medianas.
export const SHELL_MAXW = 'min(640px, 100%)';

// Tipografía fluida — escala suave con el ancho del viewport (clamp: mín, ideal
// con vw, máx). Para los números/títulos protagonistas que se benefician de
// crecer en pantallas grandes sin saltos.
export const FS = {
  hero:   'clamp(1.9rem, 1.15rem + 3.4vw, 2.8rem)', // balance principal (Inicio)
  amount: 'clamp(1.6rem, 1.1rem + 2.6vw, 2.3rem)',  // monto en Nuevo gasto
  title:  'clamp(1.15rem, 1rem + 0.9vw, 1.5rem)',   // títulos de pantalla (h2)
} as const;

export const PALETTE: string[]      = ['#174871','#A77693','#4a9d8f','#d4875a','#7b5fa0','#c4965a','#5a8fa0','#a05a6e','#4a7a5a','#9a7040'];
export const DEFAULT_CATS: string[] = ['🏠 Hogar','🍕 Alimentación','🔑 Arriendo','💡 Servicios Públicos','🚌 Transporte','🎬 Entretenimiento','👥 Amigos','💆 Cuidado Personal','💪 Gimnasio','💊 Farmacia','👶 Hijito','👕 Ropa'];
// Listas base. El usuario puede sumar opciones propias (se guardan en
// settings/main como customPayMethods / customBanks) y la UI muestra la unión
// ordenada alfabéticamente — ver mergeOptions() en lib/helpers.ts.
export const PAY_METHODS: string[]  = ['AMEX','Master Card','Visa'];
export const BANKS: string[]        = ['BBVA','Galicia','Macro','Mercado Libre','Modo'];

// Tarjetas viejas → equivalente actual. La distinción por titular se descarta a
// propósito: la app ya registra quién pagó en `paidBy`, así que era redundante.
// 'Efectivo' y 'Dinero en Cuenta' NO están acá: no son tarjetas y no tienen
// equivalente, así que se conservan tal cual en los gastos que los usan.
export const LEGACY_PAY_METHOD_MAP: Record<string, string> = {
  'TC Visa Laura':            'Visa',
  'TC Visa Javi':             'Visa',
  'TC Visa Extensión':        'Visa',
  'TC Master Card Laura':     'Master Card',
  'TC Master Card Extensión': 'Master Card',
  'TC Amex Javi':             'AMEX',
  'TC Amex Laura':            'AMEX',
};
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
// Variante de interfaz activa. Mismo patrón que `C`: un objeto estable que se
// muta en sitio, para que los `import { V }` de cada pantalla vean el cambio
// sin volver a importar.
export const V: UIVariantConfig = { ...UI_VARIANTS.cuenta };

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
// Quien nunca eligió variante (todos, hasta este cambio) cae en 'cuenta': es la
// dirección con el juego de pantallas completo en el documento de diseño.
export function coerceUI(key: string): UIKey {
  return key === 'panel' ? 'panel' : 'cuenta';
}

export function applyTheme(themeKey: string, fontKey: string, uiKey?: string): void {
  const t = THEMES[coerceTheme(themeKey) as ThemeKey] || THEMES.default;
  // El cast es necesario desde que ThemeConfig mezcla string y boolean (`dark`):
  // con claves en unión, TS reduce el destino a `never`.
  (Object.keys(t) as (keyof ThemeConfig)[]).forEach(k => { (C as any)[k] = t[k]; });
  const fd = FONTS[coerceFont(fontKey) as FontKey] || FONTS.Nunito;
  F = fd.css;
  const v = UI_VARIANTS[coerceUI(uiKey || 'cuenta')];
  (Object.keys(v) as (keyof UIVariantConfig)[]).forEach(k => { (V as any)[k] = v[k]; });
}
