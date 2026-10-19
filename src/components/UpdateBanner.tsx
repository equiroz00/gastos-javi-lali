// ── components/UpdateBanner.tsx ───────────────────────────────────────────────
// Actualizaciones de la app (PWA) y aviso de "versión nueva".
//
// Cómo llega una versión nueva: cada push a main despliega en Vercel. El service
// worker la descarga y toma el control solo, sin esperar a nadie (registerType
// 'autoUpdate' en vite.config.js). Desde ese momento, abrir o recargar la app ya
// muestra la versión nueva. Este componente:
//   1. Registra el service worker y busca versiones nuevas cada hora y cada vez
//      que la app vuelve al frente (en el celular casi nunca se cierra del todo,
//      y el navegador solo busca solo al navegar).
//   2. Cuando una versión nueva toma el control, avisa para recargar ya.
//   3. Si la página vieja pide un archivo que la versión nueva ya borró (pasa al
//      entrar a Stats, que se carga bajo demanda), recarga sola.
import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { F } from '../constants';
import { bandColors } from './ui';
import useAppStore from '../store/useAppStore';

const CHECK_EVERY_MS = 60 * 60 * 1000;
const RELOAD_GUARD_KEY = 'pwa.preloadReloadAt';

export default function UpdateBanner() {
  const view           = useAppStore(s => s.view);
  const editingExpense = useAppStore(s => s.editingExpense);
  const editingPlan    = useAppStore(s => s.editingPlan);
  const [needRefresh, setNeedRefresh] = useState(false);

  // 1 y 2: registro, búsqueda periódica y aviso cuando cambia la versión.
  useEffect(() => {
    // En desarrollo no hay sw.js (el plugin solo lo genera en el build).
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
    const sw = navigator.serviceWorker;

    // Si al abrir ya había una versión controlando la página, un cambio de
    // control significa "llegó una nueva". Si no había (primera instalación en
    // este navegador), el primer control no es una actualización: no se avisa.
    let hadController = !!sw.controller;
    const onControllerChange = () => {
      if (hadController) setNeedRefresh(true);
      hadController = true;
    };
    sw.addEventListener('controllerchange', onControllerChange);

    let reg: ServiceWorkerRegistration | undefined;
    sw.register('/sw.js', { scope: '/' })
      .then(r => { reg = r; r.update().catch(() => {}); })
      .catch(err => console.error('Service worker: no se pudo registrar', err));

    const timer = window.setInterval(() => { reg?.update().catch(() => {}); }, CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') reg?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      sw.removeEventListener('controllerchange', onControllerChange);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // 3: archivos de una versión vieja → recargar. Vite dispara este evento cuando
  // falla una carga bajo demanda. Con freno anti-bucle: si ya se recargó por esto
  // hace menos de 10 s, se deja pasar el error en vez de recargar otra vez.
  useEffect(() => {
    const onPreloadError = (e: Event) => {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
        if (Date.now() - last < 10_000) return;
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
      } catch { /* sin sessionStorage: se recarga igual */ }
      e.preventDefault();
      window.location.reload();
    };
    window.addEventListener('vite:preloadError', onPreloadError);
    return () => window.removeEventListener('vite:preloadError', onPreloadError);
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
        <div style={{ fontSize:'0.7rem', color:B.dim }}>Si no recargás ahora, se aplica sola la próxima vez que abras la app.</div>
      </div>
      <button
        onClick={() => window.location.reload()}
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
