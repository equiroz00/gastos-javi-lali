// ── store/useAppStore.js ──────────────────────────────────────────────────────
import { create } from 'zustand';
import { db, auth } from '../firebase.js';
import { collection, doc, setDoc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { getPeriod, generatePlanExpenses, reassignPlanExpenses, sanitize, calcAmts, safeN } from '../lib/helpers.js';
import { DEFAULT_CATS } from '../constants.js';

// ── Firestore refs ────────────────────────────────────────────────────────────
export function expenseDoc(id){ return doc(db,'expenses',id); }
export function planDoc(id){ return doc(db,'plans',id); }
export function paymentDoc(id){ return doc(db,'payments',id); }
export function settingsDoc(){ return doc(db,'settings','main'); }
export function expensesCol(){ return collection(db,'expenses'); }
export function plansCol(){ return collection(db,'plans'); }
export function paymentsCol(){ return collection(db,'payments'); }

// ── Migration from legacy appdata/main ────────────────────────────────────────
export function runMigrationIfNeeded(onDone){
  var legacyRef=doc(db,'appdata','main');
  getDoc(legacyRef).then(function(snap){
    if(!snap.exists()){onDone();return;}
    var data=snap.data();
    var expenses=data.expenses||[];
    var plans=data.plans||[];
    var payments=data.payments||[];
    var settings=data.settings||{periods:[],theme:'default',font:'Nunito'};
    var customCats=data.customCats||[];
    var batch=writeBatch(db);
    expenses.forEach(function(e){batch.set(expenseDoc(e.id),e);});
    plans.forEach(function(p){batch.set(planDoc(p.id),p);});
    payments.forEach(function(p){batch.set(paymentDoc(p.id),p);});
    batch.set(settingsDoc(),Object.assign({},settings,{customCats:customCats}));
    batch.delete(legacyRef);
    batch.commit().then(function(){onDone();}).catch(function(){onDone();});
  }).catch(function(){onDone();});
}

// ── Zustand store ─────────────────────────────────────────────────────────────
var useAppStore = create(function(set, get) {
  return {
    // ── Auth state ──────────────────────────────────────────────────────────
    currentUser: null,
    authDenied: false,
    loading: true,

    // ── Data state ──────────────────────────────────────────────────────────
    expenses: [],
    plans: [],
    payments: [],
    settings: { periods:[], theme:'default', font:'Nunito' },
    customCats: [],

    // ── UI state ────────────────────────────────────────────────────────────
    view: 'dashboard',
    editingExpense: null,
    pendingDelete: null,
    payModal: null,
    toast: null,
    syncMsg: '',

    // ── Auth setters (called from App.jsx's onAuthStateChanged) ─────────────
    setCurrentUser: function(u){ set({ currentUser: u }); },
    setAuthDenied: function(v){ set({ authDenied: v }); },
    setLoading: function(v){ set({ loading: v }); },

    // ── Data setters (called from App.jsx's onSnapshot callbacks) ───────────
    setExpenses: function(exps){ set({ expenses: exps }); },
    setPlans: function(ps){ set({ plans: ps }); },
    setPayments: function(pays){ set({ payments: pays }); },
    setSettings: function(s){ set({ settings: s }); },
    setCustomCats: function(cats){ set({ customCats: cats }); },

    // ── UI actions ───────────────────────────────────────────────────────────
    setView: function(v){ set({ view: v }); },
    setEditingExpense: function(e){ set({ editingExpense: e }); },
    setPendingDelete: function(d){ set({ pendingDelete: d }); },
    setPayModal: function(m){ set({ payModal: m }); },

    showToast: function(expense){
      var t = { emoji: catEm(expense.category), description: expense.description||'Gasto guardado', amount: fmt(safeN(expense.amount), expense.currency||'ARS') };
      setTimeout(function(){ set({ toast: t }); }, 300);
      setTimeout(function(){ set({ toast: null }); }, 2800);
    },

    showMsg: function(msg, ms){
      set({ syncMsg: msg });
      setTimeout(function(){ set({ syncMsg: '' }); }, ms||5000);
    },

    handleSignOut: function(){
      signOut(auth);
    },

    // ── Expense actions ───────────────────────────────────────────────────────
    handleAdd: function(expense){
      var state = get();
      var allCats = DEFAULT_CATS.concat(state.customCats);
      var s = sanitize(Object.assign({}, expense, { id: Date.now().toString() }), allCats);
      set({ expenses: [s].concat(state.expenses), view: 'dashboard' });
      setDoc(expenseDoc(s.id), s);
      state.showToast(s);
    },

    handleAddMultiple: function(exps){
      var state = get();
      var allCats = DEFAULT_CATS.concat(state.customCats);
      var sanitized = exps.map(function(e){ return sanitize(e, allCats); });
      var batch = writeBatch(db);
      sanitized.forEach(function(s){ batch.set(expenseDoc(s.id), s); });
      batch.commit();
      set({ expenses: sanitized.concat(state.expenses), view: 'dashboard' });
      state.showToast(sanitized[sanitized.length-1]);
    },

    handleEdit: function(expense){
      var state = get();
      var allCats = DEFAULT_CATS.concat(state.customCats);
      var s = sanitize(expense, allCats);
      var updated = state.expenses.map(function(e){ return e.id===s.id?s:e; });
      set({ expenses: updated, editingExpense: null, view: 'dashboard' });
      setDoc(expenseDoc(s.id), s);
      state.showToast(s);
    },

    requestDelete: function(id, expense){
      set({ pendingDelete: { id: id, expense: expense } });
    },

    confirmDelete: function(){
      var state = get();
      if(!state.pendingDelete) return;
      var id = state.pendingDelete.id;
      set({ expenses: state.expenses.filter(function(e){ return e.id!==id; }), pendingDelete: null });
      deleteDoc(expenseDoc(id));
    },

    // ── Plan actions ──────────────────────────────────────────────────────────
    handleAddPlan: function(formData, numInstallments, paidInstallments, manualStartPeriod){
      var state = get();
      var paid = paidInstallments||0;
      var installmentAmount = Math.round(safeN(formData.amount)/numInstallments);
      var amts = calcAmts(installmentAmount, formData.responsible);
      var startPeriod = manualStartPeriod||getPeriod(formData.date, state.settings.periods);
      var plan = { id:'plan_'+Date.now(), description:formData.description, totalAmount:safeN(formData.amount), installmentAmount:installmentAmount, numInstallments:numInstallments, paidInstallments:paid, startPeriod:startPeriod, startDate:formData.date, currency:formData.currency||'ARS', paidBy:formData.paidBy, responsible:formData.responsible, paymentMethod:formData.paymentMethod, bank:formData.bank, category:formData.category, javiAmount:amts.javiAmount, laliAmount:amts.laliAmount, createdAt:new Date().toISOString() };
      var installments = generatePlanExpenses(plan, state.settings.periods);
      var batch = writeBatch(db);
      batch.set(planDoc(plan.id), plan);
      installments.forEach(function(inst){ batch.set(expenseDoc(inst.id), inst); });
      batch.commit();
      set({ plans: state.plans.concat([plan]), expenses: installments.concat(state.expenses), view: 'dashboard' });
    },

    handleCancelPlan: function(planId){
      var state = get();
      var planExps = state.expenses.filter(function(e){ return e.planId===planId; });
      var batch = writeBatch(db);
      batch.delete(planDoc(planId));
      planExps.forEach(function(e){ batch.delete(expenseDoc(e.id)); });
      batch.commit();
      set({ plans: state.plans.filter(function(p){ return p.id!==planId; }), expenses: state.expenses.filter(function(e){ return e.planId!==planId; }) });
    },

    // ── Payment actions ───────────────────────────────────────────────────────
    openPaymentModal: function(currency, netBal){
      set({ payModal: { currency: currency, netBal: netBal } });
    },

    confirmPayment: function(paymentData){
      var state = get();
      set({ payments: state.payments.concat([paymentData]), payModal: null });
      setDoc(paymentDoc(paymentData.id), paymentData);
      state.showMsg('✓ Pago registrado correctamente.');
    },

    // ── Settings actions ──────────────────────────────────────────────────────
    saveCustomCats: function(cats){
      var state = get();
      set({ customCats: cats });
      setDoc(settingsDoc(), Object.assign({}, state.settings, { customCats: cats }));
    },

    saveSettings: function(s){
      var state = get();
      var updated = state.expenses.map(function(e){
        return Object.assign({}, e, { period: (!e.fromPlan&&e.date) ? getPeriod(e.date,s.periods) : (e.period||'Sin período') });
      });
      if(s.periods&&s.periods.length) updated = reassignPlanExpenses(updated, s.periods, state.plans);
      updated.forEach(function(e, i){
        if(e.period !== (state.expenses[i]&&state.expenses[i].period)){ setDoc(expenseDoc(e.id), e); }
      });
      set({ expenses: updated, settings: s });
      setDoc(settingsDoc(), Object.assign({}, s, { customCats: state.customCats }));
    },

    // ── CSV Export ────────────────────────────────────────────────────────────
    exportCSV: function(from, to){
      var state = get();
      var filtered = state.expenses.filter(function(e){
        if(!e.date) return false;
        if(from&&e.date<from) return false;
        if(to&&e.date>to) return false;
        return true;
      });
      if(!filtered.length){ state.showMsg('No hay gastos en ese rango.'); return; }
      var header = ['Fecha','Descripción','Monto','Moneda','Categoría','Medio de Pago','Banco','Pagó','Responsable','Monto Javi','Monto Lali','Período'];
      var rows = [header].concat(filtered.map(function(e){ return [e.date,e.description,safeN(e.amount),e.currency||'ARS',e.category||'',e.paymentMethod||'',e.bank||'',e.paidBy,e.responsible,safeN(e.javiAmount),safeN(e.laliAmount),e.period||'']; }));
      var csv = rows.map(function(r){ return r.map(function(v){ return '"'+String(v).replace(/"/g,'""')+'"'; }).join(','); }).join('\n');
      var dataStr = 'data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);
      var a = document.createElement('a'); a.setAttribute('href',dataStr); a.setAttribute('download','gastos_'+(from||'inicio')+'_al_'+(to||'hoy')+'.csv'); document.body.appendChild(a); a.click(); document.body.removeChild(a);
      state.showMsg('✓ CSV con '+filtered.length+' gastos descargado.');
    },
  };
});

export default useAppStore;
