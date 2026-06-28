// ── src/sentry.ts ─────────────────────────────────────────────────────────────
// Inicialización de Sentry (captura de errores en producción).
//
// Privacidad primero — NO se envían datos de gastos:
//   · sin Session Replay (grabaría montos/descripciones en pantalla)
//   · sin PII (IP, cookies, headers)
//   · sin adjuntar documentos de Firestore a los eventos
//   · `beforeSend` como red de seguridad final
//
// Solo se inicializa si hay DSN, así en desarrollo queda apagado (sin ruido).
import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ||
      (import.meta.env.PROD ? 'production' : 'development'),
    // Sin PII y sin tracing/performance al inicio (menos volumen y menos
    // superficie de datos). Session Replay NO se activa a propósito.
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // Último filtro antes de enviar: no arrastrar request data. Hoy no se
    // adjunta nada de Firestore a los eventos; este hook es la red de seguridad.
    beforeSend(event) {
      delete event.request;
      return event;
    },
  });

  // ── TEMPORAL — disparador de prueba ─────────────────────────────────────────
  // Abrir la app con `#sentry-test` al final de la URL manda un evento de prueba
  // a Sentry, para verificar que el panel los recibe de punta a punta.
  // QUITAR este bloque una vez confirmado.
  if (window.location.hash === '#sentry-test') {
    Sentry.captureException(new Error('Prueba intencional de Sentry — se puede ignorar'));
    setTimeout(() => window.alert('Evento de prueba enviado a Sentry. Revisa Issues en ~1 minuto.'), 100);
  }
}

export { Sentry };
