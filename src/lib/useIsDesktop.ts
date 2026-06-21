// ── src/lib/useIsDesktop.ts ───────────────────────────────────────────────────
// Hooks de viewport. `useBreakpoint` da granularidad (móvil/tablet/escritorio)
// para los pocos lugares que de verdad necesitan decidir según el ancho; el
// resto del responsive se resuelve fluido con clamp() y grillas auto-fit.
import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

// Cortes: móvil <768 (barra inferior) · tablet 768–1023 · escritorio ≥1024.
export function bpFor(w: number): Breakpoint {
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => bpFor(window.innerWidth));
  useEffect(() => {
    const handler = () => setBp(bpFor(window.innerWidth));
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return bp;
}

// Compat: true cuando NO es móvil (≥768px). Mantiene el comportamiento previo
// del shell (sidebar vs barra inferior) sin cambiar las pantallas que lo usan.
export function useIsDesktop(): boolean {
  return useBreakpoint() !== 'mobile';
}
