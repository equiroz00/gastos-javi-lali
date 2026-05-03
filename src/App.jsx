import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PieChart, Pie, Cell
} from "recharts";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#F2F3F4', beige: '#DED1C6', accent: '#A77693', navy: '#174871', white: '#FFFFFF',
  gradMain: 'linear-gradient(135deg,#174871,#A77693)',
  gradJavi: 'linear-gradient(135deg,#174871,#1e5c9b)',
  gradLali: 'linear-gradient(135deg,#A77693,#c490a8)',
  textMuted: '#8a7a85', border: '#DED1C6',
};
const F = "'Nunito',sans-serif";
const PALETTE = ['#174871','#A77693','#4a9d8f','#d4875a','#7b5fa0','#c4965a','#5a8fa0','#a05a6e','#4a7a5a','#9a7040'];
const DEFAULT_CATS = ['🏠 Hogar','🍕 Alimentación','🔑 Arriendo','💡 Servicios Públicos','🚌 Transporte','🎬 Entretenimiento','👥 Amigos','💆 Cuidado Personal','💪 Gimnasio','💊 Farmacia','👶 Hijito','👕 Ropa'];
const PAY_METHODS  = ['Efectivo','TC Visa Laura','TC Master Card Laura','TC Visa Extensión','TC Master Card Extensión','Dinero en Cuenta','TC Visa Javi','TC Amex Javi','TC Amex Laura'];
const BANKS        = ['Banco Nación','Banco Provincia','Banco Ciudad','Banco Credicoop','Galicia','Macro','Supervielle','Patagonia','Comafi','Hipotecario','Naranja X','Santander','BBVA','HSBC','Itaú','ICBC','Mercado Pago','Ualá','Brubank','Lemon','Personal Pay','Otro'];
const BASE_CURS    = ['ARS','USD','EUR'];
const CUR_SYM      = { ARS:'$', USD:'US$', EUR:'€' };
const CUOTA_OPTS   = [3,6,9,12,18,24];
const CHART_TYPES  = ['Tabla','Barras','Radar','Torta'];
const PENDING_PER  = '⏳ Pendiente';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n, c) {
  var cur = c || 'ARS';
  var sym = CUR_SYM[cur] || (cur + ' ');
  return sym + Math.abs(n).toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0});
}
function fmtS(n, c) {
  var cur = c || 'ARS';
  var a = Math.abs(n);
  var s = CUR_SYM[cur] || cur;
  if (a >= 1e6) return s + (a/1e6).toFixed(1) + 'M';
  if (a >= 1e3) return s + (a/1e3).toFixed(0) + 'K';
  return s + Math.round(a);
}
function todayStr() { return new Date().toISOString().split('T')[0]; }
function safeN(v) { var n = parseFloat(v); return (isFinite(n) && !isNaN(n)) ? n : 0; }
function catEm(cat) {
  if (!cat) return '📦';
  var m = cat.match(/^(\p{Emoji})/u);
  return m ? m[1] : '📦';
}
function catLb(cat) { return cat ? (cat.replace(/^\p{Emoji}\s*/u, '').trim() || cat) : 'Otro'; }
function normCat(cat, cats) {
  if (!cat || typeof cat !== 'string') return '📦 Otro';
  var exact = cats.find(function(c) { return c === cat.trim(); });
  if (exact) return exact;
  var s = cat.replace(/^\p{Emoji}\s*/u, '').trim().toLowerCase();
  var m = cats.find(function(c) { return c.replace(/^\p{Emoji}\s*/u, '').trim().toLowerCase() === s; });
  return m || cat.trim();
}
function calcAmts(amt, resp) {
  var n = safeN(amt);
  if (resp === 'Javi') return { javiAmount: n, laliAmount: 0 };
  if (resp === 'Lali') return { javiAmount: 0, laliAmount: n };
  return { javiAmount: n/2, laliAmount: n/2 };
}
function calcBal(exps) {
  return exps.reduce(function(b, e) {
    return e.paidBy === 'Javi' ? b + safeN(e.laliAmount) : b - safeN(e.javiAmount);
  }, 0);
}
function getPeriod(d, ps) {
  if (!ps || !ps.length) return 'Sin período';
  var dt = new Date(d + 'T12:00:00');
  for (var i = 0; i < ps.length; i++) {
    if (dt >= new Date(ps[i].start + 'T00:00:00') && dt <= new Date(ps[i].end + 'T23:59:59')) return ps[i].name;
  }
  return 'Sin período';
}
function getWeekStart() {
  var d = new Date(), day = d.getDay(), diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff); d.setHours(0,0,0,0); return d;
}
function sortByDate(exps) { return exps.slice().sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); }); }
function pctChange(cur, prev) { return prev === 0 ? null : Math.round((cur - prev) / prev * 100); }

// ── Plan helpers ──────────────────────────────────────────────────────────────
function generatePlanExpenses(plan, periods) {
  var startIdx = periods.findIndex(function(p){ return p.name === plan.startPeriod; });
  return Array.from({length: plan.numInstallments}, function(_, i) {
    var targetIdx = startIdx + i;
    var period = (startIdx >= 0 && targetIdx < periods.length) ? periods[targetIdx].name : PENDING_PER;
    return {
      id: plan.id + '-' + (i+1),
      description: plan.description + ' (cuota ' + (i+1) + '/' + plan.numInstallments + ')',
      amount: plan.installmentAmount, javiAmount: plan.javiAmount, laliAmount: plan.laliAmount,
      currency: plan.currency, paidBy: plan.paidBy, responsible: plan.responsible,
      paymentMethod: plan.paymentMethod, bank: plan.bank, category: plan.category,
      date: plan.startDate, period: period, planId: plan.id,
      installmentNum: i+1, numInstallments: plan.numInstallments, fromPlan: true,
    };
  });
}
function reassignPlanExpenses(exps, periods, plans) {
  return exps.map(function(e) {
    if (!e.fromPlan) return e;
    var plan = plans.find(function(p){ return p.id === e.planId; });
    if (!plan) return e;
    var startIdx = periods.findIndex(function(p){ return p.name === plan.startPeriod; });
    var targetIdx = startIdx + (e.installmentNum - 1);
    var period = (startIdx >= 0 && targetIdx < periods.length) ? periods[targetIdx].name : PENDING_PER;
    return Object.assign({}, e, {period: period});
  });
}

// ── Storage ───────────────────────────────────────────────────────────────────
var store = {
  get: function(k, fb) { try { var v = localStorage.getItem(k); return v != null ? JSON.parse(v) : (fb !== undefined ? fb : null); } catch(e) { return fb !== undefined ? fb : null; } },
  set: function(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} },
  del: function(k) { try { localStorage.removeItem(k); } catch(e) {} },
};
function sanitize(e, cats) {
  var date = (typeof e.date === 'string' && e.date.match(/^\d{4}-\d{2}-\d{2}/)) ? e.date.substring(0,10) : (e.date || todayStr());
  var paidBy = (e.paidBy === 'Javi' || e.paidBy === 'Edinson') ? 'Javi' : 'Lali';
  var responsible = ['Javi','Lali','Ambos'].indexOf(e.responsible) >= 0 ? e.responsible : 'Ambos';
  return Object.assign({}, e, {
    description: String(e.description || ''),
    amount: safeN(e.amount), javiAmount: safeN(e.javiAmount), laliAmount: safeN(e.laliAmount),
    category: normCat(e.category, cats), currency: e.currency || 'ARS',
    date: date, paidBy: paidBy, responsible: responsible,
  });
}

