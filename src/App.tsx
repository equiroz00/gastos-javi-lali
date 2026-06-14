// ── src/App.tsx ───────────────────────────────────────────────────────────────
import React, { useEffect } from 'react';
import { Loader2, Home, Plus, BarChart2, ClipboardList, Settings2, LogOut, Wallet } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { auth } from './firebase.js';
import { C, F, USER_MAP, applyTheme, FONTS, MAXW, SP } from './constants.js';
import type { UserName, Settings, Expense, Plan, Payment } from './types.js';
import type { ActivityEntry } from './store/useAppStore.js';
import useAppStore from './store/useAppStore.js';
import {
  runMigrationIfNeeded, pruneActivityLog, settingsDoc,
  expensesCol, plansCol, paymentsCol, userPrefDoc, activityLogCol,
} from './store/useAppStore.js';
import LoginScreen       from './components/LoginScreen';
import Dashboard         from './components/Dashboard';
import AddEditExpense    from './components/AddEditExpense';
import History           from './components/History';
import SettingsScreen    from './components/Settings';
import { useIsDesktop }  from './lib/useIsDesktop';

// Stats carga recharts (~400 kB): se trae bajo demanda al abrir la pestaña,
// así la carga inicial de la app es mucho más liviana.
const Stats = React.lazy(() => import('./components/Stats'));
import NotificationPanel from './components/NotificationPanel';
import { Toast, ConfirmDialog, PaymentModal } from './components/ui';

let _unsubs: Array<() => void> = [];
let _unsubAuth: (() => void) | null = null;

// ── Greeting helper ───────────────────────────────────────────────────────────
function getGreeting(name: string | null): string {
  // Argentina timezone (UTC-3)
  const arHour = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })).getHours();
  const saludo = arHour >= 5 && arHour < 12 ? 'Buenos días'
               : arHour >= 12 && arHour < 19 ? 'Buenas tardes'
               : 'Buenas noches';
  return name ? `${saludo}, ${name}` : saludo;
}

interface Tab { id: string; icon: React.ReactNode; label: string; }
// 'add' is always at index 2 (center) — rendered as FAB
const TABS: Tab[] = [
  { id:'dashboard', icon:<Home          size={20} strokeWidth={1.8} />, label:'Inicio'    },
  { id:'stats',     icon:<BarChart2     size={20} strokeWidth={1.8} />, label:'Stats'     },
  { id:'add',       icon:<Plus          size={26} strokeWidth={2.5} />, label:'Agregar'   },
  { id:'history',   icon:<ClipboardList size={20} strokeWidth={1.8} />, label:'Historial' },
  { id:'settings',  icon:<Settings2     size={20} strokeWidth={1.8} />, label:'Config'    },
];

