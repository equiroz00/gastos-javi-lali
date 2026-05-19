// ── components/ExpenseList.jsx ────────────────────────────────────────────────
import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { C, F, PENDING_PER } from '../constants.js';
import { fmt, safeN, catEm, catLb } from '../lib/helpers.js';

function ExpenseRow(props){
  var e=props.expense,cur=e.currency||'ARS';
  var open=props.open||false;
  return React.createElement('div',{style:{borderBottom:'1px solid '+C.beige}},
    React.createElement('div',{onClick:props.onToggle,style:{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.65rem 1rem',cursor:'pointer',background:open?C.bg:C.surface}},
      React.createElement('div',{style:{fontSize:'1.3rem',flexShrink:0,width:'1.8rem',textAlign:'center'}},catEm(e.category)),
      React.createElement('div',{style:{flex:1,minWidth:0}},
        React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'0.3rem',flexWrap:'wrap'}},
          React.createElement('span',{style:{fontWeight:700,color:C.navy,fontSize:'0.88rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'140px'}},e.description||'Sin descripción'),
          cur!=='ARS'?React.createElement('span',{style:{fontSize:'0.58rem',background:C.navy,color:C.white,borderRadius:'999px',padding:'0.1rem 0.3rem',fontWeight:800,flexShrink:0}},cur):null,
          e.fromPlan?React.createElement('span',{style:{fontSize:'0.58rem',background:C.accent,color:C.white,borderRadius:'999px',padding:'0.1rem 0.3rem',fontWeight:800,flexShrink:0}},'📅 '+e.installmentNum+'/'+e.numInstallments):null,
          e.period===PENDING_PER?React.createElement('span',{style:{fontSize:'0.58rem',background:'#f59e0b',color:C.white,borderRadius:'999px',padding:'0.1rem 0.3rem',fontWeight:800,flexShrink:0}},'⏳'):null
        ),
        React.createElement('div',{style:{fontSize:'0.68rem',color:C.textMuted,marginTop:'0.05rem'}},
          e.date+' · '+catLb(e.category)+' · ',
          React.createElement('span',{style:{color:e.paidBy==='Javi'?C.navy:C.accent,fontWeight:700}},e.paidBy)
        )
      ),
      React.createElement('div',{style:{textAlign:'right',flexShrink:0}},
        React.createElement('div',{style:{fontWeight:800,color:C.navy,fontSize:'0.9rem'}},fmt(safeN(e.amount),cur)),
        React.createElement('div',{style:{fontSize:'0.62rem',color:C.textMuted}},'J:'+fmt(safeN(e.javiAmount),cur)+' / L:'+fmt(safeN(e.laliAmount),cur))
      )
    ),
    open&&!e.fromPlan?React.createElement('div',{style:{display:'flex',gap:'0.5rem',padding:'0.45rem 1rem',background:C.bg,borderTop:'1px solid '+C.border}},
      React.createElement('button',{onClick:function(){props.onEdit(e);},style:{flex:1,padding:'0.4rem',background:C.beige,border:'none',borderRadius:'0.6rem',color:C.navy,fontWeight:700,fontSize:'0.75rem',cursor:'pointer',fontFamily:F,display:'flex',alignItems:'center',justifyContent:'center',gap:'0.35rem'}},
        React.createElement(Pencil,{size:13,strokeWidth:2}),'Editar'),
      React.createElement('button',{onClick:function(){props.onDelete(e.id,e);},style:{flex:1,padding:'0.4rem',background:'#fde8ee',border:'none',borderRadius:'0.6rem',color:'#c0314f',fontWeight:700,fontSize:'0.75rem',cursor:'pointer',fontFamily:F,display:'flex',alignItems:'center',justifyContent:'center',gap:'0.35rem'}},
        React.createElement(Trash2,{size:13,strokeWidth:2}),'Eliminar')
    ):null
  );
}

export default function ExpenseList(props){
  var expenses=props.expenses||[];
  var openState=useState(null);var openId=openState[0];var setOpenId=openState[1];
  return React.createElement(React.Fragment,null,
    expenses.map(function(e){
      return React.createElement(ExpenseRow,{key:e.id,expense:e,onDelete:props.onDelete,onEdit:props.onEdit,open:openId===e.id,onToggle:function(){setOpenId(openId===e.id?null:e.id);}});
    })
  );
}
