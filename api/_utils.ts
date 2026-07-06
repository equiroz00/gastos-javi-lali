// ── api/_utils.ts ─────────────────────────────────────────────────────────────
// Helpers compartidos por las funciones serverless. El prefijo "_" hace que
// Vercel NO exponga este archivo como endpoint.
//
// Seguridad (mismo criterio que firestore.rules / storage.rules): toda función
// exige un ID token de Firebase válido y que el uid pertenezca a la pareja.
// Sin esto, cualquiera que encuentre la URL podría gastar la cuota paga de las
// APIs de Google.

// Mismos UIDs que firestore.rules / storage.rules / USER_MAP en src/constants.ts.
const ALLOWED_UIDS = new Set([
  'h0FlnAU3wabBCTztmPXdLyFW6R42', // Javi
  'JjDJiAjLmVSc0WODsfvULRLT59s2', // Lali
]);

export async function verifyCouple(idToken: string): Promise<boolean> {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey || !idToken) return false;
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) }
  );
  if (!resp.ok) return false;
  const data = await resp.json();
  const uid = data?.users?.[0]?.localId;
  return typeof uid === 'string' && ALLOWED_UIDS.has(uid);
}

export function bearerToken(authHeader: string | undefined): string {
  const h = authHeader || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}