export default function App() {
  const isDesktop      = useIsDesktop();
  const currentUser    = useAppStore(s => s.currentUser);
  const authDenied     = useAppStore(s => s.authDenied);
  const loading        = useAppStore(s => s.loading);
  const view           = useAppStore(s => s.view);
  const editingExpense = useAppStore(s => s.editingExpense);
  const syncMsg        = useAppStore(s => s.syncMsg);
  const userTheme      = useAppStore(s => s.userTheme);
  const userFont       = useAppStore(s => s.userFont);

  const setCurrentUser    = useAppStore(s => s.setCurrentUser);
  const setAuthDenied     = useAppStore(s => s.setAuthDenied);
  const setLoading        = useAppStore(s => s.setLoading);
  const setExpenses       = useAppStore(s => s.setExpenses);
  const setPlans          = useAppStore(s => s.setPlans);
  const setPayments       = useAppStore(s => s.setPayments);
  const setSettings       = useAppStore(s => s.setSettings);
  const setCustomCats     = useAppStore(s => s.setCustomCats);
  const setUserTheme      = useAppStore(s => s.setUserTheme);
  const setUserFont       = useAppStore(s => s.setUserFont);
  const setActivityLog    = useAppStore(s => s.setActivityLog);
  const setLastReadTs     = useAppStore(s => s.setLastReadTs);
  const setView           = useAppStore(s => s.setView);
  const setEditingExpense = useAppStore(s => s.setEditingExpense);

  applyTheme(userTheme || 'default', userFont || 'Nunito');

  useEffect(() => {
    const fd = FONTS[(userFont || 'Nunito') as keyof typeof FONTS] || FONTS.Nunito;
    const l = document.createElement('link');
    l.href = `https://fonts.googleapis.com/css2?family=${fd.url}&family=JetBrains+Mono:wght@500;600;700&display=swap`;
    l.rel = 'stylesheet';
    document.head.appendChild(l);
    document.body.style.fontFamily = fd.css;
    document.body.style.background = C.bg;
  }, [userFont]);

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
        pruneActivityLog();
        _unsubs.forEach(u => u()); _unsubs = [];
        const fired = { exp:false, plans:false, pay:false, cfg:false, prefs:false, log:false };
        const checkDone = () => {
          if (fired.exp && fired.plans && fired.pay && fired.cfg && fired.prefs && fired.log) setLoading(false);
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

        const u5 = onSnapshot(userPrefDoc(name), snap => {
          if (snap.exists()) {
            const prefs = snap.data();
            if (prefs.theme)      setUserTheme(prefs.theme);
            if (prefs.font)       setUserFont(prefs.font);
            if (prefs.lastReadTs) setLastReadTs(prefs.lastReadTs);
          }
          fired.prefs = true; checkDone();
        }, e => { console.error('userPrefs:', e.code); fired.prefs = true; checkDone(); });

        const logQ = query(activityLogCol(), orderBy('timestamp', 'desc'), limit(50));
        const u6 = onSnapshot(logQ, snap => {
          setActivityLog(snap.docs.map(d => d.data() as ActivityEntry));
          fired.log = true; checkDone();
        }, e => { console.error('activityLog:', e.code); fired.log = true; checkDone(); });

        _unsubs = [u1, u2, u3, u4, u5, u6];
      });
    });
    _unsubAuth = unsubAuth;
    return () => {
      if (_unsubAuth) _unsubAuth();
      _unsubs.forEach(u => u()); _unsubs = [];
    };
  }, []);

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:'1rem', background:'#111', fontFamily:F }}>
      <Loader2 size={40} color="#C5BFAE" strokeWidth={1.5} style={{ animation:'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <p style={{ color:'#C5BFAE', fontSize:'0.9rem', margin:0, opacity:0.8 }}>{getGreeting(currentUser)}</p>
    </div>
  );

  if (!currentUser) return <LoginScreen denied={authDenied} />;

  // ── Edit mode (both mobile and desktop use same form) ──────────────────────
  if (editingExpense) return (
    <div style={{ minHeight:'100vh', background:C.bg, maxWidth: isDesktop ? '600px' : '480px', margin:'0 auto', fontFamily:F, overflowY:'auto' }}>
      <AddEditExpense isEditMode initialData={{ ...editingExpense, amount: String(editingExpense.amount) }} />
    </div>
  );

  // ── Shared header ──────────────────────────────────────────────────────────
  const Header = (
    <div style={{ background:C.surface, padding:'0.8rem 1rem', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:10, borderBottom:'1px solid '+C.border }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
        <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:C.accent, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Wallet size={19} strokeWidth={2.2} color={C.white} />
        </div>
        <div>
          <div style={{ fontWeight:800, fontSize:'1.05rem', color:C.navy, lineHeight:1.1, fontFamily:F, letterSpacing:'-0.01em' }}>Javi &amp; Lali</div>
          <div style={{ fontSize:'0.72rem', color:C.textMuted, fontFamily:F, marginTop:'0.05rem' }}>{getGreeting(currentUser)}</div>
        </div>
      </div>
      <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
        <NotificationPanel />
        <button
          onClick={() => useAppStore.getState().handleSignOut()}
          style={{ background:'transparent', border:'1px solid '+C.border, borderRadius:'0.6rem', padding:'0.4rem 0.6rem', color:C.textMuted, cursor:'pointer', display:'flex', alignItems:'center', gap:'0.35rem' }}
        >
          <LogOut size={15} strokeWidth={2} />
          <span style={{ fontSize:'0.75rem', fontWeight:600, fontFamily:F }}>Salir</span>
        </button>
      </div>
    </div>
  );

  const SyncBar = syncMsg ? (
    <div style={{ margin:'0.75rem 1rem 0', padding:'0.6rem 0.85rem', background:syncMsg.startsWith('✓') ? '#d4f5eb' : '#fdf0d5', borderRadius:'0.75rem', fontSize:'0.8rem', color:syncMsg.startsWith('✓') ? '#1a6e4f' : '#7a5c1a', fontWeight:700, border:'1px solid ' + (syncMsg.startsWith('✓') ? '#a8e8cf' : '#f0d898') }}>
      {syncMsg}
    </div>
  ) : null;

  const statsFallback = (
    <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}>
      <Loader2 size={28} color={C.textMuted} strokeWidth={1.5} style={{ animation:'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const Content = (
    <>
      {view === 'dashboard' && <Dashboard />}
      {view === 'add'       && <AddEditExpense />}
      {view === 'stats'     && <React.Suspense fallback={statsFallback}><Stats /></React.Suspense>}
      {view === 'history'   && <History />}
      {view === 'settings'  && <SettingsScreen />}
    </>
  );

  // ── DESKTOP layout ─────────────────────────────────────────────────────────
  if (isDesktop) {
    // Sidebar nav items (no FAB on desktop — just a prominent button)
    const sideNavTabs = TABS.filter(t => t.id !== 'add');
    return (
      <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', fontFamily:F }}>
        <ConfirmDialog /><PaymentModal /><Toast />
        {Header}
        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
          {/* Sidebar */}
          <div style={{ width:'200px', flexShrink:0, background:C.surface, borderRight:'1px solid '+C.border, display:'flex', flexDirection:'column', padding:'1rem 0.75rem', gap:'0.35rem', position:'sticky', top:0, height:'calc(100vh - 56px)', overflowY:'auto' }}>
            {/* Add button — prominent at top of sidebar */}
            <button
              onClick={() => setView('add')}
              style={{ display:'flex', alignItems:'center', gap:'0.65rem', padding:'0.7rem 1rem', borderRadius:'0.9rem', border:'none', cursor:'pointer', fontFamily:F, fontWeight:800, fontSize:'0.85rem', background:C.gradMain, color:C.white, boxShadow:'0 4px 14px rgba(0,0,0,0.18)', marginBottom:'0.5rem' }}
            >
              <Plus size={18} strokeWidth={2.5} />
              Agregar gasto
            </button>
            {sideNavTabs.map(t => {
              const active = view === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setView(t.id)}
                  style={{ display:'flex', alignItems:'center', gap:'0.65rem', padding:'0.65rem 1rem', borderRadius:'0.75rem', border:'none', cursor:'pointer', fontFamily:F, fontWeight:active ? 800 : 500, fontSize:'0.85rem', background:active ? C.navy+'18' : 'transparent', color:active ? C.navy : C.textMuted, textAlign:'left' }}
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </div>
          {/* Main content — el scroll ocupa todo el ancho; un wrapper interno
              centra el contenido con un max-width único (MAXW) */}
          <div style={{ flex:1, overflowY:'auto', paddingTop:SP.md, paddingBottom:SP.xxl }}>
            <div style={{ maxWidth:MAXW, margin:'0 auto' }}>
              {SyncBar}
              {Content}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MOBILE layout ──────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', maxWidth:'480px', margin:'0 auto', fontFamily:F }}>
      <ConfirmDialog /><PaymentModal /><Toast />
      {Header}
      <div style={{ flex:1, overflowY:'auto', paddingBottom:'5.5rem', paddingTop:'0.75rem' }}>
        {SyncBar}
        {Content}
      </div>

      {/* Bottom nav with FAB in center */}
      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:'480px', background:C.surface, borderTop:'1px solid '+C.border, display:'flex', alignItems:'flex-end', boxShadow:'0 -2px 12px rgba(0,0,0,0.1)', zIndex:10, paddingBottom:'env(safe-area-inset-bottom)' }}>
        {TABS.map(t => {
          const isAdd = t.id === 'add';
          const active = view === t.id;
          if (isAdd) return (
            <div key={t.id} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', paddingBottom:'0.5rem' }}>
              <button
                onClick={() => setView('add')}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'54px', height:'54px', borderRadius:'50%', border:'none', cursor:'pointer', background:C.gradMain, color:C.white, boxShadow:'0 4px 16px rgba(0,0,0,0.25)', transform:'translateY(-12px)', marginBottom:'-4px' }}
              >
                <Plus size={26} strokeWidth={2.5} />
              </button>
              <span style={{ fontSize:'0.6rem', fontFamily:F, color: active ? C.navy : C.textMuted, fontWeight: active ? 900 : 500, marginTop:'2px' }}>Agregar</span>
            </div>
          );
          return (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'0.6rem 0 0.5rem', border:'none', background:'none', cursor:'pointer', fontFamily:F, color:active ? C.navy : C.textMuted, fontSize:'0.6rem', fontWeight:active ? 900 : 500, gap:'0.2rem' }}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
