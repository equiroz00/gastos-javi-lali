// ── components/Stats.jsx ──────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PieChart, Pie, Cell
} from 'recharts';
import { C, F, PALETTE, PENDING_PER } from '../constants.js';
import { fmtS, safeN, catEm, catLb, normCat, calcBal, lastPayment, pctChange } from '../lib/helpers.js';
import useAppStore from '../store/useAppStore.js';
import { Card, ScrollFilter, ChartSelector } from './ui.jsx';

function TablaCategoria(props){
  return React.createElement('div',null,
    props.data.map(function(c,i){
      return React.createElement('div',{key:c.label,style:{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.5rem'}},
        React.createElement('div',{style:{width:'8px',height:'8px',borderRadius:'50%',background:PALETTE[i%PALETTE.length],flexShrink:0}}),
        React.createElement('span',{style:{flex:1,fontSize:'0.78rem',color:C.navy,fontWeight:600}},c.emoji+' '+c.label),
        React.createElement('span',{style:{fontSize:'0.78rem',color:C.navy,fontWeight:700}},fmtS(c.value,props.cur)),
        React.createElement('span',{style:{fontSize:'0.7rem',color:C.textMuted,width:'2.5rem',textAlign:'right'}},c.pct+'%')
      );
    })
  );
}

function TablaPM(props){
  return React.createElement('div',null,
    props.data.map(function(p,i){
      return React.createElement('div',{key:p.name,style:{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.45rem'}},
        React.createElement('div',{style:{width:'8px',height:'8px',borderRadius:'50%',background:PALETTE[i%PALETTE.length],flexShrink:0}}),
        React.createElement('span',{style:{flex:1,fontSize:'0.78rem',color:C.navy,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},p.name),
        React.createElement('span',{style:{fontSize:'0.78rem',fontWeight:700,color:C.navy}},fmtS(p.value,props.cur)),
        React.createElement('span',{style:{fontSize:'0.7rem',color:C.textMuted,width:'2.5rem',textAlign:'right'}},p.pct+'%')
      );
    })
  );
}

function CategoryChart(props){
  var data=props.data,type=props.type,cur=props.cur;
  if(!data.length)return null;
  if(type==='Tabla')return React.createElement(TablaCategoria,{data:data,cur:cur});
  if(type==='Barras')return React.createElement(ResponsiveContainer,{width:'100%',height:Math.max(160,data.length*28)},
    React.createElement(BarChart,{data:data,layout:'vertical',margin:{top:0,right:40,bottom:0,left:0}},
      React.createElement(CartesianGrid,{strokeDasharray:'3 3',stroke:C.beige,horizontal:false}),
      React.createElement(XAxis,{type:'number',tickFormatter:function(v){return fmtS(v,cur);},tick:{fontSize:9,fontFamily:F,fill:C.textMuted}}),
      React.createElement(YAxis,{type:'category',dataKey:'label',tick:{fontSize:9,fontFamily:F,fill:C.navy},width:90}),
      React.createElement(Tooltip,{formatter:function(v){return fmtS(v,cur);},contentStyle:{fontFamily:F,fontSize:'0.78rem',borderRadius:'0.6rem',border:'1px solid '+C.border,background:C.surface}}),
      React.createElement(Bar,{dataKey:'value',radius:[0,4,4,0]},data.map(function(_,i){return React.createElement(Cell,{key:i,fill:PALETTE[i%PALETTE.length]});}))
    )
  );
  if(type==='Radar')return React.createElement(ResponsiveContainer,{width:'100%',height:220},
    React.createElement(RadarChart,{data:data.map(function(d){return{subject:d.label,value:d.value};})},
      React.createElement(PolarGrid,{stroke:C.beige}),
      React.createElement(PolarAngleAxis,{dataKey:'subject',tick:{fontSize:9,fontFamily:F,fill:C.navy}}),
      React.createElement(Radar,{dataKey:'value',stroke:C.navy,fill:C.accent,fillOpacity:0.35}),
      React.createElement(Tooltip,{formatter:function(v){return fmtS(v,cur);},contentStyle:{fontFamily:F,fontSize:'0.78rem',borderRadius:'0.6rem',border:'1px solid '+C.border,background:C.surface}})
    )
  );
  if(type==='Torta')return React.createElement(ResponsiveContainer,{width:'100%',height:200},
    React.createElement(PieChart,null,
      React.createElement(Pie,{data:data,dataKey:'value',cx:'50%',cy:'50%',outerRadius:80,label:function(p){return p.pct+'%';},fontSize:9},
        data.map(function(_,i){return React.createElement(Cell,{key:i,fill:PALETTE[i%PALETTE.length]});})
      ),
      React.createElement(Tooltip,{formatter:function(v){return fmtS(v,cur);},contentStyle:{fontFamily:F,fontSize:'0.78rem',borderRadius:'0.6rem',border:'1px solid '+C.border,background:C.surface}})
    )
  );
  return null;
}

function PMChart(props){
  var data=props.data,type=props.type,cur=props.cur;
  if(!data.length)return null;
  if(type==='Tabla')return React.createElement(TablaPM,{data:data,cur:cur});
  if(type==='Barras')return React.createElement(ResponsiveContainer,{width:'100%',height:Math.max(160,data.length*28)},
    React.createElement(BarChart,{data:data,layout:'vertical',margin:{top:0,right:40,bottom:0,left:0}},
      React.createElement(CartesianGrid,{strokeDasharray:'3 3',stroke:C.beige,horizontal:false}),
      React.createElement(XAxis,{type:'number',tickFormatter:function(v){return fmtS(v,cur);},tick:{fontSize:9,fontFamily:F,fill:C.textMuted}}),
      React.createElement(YAxis,{type:'category',dataKey:'name',tick:{fontSize:8,fontFamily:F,fill:C.navy},width:95}),
      React.createElement(Tooltip,{formatter:function(v){return fmtS(v,cur);},contentStyle:{fontFamily:F,fontSize:'0.78rem',borderRadius:'0.6rem',border:'1px solid '+C.border,background:C.surface}}),
      React.createElement(Bar,{dataKey:'value',radius:[0,4,4,0]},data.map(function(_,i){return React.createElement(Cell,{key:i,fill:PALETTE[i%PALETTE.length]});}))
    )
  );
  if(type==='Radar'){
    var rd=data.map(function(d){return{subject:d.name.split(' ').pop(),value:d.value};});
    return React.createElement(ResponsiveContainer,{width:'100%',height:220},
      React.createElement(RadarChart,{data:rd},
        React.createElement(PolarGrid,{stroke:C.beige}),
        React.createElement(PolarAngleAxis,{dataKey:'subject',tick:{fontSize:9,fontFamily:F,fill:C.navy}}),
        React.createElement(Radar,{dataKey:'value',stroke:C.accent,fill:C.accent,fillOpacity:0.35}),
        React.createElement(Tooltip,{formatter:function(v){return fmtS(v,cur);},contentStyle:{fontFamily:F,fontSize:'0.78rem',borderRadius:'0.6rem',border:'1px solid '+C.border,background:C.surface}})
      )
    );
  }
  if(type==='Torta')return React.createElement(ResponsiveContainer,{width:'100%',height:200},
    React.createElement(PieChart,null,
      React.createElement(Pie,{data:data,dataKey:'value',cx:'50%',cy:'50%',outerRadius:80,label:function(p){return p.pct+'%';},fontSize:9},
        data.map(function(_,i){return React.createElement(Cell,{key:i,fill:PALETTE[i%PALETTE.length]});})
      ),
      React.createElement(Tooltip,{formatter:function(v){return fmtS(v,cur);},contentStyle:{fontFamily:F,fontSize:'0.78rem',borderRadius:'0.6rem',border:'1px solid '+C.border,background:C.surface}})
    )
  );
  return null;
}

export default function Stats(){
  var expenses = useAppStore(function(s){ return s.expenses; });
  var settings = useAppStore(function(s){ return s.settings; });
  var payments = useAppStore(function(s){ return s.payments; });
  var customCats = useAppStore(function(s){ return s.customCats; });
  var allCats = (customCats||[]).concat([]);
  var DEFAULT_CATS = ['🏠 Hogar','🍕 Alimentación','🔑 Arriendo','💡 Servicios Públicos','🚌 Transporte','🎬 Entretenimiento','👥 Amigos','💆 Cuidado Personal','💪 Gimnasio','💊 Farmacia','👶 Hijito','👕 Ropa'];
  var allCatsFull = DEFAULT_CATS.concat(customCats||[]);

  var configPeriods = settings.periods||[];
  var allPeriodNames = [].concat(
    configPeriods.map(function(p){return p.name;}),
    expenses.filter(function(e){return e.period&&e.period!==PENDING_PER;}).map(function(e){return e.period;})
  ).filter(function(p,i,a){return a.indexOf(p)===i;});

  var allCurrencies = expenses.map(function(e){return e.currency||'ARS';}).filter(function(c,i,a){return a.indexOf(c)===i;});

  var periodState=useState('Todos');var period=periodState[0];var setPeriod=periodState[1];
  var curState=useState('ARS');var cur=curState[0];var setCur=curState[1];
  var catState=useState('Tabla');var catChart=catState[0];var setCatChart=catState[1];
  var pmState=useState('Tabla');var pmChart=pmState[0];var setPmChart=pmState[1];

  var byPer=period==='Todos'?expenses:expenses.filter(function(e){return e.period===period;});
  var filtered=byPer.filter(function(e){return (e.currency||'ARS')===cur&&e.period!==PENDING_PER;});

  var prevPeriodData=null;
  if(period!=='Todos'){
    var idx=configPeriods.findIndex(function(p){return p.name===period;});
    if(idx>0){
      var prevName=configPeriods[idx-1].name;
      var prevExps=expenses.filter(function(e){return e.period===prevName&&(e.currency||'ARS')===cur&&e.period!==PENDING_PER;});
      prevPeriodData={total:prevExps.reduce(function(s,e){return s+safeN(e.amount);},0),count:prevExps.length};
    }
  }

  var lp=lastPayment(payments,cur);

  if(!filtered.length) return React.createElement('div',{style:{padding:'1rem'}},
    React.createElement('h2',{style:{fontWeight:900,fontSize:'1.2rem',color:C.navy,marginBottom:'0.75rem'}},'📊 Estadísticas'),
    React.createElement(ScrollFilter,{items:['Todos'].concat(allPeriodNames),selected:period,onSelect:setPeriod}),
    allCurrencies.length>1?React.createElement(ScrollFilter,{items:allCurrencies,selected:cur,onSelect:setCur}):null,
    React.createElement(Card,{style:{textAlign:'center',padding:'3rem',color:C.textMuted}},
      React.createElement('div',{style:{fontSize:'2.5rem',marginBottom:'0.5rem'}},'📊'),
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
  filtered.forEach(function(e){
    var k=catLb(normCat(e.category,allCatsFull));
    if(!byCat[k])byCat[k]={label:k,emoji:catEm(normCat(e.category,allCatsFull)),value:0};
    byCat[k].value+=safeN(e.amount);
  });
  var catData=Object.values(byCat).sort(function(a,b){return b.value-a.value;}).map(function(c){return Object.assign({},c,{pct:total>0?Math.round(c.value/total*100):0});});

  var byPM={};
  filtered.forEach(function(e){var k=e.paymentMethod||'Otro';byPM[k]=(byPM[k]||0)+safeN(e.amount);});
  var pmData=Object.entries(byPM).sort(function(a,b){return b[1]-a[1];}).map(function(entry){return{name:entry[0],value:entry[1],pct:total>0?Math.round(entry[1]/total*100):0};});

  var byP={};
  filtered.forEach(function(e){var k=e.period||'Sin período';if(!byP[k])byP[k]={period:k,javi:0,lali:0};byP[k].javi+=safeN(e.javiAmount);byP[k].lali+=safeN(e.laliAmount);});
  var perData=Object.values(byP);

  var amtPct=prevPeriodData?pctChange(total,prevPeriodData.total):null;
  var cntPct=prevPeriodData?pctChange(count,prevPeriodData.count):null;

  return React.createElement('div',{style:{padding:'1rem',paddingBottom:'2rem',display:'flex',flexDirection:'column',gap:'0.75rem'}},
    React.createElement('h2',{style:{fontWeight:900,fontSize:'1.2rem',color:C.navy,margin:0}},'📊 Estadísticas'),
    React.createElement(ScrollFilter,{items:['Todos'].concat(allPeriodNames),selected:period,onSelect:setPeriod}),
    allCurrencies.length>1?React.createElement(ScrollFilter,{items:allCurrencies,selected:cur,onSelect:setCur}):null,
    React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.6rem'}},
      React.createElement(Card,{style:{padding:'0.75rem',background:C.gradMain}},
        React.createElement('div',{style:{fontSize:'0.65rem',color:'rgba(255,255,255,0.7)',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.05em'}},'TOTAL '+cur),
        React.createElement('div',{style:{fontWeight:900,color:C.white,fontSize:'1.1rem',marginTop:'0.1rem'}},fmtS(total,cur)),
        amtPct!==null?React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'0.3rem',marginTop:'0.2rem'}},
          React.createElement('span',{style:{fontSize:'0.75rem',color:amtPct>=0?'#a8f0d5':'#fca5a5',fontWeight:800}},(amtPct>=0?'▲':'▼')+' '+Math.abs(amtPct)+'%'),
          React.createElement('span',{style:{fontSize:'0.65rem',color:'rgba(255,255,255,0.6)'}},'vs anterior')
        ):null
      ),
      React.createElement(Card,{style:{padding:'0.75rem',background:C.gradMain}},
        React.createElement('div',{style:{fontSize:'0.65rem',color:'rgba(255,255,255,0.7)',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.05em'}},'Nº GASTOS'),
        React.createElement('div',{style:{fontWeight:900,color:C.white,fontSize:'1.1rem',marginTop:'0.1rem'}},count),
        cntPct!==null?React.createElement('div',{style:{display:'flex',alignItems:'center',gap:'0.3rem',marginTop:'0.2rem'}},
          React.createElement('span',{style:{fontSize:'0.75rem',color:cntPct>=0?'#a8f0d5':'#fca5a5',fontWeight:800}},(cntPct>=0?'▲':'▼')+' '+Math.abs(cntPct)+'%'),
          React.createElement('span',{style:{fontSize:'0.65rem',color:'rgba(255,255,255,0.6)'}},'vs anterior ('+prevPeriodData.count+')')
        ):null
      )
    ),
    React.createElement('div',{style:{display:'grid',gridTemplateColumns:lp?'1fr 1fr':'1fr',gap:'0.6rem'}},
      React.createElement(Card,{style:{padding:'0.75rem',background:Math.abs(bal)<1?'linear-gradient(135deg,#2d9e7f,#1db88c)':C.gradMain}},
        React.createElement('div',{style:{fontSize:'0.65rem',color:'rgba(255,255,255,0.7)',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.05em'}},'BALANCE'),
        Math.abs(bal)<1
          ?React.createElement('div',{style:{fontWeight:900,color:C.white,fontSize:'1rem',marginTop:'0.2rem'}},'¡Al día! 🎉')
          :React.createElement(React.Fragment,null,
              React.createElement('div',{style:{fontWeight:900,color:C.white,fontSize:'1.1rem',marginTop:'0.2rem'}},fmtS(bal,cur)),
              React.createElement('div',{style:{fontSize:'0.68rem',color:'rgba(255,255,255,0.8)'}},bal>0?'Lali debe':'Javi debe')
            )
      ),
      lp?React.createElement(Card,{style:{padding:'0.75rem',background:'linear-gradient(135deg,#2d9e7f,#1db88c)'}},
        React.createElement('div',{style:{fontSize:'0.65rem',color:'rgba(255,255,255,0.7)',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.05em'}},'ÚLTIMO PAGO'),
        React.createElement('div',{style:{fontWeight:900,color:C.white,fontSize:'1.1rem',marginTop:'0.1rem'}},fmtS(safeN(lp.amount),lp.currency||'ARS')),
        React.createElement('div',{style:{fontSize:'0.68rem',color:'rgba(255,255,255,0.8)'}},lp.from+' → '+lp.to),
        React.createElement('div',{style:{fontSize:'0.65rem',color:'rgba(255,255,255,0.65)'}},lp.date)
      ):null
    ),
    React.createElement(Card,null,
      React.createElement('h3',{style:{fontWeight:800,color:C.navy,margin:'0 0 0.75rem',fontSize:'0.9rem'}},'💳 ¿Quién pagó más?'),
      React.createElement('div',{style:{display:'flex',gap:'0.6rem',marginBottom:'0.6rem'}},
        [['Javi',C.gradJavi,javiPaid,'👨'],['Lali',C.gradLali,laliPaid,'👩']].map(function(row){
          return React.createElement('div',{key:row[0],style:{flex:1,background:row[1],borderRadius:'0.85rem',padding:'0.6rem',textAlign:'center',color:C.white}},
            React.createElement('div',{style:{fontSize:'1.2rem'}},row[3]),
            React.createElement('div',{style:{fontWeight:800,fontSize:'0.9rem'}},fmtS(row[2],cur)),
            React.createElement('div',{style:{fontSize:'0.7rem',opacity:0.85}},(total>0?Math.round(row[2]/total*100):0)+'%')
          );
        })
      ),
      React.createElement('div',{style:{display:'flex',gap:'0.6rem'}},
        [['Javi',C.navy,javiTotal,'Resp. Javi'],['Lali',C.accent,laliTotal,'Resp. Lali']].map(function(row){
          return React.createElement('div',{key:row[0],style:{flex:1,background:C.bg,borderRadius:'0.75rem',padding:'0.5rem',textAlign:'center',border:'1px solid '+C.border}},
            React.createElement('div',{style:{fontSize:'0.65rem',color:C.textMuted}},row[3]),
            React.createElement('div',{style:{fontWeight:800,color:row[1],fontSize:'0.85rem'}},fmtS(row[2],cur))
          );
        })
      )
    ),
    React.createElement(Card,null,
      React.createElement('h3',{style:{fontWeight:800,color:C.navy,margin:'0 0 0.5rem',fontSize:'0.9rem'}},'🗂 Gasto por categoría'),
      React.createElement(ChartSelector,{value:catChart,onChange:setCatChart}),
      React.createElement(CategoryChart,{data:catData,type:catChart,cur:cur})
    ),
    React.createElement(Card,null,
      React.createElement('h3',{style:{fontWeight:800,color:C.navy,margin:'0 0 0.5rem',fontSize:'0.9rem'}},'💳 Métodos de pago'),
      React.createElement(ChartSelector,{value:pmChart,onChange:setPmChart}),
      React.createElement(PMChart,{data:pmData,type:pmChart,cur:cur})
    ),
    period==='Todos'&&perData.length>1?React.createElement(Card,null,
      React.createElement('h3',{style:{fontWeight:800,color:C.navy,margin:'0 0 0.75rem',fontSize:'0.9rem'}},'📈 Evolución por período'),
      React.createElement(ResponsiveContainer,{width:'100%',height:180},
        React.createElement(BarChart,{data:perData,margin:{top:5,right:5,bottom:30,left:0}},
          React.createElement(CartesianGrid,{strokeDasharray:'3 3',stroke:C.beige}),
          React.createElement(XAxis,{dataKey:'period',tick:{fontSize:9,angle:-35,textAnchor:'end',fontFamily:F,fill:C.textMuted},interval:0}),
          React.createElement(YAxis,{tickFormatter:function(v){return fmtS(v,cur);},tick:{fontSize:9,fontFamily:F,fill:C.textMuted},width:45}),
          React.createElement(Tooltip,{formatter:function(v){return fmtS(v,cur);},contentStyle:{fontFamily:F,fontSize:'0.78rem',borderRadius:'0.6rem',border:'1px solid '+C.border,background:C.surface}}),
          React.createElement(Bar,{dataKey:'javi',name:'Javi',fill:C.navy,stackId:'a'}),
          React.createElement(Bar,{dataKey:'lali',name:'Lali',fill:C.accent,stackId:'a',radius:[4,4,0,0]})
        )
      ),
      React.createElement('div',{style:{display:'flex',gap:'1rem',justifyContent:'center',marginTop:'0.5rem'}},
        [['Javi',C.navy],['Lali',C.accent]].map(function(row){
          return React.createElement('div',{key:row[0],style:{display:'flex',alignItems:'center',gap:'0.3rem',fontSize:'0.75rem',color:C.navy}},
            React.createElement('div',{style:{width:'10px',height:'10px',borderRadius:'2px',background:row[1]}}),
            row[0]
          );
        })
      )
    ):null
  );
}
