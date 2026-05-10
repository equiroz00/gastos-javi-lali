// ── lib/helpers.js ────────────────────────────────────────────────────────────
import { CUR_SYM, PENDING_PER, DEFAULT_CATS } from '../constants.js';

// ── Formatting ────────────────────────────────────────────────────────────────
export function todayStr(){ return new Date().toISOString().split('T')[0]; }
export function fmt(n,c){ var cur=c||'ARS',sym=CUR_SYM[cur]||(cur+' '); return sym+Math.abs(n).toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:0}); }
export function fmtS(n,c){ var cur=c||'ARS',a=Math.abs(n),s=CUR_SYM[cur]||cur; return a>=1e6?s+(a/1e6).toFixed(1)+'M':a>=1e3?s+(a/1e3).toFixed(0)+'K':s+Math.round(a); }
export function safeN(v){ var n=parseFloat(v); return (isFinite(n)&&!isNaN(n))?n:0; }
export function catEm(cat){ if(!cat)return'📦'; var m=cat.match(/^(\p{Emoji})/u); return m?m[1]:'📦'; }
export function catLb(cat){ return cat?(cat.replace(/^\p{Emoji}\s*/u,'').trim()||cat):'Otro'; }
export function normCat(cat,cats){
  if(!cat||typeof cat!=='string')return'📦 Otro';
  var exact=cats.find(function(c){return c===cat.trim();}); if(exact)return exact;
  var s=cat.replace(/^\p{Emoji}\s*/u,'').trim().toLowerCase();
  var m=cats.find(function(c){return c.replace(/^\p{Emoji}\s*/u,'').trim().toLowerCase()===s;});
  return m||cat.trim();
}
export function sortByDate(exps){ return exps.slice().sort(function(a,b){return (b.date||'').localeCompare(a.date||'');}); }
export function pctChange(cur,prev){ return prev===0?null:Math.round((cur-prev)/prev*100); }
export function getWeekStart(){ var d=new Date(),day=d.getDay(),diff=day===0?-6:1-day; d.setDate(d.getDate()+diff); d.setHours(0,0,0,0); return d; }

// ── Calculations ──────────────────────────────────────────────────────────────
export function calcAmts(amt,resp){ var n=safeN(amt); if(resp==='Javi')return{javiAmount:n,laliAmount:0}; if(resp==='Lali')return{javiAmount:0,laliAmount:n}; return{javiAmount:n/2,laliAmount:n/2}; }
export function calcBal(exps){ return exps.reduce(function(b,e){ return e.paidBy==='Javi'?b+safeN(e.laliAmount):b-safeN(e.javiAmount); },0); }
export function calcNetBal(exps,payments,currency){
  var gross=calcBal(exps.filter(function(e){return (e.currency||'ARS')===currency;}));
  var adj=(payments||[]).filter(function(p){return (p.currency||'ARS')===currency;})
    .reduce(function(sum,p){return p.from==='Lali'?sum-safeN(p.amount):sum+safeN(p.amount);},0);
  return gross+adj;
}
export function lastPayment(payments,currency){
  var inCur=(payments||[]).filter(function(p){return (p.currency||'ARS')===currency;});
  if(!inCur.length)return null;
  return inCur.slice().sort(function(a,b){return (b.date||'').localeCompare(a.date||'');})[0];
}
export function getPeriod(d,ps){ if(!ps||!ps.length)return'Sin período'; var dt=new Date(d+'T12:00:00'); for(var i=0;i<ps.length;i++){if(dt>=new Date(ps[i].start+'T00:00:00')&&dt<=new Date(ps[i].end+'T23:59:59'))return ps[i].name;} return'Sin período'; }

// ── Plans ─────────────────────────────────────────────────────────────────────
export function generatePlanExpenses(plan,periods){
  var paid=plan.paidInstallments||0;
  var remaining=plan.numInstallments-paid;
  var startIdx=periods.findIndex(function(p){return p.name===plan.startPeriod;});
  var result=[];
  for(var i=0;i<remaining;i++){
    var cuotaNum=paid+i+1;
    var targetIdx=startIdx+i;
    var period=(startIdx>=0&&targetIdx<periods.length)?periods[targetIdx].name:PENDING_PER;
    result.push({id:plan.id+'-'+cuotaNum,description:plan.description+' (cuota '+cuotaNum+'/'+plan.numInstallments+')',amount:plan.installmentAmount,javiAmount:plan.javiAmount,laliAmount:plan.laliAmount,currency:plan.currency,paidBy:plan.paidBy,responsible:plan.responsible,paymentMethod:plan.paymentMethod,bank:plan.bank,category:plan.category,date:plan.startDate,period:period,planId:plan.id,installmentNum:cuotaNum,numInstallments:plan.numInstallments,fromPlan:true});
  }
  return result;
}
export function reassignPlanExpenses(exps,periods,plans){
  return exps.map(function(e){
    if(!e.fromPlan)return e;
    var plan=plans.find(function(p){return p.id===e.planId;}); if(!plan)return e;
    var paid=plan.paidInstallments||0;
    var startIdx=periods.findIndex(function(p){return p.name===plan.startPeriod;});
    var posInRemaining=e.installmentNum-paid-1;
    var targetIdx=startIdx+posInRemaining;
    var period=(startIdx>=0&&posInRemaining>=0&&targetIdx<periods.length)?periods[targetIdx].name:PENDING_PER;
    return Object.assign({},e,{period:period});
  });
}

// ── Sanitize ──────────────────────────────────────────────────────────────────
export function sanitize(e,cats){
  var allCats=cats||DEFAULT_CATS;
  var date=(typeof e.date==='string'&&e.date.match(/^\d{4}-\d{2}-\d{2}/))?e.date.substring(0,10):(e.date||todayStr());
  var paidBy=(e.paidBy==='Javi'||e.paidBy==='Edinson')?'Javi':'Lali';
  var responsible=['Javi','Lali','Ambos'].indexOf(e.responsible)>=0?e.responsible:'Ambos';
  return Object.assign({},e,{description:String(e.description||''),amount:safeN(e.amount),javiAmount:safeN(e.javiAmount),laliAmount:safeN(e.laliAmount),category:normCat(e.category,allCats),currency:e.currency||'ARS',date:date,paidBy:paidBy,responsible:responsible});
}
