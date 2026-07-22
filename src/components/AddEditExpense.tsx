// ── components/AddEditExpense.tsx ─────────────────────────────────────────────
import React, { useRef, useState } from 'react';
import { Plus, X, Pencil, AlertTriangle, Camera, Loader2, MapPin } from 'lucide-react';
import { C, F, MONO, FS, DEFAULT_CATS, PAY_METHODS, BANKS, BASE_CURS, CUOTA_OPTS } from '../constants';
import { todayStr, fmt, safeN, calcAmts, getPeriod, sanitize, genId, splitFromLegacy, resolveSplit, allParticipants } from '../lib/helpers';
import { CatIcon, SegBtn } from './ui';
import useAppStore from '../store/useAppStore';
import { useExpenses, useSettings, useCustomCats, usePeople } from '../lib/queries';
import SplitModal from './SplitModal';
import { auth, storage } from '../firebase.js';
import { ref, uploadBytes } from 'firebase/storage';
import { ReciboSchema, type ReciboExtraido } from '../lib/receiptSchema';
import { placeTypeToCategory } from '../lib/placeCategory';
import type { Expense, UserName, Responsible, Plan, Visibility, SplitAmong } from '../types';

// Colores del estado "leído de la foto" (ámbar). Fijos en ambos temas: el fondo
// es siempre amarillo claro, así que el texto va oscuro para que se lea. En tema
// oscuro C.navy es casi blanco y quedaba blanco sobre amarillo (ilegible).
const AMBER_BG     = '#fef9c3';
const AMBER_BORDER = '#fde047';
const AMBER_TEXT   = '#422006';

