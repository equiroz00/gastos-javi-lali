// ── components/UpdateBanner.tsx ───────────────────────────────────────────────
// Aviso de "versión nueva" de la app (PWA).
//
// Cómo funciona una actualización acá: cada push a main despliega en Vercel una
// versión nueva. El service worker la DESCARGA en segundo plano y la deja en
// espera (registerType: 'prompt' en vite.config.js). Este aviso ofrece aplicarla
// ya; si se ignora, se aplica sola la próxima vez que la app se abra de cero.
import React, { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Sparkles, X } from 'lucide-react';
import { F } from '../constants';
import { bandColors } from './ui';
import useAppStore from '../store/useAppStore';

// El navegador solo busca un service worker nuevo al navegar, y en el celular
// una PWA casi nunca se cierra del todo: sin un chequeo propio podía tardar días
// en enterarse de una versión nueva. Se busca cada hora y al volver al frente.
const CHECK_EVERY_MS = 60 * 60 * 1000;

export default function UpdateBanner() {
  const view           = useAppStore(s => s.view);
  const editingExpense = useAppStore(s => s.editingExpense);
  const editingPlan    = useAppStore(s => s.editingPlan);
  const regRef = useRef<ServiceWorkerRegistration | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      regRef.current = registration;
      setInterval(() => { registration.update().catch(() => {}); }, CHECK_EVERY_MS);
    },
    onRegisterError(err) {
      console.error('Service worker: no se pudo registrar', err);
    },
  });

  // Al traer la app al frente (desde segundo plano), buscar si hay versión nueva.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') regRef.current?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // No interrumpir una carga: "Actualizar" recarga la página y se perdería lo
  // que se estaba escribiendo. El aviso aparece apenas se sale del formulario.
  const inForm = view === 'add' || !!editingExpense || !!editingPlan;
  if (!needRefresh || inForm) return null;

  const B = bandColors();
  return (
    <div
      role="status"
      style={{
        position:'fixed', top:'calc(0.6rem + env(safe-area-inset-top))', left:'50%', transform:'translateX(-50%)',
        width:'calc(100% - 1.5rem)', maxWidth:'420px', zIndex:200,
        background:B.bg, color:B.on, borderRadius:'14px', padding:'0.7rem 0.75rem 0.7rem 0.9rem',
        display:'flex', alignItems:'center', gap:'0.6rem',
        boxShadow:'0 10px 30px rgba(0,0,0,0.25)', fontFamily:F,
      }}
    >
      <Sparkles size={18} strokeWidth={2.2} style={{ flexShrink:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'0.82rem', fontWeight:700 }}>Hay una versión nueva</div>
        <div style={{ fontSize:'0.7rem', color:B.dim }}>Si no la aplicás ahora, se aplica sola la próxima vez que abras la app.</div>
      </div>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{ flexShrink:0, height:'34px', padding:'0 0.85rem', borderRadius:'9px', border:'none', background:B.on, color:B.bg, fontFamily:F, fontWeight:800, fontSize:'0.78rem', cursor:'pointer' }}
      >
        Actualizar
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        aria-label="Más tarde"
        title="Más tarde"
        style={{ flexShrink:0, width:'30px', height:'30px', borderRadius:'8px', border:'none', background:'transparent', color:B.dim, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
      >
        <X size={16} strokeWidth={2.4} />
      </button>
    </div>
  );
}
