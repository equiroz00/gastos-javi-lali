// ── src/App.tsx ───────────────────────────────────────────────────────────────
import React, { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { auth } from './firebase';
import { C, F, USER_MAP, applyTheme, FONTS } from './constants';
import type { UserName, Settings, Expense, Plan, Payment } from './types';
import useAppStore from './store/useAppStore';
import {
  runMigrationIfNeeded, settingsDoc,
  expensesCol, plansCol, paymentsCol,
} from './store/useAppStore';
import LoginScreen    from './components/LoginScreen.jsx';
import Dashboard      from './components/Dashboard.jsx';
import AddEditExpense from './components/AddEditExpense.jsx';
import History        from './components/History.jsx';
import Stats          from './components/Stats.jsx';
import Settings       from './components/Settings.jsx';
import { Toast, ConfirmDialog, PaymentModal } from './components/ui.jsx';

// Module-level unsubscribes — avoid stale closures
let _unsubs: Array<() => void> = [];
let _unsubAuth: (() => void) | null = null;

interface Tab { id: string; icon: string; label: string; }
const TABS: Tab[] = [
  { id:'dashboard', icon:'🏠', label:'Inicio'   },
  { id:'add',       icon:'➕', label:'Agregar'  },
  { id:'stats',     icon:'📊', label:'Stats'    },
  { id:'history',   icon:'📋', label:'Historial'},
  { id:'settings',  icon:'⚙️', label:'Config'   },
];

export default function App() {
  const currentUser    = useAppStore(s => s.currentUser);
  const authDenied     = useAppStore(s => s.authDenied);
  const loading        = useAppStore(s => s.loading);
  const view           = useAppStore(s => s.view);
  const editingExpense = useAppStore(s => s.editingExpense);
  const settings       = useAppStore(s => s.settings);
  const syncMsg        = useAppStore(s => s.syncMsg);

  const setCurrentUser = useAppStore(s => s.setCurrentUser);
  const setAuthDenied  = useAppStore(s => s.setAuthDenied);
  const setLoading     = useAppStore(s => s.setLoading);
  const setExpenses    = useAppStore(s => s.setExpenses);
  const setPlans       = useAppStore(s => s.setPlans);
  const setPayments    = useAppStore(s => s.setPayments);
  const setSettings    = useAppStore(s => s.setSettings);
  const setCustomCats  = useAppStore(s => s.setCustomCats);
  const setView        = useAppStore(s => s.setView);
  const setEditingExpense = useAppStore(s => s.setEditingExpense);

  applyTheme(settings.theme || 'default', settings.font || 'Nunito');

  useEffect(() => {
    const fontKey = settings.font || 'Nunito';
    const fd = FONTS[fontKey as keyof typeof FONTS] || FONTS.Nunito;
    const l = document.createElement('link');
    l.href = `https://fonts.googleapis.com/css2?family=${fd.url}&display=swap`;
    l.rel = 'stylesheet';
    document.head.appendChild(l);
    document.body.style.fontFamily = fd.css;
    document.body.style.background = C.bg;
  }, [settings.font]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, firebaseUser => {
      if (!firebaseUser) {
        _unsubs.forEach(u => u()); _unsubs = [];
        setCurrentUser(null); setAuthDenied(false); setLoading(false);
        return;
      }
      const name = USER_MAP[firebaseUser.uid] as UserName | undefined;
      if (!name) {
        _unsubs.forEach(u => u()); _unsubs = [];
        setCurrentUser(null); setAuthDenied(true); setLoading(false);
        return;
      }
      setAuthDenied(false); setCurrentUser(name);

      runMigrationIfNeeded(() => {
        _unsubs.forEach(u => u()); _unsubs = [];
        const fired = { exp: false, plans: false, pay: false, cfg: false };
        const checkDone = () => {
          if (fired.exp && fired.plans && fired.pay && fired.cfg) setLoading(false);
        };

        const u1 = onSnapshot(expensesCol(), snap => {
          setExpenses(snap.docs.map(d => d.data() as Expense));
          fired.exp = true; checkDone();
        }, e => { console.error('expenses:', e.code); fired.exp = true; checkDone(); });

        const u2 = onSnapshot(plansCol(), snap => {
          setPlans(snap.docs.map(d => d.data() as Plan));
          fired.plans = true; checkDone();
        }, e => { console.error('plans:', e.code); fired.plans = true; checkDone(); });

        const u3 = onSnapshot(paymentsCol(), snap => {
          setPayments(snap.docs.map(d => d.data() as Payment));
          fired.pay = true; checkDone();
        }, e => { console.error('payments:', e.code); fired.pay = true; checkDone(); });

        const u4 = onSnapshot(settingsDoc(), snap => {
          if (snap.exists()) {
            const cfg = snap.data();
            setSettings({ periods: cfg.periods || [], theme: cfg.theme || 'default', font: cfg.font || 'Nunito' } as Settings);
            setCustomCats(cfg.customCats || []);
          }
          fired.cfg = true; checkDone();
        }, e => { console.error('settings:', e.code); fired.cfg = true; checkDone(); });

        _unsubs = [u1, u2, u3, u4];
      });
    });
    _unsubAuth = unsubAuth;
    return () => {
      if (_unsubAuth) _unsubAuth();
      _unsubs.forEach(u => u()); _unsubs = [];
    };
  }, []);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:'1rem', background:C.bg, fontFamily:F, color:C.textMuted }}>
      <div style={{ fontSize:'2rem' }}>💑</div>
      <div>Conectando...</div>
    </div>
  );

  if (!currentUser) return <LoginScreen denied={authDenied} />;

  if (editingExpense) return (
    <div style={{ minHeight:'100vh', background:C.bg, maxWidth:'480px', margin:'0 auto', fontFamily:F, overflowY:'auto' }}>
      <AddEditExpense isEditMode initialData={{ ...editingExpense, amount: String(editingExpense.amount) }} />
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', maxWidth:'480px', margin:'0 auto', fontFamily:F }}>
      <ConfirmDialog />
      <PaymentModal />
      <Toast />

      {/* Header */}
      <div style={{ background:C.gradMain, padding:'0.75rem 1rem', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 12px rgba(0,0,0,0.2)' }}>
        <div>
          <div style={{ fontWeight:900, fontSize:'1.9rem', color:C.white, lineHeight:1.1, fontFamily:F }}>💑 Javi & Lali</div>
          <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.75)', fontFamily:F }}>
            Hola, <span style={{ fontWeight:900, color:C.white }}>{currentUser}</span>
          </div>
        </div>
        <button
          onClick={() => useAppStore.getState().handleSignOut()}
          style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:'0.6rem', padding:'0.35rem 0.7rem', fontSize:'0.75rem', color:C.white, cursor:'pointer', fontFamily:F, fontWeight:700 }}
        >
          Salir
        </button>
      </div>

      {/* Sync message */}
      {syncMsg && (
        <div style={{ margin:'0.75rem 1rem 0', padding:'0.6rem 0.85rem', background:syncMsg.startsWith('✓') ? '#d4f5eb' : '#fdf0d5', borderRadius:'0.75rem', fontSize:'0.8rem', color:syncMsg.startsWith('✓') ? '#1a6e4f' : '#7a5c1a', fontWeight:700, border:'1px solid ' + (syncMsg.startsWith('✓') ? '#a8e8cf' : '#f0d898') }}>
          {syncMsg}
        </div>
      )}

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', paddingBottom:'5rem', paddingTop:'0.75rem' }}>
        {view === 'dashboard' && <Dashboard />}
        {view === 'add'       && <AddEditExpense />}
        {view === 'stats'     && <Stats />}
        {view === 'history'   && <History />}
        {view === 'settings'  && <Settings />}
      </div>

      {/* Bottom nav */}
      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:'480px', background:C.surface, borderTop:'1px solid '+C.border, display:'flex', boxShadow:'0 -2px 12px rgba(0,0,0,0.1)', zIndex:10 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'0.5rem 0', border:'none', background:'none', cursor:'pointer', fontFamily:F, color:view===t.id ? C.navy : C.textMuted, fontSize:'0.6rem', fontWeight:view===t.id ? 900 : 500, gap:'0.1rem' }}
          >
            <span style={{ fontSize:'1.2rem', lineHeight:1 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
