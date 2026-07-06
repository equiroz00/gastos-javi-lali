// ── firebase.js ───────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// ── App Check (reCAPTCHA v3) ──────────────────────────────────────────────────
// Solo se activa si VITE_RECAPTCHA_SITE_KEY está configurada (en .env local y
// en las variables de entorno del hosting). En desarrollo usa un debug token:
// la primera vez aparece en la consola del navegador y hay que registrarlo en
// Firebase Console → App Check → (menú ⋮ de la app) → Manage debug tokens.
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (recaptchaSiteKey) {
  if (import.meta.env.DEV) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
// Persistencia offline (IndexedDB): la app abre con los datos en caché aunque
// no haya conexión, y las escrituras hechas offline se sincronizan al volver.
// El multi-tab manager permite tener la app abierta en varias pestañas a la vez.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const auth     = getAuth(app);
export const provider = new GoogleAuthProvider();
// Fotos de tickets/facturas (Sprint 14) — reglas en storage.rules.
export const storage  = getStorage(app);

// Nota: dataDoc (appdata/main) ya no se exporta.
// Las referencias a colecciones se construyen en App.jsx con collection(db, '...').
// Si existe appdata/main, la función runMigrationIfNeeded() en App.jsx lo migra
// automáticamente a la nueva estructura la primera vez que un usuario autorizado inicia sesión.