// ── src/App.tsx ───────────────────────────────────────────────────────────────
import React, { useEffect } from 'react';
import { Loader2, Home, Plus, BarChart2, ClipboardList, Settings2, LogOut, Wallet } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { auth } from './firebase.js';
import { C, F, V, USER_MAP, applyTheme, FONTS, MAXW, SHELL_MAXW, SP } from './constants.js';
import { queryClient } from './lib/queryClient';
import { parseExpenses, parsePayments, parsePlans, parseSettingsDoc } from './lib/schemas';
import type { UserName, Settings, Expense, Plan, Payment } from './types.js';
import type { ActivityEntry } from './store/useAppStore.js';
import useAppStore from './store/useAppStore.js';
import {
  runMigrationIfNeeded, runPayMethodMigrationIfNeeded, runPlanVisibilityBackfill, pruneActivityLog, settingsDoc,
  expensesCol, plansCol, paymentsCol, userPrefDoc, activityLogCol,
} from './store/useAppStore.js';
import LoginScreen       from './components/LoginScreen';
import Dashboard         from './components/Dashboard';
import AddEditExpense    from './components/AddEditExpense';
import History           from './components/History';
import PersonalScreen    from './components/PersonalScreen';
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
  { id:'personal',  icon:<Wallet        size={20} strokeWidth={1.8} />, label:'Personal'  },
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
  const editingPlan    = useAppStore(s => s.editingPlan);
  const syncMsg        = useAppStore(s => s.syncMsg);
  const userTheme      = useAppStore(s => s.userTheme);
  const userFont       = useAppStore(s => s.userFont);
  const userUI         = useAppStore(s => s.userUI);

  const setCurrentUser    = useAppStore(s => s.setCurrentUser);
  const setAuthDenied     = useAppStore(s => s.setAuthDenied);
  const setLoading        = useAppStore(s => s.setLoading);
  const setUserTheme      = useAppStore(s => s.setUserTheme);
  const setUserFont       = useAppStore(s => s.setUserFont);
  const setUserUI         = useAppStore(s => s.setUserUI);
  const setActivityLog    = useAppStore(s => s.setActivityLog);
  const setLastReadTs     = useAppStore(s => s.setLastReadTs);
  const setView           = useAppStore(s => s.setView);
  const setEditingExpense = useAppStore(s => s.setEditingExpense);

  applyTheme(userTheme || 'default', userFont || 'Nunito', userUI || 'cuenta');

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
        // Antes de suscribirse: completa `visibilidad` en planes viejos, que si
        // no quedarían fuera del dual-query de abajo.
        runPlanVisibilityBackfill();
        // El backfill de splitAmong del Sprint 11 se retiró en el Sprint 12: ya
        // completó su trabajo y su lectura de la colección SIN filtro es denegada
        // por las reglas estrictas apenas existe un gasto privado del otro usuario.
        _unsubs.forEach(u => u()); _unsubs = [];
        const fired = { exp:false, plans:false, pay:false, cfg:false, prefs:false, log:false };
        const checkDone = () => {
          if (fired.exp && fired.plans && fired.pay && fired.cfg && fired.prefs && fired.log) {
            setLoading(false);
            // Con gastos y planes ya en caché: renombra las tarjetas viejas
            // ('TC Visa Laura' → 'Visa'). Idempotente y silenciosa si no hay nada.
            runPayMethodMigrationIfNeeded();
          }
        };

        // Lectura de gastos con dual-query (Sprint 11): las reglas restringen los
        // gastos privados a su dueño, así que una query SIN filtro fallaría entera
        // para el otro usuario (Firestore no filtra por permisos). Se leen por
        // separado —compartidos + mis privados— y se mergean en la misma caché.
        // Los conjuntos son disjuntos (los compartidos no tienen ownerId).
        let sharedExps: Expense[] = [];
        let ownPrivateExps: Expense[] = [];
        const applyExpenses = () => queryClient.setQueryData(['expenses'], [...sharedExps, ...ownPrivateExps]);

        const u1a = onSnapshot(query(expensesCol(), where('visibilidad', '==', 'compartido')), snap => {
          sharedExps = parseExpenses(snap.docs.map(d => d.data()));
          applyExpenses();
          fired.exp = true; checkDone();
        }, e => { console.error('expenses(compartidos):', e.code); fired.exp = true; checkDone(); });

        const u1b = onSnapshot(query(expensesCol(), where('ownerId', '==', firebaseUser.uid)), snap => {
          ownPrivateExps = parseExpenses(snap.docs.map(d => d.data()));
          applyExpenses();
        }, e => { console.error('expenses(privados):', e.code); });

        // Planes: mismo dual-query que los gastos. Con una query SIN filtro, las
        // reglas estrictas deniegan la lectura entera y "Cuotas activas" queda
        // vacía (la sección se oculta sola si no hay planes), sin más aviso que
        // un error en consola.
        let sharedPlans: Plan[] = [];
        let ownPrivatePlans: Plan[] = [];
        const applyPlans = () => queryClient.setQueryData(['plans'], [...sharedPlans, ...ownPrivatePlans]);

        const u2a = onSnapshot(query(plansCol(), where('visibilidad', '==', 'compartido')), snap => {
          sharedPlans = parsePlans(snap.docs.map(d => d.data()));
          applyPlans();
          fired.plans = true; checkDone();
        }, e => { console.error('plans(compartidos):', e.code); fired.plans = true; checkDone(); });

        const u2b = onSnapshot(query(plansCol(), where('ownerId', '==', firebaseUser.uid)), snap => {
          ownPrivatePlans = parsePlans(snap.docs.map(d => d.data()));
          applyPlans();
        }, e => { console.error('plans(privados):', e.code); });

        const u3 = onSnapshot(paymentsCol(), snap => {
          queryClient.setQueryData(['payments'], parsePayments(snap.docs.map(d => d.data())));
          fired.pay = true; checkDone();
        }, e => { console.error('payments:', e.code); fired.pay = true; checkDone(); });

        const u4 = onSnapshot(settingsDoc(), snap => {
          if (snap.exists()) {
            const { settings, customCats, people, customPayMethods, customBanks, bankClosingDays } = parseSettingsDoc(snap.data());
            queryClient.setQueryData(['settings'], settings);
            queryClient.setQueryData(['customCats'], customCats);
            queryClient.setQueryData(['people'], people);
            queryClient.setQueryData(['customPayMethods'], customPayMethods);
            queryClient.setQueryData(['customBanks'], customBanks);
            queryClient.setQueryData(['bankClosingDays'], bankClosingDays);
          }
          fired.cfg = true; checkDone();
        }, e => { console.error('settings:', e.code); fired.cfg = true; checkDone(); });

        const u5 = onSnapshot(userPrefDoc(name), snap => {
          if (snap.exists()) {
            const prefs = snap.data();
            if (prefs.theme)      setUserTheme(prefs.theme);
            if (prefs.font)       setUserFont(prefs.font);
            if (prefs.ui)         setUserUI(prefs.ui);
            if (prefs.lastReadTs) setLastReadTs(prefs.lastReadTs);
          }
          fired.prefs = true; checkDone();
        }, e => { console.error('userPrefs:', e.code); fired.prefs = true; checkDone(); });

        const logQ = query(activityLogCol(), orderBy('timestamp', 'desc'), limit(50));
        const u6 = onSnapshot(logQ, snap => {
          setActivityLog(snap.docs.map(d => d.data() as ActivityEntry));
          fired.log = true; checkDone();
        }, e => { console.error('activityLog:', e.code); fired.log = true; checkDone(); });

        _unsubs = [u1a, u1b, u2a, u2b, u3, u4, u5, u6];
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
    <div style={{ minHeight:'100vh', background:C.bg, maxWidth: isDesktop ? 'min(760px, 100%)' : SHELL_MAXW, margin:'0 auto', fontFamily:F, overflowY:'auto' }}>
      <AddEditExpense isEditMode initialData={{ ...editingExpense, amount: String(editingExpense.amount), visibilidad: editingExpense.visibilidad ?? 'compartido' }} />
    </div>
  );

  // ── Edit plan mode (edita el gasto "madre", regenera las cuotas) ───────────
  if (editingPlan) return (
    <div style={{ minHeight:'100vh', background:C.bg, maxWidth: isDesktop ? 'min(760px, 100%)' : SHELL_MAXW, margin:'0 auto', fontFamily:F, overflowY:'auto' }}>
      <AddEditExpense editingPlan={editingPlan} />
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
      {view === 'personal'  && <PersonalScreen />}
      {view === 'history'   && <History />}
      {view === 'settings'  && <SettingsScreen />}
    </>
  );

  // ── DESKTOP layout ─────────────────────────────────────────────────────────
  if (isDesktop) {
    // Riel de íconos a la izquierda. Las dos direcciones lo usan, con distinto
    // peso: 'cuenta' lo pinta claro (sobre `beige`) y 'panel' lo pinta ink.
    // Ojo: en el tema Oscuro `navy` es casi blanco, así que el riel "oscuro" se
    // resuelve por contraste (`C.dark`) y no invirtiendo el color.
    const railOnInk  = V.railDark && !C.dark;
    const railBg     = V.railDark ? (C.dark ? C.beige : C.navy) : C.beige;
    const railFg     = railOnInk ? C.onNavy : C.navy;
    const railMuted  = railOnInk ? C.onNavy + '85' : C.textMuted;
    const railActive = V.railDark
      ? { background: railOnInk ? C.onNavy + '1F' : C.surface, color: railFg, boxShadow: 'none' }
      : { background: C.surface, color: C.navy, boxShadow: '0 0 0 1px ' + C.border };
    const sideNavTabs = TABS.filter(t => t.id !== 'add');

    const railBtn = (active: boolean): React.CSSProperties => ({
      width:V.railIcon, height:V.railIcon, borderRadius:V.railRadius, border:'none',
      display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
      background:active ? railActive.background : 'transparent',
      color:active ? railActive.color : railMuted,
      boxShadow:active ? railActive.boxShadow : 'none',
    });

    const Rail = (
      <div style={{ width:V.railW, flexShrink:0, background:railBg, borderRight: V.railDark && !C.dark ? 'none' : '1px solid '+C.border, display:'flex', flexDirection:'column', alignItems:'center', padding:'0.85rem 0', gap:'0.35rem', height:'100vh', position:'sticky', top:0 }}>
        <div style={{ width:32, height:32, borderRadius:9, background: V.railDark ? C.accent : C.navy, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginBottom:'0.5rem' }}>
          <Wallet size={17} strokeWidth={2.2} color={V.railDark ? C.white : C.onNavy} />
        </div>
        {/* "Agregar" no figura en el riel de los mockups (ahí el alta es un panel
            lateral). Se suma acá como cuadrado de acento para que la acción
            principal siga a un clic desde cualquier pantalla. */}
        <button onClick={() => setView('add')} title="Agregar gasto"
          style={{ ...railBtn(view === 'add'), background:C.accent, color:C.white, marginBottom:'0.35rem' }}>
          <Plus size={20} strokeWidth={2.6} />
        </button>
        {sideNavTabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} title={t.label} style={railBtn(view === t.id)}>
            {t.icon}
          </button>
        ))}
        <div style={{ marginTop:'auto' }}>
          <span style={{ width:28, height:28, borderRadius:'50%', background:C.navy, color:C.onNavy, fontSize:'0.7rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:F }}>
            {(currentUser || '?').charAt(0)}
          </span>
        </div>
      </div>
    );

    return (
      <div style={{ minHeight:'100vh', background:C.bg, display:'flex', fontFamily:F }}>
        <ConfirmDialog /><PaymentModal /><Toast />
        {Rail}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
          {Header}
          {/* Main content — el scroll ocupa todo el ancho; un wrapper interno
              centra el contenido con un max-width único (MAXW). El fondo lo
              decide la variante: 'cuenta' trabaja sobre blanco, 'panel' sobre
              el gris de sistema para que las tarjetas se despeguen. */}
          <div style={{ flex:1, overflowY:'auto', paddingTop:SP.md, paddingBottom:SP.xxl, background: V.shellBg === 'surface' ? C.surface : C.bg }}>
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
  // Dos formas de nav según la variante:
  //   pill ('cuenta') → píldora ink flotante, despegada de los bordes.
  //   bar  ('panel')  → barra al ras, estilo iOS, sobre la superficie.
  const isPill   = V.navStyle === 'pill';
  // La píldora es siempre ink: en el tema Oscuro `navy` es casi blanco, así que
  // ahí se usa una superficie elevada en lugar de invertir.
  const pillBg   = C.dark ? C.beige : C.navy;
  const pillOn   = C.dark ? C.navy  : C.onNavy;
  const navFg    = (active: boolean) =>
    isPill ? (active ? pillOn : pillOn + '80')
           : (active ? C.accent : C.textMuted);

  const navWrap: React.CSSProperties = isPill
    ? { position:'fixed', bottom:'calc(0.75rem + env(safe-area-inset-bottom))', left:'50%', transform:'translateX(-50%)', width:'calc(100% - 1.5rem)', maxWidth:'calc(' + SHELL_MAXW + ' - 1.5rem)', background:pillBg, borderRadius:'18px', display:'flex', alignItems:'center', padding:'0 0.5rem', height:'58px', zIndex:10, boxShadow:'0 8px 24px rgba(0,0,0,0.22)' }
    : { position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:SHELL_MAXW, background:C.surface, borderTop:'1px solid '+C.border, display:'flex', alignItems:'center', zIndex:10, paddingBottom:'env(safe-area-inset-bottom)' };

  return (
    <div style={{ minHeight:'100vh', background: V.shellBg === 'surface' ? C.surface : C.bg, display:'flex', flexDirection:'column', maxWidth:SHELL_MAXW, margin:'0 auto', fontFamily:F }}>
      <ConfirmDialog /><PaymentModal /><Toast />
      {Header}
      <div style={{ flex:1, overflowY:'auto', paddingBottom: isPill ? '6.5rem' : '5.5rem', paddingTop:'0.75rem' }}>
        {SyncBar}
        {Content}
      </div>

      <div style={navWrap}>
        {TABS.map(t => {
          const isAdd = t.id === 'add';
          const active = view === t.id;
          if (isAdd) return (
            <button
              key={t.id}
              onClick={() => setView('add')}
              title="Agregar gasto"
              style={ isPill
                ? { width:'46px', height:'46px', borderRadius:'14px', border:'none', background:C.accent, color:C.white, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 0.25rem', cursor:'pointer', flexShrink:0 }
                : { flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'0.18rem', padding:'0.5rem 0 0.45rem', border:'none', background:'none', cursor:'pointer', fontFamily:F } }
            >
              {isPill ? <Plus size={22} strokeWidth={2.6} /> : (
                <>
                  <span style={{ width:'30px', height:'30px', borderRadius:'9px', background:C.accent, color:C.white, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Plus size={20} strokeWidth={2.6} />
                  </span>
                  <span style={{ fontSize:'0.6rem', color: active ? C.accent : C.textMuted, fontWeight: active ? 800 : 500 }}>Agregar</span>
                </>
              )}
            </button>
          );
          return (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding: isPill ? '0' : '0.55rem 0 0.45rem', border:'none', background:'none', cursor:'pointer', fontFamily:F, color:navFg(active), fontSize: isPill ? '0.59rem' : '0.6rem', fontWeight:active ? (isPill ? 700 : 800) : 500, gap: isPill ? '0.19rem' : '0.2rem' }}
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
