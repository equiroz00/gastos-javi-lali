// ── api/_utils.ts ─────────────────────────────────────────────────────────────
// Helpers compartidos por las funciones serverless. El prefijo "_" hace que
// Vercel NO exponga este archivo como endpoint.
//
// Seguridad (mismo criterio que firestore.rules / storage.rules): toda función
// exige un ID token de Firebase válido y que el uid pertenezca a la pareja.
// Sin esto, cualquiera que encuentre la URL podría gastar la cuota paga de las
// APIs de Google.
//
// La verificación es criptográfica (firma RS256 contra los certificados
// públicos de Google), como recomienda Firebase para servidores. NO se usa la
// API key del proyecto: está restringida por HTTP referrer para el navegador,
// y Google bloquea esa key en llamadas server-to-server (sin referer).
import { createRemoteJWKSet, jwtVerify } from 'jose';

// Mismos UIDs que firestore.rules / storage.rules / USER_MAP en src/constants.ts.
const ALLOWED_UIDS = new Set([
  'h0FlnAU3wabBCTztmPXdLyFW6R42', // Javi
  'JjDJiAjLmVSc0WODsfvULRLT59s2', // Lali
]);

const PROJECT_ID = 'gastos-javi-lali';

// Claves públicas con las que Google firma los ID tokens de Firebase.
// jose las cachea y renueva solo entre invocaciones calientes.
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function verifyCouple(idToken: string): Promise<boolean> {
  if (!idToken) return false;
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
      algorithms: ['RS256'],
    });
    return typeof payload.sub === 'string' && ALLOWED_UIDS.has(payload.sub);
  } catch {
    return false;
  }
}

export function bearerToken(authHeader: string | undefined): string {
  const h = authHeader || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}
