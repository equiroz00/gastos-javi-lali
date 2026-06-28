// ── components/AddEditExpense.tsx ─────────────────────────────────────────────
import React, { useState } from 'react';
import { Plus, X, Pencil, AlertTriangle } from 'lucide-react';
import { C, F, MONO, FS, DEFAULT_CATS, PAY_METHODS, BANKS, BASE_CURS, CUOTA_OPTS } from '../constants';
import { todayStr, fmt, safeN, calcAmts, getPeriod, sanitize, genId } from '../lib/helpers';
import { CatIcon, SegBtn } from './ui';
import useAppStore from '../store/useAppStore';
import { useExpenses } from '../lib/queries';
import SplitModal from './SplitModal';
import type { Expense, UserName, Responsible, Plan } from '../types';

// Estado del formulario: como Expense pero con amount editable como string.
interface FormState {
  id?: string;
  date: string;
  description: string;
  amount: string | number;
  category: string;
  paymentMethod: string;
  bank: string;
  paidBy: UserName;
  responsible: Responsible;
  currency: string;
  customCurrency?: string;
  javiAmount: number;
  laliAmount: number;
  notes?: string;
  createdBy?: UserName;
  createdAt?: string;
}

interface AddEditExpenseProps {
  isEditMode?: boolean;
  initialData?: FormState | null;
  editingPlan?: Plan | null;
}

