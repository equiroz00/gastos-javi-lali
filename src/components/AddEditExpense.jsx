// ── components/AddEditExpense.jsx ─────────────────────────────────────────────
import React, { useState } from 'react';
import { C, F, DEFAULT_CATS, PAY_METHODS, BANKS, BASE_CURS, CUOTA_OPTS } from '../constants';
import { todayStr, fmt, safeN, calcAmts, getPeriod, sanitize, catEm } from '../lib/helpers';
import useAppStore from '../store/useAppStore';
import { SegBtn } from './ui.jsx';
import SplitModal from './SplitModal.jsx';

export default function AddEditExpense(props){
  var isEditMode  = props.isEditMode||false;
  var initialData = props.initialData||null;

  var currentUser      = useAppStore(function(s){ return s.currentUser; });
  var settings         = useAppStore(function(s){ return s.settings; });
  var customCats       = useAppStore(function(s){ return s.customCats; });
  var saveCustomCats   = useAppStore(function(s){ return s.saveCustomCats; });
  var handleAdd        = useAppStore(function(s){ return s.handleAdd; });
  var handleAddMultiple= useAppStore(function(s){ return s.handleAddMultiple; });
  var handleEdit       = useAppStore(function(s){ return s.handleEdit; });
  var handleAddPlan    = useAppStore(function(s){ return s.handleAddPlan; });
  var setView          = useAppStore(function(s){ return s.setView; });
  var setEditingExpense= useAppStore(function(s){ return s.setEditingExpense; });

  var allCats = DEFAULT_CATS.concat(customCats);

  function blankForm(){
    return {date:todayStr(),description:'',amount:'',category:allCats[0]||DEFAULT_CATS[0],paymentMethod:PAY_METHODS[0],bank:BANKS[0],paidBy:currentUser,responsible:'Ambos',currency:'ARS',customCurrency:'',javiAmount:0,laliAmount:0};
  }

  var initForm = initialData||blankForm();
  var formState=useState(initForm);var form=formState[0];var setForm=formState[1];
  var errState=useState({});var errors=errState[0];var setErrors=errState[1];
  var stepState=useState(isEditMode?2:1);var step=stepState[0];var setStep=stepState[1];
  var splitModalState=useState(false);var showSplitModal=splitModalState[0];var setShowSplitModal=splitModalState[1];
  var newCatState=useState(false);var showNewCat=newCatState[0];var setShowNewCat=newCatState[1];
  var emojiState=useState('');var newCatEmoji=emojiState[0];var setNewCatEmoji=emojiState[1];
  var nameState=useState('');var newCatName=nameState[0];var setNewCatName=nameState[1];
  var cuotaState=useState(false);var useCuotas=cuotaState[0];var setUseCuotas=cuotaState[1];
  var numState=useState(12);var numCuotas=numState[0];var setNumCuotas=numState[1];
  var custNumState=useState('');var customCuotas=custNumState[0];var setCustomCuotas=custNumState[1];
  var retroState=useState(false);var isRetro=retroState[0];var setIsRetro=retroState[1];
  var paidState=useState('');var retroPaid=paidState[0];var setRetroPaid=paidState[1];
  var retroPerState=useState('');var retroStartPer=retroPerState[0];var setRetroStartPer=retroPerState[1];
  var queueState=useState([]);var queue=queueState[0];var setQueue=queueState[1];

  function set(k,v){setForm(function(f){var next=Object.assign({},f);next[k]=v;return next;});}

  var periods      = settings.periods||[];
  var finalCuotas  = customCuotas?parseInt(customCuotas)||numCuotas:numCuotas;
  var paidNum      = isRetro?(parseInt(retroPaid)||0):0;
  var remaining    = finalCuotas-paidNum;
  var cur          = BASE_CURS.indexOf(form.currency)>=0?form.currency:(form.customCurrency||'ARS');
  var totalAmt     = parseFloat(form.amount)||0;
  var showSplit    = totalAmt>0;
  var installmentAmt = showSplit&&useCuotas?Math.round(totalAmt/finalCuotas):0;
  var btnLabel     = isEditMode?'Guardar cambios ✓':(useCuotas?'Registrar '+remaining+' cuota'+(remaining!==1?'s':'')+' ✓':(queue.length>0?'Guardar '+(queue.length+1)+' gastos ✓':'Guardar gasto ✓'));

  // Derive displayed split amounts — use stored values if manually set, else calculate
  var javiAmt = safeN(form.javiAmount);
  var laliAmt = safeN(form.laliAmount);
  // If both are 0 (new form) derive from responsible
  if(javiAmt===0&&laliAmt===0&&totalAmt>0){
    var derived = calcAmts(totalAmt, form.responsible);
    javiAmt = derived.javiAmount;
    laliAmt = derived.laliAmount;
  }
  var javiPct = totalAmt>0?Math.round(javiAmt/totalAmt*100):50;

  // Split button summary label
  var splitSummary = (form.paidBy==='Javi'?'👨':'👩')+' '+form.paidBy+' · '+javiPct+'% / '+(100-javiPct)+'%';

  var inpStyle = function(extra){ return Object.assign({width:'100%',border:'1px solid '+C.border,borderRadius:'0.75rem',padding:'0.75rem',fontSize:'0.9rem',outline:'none',boxSizing:'border-box',fontFamily:F,color:C.navy,background:C.surface},extra||{}); };
  var selStyle = {width:'100%',border:'1px solid '+C.border,borderRadius:'0.75rem',padding:'0.75rem',fontSize:'0.9rem',outline:'none',background:C.surface,boxSizing:'border-box',fontFamily:F,color:C.navy};
  function Lbl(text){ return React.createElement('label',{style:{fontSize:'0.8rem',color:C.textMuted,fontWeight:700,display:'block',marginBottom:'0.35rem',marginTop:'0.75rem'}},text); }

  function addNewCat(){
    if(!newCatName.trim())return;
    var cat=(newCatEmoji||'📌')+' '+newCatName.trim();
    saveCustomCats(customCats.concat([cat]));
    set('category',cat);setNewCatEmoji('');setNewCatName('');setShowNewCat(false);
  }

  function onSplitConfirm(paidBy, javiAmount, laliAmount, responsible){
    setForm(function(f){ return Object.assign({},f,{paidBy:paidBy,javiAmount:javiAmount,laliAmount:laliAmount,responsible:responsible}); });
    setShowSplitModal(false);
  }

  // When amount changes, reset stored split so it recalculates
  function onAmountChange(val){
    set('amount', val);
    setForm(function(f){ return Object.assign({},f,{amount:val,javiAmount:0,laliAmount:0}); });
  }

  function enqueue(){
    var e={};
    if(!form.description.trim())e.description='Requerido';
    if(!form.amount||parseFloat(form.amount)<=0)e.amount='Monto inválido';
    if(Object.keys(e).length){setErrors(e);return;}
    var finalCur=form.currency==='Otra'?(form.customCurrency||'ARS'):form.currency;
    var item=sanitize(Object.assign({},form,{id:Date.now().toString(),amount:totalAmt,javiAmount:javiAmt,laliAmount:laliAmt,currency:finalCur,period:getPeriod(form.date,periods),createdBy:currentUser,createdAt:new Date().toISOString()}),allCats);
    setQueue(function(q){return q.concat([item]);});
    setForm(function(f){return Object.assign({},f,{description:'',amount:'',javiAmount:0,laliAmount:0});});
    setErrors({});
  }

  function goToStep2(){
    var e={};
    if(!form.description.trim())e.description='Requerido';
    if(!form.amount||parseFloat(form.amount)<=0)e.amount='Monto inválido';
    if(Object.keys(e).length){setErrors(e);return;}
    setErrors({});setStep(2);
  }

  function submit(){
    var e={};
    if(!form.description.trim())e.description='Requerido';
    if(!form.amount||parseFloat(form.amount)<=0)e.amount='Monto inválido';
    if(useCuotas&&isRetro&&paidNum>=finalCuotas)e.retroPaid='Las cuotas ya pagadas deben ser menos que el total.';
    if(useCuotas&&isRetro&&!retroStartPer)e.retroStartPer='Seleccioná el período inicial.';
    if(Object.keys(e).length){setErrors(e);return;}
    var finalCur=form.currency==='Otra'?(form.customCurrency||'ARS'):form.currency;
    var base=Object.assign({},form,{
      id:isEditMode?(initialData&&initialData.id)||Date.now().toString():Date.now().toString(),
      amount:totalAmt, javiAmount:javiAmt, laliAmount:laliAmt,
      currency:finalCur, period:getPeriod(form.date,periods)
    });
    if(!isEditMode){base.createdBy=currentUser;base.createdAt=new Date().toISOString();}
    if(isEditMode){ handleEdit(base); }
    else if(useCuotas&&finalCuotas>1){ handleAddPlan(base,finalCuotas,isRetro?paidNum:0,isRetro?retroStartPer:null); }
    else if(queue.length>0){ handleAddMultiple(queue.concat([sanitize(Object.assign({},base,{id:Date.now().toString()}),allCats)])); }
    else { handleAdd(base); }
  }

  function cancel(){
    if(isEditMode){setEditingExpense(null);}
    setView('dashboard');
  }

  // ── Split button ──────────────────────────────────────────────────────────
  var splitButton = React.createElement('button',{
    onClick:function(){setShowSplitModal(true);},
    style:{width:'100%',background:C.bg,border:'1px solid '+C.border,borderRadius:'0.85rem',padding:'0.65rem 0.85rem',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',fontFamily:F,marginTop:'0.75rem'}
  },
    React.createElement('span',{style:{fontSize:'0.8rem',fontWeight:700,color:C.navy}},'¿Cómo se divide?'),
    React.createElement('span',{style:{fontSize:'0.72rem',color:C.textMuted}},splitSummary+' ›')
  );

  // ── Queue section ─────────────────────────────────────────────────────────
  var queueSection = queue.length>0?React.createElement('div',{style:{marginTop:'0.75rem',background:C.bg,borderRadius:'0.85rem',border:'1px solid '+C.border,overflow:'hidden'}},
    React.createElement('div',{style:{padding:'0.5rem 0.85rem',fontSize:'0.72rem',fontWeight:700,color:C.textMuted,borderBottom:'1px solid '+C.border}},queue.length+' gasto'+(queue.length!==1?'s':'')+' en cola'),
    queue.map(function(item,i){
      return React.createElement('div',{key:item.id,style:{display:'flex',alignItems:'center',gap:'0.5rem',padding:'0.5rem 0.85rem',borderBottom:i<queue.length-1?'1px solid '+C.border:'none'}},
        React.createElement('div',{style:{fontSize:'1rem'}},catEm(item.category)),
        React.createElement('div',{style:{flex:1,minWidth:0}},
          React.createElement('div',{style:{fontWeight:700,fontSize:'0.82rem',color:C.navy,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},item.description),
          React.createElement('div',{style:{fontSize:'0.68rem',color:C.textMuted}},fmt(safeN(item.amount),item.currency||'ARS'))
        ),
        React.createElement('button',{onClick:function(){setQueue(function(q){return q.filter(function(_,j){return j!==i;});});},style:{background:'none',border:'none',color:'#c0314f',cursor:'pointer',fontSize:'0.9rem',flexShrink:0}},'✕')
      );
    })
  ):null;

  // ── Paso 1 ────────────────────────────────────────────────────────────────
  var step1 = React.createElement('div',null,
    React.createElement('div',{style:{fontSize:'0.7rem',color:C.textMuted,fontWeight:700,textAlign:'center',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:'1rem'}},'Paso 1 de 2 — Lo esencial'),
    Lbl('Descripción'),
    React.createElement('input',{style:inpStyle({borderColor:errors.description?'#c0314f':C.border}),value:form.description,onChange:function(e){set('description',e.target.value);setErrors({});},placeholder:'Ej: Almuerzo en Lo de Juan'}),
    errors.description?React.createElement('p',{style:{color:'#c0314f',fontSize:'0.7rem',margin:'0.15rem 0 0'}},'⚠ '+errors.description):null,
    Lbl('Monto total'),
    React.createElement('input',{style:inpStyle({borderColor:errors.amount?'#c0314f':C.border}),type:'number',value:form.amount,onChange:function(e){onAmountChange(e.target.value);setErrors({});},placeholder:'0'}),
    errors.amount?React.createElement('p',{style:{color:'#c0314f',fontSize:'0.7rem',margin:'0.15rem 0 0'}},'⚠ '+errors.amount):null,
    Lbl('Moneda'),
    React.createElement('div',{style:{display:'flex',gap:'0.4rem',flexWrap:'wrap'}},
      BASE_CURS.concat(['Otra']).map(function(c){return React.createElement('button',{key:c,onClick:function(){set('currency',c);},style:{padding:'0.4rem 0.85rem',fontSize:'0.78rem',borderRadius:'0.75rem',border:'1px solid',cursor:'pointer',fontWeight:form.currency===c?800:500,fontFamily:F,background:form.currency===c?C.navy:'transparent',borderColor:form.currency===c?C.navy:C.border,color:form.currency===c?C.white:C.navy}},c);})
    ),
    form.currency==='Otra'?React.createElement('input',{style:inpStyle({marginTop:'0.4rem'}),value:form.customCurrency||'',onChange:function(e){set('customCurrency',e.target.value.toUpperCase());},placeholder:'Ej: BRL, GBP...',maxLength:5}):null,
    Lbl('Fecha'),
    React.createElement('input',{style:inpStyle(),type:'date',value:form.date,onChange:function(e){set('date',e.target.value);}}),
    periods.length>0?React.createElement('div',{style:{textAlign:'center',fontSize:'0.75rem',color:C.textMuted,marginTop:'0.5rem'}},'Período: ',React.createElement('strong',{style:{color:C.navy}},getPeriod(form.date,periods))):null,
    // ── Split button (replaces old collapsible) ──
    splitButton,
    // ── Split preview ──
    showSplit?React.createElement('div',{style:{display:'flex',gap:'0.5rem',marginTop:'0.4rem',padding:'0.5rem 0.6rem',background:C.bg,borderRadius:'0.65rem',border:'1px solid '+C.border}},
      React.createElement('div',{style:{flex:1,textAlign:'center'}},
        React.createElement('div',{style:{fontSize:'0.65rem',color:C.textMuted}},'👨 Javi'),
        React.createElement('div',{style:{fontWeight:800,color:C.navy,fontSize:'0.85rem'}},fmt(javiAmt,cur))
      ),
      React.createElement('div',{style:{width:'1px',background:C.border}}),
      React.createElement('div',{style:{flex:1,textAlign:'center'}},
        React.createElement('div',{style:{fontSize:'0.65rem',color:C.textMuted}},'👩 Lali'),
        React.createElement('div',{style:{fontWeight:800,color:C.accent,fontSize:'0.85rem'}},fmt(laliAmt,cur))
      )
    ):null,
    queueSection,
    React.createElement('button',{onClick:submit,style:{width:'100%',padding:'1rem',background:C.gradMain,color:C.white,border:'none',borderRadius:'1rem',fontWeight:900,fontSize:'1rem',cursor:'pointer',fontFamily:F,boxShadow:'0 4px 12px rgba(0,0,0,0.15)',marginTop:'1rem'}},btnLabel),
    React.createElement('button',{onClick:enqueue,style:{width:'100%',padding:'0.75rem',background:'transparent',border:'1px dashed '+C.accent,borderRadius:'1rem',color:C.accent,fontWeight:700,fontSize:'0.88rem',cursor:'pointer',fontFamily:F,marginTop:'0.5rem'}},'+ Agregar otro gasto'),
    React.createElement('button',{onClick:goToStep2,style:{width:'100%',padding:'0.75rem',background:'transparent',border:'1px solid '+C.border,borderRadius:'1rem',color:C.navy,fontWeight:700,fontSize:'0.88rem',cursor:'pointer',fontFamily:F,marginTop:'0.5rem'}},'Más detalles ▶'),
    React.createElement('button',{onClick:cancel,style:{width:'100%',padding:'0.6rem',background:'none',border:'none',color:C.textMuted,fontSize:'0.85rem',cursor:'pointer',fontFamily:F,marginTop:'0.1rem'}},'Cancelar')
  );

  // ── Paso 2 ────────────────────────────────────────────────────────────────
  var step2 = React.createElement('div',null,
    React.createElement('div',{style:{fontSize:'0.7rem',color:C.textMuted,fontWeight:700,textAlign:'center',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:'0.75rem'}},isEditMode?'Editar gasto':'Paso 2 de 2 — Detalles'),
    isEditMode
      ?React.createElement('div',{style:{background:C.bg,borderRadius:'0.85rem',padding:'0.75rem',marginBottom:'0.5rem',border:'1px solid '+C.border}},
          Lbl('Descripción'),
          React.createElement('input',{style:inpStyle(),value:form.description,onChange:function(e){set('description',e.target.value);},placeholder:'Descripción'}),
          React.createElement('div',{style:{display:'flex',gap:'0.5rem',marginTop:'0.5rem'}},
            React.createElement('div',{style:{flex:1}},Lbl('Monto'),React.createElement('input',{style:inpStyle(),type:'number',value:form.amount,onChange:function(e){onAmountChange(e.target.value);},placeholder:'0'})),
            React.createElement('div',{style:{flex:1}},Lbl('Fecha'),React.createElement('input',{style:inpStyle(),type:'date',value:form.date,onChange:function(e){set('date',e.target.value);}}))
          ),
          periods.length>0?React.createElement('div',{style:{textAlign:'center',fontSize:'0.72rem',color:C.textMuted,marginTop:'0.4rem'}},'Período: ',React.createElement('strong',{style:{color:C.navy}},getPeriod(form.date,periods))):null
        )
      :React.createElement('div',{style:{background:C.bg,borderRadius:'0.85rem',padding:'0.65rem 0.9rem',marginBottom:'0.75rem',border:'1px solid '+C.border,display:'flex',justifyContent:'space-between',alignItems:'center'}},
          React.createElement('div',null,
            React.createElement('div',{style:{fontWeight:700,color:C.navy,fontSize:'0.88rem'}},form.description||'Sin descripción'),
            React.createElement('div',{style:{fontSize:'0.72rem',color:C.textMuted,marginTop:'0.1rem'}},form.date+(form.amount?' · '+fmt(totalAmt,cur):''))
          ),
          React.createElement('button',{onClick:function(){setStep(1);},style:{background:'transparent',border:'1px solid '+C.border,borderRadius:'0.6rem',padding:'0.2rem 0.6rem',fontSize:'0.7rem',color:C.textMuted,cursor:'pointer',fontFamily:F,fontWeight:700,flexShrink:0,marginLeft:'0.5rem'}},'✏️ Editar')
        ),
    Lbl('Categoría'),
    React.createElement('select',{value:form.category,onChange:function(e){set('category',e.target.value);},style:selStyle},allCats.map(function(c){return React.createElement('option',{key:c,value:c},c);})),
    !showNewCat
      ?React.createElement('button',{onClick:function(){setShowNewCat(true);},style:{marginTop:'0.5rem',background:'transparent',border:'1px dashed '+C.accent,borderRadius:'0.65rem',color:C.accent,fontSize:'0.72rem',fontWeight:700,cursor:'pointer',padding:'0.35rem 0.75rem',fontFamily:F,display:'block'}},'➕ Nueva categoría')
      :React.createElement('div',{style:{marginTop:'0.5rem',background:C.bg,borderRadius:'0.75rem',padding:'0.6rem',display:'flex',gap:'0.4rem',alignItems:'center',border:'1px solid '+C.border}},
          React.createElement('input',{value:newCatEmoji,onChange:function(e){setNewCatEmoji(e.target.value);},placeholder:'🏷️',style:{width:'2.5rem',border:'1px solid '+C.border,borderRadius:'0.5rem',padding:'0.4rem',fontSize:'0.85rem',textAlign:'center',outline:'none',fontFamily:F}}),
          React.createElement('input',{value:newCatName,onChange:function(e){setNewCatName(e.target.value);},placeholder:'Nombre...',style:{flex:1,border:'1px solid '+C.border,borderRadius:'0.5rem',padding:'0.4rem',fontSize:'0.82rem',outline:'none',fontFamily:F,color:C.navy,background:C.surface}}),
          React.createElement('button',{onClick:addNewCat,style:{background:C.accent,color:C.white,border:'none',borderRadius:'0.5rem',padding:'0.4rem 0.6rem',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',fontFamily:F}},'OK'),
          React.createElement('button',{onClick:function(){setShowNewCat(false);},style:{background:'none',border:'none',color:C.textMuted,cursor:'pointer',fontSize:'0.9rem'}},'✕')),
    Lbl('Medio de pago'),
    React.createElement('select',{value:form.paymentMethod,onChange:function(e){set('paymentMethod',e.target.value);},style:selStyle},PAY_METHODS.map(function(m){return React.createElement('option',{key:m},m);})),
    Lbl('Banco / Billetera'),
    React.createElement('select',{value:form.bank,onChange:function(e){set('bank',e.target.value);},style:selStyle},BANKS.map(function(b){return React.createElement('option',{key:b},b);})),
    // Split button also in step 2
    splitButton,
    showSplit?React.createElement('div',{style:{display:'flex',gap:'0.5rem',marginTop:'0.4rem',padding:'0.5rem 0.6rem',background:C.bg,borderRadius:'0.65rem',border:'1px solid '+C.border}},
      React.createElement('div',{style:{flex:1,textAlign:'center'}},React.createElement('div',{style:{fontSize:'0.65rem',color:C.textMuted}},'👨 Javi'),React.createElement('div',{style:{fontWeight:800,color:C.navy,fontSize:'0.85rem'}},fmt(javiAmt,cur))),
      React.createElement('div',{style:{width:'1px',background:C.border}}),
      React.createElement('div',{style:{flex:1,textAlign:'center'}},React.createElement('div',{style:{fontSize:'0.65rem',color:C.textMuted}},'👩 Lali'),React.createElement('div',{style:{fontWeight:800,color:C.accent,fontSize:'0.85rem'}},fmt(laliAmt,cur)))
    ):null,
    !isEditMode?React.createElement(React.Fragment,null,
      Lbl('¿Pago en cuotas?'),
      React.createElement('div',{style:{display:'flex',gap:'0.5rem'}},
        React.createElement(SegBtn,{active:!useCuotas,color:C.navy,onClick:function(){setUseCuotas(false);setIsRetro(false);}},'💵 Pago único'),
        React.createElement(SegBtn,{active:useCuotas,color:C.accent,onClick:function(){setUseCuotas(true);}},'📅 En cuotas')
      ),
      useCuotas?React.createElement('div',{style:{background:C.bg,borderRadius:'1rem',padding:'0.85rem',marginTop:'0.5rem',border:'1px solid '+C.border}},
        React.createElement('div',{style:{fontSize:'0.78rem',color:C.navy,fontWeight:700,marginBottom:'0.5rem'}},'Cantidad de cuotas totales'),
        React.createElement('div',{style:{display:'flex',gap:'0.4rem',flexWrap:'wrap',marginBottom:'0.5rem'}},
          CUOTA_OPTS.map(function(n){var active=numCuotas===n&&!customCuotas;return React.createElement('button',{key:n,onClick:function(){setNumCuotas(n);setCustomCuotas('');},style:{padding:'0.35rem 0.65rem',fontSize:'0.78rem',borderRadius:'0.65rem',border:'1px solid',cursor:'pointer',fontFamily:F,fontWeight:active?800:500,background:active?C.navy:'transparent',borderColor:active?C.navy:C.border,color:active?C.white:C.navy}},n);}),
          React.createElement('input',{type:'number',value:customCuotas,onChange:function(e){setCustomCuotas(e.target.value);},placeholder:'Otra',min:2,max:60,style:{width:'4rem',border:'1px solid '+(customCuotas?C.navy:C.border),borderRadius:'0.65rem',padding:'0.35rem 0.5rem',fontSize:'0.78rem',outline:'none',fontFamily:F,color:C.navy,background:customCuotas?C.beige:'transparent',textAlign:'center'}})
        ),
        React.createElement('div',{style:{borderTop:'1px solid '+C.border,paddingTop:'0.6rem',marginTop:'0.35rem'}},
          React.createElement('div',{style:{display:'flex',gap:'0.5rem',marginBottom:isRetro?'0.6rem':0}},
            React.createElement(SegBtn,{active:!isRetro,color:C.navy,onClick:function(){setIsRetro(false);}},'🆕 Compra nueva'),
            React.createElement(SegBtn,{active:isRetro,color:'#b45309',onClick:function(){setIsRetro(true);}},'🕐 Cuotas del pasado')
          ),
          isRetro?React.createElement('div',{style:{background:C.surface,borderRadius:'0.75rem',padding:'0.6rem',border:'1px solid '+C.border,display:'flex',flexDirection:'column',gap:'0.45rem'}},
            React.createElement('div',{style:{fontSize:'0.75rem',color:'#92400e',fontWeight:700}},'Indicá cuántas cuotas ya se pagaron y a partir de qué período continúan.'),
            React.createElement('label',{style:{fontSize:'0.78rem',color:C.textMuted,fontWeight:700}},'Cuotas ya pagadas'),
            React.createElement('input',{type:'number',min:0,max:finalCuotas-1,value:retroPaid,onChange:function(e){setRetroPaid(e.target.value);setErrors({});},placeholder:'0',style:{border:'1px solid '+(errors.retroPaid?'#c0314f':C.border),borderRadius:'0.6rem',padding:'0.45rem 0.6rem',fontSize:'0.88rem',outline:'none',fontFamily:F,color:C.navy,background:C.bg,width:'6rem',boxSizing:'border-box'}}),
            errors.retroPaid?React.createElement('p',{style:{color:'#c0314f',fontSize:'0.7rem',margin:0}},'⚠ '+errors.retroPaid):null,
            React.createElement('label',{style:{fontSize:'0.78rem',color:C.textMuted,fontWeight:700}},'Período donde va la próxima cuota ('+(paidNum+1)+'/'+finalCuotas+')'),
            React.createElement('select',{value:retroStartPer,onChange:function(e){setRetroStartPer(e.target.value);setErrors({});},style:Object.assign({},selStyle,{borderColor:errors.retroStartPer?'#c0314f':C.border,padding:'0.45rem 0.6rem',fontSize:'0.85rem'})},
              React.createElement('option',{value:''},'-- Seleccioná un período --'),
              periods.slice().reverse().map(function(p){return React.createElement('option',{key:p.name,value:p.name},p.name);})),
            errors.retroStartPer?React.createElement('p',{style:{color:'#c0314f',fontSize:'0.7rem',margin:0}},'⚠ '+errors.retroStartPer):null,
            remaining>0?React.createElement('div',{style:{background:C.bg,borderRadius:'0.6rem',padding:'0.45rem 0.6rem',border:'1px dashed '+C.border,fontSize:'0.75rem',color:C.navy,fontWeight:700}},
              'Se registrarán ',React.createElement('span',{style:{color:'#b45309'}},remaining),' cuota'+(remaining!==1?'s ':' ')+'pendiente'+(remaining!==1?'s ':' ')+'('+(paidNum+1)+' a '+finalCuotas+')'
            ):null
          ):null
        ),
        showSplit?React.createElement('div',{style:{background:C.surface,borderRadius:'0.75rem',padding:'0.6rem',border:'1px solid '+C.border,display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'0.5rem'}},
          React.createElement('div',null,React.createElement('div',{style:{fontSize:'0.7rem',color:C.textMuted}},'Por cuota'),React.createElement('div',{style:{fontWeight:900,color:C.navy,fontSize:'1.1rem'}},fmt(installmentAmt,cur))),
          React.createElement('div',{style:{fontSize:'0.75rem',color:C.textMuted,textAlign:'right'}},React.createElement('div',null,finalCuotas+' cuotas totales'),React.createElement('div',{style:{fontWeight:700,color:C.navy}},'Total: '+fmt(totalAmt,cur)))
        ):null
      ):null
    ):null,
    React.createElement('button',{onClick:submit,style:{width:'100%',padding:'1rem',background:C.gradMain,color:C.white,border:'none',borderRadius:'1rem',fontWeight:900,fontSize:'1rem',cursor:'pointer',fontFamily:F,boxShadow:'0 4px 12px rgba(0,0,0,0.15)',marginTop:'1rem'}},btnLabel),
    React.createElement('button',{onClick:cancel,style:{width:'100%',padding:'0.75rem',background:'none',border:'none',color:C.textMuted,fontSize:'0.9rem',cursor:'pointer',fontFamily:F,marginTop:'0.25rem'}},'Cancelar')
  );

  return React.createElement('div',{style:{padding:'1rem',paddingBottom:'2rem'}},
    // SplitModal pop-up
    showSplitModal?React.createElement(SplitModal,{
      amount: totalAmt,
      currency: cur,
      paidBy: form.paidBy,
      javiAmount: javiAmt,
      laliAmount: laliAmt,
      onConfirm: onSplitConfirm,
      onCancel: function(){setShowSplitModal(false);}
    }):null,
    React.createElement('h2',{style:{fontWeight:900,fontSize:'1.2rem',color:C.navy,marginBottom:'0.5rem'}},isEditMode?'✏️ Editar gasto':'Nuevo gasto'),
    step===1?step1:step2
  );
}
