import React from 'react';
import ReactDOM from 'react-dom/client';
import { AlertTriangle } from 'lucide-react';
import { Sentry } from './sentry';
import App from './App';

// Pantalla de respaldo si la app crashea: en vez de quedar en blanco, muestra un
// mensaje claro y un botón para recargar. El error ya quedó reportado en Sentry.
// Estilos autocontenidos (no dependen del sistema de temas, por si el crash es
// justamente del tema).
function CrashFallback() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#F2F3F4', color: '#174871', textAlign: 'center' }}>
      <div style={{ maxWidth: '360px' }}>
        <AlertTriangle size={40} strokeWidth={2} color="#A77693" style={{ marginBottom: '0.75rem' }} />
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem' }}>Algo salió mal</h1>
        <p style={{ fontSize: '0.9rem', color: '#8a7a85', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
          Tuvimos un problema inesperado. Ya quedó registrado y lo vamos a revisar. Probá recargar la página.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ background: '#174871', color: '#FFFFFF', border: 'none', borderRadius: '0.75rem', padding: '0.7rem 1.4rem', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Recargar
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
