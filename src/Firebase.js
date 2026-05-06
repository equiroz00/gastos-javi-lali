// ── firebase.js ───────────────────────────────────────────────────────────────
// Actualizá los valores de firebaseConfig con los de tu proyecto en Firebase Console
// (Project Settings → Your apps → SDK setup and configuration)
 
import { initializeApp } from 'firebase/app';
import { getFirestore, doc } from 'firebase/firestore';
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
export const dataDoc  = doc(db, 'appdata', 'main');