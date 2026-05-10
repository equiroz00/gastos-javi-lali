// ── firebase.js ───────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCxom9WBpcNkB8LKzVVGboI1Ed7DwGTUsw",
  authDomain: "gastos-javi-lali.firebaseapp.com",
  projectId: "gastos-javi-lali",
  storageBucket: "gastos-javi-lali.firebasestorage.app",
  messagingSenderId: "931161524695",
  appId: "1:931161524695:web:85d550be1abdd597796392"
};

const app      = initializeApp(firebaseConfig);
export const db       = getFirestore(app);
export const auth     = getAuth(app);
export const provider = new GoogleAuthProvider();

// Nota: dataDoc (appdata/main) ya no se exporta.
// Las referencias a colecciones se construyen en App.jsx con collection(db, '...').
// Si existe appdata/main, la función runMigrationIfNeeded() en App.jsx lo migra
// automáticamente a la nueva estructura la primera vez que un usuario autorizado inicia sesión.