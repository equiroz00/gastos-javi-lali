// ── App.jsx ───────────────────────────────────────────────────────────────────
import React, { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { auth } from './firebase.js';
import { C, F, USER_MAP, applyTheme, FONTS } from './constants.js';
import useAppStore from './store/useAppStore.js';
import { runMigrationIfNeeded, settingsDoc, expensesCol, plansCol, paymentsCol } from './store/useAppStore.js';
import LoginScreen from './components/LoginScreen.jsx';
import Dashboard from './components/Dashboard.jsx';
import AddEditExpense from './components/AddEditExpense.jsx';
import History from './components/History.jsx';
import Stats from './components/Stats.jsx';
import Settings from './components/Settings.jsx';
import { Toast, ConfirmDialog, PaymentModal } from './components/ui.jsx';

// Module-level unsubscribes — avoid stale closures
var _unsubs = [];
var _unsubAuth = null;

export default function App(){
  var currentUser   = useAppStore(function(s){ return s.currentUser; });
  var authDenied    = useAppStore(function(s){ return s.authDenied; });
  var loading       = useAppStore(function(s){ return s.loading; });
  var view          = useAppStore(function(s){ return s.view; });
  var editingExpense= useAppStore(function(s){ return s.editingExpense; });
  var settings      = useAppStore(function(s){ return s.settings; });
  var syncMsg       = useAppStore(function(s){ return s.syncMsg; });

  var setCurrentUser= useAppStore(function(s){ return s.setCurrentUser; });
  var setAuthDenied = useAppStore(function(s){ return s.setAuthDenied; });
  var setLoading    = useAppStore(function(s){ return s.setLoading; });
  var setExpenses   = useAppStore(function(s){ return s.setExpenses; });
  var setPlans      = useAppStore(function(s){ return s.setPlans; });
  var setPayments   = useAppStore(function(s){ return s.setPayments; });
  var setSettings   = useAppStore(function(s){ return s.setSettings; });
  var setCustomCats = useAppStore(function(s){ return s.setCustomCats; });
  var setView       = useAppStore(function(s){ return s.setView; });
  var setEditingExpense = useAppStore(function(s){ return s.setEditingExpense; });

  // Apply theme on every render
  applyTheme(settings.theme||'default', settings.font||'Nunito');

  // Load font
  useEffect(function(){
    var fontKey = settings.font||'Nunito';
    var fd = FONTS[fontKey]||FONTS.Nunito;
    var l = document.createElement('link');
    l.href = 'https://fonts.googleapis.com/css2?family='+fd.url+'&display=swap';
    l.rel = 'stylesheet'; document.head.appendChild(l);
    document.body.style.fontFamily = fd.css;
    document.body.style.background = C.bg;
  }, [settings.font]);

  // Auth + Firestore listeners
  useEffect(function(){
    var unsubAuth = onAuthStateChanged(auth, function(firebaseUser){
      if(!firebaseUser){
        _unsubs.forEach(function(u){u();}); _unsubs=[];
        setCurrentUser(null); setAuthDenied(false); setLoading(false);
        return;
      }
      var name = USER_MAP[firebaseUser.uid];
      if(!name){
        _unsubs.forEach(function(u){u();}); _unsubs=[];
        setCurrentUser(null); setAuthDenied(true); setLoading(false);
        return;
      }
      setAuthDenied(false); setCurrentUser(name);

      runMigrationIfNeeded(function(){
        _unsubs.forEach(function(u){u();}); _unsubs=[];
        var fired = {exp:false,plans:false,pay:false,cfg:false};
        function checkDone(){ if(fired.exp&&fired.plans&&fired.pay&&fired.cfg) setLoading(false); }

        var u1=onSnapshot(expensesCol(),function(snap){
          setExpenses(snap.docs.map(function(d){return d.data();}));
          fired.exp=true; checkDone();
        },function(e){console.error('expenses:',e.code);fired.exp=true;checkDone();});

        var u2=onSnapshot(plansCol(),function(snap){
          setPlans(snap.docs.map(function(d){return d.data();}));
          fired.plans=true; checkDone();
        },function(e){console.error('plans:',e.code);fired.plans=true;checkDone();});

        var u3=onSnapshot(paymentsCol(),function(snap){
          setPayments(snap.docs.map(function(d){return d.data();}));
          fired.pay=true; checkDone();
        },function(e){console.error('payments:',e.code);fired.pay=true;checkDone();});

        var u4=onSnapshot(settingsDoc(),function(snap){
          if(snap.exists()){
            var cfg=snap.data();
            setSettings({periods:cfg.periods||[],theme:cfg.theme||'default',font:cfg.font||'Nunito'});
            setCustomCats(cfg.customCats||[]);
          }
          fired.cfg=true; checkDone();
        },function(e){console.error('settings:',e.code);fired.cfg=true;checkDone();});

        _unsubs=[u1,u2,u3,u4];
      });
    });
    _unsubAuth=unsubAuth;
    return function(){
      if(_unsubAuth){_unsubAuth();}
      _unsubs.forEach(function(u){u();}); _unsubs=[];
    };
  },[]);

  if(loading) return React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:'1rem',background:C.bg,fontFamily:F,color:C.textMuted}},
    React.createElement('div',{style:{fontSize:'2rem'}},'💑'),
    React.createElement('div',null,'Conectando...')
  );

  if(!currentUser) return React.createElement(LoginScreen,{denied:authDenied});

  if(editingExpense) return React.createElement('div',{style:{minHeight:'100vh',background:C.bg,maxWidth:'480px',margin:'0 auto',fontFamily:F,overflowY:'auto'}},
    React.createElement(AddEditExpense,{isEditMode:true,initialData:Object.assign({},editingExpense,{amount:String(editingExpense.amount)})})
  );

  var tabs=[{id:'dashboard',icon:'🏠',label:'Inicio'},{id:'add',icon:'➕',label:'Agregar'},{id:'stats',icon:'📊',label:'Stats'},{id:'history',icon:'📋',label:'Historial'},{id:'settings',icon:'⚙️',label:'Config'}];

  return React.createElement('div',{style:{minHeight:'100vh',background:C.bg,display:'flex',flexDirection:'column',maxWidth:'480px',margin:'0 auto',fontFamily:F}},
    React.createElement(ConfirmDialog,null),
    React.createElement(PaymentModal,null),
    React.createElement(Toast,null),
    // Header
    React.createElement('div',{style:{background:C.gradMain,padding:'0.75rem 1rem',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:10,boxShadow:'0 2px 12px rgba(0,0,0,0.2)'}},
      React.createElement('div',null,
        React.createElement('div',{style:{fontWeight:900,fontSize:'1.9rem',color:C.white,lineHeight:1.1,fontFamily:F}},'💑 Javi & Lali'),
        React.createElement('div',{style:{fontSize:'0.75rem',color:'rgba(255,255,255,0.75)',fontFamily:F}},'Hola, ',React.createElement('span',{style:{fontWeight:900,color:C.white}},currentUser))
      ),
      React.createElement('button',{onClick:function(){var store=useAppStore.getState();store.handleSignOut();},style:{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:'0.6rem',padding:'0.35rem 0.7rem',fontSize:'0.75rem',color:C.white,cursor:'pointer',fontFamily:F,fontWeight:700}},'Salir')
    ),
    // Sync message
    syncMsg?React.createElement('div',{style:{margin:'0.75rem 1rem 0',padding:'0.6rem 0.85rem',background:syncMsg.startsWith('✓')?'#d4f5eb':'#fdf0d5',borderRadius:'0.75rem',fontSize:'0.8rem',color:syncMsg.startsWith('✓')?'#1a6e4f':'#7a5c1a',fontWeight:700,border:'1px solid '+(syncMsg.startsWith('✓')?'#a8e8cf':'#f0d898')}},syncMsg):null,
    // Content
    React.createElement('div',{style:{flex:1,overflowY:'auto',paddingBottom:'5rem',paddingTop:'0.75rem'}},
      view==='dashboard'?React.createElement(Dashboard,null):null,
      view==='add'?React.createElement(AddEditExpense,null):null,
      view==='stats'?React.createElement(Stats,null):null,
      view==='history'?React.createElement(History,null):null,
      view==='settings'?React.createElement(Settings,null):null
    ),
    // Bottom nav
    React.createElement('div',{style:{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'480px',background:C.surface,borderTop:'1px solid '+C.border,display:'flex',boxShadow:'0 -2px 12px rgba(0,0,0,0.1)',zIndex:10}},
      tabs.map(function(t){
        return React.createElement('button',{key:t.id,onClick:function(){setView(t.id);},style:{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'0.5rem 0',border:'none',background:'none',cursor:'pointer',fontFamily:F,color:view===t.id?C.navy:C.textMuted,fontSize:'0.6rem',fontWeight:view===t.id?900:500,gap:'0.1rem'}},
          React.createElement('span',{style:{fontSize:'1.2rem',lineHeight:1}},t.icon),t.label
        );
      })
    )
  );
}
