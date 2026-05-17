// ── components/Settings.tsx ───────────────────────────────────────────────────
import React, { useState } from 'react';
import { C, F, THEMES, FONTS } from '../constants';
import useAppStore from '../store/useAppStore';
import { Card } from './ui.jsx';

export default function Settings() {
  const settings           = useAppStore(s => s.settings);
  const saveSettings       = useAppStore(s => s.saveSettings);
  const exportCSV          = useAppStore(s => s.exportCSV);
  const currentUser        = useAppStore(s => s.currentUser);
  const userTheme          = useAppStore(s => s.userTheme);
  const userFont           = useAppStore(s => s.userFont);
  const saveUserPreferences = useAppStore(s => s.saveUserPreferences);

  const [periods, setPeriods]       = useState(settings.periods || []);
  const [np, setNp]                 = useState({ name:'', start:'', end:'' });
  const [periodError, setPeriodError] = useState('');
  const [saved, setSaved]           = useState(false);
  const [csvFrom, setCsvFrom]       = useState('');
  const [csvTo, setCsvTo]           = useState('');

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
    setPeriods(p => [...p, np]);
    setNp({ name:'', start:'', end:'' });
  }

  function save() {
    saveSettings({ ...settings, periods });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inp: React.CSSProperties = { width:'100%', border:'1px solid '+C.border, borderRadius:'0.6rem', padding:'0.5rem 0.75rem', fontSize:'0.85rem', outline:'none', boxSizing:'border-box', fontFamily:F, color:C.navy, background:C.surface };

  return (
    <div style={{ padding:'1rem', paddingBottom:'2rem', display:'flex', flexDirection:'column', gap:'0.75rem' }}>
      <h2 style={{ fontWeight:900, fontSize:'1.2rem', color:C.navy, margin:0 }}>Configuración</h2>

      {/* ── Apariencia personal (per-user) ─────────────────────────────────── */}
      <div style={{ background:C.bg, borderRadius:'0.65rem', padding:'0.5rem 0.85rem', border:'1px solid '+C.border }}>
        <p style={{ fontSize:'0.72rem', color:C.textMuted, margin:0, fontWeight:600 }}>
          🎨 Apariencia de <strong style={{ color:C.navy }}>{currentUser}</strong> — solo visible para vos
        </p>
      </div>

      <Card>
        <h3 style={{ fontWeight:800, color:C.navy, margin:'0 0 0.75rem', fontSize:'0.95rem' }}>Tema de color</h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.5rem' }}>
          {Object.entries(THEMES).map(([key, t]) => {
            const isActive = userTheme === key;
            return (
              <button
                key={key}
                onClick={() => saveUserPreferences(key, userFont)}
                style={{ padding:'0.6rem 0.3rem', borderRadius:'0.75rem', border:'2px solid '+(isActive ? C.accent : C.border), cursor:'pointer', fontFamily:F, background:t.bg, display:'flex', flexDirection:'column', alignItems:'center', gap:'0.25rem', transition:'border-color 0.15s' }}
              >
                <div style={{ display:'flex', gap:'3px' }}>
                  {[t.navy, t.accent, t.bg].map((col, i) => (
                    <div key={i} style={{ width:'12px', height:'12px', borderRadius:'50%', background:col, border:'1px solid rgba(0,0,0,0.1)' }} />
                  ))}
                </div>
                <span style={{ fontSize:'0.65rem', fontWeight:isActive ? 800 : 500, color:t.navy }}>
                  {isActive ? '✓ ' : ''}{t.label}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 style={{ fontWeight:800, color:C.navy, margin:'0 0 0.75rem', fontSize:'0.95rem' }}>Tipografía</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem', maxHeight:'220px', overflowY:'auto' }}>
          {Object.entries(FONTS).map(([key, fd]) => {
            const isActive = userFont === key;
            return (
              <button
                key={key}
                onClick={() => saveUserPreferences(userTheme, key)}
                style={{ padding:'0.5rem 0.75rem', borderRadius:'0.65rem', border:'1px solid '+(isActive ? C.accent : C.border), cursor:'pointer', background:isActive ? C.accent : 'transparent', color:isActive ? C.white : C.navy, textAlign:'left', fontSize:'0.85rem', fontFamily:fd.css, fontWeight:isActive ? 700 : 400, transition:'all 0.15s' }}
              >
                {isActive ? '✓ ' : ''}{fd.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Configuración compartida ────────────────────────────────────────── */}
      <div style={{ background:C.bg, borderRadius:'0.65rem', padding:'0.5rem 0.85rem', border:'1px solid '+C.border, marginTop:'0.25rem' }}>
        <p style={{ fontSize:'0.72rem', color:C.textMuted, margin:0, fontWeight:600 }}>
          ⚙️ Configuración compartida — se aplica para Javi y Lali
        </p>
      </div>

      {/* CSV Export */}
      <Card>
        <h3 style={{ fontWeight:800, color:C.navy, margin:'0 0 0.4rem', fontSize:'0.95rem' }}>📊 Exportar gastos a CSV</h3>
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

      {/* Periods */}
      <Card>
        <h3 style={{ fontWeight:800, color:C.navy, margin:'0 0 0.75rem', fontSize:'0.95rem' }}>📅 Períodos de cierre</h3>
        <div style={{ background:C.bg, borderRadius:'0.85rem', padding:'0.75rem', marginBottom:'0.75rem', border:'1px solid '+C.border }}>
          <p style={{ fontSize:'0.75rem', color:C.textMuted, marginBottom:'0.4rem', fontWeight:700 }}>Agregar período:</p>
          <input style={{ ...inp, marginBottom:'0.4rem' }} value={np.name} onChange={e => { setNp(p => ({ ...p, name:e.target.value })); setPeriodError(''); }} placeholder="Ej: Mar-Abr 2026" />
          <div style={{ display:'flex', gap:'0.4rem', marginBottom:'0.4rem' }}>
            <input type="date" style={{ ...inp, flex:1 }} value={np.start} onChange={e => { setNp(p => ({ ...p, start:e.target.value })); setPeriodError(''); }} />
            <input type="date" style={{ ...inp, flex:1 }} value={np.end}   onChange={e => { setNp(p => ({ ...p, end:e.target.value }));   setPeriodError(''); }} />
          </div>
          {periodError && <p style={{ color:'#c0314f', fontSize:'0.75rem', margin:'0 0 0.4rem', fontWeight:600 }}>⚠ {periodError}</p>}
          <button onClick={addPeriod} style={{ width:'100%', padding:'0.5rem', background:C.navy, color:C.white, border:'none', borderRadius:'0.6rem', fontWeight:700, fontSize:'0.85rem', cursor:'pointer', fontFamily:F }}>
            + Agregar período
          </button>
        </div>
        {periods.length === 0
          ? <p style={{ fontSize:'0.8rem', color:C.textMuted, margin:0 }}>No hay períodos configurados aún.</p>
          : <>
              <p style={{ fontSize:'0.75rem', color:C.textMuted, margin:'0 0 0.4rem', fontWeight:700 }}>Períodos registrados ({periods.length}):</p>
              <div style={{ maxHeight:'220px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                {periods.slice().reverse().map((p, i) => (
                  <div key={p.name + i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:C.bg, borderRadius:'0.6rem', padding:'0.5rem 0.75rem', border:'1px solid '+C.border, flexShrink:0 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:'0.85rem', color:C.navy }}>{p.name}</div>
                      <div style={{ fontSize:'0.7rem', color:C.textMuted }}>{p.start} → {p.end}</div>
                    </div>
                    <button onClick={() => setPeriods(ps => ps.filter(x => x.name !== p.name))} style={{ background:'none', border:'none', color:'#c0314f', cursor:'pointer', fontSize:'1rem' }}>✕</button>
                  </div>
                ))}
              </div>
            </>
        }
      </Card>

      <button
        onClick={save}
        style={{ width:'100%', padding:'0.9rem', border:'none', borderRadius:'1rem', fontWeight:900, fontSize:'0.95rem', cursor:'pointer', fontFamily:F, background:saved ? 'linear-gradient(135deg,#2d9e7f,#1db88c)' : C.gradMain, color:C.white }}
      >
        {saved ? '✓ Guardado' : 'Guardar configuración'}
      </button>
    </div>
  );
}
