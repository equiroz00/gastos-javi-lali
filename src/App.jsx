import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ['🏠 Hogar','🍕 Alimentación','🔑 Arriendo','💡 Servicios Públicos','🚌 Transporte','🎬 Entretenimiento','👥 Amigos','💆 Cuidado Personal','💪 Gimnasio','💊 Farmacia','👶 Hijito','👕 Ropa'];
const PAYMENT_METHODS = ['Efectivo','TC Visa Laura','TC Master Card Laura','TC Visa Extensión','TC Master Card Extensión','Dinero en Cuenta','TC Visa Javi','TC Amex Javi','TC Amex Laura'];
const BANKS = ['Banco Nación','Banco Provincia','Banco Ciudad','Banco Credicoop','Galicia','Macro','Supervielle','Patagonia','Comafi','Hipotecario','Naranja X','Santander','BBVA','HSBC','Itaú','ICBC','Mercado Pago','Ualá','Brubank','Lemon','Personal Pay','Otro'];
const PALETTE = ['#6366F1','#EC4899','#10B981','#F59E0B','#3B82F6','#EF4444','#8B5CF6','#14B8A6','#F97316','#84CC16','#06B6D4','#E879F9'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = n => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0,maximumFractionDigits:0}).format(Math.abs(n));
const fmtShort = n => { const a=Math.abs(n); if(a>=1000000) return `$${(a/1000000).toFixed(1)}M`; if(a>=1000) return `$${(a/1000).toFixed(0)}K`; return `$${Math.round(a)}`; };
const todayStr = () => new Date().toISOString().split('T')[0];

// Normalize category: match sheet category (with or without emoji) to app category
const normalizeCategory = cat => {
  if (!cat || typeof cat !== 'string') return '📦 Otro';
  const exact = CATEGORIES.find(c => c === cat.trim());
  if (exact) return exact;
  const stripped = cat.replace(/^\p{Emoji}\s*/u, '').trim().toLowerCase();
  const match = CATEGORIES.find(c => c.replace(/^\p{Emoji}\s*/u, '').trim().toLowerCase() === stripped);
  return match || cat.trim();
};

// Get just the emoji from a category string
const catEmoji = cat => {
  if (!cat) return '📦';
  const found = CATEGORIES.find(c => c === cat);
  if (found) return found.split(' ')[0];
  // If it starts with an emoji
  const m = cat.match(/^(\p{Emoji})/u);
  return m ? m[1] : '📦';
};

// Get just the text label from a category string
const catLabel = cat => {
  if (!cat) return 'Otro';
  return cat.replace(/^\p{Emoji}\s*/u, '').trim() || cat;
};

const isValidAmount = v => typeof v === 'number' && !isNaN(v) && isFinite(v);

const calcAmounts = (amount, responsible) => {
  const n = parseFloat(amount) || 0;
  if (responsible === 'Javi') return {javiAmount:n, laliAmount:0};
  if (responsible === 'Lali') return {javiAmount:0, laliAmount:n};
  return {javiAmount:n/2, laliAmount:n/2};
};

const calcBalance = exps => exps.reduce((b,e) => {
  const la = isValidAmount(e.laliAmount) ? e.laliAmount : 0;
  const ja = isValidAmount(e.javiAmount) ? e.javiAmount : 0;
  return e.paidBy === 'Javi' ? b + la : b - ja;
}, 0);

const getPeriod = (dateStr, periods) => {
  if (!periods?.length) return 'Sin período';
  const d = new Date(dateStr + 'T12:00:00');
  for (const p of periods) if (d >= new Date(p.start+'T00:00:00') && d <= new Date(p.end+'T23:59:59')) return p.name;
  return periods[periods.length-1].name;
};

