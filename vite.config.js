import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// El plugin de Sentry sube los source maps SOLO si hay auth token (lo setea
// Vercel en el build). Sin token (local / CI de GitHub) no se activa, así esos
// builds no fallan ni dependen de secretos.
const sentryEnabled = !!process.env.SENTRY_AUTH_TOKEN

export default defineConfig({
  build: {
    // Source maps solo cuando se van a subir a Sentry; el plugin los borra del
    // dist tras subirlos, así no quedan servidos públicamente.
    sourcemap: sentryEnabled,
  },
  plugins: [
    react(),
    // PWA: instalable en el teléfono + caché del shell de la app para abrir
    // sin conexión (los datos offline los maneja Firestore con IndexedDB).
    VitePWA({
      // 'autoUpdate': cada versión nueva toma el control APENAS se descarga
      // (skipWaiting + clientsClaim en el sw.js). La siguiente vez que se abre o
      // recarga la app, ya es la nueva. UpdateBanner además avisa "Hay una
      // versión nueva" para recargar en el momento.
      //
      // Se probó 'prompt' (la versión nueva espera a que el usuario toque
      // "Actualizar") y se descartó: el aviso que la activa vive en la versión
      // NUEVA, así que la primera vez quedaba esperando para siempre — la página
      // seguía en la vieja hasta cerrar TODAS las ventanas de la app, cosa que
      // en el celular casi nunca pasa. Se reprodujo sirviendo una versión y
      // después la otra en el mismo origen.
      //
      // El riesgo de 'autoUpdate' (una página vieja abierta pide un archivo que
      // la versión nueva ya borró, p. ej. al entrar a Stats) lo cubre
      // UpdateBanner: ante ese error recarga sola.
      registerType: 'autoUpdate',
      // El registro lo hace UpdateBanner a mano (para buscar versiones nuevas
      // periódicamente y avisar); el script automático solo registraba.
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Gastos Javi & Lali',
        short_name: 'Gastos',
        description: 'Gastos compartidos de Javi y Lali',
        lang: 'es',
        display: 'standalone',
        theme_color: '#174871',
        background_color: '#F2F3F4',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // La versión nueva se activa sola al instalarse (skipWaiting) y toma el
        // control de las páginas abiertas (clientsClaim). Hay que decirlo
        // EXPLÍCITO: con vite-plugin-pwa 1.x, 'autoUpdate' no lo pone en el
        // sw.js — espera que la página le mande un mensaje, y el script de
        // registro viejo nunca lo mandaba. Por eso la app quedaba vieja en el
        // celular hasta cerrar todas sus ventanas.
        skipWaiting: true,
        clientsClaim: true,
        // No interceptar las rutas internas de Firebase Auth (popup de Google).
        navigateFallbackDenylist: [/^\/__/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
    // Sentry al final: sube source maps en el build de producción (Vercel) para
    // que los stack traces sean legibles. Inactivo sin SENTRY_AUTH_TOKEN.
    ...(sentryEnabled
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
          telemetry: false,
        })]
      : []),
  ],
  base: '/',
})
