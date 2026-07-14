// ── lib/placeCategory.ts ──────────────────────────────────────────────────────
// Mapea los "types" de Google Places al set de categorías de la app (Sprint 14).
// Es una sugerencia, no una imposición: si ningún type matchea se devuelve null
// y la categoría queda como estaba (el usuario siempre puede cambiarla).
import { DEFAULT_CATS } from '../constants';

// Cada regla: lista de types de Google → categoría de DEFAULT_CATS.
// Orden importa: la primera que matchea gana (farmacia antes que "store" genérico).
const RULES: Array<{ types: string[]; cat: string }> = [
  { types: ['pharmacy', 'drugstore'],                                              cat: '💊 Farmacia' },
  { types: ['gym', 'fitness_center', 'sports_club'],                               cat: '💪 Gimnasio' },
  { types: ['restaurant', 'cafe', 'coffee_shop', 'bakery', 'bar', 'food_court',
            'meal_takeaway', 'meal_delivery', 'ice_cream_shop', 'pizza_restaurant',
            'supermarket', 'grocery_store', 'food_store', 'butcher_shop', 'market'], cat: '🍕 Alimentación' },
  { types: ['clothing_store', 'shoe_store', 'jewelry_store', 'department_store'],  cat: '👕 Ropa' },
  { types: ['hardware_store', 'home_goods_store', 'furniture_store',
            'home_improvement_store', 'electronics_store', 'appliance_store'],     cat: '🏠 Hogar' },
  { types: ['beauty_salon', 'hair_salon', 'hair_care', 'spa', 'barber_shop',
            'nail_salon'],                                                         cat: '💆 Cuidado Personal' },
  { types: ['movie_theater', 'amusement_park', 'bowling_alley', 'night_club',
            'casino', 'stadium', 'concert_hall', 'video_game_store'],              cat: '🎬 Entretenimiento' },
  { types: ['gas_station', 'parking', 'car_wash', 'car_repair', 'taxi_stand',
            'transit_station', 'bus_station', 'train_station', 'subway_station'],  cat: '🚌 Transporte' },
  { types: ['child_care_agency', 'preschool', 'toy_store'],                        cat: '👶 Hijito' },
];

export function placeTypeToCategory(types: string[]): string | null {
  for (const rule of RULES) {
    if (rule.types.some(t => types.includes(t))) {
      // Guard por si algún día se renombra una categoría default y la regla queda vieja.
      return DEFAULT_CATS.includes(rule.cat) ? rule.cat : null;
    }
  }
  return null;
}
