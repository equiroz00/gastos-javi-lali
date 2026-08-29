// ── components/LoginScreen.tsx ────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { Wallet, Ban } from 'lucide-react';
import { C, F, FONTS } from '../constants';
import { auth, provider } from '../firebase';
import { signInWithPopup, signOut } from 'firebase/auth';

export default function LoginScreen({ denied }: { denied?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  useEffect(() => {
    const fd = FONTS.Nunito;
    const l = document.createElement('link');
    l.href = 'https://fonts.googleapis.com/css2?family=' + fd.url + '&display=swap';
    l.rel = 'stylesheet';
    document.head.appendChild(l);
    document.body.style.fontFamily = fd.css;
  }, []);

  function handleGoogle() {
    setLoading(true); setErr('');
    signInWithPopup(auth, provider).catch((e: { code?: string; message?: string }) => {
      setLoading(false);
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      if (e.code === 'auth/popup-blocked') { setErr('El navegador bloqueó el popup. Habilitá los popups e intentá de nuevo.'); return; }
      if (e.code === 'auth/network-request-failed') { setErr('Sin conexión. Verificá tu internet e intentá de nuevo.'); return; }
      setErr('Error al iniciar sesión (' + e.code + '). Intentá de nuevo.');
      console.error('Auth error:', e.code, e.message);
    });
  }

  // El login se dibuja ANTES de autenticar, así que no hay preferencia de
  // variante todavía (vive en userPreferences/{usuario}). Usa siempre el
  // lenguaje "Estado de cuenta", que es el que arranca por defecto.
  return (
    <div style={{ minHeight:'100vh', background:C.navy, display:'flex', flexDirection:'column', justifyContent:'center', padding:'2rem 1.75rem', gap:'1.4rem', fontFamily:F, maxWidth:'min(520px, 100%)', margin:'0 auto', boxSizing:'border-box' }}>
      <div>
        <div style={{ width:'52px', height:'52px', borderRadius:'15px', background:C.onNavy+'24', border:'1px solid '+C.onNavy+'38', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'1.15rem' }}>
          <Wallet size={26} strokeWidth={2} color={C.onNavy} />
        </div>
        <h1 style={{ fontSize:'clamp(1.75rem, 1.2rem + 2.4vw, 2.1rem)', fontWeight:800, color:C.onNavy, margin:0, fontFamily:F, lineHeight:1.12, letterSpacing:'-0.01em' }}>
          Gastos<br />compartidos
        </h1>
        <p style={{ color:C.onNavy+'B3', marginTop:'0.65rem', marginBottom:0, fontSize:'0.9rem', lineHeight:1.5 }}>
          Todo lo que ponen Javi y Lali, en un solo saldo al día.
        </p>
      </div>

      {denied ? (
        <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:'1rem', padding:'1rem 1.5rem', textAlign:'center', maxWidth:'280px' }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:'0.5rem' }}>
            <Ban size={26} strokeWidth={2} color={C.white} />
          </div>
          <p style={{ color:C.white, fontWeight:700, margin:0, fontSize:'0.9rem' }}>Esta cuenta de Google no tiene acceso a la app.</p>
          <p style={{ color:'rgba(255,255,255,0.75)', margin:'0.4rem 0 0', fontSize:'0.75rem' }}>Tu UID de Google aún no fue agregado en el USER_MAP de constants.ts.</p>
          <button onClick={() => signOut(auth)} style={{ marginTop:'0.75rem', background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.4)', borderRadius:'0.65rem', padding:'0.5rem 1rem', color:C.white, fontWeight:700, fontSize:'0.82rem', cursor:'pointer', fontFamily:F }}>Cerrar sesión</button>
        </div>
      ) : (
        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{ width:'100%', height:'52px', padding:'0 1.25rem', borderRadius:'12px', background:C.onNavy, border:'none', cursor:loading ? 'wait' : 'pointer', fontFamily:F, fontWeight:700, fontSize:'0.9rem', color:C.navy, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.65rem', opacity:loading ? 0.7 : 1 }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            <path fill="none" d="M0 0h48v48H0z" />
          </svg>
          {loading ? 'Iniciando sesión...' : 'Entrar con Google'}
        </button>
      )}

      {!denied && (
        <p style={{ fontSize:'0.7rem', color:C.onNavy+'80', margin:0, textAlign:'center' }}>
          Solo las cuentas de Javi y Lali tienen acceso.
        </p>
      )}

      {err && (
        <div style={{ background:'rgba(0,0,0,0.25)', borderRadius:'0.75rem', padding:'0.75rem 1rem', maxWidth:'280px', textAlign:'center' }}>
          <p style={{ color:'#ffd0d0', fontSize:'0.82rem', fontWeight:700, margin:0 }}>⚠ {err}</p>
        </div>
      )}
    </div>
  );
}
