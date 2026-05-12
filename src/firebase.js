// ── firebase.js ───────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app      = initializeApp(firebaseConfig);
export const db       = getFirestore(app);
export const auth     = getAuth(app);
export const provider = new GoogleAuthProvider();

// Nota: dataDoc (appdata/main) ya no se exporta.
// Las referencias a colecciones se construyen en App.jsx con collection(db, '...').
// Si existe appdata/main, la función runMigrationIfNeeded() en App.jsx lo migra
// automáticamente a la nueva estructura la primera vez que un usuario autorizado inicia sesión.