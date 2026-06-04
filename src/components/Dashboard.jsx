// ── components/Dashboard.jsx ──────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { C, F, DEFAULT_CATS, PENDING_PER } from '../constants';
import { fmt, fmtS, safeN, catEm, catLb, calcBal, calcNetBal, sortByDate, getWeekStart, normCat } from '../lib/helpers';
import useAppStore from '../store/useAppStore';
import { Card, ScrollFilter } from './ui.jsx';
import ExpenseList from './ExpenseList.jsx';

// ── BalanceSection ─────────────────────────────────────────────────────────────
function BalanceSection(){
  var expenses  = useAppStore(function(s){ return s.expenses; });
  var payments  = useAppStore(function(s){ return s.payments; });
  var settings  = useAppStore(function(s){ return s.settings; });
  var openPaymentModal = useAppStore(function(s){ return s.openPaymentModal; });

  var openState = useState(null); var openCur = openState[0]; var setOpenCur = openState[1];

  // Filter to selected period
  var selPeriodState = useState(''); var selPeriod = selPeriodState[0];
  // We get selPeriod from parent — pass via prop for simplicity here
  var periodExps = expenses; // will be filtered by parent

  var byCur = {};
  periodExps.forEach(function(e){ var c=e.currency||'ARS'; if(!byCur[c])byCur[c]=[]; byCur[c].push(e); });
  var curs = Object.keys(byCur);

  if(!curs.length){
    return React.createElement('div',{style:{borderRadius:'1.25rem',padding:'1rem 1.5rem',background:C.gradMain,color:C.white,boxShadow:'0 4px 16px rgba(0,0,0,0.2)'}},
      React.createElement('p',{style:{fontSize:'0.72rem',opacity:0.8,margin:'0 0 0.15rem'}},'Balance período'),
      React.createElement('div',{style:{fontSize:'1.3rem',fontWeight:800}},'¡Sin gastos aún!')
    );
  }

  return React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'0.5rem'}},
    curs.map(function(c){
      var netBal=calcNetBal(periodExps,payments,c);
      var noDebt=Math.abs(netBal)<1, laliOwes=netBal>0;
      var bg=noDebt?'linear-gradient(135deg,#2d9e7f,#1db88c)':C.gradMain;
      var isOpen=openCur===c;
      var curExps=periodExps.filter(function(e){return (e.currency||'ARS')===c;});
      var javiPaid=curExps.filter(function(e){return e.paidBy==='Javi';}).reduce(function(s,e){return s+safeN(e.amount);},0);
      var laliPaid=curExps.filter(function(e){return e.paidBy==='Lali';}).reduce(function(s,e){return s+safeN(e.amount);},0);
      var javiOwes=curExps.reduce(function(s,e){return s+safeN(e.javiAmount);},0);
      var laliOwes2=curExps.reduce(function(s,e){return s+safeN(e.laliAmount);},0);
      var payAdj=(payments||[]).filter(function(p){return (p.currency||'ARS')===c;});
      return React.createElement('div',{key:c},
        React.createElement('div',{onClick:function(){setOpenCur(isOpen?null:c);},style:{borderRadius:isOpen?'1.25rem 1.25rem 0 0':'1.25rem',padding:'1rem 1.5rem',background:bg,color:C.white,boxShadow:'0 4px 16px rgba(0,0,0,0.15)',cursor:'pointer',userSelect:'none'}},
          React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}},
            React.createElement('div',null,
              React.createElement('p',{style:{fontSize:'0.7rem',opacity:0.8,margin:'0 0 0.1rem'}},'Balance '+c+' — período seleccionado'),
              noDebt
                ?React.createElement('div',{style:{fontSize:'1.3rem',fontWeight:800}},'¡Al día! 🎉')
                :React.createElement(React.Fragment,null,
                    React.createElement('div',{style:{fontSize:'1.7rem',fontWeight:800}},fmt(netBal,c)),
                    React.createElement('div',{style:{fontSize:'0.82rem',opacity:0.9}},(laliOwes?'👩 Lali':'👨 Javi')+' le debe a '+(laliOwes?'👨 Javi':'👩 Lali'))
                  )
            ),
            React.createElement('div',{style:{fontSize:'0.72rem',opacity:0.7,marginTop:'0.25rem',flexShrink:0}},isOpen?'▲':'▼ ver')
          )
        ),
        isOpen?React.createElement('div',{style:{background:C.surface,borderRadius:'0 0 1.25rem 1.25rem',border:'1px solid '+C.border,borderTop:'none',padding:'0.85rem 1rem'}},
          React.createElement('div',{style:{fontSize:'0.7rem',color:C.textMuted,fontWeight:700,marginBottom:'0.6rem',textTransform:'uppercase',letterSpacing:'0.05em'}},'Cómo se calculó'),
          React.createElement('div',{style:{display:'flex',gap:'0.5rem',marginBottom:'0.5rem'}},
            React.createElement('div',{style:{flex:1,background:C.bg,borderRadius:'0.75rem',padding:'0.6rem',border:'1px solid '+C.border}},
              React.createElement('div',{style:{fontSize:'0.63rem',color:C.textMuted,marginBottom:'0.2rem'}},'👨 Javi pagó'),
              React.createElement('div',{style:{fontWeight:800,color:C.navy}},fmt(javiPaid,c))
            ),
            React.createElement('div',{style:{flex:1,background:C.bg,borderRadius:'0.75rem',padding:'0.6rem',border:'1px solid '+C.border}},
              React.createElement('div',{style:{fontSize:'0.63rem',color:C.textMuted,marginBottom:'0.2rem'}},'👩 Lali pagó'),
              React.createElement('div',{style:{fontWeight:800,color:C.accent}},fmt(laliPaid,c))
            )
          ),
          React.createElement('div',{style:{display:'flex',gap:'0.5rem',marginBottom:'0.5rem'}},
            React.createElement('div',{style:{flex:1,background:C.bg,borderRadius:'0.75rem',padding:'0.6rem',border:'1px solid '+C.border}},
              React.createElement('div',{style:{fontSize:'0.63rem',color:C.textMuted,marginBottom:'0.2rem'}},'Corresponde a Javi'),
              React.createElement('div',{style:{fontWeight:800,color:C.navy}},fmt(javiOwes,c))
            ),
            React.createElement('div',{style:{flex:1,background:C.bg,borderRadius:'0.75rem',padding:'0.6rem',border:'1px solid '+C.border}},
              React.createElement('div',{style:{fontSize:'0.63rem',color:C.textMuted,marginBottom:'0.2rem'}},'Corresponde a Lali'),
              React.createElement('div',{style:{fontWeight:800,color:C.accent}},fmt(laliOwes2,c))
            )
          ),
          payAdj.length>0?React.createElement('div',{style:{background:'#f0fdf4',borderRadius:'0.65rem',padding:'0.5rem 0.75rem',marginBottom:'0.5rem',border:'1px solid #bbf7d0'}},
            React.createElement('div',{style:{fontSize:'0.68rem',color:'#166534',fontWeight:700,marginBottom:'0.2rem'}},'Pagos registrados en '+c+':'),
            payAdj.map(function(p){return React.createElement('div',{key:p.id,style:{fontSize:'0.68rem',color:'#15803d'}},p.date+' — '+p.from+' pagó '+fmt(safeN(p.amount),c)+' a '+p.to);})
          ):null,
          React.createElement('div',{style:{borderTop:'1px dashed '+C.border,paddingTop:'0.5rem'}},
            noDebt
              ?React.createElement('div',{style:{fontSize:'0.8rem',color:'#2d9e7f',fontWeight:700,textAlign:'center'}},'✓ Todo está al día')
              :React.createElement('div',{style:{fontSize:'0.8rem',color:C.navy,fontWeight:700}},
                  (laliOwes?'Lali':'Javi')+' le debe ',
                  React.createElement('span',{style:{color:C.accent}},fmt(Math.abs(netBal),c)),
                  ' a '+(laliOwes?'Javi':'Lali')
                )
          )
        ):null,
        !noDebt?React.createElement('button',{onClick:function(){openPaymentModal(c,netBal);},style:{width:'100%',marginTop:'0.35rem',padding:'0.5rem',background:'transparent',border:'1px solid '+C.border,borderRadius:'0.75rem',color:C.navy,fontWeight:700,fontSize:'0.8rem',cursor:'pointer',fontFamily:F}},'💸 Registrar pago en '+c):null
      );
    })
  );
}

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
      React.createElement('h2',{style:{fontWeight:800,color:C.navy,fontSize:'0.88rem',margin:0}},'💳 Cuotas activas'),
      React.createElement('span',{style:{fontSize:'0.68rem',color:C.textMuted}},plans.length+' plan'+(plans.length!==1?'es':''))
    ),
    plans.length>=3?React.createElement('input',{value:search,onChange:function(e){setSearch(e.target.value);},placeholder:'🔍 Buscar cuota...',style:{width:'100%',border:'1px solid '+C.border,borderRadius:'0.75rem',padding:'0.5rem 0.75rem',fontSize:'0.82rem',outline:'none',fontFamily:F,color:C.navy,background:C.surface,boxSizing:'border-box',marginBottom:'0.6rem'}}):null,
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
    : expenses;
  var totByCur = {};
  periodExps.forEach(function(e){ var c=e.currency||'ARS'; totByCur[c]=(totByCur[c]||0)+safeN(e.amount); });
  var curEntries = Object.entries(totByCur);
  var weekStart = getWeekStart();
  var weekExps = sortByDate(expenses.filter(function(e){ return e.date&&new Date(e.date+'T12:00:00')>=weekStart&&e.period!==PENDING_PER; }));
  var filteredForBalance = periodExps;

  // ── Sections defined once, reused in both layouts ────────────────────────────

  var balanceSection = React.createElement(BalanceSectionFiltered,{periodExps:filteredForBalance,payments:payments,selPeriod:selPeriod});

  var periodCard = React.createElement(Card,{style:{padding:'0.75rem'}},
    React.createElement('div',{style:{fontSize:'0.65rem',color:C.textMuted,marginBottom:'0.3rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}},'Período'),
    periods.length>0
      ?React.createElement('select',{value:selPeriod,onChange:function(e){setSelPeriod(e.target.value);},style:{width:'100%',border:'none',fontSize:'0.78rem',fontWeight:800,color:C.navy,background:'transparent',outline:'none',cursor:'pointer',fontFamily:F,padding:0}},
          [React.createElement('option',{key:'Todos',value:'Todos'},'📊 Todos los períodos')]
            .concat(periods.slice().reverse().map(function(p){return React.createElement('option',{key:p.name,value:p.name},p.name);}))
        )
      :React.createElement('div',{style:{fontWeight:700,color:C.textMuted,fontSize:'0.78rem'}},'Sin períodos'),
    React.createElement('div',{style:{fontSize:'0.65rem',color:C.textMuted,marginTop:'0.2rem'}},periodExps.length+' gastos')
  );

  var totalCard = curEntries.length<=1
    ?React.createElement(Card,{style:{padding:'0.75rem'}},
        React.createElement('div',{style:{fontSize:'0.65rem',color:C.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}},'Total '+(curEntries[0]?curEntries[0][0]:'ARS')),
        React.createElement('div',{style:{fontWeight:800,color:C.navy,marginTop:'0.2rem',fontSize:'0.95rem'}},curEntries[0]?fmtS(curEntries[0][1],curEntries[0][0]):'—')
      )
    :React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.4rem'}},
        curEntries.map(function(entry){
          return React.createElement(Card,{key:entry[0],style:{padding:'0.5rem 0.6rem'}},
            React.createElement('div',{style:{fontSize:'0.6rem',color:C.textMuted,fontWeight:700}},entry[0]),
            React.createElement('div',{style:{fontWeight:800,color:C.navy,fontSize:'0.82rem'}},fmtS(entry[1],entry[0]))
          );
        })
      );

  var weekSection = React.createElement('div',null,
    React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}},
      React.createElement('h2',{style:{fontWeight:800,color:C.navy,fontSize:'0.88rem',margin:0}},'📅 Esta semana'),
      React.createElement('span',{style:{fontSize:'0.68rem',color:C.textMuted}},weekExps.length+' gastos')
    ),
    weekExps.length===0
      ?React.createElement(Card,{style:{padding:'1.5rem',textAlign:'center',color:C.textMuted,fontSize:'0.85rem'}},'No hay gastos esta semana')
      :React.createElement(Card,{style:{padding:0,overflow:'hidden'}},
          React.createElement('div',{style:{maxHeight: isDesktop ? 'calc(6 * 68px)' : 'calc(4 * 68px)',overflowY:'auto'}},
            React.createElement(ExpenseList,{expenses:weekExps,onDelete:function(id,e){requestDelete(id,e);},onEdit:function(e){setEditingExpense(e);}})
          ),
          weekExps.length>(isDesktop?6:4)?React.createElement('div',{style:{textAlign:'center',padding:'0.4rem',fontSize:'0.7rem',color:C.textMuted,borderTop:'1px solid '+C.border}},'↕ Deslizá para ver más'):null
        )
  );

  // ── DESKTOP layout ─────────────────────────────────────────────────────────
  if(isDesktop){
    return React.createElement('div',{style:{padding:'1.25rem',display:'flex',flexDirection:'column',gap:'1rem',maxWidth:'1100px'}},
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:'1rem',alignItems:'start'}},
        React.createElement('div',null, balanceSection),
        React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'0.75rem'}},
          periodCard,
          totalCard
        )
      ),
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1.6fr',gap:'1rem',alignItems:'start'}},
        React.createElement('div',null,
          plans.length>0
            ?React.createElement(ActivePlans,null)
            :React.createElement(Card,{style:{padding:'1.5rem',textAlign:'center',color:C.textMuted,fontSize:'0.82rem'}},
                React.createElement('div',{style:{fontSize:'1.8rem',marginBottom:'0.4rem'}},'💳'),
                React.createElement('div',{style:{fontWeight:700}},'Sin cuotas activas')
              )
        ),
        weekSection
      )
    );
  }

  // ── MOBILE — Esta semana ANTES de Cuotas activas ──────────────────────────
  return React.createElement('div',{style:{padding:'1rem',display:'flex',flexDirection:'column',gap:'0.75rem'}},
    balanceSection,
    React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.6rem'}},
      periodCard,
      totalCard
    ),
    weekSection,
    React.createElement(ActivePlans,null)
  );
}

