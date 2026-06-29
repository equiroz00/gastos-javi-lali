// ── src/types.ts ──────────────────────────────────────────────────────────────
export type Currency    = 'ARS' | 'USD' | 'EUR' | string;
export type UserName    = 'Javi' | 'Lali';
export type Responsible = 'Javi' | 'Lali' | 'Ambos';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  date: string;
  period: string;
  paidBy: UserName;
  responsible: Responsible;
  category: string;
  paymentMethod: string;
  bank: string;
  javiAmount: number;
  laliAmount: number;
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
  netBal: number;
  period?: string;
}

export interface DeleteData {
  id: string;
  expense: Expense;
}

export interface UserPreferences {
  theme: string;
  font: string;
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

  // Data (expenses vive en la caché de TanStack Query, no acá)
  plans: Plan[];
  settings: Settings;
  customCats: string[];

  // Per-user preferences
  userTheme: string;
  userFont: string;

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

export interface ThemeConfig {
  label: string; emoji: string; bg: string; surface: string;
  navy: string; accent: string; beige: string; textMuted: string;
  border: string; white: string; onNavy: string;
  gradMain: string; gradJavi: string; gradLali: string;
  // Colores semánticos de texto (se adaptan al tema para mantener contraste).
  danger: string; warn: string; ok: string;
}

export interface FontConfig {
  label: string; url: string; css: string;
}
