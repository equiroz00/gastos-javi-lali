// ── components/ui.jsx ─────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  Home, ShoppingCart, KeyRound, Lightbulb, Bus, Clapperboard, Users, Sparkles,
  Dumbbell, Pill, Baby, Shirt, UtensilsCrossed, Plane, PawPrint, Gift, GraduationCap,
  Wallet, Tag, Search, Trash2, X, ArrowRightLeft
} from 'lucide-react';
import { C, F, CHART_TYPES } from '../constants';
import { fmt, safeN, catLb } from '../lib/helpers';
import useAppStore from '../store/useAppStore';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

// ── Category → Lucide icon mapping (keyword based, with fallback) ─────────────
var CAT_ICON_MAP = [
  [/hogar|casa|limpieza/i, Home],
  [/aliment|comida|super|mercado|verdul|carnic|almac[eé]n/i, ShoppingCart],
  [/restaur|comer|caf[eé]|salida.?gastron/i, UtensilsCrossed],
  [/arriend|alquil|renta|expensa/i, KeyRound],
  [/servici|luz|agua|gas|electri|internet|cable|tel[eé]fono|wifi/i, Lightbulb],
  [/transp|nafta|combust|colectivo|sube|taxi|uber|peaje|estacion|auto/i, Bus],
  [/entreten|cine|pel[ií]cul|juego|stream|netflix|spotify|m[uú]sica/i, Clapperboard],
  [/amig|social|fiesta|reuni/i, Users],
  [/cuidado|personal|belleza|peluqu|spa|cosm/i, Sparkles],
  [/gimnas|gym|deporte|fitness|entrenam/i, Dumbbell],
  [/farmac|salud|m[eé]dic|medicin|remedio|hospital|obra.?social/i, Pill],
  [/hijit|hij[oa]|beb[eé]|ni[ñn]|guarder|jard[ií]n/i, Baby],
  [/ropa|vestir|calzado|zapat|indument/i, Shirt],
  [/viaj|vacacion|vuelo|hotel/i, Plane],
  [/mascot|perro|gato|veterin/i, PawPrint],
  [/regalo|gift|cumple/i, Gift],
  [/educ|curso|colegio|universidad|estudi|libro/i, GraduationCap],
  [/ahorro|inversi|cuenta/i, Wallet],
];

export function catIconFor(category){
  var label = (catLb(category) || '') + ' ' + (category || '');
  for (var i=0;i<CAT_ICON_MAP.length;i++){ if(CAT_ICON_MAP[i][0].test(label)) return CAT_ICON_MAP[i][1]; }
  return Tag;
}

export function CatIcon(props){
  var Icon = catIconFor(props.category);
  return React.createElement(Icon,{size:props.size||18,strokeWidth:props.strokeWidth||2,color:props.color||C.navy,style:props.style});
}

// ── Javi / Lali marker — colored dot (navy = Javi, accent = Lali) ─────────────
export function UserDot(props){
  var isJavi = props.user==='Javi';
  return React.createElement('span',{style:Object.assign({display:'inline-block',width:'7px',height:'7px',borderRadius:'50%',background:isJavi?C.navy:C.accent,flexShrink:0},props.style||{})});
}

export function Card(props){
  var style=Object.assign({background:C.surface,borderRadius:'1.1rem',padding:'1rem',boxShadow:'0 2px 8px rgba(0,0,0,0.1)',border:'1px solid '+C.border},props.style||{});
  return React.createElement('div',{style:style},props.children);
}

export function SearchBox(props){
  return React.createElement('input',{value:props.value,onChange:function(e){props.onChange(e.target.value);},placeholder:props.placeholder||'Buscar...',style:{width:'100%',border:'1px solid '+C.border,borderRadius:'0.75rem',padding:'0.5rem 0.75rem',fontSize:'0.82rem',outline:'none',fontFamily:F,color:C.navy,background:C.surface,boxSizing:'border-box',marginBottom:'0.6rem'}});
}

export function ScrollFilter(props){
  var items=props.items||[],selected=props.selected,multi=props.multi||false;
  return React.createElement('div',{style:{overflowX:'auto',paddingBottom:'6px',marginBottom:'0.6rem'}},
    React.createElement('div',{style:{display:'flex',gap:'0.4rem',width:'max-content'}},
      items.map(function(p){
        var isActive=multi?(selected.indexOf(p)>=0):(selected===p);
        return React.createElement('button',{key:p,onClick:function(){props.onSelect(p);},style:{flexShrink:0,padding:'0.35rem 0.75rem',borderRadius:'999px',border:'1px solid',fontSize:'0.75rem',cursor:'pointer',fontWeight:isActive?800:500,fontFamily:F,background:isActive?C.navy:'transparent',borderColor:isActive?C.navy:C.border,color:isActive?C.white:C.navy,whiteSpace:'nowrap'}},
          multi?(isActive?'✓ ':'')+p:p);
      })
    )
  );
}