// Wrapper that accepts filtered expenses as prop for balance calculation
function BalanceSectionFiltered(props){
  var openPaymentModal = useAppStore(function(s){ return s.openPaymentModal; });
  var deletePayment    = useAppStore(function(s){ return s.deletePayment; });
  var periodExps = props.periodExps||[];
  var allPayments  = props.payments||[];
  var selPeriod  = props.selPeriod||'Todos';
  var openState  = useState(null); var openCur = openState[0]; var setOpenCur = openState[1];

  // Filter payments: "Todos" → todos los pagos; período específico → solo los de ese período
  // Pagos sin campo `period` (legacy) se muestran en "Todos" pero no en períodos específicos
  var filteredPayments = selPeriod==='Todos'
    ? allPayments
    : allPayments.filter(function(p){ return p.period===selPeriod; });

  var byCur={};
  periodExps.forEach(function(e){var c=e.currency||'ARS';if(!byCur[c])byCur[c]=[];byCur[c].push(e);});
  var curs=Object.keys(byCur);
  if(!curs.length){
    return React.createElement('div',{style:{borderRadius:'1.25rem',padding:'1rem 1.5rem',background:C.gradMain,color:C.white,boxShadow:'0 4px 16px rgba(0,0,0,0.2)'}},
      React.createElement('p',{style:{fontSize:'0.72rem',opacity:0.8,margin:'0 0 0.15rem'}},'Balance '+(selPeriod==='Todos'?'acumulado':selPeriod)),
      React.createElement('div',{style:{fontSize:'1.3rem',fontWeight:800}},'¡Sin gastos aún!')
    );
  }
  return React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'0.5rem'}},
    curs.map(function(c){
      var netBal=calcNetBal(periodExps,filteredPayments,c);
      var noDebt=Math.abs(netBal)<1,laliOwes=netBal>0;
      var bg=noDebt?'linear-gradient(135deg,#2d9e7f,#1db88c)':C.gradMain;
      var isOpen=openCur===c;
      var curExps=periodExps.filter(function(e){return (e.currency||'ARS')===c;});
      var javiPaid=curExps.filter(function(e){return e.paidBy==='Javi';}).reduce(function(s,e){return s+safeN(e.amount);},0);
      var laliPaid=curExps.filter(function(e){return e.paidBy==='Lali';}).reduce(function(s,e){return s+safeN(e.amount);},0);
      var javiOwes=curExps.reduce(function(s,e){return s+safeN(e.javiAmount);},0);
      var laliOwes2=curExps.reduce(function(s,e){return s+safeN(e.laliAmount);},0);
      var payAdj=filteredPayments.filter(function(p){return (p.currency||'ARS')===c;});
      var balLabel = selPeriod==='Todos' ? 'Balance acumulado '+c : 'Balance '+c+' — '+selPeriod;
      return React.createElement('div',{key:c},
        // ── Header bubble ─────────────────────────────────────────────────────
        React.createElement('div',{
          style:{borderRadius:isOpen?'1.25rem 1.25rem 0 0':'1.25rem',padding:'1rem 1.5rem',background:bg,color:C.white,boxShadow:'0 4px 16px rgba(0,0,0,0.15)',cursor:'pointer',userSelect:'none'}
        },
          React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start'},onClick:function(){setOpenCur(isOpen?null:c);}},
            React.createElement('div',null,
              React.createElement('p',{style:{fontSize:'0.7rem',opacity:0.8,margin:'0 0 0.1rem'}},balLabel),
              noDebt
                ?React.createElement('div',{style:{fontSize:'1.3rem',fontWeight:800}},'¡Al día! 🎉')
                :React.createElement(React.Fragment,null,
                    React.createElement('div',{style:{fontSize:'1.7rem',fontWeight:800}},fmt(netBal,c)),
                    React.createElement('div',{style:{fontSize:'0.82rem',opacity:0.9}},(laliOwes?'👩 Lali':'👨 Javi')+' le debe a '+(laliOwes?'👨 Javi':'👩 Lali'))
                  )
            ),
            React.createElement('div',{style:{fontSize:'0.72rem',opacity:0.7,marginTop:'0.25rem',flexShrink:0}},isOpen?'▲':'▼ ver')
          ),
          // Botón registrar pago — solo si hay deuda
          !noDebt?React.createElement('button',{
            onClick:function(ev){ev.stopPropagation();openPaymentModal(c,netBal,selPeriod==='Todos'?undefined:selPeriod);},
            style:{width:'100%',marginTop:'0.75rem',padding:'0.5rem 0.75rem',background:'linear-gradient(135deg,rgba(255,255,255,0.22),rgba(220,220,220,0.18))',backdropFilter:'blur(4px)',border:'1px solid rgba(255,255,255,0.45)',borderRadius:'0.8rem',color:C.white,fontWeight:800,fontSize:'0.8rem',cursor:'pointer',fontFamily:F,display:'flex',alignItems:'center',justifyContent:'center',gap:'0.4rem',boxShadow:'0 2px 8px rgba(0,0,0,0.12)'}
          },'💸 Registrar pago en '+c):null
        ),
        // ── Panel expandido (breakdown) ───────────────────────────────────────
        isOpen?React.createElement('div',{style:{background:C.surface,borderRadius:'0 0 1.25rem 1.25rem',border:'1px solid '+C.border,borderTop:'none',padding:'0.85rem 1rem'}},
          React.createElement('div',{style:{fontSize:'0.7rem',color:C.textMuted,fontWeight:700,marginBottom:'0.6rem',textTransform:'uppercase',letterSpacing:'0.05em'}},'Cómo se calculó'),
          React.createElement('div',{style:{display:'flex',gap:'0.5rem',marginBottom:'0.5rem'}},
            React.createElement('div',{style:{flex:1,background:C.bg,borderRadius:'0.75rem',padding:'0.6rem',border:'1px solid '+C.border}},
              React.createElement('div',{style:{fontSize:'0.63rem',color:C.textMuted,marginBottom:'0.2rem'}},'👨 Javi pagó'),
              React.createElement('div',{style:{fontWeight:800,color:C.navy}},fmt(javiPaid,c))
            ),
            React.createElement('div',{style:{flex:1,background:C.bg,borderRadius:'0.75rem',padding:'0.6rem',border:'1px solid '+C.border}},
              React.createElement('div',{style:{fontSize:'0.63rem',color:C.textMuted,marginBottom:'0.2rem'}},'👩 Lali pagó'),
              React.createElement('div',{style:{fontWeight:800,color:C.accent}},fmt(laliPaid,c))
            )
          ),
          React.createElement('div',{style:{display:'flex',gap:'0.5rem',marginBottom:'0.5rem'}},
            React.createElement('div',{style:{flex:1,background:C.bg,borderRadius:'0.75rem',padding:'0.6rem',border:'1px solid '+C.border}},
              React.createElement('div',{style:{fontSize:'0.63rem',color:C.textMuted,marginBottom:'0.2rem'}},'Corresponde a Javi'),
              React.createElement('div',{style:{fontWeight:800,color:C.navy}},fmt(javiOwes,c))
            ),
            React.createElement('div',{style:{flex:1,background:C.bg,borderRadius:'0.75rem',padding:'0.6rem',border:'1px solid '+C.border}},
              React.createElement('div',{style:{fontSize:'0.63rem',color:C.textMuted,marginBottom:'0.2rem'}},'Corresponde a Lali'),
              React.createElement('div',{style:{fontWeight:800,color:C.accent}},fmt(laliOwes2,c))
            )
          ),
          // Lista de pagos con botón eliminar
          payAdj.length>0?React.createElement('div',{style:{background:'#f0fdf4',borderRadius:'0.65rem',padding:'0.5rem 0.75rem',marginBottom:'0.5rem',border:'1px solid #bbf7d0'}},
            React.createElement('div',{style:{fontSize:'0.68rem',color:'#166534',fontWeight:700,marginBottom:'0.35rem'}},'Pagos en '+c+(selPeriod!=='Todos'?' — '+selPeriod:'')+':'),
            payAdj.map(function(p){
              return React.createElement('div',{key:p.id,style:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.5rem',padding:'0.2rem 0',borderTop:'1px solid #d1fae5'}},
                React.createElement('span',{style:{fontSize:'0.68rem',color:'#15803d'}},
                  p.date+' — '+p.from+' pagó '+fmt(safeN(p.amount),c)+' a '+p.to+(p.period&&selPeriod==='Todos'?' ('+p.period+')':'')
                ),
                React.createElement('button',{
                  onClick:function(){if(window.confirm('¿Eliminar este pago?')){deletePayment(p.id);}},
                  style:{background:'none',border:'none',color:'#c0314f',cursor:'pointer',fontSize:'0.75rem',fontWeight:700,fontFamily:F,flexShrink:0,padding:'0.1rem 0.3rem'}
                },'✕')
              );
            })
          ):null,
          React.createElement('div',{style:{borderTop:'1px dashed '+C.border,paddingTop:'0.5rem'}},
            noDebt
              ?React.createElement('div',{style:{fontSize:'0.8rem',color:'#2d9e7f',fontWeight:700,textAlign:'center'}},'✓ Todo está al día')
              :React.createElement('div',{style:{fontSize:'0.8rem',color:C.navy,fontWeight:700}},
                  (laliOwes?'Lali':'Javi')+' le debe ',
                  React.createElement('span',{style:{color:C.accent}},fmt(Math.abs(netBal),c)),
                  ' a '+(laliOwes?'Javi':'Lali')
                )
          )
        ):null
      );
    })
  );
}
