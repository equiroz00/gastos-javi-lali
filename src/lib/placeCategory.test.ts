import { describe, it, expect } from 'vitest';
import { placeTypeToCategory } from './placeCategory';

describe('placeTypeToCategory', () => {
  it('mapea rubros de comida a Alimentación', () => {
    expect(placeTypeToCategory(['restaurant', 'point_of_interest'])).toBe('🍕 Alimentación');
    expect(placeTypeToCategory(['supermarket'])).toBe('🍕 Alimentación');
    expect(placeTypeToCategory(['cafe', 'store'])).toBe('🍕 Alimentación');
  });

  it('mapea farmacia y gimnasio a sus categorías', () => {
    expect(placeTypeToCategory(['pharmacy', 'health'])).toBe('💊 Farmacia');
    expect(placeTypeToCategory(['gym'])).toBe('💪 Gimnasio');
  });

  it('farmacia gana sobre rubros más genéricos aunque vengan mezclados', () => {
    // Una farmacia grande suele venir también como store/supermarket.
    expect(placeTypeToCategory(['supermarket', 'pharmacy', 'store'])).toBe('💊 Farmacia');
  });

  it('mapea transporte, ropa, hogar, cuidado personal y entretenimiento', () => {
    expect(placeTypeToCategory(['gas_station'])).toBe('🚌 Transporte');
    expect(placeTypeToCategory(['clothing_store'])).toBe('👕 Ropa');
    expect(placeTypeToCategory(['hardware_store'])).toBe('🏠 Hogar');
    expect(placeTypeToCategory(['beauty_salon'])).toBe('💆 Cuidado Personal');
    expect(placeTypeToCategory(['movie_theater'])).toBe('🎬 Entretenimiento');
  });

  it('devuelve null si ningún type matchea (la categoría queda como estaba)', () => {
    expect(placeTypeToCategory(['bank', 'atm'])).toBeNull();
    expect(placeTypeToCategory([])).toBeNull();
  });
});
