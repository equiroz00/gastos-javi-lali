// ── components/History.jsx ────────────────────────────────────────────────────
import React, { useState } from 'react';
import { C, F, PENDING_PER } from '../constants';
import { fmt, safeN, calcBal, sortByDate } from '../lib/helpers';
import useAppStore from '../store/useAppStore';
import { Card, ScrollFilter } from './ui.jsx';
import ExpenseList from './ExpenseList.jsx';

function PeriodBlock(props){
  var period=props.period,exps=props.exps,isOpen=props.isOpen,isPending=props.isPending,isSelected=props.isSelected,hasSelection=props.hasSelection;
  var total=exps.reduce(function(s,e){return s+safeN(e.amount);},0);
  var bal=calcBal(exps.filter(function(e){return (e.currency||'ARS')==='ARS';}));
  var highlighted=isOpen||isSelected;
  var headerBg=isPending?'#fef3c7':(isSelected?C.accent:(isOpen?C.navy:C.surface));
  var textColor=isPending?'#92400e':(highlighted?C.white:C.navy);
  var subColor=isPending?'#b45309':(highlighted?'rgba(255,255,255,0.7)':C.textMuted);
  return React.createElement('div',null,
    React.createElement('div',{onClick:props.onToggle,style:{display:'flex',justifyContent:'space-between',alignItems:'center',background:headerBg,borderRadius:isOpen?'1rem 1rem 0 0':'1rem',padding:'0.85rem 1rem',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',cursor:'pointer',border:'1px solid '+(isPending?'#f59e0b':(isSelected?C.accent:(isOpen?C.navy:C.border)))}},
      React.createElement('div',null,
        React.createElement('div',{style:{fontWeight:800,color:textColor,fontSize:'0.9rem'}},period),
        React.createElement('div',{style:{fontSize:'0.7rem',color:subColor,marginTop:'0.1rem'}},exps.length+' gastos · '+fmt(total))
      ),
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'0.75rem'}},
        !isPending&&(Math.abs(bal)>=1?React.createElement('div',{style:{textAlign:'right'}},React.createElement('div',{style:{fontSize:'0.7rem',fontWeight:800,color:highlighted?'rgba(255,255,255,0.9)':C.accent}},bal>0?'Lali debe':'Javi debe'),React.createElement('div',{style:{fontSize:'0.7rem',fontWeight:800,color:highlighted?'rgba(255,255,255,0.9)':C.accent}},fmt(Math.abs(bal)))):React.createElement('div',{style:{fontSize:'0.7rem',color:highlighted?'rgba(255,255,255,0.8)':'#2d9e7f',fontWeight:700}},'✓ Al día')),
        React.createElement('span',{style:{color:isPending?'#92400e':(highlighted?'rgba(255,255,255,0.8)':C.textMuted),fontSize:'0.85rem'}},hasSelection?(isSelected?'☑':'☐'):(isOpen?'▲':'▼'))
      )
    ),
    highlighted?React.createElement('div',{style:{background:C.surface,borderRadius:'0 0 1rem 1rem',boxShadow:'0 2px 8px rgba(0,0,0,0.08)',overflow:'hidden',border:'1px solid '+C.border,borderTop:'none'}},
      React.createElement(ExpenseList,{expenses:exps,onDelete:props.onDelete,onEdit:props.onEdit})
    ):null
  );
}

