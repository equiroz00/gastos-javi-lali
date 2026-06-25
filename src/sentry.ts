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
}

export { Sentry };
