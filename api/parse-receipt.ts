// ── api/parse-receipt.ts ──────────────────────────────────────────────────────
// Función serverless de Vercel (Sprint 14). La API key de Gemini vive solo acá,
// nunca en el cliente. Recibe una foto de ticket/factura en base64 y devuelve
// el JSON extraído, ya validado con el mismo schema Zod que usa el cliente.
//
// Seguridad (mismo criterio que firestore.rules / storage.rules — nunca solo
// en la UI): se exige un ID token de Firebase válido y que el uid pertenezca a
// la pareja. Sin esto, cualquiera que encuentre la URL podría gastar la cuota
// paga de Gemini.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
// Extensión .js explícita: el proyecto es ESM ("type": "module") y en runtime
// Node no resuelve imports relativos sin extensión (FUNCTION_INVOCATION_FAILED).
import { ReciboSchema } from '../src/lib/receiptSchema.js';
import { verifyCouple, bearerToken } from './_utils.js';

const MAX_BASE64_CHARS = 15 * 1024 * 1024; // ~10-11MB de imagen decodificada

const PROMPT = `Sos un extractor de datos de tickets y facturas argentinas (A, B, C).
Devolvé ÚNICAMENTE un JSON con esta forma exacta, sin texto adicional:
{
  "comercio": string o null,
  "total": number o null (el monto total final, no subtotales),
  "fecha": string "YYYY-MM-DD" o null,
  "cuit": string o null (formato NN-NNNNNNNN-N si está legible),
  "items": [{ "descripcion": string, "monto": number }] (opcional, solo si se leen claro)
}
Si un dato no se puede leer con confianza, usá null en vez de adivinar.`;

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

  const { imageBase64, mimeType } = req.body || {};
  if (typeof imageBase64 !== 'string' || typeof mimeType !== 'string' || !mimeType.startsWith('image/')) {
    res.status(400).json({ error: 'Falta la imagen o el tipo no es válido.' });
    return;
  }
  if (imageBase64.length > MAX_BASE64_CHARS) {
    res.status(400).json({ error: 'La imagen es demasiado grande.' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      }],
      config: { responseMimeType: 'application/json' },
    });

    const rawText = result.text ?? '';
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      res.status(422).json({ error: 'El modelo no devolvió JSON válido.' });
      return;
    }

    const parsed = ReciboSchema.safeParse(parsedJson);
    if (!parsed.success) {
      res.status(422).json({ error: 'La salida del modelo no matchea el formato esperado.' });
      return;
    }

    res.status(200).json(parsed.data);
  } catch (err) {
    console.error('parse-receipt error:', err);
    res.status(500).json({ error: 'No se pudo leer la factura. Probá de nuevo.' });
  }
}
