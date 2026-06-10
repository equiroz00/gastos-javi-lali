// ── src/lib/useIsDesktop.ts ───────────────────────────────────────────────────
// Hook compartido: true cuando el viewport es de escritorio (≥768px).
import { useState, useEffect } from 'react';

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
}
