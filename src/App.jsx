// ─────────────────────────────────────────────────────────────────────────────
// Este archivo reemplaza completamente src/App.jsx
// Copiá TODO el contenido del artefacto "Gastos Compartidos — Javi & Lali v9"
// del sandbox de Claude y pegalo aquí, con UN SOLO CAMBIO:
//
// 1. Agregá este import al inicio del archivo (después de los imports de React):
//
//    import { db, dataDoc } from './firebase';
//    import { setDoc, onSnapshot } from 'firebase/firestore';
//
// 2. Reemplazá la función "useFont" y todo el bloque de "Main App" con el
//    código que aparece abajo. El resto del archivo (paleta, helpers, componentes
//    de UI) queda exactamente igual.
// ─────────────────────────────────────────────────────────────────────────────

// ── IMPORTS (al inicio del archivo, después de React) ─────────────────────────
// import { db, dataDoc } from './firebase';
// import { setDoc, onSnapshot } from 'firebase/firestore';


// ── REEMPLAZÁ SOLO el bloque "Main App" (export default function App) ─────────

export default function App() {
  useFont();

  // Estado local (solo el usuario elegido es por dispositivo)
  var userState   = useState(null);   var currentUser = userState[0];   var setCurrentUser = userState[1];
  var viewState   = useState('dashboard'); var view = viewState[0];     var setView = viewState[1];
  var expState    = useState([]);     var expenses    = expState[0];     var setExpenses    = expState[1];
  var cfgState    = useState({periods:[]}); var settings = cfgState[0]; var setSettings    = cfgState[1];
  var catState    = useState([]);     var customCats  = catState[0];     var setCustomCats  = catState[1];
  var planState   = useState([]);     var plans       = planState[0];    var setPlans       = planState[1];
  var loadState   = useState(true);   var loading     = loadState[0];    var setLoading     = loadState[1];
  var msgState    = useState('');     var syncMsg     = msgState[0];     var setSyncMsg     = msgState[1];
  var editState   = useState(null);   var editingExpense = editState[0]; var setEditingExpense = editState[1];

  var allCats = DEFAULT_CATS.concat(customCats);

  // ── Cargar usuario del dispositivo + escuchar Firebase en tiempo real ────────
  useEffect(function() {
    // El usuario elegido (Javi/Lali) es por dispositivo
    setCurrentUser(store.get('usr', null));

    // Listener en tiempo real — se dispara en todos los dispositivos al instante
    var unsub = onSnapshot(dataDoc, function(snapshot) {
      if (snapshot.exists()) {
        var data = snapshot.data();
        setExpenses(data.expenses   || []);
        setPlans(data.plans         || []);
        setSettings(data.settings   || { periods: [] });
        setCustomCats(data.customCats || []);
      }
      setLoading(false);
    }, function(error) {
      console.error('Firebase error:', error);
      setLoading(false);
    });

    return unsub; // limpia el listener al desmontar
  }, []);

  // ── Guardar en Firebase (escribe y sincroniza todos los dispositivos) ────────
  function saveAll(newExp, newPlans, newSettings, newCats) {
    setDoc(dataDoc, {
      expenses:   newExp      !== undefined ? newExp      : expenses,
      plans:      newPlans    !== undefined ? newPlans    : plans,
      settings:   newSettings !== undefined ? newSettings : settings,
      customCats: newCats     !== undefined ? newCats     : customCats,
    }, { merge: false });
  }

  function saveExpenses(exps)  { setExpenses(exps);    saveAll(exps, undefined, undefined, undefined); }
  function savePlans(p)        { setPlans(p);           saveAll(undefined, p, undefined, undefined); }
  function saveCustomCats(cats){ setCustomCats(cats);   saveAll(undefined, undefined, undefined, cats); }
  function saveSettings(s)     {
    var updated = expenses.map(function(e) {
      return Object.assign({}, e, { period: (!e.fromPlan && e.date) ? getPeriod(e.date, s.periods) : (e.period || 'Sin período') });
    });
    if (s.periods && s.periods.length) updated = reassignPlanExpenses(updated, s.periods, plans);
    setExpenses(updated);
    setSettings(s);
    saveAll(updated, undefined, s, undefined);
  }

  function selectUser(u) { setCurrentUser(u); store.set('usr', u); }
  function showMsg(msg, ms) { setSyncMsg(msg); setTimeout(function(){ setSyncMsg(''); }, ms || 5000); }

  // ── Exportar / Importar JSON (backup manual) ─────────────────────────────────
  function exportJSON() {
    var backup = { version:1, exportedAt: new Date().toISOString(), expenses, plans, settings, customCats };
    var dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
    var a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', 'gastos_javi_lali_' + todayStr() + '.json');
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showMsg('✓ Backup descargado correctamente.');
  }

  function importJSON(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = JSON.parse(e.target.result);
        var imp = {
          expenses:   data.expenses   || [],
          plans:      data.plans      || [],
          settings:   data.settings   || settings,
          customCats: data.customCats || [],
        };
        // Merge: el dato local gana en conflicto de id
        var localById = {};
        expenses.forEach(function(exp){ localById[exp.id] = exp; });
        var merged = imp.expenses.map(function(exp){ return localById[exp.id] || sanitize(exp, DEFAULT_CATS.concat(imp.customCats)); });
        var localOnly = expenses.filter(function(exp){ return !imp.expenses.find(function(ie){ return ie.id === exp.id; }); });
        var finalExps = localOnly.concat(merged);
        setDoc(dataDoc, { expenses: finalExps, plans: imp.plans, settings: imp.settings, customCats: imp.customCats });
        showMsg('✓ ' + merged.length + ' gastos importados correctamente.');
      } catch(err) { showMsg('⚠ El archivo no es válido.'); }
    };
    reader.readAsText(file);
  }

  // ── Exportar CSV ──────────────────────────────────────────────────────────────
  function exportCSV(from, to) {
    var filtered = expenses.filter(function(e) {
      if (!e.date) return false;
      if (from && e.date < from) return false;
      if (to   && e.date > to)   return false;
      return true;
    });
    if (!filtered.length) { showMsg('No hay gastos en ese rango.'); return; }
    var header = ['Fecha','Descripción','Monto','Moneda','Categoría','Medio de Pago','Banco','Pagó','Responsable','Monto Javi','Monto Lali','Período'];
    var rows = [header].concat(filtered.map(function(e) {
      return [e.date, e.description, safeN(e.amount), e.currency||'ARS', e.category||'', e.paymentMethod||'', e.bank||'', e.paidBy, e.responsible, safeN(e.javiAmount), safeN(e.laliAmount), e.period||''];
    }));
    var csv = rows.map(function(r){ return r.map(function(v){ return '"'+String(v).replace(/"/g,'""')+'"'; }).join(','); }).join('\n');
    var dataStr = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
    var a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', 'gastos_'+(from||'inicio')+'_al_'+(to||'hoy')+'.csv');
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showMsg('✓ CSV con ' + filtered.length + ' gastos descargado.');
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────────
  function handleAdd(expense) {
    var s = sanitize(Object.assign({}, expense, { id: Date.now().toString() }), allCats);
    saveExpenses([s].concat(expenses));
    setView('dashboard');
  }
  function handleAddPlan(formData, numInstallments) {
    var amt = safeN(formData.amount);
    var installmentAmount = Math.round(amt / numInstallments);
    var amts = calcAmts(installmentAmount, formData.responsible);
    var startPeriod = getPeriod(formData.date, settings.periods);
    var plan = { id:'plan_'+Date.now(), description:formData.description, totalAmount:amt, installmentAmount, numInstallments, startPeriod, startDate:formData.date, currency:formData.currency||'ARS', paidBy:formData.paidBy, responsible:formData.responsible, paymentMethod:formData.paymentMethod, bank:formData.bank, category:formData.category, javiAmount:amts.javiAmount, laliAmount:amts.laliAmount, createdAt:new Date().toISOString() };
    var installments = generatePlanExpenses(plan, settings.periods);
    var newPlans = plans.concat([plan]);
    var newExps  = installments.concat(expenses);
    setPlans(newPlans); setExpenses(newExps);
    saveAll(newExps, newPlans, undefined, undefined);
    setView('dashboard');
  }
  function handleEdit(expense) {
    var s = sanitize(expense, allCats);
    saveExpenses(expenses.map(function(e){ return e.id === s.id ? s : e; }));
    setEditingExpense(null); setView('dashboard');
  }
  function handleDelete(id) {
    saveExpenses(expenses.filter(function(e){ return e.id !== id; }));
  }
  function handleCancelPlan(planId) {
    var newPlans = plans.filter(function(p){ return p.id !== planId; });
    var newExps  = expenses.filter(function(e){ return e.planId !== planId; });
    setPlans(newPlans); setExpenses(newExps);
    saveAll(newExps, newPlans, undefined, undefined);
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) return React.createElement('div', { style:{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:C.textMuted, fontFamily:F, background:C.bg, flexDirection:'column', gap:'1rem' } },
    React.createElement('div', { style:{ fontSize:'2rem' } }, '💑'),
    React.createElement('div', null, 'Conectando...')
  );
  if (!currentUser) return React.createElement(UserSelect, { onSelect: selectUser });

  if (editingExpense) return React.createElement('div', { style:{ minHeight:'100vh', background:C.bg, maxWidth:'480px', margin:'0 auto', fontFamily:F, overflowY:'auto' } },
    React.createElement(AddEditExpense, { currentUser, settings, allCats, customCats, onSubmit:handleEdit, onSubmitPlan:handleAddPlan, onCancel:function(){ setEditingExpense(null); }, onSaveCats:saveCustomCats, initialData:Object.assign({}, editingExpense, { amount:String(editingExpense.amount) }) })
  );

  var tabs = [
    { id:'dashboard', icon:'🏠', label:'Inicio' },
    { id:'add',       icon:'➕', label:'Agregar' },
    { id:'stats',     icon:'📊', label:'Stats' },
    { id:'history',   icon:'📋', label:'Historial' },
    { id:'settings',  icon:'⚙️', label:'Config' },
  ];

  return React.createElement('div', { style:{ minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column', maxWidth:'480px', margin:'0 auto', fontFamily:F } },
    // Header
    React.createElement('div', { style:{ background:C.gradMain, padding:'0.75rem 1rem', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 12px rgba(23,72,113,0.25)' } },
      React.createElement('div', null,
        React.createElement('div', { style:{ fontWeight:900, fontSize:'1.9rem', color:C.white, lineHeight:1.1 } }, '💑 Javi & Lali'),
        React.createElement('div', { style:{ fontSize:'0.75rem', color:'rgba(255,255,255,0.75)' } },
          'Hola, ', React.createElement('span', { style:{ fontWeight:900, color:C.white } }, currentUser)
        )
      ),
      React.createElement('button', { onClick:function(){ setCurrentUser(null); store.del('usr'); }, style:{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:'0.6rem', padding:'0.35rem 0.7rem', fontSize:'0.75rem', color:C.white, cursor:'pointer', fontFamily:F, fontWeight:700 } }, 'Cambiar')
    ),

    // Mensaje de estado
    syncMsg ? React.createElement('div', { style:{ margin:'0.75rem 1rem 0', padding:'0.6rem 0.85rem', background: syncMsg.startsWith('✓')?'#d4f5eb':'#fdf0d5', borderRadius:'0.75rem', fontSize:'0.8rem', color: syncMsg.startsWith('✓')?'#1a6e4f':'#7a5c1a', fontWeight:700, border:'1px solid '+(syncMsg.startsWith('✓')?'#a8e8cf':'#f0d898') } }, syncMsg) : null,

    // Contenido
    React.createElement('div', { style:{ flex:1, overflowY:'auto', paddingBottom:'5rem', paddingTop:'0.75rem' } },
      view==='dashboard' ? React.createElement(Dashboard,  { expenses, settings, plans, onDelete:handleDelete, onEdit:function(e){ setEditingExpense(e); }, onCancelPlan:handleCancelPlan }) : null,
      view==='add'       ? React.createElement(AddEditExpense, { currentUser, settings, allCats, customCats, onSubmit:handleAdd, onSubmitPlan:handleAddPlan, onCancel:function(){ setView('dashboard'); }, onSaveCats:saveCustomCats }) : null,
      view==='stats'     ? React.createElement(Stats,    { expenses, settings, allCats }) : null,
      view==='history'   ? React.createElement(History,  { expenses, settings, onDelete:handleDelete, onEdit:function(e){ setEditingExpense(e); } }) : null,
      view==='settings'  ? React.createElement(Settings, { settings, onSave:saveSettings, onExportJSON:exportJSON, onImportJSON:importJSON, onExportCSV:exportCSV }) : null,
    ),

    // Bottom nav
    React.createElement('div', { style:{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:'480px', background:C.white, borderTop:'1px solid '+C.border, display:'flex', boxShadow:'0 -2px 12px rgba(23,72,113,0.1)', zIndex:10 } },
      tabs.map(function(t) {
        return React.createElement('button', { key:t.id, onClick:function(){ setView(t.id); }, style:{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'0.5rem 0', border:'none', background:'none', cursor:'pointer', fontFamily:F, color: view===t.id ? C.navy : C.textMuted, fontSize:'0.6rem', fontWeight: view===t.id ? 900 : 500, gap:'0.1rem' } },
          React.createElement('span', { style:{ fontSize:'1.2rem', lineHeight:1 } }, t.icon), t.label
        );
      })
    )
  );
}