export function SegBtn(props){
  var color=props.color||C.navy;
  return React.createElement('button',{onClick:props.onClick,style:{flex:1,padding:'0.45rem 0.2rem',fontSize:'0.72rem',borderRadius:'0.75rem',border:'1px solid',cursor:'pointer',fontFamily:F,fontWeight:props.active?800:500,lineHeight:1.3,background:props.active?color:'transparent',borderColor:props.active?color:C.border,color:props.active?C.white:C.navy}},props.children);
}

export function ChartSelector(props){
  return React.createElement('div',{style:{display:'flex',gap:'0.3rem',marginBottom:'0.75rem',flexWrap:'wrap'}},
    CHART_TYPES.map(function(t){
      var active=props.value===t;
      return React.createElement('button',{key:t,onClick:function(){props.onChange(t);},style:{padding:'0.25rem 0.65rem',fontSize:'0.7rem',borderRadius:'999px',border:'1px solid',cursor:'pointer',fontFamily:F,fontWeight:active?800:500,background:active?C.navy:'transparent',borderColor:active?C.navy:C.border,color:active?C.white:C.navy}},t);
    })
  );
}

export function Toast(){
  var toast=useAppStore(function(s){ return s.toast; });
  if(!toast) return null;
  return React.createElement('div',{style:{position:'fixed',bottom:'5.5rem',left:'50%',transform:'translateX(-50%)',zIndex:200,maxWidth:'340px',width:'calc(100% - 2rem)',pointerEvents:'none'}},
    React.createElement('div',{style:{background:C.navy,color:C.white,borderRadius:'1rem',padding:'0.75rem 1rem',display:'flex',alignItems:'center',gap:'0.75rem',boxShadow:'0 8px 24px rgba(0,0,0,0.3)',fontFamily:F}},
      React.createElement('div',{style:{width:'34px',height:'34px',borderRadius:'10px',background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}},React.createElement(CatIcon,{category:toast.category,size:18,color:C.white})),
      React.createElement('div',{style:{flex:1,minWidth:0}},
        React.createElement('div',{style:{fontWeight:700,fontSize:'0.85rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},toast.description),
        React.createElement('div',{style:{fontSize:'0.75rem',opacity:0.75,marginTop:'0.1rem'}},toast.amount+' · guardado')
      )
    )
  );
}

export function ConfirmDialog(){
  var pendingDelete=useAppStore(function(s){ return s.pendingDelete; });
  var setPendingDelete=useAppStore(function(s){ return s.setPendingDelete; });
  var confirmDelete=useAppStore(function(s){ return s.confirmDelete; });
  if(!pendingDelete) return null;
  var e=pendingDelete.expense;
  return React.createElement('div',{style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'1.5rem'}},
    React.createElement('div',{style:{background:C.surface,borderRadius:'1.25rem',padding:'1.5rem',maxWidth:'340px',width:'100%',boxShadow:'0 8px 32px rgba(0,0,0,0.25)',fontFamily:F}},
      React.createElement('div',{style:{display:'flex',justifyContent:'center',marginBottom:'0.75rem'}},React.createElement('div',{style:{width:'44px',height:'44px',borderRadius:'12px',background:'#fde8ec',display:'flex',alignItems:'center',justifyContent:'center'}},React.createElement(Trash2,{size:22,strokeWidth:2,color:'#c0314f'}))),
      React.createElement('h3',{style:{fontWeight:900,color:C.navy,fontSize:'1rem',margin:'0 0 0.5rem',textAlign:'center'}},'¿Eliminar este gasto?'),
      React.createElement('div',{style:{background:C.bg,borderRadius:'0.75rem',padding:'0.75rem',marginBottom:'1rem',border:'1px solid '+C.border}},
        React.createElement('div',{style:{fontWeight:700,color:C.navy,fontSize:'0.88rem',marginBottom:'0.25rem'}},e.description||'Sin descripción'),
        React.createElement('div',{style:{fontSize:'0.8rem',color:C.textMuted}},e.date+' · '+fmt(safeN(e.amount),e.currency||'ARS')),
        React.createElement('div',{style:{fontSize:'0.8rem',color:C.textMuted}},catLb(e.category))
      ),
      React.createElement('p',{style:{fontSize:'0.75rem',color:C.textMuted,textAlign:'center',margin:'0 0 1rem'}},'Esta acción no se puede deshacer.'),
      React.createElement('div',{style:{display:'flex',gap:'0.5rem'}},
        React.createElement('button',{onClick:function(){setPendingDelete(null);},style:{flex:1,padding:'0.75rem',background:'transparent',border:'1px solid '+C.border,borderRadius:'0.75rem',color:C.navy,fontWeight:700,fontSize:'0.88rem',cursor:'pointer',fontFamily:F}},'Cancelar'),
        React.createElement('button',{onClick:confirmDelete,style:{flex:1,padding:'0.75rem',background:'#c0314f',border:'none',borderRadius:'0.75rem',color:C.white,fontWeight:700,fontSize:'0.88rem',cursor:'pointer',fontFamily:F}},'Sí, eliminar')
      )
    )
  );
}

export function PaymentModal(){
  var payModal=useAppStore(function(s){ return s.payModal; });
  var setPayModal=useAppStore(function(s){ return s.setPayModal; });
  var confirmPayment=useAppStore(function(s){ return s.confirmPayment; });
  // Hooks must always be called unconditionally — before any early return
  var currency=(payModal&&payModal.currency)||'ARS';
  var netBal=(payModal&&payModal.netBal)||0;
  var absAmt=Math.abs(netBal);
  var debtor=netBal>0?'Lali':'Javi';
  var creditor=netBal>0?'Javi':'Lali';
  var amtState=useState('');var amt=amtState[0];var setAmt=amtState[1];
  var dateState=useState(new Date().toISOString().split('T')[0]);var date=dateState[0];var setDate=dateState[1];
  var errState=useState('');var err=errState[0];var setErr=errState[1];
  // Sync amount when modal opens/changes
  React.useEffect(function(){
    if(payModal){
      setAmt(absAmt>0?String(Math.round(absAmt)):'');
      setErr('');
    }
  },[payModal]);
  if(!payModal) return null;
  function submit(){
    if(!amt||parseFloat(amt)<=0){setErr('Ingresá un monto válido.');return;}
    confirmPayment({id:'pay_'+Date.now(),date:date,amount:parseFloat(amt),currency:currency,from:debtor,to:creditor,period:payModal.period||undefined,registeredAt:new Date().toISOString()});
  }
  var inp={width:'100%',border:'1px solid '+C.border,borderRadius:'0.75rem',padding:'0.75rem',fontSize:'0.9rem',outline:'none',boxSizing:'border-box',fontFamily:F,color:C.navy,background:C.surface};
  return React.createElement('div',{style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'1.5rem'}},
    React.createElement('div',{style:{background:C.surface,borderRadius:'1.25rem',padding:'1.5rem',maxWidth:'340px',width:'100%',boxShadow:'0 8px 32px rgba(0,0,0,0.25)',fontFamily:F}},
      React.createElement('h3',{style:{display:'flex',alignItems:'center',gap:'0.4rem',fontWeight:900,color:C.navy,fontSize:'1rem',margin:'0 0 0.25rem'}},React.createElement(ArrowRightLeft,{size:17,strokeWidth:2.3,color:C.accent}),'Registrar pago'),
      React.createElement('p',{style:{fontSize:'0.8rem',color:C.textMuted,margin:'0 0 1rem'}},
        React.createElement('span',{style:{fontWeight:800,color:netBal>0?C.accent:C.navy}},debtor),' le paga a ',
        React.createElement('span',{style:{fontWeight:800,color:netBal>0?C.navy:C.accent}},creditor)
      ),
      React.createElement('label',{style:{fontSize:'0.8rem',color:C.textMuted,fontWeight:700,display:'block',marginBottom:'0.3rem'}},'Monto ('+currency+')'),
      React.createElement('input',{style:Object.assign({},inp,{borderColor:err?'#c0314f':C.border,marginBottom:'0.1rem'}),type:'number',value:amt,onChange:function(e){setAmt(e.target.value);setErr('');},placeholder:'0'}),
      err?React.createElement('p',{style:{color:'#c0314f',fontSize:'0.7rem',margin:'0.1rem 0 0.5rem'}},'⚠ '+err):React.createElement('div',{style:{height:'0.65rem'}}),
      React.createElement('label',{style:{fontSize:'0.8rem',color:C.textMuted,fontWeight:700,display:'block',marginBottom:'0.3rem',marginTop:'0.5rem'}},'Fecha'),
      React.createElement('input',{style:Object.assign({},inp,{marginBottom:'1rem'}),type:'date',value:date,onChange:function(e){setDate(e.target.value);}}),
      React.createElement('div',{style:{display:'flex',gap:'0.5rem'}},
        React.createElement('button',{onClick:function(){setPayModal(null);},style:{flex:1,padding:'0.75rem',background:'transparent',border:'1px solid '+C.border,borderRadius:'0.75rem',color:C.navy,fontWeight:700,fontSize:'0.88rem',cursor:'pointer',fontFamily:F}},'Cancelar'),
        React.createElement('button',{onClick:submit,style:{flex:1,padding:'0.75rem',background:C.gradMain,border:'none',borderRadius:'0.75rem',color:C.white,fontWeight:700,fontSize:'0.88rem',cursor:'pointer',fontFamily:F}},'Registrar')
      )
    )
  );
}
