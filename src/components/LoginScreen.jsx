// ── components/LoginScreen.jsx ────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { C, F, FONTS } from '../constants';
import { auth, provider } from '../firebase';
import { signInWithPopup, signOut } from 'firebase/auth';

export default function LoginScreen(props){
  var loadState=useState(false);var loading=loadState[0];var setLoading=loadState[1];
  var errState=useState('');var err=errState[0];var setErr=errState[1];

  useEffect(function(){
    var fd=FONTS['Nunito'];
    var l=document.createElement('link');
    l.href='https://fonts.googleapis.com/css2?family='+fd.url+'&display=swap';
    l.rel='stylesheet'; document.head.appendChild(l);
    document.body.style.fontFamily=fd.css;
  },[]);

  function handleGoogle(){
    setLoading(true);setErr('');
    signInWithPopup(auth,provider).catch(function(e){
      setLoading(false);
      if(e.code==='auth/popup-closed-by-user'||e.code==='auth/cancelled-popup-request'){return;}
      if(e.code==='auth/popup-blocked'){setErr('El navegador bloqueó el popup. Habilitá los popups e intentá de nuevo.');return;}
      if(e.code==='auth/network-request-failed'){setErr('Sin conexión. Verificá tu internet e intentá de nuevo.');return;}
      setErr('Error al iniciar sesión ('+e.code+'). Intentá de nuevo.');
      console.error('Auth error:',e.code,e.message);
    });
  }

  return React.createElement('div',{style:{minHeight:'100vh',background:C.gradMain,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',gap:'1.5rem',fontFamily:F}},
    React.createElement('div',{style:{textAlign:'center',marginBottom:'1rem'}},
      React.createElement('div',{style:{fontSize:'3.5rem',marginBottom:'0.75rem'}},'💑'),
      React.createElement('h1',{style:{fontSize:'1.9rem',fontWeight:900,color:C.white,margin:0,fontFamily:F}},'Gastos Compartidos'),
      React.createElement('p',{style:{color:'rgba(255,255,255,0.8)',marginTop:'0.5rem',fontSize:'0.9rem'}},'Javi & Lali')
    ),
    props.denied
      ?React.createElement('div',{style:{background:'rgba(255,255,255,0.15)',borderRadius:'1rem',padding:'1rem 1.5rem',textAlign:'center',maxWidth:'280px'}},
          React.createElement('div',{style:{fontSize:'1.5rem',marginBottom:'0.5rem'}},'🚫'),
          React.createElement('p',{style:{color:C.white,fontWeight:700,margin:0,fontSize:'0.9rem'}},'Esta cuenta de Google no tiene acceso a la app.'),
          React.createElement('p',{style:{color:'rgba(255,255,255,0.75)',margin:'0.4rem 0 0',fontSize:'0.75rem'}},'Tu UID de Google aún no fue agregado en el USER_MAP de constants.js.'),
          React.createElement('button',{onClick:function(){signOut(auth);},style:{marginTop:'0.75rem',background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',borderRadius:'0.65rem',padding:'0.5rem 1rem',color:C.white,fontWeight:700,fontSize:'0.82rem',cursor:'pointer',fontFamily:F}},'↩ Cerrar sesión'))
      :React.createElement('button',{onClick:handleGoogle,disabled:loading,style:{width:'100%',maxWidth:'280px',padding:'1rem 1.5rem',borderRadius:'1.25rem',background:'rgba(255,255,255,0.95)',border:'none',cursor:loading?'wait':'pointer',fontFamily:F,fontWeight:700,fontSize:'1rem',color:'#333',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.75rem',boxShadow:'0 8px 24px rgba(0,0,0,0.2)',opacity:loading?0.7:1}},
          React.createElement('svg',{width:'20',height:'20',viewBox:'0 0 48 48'},
            React.createElement('path',{fill:'#EA4335',d:'M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z'}),
            React.createElement('path',{fill:'#4285F4',d:'M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z'}),
            React.createElement('path',{fill:'#FBBC05',d:'M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z'}),
            React.createElement('path',{fill:'#34A853',d:'M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z'}),
            React.createElement('path',{fill:'none',d:'M0 0h48v48H0z'})
          ),
          loading?'⏳ Iniciando sesión...':'Iniciar sesión con Google'
        ),
    err?React.createElement('div',{style:{background:'rgba(0,0,0,0.25)',borderRadius:'0.75rem',padding:'0.75rem 1rem',maxWidth:'280px',textAlign:'center'}},
      React.createElement('p',{style:{color:'#ffd0d0',fontSize:'0.82rem',fontWeight:700,margin:0}},'⚠ '+err)):null
  );
}
