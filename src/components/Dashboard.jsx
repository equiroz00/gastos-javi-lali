// ── components/Dashboard.jsx ──────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { ChevronDown, ArrowRightLeft, Calendar, CreditCard, Check, Trash2, X } from 'lucide-react';
import { C, F, MONO, DEFAULT_CATS, PENDING_PER } from '../constants';
import { fmt, fmtS, safeN, catEm, catLb, calcBal, calcNetBal, sortByDate, getWeekStart, normCat } from '../lib/helpers';
import useAppStore from '../store/useAppStore';
import { Card, ScrollFilter } from './ui.jsx';
import ExpenseList from './ExpenseList.jsx';

// ── ActivePlans ────────────────────────────────────────────────────────────────
function ActivePlans(){
  var plans    = useAppStore(function(s){ return s.plans; });
  var expenses = useAppStore(function(s){ return s.expenses; });
  var cancelPlan = useAppStore(function(s){ return s.handleCancelPlan; });
  var searchState = useState(''); var search = searchState[0]; var setSearch = searchState[1];
  if(!plans.length) return null;
  var filtered = search.trim()===''?plans:plans.filter(function(p){return p.description.toLowerCase().indexOf(search.toLowerCase())>=0;});
  return React.createElement('div',null,
    React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}},
      React.createElement('h2',{style:{display:'flex',alignItems:'center',gap:'0.4rem',fontWeight:800,color:C.navy,fontSize:'0.88rem',margin:0}},
        React.createElement(CreditCard,{size:16,strokeWidth:2.2,color:C.accent}),'Cuotas activas'),
      React.createElement('span',{style:{fontSize:'0.68rem',color:C.textMuted}},plans.length+' plan'+(plans.length!==1?'es':''))
    ),
    plans.length>=3?React.createElement('input',{value:search,onChange:function(e){setSearch(e.target.value);},placeholder:'Buscar cuota...',style:{width:'100%',border:'1px solid '+C.border,borderRadius:'0.75rem',padding:'0.5rem 0.75rem',fontSize:'0.82rem',outline:'none',fontFamily:F,color:C.navy,background:C.surface,boxSizing:'border-box',marginBottom:'0.6rem'}}):null,
    React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'0.5rem',maxHeight:plans.length>=3?'280px':undefined,overflowY:plans.length>=3?'auto':undefined}},
      filtered.map(function(plan){
        var planExps=expenses.filter(function(e){return e.planId===plan.id;});
        var pending=planExps.filter(function(e){return e.period===PENDING_PER;}).length;
        var assigned=plan.numInstallments-pending;
        var pct=Math.round(assigned/plan.numInstallments*100);
        return React.createElement(Card,{key:plan.id,style:{padding:'0.85rem',flexShrink:0}},
          React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'0.4rem'}},
            React.createElement('div',{style:{flex:1,minWidth:0}},
              React.createElement('div',{style:{fontWeight:800,color:C.navy,fontSize:'0.88rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},plan.description),
              React.createElement('div',{style:{fontSize:'0.7rem',color:C.textMuted,marginTop:'0.1rem'}},fmt(plan.installmentAmount,plan.currency)+'/mes · Total: '+fmt(plan.totalAmount,plan.currency))
            ),
            React.createElement('div',{style:{textAlign:'right',flexShrink:0,marginLeft:'0.5rem'}},
              React.createElement('div',{style:{fontWeight:800,color:C.accent,fontSize:'0.82rem'}},assigned+'/'+plan.numInstallments),
              React.createElement('div',{style:{fontSize:'0.65rem',color:C.textMuted}},'cuotas')
            )
          ),
          React.createElement('div',{style:{background:C.beige,borderRadius:'999px',height:'6px',overflow:'hidden',marginBottom:'0.4rem'}},
            React.createElement('div',{style:{width:pct+'%',height:'100%',background:C.gradMain,borderRadius:'999px',transition:'width 0.4s'}})
          ),
          React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
            pending>0?React.createElement('div',{style:{fontSize:'0.68rem',color:'#b45309',fontWeight:600}},'⚠ '+pending+' cuota'+(pending>1?'s':'')+' sin período'):React.createElement('div',{style:{fontSize:'0.68rem',color:'#2d9e7f',fontWeight:600}},'✓ Todas asignadas'),
            React.createElement('button',{onClick:function(){cancelPlan(plan.id);},style:{background:'transparent',border:'1px solid '+C.border,borderRadius:'0.5rem',padding:'0.2rem 0.5rem',fontSize:'0.65rem',color:C.textMuted,cursor:'pointer',fontFamily:F}},'Cancelar')
          )
        );
      }),
      filtered.length===0?React.createElement('div',{style:{textAlign:'center',fontSize:'0.8rem',color:C.textMuted,padding:'1rem'}},'No se encontraron cuotas'):null
    )
  );
}

