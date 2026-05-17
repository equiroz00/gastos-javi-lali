// ── src/store/useAppStore.ts ──────────────────────────────────────────────────
import { create } from 'zustand';
import { db, auth } from '../firebase.js';
import { collection, doc, setDoc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import {
  getPeriod, generatePlanExpenses, reassignPlanExpenses,
  sanitize, calcAmts, safeN, catEm, fmt,
} from '../lib/helpers';
import { DEFAULT_CATS, PENDING_PER } from '../constants';
import type {
  AppState, Expense, Plan, Payment, Period, Settings,
  Currency, UserName, Responsible,
} from '../types';

// ── Firestore refs ────────────────────────────────────────────────────────────
export const expenseDoc  = (id: string) => doc(db, 'expenses', id);
export const planDoc     = (id: string) => doc(db, 'plans', id);
export const paymentDoc  = (id: string) => doc(db, 'payments', id);
export const settingsDoc = ()            => doc(db, 'settings', 'main');
export const expensesCol = ()            => collection(db, 'expenses');
export const plansCol    = ()            => collection(db, 'plans');
export const paymentsCol = ()            => collection(db, 'payments');
// Per-user preferences (theme + font) — keyed by user name ('Javi' | 'Lali')
export const userPrefDoc = (userName: string) => doc(db, 'userPreferences', userName);

// ── Migration ─────────────────────────────────────────────────────────────────
export function runMigrationIfNeeded(onDone: () => void): void {
  const legacyRef = doc(db, 'appdata', 'main');
  getDoc(legacyRef).then(snap => {
    if (!snap.exists()) { onDone(); return; }
    const data = snap.data();
    const expenses: Expense[] = data.expenses || [];
    const plans: Plan[]       = data.plans    || [];
    const payments: Payment[] = data.payments || [];
    const settings: Settings  = data.settings || { periods: [], theme: 'default', font: 'Nunito' };
    const customCats: string[] = data.customCats || [];
    const batch = writeBatch(db);
    expenses.forEach(e => batch.set(expenseDoc(e.id), e));
    plans.forEach(p    => batch.set(planDoc(p.id), p));
    payments.forEach(p => batch.set(paymentDoc(p.id), p));
    batch.set(settingsDoc(), { ...settings, customCats });
    batch.delete(legacyRef);
    batch.commit().then(onDone).catch(onDone);
  }).catch(onDone);
}

// ── Store actions interface ───────────────────────────────────────────────────
interface AppActions {
  // Auth setters
  setCurrentUser: (u: UserName | null) => void;
  setAuthDenied:  (v: boolean) => void;
  setLoading:     (v: boolean) => void;

  // Data setters (called from onSnapshot)
  setExpenses:   (exps: Expense[])   => void;
  setPlans:      (ps: Plan[])        => void;
  setPayments:   (pays: Payment[])   => void;
  setSettings:   (s: Settings)       => void;
  setCustomCats: (cats: string[])    => void;

  // Per-user preferences
  setUserTheme: (theme: string) => void;
  setUserFont:  (font: string)  => void;
  saveUserPreferences: (theme: string, font: string) => void;

  // UI
  setView:             (v: string)           => void;
  setEditingExpense:   (e: Expense | null)   => void;
  setPendingDelete:    (d: AppState['pendingDelete']) => void;
  setPayModal:         (m: AppState['payModal'])      => void;
  showToast:           (expense: Expense)    => void;
  showMsg:             (msg: string, ms?: number) => void;
  handleSignOut:       () => void;

  // Expense actions
  handleAdd:           (expense: Expense)    => void;
  handleAddMultiple:   (exps: Expense[])     => void;
  handleEdit:          (expense: Expense)    => void;
  requestDelete:       (id: string, expense: Expense) => void;
  confirmDelete:       () => void;

  // Plan actions
  handleAddPlan:       (formData: Expense, numInstallments: number, paidInstallments: number, manualStartPeriod: string | null) => void;
  handleCancelPlan:    (planId: string)      => void;

  // Payment actions
  openPaymentModal:    (currency: Currency, netBal: number) => void;
  confirmPayment:      (paymentData: Payment) => void;

  // Settings
  saveCustomCats:      (cats: string[])      => void;
  saveSettings:        (s: Settings)         => void;

  // Export
  exportCSV:           (from: string, to: string) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────
const useAppStore = create<AppState & AppActions>((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  currentUser: null,
  authDenied:  false,
  loading:     true,
  expenses:    [],
  plans:       [],
  payments:    [],
  settings:    { periods: [], theme: 'default', font: 'Nunito' },
  customCats:  [],
  userTheme:   'default',
  userFont:    'Nunito',
  view:        'dashboard',
  editingExpense: null,
  pendingDelete:  null,
  payModal:    null,
  toast:       null,
  syncMsg:     '',

  // ── Auth ───────────────────────────────────────────────────────────────────
  setCurrentUser: u  => set({ currentUser: u }),
  setAuthDenied:  v  => set({ authDenied: v }),
  setLoading:     v  => set({ loading: v }),

  // ── Data setters ───────────────────────────────────────────────────────────
  setExpenses:   exps => set({ expenses: exps }),
  setPlans:      ps   => set({ plans: ps }),
  setPayments:   pays => set({ payments: pays }),
  setSettings:   s    => set({ settings: s }),
  setCustomCats: cats => set({ customCats: cats }),

  // ── Per-user preferences ───────────────────────────────────────────────────
  setUserTheme: theme => set({ userTheme: theme }),
  setUserFont:  font  => set({ userFont: font }),
  saveUserPreferences: (theme, font) => {
    const state = get();
    set({ userTheme: theme, userFont: font });
    if (state.currentUser) {
      setDoc(userPrefDoc(state.currentUser), { theme, font });
    }
  },

  // ── UI ─────────────────────────────────────────────────────────────────────
  setView:           v => set({ view: v }),
  setEditingExpense: e => set({ editingExpense: e }),
  setPendingDelete:  d => set({ pendingDelete: d }),
  setPayModal:       m => set({ payModal: m }),

  showToast: expense => {
    const t = {
      emoji: catEm(expense.category),
      description: expense.description || 'Gasto guardado',
      amount: fmt(safeN(expense.amount), expense.currency || 'ARS'),
    };
    setTimeout(() => set({ toast: t }), 300);
    setTimeout(() => set({ toast: null }), 2800);
  },

  showMsg: (msg, ms = 5000) => {
    set({ syncMsg: msg });
    setTimeout(() => set({ syncMsg: '' }), ms);
  },

  handleSignOut: () => { signOut(auth); },

  // ── Expense actions ────────────────────────────────────────────────────────
  handleAdd: expense => {
    const state = get();
    const allCats = DEFAULT_CATS.concat(state.customCats);
    const s = sanitize({ ...expense, id: Date.now().toString() }, allCats);
    set({ expenses: [s, ...state.expenses], view: 'dashboard' });
    setDoc(expenseDoc(s.id), s);
    state.showToast(s);
  },

  handleAddMultiple: exps => {
    const state = get();
    const allCats = DEFAULT_CATS.concat(state.customCats);
    const sanitized = exps.map(e => sanitize(e, allCats));
    const batch = writeBatch(db);
    sanitized.forEach(s => batch.set(expenseDoc(s.id), s));
    batch.commit();
    set({ expenses: [...sanitized, ...state.expenses], view: 'dashboard' });
    state.showToast(sanitized[sanitized.length - 1]);
  },

  handleEdit: expense => {
    const state = get();
    const allCats = DEFAULT_CATS.concat(state.customCats);
    const s = sanitize(expense, allCats);
    set({ expenses: state.expenses.map(e => e.id === s.id ? s : e), editingExpense: null, view: 'dashboard' });
    setDoc(expenseDoc(s.id), s);
    state.showToast(s);
  },

  requestDelete: (id, expense) => set({ pendingDelete: { id, expense } }),

  confirmDelete: () => {
    const state = get();
    if (!state.pendingDelete) return;
    const id = state.pendingDelete.id;
    set({ expenses: state.expenses.filter(e => e.id !== id), pendingDelete: null });
    deleteDoc(expenseDoc(id));
  },

  // ── Plan actions ───────────────────────────────────────────────────────────
  handleAddPlan: (formData, numInstallments, paidInstallments, manualStartPeriod) => {
    const state = get();
    const paid = paidInstallments || 0;
    const installmentAmount = Math.round(safeN(formData.amount) / numInstallments);
    const amts = calcAmts(installmentAmount, formData.responsible);
    const startPeriod = manualStartPeriod || getPeriod(formData.date, state.settings.periods);
    const plan: Plan = {
      id: 'plan_' + Date.now(),
      description: formData.description,
      totalAmount: safeN(formData.amount),
      installmentAmount,
      numInstallments,
      paidInstallments: paid,
      startPeriod,
      startDate: formData.date,
      currency: formData.currency as Currency,
      paidBy: formData.paidBy,
      responsible: formData.responsible,
      paymentMethod: formData.paymentMethod,
      bank: formData.bank,
      category: formData.category,
      javiAmount: amts.javiAmount,
      laliAmount: amts.laliAmount,
      createdAt: new Date().toISOString(),
    };
    const installments = generatePlanExpenses(plan, state.settings.periods);
    const batch = writeBatch(db);
    batch.set(planDoc(plan.id), plan);
    installments.forEach(inst => batch.set(expenseDoc(inst.id), inst));
    batch.commit();
    set({ plans: [...state.plans, plan], expenses: [...installments, ...state.expenses], view: 'dashboard' });
  },

  handleCancelPlan: planId => {
    const state = get();
    const planExps = state.expenses.filter(e => e.planId === planId);
    const batch = writeBatch(db);
    batch.delete(planDoc(planId));
    planExps.forEach(e => batch.delete(expenseDoc(e.id)));
    batch.commit();
    set({ plans: state.plans.filter(p => p.id !== planId), expenses: state.expenses.filter(e => e.planId !== planId) });
  },

  // ── Payment actions ────────────────────────────────────────────────────────
  openPaymentModal: (currency, netBal) => set({ payModal: { currency, netBal } }),

  confirmPayment: paymentData => {
    const state = get();
    set({ payments: [...state.payments, paymentData], payModal: null });
    setDoc(paymentDoc(paymentData.id), paymentData);
    state.showMsg('✓ Pago registrado correctamente.');
  },

  // ── Settings actions ───────────────────────────────────────────────────────
  saveCustomCats: cats => {
    const state = get();
    set({ customCats: cats });
    setDoc(settingsDoc(), { ...state.settings, customCats: cats });
  },

  saveSettings: s => {
    const state = get();
    let updated = state.expenses.map(e => ({
      ...e,
      period: (!e.fromPlan && e.date) ? getPeriod(e.date, s.periods) : (e.period || 'Sin período'),
    }));
    if (s.periods?.length) updated = reassignPlanExpenses(updated, s.periods, state.plans);
    updated.forEach((e, i) => {
      if (e.period !== state.expenses[i]?.period) setDoc(expenseDoc(e.id), e);
    });
    set({ expenses: updated, settings: s });
    setDoc(settingsDoc(), { ...s, customCats: state.customCats });
  },

  // ── CSV Export ─────────────────────────────────────────────────────────────
  exportCSV: (from, to) => {
    const state = get();
    const filtered = state.expenses.filter(e => {
      if (!e.date) return false;
      if (from && e.date < from) return false;
      if (to   && e.date > to)   return false;
      return true;
    });
    if (!filtered.length) { state.showMsg('No hay gastos en ese rango.'); return; }
    const header = ['Fecha','Descripción','Monto','Moneda','Categoría','Medio de Pago','Banco','Pagó','Responsable','Monto Javi','Monto Lali','Período'];
    const rows = [header, ...filtered.map(e => [
      e.date, e.description, safeN(e.amount), e.currency || 'ARS',
      e.category || '', e.paymentMethod || '', e.bank || '',
      e.paidBy, e.responsible, safeN(e.javiAmount), safeN(e.laliAmount), e.period || '',
    ])];
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const dataStr = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', 'gastos_' + (from || 'inicio') + '_al_' + (to || 'hoy') + '.csv');
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    state.showMsg('✓ CSV con ' + filtered.length + ' gastos descargado.');
  },
}));

export default useAppStore;
