// ── src/lib/bento.ts ──────────────────────────────────────────────────────────
// Lógica pura de la grilla bento (versión web). Separada de ui.tsx para poder
// testearla sin cargar Firebase.
import type { ReactNode } from 'react';

// Tamaños de la grilla según el ancho de ventana. La app usa el menú lateral
// desde 768px, así que hay que contemplar ventanas chicas:
//   md: tablet / ventana chica (768–1099) · lg: notebook (1100–1439) · xl: monitor (≥1440)
export type GridSize = 'md' | 'lg' | 'xl';

export function gridSizeFor(w: number): GridSize {
  return w >= 1440 ? 'xl' : w >= 1100 ? 'lg' : 'md';
}

// Acomodador automático para pantallas cuyos bloques cambian según el estado
// (en Stats aparecen o no comparación, proyección, etc.). Cada bloque declara
// cuántas "unidades" de ancho quiere (1 = angosto, 2 = ancho); se llenan filas
// y, si a una fila le sobra lugar, se estira el último bloque hasta completarla.
// Resultado: nunca queda un hueco, aparezcan los bloques que aparezcan.
//   monitor (xl): 3 unidades por fila → spans de 4 · notebook (lg): 2 → spans
//   de 6 · tablet (md): 1 → todo a lo ancho.
export interface BentoItem { key: string; node: ReactNode; w?: 1 | 2 | 3; fill?: boolean; bare?: boolean; }

export function packBento(items: BentoItem[], size: GridSize): Array<BentoItem & { span: number }> {
  const U = size === 'xl' ? 3 : size === 'lg' ? 2 : 1;
  const unit = 12 / U;
  const out: Array<BentoItem & { span: number }> = [];
  let row: Array<BentoItem & { u: number }> = [];
  let used = 0;
  const flush = () => {
    if (!row.length) return;
    row[row.length - 1].u += U - used; // completar la fila estirando el último
    row.forEach(({ u, ...it }) => out.push({ ...it, span: u * unit }));
    row = []; used = 0;
  };
  for (const it of items) {
    const u = Math.min(it.w ?? 1, U);
    if (used + u > U) flush();
    row.push({ ...it, u });
    used += u;
  }
  flush();
  return out;
}

// Para tests y verificaciones: agrupa los spans en filas y devuelve la suma de
// cada una (deben ser todas 12).
export function rowSums(spans: number[]): number[] {
  const sums: number[] = [];
  let acc = 0;
  for (const s of spans) {
    if (acc + s > 12) { sums.push(acc); acc = 0; }
    acc += s;
  }
  if (acc) sums.push(acc);
  return sums;
}
