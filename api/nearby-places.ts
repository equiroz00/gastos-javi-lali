// ── api/nearby-places.ts ──────────────────────────────────────────────────────
// Función serverless de Vercel (Sprint 14 — ubicación). La key de Google Maps
// Platform vive solo acá, nunca en el cliente. Recibe lat/lng del navegador y
// devuelve los comercios cercanos (Places API New, Nearby Search) para sugerir
// descripción y categoría al cargar un gasto.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCouple, bearerToken } from './_utils';

interface PlaceSugerido {
  nombre: string;
  types: string[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const idToken = bearerToken(req.headers.authorization);
  if (!idToken || !(await verifyCouple(idToken))) {
    res.status(401).json({ error: 'No autorizado.' });
    return;
  }

  const { lat, lng } = req.body || {};
  if (typeof lat !== 'number' || typeof lng !== 'number'
      || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: 'Coordenadas inválidas.' });
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar GOOGLE_MAPS_API_KEY en el servidor.' });
    return;
  }

  try {
    const resp = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // FieldMask mínima = SKU más barato (solo id/nombre/types).
        'X-Goog-FieldMask': 'places.displayName,places.types',
      },
      body: JSON.stringify({
        maxResultCount: 8,
        rankPreference: 'DISTANCE',
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius: 120 },
        },
        languageCode: 'es',
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error('Places API error:', resp.status, body);
      res.status(502).json({ error: 'No se pudieron buscar comercios cercanos.' });
      return;
    }

    const data = await resp.json();
    const places: PlaceSugerido[] = (data.places || [])
      .map((p: { displayName?: { text?: string }; types?: string[] }) => ({
        nombre: p.displayName?.text || '',
        types: Array.isArray(p.types) ? p.types : [],
      }))
      .filter((p: PlaceSugerido) => p.nombre);

    res.status(200).json({ places });
  } catch (err) {
    console.error('nearby-places error:', err);
    res.status(500).json({ error: 'No se pudieron buscar comercios cercanos.' });
  }
}