export default function History(){
  var expenses = useAppStore(function(s){ return s.expenses; });
  var settings = useAppStore(function(s){ return s.settings; });
  var requestDelete = useAppStore(function(s){ return s.requestDelete; });
  var setEditingExpense = useAppStore(function(s){ return s.setEditingExpense; });

  var searchState=useState('');var search=searchState[0];var setSearch=searchState[1];
  var selState=useState([]);var selectedPeriods=selState[0];var setSelectedPeriods=selState[1];
  var openState=useState({});var openMap=openState[0];var setOpenMap=openState[1];

  var grouped={};
  expenses.forEach(function(e){var p=e.period||'Sin período';if(!grouped[p])grouped[p]=[];grouped[p].push(e);});
  var configOrder=(settings.periods||[]).map(function(p){return p.name;}).slice().reverse();
  var others=Object.keys(grouped).filter(function(p){return configOrder.indexOf(p)<0&&p!==PENDING_PER;});
  var allSorted=configOrder.filter(function(p){return grouped[p];}).concat(others).concat(grouped[PENDING_PER]?[PENDING_PER]:[]);
  var searchLower=search.toLowerCase().trim();

  var expenseMatches=[];
  if(searchLower){
    expenses.forEach(function(e){
      var descMatch=(e.description||'').toLowerCase().indexOf(searchLower)>=0;
      var dateMatch=(e.date||'').indexOf(searchLower)>=0;
      var amtMatch=String(Math.round(safeN(e.amount))).indexOf(searchLower)>=0;
      if(descMatch||dateMatch||amtMatch)expenseMatches.push(e);
    });
  }

  var filteredPeriods=searchLower?allSorted.filter(function(p){return p.toLowerCase().indexOf(searchLower)>=0;}):allSorted;
  var hasSelection=selectedPeriods.length>0;
  var displayPeriods=hasSelection?filteredPeriods.filter(function(p){return selectedPeriods.indexOf(p)>=0;}):filteredPeriods;
  function toggleSelect(p){setSelectedPeriods(function(prev){return prev.indexOf(p)>=0?prev.filter(function(x){return x!==p;}):[].concat(prev,[p]);});}
  function toggleOpen(p){setOpenMap(function(prev){var next=Object.assign({},prev);next[p]=!next[p];return next;});}
  var showExpMatches=searchLower&&expenseMatches.length>0;

  return React.createElement('div',{style:{padding:'1rem',paddingBottom:'2rem'}},
    React.createElement('h2',{style:{fontWeight:900,fontSize:'1.2rem',color:C.navy,marginBottom:'0.75rem'}},'Historial'),
    React.createElement('input',{value:search,onChange:function(e){setSearch(e.target.value);setSelectedPeriods([]);},placeholder:'🔍 Buscar período, gasto, fecha o monto...',style:{width:'100%',border:'1px solid '+C.border,borderRadius:'0.75rem',padding:'0.5rem 0.75rem',fontSize:'0.82rem',outline:'none',fontFamily:F,color:C.navy,background:C.surface,boxSizing:'border-box',marginBottom:'0.6rem'}}),
    showExpMatches?React.createElement('div',{style:{marginBottom:'0.75rem'}},
      React.createElement('div',{style:{fontWeight:700,fontSize:'0.75rem',color:C.textMuted,marginBottom:'0.35rem'}},expenseMatches.length+' gasto'+(expenseMatches.length!==1?'s':'')+' encontrado'+(expenseMatches.length!==1?'s':'')),
      React.createElement(Card,{style:{padding:0,overflow:'hidden'}},
        React.createElement('div',{style:{maxHeight:'320px',overflowY:'auto'}},
          React.createElement(ExpenseList,{expenses:sortByDate(expenseMatches),onDelete:requestDelete,onEdit:setEditingExpense})
        )
      )
    ):null,
    allSorted.length>3?React.createElement('div',{style:{marginBottom:'0.6rem'}},
      React.createElement('div',{style:{fontSize:'0.7rem',color:C.textMuted,marginBottom:'0.3rem',fontWeight:700}},hasSelection?(selectedPeriods.length+' período(s) seleccionado(s)'):'Períodos'+(searchLower?' (filtrados por nombre)':'')),
      React.createElement(ScrollFilter,{items:filteredPeriods,selected:selectedPeriods,onSelect:toggleSelect,multi:true}),
      hasSelection?React.createElement('button',{onClick:function(){setSelectedPeriods([]);},style:{background:'transparent',border:'1px solid '+C.accent,borderRadius:'999px',padding:'0.2rem 0.65rem',fontSize:'0.7rem',color:C.accent,cursor:'pointer',fontFamily:F,fontWeight:700,marginTop:'0.3rem'}},'✕ Limpiar selección'):null
    ):null,
    filteredPeriods.length===0&&!showExpMatches
      ?React.createElement(Card,{style:{textAlign:'center',padding:'3rem',color:C.textMuted}},React.createElement('div',{style:{fontSize:'2.5rem',marginBottom:'0.5rem'}},'🔍'),'No se encontraron resultados')
      :filteredPeriods.length>0?React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'0.75rem',maxHeight:allSorted.length>3?'65vh':undefined,overflowY:allSorted.length>3?'auto':undefined}},
          displayPeriods.map(function(period){
            return React.createElement(PeriodBlock,{key:period,period:period,exps:sortByDate(grouped[period]||[]),isOpen:!!openMap[period],isSelected:selectedPeriods.indexOf(period)>=0,isPending:period===PENDING_PER,hasSelection:hasSelection,onToggle:function(){if(hasSelection)toggleSelect(period);else toggleOpen(period);},onDelete:requestDelete,onEdit:setEditingExpense});
          })
        ):null
  );
}