// Estado del formulario: como Expense pero con amount editable como string.
interface FormState {
  id?: string;
  date: string;
  description: string;
  amount: string | number;
  category: string;
  paymentMethod: string;
  bank: string;
  paidBy: string;
  responsible: Responsible;
  currency: string;
  customCurrency?: string;
  javiAmount: number;
  laliAmount: number;
  visibilidad: Visibility;
  splitAmong?: SplitAmong;
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
  const settings          = useSettings();
  const customCats        = useCustomCats();
  const expenses          = useExpenses();
  const people            = usePeople();
  const participants      = allParticipants(people);
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
      responsible: 'Ambos', currency: 'ARS', customCurrency: '', javiAmount: 0, laliAmount: 0,
      visibilidad: 'compartido', notes: '',
    };
  }

  // Prefill del formulario al editar un plan "madre"
  function planToForm(p: Plan): FormState {
    const isBase = BASE_CURS.indexOf(p.currency) >= 0;
    return {
      id: p.id, date: p.startDate, description: p.description, amount: String(p.totalAmount),
      category: p.category, paymentMethod: p.paymentMethod, bank: p.bank, paidBy: p.paidBy,
      responsible: p.responsible, currency: isBase ? p.currency : 'Otra',
      customCurrency: isBase ? '' : String(p.currency), javiAmount: 0, laliAmount: 0,
      visibilidad: 'compartido', notes: '',
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

  // ── Escaneo de facturas (Sprint 14) — human-in-the-loop: nada se auto-guarda,
  // solo se precarga el form y se marcan los campos para que se revisen. ──────
  const fileInputRef                = useRef<HTMLInputElement>(null);
  const [scanning, setScanning]     = useState(false);
  const [scanError, setScanError]   = useState('');
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  const [scanExtra, setScanExtra]   = useState<{ cuit: string | null; items: ReciboExtraido['items'] } | null>(null);

  function clearAutoFilled(field: string) {
    setAutoFilled(af => {
      if (!af.has(field)) return af;
      const next = new Set(af);
      next.delete(field);
      return next;
    });
  }

  function downscaleImage(file: File): Promise<{ blob: Blob; base64: string }> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const maxW  = 1600;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        URL.revokeObjectURL(url);
        if (!ctx) { reject(new Error('El navegador no soporta procesar la imagen.')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('No se pudo procesar la imagen.')); return; }
          const reader = new FileReader();
          reader.onload  = () => resolve({ blob, base64: String(reader.result).split(',')[1] || '' });
          reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
          reader.readAsDataURL(blob);
        }, 'image/jpeg', 0.8);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo abrir la imagen.')); };
      img.src = url;
    });
  }

  async function handleReceiptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScanError('');
    setScanExtra(null);
    setScanning(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Sesión no válida — volvé a iniciar sesión.');
      const { blob, base64 } = await downscaleImage(file);

      // La subida a Storage queda como respaldo del original; no bloquea la lectura.
      uploadBytes(ref(storage, 'receipts/' + uid + '/' + Date.now() + '.jpg'), blob)
        .catch(err => console.error('Error subiendo la foto a Storage:', err));

      const idToken = await auth.currentUser?.getIdToken();
      const resp = await fetch('/api/parse-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || 'No se pudo leer la factura.');
      }
      const data = ReciboSchema.parse(await resp.json());

      // El set se calcula desde `data`, NO dentro del callback de setForm: React
      // corre ese callback más tarde (fase de commit), así que si se chequeaba
      // filled.size acá siempre daba 0 y mostraba el error falso aunque cargara.
      const filled = new Set<string>();
      if (data.comercio) filled.add('description');
      if (data.total)    filled.add('amount');
      if (data.fecha)    filled.add('date');
      setForm(f => ({
        ...f,
        ...(data.comercio ? { description: data.comercio } : {}),
        ...(data.total    ? { amount: String(data.total) } : {}),
        ...(data.fecha    ? { date: data.fecha }           : {}),
      }));
      setAutoFilled(filled);
      setScanExtra({ cuit: data.cuit, items: data.items });
      if (!filled.size) setScanError('No se pudo leer ningún dato de la foto — completá el formulario a mano.');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'No se pudo leer la factura.');
    } finally {
      setScanning(false);
    }
  }

  // ── Comercios cercanos (Sprint 14 — ubicación) ─────────────────────────────
  const [locating, setLocating]         = useState(false);
  const [locError, setLocError]         = useState('');
  const [nearbyPlaces, setNearbyPlaces] = useState<Array<{ nombre: string; types: string[] }>>([]);

  async function handleNearby() {
    setLocError('');
    setNearbyPlaces([]);
    if (!('geolocation' in navigator)) {
      setLocError('Este navegador no soporta geolocalización.');
      return;
    }
    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      const idToken = await auth.currentUser?.getIdToken();
      const resp = await fetch('/api/nearby-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || 'No se pudieron buscar comercios cercanos.');
      }
      const data = await resp.json();
      const places = Array.isArray(data.places) ? data.places : [];
      setNearbyPlaces(places);
      if (!places.length) setLocError('No se encontraron comercios cerca.');
    } catch (err) {
      // GeolocationPositionError no hereda de Error: se detecta por sus campos.
      if (err && typeof err === 'object' && 'code' in err && 'PERMISSION_DENIED' in err) {
        setLocError('No se pudo obtener tu ubicación — revisá el permiso del navegador.');
      } else {
        setLocError(err instanceof Error ? err.message : 'No se pudieron buscar comercios cercanos.');
      }
    } finally {
      setLocating(false);
    }
  }

  function onNearbySelect(p: { nombre: string; types: string[] }) {
    const cat = placeTypeToCategory(p.types);
    setForm(f => ({ ...f, description: p.nombre, category: cat || f.category }));
    clearAutoFilled('description');
    setNearbyPlaces([]);
  }

  // ── Autocomplete ──────────────────────────────────────────────────────────
  const [acSuggestions, setAcSuggestions] = useState<Expense[]>([]);

  function onDescriptionChange(val: string) {
    set('description', val);
    setErrors({});
    clearAutoFilled('description');
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

  // Reparto resuelto por participante (fuente de verdad: splitAmong del modal).
  const splitResolved = form.splitAmong ? resolveSplit(totalAmt, form.splitAmong) : null;
  let javiAmt = safeN(form.javiAmount);
  let laliAmt = safeN(form.laliAmount);
  if (splitResolved) {
    javiAmt = safeN(splitResolved['Javi']);
    laliAmt = safeN(splitResolved['Lali']);
  } else if (javiAmt === 0 && laliAmt === 0 && totalAmt > 0) {
    // Sin split explícito (form nuevo): 50/50 por defecto.
    const derived = calcAmts(totalAmt, form.responsible);
    javiAmt = derived.javiAmount;
    laliAmt = derived.laliAmount;
  }
  const javiPct = totalAmt > 0 ? Math.round(javiAmt / totalAmt * 100) : 50;

  // Split button summary label
  const splitN = form.splitAmong?.entries?.length ?? 2;
  const splitSummary = splitN > 2
    ? ' ' + form.paidBy + ' pagó · entre ' + splitN
    : ' ' + form.paidBy + ' · ' + javiPct + '% / ' + (100 - javiPct) + '%';

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

  function onSplitConfirm(paidBy: string, splitAmong: SplitAmong) {
    setForm(f => ({ ...f, paidBy, splitAmong }));
    setShowSplitModal(false);
  }

  // When amount changes, reset stored split and check for duplicates
  function onAmountChange(val: string) {
    setForm(f => ({ ...f, amount: val, javiAmount: 0, laliAmount: 0 }));
    setErrors({});
    clearAutoFilled('amount');
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
    const currency = form.currency === 'Otra' ? (form.customCurrency || 'ARS') : form.currency;
    const period = getPeriod(form.date, periods);
    if (form.visibilidad === 'privado') {
      // Gasto privado: 100% del dueño, no se comparte ni entra al balance.
      // ownerId = uid real de auth (debe coincidir con request.auth.uid en las reglas).
      const owner = (currentUser || 'Javi') as UserName;
      return {
        ...form, id, amount: totalAmt, currency, period,
        paidBy: owner, responsible: owner as Responsible,
        javiAmount: owner === 'Javi' ? totalAmt : 0,
        laliAmount: owner === 'Lali' ? totalAmt : 0,
        splitAmong: { strategy: 'iguales', entries: [{ participant: owner }] },
        visibilidad: 'privado',
        ownerId: auth.currentUser?.uid,
      } as Expense;
    }
    return {
      ...form, id, amount: totalAmt,
      javiAmount: javiAmt, laliAmount: laliAmt,
      currency, period,
      splitAmong: form.splitAmong ?? splitFromLegacy(javiAmt, laliAmt),
      visibilidad: 'compartido',
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
        style={inpStyle({
          borderColor: showError && errors.description ? '#c0314f' : autoFilled.has('description') ? AMBER_BORDER : C.border,
          background:  autoFilled.has('description') ? AMBER_BG : C.surface,
          ...(autoFilled.has('description') ? { color: AMBER_TEXT } : {}),
        })}
        value={form.description}
        onChange={e => onDescriptionChange(e.target.value)}
        onBlur={() => setTimeout(() => setAcSuggestions([]), 150)}
        placeholder="Ej: Almuerzo en Lo de Juan"
        autoComplete="off"
      />
      {autoFilled.has('description') && <p style={{ fontSize:'0.68rem', color:'#92400e', margin:'0.2rem 0 0' }}>Leído de la foto — revisá antes de guardar.</p>}
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
  const splitPreview = !showSplit ? null : splitResolved ? (
    <div style={{ marginTop:'0.4rem', padding:'0.5rem 0.7rem', background:C.bg, borderRadius:'0.65rem', border:'1px solid '+C.border, display:'flex', flexWrap:'wrap', gap:'0.3rem 0.9rem' }}>
      {Object.entries(splitResolved).map(([p, v]) => (
        <span key={p} style={{ fontSize:'0.72rem', color:C.navy }}>{p}: <strong style={{ fontFamily:MONO }}>{fmt(safeN(v), cur)}</strong></span>
      ))}
    </div>
  ) : (
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
  );

  // ── Visibilidad + split (un gasto privado no se divide) ────────────────────
  const visibilidadToggle = !isPlanEdit ? (
    <>
      <Lbl>Visibilidad</Lbl>
      <div style={{ display:'flex', gap:'0.5rem' }}>
        <SegBtn active={form.visibilidad !== 'privado'} color={C.navy} onClick={() => set('visibilidad', 'compartido')}>Compartido</SegBtn>
        <SegBtn active={form.visibilidad === 'privado'} color={C.accent} onClick={() => { set('visibilidad', 'privado'); setUseCuotas(false); setIsRetro(false); }}>Privado</SegBtn>
      </div>
      {form.visibilidad === 'privado' && (
        <p style={{ fontSize:'0.68rem', color:C.textMuted, margin:'0.4rem 0 0', lineHeight:1.4 }}>
          🔒 Solo vos lo vas a ver. No entra en el balance ni en la comparación con {currentUser === 'Javi' ? 'Lali' : 'Javi'}.
        </p>
      )}
    </>
  ) : null;

  const splitSection = (
    <>
      {visibilidadToggle}
      {form.visibilidad !== 'privado' && splitButton}
      {form.visibilidad !== 'privado' && splitPreview}
    </>
  );

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

      {!isEditMode && !isPlanEdit && (
        <div style={{ marginBottom:'1rem' }}>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={handleReceiptFile} />
          <div style={{ display:'flex', gap:'0.4rem' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning}
              style={{ flex:1, padding:'0.7rem', background:'transparent', border:'1px dashed '+C.accent, borderRadius:'0.85rem', color:C.accent, fontWeight:700, fontSize:'0.85rem', cursor:scanning ? 'default' : 'pointer', fontFamily:F, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem', opacity:scanning ? 0.7 : 1 }}
            >
              {scanning
                ? <Loader2 size={16} strokeWidth={2.2} style={{ animation:'spin 1s linear infinite' }} />
                : <Camera size={16} strokeWidth={2.2} />}
              {scanning ? 'Leyendo…' : 'Escanear factura'}
            </button>
            <button
              onClick={handleNearby}
              disabled={locating}
              style={{ flex:1, padding:'0.7rem', background:'transparent', border:'1px dashed '+C.accent, borderRadius:'0.85rem', color:C.accent, fontWeight:700, fontSize:'0.85rem', cursor:locating ? 'default' : 'pointer', fontFamily:F, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem', opacity:locating ? 0.7 : 1 }}
            >
              {locating
                ? <Loader2 size={16} strokeWidth={2.2} style={{ animation:'spin 1s linear infinite' }} />
                : <MapPin size={16} strokeWidth={2.2} />}
              {locating ? 'Buscando…' : 'Comercios cerca'}
            </button>
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          {scanError && <p style={{ color:C.danger, fontSize:'0.72rem', margin:'0.4rem 0 0', textAlign:'center' }}>⚠ {scanError}</p>}
          {locError && <p style={{ color:C.danger, fontSize:'0.72rem', margin:'0.4rem 0 0', textAlign:'center' }}>⚠ {locError}</p>}
          {nearbyPlaces.length > 0 && (
            <div style={{ marginTop:'0.5rem', background:C.bg, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.6rem 0.85rem' }}>
              <div style={{ fontSize:'0.7rem', color:C.textMuted, fontWeight:700, marginBottom:'0.35rem' }}>¿Dónde estás? Tocá para completar:</div>
              <div style={{ display:'flex', gap:'0.35rem', flexWrap:'wrap' }}>
                {nearbyPlaces.map((p, i) => {
                  const cat = placeTypeToCategory(p.types);
                  return (
                    <button
                      key={i}
                      onClick={() => onNearbySelect(p)}
                      style={{ padding:'0.35rem 0.7rem', borderRadius:'999px', border:'1px solid '+C.border, background:C.surface, color:C.navy, fontSize:'0.75rem', fontWeight:600, cursor:'pointer', fontFamily:F, display:'inline-flex', alignItems:'center', gap:'0.3rem' }}
                    >
                      {p.nombre}{cat && <span style={{ color:C.textMuted, fontSize:'0.68rem' }}>· {cat}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {scanExtra && (scanExtra.cuit || (scanExtra.items && scanExtra.items.length > 0)) && (
            <div style={{ marginTop:'0.5rem', background:C.bg, border:'1px solid '+C.border, borderRadius:'0.75rem', padding:'0.6rem 0.85rem' }}>
              {scanExtra.cuit && (
                <div style={{ fontSize:'0.72rem', color:C.textMuted }}>CUIT detectado: <strong style={{ color:C.navy }}>{scanExtra.cuit}</strong> (no se guarda)</div>
              )}
              {scanExtra.items && scanExtra.items.length > 0 && (
                <div style={{ marginTop:scanExtra.cuit ? '0.4rem' : 0 }}>
                  <div style={{ fontSize:'0.7rem', color:C.textMuted, fontWeight:700, marginBottom:'0.2rem' }}>Ítems leídos (para verificar el total):</div>
                  {scanExtra.items.map((it, i) => (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', color:C.navy, padding:'0.1rem 0' }}>
                      <span>{it.descripcion}</span>
                      <span style={{ fontFamily:MONO }}>{fmt(it.monto, cur)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Lbl>Descripción</Lbl>
      {descField(true)}
      {errors.description && <p style={{ color:C.danger, fontSize:'0.7rem', margin:'0.15rem 0 0' }}>⚠ {errors.description}</p>}
      <Lbl>Monto total</Lbl>
      <input
        style={inpStyle({
          borderColor: errors.amount ? '#c0314f' : autoFilled.has('amount') ? AMBER_BORDER : C.border,
          background:  autoFilled.has('amount') ? AMBER_BG : C.accent + '12',
          ...(autoFilled.has('amount') ? { color: AMBER_TEXT } : {}),
          fontSize:FS.amount, fontWeight:800, textAlign:'center', fontFamily:MONO, padding:'0.85rem', letterSpacing:'-0.02em',
        })}
        type="number"
        value={form.amount}
        onChange={e => { onAmountChange(e.target.value); setErrors({}); }}
        placeholder="0"
      />
      {errors.amount && <p style={{ color:C.danger, fontSize:'0.7rem', margin:'0.15rem 0 0' }}>⚠ {errors.amount}</p>}
      {autoFilled.has('amount') && <p style={{ fontSize:'0.68rem', color:'#92400e', margin:'0.15rem 0 0', textAlign:'center' }}>Leído de la foto — revisá antes de guardar.</p>}

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
      <input
        style={inpStyle({
          borderColor: autoFilled.has('date') ? AMBER_BORDER : C.border,
          background:  autoFilled.has('date') ? AMBER_BG : C.surface,
          ...(autoFilled.has('date') ? { color: AMBER_TEXT } : {}),
        })}
        type="date"
        value={form.date}
        onChange={e => { set('date', e.target.value); clearAutoFilled('date'); }}
      />
      {autoFilled.has('date') && <p style={{ fontSize:'0.68rem', color:'#92400e', margin:'0.15rem 0 0' }}>Leído de la foto — revisá antes de guardar.</p>}
      {periods.length > 0 && (
        <div style={{ textAlign:'center', fontSize:'0.75rem', color:C.textMuted, marginTop:'0.5rem' }}>
          Período: <strong style={{ color:C.navy }}>{getPeriod(form.date, periods)}</strong>
        </div>
      )}

      {splitSection}
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

      {splitSection}

      {!isEditMode && (
        <>
          {/* El toggle único/cuotas no se muestra al editar un plan ni en gastos privados */}
          {!isPlanEdit && form.visibilidad !== 'privado' && (
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
          participants={participants}
          paidBy={form.paidBy}
          splitAmong={form.splitAmong}
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