// ─── localStorage persistence ────────────────────────────────────────────────
const store = {
  get: (key, fallback=null) => { try { const v=localStorage.getItem(key); return v!=null?JSON.parse(v):fallback; } catch { return fallback; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  del: (key) => { try { localStorage.removeItem(key); } catch {} },
};

// ─── Sanitize expense from sheet ──────────────────────────────────────────────
const sanitizeExpense = e => ({
  ...e,
  description: typeof e.description === 'string' ? e.description : String(e.description || ''),
  amount: parseFloat(e.amount) || 0,
  javiAmount: parseFloat(e.javiAmount) || 0,
  laliAmount: parseFloat(e.laliAmount) || 0,
  category: normalizeCategory(e.category),
  date: typeof e.date === 'string' && e.date.match(/^\d{4}-\d{2}-\d{2}/) ? e.date.substring(0,10) : e.date || '',
  paidBy: e.paidBy === 'Javi' || e.paidBy === 'Edinson' ? 'Javi' : 'Lali',
  responsible: ['Javi','Lali','Ambos'].includes(e.responsible) ? e.responsible : 'Ambos',
});

// ─── UserSelect ───────────────────────────────────────────────────────────────
function UserSelect({onSelect}) {
  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#EEF2FF,#FDF2F8)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',gap:'1.5rem'}}>
      <div style={{textAlign:'center',marginBottom:'1rem'}}>
        <div style={{fontSize:'3.5rem',marginBottom:'0.75rem'}}>💑</div>
        <h1 style={{fontSize:'1.75rem',fontWeight:800,color:'#111827',margin:0}}>Gastos Compartidos</h1>
        <p style={{color:'#6B7280',marginTop:'0.5rem'}}>¿Quién sos?</p>
      </div>
      {['Javi','Lali'].map(u=>(
        <button key={u} onClick={()=>onSelect(u)} style={{width:'100%',maxWidth:'280px',padding:'1.5rem',borderRadius:'1.25rem',color:'white',fontSize:'1.25rem',fontWeight:700,border:'none',cursor:'pointer',background:u==='Javi'?'linear-gradient(135deg,#3B82F6,#6366F1)':'linear-gradient(135deg,#EC4899,#F43F5E)',boxShadow:'0 8px 20px rgba(0,0,0,0.15)'}}>
          {u==='Javi'?'👨':'👩'} {u}
        </button>
      ))}
    </div>
  );
}

// ─── BalanceCard ──────────────────────────────────────────────────────────────
function BalanceCard({balance}) {
  const noDebt=Math.abs(balance)<1, laliOwes=balance>0;
  const bg=noDebt?'linear-gradient(135deg,#10B981,#059669)':laliOwes?'linear-gradient(135deg,#3B82F6,#6366F1)':'linear-gradient(135deg,#EC4899,#F43F5E)';
  return (
    <div style={{margin:'1rem',borderRadius:'1.25rem',padding:'1.25rem 1.5rem',background:bg,color:'white',boxShadow:'0 4px 14px rgba(0,0,0,0.15)'}}>
      <p style={{fontSize:'0.75rem',opacity:0.8,margin:'0 0 0.25rem'}}>Balance del período actual</p>
      {noDebt
        ?<><div style={{fontSize:'1.5rem',fontWeight:800}}>¡Estamos al día! 🎉</div><div style={{fontSize:'0.8rem',opacity:0.85,marginTop:'0.25rem'}}>No hay deudas pendientes</div></>
        :<><div style={{fontSize:'2rem',fontWeight:800}}>{fmt(balance)}</div><div style={{fontSize:'0.85rem',opacity:0.9,marginTop:'0.25rem'}}>{laliOwes?'👩 Lali':'👨 Javi'} le debe a {laliOwes?'👨 Javi':'👩 Lali'}</div></>
      }
    </div>
  );
}

// ─── ExpenseRow ───────────────────────────────────────────────────────────────
function ExpenseRow({expense:e, onDelete}) {
  const [open,setOpen]=useState(false);
  const emoji = catEmoji(e.category);
  const label = catLabel(e.category);
  const amt = isValidAmount(e.amount) ? e.amount : 0;
  const ja  = isValidAmount(e.javiAmount) ? e.javiAmount : 0;
  const la  = isValidAmount(e.laliAmount) ? e.laliAmount : 0;
  return (
    <div onClick={()=>setOpen(!open)} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.75rem 1rem',borderBottom:'1px solid #F3F4F6',cursor:'pointer',background:open?'#FAFAFA':'white'}}>
      <div style={{fontSize:'1.4rem',flexShrink:0,width:'2rem',textAlign:'center'}}>{emoji}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:600,color:'#111827',fontSize:'0.9rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.description||'Sin descripción'}</div>
        <div style={{fontSize:'0.72rem',color:'#9CA3AF',marginTop:'0.1rem'}}>{e.date} · {e.paymentMethod}{e.bank?` · ${e.bank}`:''}</div>
        <div style={{fontSize:'0.72rem',color:'#9CA3AF'}}>
          Pagó: <span style={{fontWeight:600,color:e.paidBy==='Javi'?'#3B82F6':'#EC4899'}}>{e.paidBy}</span>
          {' · '}Resp: <span style={{fontWeight:600,color:'#6B7280'}}>{e.responsible}</span>
          {' · '}<span style={{color:'#9CA3AF'}}>{label}</span>
        </div>
      </div>
      <div style={{textAlign:'right',flexShrink:0}}>
        <div style={{fontWeight:700,color:'#111827',fontSize:'0.95rem'}}>{fmt(amt)}</div>
        <div style={{fontSize:'0.65rem',color:'#9CA3AF'}}>J:{fmt(ja)} / L:{fmt(la)}</div>
      </div>
      {open&&!e.fromSheet&&<button onClick={ev=>{ev.stopPropagation();onDelete(e.id)}} style={{background:'#EF4444',color:'white',border:'none',borderRadius:'0.5rem',padding:'0.3rem 0.5rem',fontSize:'0.75rem',cursor:'pointer',flexShrink:0}}>🗑️</button>}
      {open&&e.fromSheet&&<span style={{fontSize:'0.65rem',color:'#9CA3AF',flexShrink:0}}>📄</span>}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({expenses, periodExps, balance, settings, onDelete, onSync, syncing}) {
  const total = periodExps.reduce((s,e)=>s+(isValidAmount(e.amount)?e.amount:0),0);
  const periodName = settings.periods?.length ? settings.periods[settings.periods.length-1].name : 'Sin configurar';
  return (
    <div>
      <BalanceCard balance={balance}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem',margin:'0 1rem 1rem'}}>
        <div style={{background:'white',borderRadius:'1rem',padding:'0.85rem',boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
          <div style={{fontSize:'0.7rem',color:'#9CA3AF'}}>Total del período</div>
          <div style={{fontWeight:700,color:'#111827',marginTop:'0.2rem'}}>{fmt(total)}</div>
          <div style={{fontSize:'0.7rem',color:'#9CA3AF'}}>{periodExps.length} gastos</div>
        </div>
        <div style={{background:'white',borderRadius:'1rem',padding:'0.85rem',boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
          <div style={{fontSize:'0.7rem',color:'#9CA3AF'}}>Período actual</div>
          <div style={{fontWeight:700,color:'#111827',marginTop:'0.2rem',fontSize:'0.82rem'}}>{periodName}</div>
        </div>
      </div>
      {settings.scriptUrl&&(
        <div style={{margin:'0 1rem 1rem'}}>
          <button onClick={onSync} disabled={syncing} style={{width:'100%',padding:'0.6rem',background:syncing?'#E5E7EB':'#EEF2FF',border:'1px solid #C7D2FE',borderRadius:'0.75rem',color:syncing?'#9CA3AF':'#4F46E5',fontWeight:600,fontSize:'0.85rem',cursor:syncing?'not-allowed':'pointer'}}>
            {syncing?'⟳ Sincronizando...':'☁️ Sincronizar con Google Sheet'}
          </button>
        </div>
      )}
      <div style={{margin:'0 1rem',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
        <h2 style={{fontWeight:600,color:'#374151',fontSize:'0.9rem',margin:0}}>Últimos gastos</h2>
        <span style={{fontSize:'0.7rem',color:'#9CA3AF'}}>tocá para eliminar</span>
      </div>
      {expenses.length===0
        ?<div style={{textAlign:'center',padding:'3rem',color:'#9CA3AF'}}><div style={{fontSize:'2.5rem',marginBottom:'0.5rem'}}>🧾</div>No hay gastos aún</div>
        :<div style={{background:'white',borderRadius:'1rem',margin:'0 1rem',boxShadow:'0 1px 4px rgba(0,0,0,0.07)',overflow:'hidden'}}>
           {expenses.slice(0,10).map(e=><ExpenseRow key={e.id} expense={e} onDelete={onDelete}/>)}
         </div>
      }
    </div>
  );
}

// ─── PeriodFilter ─────────────────────────────────────────────────────────────
function PeriodFilter({periods, selected, onSelect}) {
  return (
    <div style={{display:'flex',gap:'0.4rem',overflowX:'auto',paddingBottom:'0.5rem',marginBottom:'0.75rem',scrollbarWidth:'none'}}>
      {periods.map(p=>(
        <button key={p} onClick={()=>onSelect(p)} style={{flexShrink:0,padding:'0.35rem 0.75rem',borderRadius:'999px',border:'1px solid',fontSize:'0.75rem',cursor:'pointer',fontWeight:selected===p?700:400,background:selected===p?'#6366F1':'white',borderColor:selected===p?'#6366F1':'#E5E7EB',color:selected===p?'white':'#374151',whiteSpace:'nowrap'}}>
          {p}
        </button>
      ))}
    </div>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function Stats({expenses, settings}) {
  const allPeriodNames = [...new Set(expenses.map(e=>e.period).filter(Boolean))];
  const configPeriodNames = settings.periods?.map(p=>p.name)||[];
  const periodNames = ['Todos',...new Set([...configPeriodNames,...allPeriodNames])];
  const [selected, setSelected] = useState('Todos');

  const filtered = selected==='Todos' ? expenses : expenses.filter(e=>e.period===selected);

  if (!filtered.length) return (
    <div style={{padding:'1rem'}}>
      <h2 style={{fontWeight:700,fontSize:'1.2rem',color:'#111827',marginBottom:'0.75rem'}}>📊 Estadísticas</h2>
      <PeriodFilter periods={periodNames} selected={selected} onSelect={setSelected}/>
      <div style={{textAlign:'center',padding:'3rem',color:'#9CA3AF'}}><div style={{fontSize:'2.5rem',marginBottom:'0.5rem'}}>📊</div>No hay datos para mostrar</div>
    </div>
  );

  const safeAmt = e => isValidAmount(e.amount)?e.amount:0;
  const safeJavi = e => isValidAmount(e.javiAmount)?e.javiAmount:0;
  const safeLali = e => isValidAmount(e.laliAmount)?e.laliAmount:0;

  const total     = filtered.reduce((s,e)=>s+safeAmt(e),0);
  const javiTotal = filtered.reduce((s,e)=>s+safeJavi(e),0);
  const laliTotal = filtered.reduce((s,e)=>s+safeLali(e),0);
  const balance   = calcBalance(filtered);
  const javiPaid  = filtered.filter(e=>e.paidBy==='Javi').reduce((s,e)=>s+safeAmt(e),0);
  const laliPaid  = filtered.filter(e=>e.paidBy==='Lali').reduce((s,e)=>s+safeAmt(e),0);

  // By category — use normalized label (no emoji) as key to avoid duplication
  const byCat = {};
  filtered.forEach(e=>{
    const norm = normalizeCategory(e.category);
    const key = catLabel(norm);
    if (!byCat[key]) byCat[key]={label:key,emoji:catEmoji(norm),value:0};
    byCat[key].value += safeAmt(e);
  });
  const catData = Object.values(byCat).sort((a,b)=>b.value-a.value).map(c=>({...c,pct:total>0?Math.round(c.value/total*100):0}));

  // By payment method
  const byPM = {};
  filtered.forEach(e=>{const k=e.paymentMethod||'Otro';byPM[k]=(byPM[k]||0)+safeAmt(e);});
  const pmData = Object.entries(byPM).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value,pct:total>0?Math.round(value/total*100):0}));

  // Evolution by period
  const byPeriod = {};
  filtered.forEach(e=>{const k=e.period||'Sin período';if(!byPeriod[k])byPeriod[k]={period:k,total:0,javi:0,lali:0};byPeriod[k].total+=safeAmt(e);byPeriod[k].javi+=safeJavi(e);byPeriod[k].lali+=safeLali(e);});
  const periodData = Object.values(byPeriod);

  const card = {background:'white',borderRadius:'1rem',padding:'1rem',boxShadow:'0 1px 4px rgba(0,0,0,0.07)',marginBottom:'1rem'};

  return (
    <div style={{padding:'1rem',paddingBottom:'2rem'}}>
      <h2 style={{fontWeight:700,fontSize:'1.2rem',color:'#111827',marginBottom:'0.75rem'}}>📊 Estadísticas</h2>
      <PeriodFilter periods={periodNames} selected={selected} onSelect={setSelected}/>

      {/* Summary */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.6rem',marginBottom:'1rem'}}>
        <div style={{...card,margin:0,background:'linear-gradient(135deg,#EEF2FF,#E0E7FF)'}}>
          <div style={{fontSize:'0.7rem',color:'#6366F1',fontWeight:600}}>TOTAL GASTADO</div>
          <div style={{fontWeight:800,color:'#111827',fontSize:'1.1rem',marginTop:'0.2rem'}}>{fmtShort(total)}</div>
          <div style={{fontSize:'0.7rem',color:'#9CA3AF'}}>{filtered.length} gastos</div>
        </div>
        <div style={{...card,margin:0,background:Math.abs(balance)<1?'linear-gradient(135deg,#D1FAE5,#A7F3D0)':balance>0?'linear-gradient(135deg,#DBEAFE,#BFDBFE)':'linear-gradient(135deg,#FCE7F3,#FBCFE8)'}}>
          <div style={{fontSize:'0.7rem',color:'#374151',fontWeight:600}}>BALANCE</div>
          {Math.abs(balance)<1
            ?<div style={{fontWeight:800,color:'#059669',fontSize:'1rem',marginTop:'0.2rem'}}>¡Al día! 🎉</div>
            :<><div style={{fontWeight:800,color:'#111827',fontSize:'1.1rem',marginTop:'0.2rem'}}>{fmtShort(balance)}</div><div style={{fontSize:'0.7rem',color:'#6B7280'}}>{balance>0?'Lali debe':'Javi debe'}</div></>
          }
        </div>
      </div>

      {/* Who paid */}
      <div style={card}>
        <h3 style={{fontWeight:700,color:'#374151',margin:'0 0 0.75rem',fontSize:'0.9rem'}}>💳 ¿Quién pagó más?</h3>
        <div style={{display:'flex',gap:'0.75rem',marginBottom:'0.75rem'}}>
          {[['Javi','#3B82F6',javiPaid,'👨'],['Lali','#EC4899',laliPaid,'👩']].map(([name,color,val,icon])=>(
            <div key={name} style={{flex:1,background:`${color}15`,borderRadius:'0.75rem',padding:'0.65rem',textAlign:'center'}}>
              <div style={{fontSize:'1.2rem'}}>{icon}</div>
              <div style={{fontWeight:700,color,fontSize:'0.95rem'}}>{fmtShort(val)}</div>
              <div style={{fontSize:'0.7rem',color:'#6B7280'}}>{total>0?Math.round(val/total*100):0}%</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:'0.75rem'}}>
          {[['Javi','#3B82F6',javiTotal,'👨 Responsable'],['Lali','#EC4899',laliTotal,'👩 Responsable']].map(([name,color,val,label])=>(
            <div key={name} style={{flex:1,background:'#F9FAFB',borderRadius:'0.75rem',padding:'0.5rem',textAlign:'center'}}>
              <div style={{fontSize:'0.65rem',color:'#9CA3AF'}}>{label}</div>
              <div style={{fontWeight:700,color,fontSize:'0.85rem'}}>{fmtShort(val)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* By category */}
      <div style={card}>
        <h3 style={{fontWeight:700,color:'#374151',margin:'0 0 0.75rem',fontSize:'0.9rem'}}>🗂 Gasto por categoría</h3>
        {catData.map((c,i)=>(
          <div key={c.label} style={{marginBottom:'0.5rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.78rem',marginBottom:'0.2rem'}}>
              <span style={{color:'#374151',fontWeight:500}}>{c.emoji} {c.label}</span>
              <span style={{color:'#6B7280'}}>{fmtShort(c.value)} <span style={{color:'#9CA3AF'}}>({c.pct}%)</span></span>
            </div>
            <div style={{background:'#F3F4F6',borderRadius:'999px',height:'6px',overflow:'hidden'}}>
              <div style={{width:`${c.pct}%`,height:'100%',background:PALETTE[i%PALETTE.length],borderRadius:'999px'}}/>
            </div>
          </div>
        ))}
      </div>

      {/* Payment methods — table instead of pie to avoid overlap */}
      <div style={card}>
        <h3 style={{fontWeight:700,color:'#374151',margin:'0 0 0.75rem',fontSize:'0.9rem'}}>💳 Métodos de pago</h3>
        {pmData.map((p,i)=>(
          <div key={p.name} style={{display:'flex',alignItems:'center',gap:'0.6rem',marginBottom:'0.45rem'}}>
            <div style={{width:'10px',height:'10px',borderRadius:'50%',background:PALETTE[i%PALETTE.length],flexShrink:0}}/>
            <div style={{flex:1,fontSize:'0.78rem',color:'#374151',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</div>
            <div style={{fontSize:'0.78rem',fontWeight:600,color:'#111827',flexShrink:0}}>{fmtShort(p.value)}</div>
            <div style={{fontSize:'0.72rem',color:'#9CA3AF',flexShrink:0,width:'2.5rem',textAlign:'right'}}>{p.pct}%</div>
          </div>
        ))}
      </div>

      {/* Evolution */}
      {selected==='Todos'&&periodData.length>1&&(
        <div style={card}>
          <h3 style={{fontWeight:700,color:'#374151',margin:'0 0 0.75rem',fontSize:'0.9rem'}}>📈 Evolución por período</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={periodData} margin={{top:5,right:5,bottom:30,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
              <XAxis dataKey="period" tick={{fontSize:9,angle:-35,textAnchor:'end'}} interval={0}/>
              <YAxis tickFormatter={fmtShort} tick={{fontSize:9}} width={40}/>
              <Tooltip formatter={v=>fmtShort(v)}/>
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

// ─── AddExpense ───────────────────────────────────────────────────────────────
function AddExpense({currentUser, settings, onAdd, onCancel}) {
  const [form,setForm]=useState({date:todayStr(),description:'',amount:'',category:CATEGORIES[0],paymentMethod:PAYMENT_METHODS[0],bank:BANKS[0],paidBy:currentUser,responsible:'Ambos'});
  const [errors,setErrors]=useState({});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const {javiAmount,laliAmount}=calcAmounts(form.amount,form.responsible);
  const showSplit=form.amount&&parseFloat(form.amount)>0;
  const submit=()=>{
    const e={};
    if(!form.description.trim()) e.description='Requerido';
    if(!form.amount||parseFloat(form.amount)<=0) e.amount='Ingresá un monto válido';
    if(Object.keys(e).length){setErrors(e);return;}
    onAdd({id:Date.now().toString(),...form,amount:parseFloat(form.amount),javiAmount,laliAmount,period:getPeriod(form.date,settings.periods),createdBy:currentUser,createdAt:new Date().toISOString()});
  };
  const inp=(extra={})=>({style:{width:'100%',border:'1px solid #E5E7EB',borderRadius:'0.75rem',padding:'0.75rem',fontSize:'0.9rem',outline:'none',boxSizing:'border-box',...extra}});
  const segBtn=(active,color='#6366F1')=>({style:{flex:1,padding:'0.5rem 0.2rem',fontSize:'0.75rem',borderRadius:'0.75rem',border:'1px solid',cursor:'pointer',fontWeight:active?600:400,background:active?color:'white',borderColor:active?color:'#E5E7EB',color:active?'white':'#374151',lineHeight:1.3}});
  const Label=({children})=><label style={{fontSize:'0.8rem',color:'#6B7280',fontWeight:500,display:'block',marginBottom:'0.35rem',marginTop:'0.75rem'}}>{children}</label>;
  return(
    <div style={{padding:'1rem',paddingBottom:'2rem'}}>
      <h2 style={{fontWeight:700,fontSize:'1.2rem',color:'#111827',marginBottom:'0.5rem'}}>Nuevo gasto</h2>
      <Label>Descripción</Label>
      <input {...inp({borderColor:errors.description?'#EF4444':'#E5E7EB'})} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Ej: Almuerzo en Lo de Juan"/>
      {errors.description&&<p style={{color:'#EF4444',fontSize:'0.7rem',margin:'0.15rem 0 0'}}>⚠ {errors.description}</p>}
      <Label>Monto (ARS $)</Label>
      <input {...inp({borderColor:errors.amount?'#EF4444':'#E5E7EB'})} type="number" value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0"/>
      {errors.amount&&<p style={{color:'#EF4444',fontSize:'0.7rem',margin:'0.15rem 0 0'}}>⚠ {errors.amount}</p>}
      <Label>Fecha</Label>
      <input {...inp()} type="date" value={form.date} onChange={e=>set('date',e.target.value)}/>
      <Label>Categoría</Label>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.4rem'}}>
        {CATEGORIES.map(c=>(
          <button key={c} onClick={()=>set('category',c)} style={{padding:'0.45rem 0.2rem',fontSize:'0.72rem',borderRadius:'0.65rem',border:'1px solid',cursor:'pointer',background:form.category===c?'#6366F1':'white',borderColor:form.category===c?'#6366F1':'#E5E7EB',color:form.category===c?'white':'#374151',textAlign:'center',lineHeight:1.3}}>{c}</button>
        ))}
      </div>
      <Label>Medio de pago</Label>
      <select value={form.paymentMethod} onChange={e=>set('paymentMethod',e.target.value)} style={{width:'100%',border:'1px solid #E5E7EB',borderRadius:'0.75rem',padding:'0.75rem',fontSize:'0.9rem',outline:'none',background:'white',boxSizing:'border-box'}}>
        {PAYMENT_METHODS.map(m=><option key={m}>{m}</option>)}
      </select>
      <Label>Banco / Billetera</Label>
      <select value={form.bank} onChange={e=>set('bank',e.target.value)} style={{width:'100%',border:'1px solid #E5E7EB',borderRadius:'0.75rem',padding:'0.75rem',fontSize:'0.9rem',outline:'none',background:'white',boxSizing:'border-box'}}>
        {BANKS.map(b=><option key={b}>{b}</option>)}
      </select>
      <Label>¿Quién pagó?</Label>
      <div style={{display:'flex',gap:'0.5rem'}}>
        {['Javi','Lali'].map(u=>(
          <button key={u} {...segBtn(form.paidBy===u,u==='Javi'?'#3B82F6':'#EC4899')} onClick={()=>set('paidBy',u)}>{u==='Javi'?'👨':'👩'} {u}</button>
        ))}
      </div>
      <Label>¿Quién es responsable?</Label>
      <div style={{display:'flex',gap:'0.5rem'}}>
        {['Javi','Ambos','Lali'].map(r=>(
          <button key={r} {...segBtn(form.responsible===r,'#10B981')} onClick={()=>set('responsible',r)}>{r==='Javi'?'👨 Javi':r==='Lali'?'👩 Lali':'👫 Ambos'}</button>
        ))}
      </div>
      {showSplit&&(
        <div style={{background:'#EEF2FF',borderRadius:'1rem',padding:'0.85rem 1rem',display:'flex',justifyContent:'space-between',marginTop:'0.75rem'}}>
          <div style={{textAlign:'center',flex:1}}><div style={{fontSize:'0.7rem',color:'#6B7280'}}>👨 Javi paga</div><div style={{fontWeight:700,color:'#4F46E5'}}>{fmt(javiAmount)}</div></div>
          <div style={{width:'1px',background:'#C7D2FE'}}/>
          <div style={{textAlign:'center',flex:1}}><div style={{fontSize:'0.7rem',color:'#6B7280'}}>👩 Lali paga</div><div style={{fontWeight:700,color:'#DB2777'}}>{fmt(laliAmount)}</div></div>
        </div>
      )}
      {settings.periods?.length>0&&<div style={{textAlign:'center',fontSize:'0.75rem',color:'#9CA3AF',marginTop:'0.5rem'}}>Período: <strong>{getPeriod(form.date,settings.periods)}</strong></div>}
      <button onClick={submit} style={{width:'100%',padding:'1rem',background:'linear-gradient(135deg,#6366F1,#4F46E5)',color:'white',border:'none',borderRadius:'1rem',fontWeight:700,fontSize:'1rem',cursor:'pointer',boxShadow:'0 4px 12px rgba(99,102,241,0.4)',marginTop:'1rem'}}>Guardar gasto ✓</button>
      <button onClick={onCancel} style={{width:'100%',padding:'0.75rem',background:'none',border:'none',color:'#9CA3AF',fontSize:'0.9rem',cursor:'pointer',marginTop:'0.25rem'}}>Cancelar</button>
    </div>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────
function History({expenses, onDelete}) {
  try {
    const grouped = expenses.reduce((g,e)=>{
      try {
        const p = e.period||'Sin período';
        if(!g[p]) g[p]=[];
        g[p].push(e);
      } catch {}
      return g;
    },{});
    const periods = Object.keys(grouped);
    return(
      <div style={{padding:'1rem'}}>
        <h2 style={{fontWeight:700,fontSize:'1.2rem',color:'#111827',marginBottom:'1rem'}}>Historial</h2>
        {periods.length===0
          ?<div style={{textAlign:'center',padding:'3rem',color:'#9CA3AF'}}><div style={{fontSize:'2.5rem',marginBottom:'0.5rem'}}>📋</div>No hay gastos registrados</div>
          :periods.map(period=>{
            try {
              const exps=grouped[period];
              const total=exps.reduce((s,e)=>s+(isValidAmount(e.amount)?e.amount:0),0);
              const bal=calcBalance(exps);
              return(
                <div key={period} style={{marginBottom:'1.25rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:'0.4rem'}}>
                    <h3 style={{fontWeight:600,color:'#374151',fontSize:'0.9rem',margin:0}}>{period}</h3>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:'0.7rem',color:'#9CA3AF'}}>{fmt(total)} · {exps.length} gastos</div>
                      {Math.abs(bal)>=1&&<div style={{fontSize:'0.7rem',fontWeight:600,color:bal>0?'#3B82F6':'#EC4899'}}>{bal>0?'Lali debe':'Javi debe'} {fmt(Math.abs(bal))}</div>}
                    </div>
                  </div>
                  <div style={{background:'white',borderRadius:'1rem',boxShadow:'0 1px 4px rgba(0,0,0,0.07)',overflow:'hidden'}}>
                    {exps.map(e=>{try{return<ExpenseRow key={e.id} expense={e} onDelete={onDelete}/>}catch{return null}})}
                  </div>
                </div>
              );
            } catch { return null; }
          })
        }
      </div>
    );
  } catch(err) {
    return <div style={{padding:'2rem',textAlign:'center',color:'#EF4444'}}>Error al cargar el historial. Por favor sincronizá de nuevo.</div>;
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function Settings({settings, onSave}) {
  const [scriptUrl,setScriptUrl]=useState(settings.scriptUrl||'');
  const [periods,setPeriods]=useState(settings.periods||[]);
  const [np,setNp]=useState({name:'',start:'',end:''});
  const [saved,setSaved]=useState(false);
  const save=async()=>{await onSave({...settings,scriptUrl,periods});setSaved(true);setTimeout(()=>setSaved(false),2000);};
  const addPeriod=()=>{if(!np.name||!np.start||!np.end)return;setPeriods(p=>[...p,np]);setNp({name:'',start:'',end:''});};
  const card={background:'white',borderRadius:'1rem',padding:'1rem',boxShadow:'0 1px 4px rgba(0,0,0,0.07)',marginBottom:'1rem'};
  const inp={width:'100%',border:'1px solid #E5E7EB',borderRadius:'0.6rem',padding:'0.5rem 0.75rem',fontSize:'0.85rem',outline:'none',boxSizing:'border-box'};
  return(
    <div style={{padding:'1rem',paddingBottom:'2rem'}}>
      <h2 style={{fontWeight:700,fontSize:'1.2rem',color:'#111827',marginBottom:'1rem'}}>Configuración</h2>
      <div style={card}>
        <h3 style={{fontWeight:600,color:'#374151',margin:'0 0 0.25rem',fontSize:'0.95rem'}}>🔗 Google Sheets</h3>
        <p style={{fontSize:'0.75rem',color:'#9CA3AF',margin:'0 0 0.75rem'}}>URL del Apps Script para sincronizar.</p>
        <input style={inp} value={scriptUrl} onChange={e=>setScriptUrl(e.target.value)} placeholder="https://script.google.com/macros/s/..."/>
      </div>
      <div style={card}>
        <h3 style={{fontWeight:600,color:'#374151',margin:'0 0 0.75rem',fontSize:'0.95rem'}}>📅 Períodos de cierre</h3>
        {periods.length===0?<p style={{fontSize:'0.8rem',color:'#9CA3AF',marginBottom:'0.75rem'}}>No hay períodos configurados.</p>
          :periods.map((p,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#F9FAFB',borderRadius:'0.6rem',padding:'0.5rem 0.75rem',marginBottom:'0.4rem'}}>
              <div><div style={{fontWeight:600,fontSize:'0.85rem',color:'#111827'}}>{p.name}</div><div style={{fontSize:'0.7rem',color:'#9CA3AF'}}>{p.start} → {p.end}</div></div>
              <button onClick={()=>setPeriods(ps=>ps.filter((_,idx)=>idx!==i))} style={{background:'none',border:'none',color:'#EF4444',cursor:'pointer',fontSize:'1rem'}}>✕</button>
            </div>
          ))
        }
        <div style={{borderTop:'1px solid #F3F4F6',paddingTop:'0.75rem',marginTop:'0.5rem'}}>
          <p style={{fontSize:'0.75rem',color:'#9CA3AF',marginBottom:'0.4rem'}}>Agregar período:</p>
          <input style={{...inp,marginBottom:'0.4rem'}} value={np.name} onChange={e=>setNp(p=>({...p,name:e.target.value}))} placeholder="Nombre (ej: Mar-Abr 2026)"/>
          <div style={{display:'flex',gap:'0.4rem',marginBottom:'0.4rem'}}>
            <input type="date" style={{...inp,flex:1}} value={np.start} onChange={e=>setNp(p=>({...p,start:e.target.value}))}/>
            <input type="date" style={{...inp,flex:1}} value={np.end} onChange={e=>setNp(p=>({...p,end:e.target.value}))}/>
          </div>
          <button onClick={addPeriod} style={{width:'100%',padding:'0.5rem',background:'#6366F1',color:'white',border:'none',borderRadius:'0.6rem',fontWeight:600,fontSize:'0.85rem',cursor:'pointer'}}>+ Agregar período</button>
        </div>
      </div>
      <button onClick={save} style={{width:'100%',padding:'0.9rem',border:'none',borderRadius:'1rem',fontWeight:700,fontSize:'0.95rem',cursor:'pointer',background:saved?'#10B981':'#6366F1',color:'white'}}>{saved?'✓ Guardado':'Guardar configuración'}</button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [currentUser,setCurrentUser]=useState(null);
  const [view,setView]=useState('dashboard');
  const [expenses,setExpenses]=useState([]);
  const [settings,setSettings]=useState({scriptUrl:'',periods:[]});
  const [loading,setLoading]=useState(true);
  const [syncing,setSyncing]=useState(false);
  const [syncMsg,setSyncMsg]=useState('');

  useEffect(()=>{
    const savedUser = store.get('usr');
    const savedExps = store.get('exp', []);
    const savedCfg  = store.get('cfg', {scriptUrl:'',periods:[]});
    if(savedUser) setCurrentUser(savedUser);
    setExpenses(savedExps);
    setSettings(savedCfg);
    setLoading(false);
  },[]);

  const saveExpenses = exps => { setExpenses(exps); store.set('exp', exps); };
  const saveSettings = s   => { setSettings(s);  store.set('cfg', s); return Promise.resolve(); };
  const selectUser   = u   => { setCurrentUser(u); store.set('usr', u); };

  const syncFromSheet = async () => {
    if(!settings.scriptUrl){setSyncMsg('Configurá la URL del Apps Script primero.');return;}
    setSyncing(true);setSyncMsg('');
    try {
      const res = await fetch(settings.scriptUrl, {redirect:'follow'});
      if(!res.ok) throw new Error();
      const data = await res.json();
      if(Array.isArray(data)){
        const sanitized = data.map(sanitizeExpense);
        saveExpenses(sanitized);
        setSyncMsg(`✓ ${sanitized.length} gastos sincronizados.`);
      } else {
        setSyncMsg('⚠ Respuesta inválida del Sheet.');
      }
    } catch {
      setSyncMsg('⚠ No se pudo conectar. Verificá la URL.');
    }
    setSyncing(false);
    setTimeout(()=>setSyncMsg(''),5000);
  };

  const addExpense = async expense => {
    const sanitized = sanitizeExpense(expense);
    const local = expenses.filter(e=>!e.fromSheet);
    const sheet = expenses.filter(e=>e.fromSheet);
    saveExpenses([sanitized,...local,...sheet]);
    if(settings.scriptUrl){
      setSyncing(true);
      try{await fetch(settings.scriptUrl,{method:'POST',mode:'no-cors',body:JSON.stringify(expense)});}catch{}
      setSyncing(false);
    }
    setView('dashboard');
  };

  const deleteExpense = id => saveExpenses(expenses.filter(e=>e.id!==id));

  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#9CA3AF'}}>Cargando...</div>;
  if(!currentUser) return <UserSelect onSelect={selectUser}/>;

  const periodName = settings.periods?.length ? settings.periods[settings.periods.length-1].name : null;
  const periodExps = periodName ? expenses.filter(e=>e.period===periodName) : expenses;
  const balance    = calcBalance(periodExps);

  const tabs=[{id:'dashboard',icon:'🏠',label:'Inicio'},{id:'add',icon:'➕',label:'Agregar'},{id:'stats',icon:'📊',label:'Stats'},{id:'history',icon:'📋',label:'Historial'},{id:'settings',icon:'⚙️',label:'Config'}];

  return(
    <div style={{minHeight:'100vh',background:'#F9FAFB',display:'flex',flexDirection:'column',maxWidth:'480px',margin:'0 auto'}}>
      <div style={{background:'white',borderBottom:'1px solid #F3F4F6',padding:'0.75rem 1rem',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:10,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
        <div>
          <div style={{fontWeight:700,fontSize:'1.05rem',color:'#111827'}}>💑 Javi & Lali</div>
          <div style={{fontSize:'0.75rem',color:'#9CA3AF'}}>Hola, <span style={{fontWeight:600,color:currentUser==='Javi'?'#3B82F6':'#EC4899'}}>{currentUser}</span>{syncing&&<span style={{marginLeft:'0.5rem',color:'#F59E0B'}}>⟳</span>}</div>
        </div>
        <button onClick={()=>{setCurrentUser(null);store.del('usr');}} style={{background:'#F3F4F6',border:'none',borderRadius:'0.5rem',padding:'0.3rem 0.6rem',fontSize:'0.75rem',color:'#6B7280',cursor:'pointer'}}>Cambiar</button>
      </div>
      {syncMsg&&<div style={{margin:'0.75rem 1rem 0',padding:'0.6rem 0.85rem',background:syncMsg.startsWith('✓')?'#D1FAE5':'#FEF3C7',borderRadius:'0.75rem',fontSize:'0.8rem',color:syncMsg.startsWith('✓')?'#065F46':'#92400E'}}>{syncMsg}</div>}
      <div style={{flex:1,overflowY:'auto',paddingBottom:'5rem'}}>
        {view==='dashboard'&&<Dashboard expenses={expenses} periodExps={periodExps} balance={balance} settings={settings} onDelete={deleteExpense} onSync={syncFromSheet} syncing={syncing}/>}
        {view==='add'&&<AddExpense currentUser={currentUser} settings={settings} onAdd={addExpense} onCancel={()=>setView('dashboard')}/>}
        {view==='stats'&&<Stats expenses={expenses} settings={settings}/>}
        {view==='history'&&<History expenses={expenses} onDelete={deleteExpense}/>}
        {view==='settings'&&<Settings settings={settings} onSave={saveSettings}/>}
      </div>
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'480px',background:'white',borderTop:'1px solid #F3F4F6',display:'flex',boxShadow:'0 -2px 8px rgba(0,0,0,0.06)',zIndex:10}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setView(t.id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'0.5rem 0',border:'none',background:'none',cursor:'pointer',color:view===t.id?'#6366F1':'#9CA3AF',fontSize:'0.6rem',fontWeight:view===t.id?700:400,gap:'0.1rem'}}>
            <span style={{fontSize:'1.2rem',lineHeight:1}}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
    </div>
  );
}