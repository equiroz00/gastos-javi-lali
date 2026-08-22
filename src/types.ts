// ── src/types.ts ──────────────────────────────────────────────────────────────
export type Currency    = 'ARS' | 'USD' | 'EUR' | string;
export type UserName    = 'Javi' | 'Lali';
export type Responsible = 'Javi' | 'Lali' | 'Ambos';

// ── Split normalizado (Sprint 11) ─────────────────────────────────────────────
// Reemplaza el reparto hardcodeado a 2 personas (javiAmount/laliAmount). Preparado
// para N participantes. `paidBy` = quién pagó; `splitAmong` = cómo se reparte.
export type SplitStrategy = 'iguales' | 'montos' | 'porcentajes' | 'shares';
export interface SplitEntry { participant: string; value?: number; } // value según strategy; ausente en 'iguales'
export interface SplitAmong { strategy: SplitStrategy; entries: SplitEntry[]; }
export type Visibility = 'compartido' | 'privado';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  date: string;
  period: string;
  paidBy: string;          // participante que pagó (Javi/Lali o una etiqueta, Sprint 13)
  responsible: Responsible;
  category: string;
  paymentMethod: string;
  bank: string;
  javiAmount: number;
  laliAmount: number;
  // ── Sprint 11 (opcionales durante la transición; obligatorios en PR C) ──
  splitAmong?: SplitAmong;
  visibilidad?: Visibility;
  ownerId?: string;        // uid del dueño, solo si visibilidad === 'privado'
  notes?: string;
  createdBy?: UserName;
  createdAt?: string;
  fromPlan?: boolean;
  planId?: string;
  installmentNum?: number;
  numInstallments?: number;
}

export interface Plan {
  id: string;
  description: string;
  totalAmount: number;
  installmentAmount: number;
  numInstallments: number;
  paidInstallments: number;
  startPeriod: string;
  startDate: string;
  currency: Currency;
  paidBy: string;          // Sprint 13: cualquier participante
  responsible: Responsible;
  paymentMethod: string;
  bank: string;
  category: string;
  javiAmount: number;
  laliAmount: number;
  // ── Sprint 11 (opcionales durante la transición) ──
  splitAmong?: SplitAmong;
  visibilidad?: Visibility;
  ownerId?: string;
  createdBy?: UserName;    // quién cargó el plan; las cuotas lo heredan
  createdAt: string;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  currency: Currency;
  from: string;            // Sprint 13: cualquier participante
  to: string;
  period?: string;
  registeredAt: string;
}

export interface Period {
  name: string;
  start: string;
  end: string;
}

export interface Settings {
  periods: Period[];
  theme: string;
  font: string;
}

export interface ToastData {
  category: string;
  description: string;
  amount: string;
}

export interface PayModalData {
  currency: Currency;
  from: string;
  to: string;
  amount: number;    // monto sugerido de la transferencia
  period?: string;
}

export interface DeleteData {
  id: string;
  expense: Expense;
}

export interface UserPreferences {
  theme: string;
  font: string;
  // Variante de interfaz (layout). Es un eje INDEPENDIENTE del tema: `theme`
  // decide los colores, `ui` decide la estructura. Como `theme` y `font`, vive
  // en userPreferences/{usuario} y no afecta a la otra persona.
  ui: string;
}

export interface ActivityEntry {
  id: string;
  action: 'add' | 'edit' | 'delete';
  description: string;
  amount?: number;
  currency?: string;
  doneBy: string;
  timestamp: string;
}

export interface AppState {
  // Auth
  currentUser: UserName | null;
  authDenied: boolean;
  loading: boolean;

  // Datos remotos (expenses/plans/payments/settings/customCats): TanStack Query.

  // Per-user preferences
  userTheme: string;
  userFont: string;
  userUI: string;

  // Activity log (notifications)
  activityLog: ActivityEntry[];
  lastReadTs: string;

  // UI
  view: string;
  editingExpense: Expense | null;
  editingPlan: Plan | null;
  pendingDelete: DeleteData | null;
  payModal: PayModalData | null;
  toast: ToastData | null;
  syncMsg: string;
}

export interface ExpenseForm {
  id?: string;
  date: string;
  description: string;
  amount: string | number;
  category: string;
  paymentMethod: string;
  bank: string;
  paidBy: UserName;
  responsible: Responsible;
  currency: Currency | 'Otra';
  customCurrency?: string;
}

export type ThemeKey = 'default' | 'budgetflow' | 'oscuro';
export type FontKey  = 'Nunito' | 'PlusJakarta' | 'Jost';

// ── Variantes de interfaz ─────────────────────────────────────────────────────
// Las dos direcciones del rediseño. NO llevan color: los colores siguen saliendo
// del tema (objeto `C`), así que las 3 opciones de tema × 2 de interfaz son
// ortogonales y el tema "Original" de Lali se preserva en ambas variantes.
//   cuenta → "Estado de cuenta": bandas a todo el ancho, filetes, sin tarjetas.
//   panel  → "Panel de trabajo": tarjetas, tablas densas, atajos de teclado.
export type UIKey = 'cuenta' | 'panel';

export interface UIVariantConfig {
  label: string;
  hint: string;
  // Riel de navegación en escritorio
  railW: number;          // ancho en px
  railDark: boolean;      // riel sobre ink (panel) vs. sobre gris claro (cuenta)
  railIcon: number;       // lado del botón de ícono
  railRadius: number;
  // Superficies
  surfaceMode: 'flat' | 'card'; // filetes vs. tarjetas con borde
  radius: number;
  shellBg: 'surface' | 'bg';    // fondo del área de contenido
  // Encabezados de sección
  sectionRule: 'strong' | 'none'; // filete 1px sobre el ink debajo del título
  sectionSize: number;
  sectionLS: string;
  // Filas
  rowRule: boolean;       // hairline entre filas
  rowPadY: string;
  // Rasgos propios
  heroBand: boolean;      // banda de acento con la cifra protagonista
  shortcuts: boolean;     // muestra atajos de teclado (⌘↵)
  stepStyle: 'bars' | 'tabs';   // progreso del alta de gasto
  navStyle: 'pill' | 'bar';     // nav móvil: píldora flotante vs. barra al ras
}

export interface ThemeConfig {
  label: string; emoji: string;
  // `dark` no es cosmético: las variantes lo necesitan para decidir superficies
  // por contraste en vez de por color fijo. El riel de "Panel de trabajo" es
  // ink sobre claro, pero en el tema oscuro invertirlo lo dejaría blanco.
  dark: boolean;
  bg: string; surface: string;
  navy: string; accent: string; beige: string; textMuted: string;
  border: string; white: string; onNavy: string;
  gradMain: string; gradJavi: string; gradLali: string;
  // Colores semánticos de texto (se adaptan al tema para mantener contraste).
  danger: string; warn: string; ok: string;
}

export interface FontConfig {
  label: string; url: string; css: string;
}