export default function AddEditExpense({ isEditMode = false, initialData = null, editingPlan = null }: AddEditExpenseProps) {
  const currentUser       = useAppStore(s => s.currentUser);
  const settings          = useAppStore(s => s.settings);
  const customCats        = useAppStore(s => s.customCats);
  const expenses          = useExpenses();
  const saveCustomCats    = useAppStore(s => s.saveCustomCats);
  const handleAdd         = useAppStore(s => s.handleAdd);
  const handleAddMultiple = useAppStore(s => s.handleAddMultiple);
  const handleEdit        = useAppStore(s => s.handleEdit);
  const handleAddPlan     = useAppStore(s => s.handleAddPlan);
  const handleEditPlan    = useAppStore(s => s.handleEditPlan);
  const setView           = useAppStore(s => s.setView);
  const setEditingExpense = useAppStore(s => s.setEditingExpense);
  const setEditingPlan    = useAppStore(s => s.setEditingPlan);

  const isPlanEdit = !!editingPlan;
  const allCats = DEFAULT_CATS.concat(customCats);

  function blankForm(): FormState {
    return {
      date: todayStr(), description: '', amount: '', category: allCats[0] || DEFAULT_CATS[0],
      paymentMethod: PAY_METHODS[0], bank: BANKS[0], paidBy: (currentUser || 'Javi') as UserName,
      responsible: 'Ambos', currency: 'ARS', customCurrency: '', javiAmount: 0, laliAmount: 0, notes: '',
    };
  }

  // Prefill del formulario al editar un plan "madre"
  function planToForm(p: Plan): FormState {
    const isBase = BASE_CURS.indexOf(p.currency) >= 0;
    return {
      id: p.id, date: p.startDate, description: p.description, amount: String(p.totalAmount),
      category: p.category, paymentMethod: p.paymentMethod, bank: p.bank, paidBy: p.paidBy,
      responsible: p.responsible, currency: isBase ? p.currency : 'Otra',
      customCurrency: isBase ? '' : String(p.currency), javiAmount: 0, laliAmount: 0, notes: '',
    };
  }

  const planHasPaid  = !!(editingPlan && editingPlan.paidInstallments > 0);
  const planIsCustom = !!(editingPlan && CUOTA_OPTS.indexOf(editingPlan.numInstallments) < 0);

  const [form, setForm]                   = useState<FormState>(editingPlan ? planToForm(editingPlan) : (initialData || blankForm()));
  const [errors, setErrors]               = useState<Record<string, string>>({});
  const [step, setStep]                   = useState(isEditMode ? 2 : 1);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showNewCat, setShowNewCat]       = useState(false);
  const [newCatName, setNewCatName]       = useState('');
  const [useCuotas, setUseCuotas]         = useState(isPlanEdit);
  const [numCuotas, setNumCuotas]         = useState(editingPlan && !planIsCustom ? editingPlan.numInstallments : 12);
  const [customCuotas, setCustomCuotas]   = useState(editingPlan && planIsCustom ? String(editingPlan.numInstallments) : '');
  const [isRetro, setIsRetro]             = useState(planHasPaid);
  const [retroPaid, setRetroPaid]         = useState(planHasPaid ? String(editingPlan!.paidInstallments) : '');
  const [retroStartPer, setRetroStartPer] = useState(planHasPaid ? editingPlan!.startPeriod : '');
  const [queue, setQueue]                 = useState<Expense[]>([]);
  const [dupWarning, setDupWarning]       = useState<Expense | null>(null);

  // ── Autocomplete ──────────────────────────────────────────────────────────
  const [acSuggestions, setAcSuggestions] = useState<Expense[]>([]);

  function onDescriptionChange(val: string) {
    set('description', val);
    setErrors({});
    const q = val.trim().toLowerCase();
    if (q.length < 2) { setAcSuggestions([]); return; }
    // Deduplicate by description — keep the most recent occurrence of each
    const seen: Record<string, boolean> = {};
    const matches: Expense[] = [];
    expenses
      .filter(e => (e.description || '').toLowerCase().indexOf(q) >= 0)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .forEach(e => {
        const key = (e.description || '').toLowerCase();
        if (!seen[key]) { seen[key] = true; matches.push(e); }
      });
    setAcSuggestions(matches.slice(0, 6));
  }

  function onAcSelect(exp: Expense) {
    // Complete only description, category and currency
    setForm(f => ({
      ...f,
      description: exp.description,
      category:    exp.category || f.category,
      currency:    exp.currency || f.currency,
    }));
    setAcSuggestions([]);
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  const periods        = settings.periods || [];
  const finalCuotas    = customCuotas ? (parseInt(customCuotas) || numCuotas) : numCuotas;
  const paidNum        = isRetro ? (parseInt(retroPaid) || 0) : 0;
  const remaining      = finalCuotas - paidNum;
  const cur            = BASE_CURS.indexOf(form.currency) >= 0 ? form.currency : (form.customCurrency || 'ARS');
  const totalAmt       = parseFloat(String(form.amount)) || 0;
  const showSplit      = totalAmt > 0;
  const installmentAmt = showSplit && useCuotas ? Math.round(totalAmt / finalCuotas) : 0;
  const btnLabel       = isEditMode
    ? 'Guardar cambios ✓'
    : isPlanEdit
      ? 'Guardar cambios del plan ✓'
    : useCuotas
      ? 'Registrar ' + remaining + ' cuota' + (remaining !== 1 ? 's' : '') + ' ✓'
      : queue.length > 0
        ? 'Guardar ' + (queue.length + 1) + ' gastos ✓'
        : 'Guardar gasto ✓';

  // Derive displayed split amounts — use stored values if manually set, else calculate
  let javiAmt = safeN(form.javiAmount);
  let laliAmt = safeN(form.laliAmount);
  // If both are 0 (new form) derive from responsible
  if (javiAmt === 0 && laliAmt === 0 && totalAmt > 0) {
    const derived = calcAmts(totalAmt, form.responsible);
    javiAmt = derived.javiAmount;
    laliAmt = derived.laliAmount;
  }
  const javiPct = totalAmt > 0 ? Math.round(javiAmt / totalAmt * 100) : 50;

  // Split button summary label
  const splitSummary = ' ' + form.paidBy + ' · ' + javiPct + '% / ' + (100 - javiPct) + '%';

  const inpStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    width:'100%', border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.75rem',
    fontSize:'0.9rem', outline:'none', boxSizing:'border-box', fontFamily:F, color:C.navy,
    background:C.surface, ...extra,
  });
  const selStyle: React.CSSProperties = {
    width:'100%', border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.75rem',
    fontSize:'0.9rem', outline:'none', background:C.surface, boxSizing:'border-box',
    fontFamily:F, color:C.navy,
  };
  const Lbl = ({ children }: { children: React.ReactNode }) => (
    <label style={{ fontSize:'0.8rem', color:C.textMuted, fontWeight:700, display:'block', marginBottom:'0.35rem', marginTop:'0.75rem' }}>{children}</label>
  );

  function addNewCat() {
    if (!newCatName.trim()) return;
    const cat = newCatName.trim();
    saveCustomCats(customCats.concat([cat]));
    set('category', cat); setNewCatName(''); setShowNewCat(false);
  }

  function onSplitConfirm(paidBy: string, javiAmount: number, laliAmount: number, responsible: string) {
    setForm(f => ({ ...f, paidBy: paidBy as UserName, javiAmount, laliAmount, responsible: responsible as Responsible }));
    setShowSplitModal(false);
  }

  // When amount changes, reset stored split and check for duplicates
  function onAmountChange(val: string) {
    setForm(f => ({ ...f, amount: val, javiAmount: 0, laliAmount: 0 }));
    setErrors({});
    const n = Math.round(safeN(val));
    if (n <= 0) { setDupWarning(null); return; }
    const cur2 = BASE_CURS.indexOf(form.currency) >= 0 ? form.currency : (form.customCurrency || 'ARS');
    const currentPeriod = getPeriod(form.date, periods);

    // Filter candidate expenses: same rounded amount + same currency + not self (edit mode)
    const candidates = expenses.filter(e =>
      Math.round(safeN(e.amount)) === n
      && (e.currency || 'ARS') === cur2
      && !e.fromPlan
      && (!isEditMode || e.id !== (initialData && initialData.id))
    );

    if (!candidates.length) { setDupWarning(null); return; }

    // Primary check: same period
    let match: Expense | null = null;
    if (currentPeriod && currentPeriod !== 'Sin período') {
      match = candidates.find(e => e.period === currentPeriod) || null;
    }

    // Fallback: if period is not configured or no match, check last 60 days
    if (!match) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 60);
      match = candidates.find(e => e.date && new Date(e.date + 'T12:00:00') >= cutoff) || null;
    }

    setDupWarning(match);
  }

  function buildBase(id: string): Expense {
    return {
      ...form,
      id,
      amount: totalAmt,
      javiAmount: javiAmt,
      laliAmount: laliAmt,
      currency: form.currency === 'Otra' ? (form.customCurrency || 'ARS') : form.currency,
      period: getPeriod(form.date, periods),
    } as Expense;
  }

  function enqueue() {
    const e: Record<string, string> = {};
    if (!form.description.trim()) e.description = 'Requerido';
    if (!form.amount || parseFloat(String(form.amount)) <= 0) e.amount = 'Monto inválido';
    if (Object.keys(e).length) { setErrors(e); return; }
    const item = sanitize({
      ...buildBase(genId()),
      createdBy: currentUser || undefined,
      createdAt: new Date().toISOString(),
    }, allCats);
    setQueue(q => [...q, item]);
    setForm(f => ({ ...f, description: '', amount: '', javiAmount: 0, laliAmount: 0 }));
    setErrors({});
  }

  function goToStep2() {
    const e: Record<string, string> = {};
    if (!form.description.trim()) e.description = 'Requerido';
    if (!form.amount || parseFloat(String(form.amount)) <= 0) e.amount = 'Monto inválido';
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); setStep(2);
  }

  function submit() {
    const e: Record<string, string> = {};
    if (!form.description.trim()) e.description = 'Requerido';
    if (!form.amount || parseFloat(String(form.amount)) <= 0) e.amount = 'Monto inválido';
    if (useCuotas && isRetro && paidNum >= finalCuotas) e.retroPaid = 'Las cuotas ya pagadas deben ser menos que el total.';
    if (useCuotas && isRetro && !retroStartPer) e.retroStartPer = 'Seleccioná el período inicial.';
    if (Object.keys(e).length) { setErrors(e); return; }
    const base = buildBase(isEditMode ? ((initialData && initialData.id) || genId()) : genId());
    if (!isEditMode && !isPlanEdit) {
      base.createdBy = currentUser || undefined;
      base.createdAt = new Date().toISOString();
    }
    if (isPlanEdit) { handleEditPlan(editingPlan!.id, base, finalCuotas, isRetro ? paidNum : 0, isRetro ? retroStartPer : null); }
    else if (isEditMode) { handleEdit(base); }
    else if (useCuotas && finalCuotas > 1) { handleAddPlan(base, finalCuotas, isRetro ? paidNum : 0, isRetro ? retroStartPer : null); }
    else if (queue.length > 0) { handleAddMultiple([...queue, sanitize({ ...base, id: genId() }, allCats)]); }
    else { handleAdd(base); }
  }

  function cancel() {
    if (isEditMode) setEditingExpense(null);
    else if (isPlanEdit) setEditingPlan(null);
    else setView('dashboard');
  }

  // ── Autocomplete dropdown ──────────────────────────────────────────────────
  const acDropdown = acSuggestions.length > 0 ? (
    <div style={{ position:'relative', zIndex:50 }}>
      <div style={{ position:'absolute', top:'0.1rem', left:0, right:0, background:C.surface, border:'1px solid '+C.border, borderRadius:'0.75rem', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.4rem 0.75rem', borderBottom:'1px solid '+C.border, background:C.bg }}>
          <span style={{ fontSize:'0.68rem', color:C.textMuted, fontWeight:700 }}>Gastos anteriores similares</span>
          <button onClick={() => setAcSuggestions([])} style={{ background:'none', border:'none', cursor:'pointer', color:C.textMuted, lineHeight:1, padding:'0.1rem 0.2rem', display:'flex', alignItems:'center' }}>
            <X size={15} strokeWidth={2} />
          </button>
        </div>
        {acSuggestions.map(exp => (
          <button
            key={exp.id}
            onMouseDown={e => { e.preventDefault(); onAcSelect(exp); }}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.55rem 0.75rem', background:'none', border:'none', borderBottom:'1px solid '+C.border, cursor:'pointer', textAlign:'left', fontFamily:F }}
          >
            <CatIcon category={exp.category} size={16} color={C.navy} style={{ flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'0.82rem', fontWeight:700, color:C.navy, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{exp.description}</div>
              <div style={{ fontSize:'0.68rem', color:C.textMuted, marginTop:'0.05rem' }}>
                {exp.date} · {fmt(safeN(exp.amount), exp.currency || 'ARS')} · {exp.paidBy}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  ) : null;

  // ── Description field (with autocomplete) ─────────────────────────────────
  const descField = (showError: boolean) => (
    <div style={{ position:'relative' }}>
      <input
        style={inpStyle({ borderColor: showError && errors.description ? '#c0314f' : C.border })}
        value={form.description}
        onChange={e => onDescriptionChange(e.target.value)}
        onBlur={() => setTimeout(() => setAcSuggestions([]), 150)}
        placeholder="Ej: Almuerzo en Lo de Juan"
        autoComplete="off"
      />
      {acDropdown}
    </div>
  );

  // ── Split button ──────────────────────────────────────────────────────────
  const splitButton = (
    <button
      onClick={() => setShowSplitModal(true)}
      style={{ width:'100%', background:C.bg, border:'1px solid '+C.border, borderRadius:'0.85rem', padding:'0.65rem 0.85rem', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', fontFamily:F, marginTop:'0.75rem' }}
    >
      <span style={{ fontSize:'0.8rem', fontWeight:700, color:C.navy }}>¿Cómo se divide?</span>
      <span style={{ fontSize:'0.72rem', color:C.textMuted }}>{splitSummary} ›</span>
    </button>
  );

  // ── Split preview ─────────────────────────────────────────────────────────
  const splitPreview = showSplit ? (
    <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.4rem', padding:'0.5rem 0.6rem', background:C.bg, borderRadius:'0.65rem', border:'1px solid '+C.border }}>
      <div style={{ flex:1, textAlign:'center' }}>
        <div style={{ fontSize:'0.65rem', color:C.textMuted }}>Javi</div>
        <div style={{ fontWeight:800, color:C.navy, fontSize:'0.85rem' }}>{fmt(javiAmt, cur)}</div>
      </div>
      <div style={{ width:'1px', background:C.border }} />
      <div style={{ flex:1, textAlign:'center' }}>
        <div style={{ fontSize:'0.65rem', color:C.textMuted }}>Lali</div>
        <div style={{ fontWeight:800, color:C.accent, fontSize:'0.85rem' }}>{fmt(laliAmt, cur)}</div>
      </div>
    </div>
  ) : null;

  // ── Queue section ─────────────────────────────────────────────────────────
  const queueSection = queue.length > 0 ? (
    <div style={{ marginTop:'0.75rem', background:C.bg, borderRadius:'0.85rem', border:'1px solid '+C.border, overflow:'hidden' }}>
      <div style={{ padding:'0.5rem 0.85rem', fontSize:'0.72rem', fontWeight:700, color:C.textMuted, borderBottom:'1px solid '+C.border }}>
        {queue.length} gasto{queue.length !== 1 ? 's' : ''} en cola
      </div>
      {queue.map((item, i) => (
        <div key={item.id} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.5rem 0.85rem', borderBottom:i < queue.length - 1 ? '1px solid '+C.border : 'none' }}>
          <CatIcon category={item.category} size={15} color={C.navy} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:'0.82rem', color:C.navy, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.description}</div>
            <div style={{ fontSize:'0.68rem', color:C.textMuted }}>{fmt(safeN(item.amount), item.currency || 'ARS')}</div>
          </div>
          <button onClick={() => setQueue(q => q.filter((_, j) => j !== i))} style={{ background:'none', border:'none', color:C.danger, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center' }}>
            <X size={15} strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  ) : null;

  // ── Paso 1 ────────────────────────────────────────────────────────────────
  const step1 = (
    <div>
      <div style={{ fontSize:'0.7rem', color:C.textMuted, fontWeight:700, textAlign:'center', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'1rem' }}>{isPlanEdit ? 'Editar plan — Lo esencial' : 'Paso 1 de 2 — Lo esencial'}</div>
      <Lbl>Descripción</Lbl>
      {descField(true)}
      {errors.description && <p style={{ color:C.danger, fontSize:'0.7rem', margin:'0.15rem 0 0' }}>⚠ {errors.description}</p>}
      <Lbl>Monto total</Lbl>
      <input
        style={inpStyle({ borderColor: errors.amount ? '#c0314f' : C.border, background:C.accent + '12', fontSize:FS.amount, fontWeight:800, textAlign:'center', fontFamily:MONO, padding:'0.85rem', letterSpacing:'-0.02em' })}
        type="number"
        value={form.amount}
        onChange={e => { onAmountChange(e.target.value); setErrors({}); }}
        placeholder="0"
      />
      {errors.amount && <p style={{ color:C.danger, fontSize:'0.7rem', margin:'0.15rem 0 0' }}>⚠ {errors.amount}</p>}

      {/* ── Duplicate warning ── */}
      {dupWarning && (
        <div style={{ marginTop:'0.5rem', background:'#fef9c3', border:'1px solid #fde047', borderRadius:'0.75rem', padding:'0.6rem 0.85rem', display:'flex', gap:'0.5rem', alignItems:'flex-start' }}>
          <AlertTriangle size={16} strokeWidth={2} color="#b45309" style={{ flexShrink:0 }} />
          <div>
            <div style={{ fontSize:'0.78rem', fontWeight:800, color:'#854d0e' }}>Posible gasto duplicado</div>
            <div style={{ fontSize:'0.72rem', color:'#92400e', marginTop:'0.15rem' }}>
              "{dupWarning.description}" · {dupWarning.date} · {dupWarning.paidBy}
            </div>
            <button onClick={() => setDupWarning(null)} style={{ marginTop:'0.3rem', background:'none', border:'none', fontSize:'0.68rem', color:'#92400e', cursor:'pointer', padding:0, fontWeight:700, fontFamily:F }}>
              Ignorar y continuar →
            </button>
          </div>
        </div>
      )}

      <Lbl>Moneda</Lbl>
      <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
        {BASE_CURS.concat(['Otra']).map(c => (
          <button
            key={c}
            onClick={() => set('currency', c)}
            style={{ padding:'0.4rem 0.85rem', fontSize:'0.78rem', borderRadius:'0.75rem', border:'1px solid', cursor:'pointer', fontWeight:form.currency === c ? 800 : 500, fontFamily:F, background:form.currency === c ? C.navy : 'transparent', borderColor:form.currency === c ? C.navy : C.border, color:form.currency === c ? C.onNavy : C.navy }}
          >
            {c}
          </button>
        ))}
      </div>
      {form.currency === 'Otra' && (
        <input
          style={inpStyle({ marginTop:'0.4rem' })}
          value={form.customCurrency || ''}
          onChange={e => set('customCurrency', e.target.value.toUpperCase())}
          placeholder="Ej: BRL, GBP..."
          maxLength={5}
        />
      )}

      <Lbl>Fecha</Lbl>
      <input style={inpStyle()} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
      {periods.length > 0 && (
        <div style={{ textAlign:'center', fontSize:'0.75rem', color:C.textMuted, marginTop:'0.5rem' }}>
          Período: <strong style={{ color:C.navy }}>{getPeriod(form.date, periods)}</strong>
        </div>
      )}

      {splitButton}
      {splitPreview}
      {queueSection}

      <button onClick={submit} style={{ width:'100%', padding:'1rem', background:C.gradMain, color:C.white, border:'none', borderRadius:'1rem', fontWeight:900, fontSize:'1rem', cursor:'pointer', fontFamily:F, boxShadow:'0 4px 12px rgba(0,0,0,0.15)', marginTop:'1rem' }}>{btnLabel}</button>
      {!isPlanEdit && (
        <button onClick={enqueue} style={{ width:'100%', padding:'0.75rem', background:'transparent', border:'1px dashed '+C.accent, borderRadius:'1rem', color:C.accent, fontWeight:700, fontSize:'0.88rem', cursor:'pointer', fontFamily:F, marginTop:'0.5rem' }}>+ Agregar otro gasto</button>
      )}
      <button onClick={goToStep2} style={{ width:'100%', padding:'0.75rem', background:'transparent', border:'1px solid '+C.border, borderRadius:'1rem', color:C.navy, fontWeight:700, fontSize:'0.88rem', cursor:'pointer', fontFamily:F, marginTop:'0.5rem' }}>{isPlanEdit ? 'Configurar cuotas y detalles' : 'Más detalles'}</button>
      <button onClick={cancel} style={{ width:'100%', padding:'0.6rem', background:'none', border:'none', color:C.textMuted, fontSize:'0.85rem', cursor:'pointer', fontFamily:F, marginTop:'0.1rem' }}>Cancelar</button>
    </div>
  );

  // ── Paso 2 ────────────────────────────────────────────────────────────────
  const step2 = (
    <div>
      <div style={{ fontSize:'0.7rem', color:C.textMuted, fontWeight:700, textAlign:'center', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'0.75rem' }}>
        {isEditMode ? 'Editar gasto' : isPlanEdit ? 'Editar plan — Cuotas y detalles' : 'Paso 2 de 2 — Detalles'}
      </div>

      {isEditMode ? (
        <div style={{ background:C.bg, borderRadius:'0.85rem', padding:'0.75rem', marginBottom:'0.5rem', border:'1px solid '+C.border }}>
          <Lbl>Descripción</Lbl>
          {descField(false)}
          <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.5rem' }}>
            <div style={{ flex:1 }}>
              <Lbl>Monto</Lbl>
              <input style={inpStyle()} type="number" value={form.amount} onChange={e => onAmountChange(e.target.value)} placeholder="0" />
            </div>
            <div style={{ flex:1 }}>
              <Lbl>Fecha</Lbl>
              <input style={inpStyle()} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
          </div>
          {periods.length > 0 && (
            <div style={{ textAlign:'center', fontSize:'0.72rem', color:C.textMuted, marginTop:'0.4rem' }}>
              Período: <strong style={{ color:C.navy }}>{getPeriod(form.date, periods)}</strong>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background:C.bg, borderRadius:'0.85rem', padding:'0.65rem 0.9rem', marginBottom:'0.75rem', border:'1px solid '+C.border, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:700, color:C.navy, fontSize:'0.88rem' }}>{form.description || 'Sin descripción'}</div>
            <div style={{ fontSize:'0.72rem', color:C.textMuted, marginTop:'0.1rem' }}>{form.date}{form.amount ? ' · ' + fmt(totalAmt, cur) : ''}</div>
          </div>
          <button onClick={() => setStep(1)} style={{ background:'transparent', border:'1px solid '+C.border, borderRadius:'0.6rem', padding:'0.2rem 0.6rem', fontSize:'0.7rem', color:C.textMuted, cursor:'pointer', fontFamily:F, fontWeight:700, flexShrink:0, marginLeft:'0.5rem', display:'inline-flex', alignItems:'center', gap:'0.25rem' }}>
            <Pencil size={11} strokeWidth={2.2} />Editar
          </button>
        </div>
      )}

      <Lbl>Categoría</Lbl>
      <select value={form.category} onChange={e => set('category', e.target.value)} style={selStyle}>
        {allCats.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      {!showNewCat ? (
        <button onClick={() => setShowNewCat(true)} style={{ marginTop:'0.5rem', background:'transparent', border:'1px dashed '+C.accent, borderRadius:'0.65rem', color:C.accent, fontSize:'0.72rem', fontWeight:700, cursor:'pointer', padding:'0.35rem 0.75rem', fontFamily:F, display:'flex', alignItems:'center', gap:'0.3rem' }}>
          <Plus size={13} strokeWidth={2.5} />Nueva categoría
        </button>
      ) : (
        <div style={{ marginTop:'0.5rem', background:C.bg, borderRadius:'0.75rem', padding:'0.6rem', display:'flex', gap:'0.4rem', alignItems:'center', border:'1px solid '+C.border }}>
          <input
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="Nombre de la categoría..."
            style={{ flex:1, border:'1px solid '+C.border, borderRadius:'0.5rem', padding:'0.4rem', fontSize:'0.82rem', outline:'none', fontFamily:F, color:C.navy, background:C.surface }}
          />
          <button onClick={addNewCat} style={{ background:C.accent, color:C.white, border:'none', borderRadius:'0.5rem', padding:'0.4rem 0.6rem', fontSize:'0.78rem', fontWeight:700, cursor:'pointer', fontFamily:F }}>OK</button>
          <button onClick={() => setShowNewCat(false)} style={{ background:'none', border:'none', color:C.textMuted, cursor:'pointer', display:'flex', alignItems:'center' }}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      )}

      <Lbl>Medio de pago</Lbl>
      <select value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)} style={selStyle}>
        {PAY_METHODS.map(m => <option key={m}>{m}</option>)}
      </select>

      <Lbl>Banco / Billetera</Lbl>
      <select value={form.bank} onChange={e => set('bank', e.target.value)} style={selStyle}>
        {BANKS.map(b => <option key={b}>{b}</option>)}
      </select>

      <Lbl>Notas (opcional)</Lbl>
      <textarea
        value={form.notes || ''}
        onChange={e => set('notes', e.target.value)}
        placeholder="Agregá un comentario o detalle adicional..."
        rows={2}
        style={{ width:'100%', border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.5rem 0.75rem', fontSize:'0.85rem', outline:'none', fontFamily:F, color:C.navy, background:C.surface, boxSizing:'border-box', resize:'vertical', minHeight:'60px', lineHeight:'1.4' }}
      />

      {splitButton}
      {splitPreview}

      {!isEditMode && (
        <>
          {/* El toggle único/cuotas no se muestra al editar un plan: ya es un plan */}
          {!isPlanEdit && (
            <>
              <Lbl>¿Pago en cuotas?</Lbl>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <SegBtn active={!useCuotas} color={C.navy} onClick={() => { setUseCuotas(false); setIsRetro(false); }}>Pago único</SegBtn>
                <SegBtn active={useCuotas} color={C.accent} onClick={() => setUseCuotas(true)}>En cuotas</SegBtn>
              </div>
            </>
          )}
          {useCuotas && (
            <div style={{ background:C.bg, borderRadius:'1rem', padding:'0.85rem', marginTop:'0.5rem', border:'1px solid '+C.border }}>
              <div style={{ fontSize:'0.78rem', color:C.navy, fontWeight:700, marginBottom:'0.5rem' }}>Cantidad de cuotas totales</div>
              <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', marginBottom:'0.5rem' }}>
                {CUOTA_OPTS.map(n => {
                  const active = numCuotas === n && !customCuotas;
                  return (
                    <button
                      key={n}
                      onClick={() => { setNumCuotas(n); setCustomCuotas(''); }}
                      style={{ padding:'0.35rem 0.65rem', fontSize:'0.78rem', borderRadius:'0.65rem', border:'1px solid', cursor:'pointer', fontFamily:F, fontWeight:active ? 800 : 500, background:active ? C.navy : 'transparent', borderColor:active ? C.navy : C.border, color:active ? C.onNavy : C.navy }}
                    >
                      {n}
                    </button>
                  );
                })}
                <input
                  type="number"
                  value={customCuotas}
                  onChange={e => setCustomCuotas(e.target.value)}
                  placeholder="Otra"
                  min={2} max={60}
                  style={{ width:'4rem', border:'1px solid ' + (customCuotas ? C.navy : C.border), borderRadius:'0.65rem', padding:'0.35rem 0.5rem', fontSize:'0.78rem', outline:'none', fontFamily:F, color:C.navy, background:customCuotas ? C.beige : 'transparent', textAlign:'center' }}
                />
              </div>
              <div style={{ borderTop:'1px solid '+C.border, paddingTop:'0.6rem', marginTop:'0.35rem' }}>
                <div style={{ display:'flex', gap:'0.5rem', marginBottom:isRetro ? '0.6rem' : 0 }}>
                  <SegBtn active={!isRetro} color={C.navy} onClick={() => setIsRetro(false)}>Compra nueva</SegBtn>
                  <SegBtn active={isRetro} color="#b45309" onClick={() => setIsRetro(true)}>Cuotas del pasado</SegBtn>
                </div>
                {isRetro && (
                  <div style={{ background:C.surface, borderRadius:'0.75rem', padding:'0.6rem', border:'1px solid '+C.border, display:'flex', flexDirection:'column', gap:'0.45rem' }}>
                    <div style={{ fontSize:'0.75rem', color:C.warn, fontWeight:700 }}>Indicá cuántas cuotas ya se pagaron y a partir de qué período continúan.</div>
                    <label style={{ fontSize:'0.78rem', color:C.textMuted, fontWeight:700 }}>Cuotas ya pagadas</label>
                    <input
                      type="number" min={0} max={finalCuotas - 1}
                      value={retroPaid}
                      onChange={e => { setRetroPaid(e.target.value); setErrors({}); }}
                      placeholder="0"
                      style={{ border:'1px solid ' + (errors.retroPaid ? '#c0314f' : C.border), borderRadius:'0.6rem', padding:'0.45rem 0.6rem', fontSize:'0.88rem', outline:'none', fontFamily:F, color:C.navy, background:C.bg, width:'6rem', boxSizing:'border-box' }}
                    />
                    {errors.retroPaid && <p style={{ color:C.danger, fontSize:'0.7rem', margin:0 }}>⚠ {errors.retroPaid}</p>}
                    <label style={{ fontSize:'0.78rem', color:C.textMuted, fontWeight:700 }}>Período donde va la próxima cuota ({paidNum + 1}/{finalCuotas})</label>
                    <select
                      value={retroStartPer}
                      onChange={e => { setRetroStartPer(e.target.value); setErrors({}); }}
                      style={{ ...selStyle, borderColor:errors.retroStartPer ? '#c0314f' : C.border, padding:'0.45rem 0.6rem', fontSize:'0.85rem' }}
                    >
                      <option value="">-- Seleccioná un período --</option>
                      {periods.slice().reverse().map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                    {errors.retroStartPer && <p style={{ color:C.danger, fontSize:'0.7rem', margin:0 }}>⚠ {errors.retroStartPer}</p>}
                    {remaining > 0 && (
                      <div style={{ background:C.bg, borderRadius:'0.6rem', padding:'0.45rem 0.6rem', border:'1px dashed '+C.border, fontSize:'0.75rem', color:C.navy, fontWeight:700 }}>
                        Se registrarán <span style={{ color:C.warn }}>{remaining}</span> cuota{remaining !== 1 ? 's ' : ' '}pendiente{remaining !== 1 ? 's ' : ' '}({paidNum + 1} a {finalCuotas})
                      </div>
                    )}
                  </div>
                )}
              </div>
              {showSplit && (
                <div style={{ background:C.surface, borderRadius:'0.75rem', padding:'0.6rem', border:'1px solid '+C.border, display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'0.5rem' }}>
                  <div>
                    <div style={{ fontSize:'0.7rem', color:C.textMuted }}>Por cuota</div>
                    <div style={{ fontWeight:900, color:C.navy, fontSize:'1.1rem' }}>{fmt(installmentAmt, cur)}</div>
                  </div>
                  <div style={{ fontSize:'0.75rem', color:C.textMuted, textAlign:'right' }}>
                    <div>{finalCuotas} cuotas totales</div>
                    <div style={{ fontWeight:700, color:C.navy }}>Total: {fmt(totalAmt, cur)}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <button onClick={submit} style={{ width:'100%', padding:'1rem', background:C.gradMain, color:C.white, border:'none', borderRadius:'1rem', fontWeight:900, fontSize:'1rem', cursor:'pointer', fontFamily:F, boxShadow:'0 4px 12px rgba(0,0,0,0.15)', marginTop:'1rem' }}>{btnLabel}</button>
      <button onClick={cancel} style={{ width:'100%', padding:'0.75rem', background:'none', border:'none', color:C.textMuted, fontSize:'0.9rem', cursor:'pointer', fontFamily:F, marginTop:'0.25rem' }}>Cancelar</button>
    </div>
  );

  return (
    <div style={{ padding:'1rem', paddingBottom:'2rem', maxWidth:'min(640px, 100%)', margin:'0 auto' }}>
      {showSplitModal && (
        <SplitModal
          amount={totalAmt}
          currency={cur}
          paidBy={form.paidBy}
          javiAmount={javiAmt}
          laliAmount={laliAmt}
          onConfirm={onSplitConfirm}
          onCancel={() => setShowSplitModal(false)}
        />
      )}
      <h2 style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:900, fontSize:FS.title, color:C.navy, marginBottom:'0.5rem' }}>
        {(isEditMode || isPlanEdit) && <Pencil size={18} strokeWidth={2.3} color={C.accent} />}
        {isEditMode ? 'Editar gasto' : isPlanEdit ? 'Editar plan de cuotas' : 'Nuevo gasto'}
      </h2>
      {step === 1 ? step1 : step2}
    </div>
  );
}