// ── Font ──────────────────────────────────────────────────────────────────────
function useFont() {
  useEffect(function() {
    var l = document.createElement('link');
    l.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap';
    l.rel = 'stylesheet'; document.head.appendChild(l);
    document.body.style.fontFamily = F; document.body.style.background = C.bg;
    return function() { document.body.style.fontFamily = ''; document.body.style.background = ''; };
  }, []);
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Card(props) {
  var style = Object.assign({background:C.white,borderRadius:'1.1rem',padding:'1rem',boxShadow:'0 2px 8px rgba(23,72,113,0.08)',border:'1px solid '+C.border}, props.style||{});
  return React.createElement('div', {style: style}, props.children);
}

function SearchBox(props) {
  return React.createElement('input', {
    value: props.value,
    onChange: function(e){ props.onChange(e.target.value); },
    placeholder: props.placeholder || '🔍 Buscar...',
    style: {width:'100%',border:'1px solid '+C.border,borderRadius:'0.75rem',padding:'0.5rem 0.75rem',fontSize:'0.82rem',outline:'none',fontFamily:F,color:C.navy,background:C.white,boxSizing:'border-box',marginBottom:'0.6rem'},
  });
}

// Horizontal scroll filter
function ScrollFilter(props) {
  var items = props.items || [];
  var selected = props.selected;
  var multi = props.multi || false;
  return React.createElement('div', {style:{overflowX:'auto',paddingBottom:'6px',marginBottom:'0.6rem'}},
    React.createElement('div', {style:{display:'flex',gap:'0.4rem',width:'max-content'}},
      items.map(function(p) {
        var isActive = multi ? (selected.indexOf(p) >= 0) : (selected === p);
        return React.createElement('button', {
          key: p,
          onClick: function(){ props.onSelect(p); },
          style: {flexShrink:0,padding:'0.35rem 0.75rem',borderRadius:'999px',border:'1px solid',fontSize:'0.75rem',cursor:'pointer',fontWeight:isActive?800:500,fontFamily:F,background:isActive?C.navy:'transparent',borderColor:isActive?C.navy:C.border,color:isActive?C.white:C.navy,whiteSpace:'nowrap'},
        }, multi ? (isActive?'☑ ':' ☐ ') + p : p);
      })
    )
  );
}

function ChartSelector(props) {
  return React.createElement('div', {style:{display:'flex',gap:'0.3rem',marginBottom:'0.75rem',flexWrap:'wrap'}},
    CHART_TYPES.map(function(t) {
      var active = props.value === t;
      return React.createElement('button', {
        key: t, onClick: function(){ props.onChange(t); },
        style:{padding:'0.25rem 0.65rem',fontSize:'0.7rem',borderRadius:'999px',border:'1px solid',cursor:'pointer',fontFamily:F,fontWeight:active?800:500,background:active?C.navy:'transparent',borderColor:active?C.navy:C.border,color:active?C.white:C.navy},
      }, t);
    })
  );
}

function SegBtn(props) {
  var color = props.color || C.navy;
  var style = {flex:1,padding:'0.45rem 0.2rem',fontSize:'0.72rem',borderRadius:'0.75rem',border:'1px solid',cursor:'pointer',fontFamily:F,fontWeight:props.active?800:500,lineHeight:1.3,background:props.active?color:'transparent',borderColor:props.active?color:C.border,color:props.active?C.white:C.navy};
  return React.createElement('button', {onClick:props.onClick, style:style}, props.children);
}

// ── UserSelect ────────────────────────────────────────────────────────────────
function UserSelect(props) {
  useFont();
  return React.createElement('div', {style:{minHeight:'100vh',background:C.gradMain,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',gap:'1.5rem',fontFamily:F}},
    React.createElement('div', {style:{textAlign:'center',marginBottom:'1rem'}},
      React.createElement('div', {style:{fontSize:'3.5rem',marginBottom:'0.75rem'}}, '💑'),
      React.createElement('h1', {style:{fontSize:'1.9rem',fontWeight:900,color:C.white,margin:0,fontFamily:F}}, 'Gastos Compartidos'),
      React.createElement('p', {style:{color:'rgba(255,255,255,0.8)',marginTop:'0.5rem'}}, '¿Quién sos?')
    ),
    ['Javi','Lali'].map(function(u) {
      return React.createElement('button', {
        key: u, onClick: function(){ props.onSelect(u); },
        style:{width:'100%',maxWidth:'280px',padding:'1.25rem',borderRadius:'1.25rem',color:u==='Javi'?C.white:C.navy,fontSize:'1.2rem',fontWeight:900,border:'none',cursor:'pointer',fontFamily:F,background:u==='Javi'?'rgba(255,255,255,0.15)':'rgba(255,255,255,0.9)',boxShadow:'0 8px 24px rgba(0,0,0,0.2)'},
      }, (u==='Javi'?'👨':'👩')+' '+u);
    })
  );
}

// ── BalanceSection ────────────────────────────────────────────────────────────
function BalanceSection(props) {
  var periodExps = props.periodExps || [];
  var byCur = {};
  periodExps.forEach(function(e) { var c=e.currency||'ARS'; if(!byCur[c])byCur[c]=[]; byCur[c].push(e); });
  var curs = Object.keys(byCur);
  if (!curs.length) {
    return React.createElement('div', {style:{borderRadius:'1.25rem',padding:'1rem 1.5rem',background:C.gradMain,color:C.white,boxShadow:'0 4px 16px rgba(23,72,113,0.25)'}},
      React.createElement('p', {style:{fontSize:'0.72rem',opacity:0.8,margin:'0 0 0.15rem'}}, 'Balance período'),
      React.createElement('div', {style:{fontSize:'1.3rem',fontWeight:800}}, '¡Sin gastos aún!')
    );
  }
  return React.createElement('div', {style:{display:'flex',flexDirection:'column',gap:'0.5rem'}},
    curs.map(function(c) {
      var bal = calcBal(byCur[c]), noDebt = Math.abs(bal)<1, laliOwes = bal>0;
      var bg = noDebt ? 'linear-gradient(135deg,#2d9e7f,#1db88c)' : C.gradMain;
      return React.createElement('div', {key:c,style:{borderRadius:'1.25rem',padding:'1rem 1.5rem',background:bg,color:C.white,boxShadow:'0 4px 16px rgba(23,72,113,0.2)'}},
        React.createElement('p', {style:{fontSize:'0.7rem',opacity:0.8,margin:'0 0 0.1rem'}}, 'Balance '+c+' — período seleccionado'),
        noDebt
          ? React.createElement('div', {style:{fontSize:'1.3rem',fontWeight:800}}, '¡Al día! 🎉')
          : React.createElement(React.Fragment, null,
              React.createElement('div', {style:{fontSize:'1.7rem',fontWeight:800}}, fmt(bal,c)),
              React.createElement('div', {style:{fontSize:'0.82rem',opacity:0.9}}, (laliOwes?'👩 Lali':'👨 Javi')+' le debe a '+(laliOwes?'👨 Javi':'👩 Lali'))
            )
      );
    })
  );
}

// ── ExpenseRow ────────────────────────────────────────────────────────────────
function ExpenseRow(props) {
  var e = props.expense;
  var onDelete = props.onDelete;
  var onEdit = props.onEdit;
  var cur = e.currency || 'ARS';
  var open = props.open || false;
  var onToggle = props.onToggle || function(){};
  return React.createElement('div', {style:{borderBottom:'1px solid '+C.beige}},
    React.createElement('div', {onClick:onToggle,style:{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.65rem 1rem',cursor:'pointer',background:open?C.bg:C.white}},
      React.createElement('div', {style:{fontSize:'1.3rem',flexShrink:0,width:'1.8rem',textAlign:'center'}}, catEm(e.category)),
      React.createElement('div', {style:{flex:1,minWidth:0}},
        React.createElement('div', {style:{display:'flex',alignItems:'center',gap:'0.3rem',flexWrap:'wrap'}},
          React.createElement('span', {style:{fontWeight:700,color:C.navy,fontSize:'0.88rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'140px'}}, e.description||'Sin descripción'),
          cur!=='ARS' ? React.createElement('span', {style:{fontSize:'0.58rem',background:C.navy,color:C.white,borderRadius:'999px',padding:'0.1rem 0.3rem',fontWeight:800,flexShrink:0}}, cur) : null,
          e.fromPlan ? React.createElement('span', {style:{fontSize:'0.58rem',background:C.accent,color:C.white,borderRadius:'999px',padding:'0.1rem 0.3rem',fontWeight:800,flexShrink:0}}, '📅 '+e.installmentNum+'/'+e.numInstallments) : null,
          e.period===PENDING_PER ? React.createElement('span', {style:{fontSize:'0.58rem',background:'#f59e0b',color:C.white,borderRadius:'999px',padding:'0.1rem 0.3rem',fontWeight:800,flexShrink:0}}, '⏳') : null
        ),
        React.createElement('div', {style:{fontSize:'0.68rem',color:C.textMuted,marginTop:'0.05rem'}},
          e.date+' · '+catLb(e.category)+' · ',
          React.createElement('span', {style:{color:e.paidBy==='Javi'?C.navy:C.accent,fontWeight:700}}, e.paidBy)
        )
      ),
      React.createElement('div', {style:{textAlign:'right',flexShrink:0}},
        React.createElement('div', {style:{fontWeight:800,color:C.navy,fontSize:'0.9rem'}}, fmt(safeN(e.amount),cur)),
        React.createElement('div', {style:{fontSize:'0.62rem',color:C.textMuted}}, 'J:'+fmt(safeN(e.javiAmount),cur)+' / L:'+fmt(safeN(e.laliAmount),cur))
      )
    ),
    open && !e.fromPlan ? React.createElement('div', {style:{display:'flex',gap:'0.5rem',padding:'0.45rem 1rem',background:C.bg,borderTop:'1px solid '+C.border}},
      React.createElement('button', {onClick:function(){onEdit(e);},style:{flex:1,padding:'0.35rem',background:C.beige,border:'none',borderRadius:'0.6rem',color:C.navy,fontWeight:700,fontSize:'0.75rem',cursor:'pointer',fontFamily:F}}, '✏️ Editar'),
      React.createElement('button', {onClick:function(){onDelete(e.id,e);},style:{flex:1,padding:'0.35rem',background:'#fde8ee',border:'none',borderRadius:'0.6rem',color:'#c0314f',fontWeight:700,fontSize:'0.75rem',cursor:'pointer',fontFamily:F}}, '🗑️ Eliminar')
    ) : null
  );
}

function ExpenseList(props) {
  var expenses = props.expenses || [];
  var onDelete = props.onDelete;
  var onEdit = props.onEdit;
  var openState = useState(null);
  var openId = openState[0];
  var setOpenId = openState[1];
  return React.createElement(React.Fragment, null,
    expenses.map(function(e) {
      return React.createElement(ExpenseRow, {
        key:e.id, expense:e, onDelete:onDelete, onEdit:onEdit,
        open: openId===e.id,
        onToggle: function(){ setOpenId(openId===e.id?null:e.id); },
      });
    })
  );
}

// ── ActivePlans ───────────────────────────────────────────────────────────────
function ActivePlans(props) {
  var plans = props.plans || [];
  var expenses = props.expenses || [];
  var onCancelPlan = props.onCancelPlan;
  var searchState = useState('');
  var search = searchState[0], setSearch = searchState[1];
  if (!plans.length) return null;
  var filtered = search.trim() === '' ? plans : plans.filter(function(p){ return p.description.toLowerCase().indexOf(search.toLowerCase()) >= 0; });
  var showSearch = plans.length >= 3;
  var showScroll = plans.length >= 3;
  return React.createElement('div', null,
    React.createElement('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}},
      React.createElement('h2', {style:{fontWeight:800,color:C.navy,fontSize:'0.88rem',margin:0}}, '💳 Cuotas activas'),
      React.createElement('span', {style:{fontSize:'0.68rem',color:C.textMuted}}, plans.length+' plan'+(plans.length!==1?'es':''))
    ),
    showSearch ? React.createElement(SearchBox, {value:search,onChange:setSearch,placeholder:'🔍 Buscar cuota...'}) : null,
    React.createElement('div', {style:{display:'flex',flexDirection:'column',gap:'0.5rem',maxHeight:showScroll?'280px':undefined,overflowY:showScroll?'auto':undefined}},
      filtered.map(function(plan) {
        var planExps = expenses.filter(function(e){ return e.planId===plan.id; });
        var pending = planExps.filter(function(e){ return e.period===PENDING_PER; }).length;
        var assigned = plan.numInstallments - pending;
        var pct = Math.round(assigned/plan.numInstallments*100);
        return React.createElement(Card, {key:plan.id,style:{padding:'0.85rem',flexShrink:0}},
          React.createElement('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'0.4rem'}},
            React.createElement('div', {style:{flex:1,minWidth:0}},
              React.createElement('div', {style:{fontWeight:800,color:C.navy,fontSize:'0.88rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, plan.description),
              React.createElement('div', {style:{fontSize:'0.7rem',color:C.textMuted,marginTop:'0.1rem'}}, fmt(plan.installmentAmount,plan.currency)+'/mes · Total: '+fmt(plan.totalAmount,plan.currency))
            ),
            React.createElement('div', {style:{textAlign:'right',flexShrink:0,marginLeft:'0.5rem'}},
              React.createElement('div', {style:{fontWeight:800,color:C.accent,fontSize:'0.82rem'}}, assigned+'/'+plan.numInstallments),
              React.createElement('div', {style:{fontSize:'0.65rem',color:C.textMuted}}, 'cuotas')
            )
          ),
          React.createElement('div', {style:{background:C.beige,borderRadius:'999px',height:'6px',overflow:'hidden',marginBottom:'0.4rem'}},
            React.createElement('div', {style:{width:pct+'%',height:'100%',background:C.gradMain,borderRadius:'999px',transition:'width 0.4s'}})
          ),
          React.createElement('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
            pending>0
              ? React.createElement('div', {style:{fontSize:'0.68rem',color:'#b45309',fontWeight:600}}, '⚠ '+pending+' cuota'+(pending>1?'s':'')+' sin período')
              : React.createElement('div', {style:{fontSize:'0.68rem',color:'#2d9e7f',fontWeight:600}}, '✓ Todas asignadas'),
            React.createElement('button', {onClick:function(){onCancelPlan(plan.id);},style:{background:'transparent',border:'1px solid '+C.border,borderRadius:'0.5rem',padding:'0.2rem 0.5rem',fontSize:'0.65rem',color:C.textMuted,cursor:'pointer',fontFamily:F}}, 'Cancelar')
          )
        );
      }),
      filtered.length===0 ? React.createElement('div', {style:{textAlign:'center',fontSize:'0.8rem',color:C.textMuted,padding:'1rem'}}, 'No se encontraron cuotas') : null
    )
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard(props) {
  var expenses=props.expenses||[], settings=props.settings||{}, plans=props.plans||[];
  var periods=settings.periods||[];
  var latestPeriod=periods.length?periods[periods.length-1].name:'';
  var selState=useState(latestPeriod); var selPeriod=selState[0]; var setSelPeriod=selState[1];
  useEffect(function(){ if(latestPeriod&&!selPeriod)setSelPeriod(latestPeriod); },[latestPeriod]);
  var periodExps=selPeriod?expenses.filter(function(e){return e.period===selPeriod;}):expenses;
  var totByCur={};
  periodExps.forEach(function(e){var c=e.currency||'ARS';totByCur[c]=(totByCur[c]||0)+safeN(e.amount);});
  var curEntries=Object.entries(totByCur);
  var weekStart=getWeekStart();
  var weekExps=sortByDate(expenses.filter(function(e){return e.date&&new Date(e.date+'T12:00:00')>=weekStart&&e.period!==PENDING_PER;}));
  return React.createElement('div', {style:{padding:'1rem',display:'flex',flexDirection:'column',gap:'0.75rem'}},
    React.createElement(BalanceSection, {periodExps:periodExps}),
    React.createElement('div', {style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.6rem'}},
      React.createElement(Card, {style:{padding:'0.75rem'}},
        React.createElement('div', {style:{fontSize:'0.65rem',color:C.textMuted,marginBottom:'0.3rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}, 'Período'),
        periods.length>0
          ? React.createElement('select', {value:selPeriod,onChange:function(e){setSelPeriod(e.target.value);},style:{width:'100%',border:'none',fontSize:'0.78rem',fontWeight:800,color:C.navy,background:'transparent',outline:'none',cursor:'pointer',fontFamily:F,padding:0}},
              periods.slice().reverse().map(function(p){return React.createElement('option',{key:p.name,value:p.name},p.name);}))
          : React.createElement('div', {style:{fontWeight:700,color:C.textMuted,fontSize:'0.78rem'}}, 'Sin períodos'),
        React.createElement('div', {style:{fontSize:'0.65rem',color:C.textMuted,marginTop:'0.2rem'}}, periodExps.length+' gastos')
      ),
      curEntries.length<=1
        ? React.createElement(Card, {style:{padding:'0.75rem'}},
            React.createElement('div', {style:{fontSize:'0.65rem',color:C.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}, 'Total '+(curEntries[0]?curEntries[0][0]:'ARS')),
            React.createElement('div', {style:{fontWeight:800,color:C.navy,marginTop:'0.2rem',fontSize:'0.95rem'}}, curEntries[0]?fmtS(curEntries[0][1],curEntries[0][0]):'—')
          )
        : React.createElement('div', {style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.4rem'}},
            curEntries.map(function(entry){
              return React.createElement(Card,{key:entry[0],style:{padding:'0.5rem 0.6rem'}},
                React.createElement('div',{style:{fontSize:'0.6rem',color:C.textMuted,fontWeight:700}},entry[0]),
                React.createElement('div',{style:{fontWeight:800,color:C.navy,fontSize:'0.82rem'}},fmtS(entry[1],entry[0]))
              );
            })
          )
    ),
    React.createElement(ActivePlans, {plans:plans,expenses:expenses,onCancelPlan:props.onCancelPlan}),
    React.createElement('div', null,
      React.createElement('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}},
        React.createElement('h2', {style:{fontWeight:800,color:C.navy,fontSize:'0.88rem',margin:0}}, '📅 Esta semana'),
        React.createElement('span', {style:{fontSize:'0.68rem',color:C.textMuted}}, weekExps.length+' gastos')
      ),
      weekExps.length===0
        ? React.createElement(Card, {style:{padding:'1.5rem',textAlign:'center',color:C.textMuted,fontSize:'0.85rem'}}, 'No hay gastos esta semana')
        : React.createElement(Card, {style:{padding:0,overflow:'hidden'}},
            React.createElement('div', {style:{maxHeight:'calc(4 * 68px)',overflowY:'auto'}},
              React.createElement(ExpenseList, {expenses:weekExps,onDelete:props.onDelete,onEdit:props.onEdit})
            ),
            weekExps.length>4?React.createElement('div',{style:{textAlign:'center',padding:'0.4rem',fontSize:'0.7rem',color:C.textMuted,borderTop:'1px solid '+C.border}},'↕ Deslizá para ver más'):null
          )
    )
  );
}

// ── Stats charts ──────────────────────────────────────────────────────────────
function TablaCategoria(props) {
  return React.createElement('div', null,
    props.data.map(function(c,i) {
      return React.createElement('div', {key:c.label,style:{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.5rem'}},
        React.createElement('div', {style:{width:'8px',height:'8px',borderRadius:'50%',background:PALETTE[i%PALETTE.length],flexShrink:0}}),
        React.createElement('span', {style:{flex:1,fontSize:'0.78rem',color:C.navy,fontWeight:600}}, c.emoji+' '+c.label),
        React.createElement('span', {style:{fontSize:'0.78rem',color:C.navy,fontWeight:700}}, fmtS(c.value,props.cur)),
        React.createElement('span', {style:{fontSize:'0.7rem',color:C.textMuted,width:'2.5rem',textAlign:'right'}}, c.pct+'%')
      );
    })
  );
}
function TablaPM(props) {
  return React.createElement('div', null,
    props.data.map(function(p,i) {
      return React.createElement('div', {key:p.name,style:{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.45rem'}},
        React.createElement('div', {style:{width:'8px',height:'8px',borderRadius:'50%',background:PALETTE[i%PALETTE.length],flexShrink:0}}),
        React.createElement('span', {style:{flex:1,fontSize:'0.78rem',color:C.navy,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}, p.name),
        React.createElement('span', {style:{fontSize:'0.78rem',fontWeight:700,color:C.navy}}, fmtS(p.value,props.cur)),
        React.createElement('span', {style:{fontSize:'0.7rem',color:C.textMuted,width:'2.5rem',textAlign:'right'}}, p.pct+'%')
      );
    })
  );
}

function CategoryChart(props) {
  var data=props.data, type=props.type, cur=props.cur;
  if (!data.length) return null;
  if (type==='Tabla') return React.createElement(TablaCategoria, {data:data,cur:cur});
  if (type==='Barras') return React.createElement(ResponsiveContainer,{width:'100%',height:Math.max(160,data.length*28)},
    React.createElement(BarChart,{data:data,layout:'vertical',margin:{top:0,right:40,bottom:0,left:0}},
      React.createElement(CartesianGrid,{strokeDasharray:'3 3',stroke:C.beige,horizontal:false}),
      React.createElement(XAxis,{type:'number',tickFormatter:function(v){return fmtS(v,cur);},tick:{fontSize:9,fontFamily:F,fill:C.textMuted}}),
      React.createElement(YAxis,{type:'category',dataKey:'label',tick:{fontSize:9,fontFamily:F,fill:C.navy},width:90}),
      React.createElement(Tooltip,{formatter:function(v){return fmtS(v,cur);},contentStyle:{fontFamily:F,fontSize:'0.78rem',borderRadius:'0.6rem',border:'1px solid '+C.border}}),
      React.createElement(Bar,{dataKey:'value',radius:[0,4,4,0]},data.map(function(_,i){return React.createElement(Cell,{key:i,fill:PALETTE[i%PALETTE.length]});}))
    )
  );
  if (type==='Radar') return React.createElement(ResponsiveContainer,{width:'100%',height:220},
    React.createElement(RadarChart,{data:data.map(function(d){return{subject:d.label,value:d.value};})},
      React.createElement(PolarGrid,{stroke:C.beige}),
      React.createElement(PolarAngleAxis,{dataKey:'subject',tick:{fontSize:9,fontFamily:F,fill:C.navy}}),
      React.createElement(Radar,{dataKey:'value',stroke:C.navy,fill:C.accent,fillOpacity:0.35}),
      React.createElement(Tooltip,{formatter:function(v){return fmtS(v,cur);},contentStyle:{fontFamily:F,fontSize:'0.78rem',borderRadius:'0.6rem',border:'1px solid '+C.border}})
    )
  );
  if (type==='Torta') return React.createElement(ResponsiveContainer,{width:'100%',height:200},
    React.createElement(PieChart,null,
      React.createElement(Pie,{data:data,dataKey:'value',cx:'50%',cy:'50%',outerRadius:80,label:function(p){return p.pct+'%';},fontSize:9},
        data.map(function(_,i){return React.createElement(Cell,{key:i,fill:PALETTE[i%PALETTE.length]});})
      ),
      React.createElement(Tooltip,{formatter:function(v){return fmtS(v,cur);},contentStyle:{fontFamily:F,fontSize:'0.78rem',borderRadius:'0.6rem',border:'1px solid '+C.border}})
    )
  );
  return null;
}

function PMChart(props) {
  var data=props.data, type=props.type, cur=props.cur;
  if (!data.length) return null;
  if (type==='Tabla') return React.createElement(TablaPM, {data:data,cur:cur});
  if (type==='Barras') return React.createElement(ResponsiveContainer,{width:'100%',height:Math.max(160,data.length*28)},
    React.createElement(BarChart,{data:data,layout:'vertical',margin:{top:0,right:40,bottom:0,left:0}},
      React.createElement(CartesianGrid,{strokeDasharray:'3 3',stroke:C.beige,horizontal:false}),
      React.createElement(XAxis,{type:'number',tickFormatter:function(v){return fmtS(v,cur);},tick:{fontSize:9,fontFamily:F,fill:C.textMuted}}),
      React.createElement(YAxis,{type:'category',dataKey:'name',tick:{fontSize:8,fontFamily:F,fill:C.navy},width:95}),
      React.createElement(Tooltip,{formatter:function(v){return fmtS(v,cur);},contentStyle:{fontFamily:F,fontSize:'0.78rem',borderRadius:'0.6rem',border:'1px solid '+C.border}}),
      React.createElement(Bar,{dataKey:'value',radius:[0,4,4,0]},data.map(function(_,i){return React.createElement(Cell,{key:i,fill:PALETTE[i%PALETTE.length]});}))
    )
  );
  if (type==='Radar') {
    var rd=data.map(function(d){return{subject:d.name.split(' ').pop(),value:d.value};});
    return React.createElement(ResponsiveContainer,{width:'100%',height:220},
      React.createElement(RadarChart,{data:rd},
        React.createElement(PolarGrid,{stroke:C.beige}),
        React.createElement(PolarAngleAxis,{dataKey:'subject',tick:{fontSize:9,fontFamily:F,fill:C.navy}}),
        React.createElement(Radar,{dataKey:'value',stroke:C.accent,fill:C.accent,fillOpacity:0.35}),
        React.createElement(Tooltip,{formatter:function(v){return fmtS(v,cur);},contentStyle:{fontFamily:F,fontSize:'0.78rem',borderRadius:'0.6rem',border:'1px solid '+C.border}})
      )
    );
  }
  if (type==='Torta') return React.createElement(ResponsiveContainer,{width:'100%',height:200},
    React.createElement(PieChart,null,
      React.createElement(Pie,{data:data,dataKey:'value',cx:'50%',cy:'50%',outerRadius:80,label:function(p){return p.pct+'%';},fontSize:9},
        data.map(function(_,i){return React.createElement(Cell,{key:i,fill:PALETTE[i%PALETTE.length]});})
      ),
      React.createElement(Tooltip,{formatter:function(v){return fmtS(v,cur);},contentStyle:{fontFamily:F,fontSize:'0.78rem',borderRadius:'0.6rem',border:'1px solid '+C.border}})
    )
  );
  return null;
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function Stats(props) {
  var expenses=props.expenses||[], settings=props.settings||{}, allCats=props.allCats||DEFAULT_CATS;
  var configPeriods=settings.periods||[];
  var allPeriodNames=[].concat(configPeriods.map(function(p){return p.name;}), expenses.filter(function(e){return e.period&&e.period!==PENDING_PER;}).map(function(e){return e.period;})).filter(function(p,i,a){return a.indexOf(p)===i;});
  var allCurrencies=expenses.map(function(e){return e.currency||'ARS';}).filter(function(c,i,a){return a.indexOf(c)===i;});
  var periodState=useState('Todos'); var period=periodState[0]; var setPeriod=periodState[1];
  var curState=useState('ARS'); var cur=curState[0]; var setCur=curState[1];
  var catState=useState('Tabla'); var catChart=catState[0]; var setCatChart=catState[1];
  var pmState=useState('Tabla'); var pmChart=pmState[0]; var setPmChart=pmState[1];

  var byPer=period==='Todos'?expenses:expenses.filter(function(e){return e.period===period;});
  var filtered=byPer.filter(function(e){return (e.currency||'ARS')===cur&&e.period!==PENDING_PER;});

  // Previous period comparison
  var prevPeriodData=null;
  if (period!=='Todos') {
    var idx=configPeriods.findIndex(function(p){return p.name===period;});
    if (idx>0) {
      var prevName=configPeriods[idx-1].name;
      var prevExps=expenses.filter(function(e){return e.period===prevName&&(e.currency||'ARS')===cur&&e.period!==PENDING_PER;});
      prevPeriodData={total:prevExps.reduce(function(s,e){return s+safeN(e.amount);},0),count:prevExps.length};
    }
  }

  if (!filtered.length) return React.createElement('div', {style:{padding:'1rem'}},
    React.createElement('h2', {style:{fontWeight:900,fontSize:'1.2rem',color:C.navy,marginBottom:'0.75rem'}}, '📊 Estadísticas'),
    React.createElement(ScrollFilter, {items:['Todos'].concat(allPeriodNames),selected:period,onSelect:setPeriod}),
    allCurrencies.length>1?React.createElement(ScrollFilter,{items:allCurrencies,selected:cur,onSelect:setCur}):null,
    React.createElement(Card, {style:{textAlign:'center',padding:'3rem',color:C.textMuted}},
      React.createElement('div', {style:{fontSize:'2.5rem',marginBottom:'0.5rem'}}, '📊'),
      'No hay datos para este período/moneda'
    )
  );

  var total=filtered.reduce(function(s,e){return s+safeN(e.amount);},0);
  var count=filtered.length;
  var javiTotal=filtered.reduce(function(s,e){return s+safeN(e.javiAmount);},0);
  var laliTotal=filtered.reduce(function(s,e){return s+safeN(e.laliAmount);},0);
  var bal=calcBal(filtered);
  var javiPaid=filtered.filter(function(e){return e.paidBy==='Javi';}).reduce(function(s,e){return s+safeN(e.amount);},0);
  var laliPaid=filtered.filter(function(e){return e.paidBy==='Lali';}).reduce(function(s,e){return s+safeN(e.amount);},0);

  var byCat={};
  filtered.forEach(function(e){var k=catLb(normCat(e.category,allCats));if(!byCat[k])byCat[k]={label:k,emoji:catEm(normCat(e.category,allCats)),value:0};byCat[k].value+=safeN(e.amount);});
  var catData=Object.values(byCat).sort(function(a,b){return b.value-a.value;}).map(function(c){return Object.assign({},c,{pct:total>0?Math.round(c.value/total*100):0});});

  var byPM={};
  filtered.forEach(function(e){var k=e.paymentMethod||'Otro';byPM[k]=(byPM[k]||0)+safeN(e.amount);});
  var pmData=Object.entries(byPM).sort(function(a,b){return b[1]-a[1];}).map(function(entry){return{name:entry[0],value:entry[1],pct:total>0?Math.round(entry[1]/total*100):0};});

  var byP={};
  filtered.forEach(function(e){var k=e.period||'Sin período';if(!byP[k])byP[k]={period:k,javi:0,lali:0};byP[k].javi+=safeN(e.javiAmount);byP[k].lali+=safeN(e.laliAmount);});
  var perData=Object.values(byP);

  var amtPct=prevPeriodData?pctChange(total,prevPeriodData.total):null;
  var cntPct=prevPeriodData?pctChange(count,prevPeriodData.count):null;

  return React.createElement('div', {style:{padding:'1rem',paddingBottom:'2rem',display:'flex',flexDirection:'column',gap:'0.75rem'}},
    React.createElement('h2', {style:{fontWeight:900,fontSize:'1.2rem',color:C.navy,margin:0}}, '📊 Estadísticas'),
    React.createElement(ScrollFilter, {items:['Todos'].concat(allPeriodNames),selected:period,onSelect:setPeriod}),
    allCurrencies.length>1?React.createElement(ScrollFilter,{items:allCurrencies,selected:cur,onSelect:setCur}):null,

    // Summary with comparison
    React.createElement('div', {style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.6rem'}},
      React.createElement(Card, {style:{padding:'0.75rem',background:C.gradMain}},
        React.createElement('div', {style:{fontSize:'0.65rem',color:'rgba(255,255,255,0.7)',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.05em'}}, 'TOTAL '+cur),
        React.createElement('div', {style:{fontWeight:900,color:C.white,fontSize:'1.1rem',marginTop:'0.1rem'}}, fmtS(total,cur)),
        amtPct!==null ? React.createElement('div', {style:{display:'flex',alignItems:'center',gap:'0.3rem',marginTop:'0.2rem'}},
          React.createElement('span', {style:{fontSize:'0.75rem',color:amtPct>=0?'#a8f0d5':'#fca5a5',fontWeight:800}}, (amtPct>=0?'▲':'▼')+' '+Math.abs(amtPct)+'%'),
          React.createElement('span', {style:{fontSize:'0.65rem',color:'rgba(255,255,255,0.6)'}}, 'vs anterior')
        ) : null,
        prevPeriodData ? React.createElement('div', {style:{marginTop:'0.3rem'}},
          React.createElement('div', {style:{background:'rgba(255,255,255,0.15)',borderRadius:'999px',height:'4px',overflow:'hidden'}},
            React.createElement('div', {style:{width:Math.min(100,(prevPeriodData.total>0?Math.round(Math.min(total,prevPeriodData.total)/Math.max(total,prevPeriodData.total)*100):100))+'%',height:'100%',background:'rgba(255,255,255,0.6)',borderRadius:'999px'}})
          )
        ) : null
      ),
      React.createElement(Card, {style:{padding:'0.75rem',background:C.gradMain}},
        React.createElement('div', {style:{fontSize:'0.65rem',color:'rgba(255,255,255,0.7)',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.05em'}}, 'Nº GASTOS'),
        React.createElement('div', {style:{fontWeight:900,color:C.white,fontSize:'1.1rem',marginTop:'0.1rem'}}, count),
        cntPct!==null ? React.createElement('div', {style:{display:'flex',alignItems:'center',gap:'0.3rem',marginTop:'0.2rem'}},
          React.createElement('span', {style:{fontSize:'0.75rem',color:cntPct>=0?'#a8f0d5':'#fca5a5',fontWeight:800}}, (cntPct>=0?'▲':'▼')+' '+Math.abs(cntPct)+'%'),
          React.createElement('span', {style:{fontSize:'0.65rem',color:'rgba(255,255,255,0.6)'}}, 'vs anterior ('+prevPeriodData.count+')')
        ) : null,
        !prevPeriodData ? React.createElement('div', {style:{fontSize:'0.65rem',color:'rgba(255,255,255,0.55)',marginTop:'0.2rem'}}, 'Seleccioná un período para comparar') : null
      )
    ),

    React.createElement(Card, {style:{padding:'0.75rem',background:Math.abs(bal)<1?'linear-gradient(135deg,#2d9e7f,#1db88c)':C.gradMain}},
      React.createElement('div', {style:{fontSize:'0.65rem',color:'rgba(255,255,255,0.7)',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.05em'}}, 'BALANCE'),
      Math.abs(bal)<1
        ? React.createElement('div', {style:{fontWeight:900,color:C.white,fontSize:'1rem',marginTop:'0.2rem'}}, '¡Al día! 🎉')
        : React.createElement(React.Fragment, null,
            React.createElement('div', {style:{fontWeight:900,color:C.white,fontSize:'1.1rem',marginTop:'0.2rem'}}, fmtS(bal,cur)),
            React.createElement('div', {style:{fontSize:'0.68rem',color:'rgba(255,255,255,0.8)'}}, bal>0?'Lali debe':'Javi debe')
          )
    ),

    React.createElement(Card, null,
      React.createElement('h3', {style:{fontWeight:800,color:C.navy,margin:'0 0 0.75rem',fontSize:'0.9rem'}}, '💳 ¿Quién pagó más?'),
      React.createElement('div', {style:{display:'flex',gap:'0.6rem',marginBottom:'0.6rem'}},
        [['Javi',C.gradJavi,javiPaid,'👨'],['Lali',C.gradLali,laliPaid,'👩']].map(function(row){
          return React.createElement('div', {key:row[0],style:{flex:1,background:row[1],borderRadius:'0.85rem',padding:'0.6rem',textAlign:'center',color:C.white}},
            React.createElement('div', {style:{fontSize:'1.2rem'}}, row[3]),
            React.createElement('div', {style:{fontWeight:800,fontSize:'0.9rem'}}, fmtS(row[2],cur)),
            React.createElement('div', {style:{fontSize:'0.7rem',opacity:0.85}}, (total>0?Math.round(row[2]/total*100):0)+'%')
          );
        })
      ),
      React.createElement('div', {style:{display:'flex',gap:'0.6rem'}},
        [['Javi',C.navy,javiTotal,'Resp. Javi'],['Lali',C.accent,laliTotal,'Resp. Lali']].map(function(row){
          return React.createElement('div', {key:row[0],style:{flex:1,background:C.bg,borderRadius:'0.75rem',padding:'0.5rem',textAlign:'center',border:'1px solid '+C.border}},
            React.createElement('div', {style:{fontSize:'0.65rem',color:C.textMuted}}, row[3]),
            React.createElement('div', {style:{fontWeight:800,color:row[1],fontSize:'0.85rem'}}, fmtS(row[2],cur))
          );
        })
      )
    ),

    React.createElement(Card, null,
      React.createElement('h3', {style:{fontWeight:800,color:C.navy,margin:'0 0 0.5rem',fontSize:'0.9rem'}}, '🗂 Gasto por categoría'),
      React.createElement(ChartSelector, {value:catChart,onChange:setCatChart}),
      React.createElement(CategoryChart, {data:catData,type:catChart,cur:cur})
    ),

    React.createElement(Card, null,
      React.createElement('h3', {style:{fontWeight:800,color:C.navy,margin:'0 0 0.5rem',fontSize:'0.9rem'}}, '💳 Métodos de pago'),
      React.createElement(ChartSelector, {value:pmChart,onChange:setPmChart}),
      React.createElement(PMChart, {data:pmData,type:pmChart,cur:cur})
    ),

    period==='Todos'&&perData.length>1 ? React.createElement(Card, null,
      React.createElement('h3', {style:{fontWeight:800,color:C.navy,margin:'0 0 0.75rem',fontSize:'0.9rem'}}, '📈 Evolución por período'),
      React.createElement(ResponsiveContainer,{width:'100%',height:180},
        React.createElement(BarChart,{data:perData,margin:{top:5,right:5,bottom:30,left:0}},
          React.createElement(CartesianGrid,{strokeDasharray:'3 3',stroke:C.beige}),
          React.createElement(XAxis,{dataKey:'period',tick:{fontSize:9,angle:-35,textAnchor:'end',fontFamily:F,fill:C.textMuted},interval:0}),
          React.createElement(YAxis,{tickFormatter:function(v){return fmtS(v,cur);},tick:{fontSize:9,fontFamily:F,fill:C.textMuted},width:45}),
          React.createElement(Tooltip,{formatter:function(v){return fmtS(v,cur);},contentStyle:{fontFamily:F,fontSize:'0.78rem',borderRadius:'0.6rem',border:'1px solid '+C.border}}),
          React.createElement(Bar,{dataKey:'javi',name:'Javi',fill:C.navy,stackId:'a'}),
          React.createElement(Bar,{dataKey:'lali',name:'Lali',fill:C.accent,stackId:'a',radius:[4,4,0,0]})
        )
      ),
      React.createElement('div', {style:{display:'flex',gap:'1rem',justifyContent:'center',marginTop:'0.5rem'}},
        [['Javi',C.navy],['Lali',C.accent]].map(function(row){
          return React.createElement('div',{key:row[0],style:{display:'flex',alignItems:'center',gap:'0.3rem',fontSize:'0.75rem',color:C.navy}},
            React.createElement('div',{style:{width:'10px',height:'10px',borderRadius:'2px',background:row[1]}}),row[0]);
        })
      )
    ) : null
  );
}

// ── History ───────────────────────────────────────────────────────────────────
function PeriodBlock(props) {
  var period=props.period, exps=props.exps, isOpen=props.isOpen, isPending=props.isPending;
  var isSelected=props.isSelected, hasSelection=props.hasSelection;
  var onToggle=props.onToggle, onDelete=props.onDelete, onEdit=props.onEdit;
  var total=exps.reduce(function(s,e){return s+safeN(e.amount);},0);
  var arsExps=exps.filter(function(e){return (e.currency||'ARS')==='ARS';});
  var bal=calcBal(arsExps);
  var highlighted=isOpen||isSelected;
  var headerBg=isPending?'#fef3c7':(isSelected?C.accent:(isOpen?C.navy:C.white));
  var headerBorder=isPending?'#f59e0b':(isSelected?C.accent:(isOpen?C.navy:C.border));
  var textColor=isPending?'#92400e':(highlighted?C.white:C.navy);
  var subColor=isPending?'#b45309':(highlighted?'rgba(255,255,255,0.7)':C.textMuted);
  var showBody=highlighted;
  return React.createElement('div', null,
    React.createElement('div', {onClick:onToggle,style:{display:'flex',justifyContent:'space-between',alignItems:'center',background:headerBg,borderRadius:isOpen?'1rem 1rem 0 0':'1rem',padding:'0.85rem 1rem',boxShadow:'0 2px 8px rgba(23,72,113,0.08)',cursor:'pointer',border:'1px solid '+headerBorder}},
      React.createElement('div', null,
        React.createElement('div', {style:{fontWeight:800,color:textColor,fontSize:'0.9rem'}}, period),
        React.createElement('div', {style:{fontSize:'0.7rem',color:subColor,marginTop:'0.1rem'}}, exps.length+' gastos · '+fmt(total))
      ),
      React.createElement('div', {style:{display:'flex',alignItems:'center',gap:'0.75rem'}},
        !isPending && (Math.abs(bal)>=1
          ? React.createElement('div', {style:{textAlign:'right'}},
              React.createElement('div', {style:{fontSize:'0.7rem',fontWeight:800,color:highlighted?'rgba(255,255,255,0.9)':C.accent}}, bal>0?'Lali debe':'Javi debe'),
              React.createElement('div', {style:{fontSize:'0.7rem',fontWeight:800,color:highlighted?'rgba(255,255,255,0.9)':C.accent}}, fmt(Math.abs(bal)))
            )
          : React.createElement('div', {style:{fontSize:'0.7rem',color:highlighted?'rgba(255,255,255,0.8)':'#2d9e7f',fontWeight:700}}, '✓ Al día')
        ),
        React.createElement('span', {style:{color:isPending?'#92400e':(highlighted?'rgba(255,255,255,0.8)':C.textMuted),fontSize:'0.85rem'}},
          hasSelection ? (isSelected?'☑':'☐') : (isOpen?'▲':'▼')
        )
      )
    ),
    showBody ? React.createElement('div', {style:{background:C.white,borderRadius:'0 0 1rem 1rem',boxShadow:'0 2px 8px rgba(23,72,113,0.08)',overflow:'hidden',border:'1px solid '+C.border,borderTop:'none'}},
      React.createElement(ExpenseList, {expenses:exps,onDelete:onDelete,onEdit:onEdit})
    ) : null
  );
}

function History(props) {
  var expenses=props.expenses||[], settings=props.settings||{};
  var searchState=useState(''); var search=searchState[0]; var setSearch=searchState[1];
  var selState=useState([]); var selectedPeriods=selState[0]; var setSelectedPeriods=selState[1];
  var openState=useState({}); var openMap=openState[0]; var setOpenMap=openState[1];

  var grouped={};
  expenses.forEach(function(e){var p=e.period||'Sin período';if(!grouped[p])grouped[p]=[];grouped[p].push(e);});
  var configOrder=(settings.periods||[]).map(function(p){return p.name;}).slice().reverse();
  var others=Object.keys(grouped).filter(function(p){return configOrder.indexOf(p)<0&&p!==PENDING_PER;});
  var allSorted=configOrder.filter(function(p){return grouped[p];}).concat(others).concat(grouped[PENDING_PER]?[PENDING_PER]:[]);
  var searchLower=search.toLowerCase().trim();
  var filteredPeriods=searchLower?allSorted.filter(function(p){return p.toLowerCase().indexOf(searchLower)>=0;}):allSorted;
  var hasSelection=selectedPeriods.length>0;
  var displayPeriods=hasSelection?filteredPeriods.filter(function(p){return selectedPeriods.indexOf(p)>=0;}):filteredPeriods;

  function toggleSelect(p) { setSelectedPeriods(function(prev){return prev.indexOf(p)>=0?prev.filter(function(x){return x!==p;}):[].concat(prev,[p]);}); }
  function toggleOpen(p) { setOpenMap(function(prev){var next=Object.assign({},prev);next[p]=!next[p];return next;}); }
  function handleRowToggle(p) { if(hasSelection)toggleSelect(p); else toggleOpen(p); }

  return React.createElement('div', {style:{padding:'1rem',paddingBottom:'2rem'}},
    React.createElement('h2', {style:{fontWeight:900,fontSize:'1.2rem',color:C.navy,marginBottom:'0.75rem'}}, 'Historial'),
    React.createElement(SearchBox, {value:search,onChange:setSearch,placeholder:'🔍 Buscar período...'}),
    allSorted.length>3 ? React.createElement('div', {style:{marginBottom:'0.6rem'}},
      React.createElement('div', {style:{fontSize:'0.7rem',color:C.textMuted,marginBottom:'0.3rem',fontWeight:700}},
        hasSelection?(selectedPeriods.length+' período(s) seleccionado(s)'):'Todos los períodos'
      ),
      React.createElement(ScrollFilter, {items:filteredPeriods,selected:selectedPeriods,onSelect:toggleSelect,multi:true}),
      hasSelection ? React.createElement('button', {onClick:function(){setSelectedPeriods([]);},style:{background:'transparent',border:'1px solid '+C.accent,borderRadius:'999px',padding:'0.2rem 0.65rem',fontSize:'0.7rem',color:C.accent,cursor:'pointer',fontFamily:F,fontWeight:700,marginTop:'0.3rem'}}, '✕ Limpiar selección') : null
    ) : null,
    filteredPeriods.length===0
      ? React.createElement(Card, {style:{textAlign:'center',padding:'3rem',color:C.textMuted}},
          React.createElement('div', {style:{fontSize:'2.5rem',marginBottom:'0.5rem'}}, '🔍'),
          'No se encontraron períodos'
        )
      : React.createElement('div', {style:{display:'flex',flexDirection:'column',gap:'0.75rem',maxHeight:allSorted.length>3?'65vh':undefined,overflowY:allSorted.length>3?'auto':undefined}},
          displayPeriods.map(function(period){
            return React.createElement(PeriodBlock, {
              key:period, period:period,
              exps:sortByDate(grouped[period]||[]),
              isOpen:!!openMap[period], isSelected:selectedPeriods.indexOf(period)>=0,
              isPending:period===PENDING_PER, hasSelection:hasSelection,
              onToggle:function(){handleRowToggle(period);},
              onDelete:props.onDelete, onEdit:props.onEdit,
            });
          })
        )
  );
}

// ── AddEditExpense ────────────────────────────────────────────────────────────
function AddEditExpense(props) {
  var currentUser=props.currentUser, settings=props.settings||{}, allCats=props.allCats||DEFAULT_CATS;
  var customCats=props.customCats||[], onSaveCats=props.onSaveCats;
  var isEdit=!!props.initialData;
  var initForm=props.initialData||{date:todayStr(),description:'',amount:'',category:allCats[0]||DEFAULT_CATS[0],paymentMethod:PAY_METHODS[0],bank:BANKS[0],paidBy:currentUser,responsible:'Ambos',currency:'ARS',customCurrency:''};
  var formState=useState(initForm); var form=formState[0]; var setForm=formState[1];
  var errState=useState({}); var errors=errState[0]; var setErrors=errState[1];
  var newCatState=useState(false); var showNewCat=newCatState[0]; var setShowNewCat=newCatState[1];
  var emojiState=useState(''); var newCatEmoji=emojiState[0]; var setNewCatEmoji=emojiState[1];
  var nameState=useState(''); var newCatName=nameState[0]; var setNewCatName=nameState[1];
  var cuotaState=useState(false); var useCuotas=cuotaState[0]; var setUseCuotas=cuotaState[1];
  var numState=useState(12); var numCuotas=numState[0]; var setNumCuotas=numState[1];
  var custNumState=useState(''); var customCuotas=custNumState[0]; var setCustomCuotas=custNumState[1];

  function set(k,v){setForm(function(f){var next=Object.assign({},f);next[k]=v;return next;});}
  var finalCuotas=customCuotas?parseInt(customCuotas)||numCuotas:numCuotas;
  var cur=BASE_CURS.indexOf(form.currency)>=0?form.currency:(form.customCurrency||'ARS');
  var amts=calcAmts(form.amount,form.responsible);
  var javiAmount=amts.javiAmount, laliAmount=amts.laliAmount;
  var showSplit=form.amount&&parseFloat(form.amount)>0;
  var installmentAmt=showSplit&&useCuotas?Math.round(parseFloat(form.amount)/finalCuotas):0;

  function addNewCat(){
    if(!newCatName.trim())return;
    var cat=(newCatEmoji||'📌')+' '+newCatName.trim();
    onSaveCats(customCats.concat([cat]));set('category',cat);
    setNewCatEmoji('');setNewCatName('');setShowNewCat(false);
  }
  function submit(){
    var e={};
    if(!form.description.trim())e.description='Requerido';
    if(!form.amount||parseFloat(form.amount)<=0)e.amount='Monto inválido';
    if(Object.keys(e).length){setErrors(e);return;}
    var finalCur=form.currency==='Otra'?(form.customCurrency||'ARS'):form.currency;
    var base=Object.assign({},form,{id:isEdit?form.id:Date.now().toString(),amount:parseFloat(form.amount),javiAmount:javiAmount,laliAmount:laliAmount,currency:finalCur,period:getPeriod(form.date,settings.periods)});
    if(!isEdit){base.createdBy=currentUser;base.createdAt=new Date().toISOString();}
    if(!isEdit&&useCuotas&&finalCuotas>1){props.onSubmitPlan(base,finalCuotas);}else{props.onSubmit(base);}
  }
  var inpStyle=function(extra){return Object.assign({width:'100%',border:'1px solid '+C.border,borderRadius:'0.75rem',padding:'0.75rem',fontSize:'0.9rem',outline:'none',boxSizing:'border-box',fontFamily:F,color:C.navy},extra||{});};
  var selStyle={width:'100%',border:'1px solid '+C.border,borderRadius:'0.75rem',padding:'0.75rem',fontSize:'0.9rem',outline:'none',background:C.white,boxSizing:'border-box',fontFamily:F,color:C.navy};
  function Lbl(text){return React.createElement('label',{style:{fontSize:'0.8rem',color:C.textMuted,fontWeight:700,display:'block',marginBottom:'0.35rem',marginTop:'0.75rem'}},text);}
  return React.createElement('div',{style:{padding:'1rem',paddingBottom:'2rem'}},
    React.createElement('h2',{style:{fontWeight:900,fontSize:'1.2rem',color:C.navy,marginBottom:'0.5rem'}},isEdit?'✏️ Editar gasto':'Nuevo gasto'),
    Lbl('Descripción'),
    React.createElement('input',{style:inpStyle({borderColor:errors.description?'#c0314f':C.border}),value:form.description,onChange:function(e){set('description',e.target.value);},placeholder:'Ej: Almuerzo en Lo de Juan'}),
    errors.description?React.createElement('p',{style:{color:'#c0314f',fontSize:'0.7rem',margin:'0.15rem 0 0'}},'⚠ '+errors.description):null,
    Lbl('Monto total'),
    React.createElement('input',{style:inpStyle({borderColor:errors.amount?'#c0314f':C.border}),type:'number',value:form.amount,onChange:function(e){set('amount',e.target.value);},placeholder:'0'}),
    errors.amount?React.createElement('p',{style:{color:'#c0314f',fontSize:'0.7rem',margin:'0.15rem 0 0'}},'⚠ '+errors.amount):null,
    Lbl('Moneda'),
    React.createElement('div',{style:{display:'flex',gap:'0.4rem',flexWrap:'wrap'}},
      BASE_CURS.concat(['Otra']).map(function(c){
        return React.createElement('button',{key:c,onClick:function(){set('currency',c);},style:{padding:'0.4rem 0.85rem',fontSize:'0.78rem',borderRadius:'0.75rem',border:'1px solid',cursor:'pointer',fontWeight:form.currency===c?800:500,fontFamily:F,background:form.currency===c?C.navy:'transparent',borderColor:form.currency===c?C.navy:C.border,color:form.currency===c?C.white:C.navy}},c);
      })
    ),
    form.currency==='Otra'?React.createElement('input',{style:inpStyle({marginTop:'0.4rem'}),value:form.customCurrency||'',onChange:function(e){set('customCurrency',e.target.value.toUpperCase());},placeholder:'Ej: BRL, GBP...',maxLength:5}):null,
    Lbl('Fecha'),
    React.createElement('input',{style:inpStyle(),type:'date',value:form.date,onChange:function(e){set('date',e.target.value);}}),
    Lbl('Categoría'),
    React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.4rem'}},
      allCats.map(function(c){
        return React.createElement('button',{key:c,onClick:function(){set('category',c);},style:{padding:'0.4rem 0.2rem',fontSize:'0.7rem',borderRadius:'0.65rem',border:'1px solid',cursor:'pointer',fontFamily:F,background:form.category===c?C.accent:'transparent',borderColor:form.category===c?C.accent:C.border,color:form.category===c?C.white:C.navy,textAlign:'center',lineHeight:1.3,fontWeight:form.category===c?700:400}},c);
      })
    ),
    !showNewCat
      ? React.createElement('button',{onClick:function(){setShowNewCat(true);},style:{marginTop:'0.5rem',background:'transparent',border:'1px dashed '+C.accent,borderRadius:'0.65rem',color:C.accent,fontSize:'0.72rem',fontWeight:700,cursor:'pointer',padding:'0.35rem 0.75rem',fontFamily:F,display:'block'}},'➕ Nueva categoría')
      : React.createElement('div',{style:{marginTop:'0.5rem',background:C.bg,borderRadius:'0.75rem',padding:'0.6rem',display:'flex',gap:'0.4rem',alignItems:'center',border:'1px solid '+C.border}},
          React.createElement('input',{value:newCatEmoji,onChange:function(e){setNewCatEmoji(e.target.value);},placeholder:'🏷️',style:{width:'2.5rem',border:'1px solid '+C.border,borderRadius:'0.5rem',padding:'0.4rem',fontSize:'0.85rem',textAlign:'center',outline:'none',fontFamily:F}}),
          React.createElement('input',{value:newCatName,onChange:function(e){setNewCatName(e.target.value);},placeholder:'Nombre...',style:{flex:1,border:'1px solid '+C.border,borderRadius:'0.5rem',padding:'0.4rem',fontSize:'0.82rem',outline:'none',fontFamily:F,color:C.navy}}),
          React.createElement('button',{onClick:addNewCat,style:{background:C.accent,color:C.white,border:'none',borderRadius:'0.5rem',padding:'0.4rem 0.6rem',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',fontFamily:F}},'OK'),
          React.createElement('button',{onClick:function(){setShowNewCat(false);},style:{background:'none',border:'none',color:C.textMuted,cursor:'pointer',fontSize:'0.9rem'}},'✕')
        ),
    Lbl('Medio de pago'),
    React.createElement('select',{value:form.paymentMethod,onChange:function(e){set('paymentMethod',e.target.value);},style:selStyle},PAY_METHODS.map(function(m){return React.createElement('option',{key:m},m);})),
    Lbl('Banco / Billetera'),
    React.createElement('select',{value:form.bank,onChange:function(e){set('bank',e.target.value);},style:selStyle},BANKS.map(function(b){return React.createElement('option',{key:b},b);})),
    !isEdit ? React.createElement(React.Fragment,null,
      Lbl('¿Pago en cuotas?'),
      React.createElement('div',{style:{display:'flex',gap:'0.5rem'}},
        React.createElement(SegBtn,{active:!useCuotas,color:C.navy,onClick:function(){setUseCuotas(false);}},'💵 Pago único'),
        React.createElement(SegBtn,{active:useCuotas,color:C.accent,onClick:function(){setUseCuotas(true);}},'📅 En cuotas')
      ),
      useCuotas ? React.createElement('div',{style:{background:C.bg,borderRadius:'1rem',padding:'0.85rem',marginTop:'0.5rem',border:'1px solid '+C.border}},
        React.createElement('div',{style:{fontSize:'0.78rem',color:C.navy,fontWeight:700,marginBottom:'0.5rem'}},'Cantidad de cuotas'),
        React.createElement('div',{style:{display:'flex',gap:'0.4rem',flexWrap:'wrap',marginBottom:'0.5rem'}},
          CUOTA_OPTS.map(function(n){
            var active=numCuotas===n&&!customCuotas;
            return React.createElement('button',{key:n,onClick:function(){setNumCuotas(n);setCustomCuotas('');},style:{padding:'0.35rem 0.65rem',fontSize:'0.78rem',borderRadius:'0.65rem',border:'1px solid',cursor:'pointer',fontFamily:F,fontWeight:active?800:500,background:active?C.navy:'transparent',borderColor:active?C.navy:C.border,color:active?C.white:C.navy}},n);
          }),
          React.createElement('input',{type:'number',value:customCuotas,onChange:function(e){setCustomCuotas(e.target.value);},placeholder:'Otra',min:2,max:60,style:{width:'4rem',border:'1px solid '+(customCuotas?C.navy:C.border),borderRadius:'0.65rem',padding:'0.35rem 0.5rem',fontSize:'0.78rem',outline:'none',fontFamily:F,color:C.navy,background:customCuotas?C.beige:'transparent',textAlign:'center'}})
        ),
        showSplit ? React.createElement('div',{style:{background:C.white,borderRadius:'0.75rem',padding:'0.6rem',border:'1px solid '+C.border,display:'flex',justifyContent:'space-between',alignItems:'center'}},
          React.createElement('div',null,
            React.createElement('div',{style:{fontSize:'0.7rem',color:C.textMuted}},'Por cuota'),
            React.createElement('div',{style:{fontWeight:900,color:C.navy,fontSize:'1.1rem'}},fmt(installmentAmt,cur))
          ),
          React.createElement('div',{style:{fontSize:'0.75rem',color:C.textMuted,textAlign:'right'}},
            React.createElement('div',null,finalCuotas+' cuotas'),
            React.createElement('div',{style:{fontWeight:700,color:C.navy}},'Total: '+fmt(parseFloat(form.amount)||0,cur))
          )
        ) : null
      ) : null
    ) : null,
    Lbl('¿Quién pagó?'),
    React.createElement('div',{style:{display:'flex',gap:'0.5rem'}},
      React.createElement(SegBtn,{active:form.paidBy==='Javi',color:C.navy,onClick:function(){set('paidBy','Javi');}},'👨 Javi'),
      React.createElement(SegBtn,{active:form.paidBy==='Lali',color:C.accent,onClick:function(){set('paidBy','Lali');}},'👩 Lali')
    ),
    Lbl('¿Quién es responsable?'),
    React.createElement('div',{style:{display:'flex',gap:'0.5rem'}},
      React.createElement(SegBtn,{active:form.responsible==='Javi',color:C.navy,onClick:function(){set('responsible','Javi');}},'👨 Javi'),
      React.createElement(SegBtn,{active:form.responsible==='Ambos',color:C.navy,onClick:function(){set('responsible','Ambos');}},'👫 Ambos'),
      React.createElement(SegBtn,{active:form.responsible==='Lali',color:C.accent,onClick:function(){set('responsible','Lali');}},'👩 Lali')
    ),
    showSplit&&!useCuotas ? React.createElement('div',{style:{background:C.bg,borderRadius:'1rem',padding:'0.85rem 1rem',display:'flex',justifyContent:'space-between',marginTop:'0.75rem',border:'1px solid '+C.border}},
      React.createElement('div',{style:{textAlign:'center',flex:1}},React.createElement('div',{style:{fontSize:'0.7rem',color:C.textMuted}},'👨 Javi'),React.createElement('div',{style:{fontWeight:800,color:C.navy}},fmt(javiAmount,cur))),
      React.createElement('div',{style:{width:'1px',background:C.border}}),
      React.createElement('div',{style:{textAlign:'center',flex:1}},React.createElement('div',{style:{fontSize:'0.7rem',color:C.textMuted}},'👩 Lali'),React.createElement('div',{style:{fontWeight:800,color:C.accent}},fmt(laliAmount,cur)))
    ) : null,
    settings.periods&&settings.periods.length ? React.createElement('div',{style:{textAlign:'center',fontSize:'0.75rem',color:C.textMuted,marginTop:'0.5rem'}},'Período: ',React.createElement('strong',{style:{color:C.navy}},getPeriod(form.date,settings.periods))) : null,
    React.createElement('button',{onClick:submit,style:{width:'100%',padding:'1rem',background:C.gradMain,color:C.white,border:'none',borderRadius:'1rem',fontWeight:900,fontSize:'1rem',cursor:'pointer',fontFamily:F,boxShadow:'0 4px 12px rgba(23,72,113,0.25)',marginTop:'1rem'}},isEdit?'Guardar cambios ✓':(useCuotas?'Registrar '+finalCuotas+' cuotas ✓':'Guardar gasto ✓')),
    React.createElement('button',{onClick:props.onCancel,style:{width:'100%',padding:'0.75rem',background:'none',border:'none',color:C.textMuted,fontSize:'0.9rem',cursor:'pointer',fontFamily:F,marginTop:'0.25rem'}},'Cancelar')
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function Settings(props) {
  var settings=props.settings||{};
  var perState=useState(settings.periods||[]); var periods=perState[0]; var setPeriods=perState[1];
  var npState=useState({name:'',start:'',end:''}); var np=npState[0]; var setNp=npState[1];
  var errState=useState(''); var periodError=errState[0]; var setPeriodError=errState[1];
  var savedState=useState(false); var saved=savedState[0]; var setSaved=savedState[1];
  var csvFromState=useState(''); var csvFrom=csvFromState[0]; var setCsvFrom=csvFromState[1];
  var csvToState=useState(''); var csvTo=csvToState[0]; var setCsvTo=csvToState[1];

  function dateOverlaps(start,end,existing){
    var s=new Date(start+'T00:00:00'),e=new Date(end+'T23:59:59');
    for(var i=0;i<existing.length;i++){
      var ps=new Date(existing[i].start+'T00:00:00'),pe=new Date(existing[i].end+'T23:59:59');
      if(s<=pe&&e>=ps)return existing[i].name;
    }
    return null;
  }
  function addPeriod(){
    if(!np.name||!np.start||!np.end){setPeriodError('Completá todos los campos.');return;}
    if(np.start>np.end){setPeriodError('La fecha de inicio debe ser anterior a la de fin.');return;}
    var conflict=dateOverlaps(np.start,np.end,periods);
    if(conflict){setPeriodError('Se superpone con "'+conflict+'".');return;}
    setPeriodError('');setPeriods(function(p){return p.concat([np]);});setNp({name:'',start:'',end:''});
  }
  function save(){props.onSave(Object.assign({},settings,{periods:periods}));setSaved(true);setTimeout(function(){setSaved(false);},2000);}

  var inp={width:'100%',border:'1px solid '+C.border,borderRadius:'0.6rem',padding:'0.5rem 0.75rem',fontSize:'0.85rem',outline:'none',boxSizing:'border-box',fontFamily:F,color:C.navy,background:C.white};
  var btnBase={border:'none',borderRadius:'0.85rem',fontWeight:700,fontSize:'0.85rem',cursor:'pointer',fontFamily:F,padding:'0.65rem',width:'100%'};

  return React.createElement('div',{style:{padding:'1rem',paddingBottom:'2rem',display:'flex',flexDirection:'column',gap:'0.75rem'}},
    React.createElement('h2',{style:{fontWeight:900,fontSize:'1.2rem',color:C.navy,margin:0}},'Configuración'),

    // ── Sync entre dispositivos ──
    React.createElement(Card,null,
      React.createElement('h3',{style:{fontWeight:800,color:C.navy,margin:'0 0 0.4rem',fontSize:'0.95rem'}},'📱 Sincronizar entre dispositivos'),
      React.createElement('p',{style:{fontSize:'0.75rem',color:C.textMuted,margin:'0 0 0.75rem',lineHeight:1.6}},
        'Para pasar los datos de un dispositivo a otro: en el dispositivo que tiene los datos tocá ',
        React.createElement('strong',null,'"Exportar backup"'),
        ', compartí el archivo .json por WhatsApp o mail, y en el otro dispositivo tocá ',
        React.createElement('strong',null,'"Importar backup"'),
        '.'
      ),
      React.createElement('div',{style:{display:'flex',gap:'0.5rem'}},
        React.createElement('button',{onClick:props.onExportJSON,style:Object.assign({},btnBase,{background:C.gradMain,color:C.white})},'📤 Exportar backup'),
        React.createElement('button',{onClick:function(){document.getElementById('json-import-input').click();},style:Object.assign({},btnBase,{background:C.beige,color:C.navy})},'📥 Importar backup')
      ),
      React.createElement('input',{id:'json-import-input',type:'file',accept:'.json',style:{display:'none'},onChange:function(e){props.onImportJSON(e.target.files[0]);e.target.value='';}}),
      React.createElement('p',{style:{fontSize:'0.68rem',color:C.textMuted,margin:'0.5rem 0 0',textAlign:'center'}},
        '⚠ Importar fusiona los datos — no borra lo que ya tenés en el dispositivo.'
      )
    ),

    // ── Exportar CSV ──
    React.createElement(Card,null,
      React.createElement('h3',{style:{fontWeight:800,color:C.navy,margin:'0 0 0.4rem',fontSize:'0.95rem'}},'📊 Exportar gastos a CSV'),
      React.createElement('p',{style:{fontSize:'0.75rem',color:C.textMuted,margin:'0 0 0.6rem'}},'Elegí un rango de fechas y descargá los gastos. Podés abrirlo en Excel, Google Sheets o cualquier planilla.'),
      React.createElement('div',{style:{display:'flex',gap:'0.4rem',marginBottom:'0.5rem'}},
        React.createElement('div',{style:{flex:1}},
          React.createElement('div',{style:{fontSize:'0.72rem',color:C.textMuted,marginBottom:'0.2rem',fontWeight:700}},'Desde'),
          React.createElement('input',{type:'date',style:inp,value:csvFrom,onChange:function(e){setCsvFrom(e.target.value);}})
        ),
        React.createElement('div',{style:{flex:1}},
          React.createElement('div',{style:{fontSize:'0.72rem',color:C.textMuted,marginBottom:'0.2rem',fontWeight:700}},'Hasta'),
          React.createElement('input',{type:'date',style:inp,value:csvTo,onChange:function(e){setCsvTo(e.target.value);}})
        )
      ),
      React.createElement('button',{onClick:function(){props.onExportCSV(csvFrom,csvTo);},style:Object.assign({},btnBase,{background:C.gradMain,color:C.white})},'⬇️ Descargar CSV'),
      React.createElement('p',{style:{fontSize:'0.68rem',color:C.textMuted,margin:'0.4rem 0 0',textAlign:'center'}},'Si dejás las fechas vacías descarga todos los gastos.')
    ),

    // ── Períodos de cierre ──
    React.createElement(Card,null,
      React.createElement('h3',{style:{fontWeight:800,color:C.navy,margin:'0 0 0.75rem',fontSize:'0.95rem'}},'📅 Períodos de cierre'),
      React.createElement('div',{style:{background:C.bg,borderRadius:'0.85rem',padding:'0.75rem',marginBottom:'0.75rem',border:'1px solid '+C.border}},
        React.createElement('p',{style:{fontSize:'0.75rem',color:C.textMuted,marginBottom:'0.4rem',fontWeight:700}},'Agregar período:'),
        React.createElement('input',{style:Object.assign({},inp,{marginBottom:'0.4rem'}),value:np.name,onChange:function(e){setNp(function(p){return Object.assign({},p,{name:e.target.value});});setPeriodError('');},placeholder:'Ej: Mar-Abr 2026'}),
        React.createElement('div',{style:{display:'flex',gap:'0.4rem',marginBottom:'0.4rem'}},
          React.createElement('input',{type:'date',style:Object.assign({},inp,{flex:1}),value:np.start,onChange:function(e){setNp(function(p){return Object.assign({},p,{start:e.target.value});});setPeriodError('');}}),
          React.createElement('input',{type:'date',style:Object.assign({},inp,{flex:1}),value:np.end,onChange:function(e){setNp(function(p){return Object.assign({},p,{end:e.target.value});});setPeriodError('');}})
        ),
        periodError?React.createElement('p',{style:{color:'#c0314f',fontSize:'0.75rem',margin:'0 0 0.4rem',fontWeight:600}},'⚠ '+periodError):null,
        React.createElement('button',{onClick:addPeriod,style:{width:'100%',padding:'0.5rem',background:C.navy,color:C.white,border:'none',borderRadius:'0.6rem',fontWeight:700,fontSize:'0.85rem',cursor:'pointer',fontFamily:F}},'+ Agregar período')
      ),
      periods.length===0
        ? React.createElement('p',{style:{fontSize:'0.8rem',color:C.textMuted,margin:0}},'No hay períodos configurados aún.')
        : React.createElement(React.Fragment,null,
            React.createElement('p',{style:{fontSize:'0.75rem',color:C.textMuted,margin:'0 0 0.4rem',fontWeight:700}},'Períodos registrados ('+periods.length+'):'),
            React.createElement('div',{style:{maxHeight:'220px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'0.4rem'}},
              periods.slice().reverse().map(function(p,i){
                return React.createElement('div',{key:p.name+i,style:{display:'flex',justifyContent:'space-between',alignItems:'center',background:C.bg,borderRadius:'0.6rem',padding:'0.5rem 0.75rem',border:'1px solid '+C.border,flexShrink:0}},
                  React.createElement('div',null,
                    React.createElement('div',{style:{fontWeight:700,fontSize:'0.85rem',color:C.navy}},p.name),
                    React.createElement('div',{style:{fontSize:'0.7rem',color:C.textMuted}},p.start+' → '+p.end)
                  ),
                  React.createElement('button',{onClick:function(){setPeriods(function(ps){return ps.filter(function(x){return x.name!==p.name;});});},style:{background:'none',border:'none',color:'#c0314f',cursor:'pointer',fontSize:'1rem'}},'✕')
                );
              })
            )
          )
    ),

    React.createElement('button',{onClick:save,style:{width:'100%',padding:'0.9rem',border:'none',borderRadius:'1rem',fontWeight:900,fontSize:'0.95rem',cursor:'pointer',fontFamily:F,background:saved?'linear-gradient(135deg,#2d9e7f,#1db88c)':C.gradMain,color:C.white}},saved?'✓ Guardado':'Guardar configuración')
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  useFont();
  var userState=useState(null); var currentUser=userState[0]; var setCurrentUser=userState[1];
  var viewState=useState('dashboard'); var view=viewState[0]; var setView=viewState[1];
  var expState=useState([]); var expenses=expState[0]; var setExpenses=expState[1];
  var cfgState=useState({scriptUrl:'',periods:[]}); var settings=cfgState[0]; var setSettings=cfgState[1];
  var catState=useState([]); var customCats=catState[0]; var setCustomCats=catState[1];
  var planState=useState([]); var plans=planState[0]; var setPlans=planState[1];
  var loadState=useState(true); var loading=loadState[0]; var setLoading=loadState[1];
  var syncState=useState(false); var syncing=syncState[0]; var setSyncing=syncState[1];
  var msgState=useState(''); var syncMsg=msgState[0]; var setSyncMsg=msgState[1];
  var editState=useState(null); var editingExpense=editState[0]; var setEditingExpense=editState[1];

  var allCats=DEFAULT_CATS.concat(customCats);

  useEffect(function(){
    setCurrentUser(store.get('usr',null));
    setExpenses(store.get('exp',[]));
    setSettings(store.get('cfg',{scriptUrl:'',periods:[]}));
    setCustomCats(store.get('ccats',[]));
    setPlans(store.get('plans',[]));
    setLoading(false);
  },[]);

  function saveExpenses(exps){setExpenses(exps);store.set('exp',exps);}
  function savePlans(p){setPlans(p);store.set('plans',p);}
  function saveCustomCats(cats){
    setCustomCats(cats);store.set('ccats',cats);
    if(settings.scriptUrl){try{fetch(settings.scriptUrl,{method:'POST',mode:'no-cors',body:JSON.stringify({action:'saveConfig',periods:settings.periods,customCats:cats})});}catch(e){}}
  }
  function selectUser(u){setCurrentUser(u);store.set('usr',u);}
  function showMsg(msg,ms){setSyncMsg(msg);setTimeout(function(){setSyncMsg('');},ms||5000);}

  function saveSettings(s){
    var updated=expenses.map(function(e){return Object.assign({},e,{period:(!e.fromPlan&&e.date)?getPeriod(e.date,s.periods):(e.period||'Sin período')});});
    if(s.periods&&s.periods.length)updated=reassignPlanExpenses(updated,s.periods,plans);
    saveExpenses(updated);setSettings(s);store.set('cfg',s);
    if(s.scriptUrl){try{fetch(s.scriptUrl,{method:'POST',mode:'no-cors',body:JSON.stringify({action:'saveConfig',periods:s.periods,customCats:customCats})});}catch(e){}}
  }

  function syncConfig(){
    if(!settings.scriptUrl){showMsg('Configurá la URL del Apps Script primero.');return;}
    setSyncing(true);
    fetch(settings.scriptUrl,{redirect:'follow'}).then(function(res){
      if(!res.ok)throw new Error();
      return res.json();
    }).then(function(data){
      var remoteConfig=Array.isArray(data)?null:(data.config||null);
      var rawExps=Array.isArray(data)?data:(data.expenses||[]);
      var updatedSettings=settings;

      // Apply remote config if available
      if(remoteConfig){
        if(remoteConfig.periods&&remoteConfig.periods.length){
          updatedSettings=Object.assign({},settings,{periods:remoteConfig.periods});
          setSettings(updatedSettings);store.set('cfg',updatedSettings);
        }
        if(remoteConfig.customCats&&remoteConfig.customCats.length){
          setCustomCats(remoteConfig.customCats);store.set('ccats',remoteConfig.customCats);
        }
      }

      // Always sync expenses from Sheet — keeps all devices in sync
      if(rawExps.length){
        var cats=DEFAULT_CATS.concat(remoteConfig&&remoteConfig.customCats?remoteConfig.customCats:customCats);
        var localOnly=expenses.filter(function(e){return !e.fromSheet;});
        var sanitized=rawExps.map(function(e){return sanitize(e,cats);});
        saveExpenses(localOnly.concat(sanitized));
        showMsg('✓ '+sanitized.length+' gastos y configuración sincronizados.');
      } else if(remoteConfig){
        showMsg('✓ Configuración sincronizada.');
      } else {
        showMsg('⚠ No se encontró información en el Sheet.');
      }
    }).catch(function(){showMsg('⚠ No se pudo conectar. Verificá la URL.');}).then(function(){setSyncing(false);});
  }

  function handleAdd(expense){
    var s=sanitize(Object.assign({},expense,{id:Date.now().toString()}),allCats);
    saveExpenses([s].concat(expenses));
    setView('dashboard');
  }
  function handleAddPlan(formData,numInstallments){
    var amt=safeN(formData.amount);
    var installmentAmount=Math.round(amt/numInstallments);
    var amts=calcAmts(installmentAmount,formData.responsible);
    var startPeriod=getPeriod(formData.date,settings.periods);
    var plan={id:'plan_'+Date.now(),description:formData.description,totalAmount:amt,installmentAmount:installmentAmount,numInstallments:numInstallments,startPeriod:startPeriod,startDate:formData.date,currency:formData.currency||'ARS',paidBy:formData.paidBy,responsible:formData.responsible,paymentMethod:formData.paymentMethod,bank:formData.bank,category:formData.category,javiAmount:amts.javiAmount,laliAmount:amts.laliAmount,createdAt:new Date().toISOString()};
    var installments=generatePlanExpenses(plan,settings.periods);
    savePlans(plans.concat([plan]));
    saveExpenses(installments.concat(expenses));
    setView('dashboard');
  }
  function handleEdit(expense){
    var s=sanitize(expense,allCats);
    saveExpenses(expenses.map(function(e){return e.id===s.id?s:e;}));
    setEditingExpense(null);setView('dashboard');
  }
  function handleDelete(id){
    saveExpenses(expenses.filter(function(e){return e.id!==id;}));
  }
  function handleCancelPlan(planId){
    savePlans(plans.filter(function(p){return p.id!==planId;}));
    saveExpenses(expenses.filter(function(e){return e.planId!==planId;}));
  }

  // ── Sheet import (new device first-time setup) ──
  function importFromSheet(){
    if(!settings.scriptUrl){showMsg('Configurá la URL del Apps Script primero.');return;}
    setSyncing(true);
    fetch(settings.scriptUrl,{redirect:'follow'}).then(function(res){
      if(!res.ok)throw new Error();
      return res.json();
    }).then(function(data){
      var remoteConfig=Array.isArray(data)?null:(data.config||null);
      var rawExps=Array.isArray(data)?data:(data.expenses||[]);
      if(remoteConfig){
        if(remoteConfig.periods&&remoteConfig.periods.length){var ns=Object.assign({},settings,{periods:remoteConfig.periods});setSettings(ns);store.set('cfg',ns);}
        if(remoteConfig.customCats&&remoteConfig.customCats.length){setCustomCats(remoteConfig.customCats);store.set('ccats',remoteConfig.customCats);}
      }
      if(rawExps.length){
        var cats=DEFAULT_CATS.concat(remoteConfig&&remoteConfig.customCats?remoteConfig.customCats:customCats);
        // Deduplicate: merge Sheet data with local, local version wins on conflict
        var sheetSanitized=rawExps.map(function(e){return sanitize(e,cats);});
        var localById={};
        expenses.forEach(function(e){localById[e.id]=e;});
        var sheetIds=sheetSanitized.map(function(e){return e.id;});
        var merged=sheetSanitized.map(function(e){return localById[e.id]||e;});
        var localOnly=expenses.filter(function(e){return sheetIds.indexOf(e.id)<0;});
        saveExpenses(localOnly.concat(merged));
        showMsg('✓ '+sheetSanitized.length+' gastos importados del Sheet.');
      } else {
        showMsg(remoteConfig?'✓ Configuración sincronizada.':'⚠ No se encontraron datos en el Sheet.');
      }
    }).catch(function(){showMsg('⚠ No se pudo conectar. Verificá la URL.');}).then(function(){setSyncing(false);});
  }

  // ── Sheet export (backup manual) ──
  function exportToSheet(){
    if(!settings.scriptUrl){showMsg('Configurá la URL del Apps Script primero.');return;}
    setSyncing(true);
    var toSend=expenses.filter(function(e){return !e.fromPlan;});
    var sent=0;
    if(!toSend.length){showMsg('No hay gastos para subir.');setSyncing(false);return;}
    // Send config first
    fetch(settings.scriptUrl,{method:'POST',mode:'no-cors',body:JSON.stringify({action:'saveConfig',periods:settings.periods,customCats:customCats})}).catch(function(){});
    // Send expenses one by one
    toSend.forEach(function(e){
      fetch(settings.scriptUrl,{method:'POST',mode:'no-cors',body:JSON.stringify(Object.assign({action:'add'},e))}).catch(function(){});
    });
    setTimeout(function(){showMsg('✓ '+toSend.length+' gastos subidos al Sheet.');setSyncing(false);},1500);
  }

  // ── CSV Export ──
  function exportCSV(from, to){
    var filtered=expenses.filter(function(e){
      if(!e.date)return false;
      if(from&&e.date<from)return false;
      if(to&&e.date>to)return false;
      return true;
    });
    if(!filtered.length){showMsg('No hay gastos en ese rango de fechas.');return;}
    var header=['Fecha','Descripción','Monto','Moneda','Categoría','Medio de Pago','Banco','Pagó','Responsable','Monto Javi','Monto Lali','Período'];
    var rows=[header].concat(filtered.map(function(e){
      return [e.date,e.description,safeN(e.amount),e.currency||'ARS',e.category,e.paymentMethod,e.bank||'',e.paidBy,e.responsible,safeN(e.javiAmount),safeN(e.laliAmount),e.period||''];
    }));
    var csv=rows.map(function(r){return r.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
    var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url; a.download='gastos_'+(from||'inicio')+'_'+(to||'hoy')+'.csv';
    a.click(); URL.revokeObjectURL(url);
    showMsg('✓ CSV descargado ('+filtered.length+' gastos).');
  }

  if(loading)return React.createElement('div',{style:{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:C.textMuted,fontFamily:F,background:C.bg}},'Cargando...');
  if(!currentUser)return React.createElement(UserSelect,{onSelect:selectUser});

  if(editingExpense)return React.createElement('div',{style:{minHeight:'100vh',background:C.bg,maxWidth:'480px',margin:'0 auto',fontFamily:F,overflowY:'auto'}},
    React.createElement(AddEditExpense,{currentUser:currentUser,settings:settings,allCats:allCats,customCats:customCats,onSubmit:handleEdit,onSubmitPlan:handleAddPlan,onCancel:function(){setEditingExpense(null);},onSaveCats:saveCustomCats,initialData:Object.assign({},editingExpense,{amount:String(editingExpense.amount)})})
  );

  var tabs=[{id:'dashboard',icon:'🏠',label:'Inicio'},{id:'add',icon:'➕',label:'Agregar'},{id:'stats',icon:'📊',label:'Stats'},{id:'history',icon:'📋',label:'Historial'},{id:'settings',icon:'⚙️',label:'Config'}];

  return React.createElement('div',{style:{minHeight:'100vh',background:C.bg,display:'flex',flexDirection:'column',maxWidth:'480px',margin:'0 auto',fontFamily:F}},
    React.createElement('div',{style:{background:C.gradMain,padding:'0.75rem 1rem',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:10,boxShadow:'0 2px 12px rgba(23,72,113,0.25)'}},
      React.createElement('div',null,
        React.createElement('div',{style:{fontWeight:900,fontSize:'1.9rem',color:C.white,lineHeight:1.1}},'💑 Javi & Lali'),
        React.createElement('div',{style:{fontSize:'0.75rem',color:'rgba(255,255,255,0.75)'}},
          'Hola, ',React.createElement('span',{style:{fontWeight:900,color:C.white}},currentUser),
          syncing?React.createElement('span',{style:{marginLeft:'0.5rem',opacity:0.8}},'⟳'):null
        )
      ),
      React.createElement('button',{onClick:function(){setCurrentUser(null);store.del('usr');},style:{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:'0.6rem',padding:'0.35rem 0.7rem',fontSize:'0.75rem',color:C.white,cursor:'pointer',fontFamily:F,fontWeight:700}},'Cambiar')
    ),
    syncMsg?React.createElement('div',{style:{margin:'0.75rem 1rem 0',padding:'0.6rem 0.85rem',background:syncMsg.startsWith('✓')?'#d4f5eb':'#fdf0d5',borderRadius:'0.75rem',fontSize:'0.8rem',color:syncMsg.startsWith('✓')?'#1a6e4f':'#7a5c1a',fontWeight:700,border:'1px solid '+(syncMsg.startsWith('✓')?'#a8e8cf':'#f0d898')}},syncMsg):null,
    React.createElement('div',{style:{flex:1,overflowY:'auto',paddingBottom:'5rem',paddingTop:'0.75rem'}},
      view==='dashboard'?React.createElement(Dashboard,{expenses:expenses,settings:settings,plans:plans,onDelete:handleDelete,onEdit:function(e){setEditingExpense(e);},onSync:syncConfig,onCancelPlan:handleCancelPlan,syncing:syncing}):null,
      view==='add'?React.createElement(AddEditExpense,{currentUser:currentUser,settings:settings,allCats:allCats,customCats:customCats,onSubmit:handleAdd,onSubmitPlan:handleAddPlan,onCancel:function(){setView('dashboard');},onSaveCats:saveCustomCats}):null,
      view==='stats'?React.createElement(Stats,{expenses:expenses,settings:settings,allCats:allCats}):null,
      view==='history'?React.createElement(History,{expenses:expenses,settings:settings,onDelete:handleDelete,onEdit:function(e){setEditingExpense(e);}}):null,
      view==='settings'?React.createElement(Settings,{settings:settings,onSave:saveSettings}):null
    ),
    React.createElement('div',{style:{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'480px',background:C.white,borderTop:'1px solid '+C.border,display:'flex',boxShadow:'0 -2px 12px rgba(23,72,113,0.1)',zIndex:10}},
      tabs.map(function(t){
        return React.createElement('button',{key:t.id,onClick:function(){setView(t.id);},style:{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'0.5rem 0',border:'none',background:'none',cursor:'pointer',fontFamily:F,color:view===t.id?C.navy:C.textMuted,fontSize:'0.6rem',fontWeight:view===t.id?900:500,gap:'0.1rem'}},
          React.createElement('span',{style:{fontSize:'1.2rem',lineHeight:1}},t.icon),t.label
        );
      })
    )
  );
}