// ── src/types.ts ──────────────────────────────────────────────────────────────
// Interfaces compartidas — fuente de verdad de la forma de los datos.
// Todos los componentes y el store importan desde acá.

export type Currency = 'ARS' | 'USD' | 'EUR' | string;
export type UserName = 'Javi' | 'Lali';
export type Responsible = 'Javi' | 'Lali' | 'Ambos';

// ── Entidades de datos ────────────────────────────────────────────────────────

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  date: string;           // 'YYYY-MM-DD'
  period: string;
  paidBy: UserName;
  responsible: Responsible;
  category: string;
  paymentMethod: string;
  bank: string;
  javiAmount: number;
  laliAmount: number;
  createdBy?: UserName;
  createdAt?: string;
  // Campos de cuotas
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
  paidBy: UserName;
  responsible: Responsible;
  paymentMethod: string;
  bank: string;
  category: string;
  javiAmount: number;
  laliAmount: number;
  createdAt: string;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  currency: Currency;
  from: UserName;
  to: UserName;
  registeredAt: string;
}

export interface Period {
  name: string;
  start: string;   // 'YYYY-MM-DD'
  end: string;     // 'YYYY-MM-DD'
}

export interface Settings {
  periods: Period[];
  theme: string;
  font: string;
}

// ── Estado del store ──────────────────────────────────────────────────────────

export interface ToastData {
  emoji: string;
  description: string;
  amount: string;
}

export interface PayModalData {
  currency: Currency;
  netBal: number;
}

export interface DeleteData {
  id: string;
  expense: Expense;
}

export interface AppState {
  // Auth
  currentUser: UserName | null;
  authDenied: boolean;
  loading: boolean;

  // Data
  expenses: Expense[];
  plans: Plan[];
  payments: Payment[];
  settings: Settings;
  customCats: string[];

  // UI
  view: string;
  editingExpense: Expense | null;
  pendingDelete: DeleteData | null;
  payModal: PayModalData | null;
  toast: ToastData | null;
  syncMsg: string;
}

// ── Tipos de formulario ───────────────────────────────────────────────────────

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

// ── Helpers de tipo ───────────────────────────────────────────────────────────

export type ThemeKey = 'default' | 'amanecer' | 'bosque' | 'oceano' | 'moca' | 'noche';
export type FontKey = 'Nunito' | 'Montserrat' | 'Quicksand' | 'Jost' | 'Syne' | 'Exo2' | 'Monda' | 'Forum' | 'Alice' | 'EBGaramond' | 'JuliusSansOne' | 'ZenDots' | 'Oswald';

export interface ThemeConfig {
  label: string;
  emoji: string;
  bg: string;
  surface: string;
  navy: string;
  accent: string;
  beige: string;
  textMuted: string;
  border: string;
  white: string;
  gradMain: string;
  gradJavi: string;
  gradLali: string;
}

export interface FontConfig {
  label: string;
  url: string;
  css: string;
}
