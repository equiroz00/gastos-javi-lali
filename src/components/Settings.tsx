// ── components/Settings.tsx ───────────────────────────────────────────────────
import React, { useState } from 'react';
import { Palette, SlidersHorizontal, Download, CalendarDays, ChevronDown, Users, X } from 'lucide-react';
import { C, F, THEMES, FONTS, coerceTheme, coerceFont, SP, FS } from '../constants';
import useAppStore from '../store/useAppStore';
import { Card } from './ui';
import { useIsDesktop } from '../lib/useIsDesktop';
import { useSettings, usePeople } from '../lib/queries';

export default function Settings() {
  const isDesktop           = useIsDesktop();
  const settings            = useSettings();
  const saveSettings        = useAppStore(s => s.saveSettings);
  const exportCSV           = useAppStore(s => s.exportCSV);
  const currentUser         = useAppStore(s => s.currentUser);
  const userTheme           = useAppStore(s => s.userTheme);
  const userFont            = useAppStore(s => s.userFont);
  const saveUserPreferences  = useAppStore(s => s.saveUserPreferences);
  const people               = usePeople();
  const savePeople           = useAppStore(s => s.savePeople);

  const [periods, setPeriods]         = useState(settings.periods || []);
  const [newPerson, setNewPerson]     = useState('');
  const [personError, setPersonError] = useState('');
  const [np, setNp]                   = useState({ name:'', start:'', end:'' });
  const [periodError, setPeriodError] = useState('');
  const [saved, setSaved]             = useState(false);
  const [csvFrom, setCsvFrom]         = useState('');
  const [csvTo, setCsvTo]             = useState('');
  const [showPeriods, setShowPeriods] = useState(false);

  function dateOverlaps(start: string, end: string, existing: typeof periods) {
    const s = new Date(start + 'T00:00:00'), e = new Date(end + 'T23:59:59');
    for (const p of existing) {
      const ps = new Date(p.start + 'T00:00:00'), pe = new Date(p.end + 'T23:59:59');
      if (s <= pe && e >= ps) return p.name;
    }
    return null;
  }

  function addPeriod() {
    if (!np.name || !np.start || !np.end) { setPeriodError('Completá todos los campos.'); return; }
    if (np.start > np.end) { setPeriodError('La fecha de inicio debe ser anterior a la de fin.'); return; }
    const conflict = dateOverlaps(np.start, np.end, periods);
    if (conflict) { setPeriodError(`Se superpone con "${conflict}".`); return; }
    setPeriodError('');
    const next = [...periods, np];
    setPeriods(next);
    setNp({ name:'', start:'', end:'' });
    // Persistir y reubicar los gastos al instante (no depender del botón Guardar).
    saveSettings({ ...settings, periods: next });
  }

  // Quitar un período también persiste + reubica (sus gastos vuelven a recalcularse).
  function removePeriod(name: string) {
    const next = periods.filter(x => x.name !== name);
    setPeriods(next);
    saveSettings({ ...settings, periods: next });
  }

  function addPerson() {
    const name = newPerson.trim();
    if (!name) return;
    if (['Javi', 'Lali', ...people].some(p => p.toLowerCase() === name.toLowerCase())) {
      setPersonError('Esa persona ya existe.'); return;
    }
    savePeople([...people, name]);
    setNewPerson(''); setPersonError('');
  }

  function save() {
    saveSettings({ ...settings, periods });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inp: React.CSSProperties = {
    width:'100%', border:'1px solid '+C.border, borderRadius:'0.6rem',
    padding:'0.5rem 0.75rem', fontSize:'0.85rem', outline:'none',
    boxSizing:'border-box', fontFamily:F, color:C.navy, background:C.surface,
  };

  // ── Dropdown select style ───────────────────────────────────────────────────
  const selStyle: React.CSSProperties = {
    width:'100%', border:'1px solid '+C.border, borderRadius:'0.75rem',
    padding:'0.6rem 0.85rem', fontSize:'0.85rem', fontWeight:600,
    outline:'none', cursor:'pointer', fontFamily:F, color:C.navy,
    background:C.surface, appearance:'none' as any,
    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat:'no-repeat', backgroundPosition:'right 0.75rem center',
    paddingRight:'2rem',
  };

  // ── Theme preview dots ──────────────────────────────────────────────────────
  const ThemeDots = ({ themeKey }: { themeKey: string }) => {
    const t = (THEMES as any)[themeKey];
    if (!t) return null;
    return (
      <span style={{ display:'inline-flex', gap:'3px', flexShrink:0 }}>
        {[t.navy, t.accent, t.bg].map((col: string, i: number) => (
          <span key={i} style={{ width:'11px', height:'11px', borderRadius:'50%', background:col, border:'1px solid rgba(0,0,0,0.12)', display:'inline-block' }} />
        ))}
      </span>
    );
  };

  // ── Shared blocks ───────────────────────────────────────────────────────────
  const appearanceBanner = (
    <div style={{ background:C.bg, borderRadius:'0.65rem', padding:'0.5rem 0.85rem', border:'1px solid '+C.border, display:'flex', alignItems:'center', gap:'0.5rem' }}>
      <Palette size={15} strokeWidth={2} color={C.accent} style={{ flexShrink:0 }} />
      <p style={{ fontSize:'0.72rem', color:C.textMuted, margin:0, fontWeight:600 }}>
        Apariencia de <strong style={{ color:C.navy }}>{currentUser}</strong> — solo visible para vos
      </p>
    </div>
  );

  const sharedBanner = (
    <div style={{ background:C.bg, borderRadius:'0.65rem', padding:'0.5rem 0.85rem', border:'1px solid '+C.border, display:'flex', alignItems:'center', gap:'0.5rem' }}>
      <SlidersHorizontal size={15} strokeWidth={2} color={C.accent} style={{ flexShrink:0 }} />
      <p style={{ fontSize:'0.72rem', color:C.textMuted, margin:0, fontWeight:600 }}>
        Configuración compartida — se aplica para Javi y Lali
      </p>
    </div>
  );

  // ── Tema dropdown ───────────────────────────────────────────────────────────
  const curTheme = coerceTheme(userTheme || 'default');
  const themeCard = (
    <Card>
      <h3 style={{ fontWeight:800, color:C.navy, margin:'0 0 0.75rem', fontSize:'0.95rem' }}>Tema</h3>
      <div style={{ display:'flex', gap:'0.5rem' }}>
        {Object.entries(THEMES).map(([key, t]: [string, any]) => {
          const active = curTheme === key;
          return (
            <button
              key={key}
              onClick={() => saveUserPreferences(key, userFont)}
              style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'0.45rem', padding:'0.7rem 0.4rem', borderRadius:'0.85rem', border:'2px solid ' + (active ? C.accent : C.border), background: active ? C.accent + '12' : 'transparent', cursor:'pointer', fontFamily:F }}
            >
              <ThemeDots themeKey={key} />
              <span style={{ fontSize:'0.74rem', fontWeight: active ? 800 : 600, color: active ? C.accent : C.navy }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );

  // ── Tipografía dropdown ─────────────────────────────────────────────────────
  const fontCard = (
    <Card>
      <h3 style={{ fontWeight:800, color:C.navy, margin:'0 0 0.75rem', fontSize:'0.95rem' }}>Tipografía</h3>
      <select
        value={coerceFont(userFont || 'Nunito')}
        onChange={e => saveUserPreferences(userTheme, e.target.value)}
        style={{ ...selStyle, fontFamily:(FONTS as any)[coerceFont(userFont || 'Nunito')]?.css || 'Nunito, sans-serif' }}
      >
        {Object.entries(FONTS).map(([key, fd]: [string, any]) => (
          <option key={key} value={key} style={{ fontFamily:fd.css }}>{fd.label}</option>
        ))}
      </select>
    </Card>
  );

  // ── CSV card ────────────────────────────────────────────────────────────────
  const csvCard = (
    <Card>
      <h3 style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:800, color:C.navy, margin:'0 0 0.4rem', fontSize:'0.95rem' }}><Download size={16} strokeWidth={2.2} color={C.accent} />Exportar gastos a CSV</h3>
      <div style={{ display:'flex', gap:'0.4rem', marginBottom:'0.5rem' }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'0.72rem', color:C.textMuted, marginBottom:'0.2rem', fontWeight:700 }}>Desde</div>
          <input type="date" style={inp} value={csvFrom} onChange={e => setCsvFrom(e.target.value)} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'0.72rem', color:C.textMuted, marginBottom:'0.2rem', fontWeight:700 }}>Hasta</div>
          <input type="date" style={inp} value={csvTo} onChange={e => setCsvTo(e.target.value)} />
        </div>
      </div>
      <button
        onClick={() => exportCSV(csvFrom, csvTo)}
        style={{ width:'100%', padding:'0.65rem', background:C.gradMain, color:C.white, border:'none', borderRadius:'0.85rem', fontWeight:700, fontSize:'0.85rem', cursor:'pointer', fontFamily:F }}
      >
        ⬇️ Descargar CSV
      </button>
    </Card>
  );

  // ── Períodos card ───────────────────────────────────────────────────────────
  const periodsCard = (
    <Card>
      <h3 style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:800, color:C.navy, margin:'0 0 0.75rem', fontSize:'0.95rem' }}><CalendarDays size={16} strokeWidth={2.2} color={C.accent} />Períodos de cierre</h3>
      <div style={{ background:C.bg, borderRadius:'0.85rem', padding:'0.75rem', marginBottom:'0.75rem', border:'1px solid '+C.border }}>
        <p style={{ fontSize:'0.75rem', color:C.textMuted, marginBottom:'0.4rem', fontWeight:700 }}>Agregar período:</p>
        <input style={{ ...inp, marginBottom:'0.4rem' }} value={np.name} onChange={e => { setNp(p => ({ ...p, name:e.target.value })); setPeriodError(''); }} placeholder="Ej: Mar-Abr 2026" />
        <div style={{ display:'flex', gap:'0.4rem', marginBottom:'0.4rem' }}>
          <input type="date" style={{ ...inp, flex:1 } as any} value={np.start} onChange={e => { setNp(p => ({ ...p, start:e.target.value })); setPeriodError(''); }} />
          <input type="date" style={{ ...inp, flex:1 } as any} value={np.end}   onChange={e => { setNp(p => ({ ...p, end:e.target.value }));   setPeriodError(''); }} />
        </div>
        {periodError && <p style={{ color:C.danger, fontSize:'0.75rem', margin:'0 0 0.4rem', fontWeight:600 }}>⚠ {periodError}</p>}
        <button onClick={addPeriod} style={{ width:'100%', padding:'0.5rem', background:C.navy, color:C.onNavy, border:'none', borderRadius:'0.6rem', fontWeight:700, fontSize:'0.85rem', cursor:'pointer', fontFamily:F }}>
          + Agregar período
        </button>
      </div>
      {periods.length === 0
        ? <p style={{ fontSize:'0.8rem', color:C.textMuted, margin:0 }}>No hay períodos configurados aún.</p>
        : <>
            <button
              onClick={() => setShowPeriods(v => !v)}
              style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background:'none', border:'none', padding:'0.15rem 0', cursor:'pointer', fontFamily:F }}
            >
              <span style={{ fontSize:'0.75rem', color:C.textMuted, fontWeight:700 }}>Períodos registrados ({periods.length})</span>
              <ChevronDown size={16} strokeWidth={2.2} color={C.textMuted} style={{ transform: showPeriods ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }} />
            </button>
            {showPeriods && (
              <div style={{ maxHeight:'220px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'0.4rem', marginTop:'0.4rem' }}>
                {periods.slice().reverse().map((p, i) => (
                  <div key={p.name + i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:C.bg, borderRadius:'0.6rem', padding:'0.5rem 0.75rem', border:'1px solid '+C.border, flexShrink:0 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:'0.85rem', color:C.navy }}>{p.name}</div>
                      <div style={{ fontSize:'0.7rem', color:C.textMuted }}>{p.start} → {p.end}</div>
                    </div>
                    <button onClick={() => removePeriod(p.name)} style={{ background:'none', border:'none', color:C.danger, cursor:'pointer', fontSize:'1rem' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </>
      }
    </Card>
  );

  // ── Personas card (etiquetas para dividir entre N) ──────────────────────────
  const chipBase: React.CSSProperties = {
    display:'inline-flex', alignItems:'center', gap:'0.3rem', padding:'0.3rem 0.6rem',
    borderRadius:'999px', fontSize:'0.78rem', fontWeight:700, fontFamily:F,
  };
  const peopleCard = (
    <Card>
      <h3 style={{ display:'flex', alignItems:'center', gap:'0.4rem', fontWeight:800, color:C.navy, margin:'0 0 0.4rem', fontSize:'0.95rem' }}>
        <Users size={16} strokeWidth={2.2} color={C.accent} />Personas
      </h3>
      <p style={{ fontSize:'0.72rem', color:C.textMuted, margin:'0 0 0.75rem', lineHeight:1.4 }}>
        Etiquetas para dividir gastos con más gente (amigos, familia). Javi y Lali ya están; agregá el resto y después elegilos al repartir un gasto.
      </p>
      <div style={{ display:'flex', gap:'0.4rem', marginBottom:'0.5rem' }}>
        <input
          style={inp}
          value={newPerson}
          onChange={e => { setNewPerson(e.target.value); setPersonError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') addPerson(); }}
          placeholder="Nombre (ej. Caro)"
        />
        <button onClick={addPerson} style={{ flexShrink:0, padding:'0.5rem 0.9rem', background:C.navy, color:C.onNavy, border:'none', borderRadius:'0.6rem', fontWeight:700, fontSize:'0.82rem', cursor:'pointer', fontFamily:F }}>Agregar</button>
      </div>
      {personError && <p style={{ color:C.danger, fontSize:'0.7rem', margin:'0 0 0.5rem' }}>⚠ {personError}</p>}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem' }}>
        {['Javi', 'Lali'].map(p => (
          <span key={p} style={{ ...chipBase, background:C.bg, border:'1px solid '+C.border, color:C.textMuted }}>{p}</span>
        ))}
        {people.map(p => (
          <span key={p} style={{ ...chipBase, background:C.accent+'1A', border:'1px solid '+C.accent, color:C.navy }}>
            {p}
            <button onClick={() => savePeople(people.filter(x => x !== p))} title={'Quitar ' + p}
              style={{ background:'none', border:'none', cursor:'pointer', color:C.accent, display:'flex', padding:0, alignItems:'center' }}>
              <X size={13} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        {!people.length && <span style={{ fontSize:'0.72rem', color:C.textMuted, alignSelf:'center' }}>Todavía no agregaste a nadie más.</span>}
      </div>
    </Card>
  );

  const saveBtn = (
    <button
      onClick={save}
      style={{ width: isDesktop ? '280px' : '100%', padding:'0.9rem', border:'none', borderRadius:'1rem', fontWeight:900, fontSize:'0.95rem', cursor:'pointer', fontFamily:F, background:saved ? 'linear-gradient(135deg,#2d9e7f,#1db88c)' : C.gradMain, color:C.white, alignSelf:'center' }}
    >
      {saved ? '✓ Guardado' : 'Guardar configuración'}
    </button>
  );

  // ── DESKTOP — 2 columns ─────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ padding:SP.lg, paddingBottom:SP.xxl, display:'flex', flexDirection:'column', gap:SP.lg }}>
        <h2 style={{ fontWeight:900, fontSize:FS.title, color:C.navy, margin:0 }}>Configuración</h2>
        {/* Apariencia banner + 2-col grid */}
        {appearanceBanner}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap:SP.lg, alignItems:'stretch' }}>
          {themeCard}
          {fontCard}
        </div>
        {sharedBanner}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap:SP.lg, alignItems:'stretch' }}>
          {periodsCard}
          {peopleCard}
          {csvCard}
        </div>
        {saveBtn}
      </div>
    );
  }

  // ── MOBILE — single column, order: Períodos · CSV · Tema · Tipografía · Guardar
  return (
    <div style={{ padding:SP.lg, paddingBottom:SP.xxl, display:'flex', flexDirection:'column', gap:SP.md }}>
      <h2 style={{ fontWeight:900, fontSize:FS.title, color:C.navy, margin:0 }}>Configuración</h2>
      {sharedBanner}
      {periodsCard}
      {peopleCard}
      {csvCard}
      {appearanceBanner}
      {themeCard}
      {fontCard}
      {saveBtn}
    </div>
  );
}
