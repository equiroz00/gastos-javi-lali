import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_CATS = ['🏠 Hogar','🍕 Alimentación','🔑 Arriendo','💡 Servicios Públicos','🚌 Transporte','🎬 Entretenimiento','👥 Amigos','💆 Cuidado Personal','💪 Gimnasio','💊 Farmacia','👶 Hijito','👕 Ropa'];
const PAY_METHODS = ['Efectivo','TC Visa Laura','TC Master Card Laura','TC Visa Extensión','TC Master Card Extensión','Dinero en Cuenta','TC Visa Javi','TC Amex Javi','TC Amex Laura'];
const BANKS = ['Banco Nación','Banco Provincia','Banco Ciudad','Banco Credicoop','Galicia','Macro','Supervielle','Patagonia','Comafi','Hipotecario','Naranja X','Santander','BBVA','HSBC','Itaú','ICBC','Mercado Pago','Ualá','Brubank','Lemon','Personal Pay','Otro'];
const PALETTE = ['#6366F1','#EC4899','#10B981','#F59E0B','#3B82F6','#EF4444','#8B5CF6','#14B8A6','#F97316','#84CC16','#06B6D4','#E879F9'];
const BASE_CURS = ['ARS','USD','EUR'];
const CUR_SYM = {ARS:'$',USD:'US$',EUR:'€'};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n,c='ARS') => `${CUR_SYM[c]||c+' '}${Math.abs(n).toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
const fmtS = (n,c='ARS') => { const a=Math.abs(n),s=CUR_SYM[c]||c; return a>=1e6?`${s}${(a/1e6).toFixed(1)}M`:a>=1e3?`${s}${(a/1e3).toFixed(0)}K`:`${s}${Math.round(a)}`; };
const todayStr = () => new Date().toISOString().split('T')[0];
const safeN = v => { const n=parseFloat(v); return isFinite(n)&&!isNaN(n)?n:0; };
const normCat = (cat,cats) => {
  if(!cat||typeof cat!=='string') return '📦 Otro';
  const exact=cats.find(c=>c===cat.trim()); if(exact) return exact;
  const s=cat.replace(/^\p{Emoji}\s*/u,'').trim().toLowerCase();
  const m=cats.find(c=>c.replace(/^\p{Emoji}\s*/u,'').trim().toLowerCase()===s);
  return m||cat.trim();
};
const catEm = cat => { if(!cat) return '📦'; const m=cat.match(/^(\p{Emoji})/u); return m?m[1]:'📦'; };
const catLb = cat => cat?cat.replace(/^\p{Emoji}\s*/u,'').trim()||cat:'Otro';
const calcAmts = (amt,resp) => { const n=safeN(amt); if(resp==='Javi')return{javiAmount:n,laliAmount:0}; if(resp==='Lali')return{javiAmount:0,laliAmount:n}; return{javiAmount:n/2,laliAmount:n/2}; };
const calcBal = exps => exps.reduce((b,e)=>e.paidBy==='Javi'?b+safeN(e.laliAmount):b-safeN(e.javiAmount),0);
const getPeriod = (d,ps) => { if(!ps?.length) return 'Sin período'; const dt=new Date(d+'T12:00:00'); for(const p of ps) if(dt>=new Date(p.start+'T00:00:00')&&dt<=new Date(p.end+'T23:59:59')) return p.name; return 'Sin período'; };

// ── Storage ───────────────────────────────────────────────────────────────────
const store = {
  get:(k,fb=null)=>{try{const v=localStorage.getItem(k);return v!=null?JSON.parse(v):fb;}catch{return fb;}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}},
  del:(k)=>{try{localStorage.removeItem(k);}catch{}},
};

const sanitize = (e,cats) => ({
  ...e,
  description:String(e.description||''),
  amount:safeN(e.amount), javiAmount:safeN(e.javiAmount), laliAmount:safeN(e.laliAmount),
  category:normCat(e.category,cats),
  currency:e.currency||'ARS',
  date:typeof e.date==='string'&&e.date.match(/^\d{4}-\d{2}-\d{2}/)?e.date.substring(0,10):(e.date||todayStr()),
  paidBy:e.paidBy==='Javi'||e.paidBy==='Edinson'?'Javi':'Lali',
  responsible:['Javi','Lali','Ambos'].includes(e.responsible)?e.responsible:'Ambos',
});

// ── Font injection ────────────────────────────────────────────────────────────
const useFont = () => useEffect(()=>{
  const l=document.createElement('link');
  l.href='https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap';
  l.rel='stylesheet'; document.head.appendChild(l);
  document.body.style.fontFamily="'Nunito',sans-serif";
  return()=>{document.body.style.fontFamily='';};
},[]);

const F = "'Nunito',sans-serif";

// ── UserSelect ────────────────────────────────────────────────────────────────
function UserSelect({onSelect}) {
  useFont();
  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#EEF2FF,#FDF2F8)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',gap:'1.5rem',fontFamily:F}}>
      <div style={{textAlign:'center',marginBottom:'1rem'}}>
        <div style={{fontSize:'3.5rem',marginBottom:'0.75rem'}}>💑</div>
        <h1 style={{fontSize:'1.75rem',fontWeight:900,color:'#111827',margin:0,fontFamily:F}}>Gastos Compartidos</h1>
        <p style={{color:'#6B7280',marginTop:'0.5rem',fontFamily:F}}>¿Quién sos?</p>
      </div>
      {['Javi','Lali'].map(u=>(
        <button key={u} onClick={()=>onSelect(u)} style={{width:'100%',maxWidth:'280px',padding:'1.5rem',borderRadius:'1.25rem',color:'white',fontSize:'1.25rem',fontWeight:900,border:'none',cursor:'pointer',fontFamily:F,background:u==='Javi'?'linear-gradient(135deg,#3B82F6,#6366F1)':'linear-gradient(135deg,#EC4899,#F43F5E)',boxShadow:'0 8px 20px rgba(0,0,0,0.15)'}}>
          {u==='Javi'?'👨':'👩'} {u}
        </button>
      ))}
    </div>
  );
}

// ── BalanceSection ────────────────────────────────────────────────────────────
function BalanceSection({periodExps}) {
  const byCur={};
  periodExps.forEach(e=>{const c=e.currency||'ARS';if(!byCur[c])byCur[c]=[];byCur[c].push(e);});
  const curs=Object.keys(byCur);
  if(!curs.length) return (
    <div style={{margin:'1rem',borderRadius:'1.25rem',padding:'1.25rem 1.5rem',background:'linear-gradient(135deg,#10B981,#059669)',color:'white',boxShadow:'0 4px 14px rgba(0,0,0,0.15)'}}>
      <p style={{fontSize:'0.75rem',opacity:0.8,margin:'0 0 0.25rem'}}>Balance del período actual</p>
      <div style={{fontSize:'1.5rem',fontWeight:800}}>¡Sin gastos aún!</div>
    </div>
  );
  return (
    <div style={{margin:'1rem',display:'flex',flexDirection:'column',gap:'0.6rem'}}>
      {curs.map(c=>{
        const bal=calcBal(byCur[c]),noDebt=Math.abs(bal)<1,laliOwes=bal>0;
        const bg=noDebt?'linear-gradient(135deg,#10B981,#059669)':laliOwes?'linear-gradient(135deg,#3B82F6,#6366F1)':'linear-gradient(135deg,#EC4899,#F43F5E)';
        return (
          <div key={c} style={{borderRadius:'1.25rem',padding:'1rem 1.5rem',background:bg,color:'white',boxShadow:'0 4px 14px rgba(0,0,0,0.1)'}}>
            <p style={{fontSize:'0.7rem',opacity:0.8,margin:'0 0 0.15rem'}}>Balance {c} — período actual</p>
            {noDebt?<div style={{fontSize:'1.3rem',fontWeight:800}}>¡Al día! 🎉</div>
              :<><div style={{fontSize:'1.7rem',fontWeight:800}}>{fmt(bal,c)}</div><div style={{fontSize:'0.82rem',opacity:0.9}}>{laliOwes?'👩 Lali':'👨 Javi'} le debe a {laliOwes?'👨 Javi':'👩 Lali'}</div></>}
          </div>
        );
      })}
    </div>
  );
}

// ── ExpenseRow ────────────────────────────────────────────────────────────────
function ExpenseRow({expense:e,onDelete,onEdit}) {
  const [open,setOpen]=useState(false);
  const cur=e.currency||'ARS';
  return (
    <div style={{borderBottom:'1px solid #F3F4F6'}}>
      <div onClick={()=>setOpen(!open)} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.75rem 1rem',cursor:'pointer',background:open?'#FAFAFA':'white'}}>
        <div style={{fontSize:'1.4rem',flexShrink:0,width:'2rem',textAlign:'center'}}>{catEm(e.category)}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.35rem'}}>
            <span style={{fontWeight:700,color:'#111827',fontSize:'0.9rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.description||'Sin descripción'}</span>
            {cur!=='ARS'&&<span style={{fontSize:'0.6rem',background:'#EEF2FF',color:'#6366F1',borderRadius:'999px',padding:'0.1rem 0.35rem',fontWeight:800,flexShrink:0}}>{cur}</span>}
          </div>
          <div style={{fontSize:'0.7rem',color:'#9CA3AF',marginTop:'0.1rem'}}>{e.date} · {catLb(e.category)}</div>
          <div style={{fontSize:'0.7rem',color:'#9CA3AF'}}>Pagó: <span style={{fontWeight:700,color:e.paidBy==='Javi'?'#3B82F6':'#EC4899'}}>{e.paidBy}</span> · {e.paymentMethod}</div>
        </div>
        <div style={{textAlign:'right',flexShrink:0}}>
          <div style={{fontWeight:800,color:'#111827',fontSize:'0.95rem'}}>{fmt(safeN(e.amount),cur)}</div>
          <div style={{fontSize:'0.65rem',color:'#9CA3AF'}}>J:{fmt(safeN(e.javiAmount),cur)} / L:{fmt(safeN(e.laliAmount),cur)}</div>
        </div>
      </div>
      {open&&(
        <div style={{display:'flex',gap:'0.5rem',padding:'0.5rem 1rem',background:'#F9FAFB',borderTop:'1px solid #F3F4F6'}}>
          <button onClick={()=>onEdit(e)} style={{flex:1,padding:'0.4rem',background:'#EEF2FF',border:'none',borderRadius:'0.6rem',color:'#6366F1',fontWeight:700,fontSize:'0.78rem',cursor:'pointer',fontFamily:F}}>✏️ Editar</button>
          <button onClick={()=>onDelete(e.id,e)} style={{flex:1,padding:'0.4rem',background:'#FEF2F2',border:'none',borderRadius:'0.6rem',color:'#EF4444',fontWeight:700,fontSize:'0.78rem',cursor:'pointer',fontFamily:F}}>🗑️ {e.fromSheet?'Del Sheet':'Eliminar'}</button>
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({expenses,periodExps,settings,onDelete,onEdit,onSync,syncing}) {
  const total=periodExps.filter(e=>(e.currency||'ARS')==='ARS').reduce((s,e)=>s+safeN(e.amount),0);
  const periodName=settings.periods?.length?settings.periods[settings.periods.length-1].name:'Sin configurar';
  return (
    <div>
      <BalanceSection periodExps={periodExps}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',margin:'0 1rem 1rem'}}>
        <div style={{background:'white',borderRadius:'1rem',padding:'0.85rem',boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
          <div style={{fontSize:'0.7rem',color:'#9CA3AF'}}>Total ARS del período</div>
          <div style={{fontWeight:800,color:'#111827',marginTop:'0.2rem'}}>{fmt(total)}</div>
          <div style={{fontSize:'0.7rem',color:'#9CA3AF'}}>{periodExps.length} gastos</div>
        </div>
        <div style={{background:'white',borderRadius:'1rem',padding:'0.85rem',boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
          <div style={{fontSize:'0.7rem',color:'#9CA3AF'}}>Período actual</div>
          <div style={{fontWeight:700,color:'#111827',marginTop:'0.2rem',fontSize:'0.82rem'}}>{periodName}</div>
        </div>
      </div>
      {settings.scriptUrl&&(
        <div style={{margin:'0 1rem 1rem'}}>
          <button onClick={onSync} disabled={syncing} style={{width:'100%',padding:'0.6rem',background:syncing?'#E5E7EB':'#EEF2FF',border:'1px solid #C7D2FE',borderRadius:'0.75rem',color:syncing?'#9CA3AF':'#4F46E5',fontWeight:700,fontSize:'0.85rem',cursor:syncing?'not-allowed':'pointer',fontFamily:F}}>
            {syncing?'⟳ Sincronizando...':'☁️ Sincronizar con Google Sheet'}
          </button>
        </div>
      )}
      <div style={{margin:'0 1rem',display:'flex',justifyContent:'space-between',marginBottom:'0.5rem'}}>
        <h2 style={{fontWeight:800,color:'#374151',fontSize:'0.9rem',margin:0}}>Últimos gastos</h2>
        <span style={{fontSize:'0.7rem',color:'#9CA3AF'}}>tocá para opciones</span>
      </div>
      {expenses.length===0
        ?<div style={{textAlign:'center',padding:'3rem',color:'#9CA3AF'}}><div style={{fontSize:'2.5rem',marginBottom:'0.5rem'}}>🧾</div>No hay gastos aún</div>
        :<div style={{background:'white',borderRadius:'1rem',margin:'0 1rem',boxShadow:'0 1px 4px rgba(0,0,0,0.07)',overflow:'hidden'}}>
           {expenses.slice(0,10).map(e=><ExpenseRow key={e.id} expense={e} onDelete={onDelete} onEdit={onEdit}/>)}
         </div>
      }
    </div>
  );
}

// ── PeriodFilter ──────────────────────────────────────────────────────────────
function PeriodFilter({periods,selected,onSelect}) {
  return (
    <div style={{display:'flex',gap:'0.4rem',overflowX:'auto',paddingBottom:'0.5rem',marginBottom:'0.6rem',scrollbarWidth:'none'}}>
      {periods.map(p=>(
        <button key={p} onClick={()=>onSelect(p)} style={{flexShrink:0,padding:'0.35rem 0.75rem',borderRadius:'999px',border:'1px solid',fontSize:'0.75rem',cursor:'pointer',fontWeight:selected===p?800:500,fontFamily:F,background:selected===p?'#6366F1':'white',borderColor:selected===p?'#6366F1':'#E5E7EB',color:selected===p?'white':'#374151',whiteSpace:'nowrap'}}>
          {p}
        </button>
      ))}
    </div>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function Stats({expenses,settings,allCats}) {
  const allPeriods=[...new Set([...(settings.periods?.map(p=>p.name)||[]),...expenses.map(e=>e.period).filter(Boolean)])];
  const allCurrencies=[...new Set(expenses.map(e=>e.currency||'ARS'))];
  const [period,setPeriod]=useState('Todos');
  const [cur,setCur]=useState('ARS');

  const byPer=period==='Todos'?expenses:expenses.filter(e=>e.period===period);
  const filtered=byPer.filter(e=>(e.currency||'ARS')===cur);

  if(!filtered.length) return (
    <div style={{padding:'1rem'}}>
      <h2 style={{fontWeight:900,fontSize:'1.2rem',color:'#111827',marginBottom:'0.75rem'}}>📊 Estadísticas</h2>
      <PeriodFilter periods={['Todos',...allPeriods]} selected={period} onSelect={setPeriod}/>
      {allCurrencies.length>1&&<PeriodFilter periods={allCurrencies} selected={cur} onSelect={setCur}/>}
      <div style={{textAlign:'center',padding:'3rem',color:'#9CA3AF'}}><div style={{fontSize:'2.5rem',marginBottom:'0.5rem'}}>📊</div>No hay datos para este período/moneda</div>
    </div>
  );

  const total=filtered.reduce((s,e)=>s+safeN(e.amount),0);
  const javiTotal=filtered.reduce((s,e)=>s+safeN(e.javiAmount),0);
  const laliTotal=filtered.reduce((s,e)=>s+safeN(e.laliAmount),0);
  const bal=calcBal(filtered);
  const javiPaid=filtered.filter(e=>e.paidBy==='Javi').reduce((s,e)=>s+safeN(e.amount),0);
  const laliPaid=filtered.filter(e=>e.paidBy==='Lali').reduce((s,e)=>s+safeN(e.amount),0);

  const byCat={};
  filtered.forEach(e=>{const k=catLb(normCat(e.category,allCats));if(!byCat[k])byCat[k]={label:k,emoji:catEm(normCat(e.category,allCats)),value:0};byCat[k].value+=safeN(e.amount);});
  const catData=Object.values(byCat).sort((a,b)=>b.value-a.value).map(c=>({...c,pct:total>0?Math.round(c.value/total*100):0}));

  const byPM={};
  filtered.forEach(e=>{const k=e.paymentMethod||'Otro';byPM[k]=(byPM[k]||0)+safeN(e.amount);});
  const pmData=Object.entries(byPM).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value,pct:total>0?Math.round(value/total*100):0}));

  const byP={};
  filtered.forEach(e=>{const k=e.period||'Sin período';if(!byP[k])byP[k]={period:k,total:0,javi:0,lali:0};byP[k].total+=safeN(e.amount);byP[k].javi+=safeN(e.javiAmount);byP[k].lali+=safeN(e.laliAmount);});
  const perData=Object.values(byP);

  const card={background:'white',borderRadius:'1rem',padding:'1rem',boxShadow:'0 1px 4px rgba(0,0,0,0.07)',marginBottom:'1rem'};

  return (
    <div style={{padding:'1rem',paddingBottom:'2rem'}}>
      <h2 style={{fontWeight:900,fontSize:'1.2rem',color:'#111827',marginBottom:'0.75rem'}}>📊 Estadísticas</h2>
      <PeriodFilter periods={['Todos',...allPeriods]} selected={period} onSelect={setPeriod}/>
      {allCurrencies.length>1&&<PeriodFilter periods={allCurrencies} selected={cur} onSelect={setCur}/>}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.6rem',marginBottom:'1rem'}}>
        <div style={{...card,margin:0,background:'linear-gradient(135deg,#EEF2FF,#E0E7FF)'}}>
          <div style={{fontSize:'0.7rem',color:'#6366F1',fontWeight:800}}>TOTAL {cur}</div>
          <div style={{fontWeight:900,color:'#111827',fontSize:'1.1rem',marginTop:'0.2rem'}}>{fmtS(total,cur)}</div>
          <div style={{fontSize:'0.7rem',color:'#9CA3AF'}}>{filtered.length} gastos</div>
        </div>
        <div style={{...card,margin:0,background:Math.abs(bal)<1?'linear-gradient(135deg,#D1FAE5,#A7F3D0)':bal>0?'linear-gradient(135deg,#DBEAFE,#BFDBFE)':'linear-gradient(135deg,#FCE7F3,#FBCFE8)'}}>
          <div style={{fontSize:'0.7rem',color:'#374151',fontWeight:800}}>BALANCE</div>
          {Math.abs(bal)<1?<div style={{fontWeight:900,color:'#059669',fontSize:'1rem',marginTop:'0.2rem'}}>¡Al día! 🎉</div>
            :<><div style={{fontWeight:900,color:'#111827',fontSize:'1.1rem',marginTop:'0.2rem'}}>{fmtS(bal,cur)}</div><div style={{fontSize:'0.7rem',color:'#6B7280'}}>{bal>0?'Lali debe':'Javi debe'}</div></>}
        </div>
      </div>

      <div style={card}>
        <h3 style={{fontWeight:800,color:'#374151',margin:'0 0 0.75rem',fontSize:'0.9rem'}}>💳 ¿Quién pagó más?</h3>
        <div style={{display:'flex',gap:'0.75rem',marginBottom:'0.6rem'}}>
          {[['Javi','#3B82F6',javiPaid,'👨'],['Lali','#EC4899',laliPaid,'👩']].map(([n,color,val,icon])=>(
            <div key={n} style={{flex:1,background:`${color}15`,borderRadius:'0.75rem',padding:'0.6rem',textAlign:'center'}}>
              <div style={{fontSize:'1.2rem'}}>{icon}</div>
              <div style={{fontWeight:800,color,fontSize:'0.9rem'}}>{fmtS(val,cur)}</div>
              <div style={{fontSize:'0.7rem',color:'#6B7280'}}>{total>0?Math.round(val/total*100):0}%</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:'0.75rem'}}>
          {[['Javi','#3B82F6',javiTotal,'Resp. Javi'],['Lali','#EC4899',laliTotal,'Resp. Lali']].map(([n,color,val,label])=>(
            <div key={n} style={{flex:1,background:'#F9FAFB',borderRadius:'0.75rem',padding:'0.5rem',textAlign:'center'}}>
              <div style={{fontSize:'0.65rem',color:'#9CA3AF'}}>{label}</div>
              <div style={{fontWeight:800,color,fontSize:'0.85rem'}}>{fmtS(val,cur)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <h3 style={{fontWeight:800,color:'#374151',margin:'0 0 0.75rem',fontSize:'0.9rem'}}>🗂 Gasto por categoría</h3>
        {catData.map((c,i)=>(
          <div key={c.label} style={{marginBottom:'0.5rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.78rem',marginBottom:'0.2rem'}}>
              <span style={{color:'#374151',fontWeight:600}}>{c.emoji} {c.label}</span>
              <span style={{color:'#6B7280'}}>{fmtS(c.value,cur)} <span style={{color:'#9CA3AF'}}>({c.pct}%)</span></span>
            </div>
            <div style={{background:'#F3F4F6',borderRadius:'999px',height:'6px',overflow:'hidden'}}>
              <div style={{width:`${c.pct}%`,height:'100%',background:PALETTE[i%PALETTE.length],borderRadius:'999px'}}/>
            </div>
          </div>
        ))}
      </div>

      <div style={card}>
        <h3 style={{fontWeight:800,color:'#374151',margin:'0 0 0.75rem',fontSize:'0.9rem'}}>💳 Métodos de pago</h3>
        {pmData.map((p,i)=>(
          <div key={p.name} style={{display:'flex',alignItems:'center',gap:'0.6rem',marginBottom:'0.45rem'}}>
            <div style={{width:'10px',height:'10px',borderRadius:'50%',background:PALETTE[i%PALETTE.length],flexShrink:0}}/>
            <div style={{flex:1,fontSize:'0.78rem',color:'#374151',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
            <div style={{fontSize:'0.78rem',fontWeight:700,color:'#111827',flexShrink:0}}>{fmtS(p.value,cur)}</div>
            <div style={{fontSize:'0.72rem',color:'#9CA3AF',flexShrink:0,width:'2.5rem',textAlign:'right'}}>{p.pct}%</div>
          </div>
        ))}
      </div>

      {period==='Todos'&&perData.length>1&&(
        <div style={card}>
          <h3 style={{fontWeight:800,color:'#374151',margin:'0 0 0.75rem',fontSize:'0.9rem'}}>📈 Evolución por período</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={perData} margin={{top:5,right:5,bottom:30,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
              <XAxis dataKey="period" tick={{fontSize:9,angle:-35,textAnchor:'end',fontFamily:F}} interval={0}/>
              <YAxis tickFormatter={v=>fmtS(v,cur)} tick={{fontSize:9,fontFamily:F}} width={45}/>
              <Tooltip formatter={v=>fmtS(v,cur)}/>
              <Bar dataKey="javi" name="Javi" fill="#3B82F6" stackId="a"/>
              <Bar dataKey="lali" name="Lali" fill="#EC4899" stackId="a" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          <div style={{display:'flex',gap:'1rem',justifyContent:'center',marginTop:'0.4rem'}}>
            {[['Javi','#3B82F6'],['Lali','#EC4899']].map(([n,c])=><div key={n} style={{display:'flex',alignItems:'center',gap:'0.25rem',fontSize:'0.75rem',color:'#374151'}}><div style={{width:'10px',height:'10px',borderRadius:'2px',background:c}}/>{n}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AddEditExpense ────────────────────────────────────────────────────────────
function AddEditExpense({currentUser,settings,allCats,onSubmit,onCancel,initialData=null}) {
  const isEdit=!!initialData;
  const [form,setForm]=useState(initialData||{date:todayStr(),description:'',amount:'',category:allCats[0]||DEFAULT_CATS[0],paymentMethod:PAY_METHODS[0],bank:BANKS[0],paidBy:currentUser,responsible:'Ambos',currency:'ARS',customCurrency:''});
  const [errors,setErrors]=useState({});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const cur=BASE_CURS.includes(form.currency)?form.currency:(form.customCurrency||'ARS');
  const {javiAmount,laliAmount}=calcAmts(form.amount,form.responsible);
  const showSplit=form.amount&&parseFloat(form.amount)>0;

  const submit=()=>{
    const e={};
    if(!form.description.trim()) e.description='Requerido';
    if(!form.amount||parseFloat(form.amount)<=0) e.amount='Monto inválido';
    if(Object.keys(e).length){setErrors(e);return;}
    const finalCur=form.currency==='Otra'?(form.customCurrency||'ARS'):form.currency;
    onSubmit({...form,id:isEdit?form.id:Date.now().toString(),amount:parseFloat(form.amount),javiAmount,laliAmount,currency:finalCur,period:getPeriod(form.date,settings.periods),...(isEdit?{}:{createdBy:currentUser,createdAt:new Date().toISOString()})});
  };

  const inp=(extra={})=>({style:{width:'100%',border:'1px solid #E5E7EB',borderRadius:'0.75rem',padding:'0.75rem',fontSize:'0.9rem',outline:'none',boxSizing:'border-box',fontFamily:F,...extra}});
  const segBtn=(active,color='#6366F1')=>({style:{flex:1,padding:'0.45rem 0.2rem',fontSize:'0.72rem',borderRadius:'0.75rem',border:'1px solid',cursor:'pointer',fontWeight:active?800:500,fontFamily:F,background:active?color:'white',borderColor:active?color:'#E5E7EB',color:active?'white':'#374151',lineHeight:1.3}});
  const Label=({c})=><label style={{fontSize:'0.8rem',color:'#6B7280',fontWeight:700,display:'block',marginBottom:'0.35rem',marginTop:'0.75rem'}}>{c}</label>;
  const selStyle={width:'100%',border:'1px solid #E5E7EB',borderRadius:'0.75rem',padding:'0.75rem',fontSize:'0.9rem',outline:'none',background:'white',boxSizing:'border-box',fontFamily:F};

  return (
    <div style={{padding:'1rem',paddingBottom:'2rem'}}>
      <h2 style={{fontWeight:900,fontSize:'1.2rem',color:'#111827',marginBottom:'0.5rem'}}>{isEdit?'✏️ Editar gasto':'Nuevo gasto'}</h2>

      <Label c="Descripción"/>
      <input {...inp({borderColor:errors.description?'#EF4444':'#E5E7EB'})} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Ej: Almuerzo en Lo de Juan"/>
      {errors.description&&<p style={{color:'#EF4444',fontSize:'0.7rem',margin:'0.15rem 0 0'}}>⚠ {errors.description}</p>}

      <Label c="Monto"/>
      <input {...inp({borderColor:errors.amount?'#EF4444':'#E5E7EB'})} type="number" value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0"/>
      {errors.amount&&<p style={{color:'#EF4444',fontSize:'0.7rem',margin:'0.15rem 0 0'}}>⚠ {errors.amount}</p>}

      <Label c="Moneda"/>
      <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap'}}>
        {[...BASE_CURS,'Otra'].map(c=>(
          <button key={c} onClick={()=>set('currency',c)} style={{padding:'0.4rem 0.85rem',fontSize:'0.78rem',borderRadius:'0.75rem',border:'1px solid',cursor:'pointer',fontWeight:form.currency===c?800:500,fontFamily:F,background:form.currency===c?'#6366F1':'white',borderColor:form.currency===c?'#6366F1':'#E5E7EB',color:form.currency===c?'white':'#374151'}}>{c}</button>
        ))}
      </div>
      {form.currency==='Otra'&&<input {...inp({marginTop:'0.4rem'})} value={form.customCurrency||''} onChange={e=>set('customCurrency',e.target.value.toUpperCase())} placeholder="Ej: BRL, GBP..." maxLength={5}/>}

      <Label c="Fecha"/>
      <input {...inp()} type="date" value={form.date} onChange={e=>set('date',e.target.value)}/>

      <Label c="Categoría"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.4rem'}}>
        {allCats.map(c=>(
          <button key={c} onClick={()=>set('category',c)} style={{padding:'0.4rem 0.2rem',fontSize:'0.7rem',borderRadius:'0.65rem',border:'1px solid',cursor:'pointer',fontFamily:F,background:form.category===c?'#6366F1':'white',borderColor:form.category===c?'#6366F1':'#E5E7EB',color:form.category===c?'white':'#374151',textAlign:'center',lineHeight:1.3,fontWeight:form.category===c?700:400}}>{c}</button>
        ))}
      </div>

      <Label c="Medio de pago"/>
      <select value={form.paymentMethod} onChange={e=>set('paymentMethod',e.target.value)} style={selStyle}>
        {PAY_METHODS.map(m=><option key={m}>{m}</option>)}
      </select>

      <Label c="Banco / Billetera"/>
      <select value={form.bank} onChange={e=>set('bank',e.target.value)} style={selStyle}>
        {BANKS.map(b=><option key={b}>{b}</option>)}
      </select>

      <Label c="¿Quién pagó?"/>
      <div style={{display:'flex',gap:'0.5rem'}}>
        {['Javi','Lali'].map(u=>(<button key={u} {...segBtn(form.paidBy===u,u==='Javi'?'#3B82F6':'#EC4899')} onClick={()=>set('paidBy',u)}>{u==='Javi'?'👨':'👩'} {u}</button>))}
      </div>

      <Label c="¿Quién es responsable?"/>
      <div style={{display:'flex',gap:'0.5rem'}}>
        {['Javi','Ambos','Lali'].map(r=>(<button key={r} {...segBtn(form.responsible===r,'#10B981')} onClick={()=>set('responsible',r)}>{r==='Javi'?'👨 Javi':r==='Lali'?'👩 Lali':'👫 Ambos'}</button>))}
      </div>

      {showSplit&&(
        <div style={{background:'#EEF2FF',borderRadius:'1rem',padding:'0.85rem 1rem',display:'flex',justifyContent:'space-between',marginTop:'0.75rem'}}>
          <div style={{textAlign:'center',flex:1}}><div style={{fontSize:'0.7rem',color:'#6B7280'}}>👨 Javi</div><div style={{fontWeight:800,color:'#4F46E5'}}>{fmt(javiAmount,cur)}</div></div>
          <div style={{width:'1px',background:'#C7D2FE'}}/>
          <div style={{textAlign:'center',flex:1}}><div style={{fontSize:'0.7rem',color:'#6B7280'}}>👩 Lali</div><div style={{fontWeight:800,color:'#DB2777'}}>{fmt(laliAmount,cur)}</div></div>
        </div>
      )}
      {settings.periods?.length>0&&<div style={{textAlign:'center',fontSize:'0.75rem',color:'#9CA3AF',marginTop:'0.5rem'}}>Período: <strong>{getPeriod(form.date,settings.periods)}</strong></div>}

      <button onClick={submit} style={{width:'100%',padding:'1rem',background:'linear-gradient(135deg,#6366F1,#4F46E5)',color:'white',border:'none',borderRadius:'1rem',fontWeight:900,fontSize:'1rem',cursor:'pointer',fontFamily:F,boxShadow:'0 4px 12px rgba(99,102,241,0.4)',marginTop:'1rem'}}>
        {isEdit?'Guardar cambios ✓':'Guardar gasto ✓'}
      </button>
      <button onClick={onCancel} style={{width:'100%',padding:'0.75rem',background:'none',border:'none',color:'#9CA3AF',fontSize:'0.9rem',cursor:'pointer',fontFamily:F,marginTop:'0.25rem'}}>Cancelar</button>
    </div>
  );
}

// ── History ───────────────────────────────────────────────────────────────────
function History({expenses,settings,onDelete,onEdit}) {
  const [openPeriods,setOpenPeriods]=useState(new Set());
  const toggle=p=>setOpenPeriods(prev=>{const n=new Set(prev);n.has(p)?n.delete(p):n.add(p);return n;});

  const grouped={};
  try { expenses.forEach(e=>{const p=e.period||'Sin período';if(!grouped[p])grouped[p]=[];grouped[p].push(e);}); } catch{}

  // Newest first: reverse configured periods, then others
  const configOrder=(settings.periods?.map(p=>p.name)||[]).slice().reverse();
  const sortedPeriods=[...configOrder.filter(p=>grouped[p]),...Object.keys(grouped).filter(p=>!configOrder.includes(p))];

  return (
    <div style={{padding:'1rem',paddingBottom:'2rem'}}>
      <h2 style={{fontWeight:900,fontSize:'1.2rem',color:'#111827',marginBottom:'1rem'}}>Historial</h2>
      {sortedPeriods.length===0
        ?<div style={{textAlign:'center',padding:'3rem',color:'#9CA3AF'}}><div style={{fontSize:'2.5rem',marginBottom:'0.5rem'}}>📋</div>No hay gastos registrados</div>
        :sortedPeriods.map(period=>{
          try {
            const exps=grouped[period]||[];
            const total=exps.reduce((s,e)=>s+safeN(e.amount),0);
            const arsExps=exps.filter(e=>(e.currency||'ARS')==='ARS');
            const bal=calcBal(arsExps);
            const isOpen=openPeriods.has(period);
            return (
              <div key={period} style={{marginBottom:'0.75rem'}}>
                <div onClick={()=>toggle(period)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'white',borderRadius:isOpen?'1rem 1rem 0 0':'1rem',padding:'0.85rem 1rem',boxShadow:'0 1px 4px rgba(0,0,0,0.07)',cursor:'pointer',borderBottom:isOpen?'1px solid #F3F4F6':'none'}}>
                  <div>
                    <div style={{fontWeight:800,color:'#111827',fontSize:'0.9rem'}}>{period}</div>
                    <div style={{fontSize:'0.72rem',color:'#9CA3AF',marginTop:'0.1rem'}}>{exps.length} gastos · {fmt(total)}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                    {Math.abs(bal)>=1?(
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:'0.72rem',fontWeight:800,color:bal>0?'#3B82F6':'#EC4899'}}>{bal>0?'Lali debe':'Javi debe'}</div>
                        <div style={{fontSize:'0.72rem',fontWeight:800,color:bal>0?'#3B82F6':'#EC4899'}}>{fmt(Math.abs(bal))}</div>
                      </div>
                    ):<div style={{fontSize:'0.72rem',color:'#10B981',fontWeight:700}}>✓ Al día</div>}
                    <span style={{color:'#9CA3AF',fontSize:'0.85rem'}}>{isOpen?'▲':'▼'}</span>
                  </div>
                </div>
                {isOpen&&(
                  <div style={{background:'white',borderRadius:'0 0 1rem 1rem',boxShadow:'0 2px 4px rgba(0,0,0,0.07)',overflow:'hidden'}}>
                    {exps.map(e=>{try{return<ExpenseRow key={e.id} expense={e} onDelete={onDelete} onEdit={onEdit}/>;}catch{return null;}})}
                  </div>
                )}
              </div>
            );
          } catch{return null;}
        })
      }
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function Settings({settings,customCats,onSave,onSaveCats}) {
  const [scriptUrl,setScriptUrl]=useState(settings.scriptUrl||'');
  const [periods,setPeriods]=useState(settings.periods||[]);
  const [np,setNp]=useState({name:'',start:'',end:''});
  const [localCats,setLocalCats]=useState(customCats);
  const [newCat,setNewCat]=useState({emoji:'',name:''});
  const [saved,setSaved]=useState(false);

  const save=()=>{onSave({...settings,scriptUrl,periods});onSaveCats(localCats);setSaved(true);setTimeout(()=>setSaved(false),2000);};
  const addPeriod=()=>{if(!np.name||!np.start||!np.end)return;setPeriods(p=>[...p,np]);setNp({name:'',start:'',end:''}); };
  const addCat=()=>{if(!newCat.name.trim())return;setLocalCats(c=>[...c,`${newCat.emoji||'📌'} ${newCat.name.trim()}`]);setNewCat({emoji:'',name:''});};

  const card={background:'white',borderRadius:'1rem',padding:'1rem',boxShadow:'0 1px 4px rgba(0,0,0,0.07)',marginBottom:'1rem'};
  const inp={width:'100%',border:'1px solid #E5E7EB',borderRadius:'0.6rem',padding:'0.5rem 0.75rem',fontSize:'0.85rem',outline:'none',boxSizing:'border-box',fontFamily:F};

  return (
    <div style={{padding:'1rem',paddingBottom:'2rem'}}>
      <h2 style={{fontWeight:900,fontSize:'1.2rem',color:'#111827',marginBottom:'1rem'}}>Configuración</h2>

      <div style={card}>
        <h3 style={{fontWeight:800,color:'#374151',margin:'0 0 0.5rem',fontSize:'0.95rem'}}>🔗 Google Sheets</h3>
        <p style={{fontSize:'0.75rem',color:'#9CA3AF',margin:'0 0 0.6rem'}}>URL del Apps Script para leer y escribir.</p>
        <input style={inp} value={scriptUrl} onChange={e=>setScriptUrl(e.target.value)} placeholder="https://script.google.com/macros/s/..."/>
      </div>

      <div style={card}>
        <h3 style={{fontWeight:800,color:'#374151',margin:'0 0 0.75rem',fontSize:'0.95rem'}}>📅 Períodos de cierre</h3>
        {periods.length===0&&<p style={{fontSize:'0.8rem',color:'#9CA3AF',marginBottom:'0.75rem'}}>No hay períodos configurados.</p>}
        {periods.map((p,i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#F9FAFB',borderRadius:'0.6rem',padding:'0.5rem 0.75rem',marginBottom:'0.4rem'}}>
            <div><div style={{fontWeight:700,fontSize:'0.85rem',color:'#111827'}}>{p.name}</div><div style={{fontSize:'0.7rem',color:'#9CA3AF'}}>{p.start} → {p.end}</div></div>
            <button onClick={()=>setPeriods(ps=>ps.filter((_,idx)=>idx!==i))} style={{background:'none',border:'none',color:'#EF4444',cursor:'pointer',fontSize:'1rem'}}>✕</button>
          </div>
        ))}
        <div style={{borderTop:'1px solid #F3F4F6',paddingTop:'0.75rem',marginTop:'0.5rem'}}>
          <p style={{fontSize:'0.75rem',color:'#9CA3AF',marginBottom:'0.4rem'}}>Agregar período:</p>
          <input style={{...inp,marginBottom:'0.4rem'}} value={np.name} onChange={e=>setNp(p=>({...p,name:e.target.value}))} placeholder="Ej: Mar-Abr 2026"/>
          <div style={{display:'flex',gap:'0.4rem',marginBottom:'0.4rem'}}>
            <input type="date" style={{...inp,flex:1}} value={np.start} onChange={e=>setNp(p=>({...p,start:e.target.value}))}/>
            <input type="date" style={{...inp,flex:1}} value={np.end} onChange={e=>setNp(p=>({...p,end:e.target.value}))}/>
          </div>
          <button onClick={addPeriod} style={{width:'100%',padding:'0.5rem',background:'#6366F1',color:'white',border:'none',borderRadius:'0.6rem',fontWeight:700,fontSize:'0.85rem',cursor:'pointer',fontFamily:F}}>+ Agregar período</button>
        </div>
      </div>

      <div style={card}>
        <h3 style={{fontWeight:800,color:'#374151',margin:'0 0 0.75rem',fontSize:'0.95rem'}}>🏷️ Categorías personalizadas</h3>
        {localCats.length===0&&<p style={{fontSize:'0.8rem',color:'#9CA3AF',marginBottom:'0.6rem'}}>Ninguna aún.</p>}
        <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem',marginBottom:'0.6rem'}}>
          {localCats.map((c,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:'0.3rem',background:'#F3F4F6',borderRadius:'999px',padding:'0.25rem 0.6rem',fontSize:'0.78rem'}}>
              <span>{c}</span>
              <button onClick={()=>setLocalCats(cs=>cs.filter((_,idx)=>idx!==i))} style={{background:'none',border:'none',color:'#9CA3AF',cursor:'pointer',fontSize:'0.75rem',padding:0}}>✕</button>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:'0.4rem'}}>
          <input style={{...inp,width:'3rem',textAlign:'center',padding:'0.5rem'}} value={newCat.emoji} onChange={e=>setNewCat(c=>({...c,emoji:e.target.value}))} placeholder="🏷️"/>
          <input style={{...inp,flex:1}} value={newCat.name} onChange={e=>setNewCat(c=>({...c,name:e.target.value}))} placeholder="Nombre de categoría"/>
          <button onClick={addCat} style={{padding:'0.5rem 0.75rem',background:'#6366F1',color:'white',border:'none',borderRadius:'0.6rem',fontWeight:700,cursor:'pointer',fontFamily:F,flexShrink:0}}>+</button>
        </div>
      </div>

      <button onClick={save} style={{width:'100%',padding:'0.9rem',border:'none',borderRadius:'1rem',fontWeight:900,fontSize:'0.95rem',cursor:'pointer',fontFamily:F,background:saved?'#10B981':'#6366F1',color:'white',transition:'background 0.2s'}}>
        {saved?'✓ Guardado':'Guardar configuración'}
      </button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  useFont();
  const [currentUser,setCurrentUser]=useState(null);
  const [view,setView]=useState('dashboard');
  const [expenses,setExpenses]=useState([]);
  const [settings,setSettings]=useState({scriptUrl:'',periods:[]});
  const [customCats,setCustomCats]=useState([]);
  const [loading,setLoading]=useState(true);
  const [syncing,setSyncing]=useState(false);
  const [syncMsg,setSyncMsg]=useState('');
  const [editingExpense,setEditingExpense]=useState(null);

  const allCats=[...DEFAULT_CATS,...customCats];

  useEffect(()=>{
    setCurrentUser(store.get('usr'));
    setExpenses(store.get('exp',[]));
    setSettings(store.get('cfg',{scriptUrl:'',periods:[]}));
    setCustomCats(store.get('ccats',[]));
    setLoading(false);
  },[]);

  const saveExpenses=exps=>{setExpenses(exps);store.set('exp',exps);};
  const saveCustomCats=cats=>{setCustomCats(cats);store.set('ccats',cats);};
  const selectUser=u=>{setCurrentUser(u);store.set('usr',u);};
  const showMsg=(msg,ms=5000)=>{setSyncMsg(msg);setTimeout(()=>setSyncMsg(''),ms);};

  // Re-assign periods whenever settings change
  const saveSettings=s=>{
    if(s.periods?.length){
      const updated=expenses.map(e=>({...e,period:e.date?getPeriod(e.date,s.periods):(e.period||'Sin período')}));
      saveExpenses(updated);
    }
    setSettings(s);store.set('cfg',s);
  };

  const syncFromSheet=async(silent=false)=>{
    if(!settings.scriptUrl){if(!silent)showMsg('Configurá la URL del Apps Script primero.');return;}
    setSyncing(true);
    try{
      const res=await fetch(settings.scriptUrl,{redirect:'follow'});
      if(!res.ok) throw new Error();
      const data=await res.json();
      if(Array.isArray(data)){
        const localOnly=expenses.filter(e=>!e.fromSheet);
        const sanitized=data.map(e=>sanitize(e,allCats));
        saveExpenses([...localOnly,...sanitized]);
        if(!silent) showMsg(`✓ ${data.length} gastos sincronizados.`);
      } else if(!silent) showMsg('⚠ Respuesta inválida del Sheet.');
    }catch{if(!silent) showMsg('⚠ No se pudo conectar. Verificá la URL.');}
    setSyncing(false);
  };

  const handleAdd=async expense=>{
    const s=sanitize({...expense,id:Date.now().toString()},allCats);
    saveExpenses([s,...expenses.filter(e=>!e.fromSheet),...expenses.filter(e=>e.fromSheet)]);
    if(settings.scriptUrl){setSyncing(true);try{await fetch(settings.scriptUrl,{method:'POST',mode:'no-cors',body:JSON.stringify({action:'add',...s})});}catch{}setSyncing(false);}
    setView('dashboard');
  };

  const handleEdit=async expense=>{
    const s=sanitize(expense,allCats);
    saveExpenses(expenses.map(e=>e.id===s.id?s:e));
    if(settings.scriptUrl&&expense.fromSheet){
      setSyncing(true);
      try{await fetch(settings.scriptUrl,{method:'POST',mode:'no-cors',body:JSON.stringify({action:'edit',...s})});}catch{}
      setSyncing(false);
      setTimeout(()=>syncFromSheet(true),1500);
    }
    setEditingExpense(null);setView('dashboard');
  };

  const handleDelete=async(id,expense)=>{
    saveExpenses(expenses.filter(e=>e.id!==id));
    if(settings.scriptUrl&&expense?.fromSheet){
      setSyncing(true);
      try{await fetch(settings.scriptUrl,{method:'POST',mode:'no-cors',body:JSON.stringify({action:'delete',id,period:expense.period})});}catch{}
      setSyncing(false);
      setTimeout(()=>syncFromSheet(true),1500);
    }
  };

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#9CA3AF',fontFamily:F}}>Cargando...</div>;
  if(!currentUser) return <UserSelect onSelect={selectUser}/>;

  if(editingExpense) return (
    <div style={{minHeight:'100vh',background:'#F9FAFB',maxWidth:'480px',margin:'0 auto',fontFamily:F,overflowY:'auto'}}>
      <AddEditExpense currentUser={currentUser} settings={settings} allCats={allCats} onSubmit={handleEdit} onCancel={()=>setEditingExpense(null)} initialData={{...editingExpense,amount:String(editingExpense.amount)}}/>
    </div>
  );

  const periodName=settings.periods?.length?settings.periods[settings.periods.length-1].name:null;
  const periodExps=periodName?expenses.filter(e=>e.period===periodName):expenses;
  const tabs=[{id:'dashboard',icon:'🏠',label:'Inicio'},{id:'add',icon:'➕',label:'Agregar'},{id:'stats',icon:'📊',label:'Stats'},{id:'history',icon:'📋',label:'Historial'},{id:'settings',icon:'⚙️',label:'Config'}];

  return (
    <div style={{minHeight:'100vh',background:'#F9FAFB',display:'flex',flexDirection:'column',maxWidth:'480px',margin:'0 auto',fontFamily:F}}>
      <div style={{background:'white',borderBottom:'1px solid #F3F4F6',padding:'0.75rem 1rem',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:10,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
        <div>
          <div style={{fontWeight:900,fontSize:'1.05rem',color:'#111827'}}>💑 Javi & Lali</div>
          <div style={{fontSize:'0.75rem',color:'#9CA3AF'}}>Hola, <span style={{fontWeight:900,color:currentUser==='Javi'?'#3B82F6':'#EC4899'}}>{currentUser}</span>{syncing&&<span style={{marginLeft:'0.5rem',color:'#F59E0B'}}>⟳</span>}</div>
        </div>
        <button onClick={()=>{setCurrentUser(null);store.del('usr');}} style={{background:'#F3F4F6',border:'none',borderRadius:'0.5rem',padding:'0.3rem 0.6rem',fontSize:'0.75rem',color:'#6B7280',cursor:'pointer',fontFamily:F}}>Cambiar</button>
      </div>

      {syncMsg&&<div style={{margin:'0.75rem 1rem 0',padding:'0.6rem 0.85rem',background:syncMsg.startsWith('✓')?'#D1FAE5':'#FEF3C7',borderRadius:'0.75rem',fontSize:'0.8rem',color:syncMsg.startsWith('✓')?'#065F46':'#92400E',fontWeight:700}}>{syncMsg}</div>}

      <div style={{flex:1,overflowY:'auto',paddingBottom:'5rem'}}>
        {view==='dashboard'&&<Dashboard expenses={expenses} periodExps={periodExps} settings={settings} onDelete={handleDelete} onEdit={e=>setEditingExpense(e)} onSync={()=>syncFromSheet(false)} syncing={syncing}/>}
        {view==='add'&&<AddEditExpense currentUser={currentUser} settings={settings} allCats={allCats} onSubmit={handleAdd} onCancel={()=>setView('dashboard')}/>}
        {view==='stats'&&<Stats expenses={expenses} settings={settings} allCats={allCats}/>}
        {view==='history'&&<History expenses={expenses} settings={settings} onDelete={handleDelete} onEdit={e=>setEditingExpense(e)}/>}
        {view==='settings'&&<Settings settings={settings} customCats={customCats} onSave={saveSettings} onSaveCats={saveCustomCats}/>}
      </div>

      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'480px',background:'white',borderTop:'1px solid #F3F4F6',display:'flex',boxShadow:'0 -2px 8px rgba(0,0,0,0.06)',zIndex:10}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setView(t.id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'0.5rem 0',border:'none',background:'none',cursor:'pointer',fontFamily:F,color:view===t.id?'#6366F1':'#9CA3AF',fontSize:'0.6rem',fontWeight:view===t.id?900:500,gap:'0.1rem'}}>
            <span style={{fontSize:'1.2rem',lineHeight:1}}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
    </div>
  );
}