// ── useIsDesktop hook (local copy — avoids cross-file import) ──────────────────
function useIsDesktop(){
  var initState = useState(function(){ return window.innerWidth>=768; });
  var isDesktop = initState[0]; var setIsDesktop = initState[1];
  useEffect(function(){
    var handler = function(){ setIsDesktop(window.innerWidth>=768); };
    window.addEventListener('resize',handler);
    return function(){ window.removeEventListener('resize',handler); };
  },[]);
  return isDesktop;
}

// ── UnifiedHeader — Balance + Período + Total en un solo bloque ─────────────────
function UnifiedHeader(props){
  var periods      = props.periods||[];
  var selPeriod    = props.selPeriod;
  var setSelPeriod = props.setSelPeriod;
  var periodExps   = props.periodExps||[];
  var allPayments  = props.payments||[];
  var openPaymentModal = useAppStore(function(s){ return s.openPaymentModal; });
  var deletePayment    = useAppStore(function(s){ return s.deletePayment; });
  var expState = useState(false); var expanded = expState[0]; var setExpanded = expState[1];

  var filteredPayments = selPeriod==='Todos'
    ? allPayments
    : allPayments.filter(function(p){ return p.period===selPeriod; });

  // Agrupar por moneda
  var byCur = {};
  periodExps.forEach(function(e){ var c=e.currency||'ARS'; if(!byCur[c])byCur[c]={total:0}; byCur[c].total+=safeN(e.amount); });
  var curs = Object.keys(byCur).sort(function(a,b){ return byCur[b].total-byCur[a].total; });
  var count = periodExps.length;

  function balData(c){
    var netBal=calcNetBal(periodExps,filteredPayments,c);
    var curExps=periodExps.filter(function(e){return (e.currency||'ARS')===c;});
    return {
      netBal:netBal, noDebt:Math.abs(netBal)<1, laliOwes:netBal>0,
      javiPaid:curExps.filter(function(e){return e.paidBy==='Javi';}).reduce(function(s,e){return s+safeN(e.amount);},0),
      laliPaid:curExps.filter(function(e){return e.paidBy==='Lali';}).reduce(function(s,e){return s+safeN(e.amount);},0),
      javiOwes:curExps.reduce(function(s,e){return s+safeN(e.javiAmount);},0),
      laliOwes2:curExps.reduce(function(s,e){return s+safeN(e.laliAmount);},0),
      payAdj:filteredPayments.filter(function(p){return (p.currency||'ARS')===c;}),
      total:byCur[c]?byCur[c].total:0
    };
  }

  // ── Selector de período (chip dropdown) ──────────────────────────────────────
  var periodSelector = React.createElement('div',{style:{position:'relative',display:'inline-flex',alignItems:'center'}},
    React.createElement('select',{
      value:selPeriod,
      onChange:function(e){setSelPeriod(e.target.value);},
      style:{appearance:'none',WebkitAppearance:'none',border:'1px solid '+C.border,borderRadius:'999px',padding:'0.3rem 1.7rem 0.3rem 0.8rem',fontSize:'0.78rem',fontWeight:700,color:C.navy,background:C.bg,outline:'none',cursor:'pointer',fontFamily:F}
    },
      [React.createElement('option',{key:'Todos',value:'Todos'},'Todos los períodos')]
        .concat(periods.slice().reverse().map(function(p){return React.createElement('option',{key:p.name,value:p.name},p.name);}))
    ),
    React.createElement(ChevronDown,{size:14,strokeWidth:2.2,color:C.textMuted,style:{position:'absolute',right:'0.6rem',pointerEvents:'none'}})
  );

  // ── Estado vacío ─────────────────────────────────────────────────────────────
  if(!curs.length){
    return React.createElement(Card,{style:{padding:'1rem 1.1rem'}},
      React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}},
        periodSelector,
        React.createElement('span',{style:{fontSize:'0.72rem',color:C.textMuted,fontWeight:600}},'0 gastos')
      ),
      React.createElement('div',{style:{fontSize:'1.15rem',fontWeight:800,color:C.navy,padding:'0.5rem 0'}},'Sin gastos en este período')
    );
  }

  var primary = curs[0];
  var pd = balData(primary);

  // ── Fila de balance secundaria (otras monedas) ──────────────────────────────
  function secondaryRow(c){
    var d=balData(c);
    return React.createElement('div',{key:c,style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.6rem 0',borderTop:'1px solid '+C.border}},
      React.createElement('div',null,
        React.createElement('div',{style:{fontSize:'0.68rem',color:C.textMuted,fontWeight:600}},'Balance '+c),
        d.noDebt
          ?React.createElement('div',{style:{fontSize:'0.95rem',fontWeight:800,color:C.navy}},'Al día')
          :React.createElement('div',{style:{fontSize:'0.95rem',fontWeight:800,color:C.navy,fontFamily:MONO}},fmt(d.netBal,c))
      ),
      !d.noDebt?React.createElement('button',{
        onClick:function(){openPaymentModal(c,d.netBal,selPeriod==='Todos'?undefined:selPeriod);},
        style:{display:'flex',alignItems:'center',gap:'0.3rem',background:'transparent',border:'1px solid '+C.border,borderRadius:'0.6rem',padding:'0.35rem 0.6rem',color:C.accent,fontWeight:700,fontSize:'0.72rem',cursor:'pointer',fontFamily:F}
      },React.createElement(ArrowRightLeft,{size:13,strokeWidth:2.2}),'Pagar'):null
    );
  }

  // ── Panel de detalle (breakdown + pagos) ─────────────────────────────────────
  function detailPanel(c){
    var d=balData(c);
    return React.createElement('div',{key:'det_'+c,style:{marginTop:'0.75rem',paddingTop:'0.75rem',borderTop:'1px dashed '+C.border}},
      React.createElement('div',{style:{fontSize:'0.66rem',color:C.textMuted,fontWeight:700,marginBottom:'0.5rem',textTransform:'uppercase',letterSpacing:'0.05em'}},'Detalle '+c),
      React.createElement('div',{style:{display:'flex',gap:'0.5rem',marginBottom:'0.5rem'}},
        React.createElement('div',{style:{flex:1,background:C.bg,borderRadius:'0.7rem',padding:'0.55rem',border:'1px solid '+C.border}},
          React.createElement('div',{style:{fontSize:'0.62rem',color:C.textMuted,marginBottom:'0.15rem'}},'Javi pagó'),
          React.createElement('div',{style:{fontWeight:800,color:C.navy,fontFamily:MONO,fontSize:'0.82rem'}},fmt(d.javiPaid,c))
        ),
        React.createElement('div',{style:{flex:1,background:C.bg,borderRadius:'0.7rem',padding:'0.55rem',border:'1px solid '+C.border}},
          React.createElement('div',{style:{fontSize:'0.62rem',color:C.textMuted,marginBottom:'0.15rem'}},'Lali pagó'),
          React.createElement('div',{style:{fontWeight:800,color:C.navy,fontFamily:MONO,fontSize:'0.82rem'}},fmt(d.laliPaid,c))
        )
      ),
      d.payAdj.length>0?React.createElement('div',{style:{background:C.bg,borderRadius:'0.7rem',padding:'0.5rem 0.7rem',border:'1px solid '+C.border}},
        React.createElement('div',{style:{fontSize:'0.66rem',color:C.textMuted,fontWeight:700,marginBottom:'0.3rem'}},'Pagos registrados'),
        d.payAdj.map(function(p){
          return React.createElement('div',{key:p.id,style:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.5rem',padding:'0.2rem 0'}},
            React.createElement('span',{style:{fontSize:'0.7rem',color:C.navy}},p.date+' · '+p.from+' → '+p.to+' · ',React.createElement('span',{style:{fontFamily:MONO,fontWeight:700}},fmt(safeN(p.amount),c))),
            React.createElement('button',{onClick:function(){if(window.confirm('¿Eliminar este pago?')){deletePayment(p.id);}},style:{background:'none',border:'none',color:'#dc2626',cursor:'pointer',display:'flex',alignItems:'center',padding:'0.1rem'}},React.createElement(Trash2,{size:13,strokeWidth:2}))
          );
        })
      ):null
    );
  }

  return React.createElement(Card,{style:{padding:'1rem 1.1rem'}},
    // Top row: período + count + total
    React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.85rem',flexWrap:'wrap',gap:'0.4rem'}},
      periodSelector,
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'0.6rem',fontSize:'0.72rem',color:C.textMuted,fontWeight:600}},
        React.createElement('span',null,count+' gastos'),
        React.createElement('span',{style:{opacity:0.4}},'·'),
        React.createElement('span',null,'Total ',React.createElement('span',{style:{fontFamily:MONO,fontWeight:700,color:C.navy}},fmtS(pd.total,primary)))
      )
    ),
    // Hero balance (primary currency)
    React.createElement('div',{style:{marginBottom:'0.85rem'}},
      React.createElement('div',{style:{fontSize:'0.68rem',color:C.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}},'Balance'+(curs.length>1?' '+primary:'')),
      pd.noDebt
        ?React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'0.4rem',marginTop:'0.2rem'}},
            React.createElement('div',{style:{width:'26px',height:'26px',borderRadius:'50%',background:C.accent,display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement(Check,{size:16,strokeWidth:3,color:C.white})),
            React.createElement('span',{style:{fontSize:'1.3rem',fontWeight:800,color:C.navy}},'¡Al día!')
          )
        :React.createElement(React.Fragment,null,
            React.createElement('div',{style:{fontSize:'0.82rem',color:C.textMuted,marginTop:'0.1rem',fontWeight:500}},(pd.laliOwes?'Lali':'Javi')+' le debe a '+(pd.laliOwes?'Javi':'Lali')),
            React.createElement('div',{style:{fontSize:'2.1rem',fontWeight:800,color:C.navy,fontFamily:MONO,letterSpacing:'-0.02em',lineHeight:1.05,marginTop:'0.1rem'}},fmt(pd.netBal,primary))
          )
    ),
    // Action row: register + detail toggle
    !pd.noDebt?React.createElement('div',{style:{display:'flex',gap:'0.5rem',alignItems:'center'}},
      React.createElement('button',{
        onClick:function(){openPaymentModal(primary,pd.netBal,selPeriod==='Todos'?undefined:selPeriod);},
        style:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'0.4rem',background:C.accent,border:'none',borderRadius:'0.8rem',padding:'0.65rem',color:C.white,fontWeight:800,fontSize:'0.85rem',cursor:'pointer',fontFamily:F}
      },React.createElement(ArrowRightLeft,{size:16,strokeWidth:2.4}),'Registrar pago'),
      React.createElement('button',{
        onClick:function(){setExpanded(!expanded);},
        style:{display:'flex',alignItems:'center',gap:'0.25rem',background:'transparent',border:'1px solid '+C.border,borderRadius:'0.8rem',padding:'0.65rem 0.7rem',color:C.textMuted,fontWeight:600,fontSize:'0.75rem',cursor:'pointer',fontFamily:F}
      },'Detalle',React.createElement(ChevronDown,{size:14,strokeWidth:2.2,style:{transform:expanded?'rotate(180deg)':'none',transition:'transform 0.2s'}}))
    ):React.createElement('button',{
        onClick:function(){setExpanded(!expanded);},
        style:{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.25rem',background:'transparent',border:'1px solid '+C.border,borderRadius:'0.8rem',padding:'0.55rem',color:C.textMuted,fontWeight:600,fontSize:'0.75rem',cursor:'pointer',fontFamily:F}
      },'Ver detalle',React.createElement(ChevronDown,{size:14,strokeWidth:2.2,style:{transform:expanded?'rotate(180deg)':'none',transition:'transform 0.2s'}})),
    // Secondary currencies
    curs.length>1?React.createElement('div',{style:{marginTop:'0.6rem'}},curs.slice(1).map(secondaryRow)):null,
    // Expanded detail
    expanded?curs.map(detailPanel):null
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
export default function Dashboard(){
  var isDesktop = useIsDesktop();
  var expenses = useAppStore(function(s){ return s.expenses; });
  var settings = useAppStore(function(s){ return s.settings; });
  var plans    = useAppStore(function(s){ return s.plans; });
  var payments = useAppStore(function(s){ return s.payments; });
  var requestDelete = useAppStore(function(s){ return s.requestDelete; });
  var setEditingExpense = useAppStore(function(s){ return s.setEditingExpense; });

  var periods = settings.periods||[];
  var latestPeriod = periods.length?periods[periods.length-1].name:'';
  var selState = useState(latestPeriod); var selPeriod = selState[0]; var setSelPeriod = selState[1];

  useEffect(function(){ if(latestPeriod&&!selPeriod) setSelPeriod(latestPeriod); },[latestPeriod]);

  var periodExps = (selPeriod && selPeriod!=='Todos')
    ? expenses.filter(function(e){return e.period===selPeriod;})
    : expenses.filter(function(e){return e.period!==PENDING_PER;});
  var weekStart = getWeekStart();
  var weekExps = sortByDate(expenses.filter(function(e){ return e.date&&new Date(e.date+'T12:00:00')>=weekStart&&e.period!==PENDING_PER; }));

  // ── Sections defined once, reused in both layouts ────────────────────────────

  var headerBlock = React.createElement(UnifiedHeader,{
    periods:periods, selPeriod:selPeriod, setSelPeriod:setSelPeriod,
    periodExps:periodExps, payments:payments
  });

  var weekSection = React.createElement('div',null,
    React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}},
      React.createElement('h2',{style:{display:'flex',alignItems:'center',gap:'0.4rem',fontWeight:800,color:C.navy,fontSize:'0.88rem',margin:0}},
        React.createElement(Calendar,{size:16,strokeWidth:2.2,color:C.accent}),'Esta semana'),
      React.createElement('span',{style:{fontSize:'0.68rem',color:C.textMuted}},weekExps.length+' gastos')
    ),
    weekExps.length===0
      ?React.createElement(Card,{style:{padding:'1.5rem',textAlign:'center',color:C.textMuted,fontSize:'0.85rem'}},'No hay gastos esta semana')
      :React.createElement(Card,{style:{padding:0,overflow:'hidden'}},
          React.createElement('div',{style:{maxHeight: isDesktop ? 'calc(6 * 68px)' : 'calc(4 * 68px)',overflowY:'auto'}},
            React.createElement(ExpenseList,{expenses:weekExps,onDelete:function(id,e){requestDelete(id,e);},onEdit:function(e){setEditingExpense(e);}})
          ),
          weekExps.length>(isDesktop?6:4)?React.createElement('div',{style:{textAlign:'center',padding:'0.4rem',fontSize:'0.7rem',color:C.textMuted,borderTop:'1px solid '+C.border}},'↓ Deslizá para ver más'):null
        )
  );

  // ── DESKTOP layout ─────────────────────────────────────────────────────────
  if(isDesktop){
    return React.createElement('div',{style:{padding:'1.25rem',display:'flex',flexDirection:'column',gap:'1rem',maxWidth:'1100px'}},
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1.1fr 1.3fr',gap:'1rem',alignItems:'start'}},
        React.createElement('div',null, headerBlock),
        weekSection
      ),
      React.createElement('div',null,
        plans.length>0
          ?React.createElement(ActivePlans,null)
          :React.createElement(Card,{style:{padding:'1.5rem',textAlign:'center',color:C.textMuted,fontSize:'0.82rem',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem'}},
              React.createElement(CreditCard,{size:20,strokeWidth:2,color:C.textMuted}),
              React.createElement('span',{style:{fontWeight:700}},'Sin cuotas activas')
            )
      )
    );
  }

  // ── MOBILE — Esta semana ANTES de Cuotas activas ──────────────────────────
  return React.createElement('div',{style:{padding:'1rem',display:'flex',flexDirection:'column',gap:'0.85rem'}},
    headerBlock,
    weekSection,
    React.createElement(ActivePlans,null)
  );
}

