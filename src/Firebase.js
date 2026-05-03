import { initializeApp } from 'firebase/app';
import { getFirestore, doc } from 'firebase/firestore';

// Reemplazá estos valores con los de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCxom9WBpcNkB8LKzVVGboI1Ed7DwGTUsw",
  authDomain: "gastos-javi-lali.firebaseapp.com",
  projectId: "gastos-javi-lali",
  storageBucket: "gastos-javi-lali.firebasestorage.app",
  messagingSenderId: "931161524695",
  appId: "1:931161524695:web:85d550be1abdd597796392"
};

const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);

// Documento único donde viven todos los datos compartidos
export const dataDoc = doc(db, 'gastos', 'compartidos');