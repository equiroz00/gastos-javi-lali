// ── components/Settings.jsx ───────────────────────────────────────────────────
import React, { useState } from 'react';
import { C, F, THEMES, FONTS } from '../constants';
import useAppStore from '../store/useAppStore';
import { Card } from './ui.jsx';

export default function Settings(){
  var settings    = useAppStore(function(s){ return s.settings; });
  var saveSettings= useAppStore(function(s){ return s.saveSettings; });
  var exportCSV   = useAppStore(function(s){ return s.exportCSV; });

  var perState=useState(settings.periods||[]);var periods=perState[0];var setPeriods=perState[1];
  var npState=useState({name:'',start:'',end:''});var np=npState[0];var setNp=npState[1];
  var errState=useState('');var periodError=errState[0];var setPeriodError=errState[1];
  var savedState=useState(false);var saved=savedState[0];var setSaved=savedState[1];
  var csvFromState=useState('');var csvFrom=csvFromState[0];var setCsvFrom=csvFromState[1];
  var csvToState=useState('');var csvTo=csvToState[0];var setCsvTo=csvToState[1];

  var selectedTheme=settings.theme||'default';
  var selectedFont=settings.font||'Nunito';

  function setTheme(t){ saveSettings(Object.assign({},settings,{theme:t,periods:periods})); }
  function setFont(f){ saveSettings(Object.assign({},settings,{font:f,periods:periods})); }

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
    setPeriodError('');
    setPeriods(function(p){return p.concat([np]);});
    setNp({name:'',start:'',end:''});
  }

  function save(){
    saveSettings(Object.assign({},settings,{periods:periods}));
    setSaved(true);
    setTimeout(function(){setSaved(false);},2000);
  }

  var inp={width:'100%',border:'1px solid '+C.border,borderRadius:'0.6rem',padding:'0.5rem 0.75rem',fontSize:'0.85rem',outline:'none',boxSizing:'border-box',fontFamily:F,color:C.navy,background:C.surface};

  return React.createElement('div',{style:{padding:'1rem',paddingBottom:'2rem',display:'flex',flexDirection:'column',gap:'0.75rem'}},
    React.createElement('h2',{style:{fontWeight:900,fontSize:'1.2rem',color:C.navy,margin:0}},'Configuración'),

    React.createElement(Card,null,
      React.createElement('h3',{style:{fontWeight:800,color:C.navy,margin:'0 0 0.75rem',fontSize:'0.95rem'}},'🎨 Tema de color'),
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.5rem'}},
        Object.entries(THEMES).map(function(entry){
          var key=entry[0],t=entry[1],isActive=selectedTheme===key;
          return React.createElement('button',{key:key,onClick:function(){setTheme(key);},style:{padding:'0.6rem 0.3rem',borderRadius:'0.75rem',border:'2px solid '+(isActive?C.accent:C.border),cursor:'pointer',fontFamily:F,background:t.bg,display:'flex',flexDirection:'column',alignItems:'center',gap:'0.25rem'}},
            React.createElement('div',{style:{display:'flex',gap:'3px'}},[t.navy,t.accent,t.bg].map(function(col,i){return React.createElement('div',{key:i,style:{width:'12px',height:'12px',borderRadius:'50%',background:col,border:'1px solid rgba(0,0,0,0.1)'}});})),
            React.createElement('span',{style:{fontSize:'0.65rem',fontWeight:isActive?800:500,color:t.navy}},(isActive?'✓ ':'')+t.label)
          );
        })
      )
    ),

    React.createElement(Card,null,
      React.createElement('h3',{style:{fontWeight:800,color:C.navy,margin:'0 0 0.75rem',fontSize:'0.95rem'}},'✍️ Tipografía'),
      React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'0.35rem',maxHeight:'220px',overflowY:'auto'}},
        Object.entries(FONTS).map(function(entry){
          var key=entry[0],fd=entry[1],isActive=selectedFont===key;
          return React.createElement('button',{key:key,onClick:function(){setFont(key);},style:{padding:'0.5rem 0.75rem',borderRadius:'0.65rem',border:'1px solid '+(isActive?C.accent:C.border),cursor:'pointer',background:isActive?C.accent:'transparent',color:isActive?C.white:C.navy,textAlign:'left',fontSize:'0.85rem',fontFamily:fd.css,fontWeight:isActive?700:400}},
            (isActive?'✓ ':'')+fd.label
          );
        })
      )
    ),

    React.createElement(Card,null,
      React.createElement('h3',{style:{fontWeight:800,color:C.navy,margin:'0 0 0.4rem',fontSize:'0.95rem'}},'📊 Exportar gastos a CSV'),
      React.createElement('div',{style:{display:'flex',gap:'0.4rem',marginBottom:'0.5rem'}},
        React.createElement('div',{style:{flex:1}},React.createElement('div',{style:{fontSize:'0.72rem',color:C.textMuted,marginBottom:'0.2rem',fontWeight:700}},'Desde'),React.createElement('input',{type:'date',style:inp,value:csvFrom,onChange:function(e){setCsvFrom(e.target.value);}})),
        React.createElement('div',{style:{flex:1}},React.createElement('div',{style:{fontSize:'0.72rem',color:C.textMuted,marginBottom:'0.2rem',fontWeight:700}},'Hasta'),React.createElement('input',{type:'date',style:inp,value:csvTo,onChange:function(e){setCsvTo(e.target.value);}}))
      ),
      React.createElement('button',{onClick:function(){exportCSV(csvFrom,csvTo);},style:{width:'100%',padding:'0.65rem',background:C.gradMain,color:C.white,border:'none',borderRadius:'0.85rem',fontWeight:700,fontSize:'0.85rem',cursor:'pointer',fontFamily:F}},'⬇️ Descargar CSV')
    ),

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
        ?React.createElement('p',{style:{fontSize:'0.8rem',color:C.textMuted,margin:0}},'No hay períodos configurados aún.')
        :React.createElement(React.Fragment,null,
            React.createElement('p',{style:{fontSize:'0.75rem',color:C.textMuted,margin:'0 0 0.4rem',fontWeight:700}},'Períodos registrados ('+periods.length+'):'),
            React.createElement('div',{style:{maxHeight:'220px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'0.4rem'}},
              periods.slice().reverse().map(function(p,i){
                return React.createElement('div',{key:p.name+i,style:{display:'flex',justifyContent:'space-between',alignItems:'center',background:C.bg,borderRadius:'0.6rem',padding:'0.5rem 0.75rem',border:'1px solid '+C.border,flexShrink:0}},
                  React.createElement('div',null,React.createElement('div',{style:{fontWeight:700,fontSize:'0.85rem',color:C.navy}},p.name),React.createElement('div',{style:{fontSize:'0.7rem',color:C.textMuted}},p.start+' → '+p.end)),
                  React.createElement('button',{onClick:function(){setPeriods(function(ps){return ps.filter(function(x){return x.name!==p.name;});});},style:{background:'none',border:'none',color:'#c0314f',cursor:'pointer',fontSize:'1rem'}},'✕')
                );
              })
            )
          )
    ),

    React.createElement('button',{onClick:save,style:{width:'100%',padding:'0.9rem',border:'none',borderRadius:'1rem',fontWeight:900,fontSize:'0.95rem',cursor:'pointer',fontFamily:F,background:saved?'linear-gradient(135deg,#2d9e7f,#1db88c)':C.gradMain,color:C.white}},saved?'✓ Guardado':'Guardar configuración')
  );
}
