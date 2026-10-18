// ── src/App.tsx ───────────────────────────────────────────────────────────────
import React, { useEffect } from 'react';
import { Loader2, LogOut, Wallet } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { auth } from './firebase.js';
import { C, F, USER_MAP, applyTheme, FONTS, MAXW, SHELL_MAXW, SP } from './constants.js';
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
import { MobileNav, DesktopSidebar, AddFab, contentBg, MOBILE_NAV_SPACE } from './components/Navigation';

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

  // ── Navegación con el historial del navegador ──────────────────────────────
  // Antes la app no tocaba el historial: el gesto de "atrás" del celular (y el
  // botón del navegador) salían de la app en vez de volver a la pantalla previa.
  // Ahora cada pantalla y cada overlay (editar gasto / editar plan) dejan su
  // entrada, así atrás y adelante se mueven DENTRO de la app.
  //
  // `navPopping` evita el bucle clásico: al procesar un popstate cambiamos el
  // estado, lo que dispararía el efecto que empuja una entrada nueva y anularía
  // el "atrás". La bandera se limpia en un timeout para no comerse el próximo
  // push legítimo si el pop no llegó a provocar re-render.
  const navPopping = React.useRef(false);
  const exitArmed  = React.useRef(false);

  useEffect(() => {
    if (!currentUser) return;
    const st0 = window.history.state as { appView?: string } | null;
    if (!st0?.appView) {
      // Entrada centinela: si el usuario llega hasta acá con "atrás" es que
      // quiso salir de la app. Encima de ella va la pantalla real.
      window.history.replaceState({ appGuard: true }, '');
      window.history.pushState({ appView: useAppStore.getState().view, overlay: null }, '');
    }

    const onPop = (ev: PopStateEvent) => {
      const st = (ev.state || {}) as { appView?: string; overlay?: string | null; appGuard?: boolean };

      if (st.appGuard) {
        // Estamos en la raíz y el usuario pidió salir.
        if (exitArmed.current) {
          // Segunda vez seguida: dejamos que se vaya de verdad.
          setTimeout(() => window.history.back(), 0);
          return;
        }
        exitArmed.current = true;
        window.history.pushState({ appView: useAppStore.getState().view, overlay: null }, '');
        useAppStore.getState().showMsg('Tocá "atrás" otra vez para salir de la app.', 3000);
        setTimeout(() => { exitArmed.current = false; }, 3000);
        return;
      }

      navPopping.current = true;
      const store = useAppStore.getState();
      useAppStore.setState({
        view:           st.appView || 'dashboard',
        editingExpense: st.overlay === 'expense' ? store.editingExpense : null,
        editingPlan:    st.overlay === 'plan'    ? store.editingPlan    : null,
      });
      setTimeout(() => { navPopping.current = false; }, 0);
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [currentUser]);

  // Cada pantalla/overlay nuevo deja su entrada en el historial.
  useEffect(() => {
    if (!currentUser || navPopping.current) return;
    const overlay = editingExpense ? 'expense' : editingPlan ? 'plan' : null;
    const st = (window.history.state || {}) as { appView?: string; overlay?: string | null };
    if (st.appView === view && (st.overlay ?? null) === overlay) return;
    window.history.pushState({ appView: view, overlay }, '');
  }, [view, editingExpense, editingPlan, currentUser]);

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
        {/* En web la marca vive en el menú lateral; acá quedaría duplicada. */}
        {!isDesktop && (
          <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:C.accent, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Wallet size={19} strokeWidth={2.2} color={C.white} />
          </div>
        )}
        <div>
          {isDesktop ? (
            <div style={{ fontWeight:800, fontSize:'1rem', color:C.navy, lineHeight:1.1, fontFamily:F }}>{getGreeting(currentUser)}</div>
          ) : (
            <>
              <div style={{ fontWeight:800, fontSize:'1.05rem', color:C.navy, lineHeight:1.1, fontFamily:F, letterSpacing:'-0.01em' }}>Javi &amp; Lali</div>
              <div style={{ fontSize:'0.72rem', color:C.textMuted, fontFamily:F, marginTop:'0.05rem' }}>{getGreeting(currentUser)}</div>
            </>
          )}
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

  // El botón flotante no aparece dentro del propio formulario de alta.
  const fab = view !== 'add' ? <AddFab onClick={() => setView('add')} isDesktop={isDesktop} /> : null;

  // ── DESKTOP layout ─────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ minHeight:'100vh', background:contentBg(), display:'flex', fontFamily:F }}>
        <ConfirmDialog /><PaymentModal /><Toast />
        <DesktopSidebar view={view} onSelect={setView} currentUser={currentUser} />
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
          {Header}
          {/* Main content — el scroll ocupa todo el ancho; un wrapper interno
              centra el contenido con un max-width único (MAXW). El fondo lo
              decide la variante: 'cuenta' trabaja sobre blanco, 'panel' sobre
              el gris de sistema para que las tarjetas se despeguen. La pestaña
              activa del menú lateral usa este mismo color para fundirse. */}
          <div style={{ flex:1, overflowY:'auto', paddingTop:SP.md, paddingBottom:'6rem', background:contentBg() }}>
            <div style={{ maxWidth:MAXW, margin:'0 auto' }}>
              {SyncBar}
              {Content}
            </div>
          </div>
        </div>
        {fab}
      </div>
    );
  }

  // ── MOBILE layout ──────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:contentBg(), display:'flex', flexDirection:'column', maxWidth:SHELL_MAXW, margin:'0 auto', fontFamily:F }}>
      <ConfirmDialog /><PaymentModal /><Toast />
      {Header}
      {/* Espacio inferior para la barra Y el botón flotante: sin esto, el último
          elemento de una lista larga quedaba tapado por el botón. */}
      <div style={{ flex:1, overflowY:'auto', paddingBottom:`calc(${MOBILE_NAV_SPACE + 80}px + env(safe-area-inset-bottom))`, paddingTop:'0.75rem' }}>
        {SyncBar}
        {Content}
      </div>
      {fab}
      <MobileNav view={view} onSelect={setView} />
    </div>
  );
}
