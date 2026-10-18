// ── src/lib/bento.test.ts ─────────────────────────────────────────────────────
// La grilla bento no puede dejar huecos: en la variante "Estado de cuenta" un
// hueco se vería como un parche gris (el color de las líneas de fondo). Estos
// tests fijan que cada fila sume exactamente 12 columnas.
import { describe, it, expect } from 'vitest';
import { gridSizeFor, packBento, rowSums } from './bento';
import type { BentoItem, GridSize } from './bento';

const it_ = (key: string, w: 1 | 2 | 3 = 1): BentoItem => ({ key, node: null, w });
const spans = (items: BentoItem[], size: GridSize) => packBento(items, size).map(x => x.span);

describe('gridSizeFor', () => {
  it('corta en 1100 y 1440', () => {
    expect(gridSizeFor(768)).toBe('md');
    expect(gridSizeFor(1099)).toBe('md');
    expect(gridSizeFor(1100)).toBe('lg');
    expect(gridSizeFor(1439)).toBe('lg');
    expect(gridSizeFor(1440)).toBe('xl');
    expect(gridSizeFor(2560)).toBe('xl');
  });
});

describe('packBento · nunca deja huecos', () => {
  const sizes: GridSize[] = ['xl', 'lg', 'md'];

  it('cualquier combinación de 1 a 8 bloques, angostos y anchos, llena filas de 12', () => {
    // Todas las secuencias posibles de anchos (1 o 2) de hasta 8 bloques.
    for (let n = 1; n <= 8; n++) {
      for (let mask = 0; mask < (1 << n); mask++) {
        const items = Array.from({ length: n }, (_, i) => it_('b' + i, (mask >> i) & 1 ? 2 : 1));
        for (const size of sizes) {
          const sums = rowSums(spans(items, size));
          expect(sums.every(s => s === 12), `n=${n} mask=${mask} ${size} → ${sums}`).toBe(true);
        }
      }
    }
  });

  it('monitor: tres angostos por fila (4 + 4 + 4)', () => {
    expect(spans([it_('a'), it_('b'), it_('c')], 'xl')).toEqual([4, 4, 4]);
  });

  it('monitor: un ancho y un angosto comparten fila (8 + 4)', () => {
    expect(spans([it_('evol', 2), it_('proy')], 'xl')).toEqual([8, 4]);
  });

  it('si a la fila le sobra lugar, se estira el último', () => {
    expect(spans([it_('a'), it_('b')], 'xl')).toEqual([4, 8]);
    expect(spans([it_('solo')], 'xl')).toEqual([12]);
  });

  it('un ancho que no entra en la fila actual pasa a la siguiente (y la anterior se completa)', () => {
    // [a, b] + ancho → a y b llenan su fila (4 + 8), el ancho arranca otra.
    expect(rowSums(spans([it_('a'), it_('b'), it_('w', 2)], 'xl'))).toEqual([12, 12]);
  });

  it('notebook: dos por fila (6 + 6); un ancho ocupa la fila entera', () => {
    expect(spans([it_('a'), it_('b')], 'lg')).toEqual([6, 6]);
    expect(spans([it_('w', 2)], 'lg')).toEqual([12]);
  });

  it('tablet: todo a lo ancho', () => {
    expect(spans([it_('a'), it_('b', 2), it_('c')], 'md')).toEqual([12, 12, 12]);
  });

  it('conserva el orden de los bloques', () => {
    const keys = packBento([it_('cat'), it_('pm'), it_('top'), it_('evol', 2)], 'xl').map(x => x.key);
    expect(keys).toEqual(['cat', 'pm', 'top', 'evol']);
  });
});
