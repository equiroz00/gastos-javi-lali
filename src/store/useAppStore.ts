// ── src/store/useAppStore.ts ──────────────────────────────────────────────────
import { create } from 'zustand';
import { db, auth } from '../firebase.js';
import { collection, doc, setDoc, deleteDoc, writeBatch, getDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import {
  getPeriod, generatePlanExpenses, reassignExpensePeriods,
  sanitize, calcAmts, safeN, catEm, fmt, genId,
} from '../lib/helpers.js';
import { DEFAULT_CATS } from '../constants.js';
import { queryClient } from '../lib/queryClient';
import { checkExpenseForWrite, checkPaymentForWrite, checkPlanForWrite } from '../lib/schemas';
import type {
  AppState, Expense, Plan, Payment, Settings,
  Currency, UserName,
} from '../types.js';

// ── Firestore refs ────────────────────────────────────────────────────────────
export const expenseDoc     = (id: string) => doc(db, 'expenses', id);
export const planDoc        = (id: string) => doc(db, 'plans', id);
export const paymentDoc     = (id: string) => doc(db, 'payments', id);
export const settingsDoc    = ()            => doc(db, 'settings', 'main');
export const expensesCol    = ()            => collection(db, 'expenses');
export const plansCol       = ()            => collection(db, 'plans');
export const paymentsCol    = ()            => collection(db, 'payments');
export const userPrefDoc    = (u: string)   => doc(db, 'userPreferences', u);
export const activityLogCol = ()            => collection(db, 'activityLog');
export const activityLogDoc = (id: string)  => doc(db, 'activityLog', id);

// ── Gastos: lectura/escritura de la caché de TanStack Query ───────────────────
// Tras el Paso 1b los gastos viven SOLO en la caché de Query (no en Zustand).
// Las escrituras son optimistas; el onSnapshot reconcilia luego con setQueryData.
const getExps = (): Expense[] => queryClient.getQueryData<Expense[]>(['expenses']) ?? [];
const setExps = (next: Expense[]): void => { queryClient.setQueryData<Expense[]>(['expenses'], next); };
const getPays = (): Payment[] => queryClient.getQueryData<Payment[]>(['payments']) ?? [];
const setPays = (next: Payment[]): void => { queryClient.setQueryData<Payment[]>(['payments'], next); };
const getPlans = (): Plan[] => queryClient.getQueryData<Plan[]>(['plans']) ?? [];
const setPlans = (next: Plan[]): void => { queryClient.setQueryData<Plan[]>(['plans'], next); };
const getCfg = (): Settings => queryClient.getQueryData<Settings>(['settings']) ?? { periods: [], theme: 'default', font: 'Nunito' };
const setCfg = (next: Settings): void => { queryClient.setQueryData<Settings>(['settings'], next); };
const getCats = (): string[] => queryClient.getQueryData<string[]>(['customCats']) ?? [];
const setCats = (next: string[]): void => { queryClient.setQueryData<string[]>(['customCats'], next); };

// ── Migration ─────────────────────────────────────────────────────────────────
export function runMigrationIfNeeded(onDone: () => void): void {
  const legacyRef = doc(db, 'appdata', 'main');
  getDoc(legacyRef).then(snap => {
    if (!snap.exists()) { onDone(); return; }
    const data = snap.data();
    const expenses: Expense[]  = data.expenses  || [];
    const plans: Plan[]        = data.plans      || [];
    const payments: Payment[]  = data.payments   || [];
    const settings: Settings   = data.settings   || { periods: [], theme: 'default', font: 'Nunito' };
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

// ── Poda del log de actividad ─────────────────────────────────────────────────
// El log crece con cada operación y nunca se leía más allá de 50 entradas.
// Una vez por sesión borramos todo lo que exceda las últimas `keep` entradas
// para que la colección no crezca indefinidamente.
export function pruneActivityLog(keep: number = 100): void {
  getDocs(query(activityLogCol(), orderBy('timestamp', 'desc')))
    .then(snap => {
      if (snap.docs.length <= keep) return;
      const batch = writeBatch(db);
      snap.docs.slice(keep).forEach(d => batch.delete(d.ref));
      batch.commit().catch(e => console.error('Firestore [pruneActivityLog]:', e));
    })
    .catch(e => console.error('Firestore [pruneActivityLog]:', e));
}

// ── Error en escrituras ───────────────────────────────────────────────────────
// Todas las escrituras a Firestore son optimistas (el estado local se actualiza
// primero). Si la nube rechaza la operación, avisamos en lugar de fallar mudos.
function reportWriteError(op: string) {
  return (err: unknown) => {
    console.error('Firestore [' + op + ']:', err);
    useAppStore.getState().showMsg('⚠ No se pudo sincronizar con la nube. Revisá tu conexión e intentá de nuevo.');
  };
}

// ── Activity log type ─────────────────────────────────────────────────────────
export interface ActivityEntry {
  id: string;
  action: 'add' | 'edit' | 'delete';
  description: string;
  amount?: number;
  currency?: string;
  doneBy: string;
  timestamp: string;
}

// ── Store actions interface ───────────────────────────────────────────────────
interface AppActions {
  setCurrentUser: (u: UserName | null) => void;
  setAuthDenied:  (v: boolean) => void;
  setLoading:     (v: boolean) => void;
  setUserTheme:   (theme: string)     => void;
  setUserFont:    (font: string)      => void;
  saveUserPreferences: (theme: string, font: string) => void;
  setActivityLog: (entries: ActivityEntry[]) => void;
  setLastReadTs:  (ts: string) => void;
  markAllRead:    () => void;
  setView:             (v: string)                    => void;
  setEditingExpense:   (e: Expense | null)            => void;
  setEditingPlan:      (p: Plan | null)               => void;
  setPendingDelete:    (d: AppState['pendingDelete']) => void;
  setPayModal:         (m: AppState['payModal'])      => void;
  showToast:           (expense: Expense)             => void;
  showMsg:             (msg: string, ms?: number)     => void;
  handleSignOut:       () => void;
  handleAdd:           (expense: Expense)             => void;
  handleAddMultiple:   (exps: Expense[])              => void;
  handleEdit:          (expense: Expense)             => void;
  requestDelete:       (id: string, expense: Expense) => void;
  confirmDelete:       () => void;
  handleAddPlan:       (formData: Expense, numInstallments: number, paidInstallments: number, manualStartPeriod: string | null) => void;
  handleEditPlan:      (planId: string, formData: Expense, numInstallments: number, paidInstallments: number, manualStartPeriod: string | null) => void;
  handleCancelPlan:    (planId: string) => void;
  openPaymentModal:    (currency: Currency, netBal: number, period?: string) => void;
  confirmPayment:      (paymentData: Payment) => void;
  deletePayment:       (id: string) => void;
  saveCustomCats:      (cats: string[]) => void;
  saveSettings:        (s: Settings)    => void;
  exportCSV:           (from: string, to: string) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────
const useAppStore = create<AppState & AppActions>((set, get) => ({
  currentUser:    null,
  authDenied:     false,
  loading:        true,
  userTheme:      'default',
  userFont:       'Nunito',
  activityLog:    [] as ActivityEntry[],
  lastReadTs:     '',
  view:           'dashboard',
  editingExpense: null,
  editingPlan:    null,
  pendingDelete:  null,
  payModal:       null,
  toast:          null,
  syncMsg:        '',

  // Auth
  setCurrentUser: u => set({ currentUser: u }),
  setAuthDenied:  v => set({ authDenied: v }),
  setLoading:     v => set({ loading: v }),

  // Per-user preferences
  setUserTheme: theme => set({ userTheme: theme }),
  setUserFont:  font  => set({ userFont: font }),
  saveUserPreferences: (theme, font) => {
    const state = get();
    set({ userTheme: theme, userFont: font });
    if (state.currentUser) {
      setDoc(userPrefDoc(state.currentUser), { theme, font }, { merge: true })
        .catch(reportWriteError('saveUserPreferences'));
    }
  },

  // Activity log
  setActivityLog: entries => set({ activityLog: entries }),
  setLastReadTs:  ts      => set({ lastReadTs: ts }),
  markAllRead: () => {
    const now = new Date().toISOString();
    const state = get();
    set({ lastReadTs: now });
    if (state.currentUser) {
      setDoc(userPrefDoc(state.currentUser), { lastReadTs: now }, { merge: true })
        .catch(reportWriteError('markAllRead'));
    }
  },

  // UI
  setView:           v => set({ view: v }),
  setEditingExpense: e => set({ editingExpense: e }),
  setEditingPlan:    p => set({ editingPlan: p }),
  setPendingDelete:  d => set({ pendingDelete: d }),
  setPayModal:       m => set({ payModal: m }),

  showToast: expense => {
    const t = {
      category: expense.category || '',
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

  handleSignOut: () => signOut(auth),

  // ── Internal helper — logs activity to Firestore ───────────────────────────
  _logActivity: (action: 'add' | 'edit' | 'delete', expense: Expense) => {
    const state = get();
    if (!state.currentUser) return;
    const entry: ActivityEntry = {
      id: genId('log'),
      action,
      description: expense.description || '',
      amount: safeN(expense.amount),
      currency: expense.currency || 'ARS',
      doneBy: state.currentUser,
      timestamp: new Date().toISOString(),
    };
    // El log es secundario — si falla no molestamos al usuario, solo consola.
    setDoc(activityLogDoc(entry.id), entry).catch(e => console.error('Firestore [activityLog]:', e));
  },

  // Expense actions
  handleAdd: expense => {
    const state = get();
    const allCats = DEFAULT_CATS.concat(getCats());
    const s = sanitize({ ...expense, id: genId() }, allCats);
    checkExpenseForWrite(s);
    setExps([s, ...getExps()]);
    set({ view: 'dashboard' });
    setDoc(expenseDoc(s.id), s).catch(reportWriteError('handleAdd'));
    state.showToast(s);
    (state as any)._logActivity('add', s);
  },

  handleAddMultiple: exps => {
    const state = get();
    const allCats = DEFAULT_CATS.concat(getCats());
    const sanitized = exps.map(e => sanitize(e, allCats));
    const batch = writeBatch(db);
    sanitized.forEach(s => { checkExpenseForWrite(s); batch.set(expenseDoc(s.id), s); });
    batch.commit().catch(reportWriteError('handleAddMultiple'));
    setExps([...sanitized, ...getExps()]);
    set({ view: 'dashboard' });
    const last = sanitized[sanitized.length - 1];
    state.showToast(last);
    (state as any)._logActivity('add', last);
  },

  handleEdit: expense => {
    const state = get();
    const allCats = DEFAULT_CATS.concat(getCats());
    const s = sanitize(expense, allCats);
    checkExpenseForWrite(s);
    setExps(getExps().map(e => e.id === s.id ? s : e));
    set({ editingExpense: null });
    setDoc(expenseDoc(s.id), s).catch(reportWriteError('handleEdit'));
    state.showToast(s);
    (state as any)._logActivity('edit', s);
  },

  requestDelete: (id, expense) => set({ pendingDelete: { id, expense } }),

  confirmDelete: () => {
    const state = get();
    if (!state.pendingDelete) return;
    const { id, expense } = state.pendingDelete;
    setExps(getExps().filter(e => e.id !== id));
    set({ pendingDelete: null });
    deleteDoc(expenseDoc(id)).catch(reportWriteError('confirmDelete'));
    (state as any)._logActivity('delete', expense);
  },

  // Plan actions
  handleAddPlan: (formData, numInstallments, paidInstallments, manualStartPeriod) => {
    const state = get();
    const paid = paidInstallments || 0;
    const installmentAmount = Math.round(safeN(formData.amount) / numInstallments);
    const amts = calcAmts(installmentAmount, formData.responsible);
    const startPeriod = manualStartPeriod || getPeriod(formData.date, getCfg().periods);
    const plan: Plan = {
      id: genId('plan'),
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
    const installments = generatePlanExpenses(plan, getCfg().periods);
    const batch = writeBatch(db);
    checkPlanForWrite(plan);
    batch.set(planDoc(plan.id), plan);
    installments.forEach(inst => { checkExpenseForWrite(inst); batch.set(expenseDoc(inst.id), inst); });
    batch.commit().catch(reportWriteError('handleAddPlan'));
    setExps([...installments, ...getExps()]);
    setPlans([...getPlans(), plan]);
    set({ view: 'dashboard' });
  },

  // Edita el plan "madre" y regenera sus cuotas. Mantiene el mismo id de plan.
  // No se editan cuotas individuales: se reconstruyen desde el plan actualizado.
  handleEditPlan: (planId, formData, numInstallments, paidInstallments, manualStartPeriod) => {
    const state = get();
    const existing = getPlans().find(p => p.id === planId);
    const paid = paidInstallments || 0;
    const installmentAmount = Math.round(safeN(formData.amount) / numInstallments);
    const amts = calcAmts(installmentAmount, formData.responsible);
    const startPeriod = manualStartPeriod || getPeriod(formData.date, getCfg().periods);
    const plan: Plan = {
      id: planId,
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
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    const oldExps = getExps().filter(e => e.planId === planId);
    const installments = generatePlanExpenses(plan, getCfg().periods);
    const newIds = new Set(installments.map(i => i.id));
    const batch = writeBatch(db);
    // Borrar solo las cuotas viejas que ya no existen (las que se mantienen se
    // sobrescriben con set — evita escribir dos veces el mismo doc en el batch).
    oldExps.filter(e => !newIds.has(e.id)).forEach(e => batch.delete(expenseDoc(e.id)));
    checkPlanForWrite(plan);
    batch.set(planDoc(plan.id), plan);
    installments.forEach(inst => { checkExpenseForWrite(inst); batch.set(expenseDoc(inst.id), inst); });
    batch.commit().catch(reportWriteError('handleEditPlan'));
    const otherExps = getExps().filter(e => e.planId !== planId);
    setExps([...installments, ...otherExps]);
    setPlans(getPlans().map(p => p.id === planId ? plan : p));
    set({
      editingPlan: null,
      view: 'dashboard',
    });
    state.showMsg('✓ Plan actualizado.');
  },

  handleCancelPlan: planId => {
    const planExps = getExps().filter(e => e.planId === planId);
    const batch = writeBatch(db);
    batch.delete(planDoc(planId));
    planExps.forEach(e => batch.delete(expenseDoc(e.id)));
    batch.commit().catch(reportWriteError('handleCancelPlan'));
    setExps(getExps().filter(e => e.planId !== planId));
    setPlans(getPlans().filter(p => p.id !== planId));
  },

  // Payment actions
  openPaymentModal: (currency, netBal, period?) => set({ payModal: { currency, netBal, period } }),

  confirmPayment: paymentData => {
    const state = get();
    checkPaymentForWrite(paymentData);
    setPays([...getPays(), paymentData]);
    set({ payModal: null });
    setDoc(paymentDoc(paymentData.id), paymentData).catch(reportWriteError('confirmPayment'));
    state.showMsg('✓ Pago registrado correctamente.');
  },

  deletePayment: id => {
    const state = get();
    setPays(getPays().filter(p => p.id !== id));
    deleteDoc(paymentDoc(id)).catch(reportWriteError('deletePayment'));
    state.showMsg('✓ Pago eliminado.');
  },

  // Settings
  saveCustomCats: cats => {
    setCats(cats);
    setDoc(settingsDoc(), { ...getCfg(), customCats: cats })
      .catch(reportWriteError('saveCustomCats'));
  },

  saveSettings: s => {
    const state = get();
    // Re-bucketea TODOS los gastos según los períodos nuevos (re-ubica los que
    // habían quedado "Sin período" y ahora caen en un período definido).
    const current = getExps();
    const updated = reassignExpensePeriods(current, s.periods, getPlans());
    // Escribir en batch (no doc por doc) — Firestore limita 500 ops por batch.
    const changed = updated.filter((e, i) => e.period !== current[i]?.period);
    for (let i = 0; i < changed.length; i += 450) {
      const batch = writeBatch(db);
      changed.slice(i, i + 450).forEach(e => { checkExpenseForWrite(e); batch.set(expenseDoc(e.id), e); });
      batch.commit().catch(reportWriteError('saveSettings/expenses'));
    }
    setExps(updated);
    setCfg(s);
    setDoc(settingsDoc(), { ...s, customCats: getCats() })
      .catch(reportWriteError('saveSettings'));
    state.showMsg(changed.length > 0
      ? '✓ Guardado · ' + changed.length + ' gasto' + (changed.length !== 1 ? 's' : '') + ' reubicado' + (changed.length !== 1 ? 's' : '')
      : '✓ Configuración guardada.');
  },

  // CSV Export
  exportCSV: (from, to) => {
    const state = get();
    const filtered = getExps().filter(e => {
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
