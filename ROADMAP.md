# Roadmap — Gastos Compartidos Javi & Lali
> Ordenado por impacto real sobre la experiencia y solidez del producto.
> Cada sprint está pensado para una sesión de trabajo.

> **Última actualización:** 05/07/2026 · Ver [Registro de cambios](#registro-de-cambios) al final.

---

## ✅ COMPLETADO

**Base original**
- Sistema de períodos de cierre
- Multi-moneda (ARS, USD, EUR)
- Cuotas nuevas y retroactivas
- Firebase Realtime sync
- Exportación CSV
- Categorías personalizadas
- Búsqueda completa en Historial
- Estadísticas con múltiples tipos de gráfico
- Registro de pagos entre usuarios
- Temas visuales

**Sprints 1–8 (todos entregados)**

| Sprint | Qué resolvió | Estado |
|--------|--------------|--------|
| 1 — Seguridad Firebase | Google Sign-In + Security Rules con whitelist de UIDs. `signInWithPopup` elegido tras debuggear cookies de terceros en Chrome | ✅ |
| 2 — Arquitectura Firebase | De un documento monolítico (~200KB por escritura) a 4 colecciones separadas (`expenses`, `plans`, `payments`, `settings`). Escrituras ~400x más chicas | ✅ |
| 3 — UX formulario + toast | Wizard por pasos, toast de confirmación, breakdown del balance al tocar | ✅ |
| 4 — Estado global con Zustand | Eliminado el prop-drilling; `useAppStore` centraliza la lógica | ✅ |
| 5 — Separación en archivos | De 1 archivo de ~960 líneas a módulos (`components/`, `lib/`, `constants.js`, `store/`) | ✅ |
| 6 — Migración a TypeScript | Incremental con `allowJs: true`; `.tsx` en componentes tipados, `.jsx` en el resto | ✅ |
| 7 — Estadísticas avanzadas | Comparativas por período, gasto proyectado, rankings | ✅ |
| 8 — Vercel + CI/CD | Deploy automático en cada push; preview URLs por PR | ✅ |

**Fase de diseño (overhaul visual — varias sesiones)**
- Reducción a **2 temas** (Original, Oscuro con acento esmeralda) — *luego ampliado a 3 con el rediseño Budget Flow (ver abajo)* — y **3 fuentes** (Nunito, Plus Jakarta, Jost) + **JetBrains Mono** permanente para cifras monetarias
- Reemplazo de todos los emoji por íconos **Lucide**, incluyendo `CatIcon` custom
- Header unificado del dashboard (Balance + Período + Total) y header de app plano con ícono Wallet
- **Layout responsive de escritorio** con navegación lateral (sidebar)
- Función `coerceTheme`/`coerceFont` para migrar preferencias legacy de Firestore
- Vista agregada "Todos los períodos" (excluye cuotas sin asignar del balance)
- Editar/eliminar pagos registrados, campo de notas opcional, registro de pagos por período

**Rediseño Budget Flow + responsive fluido (jun 2026 · mergeado)**
- Overhaul visual inspirado en la app *Budget Flow* (estética iOS): tarjetas planas, **anillos donut** ("¿Quién pagó más?" y gasto por categoría), **barra de pestañas iOS**, balance y monto como elementos protagonistas
- **Tercer tema "Budget Flow"** (iOS claro con acento violeta) junto a Original y Oscuro; el selector de tema pasa a 3 tarjetas con sus colores
- **Contraste del tema oscuro** saneado con tokens semánticos `danger`/`warn`/`ok` por tema (claros en oscuro)
- **Responsive web design fluido**: `useBreakpoint` + tokens `clamp()`/`auto-fit`; sin el tope seco de 480px; grillas que reflowean; tipografía fluida en balance, monto y títulos
- Entregado en **PR #2** (rediseño) y **PR #3** (responsive)

---

## 🟢 SPRINT 9 — App nativa con Capacitor (opcional · ⛔ bloqueado)

**Objetivo:** Publicar en App Store y/o Play Store.

**Estado:** Prerrequisitos discutidos, no implementado.
**Bloqueante:** se desarrolla en Windows sin Mac. Android es posible; **iOS requiere un build en macOS** (Xcode). Camino viable hoy: encarar solo Android, o usar un servicio de build en la nube para iOS más adelante.

**Instalación:**
```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npx cap init
npx cap add android   # ios queda pendiente por el bloqueante
```

---

## 🟢 SPRINT 10 — Accesibilidad y PWA completa

**Objetivo:** App funcional offline y accesible. **Estado:** pendiente.

**Accesibilidad:**
- `aria-label` en todos los botones icon-only (importante ahora que todo es ícono Lucide)
- `htmlFor` en labels apuntando a su `id`
- Contraste WCAG AA en ambos temas
- Navegación por teclado en formularios

**PWA offline:** *(parcialmente arrancado: `vite-plugin-pwa` ya genera `sw.js` + precache en el build; falta lo de abajo)*
- Service Worker con Workbox (Vite PWA plugin)
- Gastos cargados sin conexión que se sincronizan al volver internet
- Instalable desde el navegador en iOS y Android

---

# 🚀 FASE 2 — Evolución del producto
> Discutido en sesiones de planificación post-diseño. Orden propuesto; reordenable según prioridad.

## 🛠️ Tooling de equipo senior (transversal)

No son features de usuario, son infraestructura que sostiene todo lo de abajo. Sugerido adoptar en este orden:

| Herramienta | Para qué | Prioridad |
|-------------|----------|-----------|
| **Sentry** | Visibilidad de errores en producción (qué falló, en qué dispositivo, con stack trace). Gratis. | ✅ Hecho (PR #4) |
| **TanStack Query + Zod** | Caché/sincronización de datos de Firestore + validación tipada. Ataca de raíz los bugs recurrentes de scoping de períodos. | ✅ Hecho (PRs #8–#13) |
| **Storybook** | Catálogo vivo de componentes para domar el sistema de temas/fuentes. | 🟠 Media |
| **Playwright** | Tests E2E de la lógica de períodos (ej: que un pago no se aplique a todos los períodos). | 🟠 Media |
| **Biome** | Lint + formato todo-en-uno, más rápido que ESLint + Prettier. | 🟡 Baja |

> **Nota:** Zod es prerrequisito de los Sprints 11–14 (valida splits, montos y la salida del OCR antes de tocar Firestore).

## ✨ Nuevas funcionalidades (orden de implementación recomendado)

### 🟢 SPRINT 11 — Esquema de datos unificado (base de 12 y 13) — ✅ Hecho
**Objetivo:** Rediseñar el esquema del gasto **una sola vez** para soportar tanto gastos compartidos-con-split como gastos privados.
**Por qué primero:** los Sprints 12 y 13 tocan el mismo campo del modelo. Si se hacen por separado, se migra Firestore dos veces.
**Incluye:** campo de `visibilidad` (compartido/privado) + bloque de split normalizado (`paidBy` + `splitAmong` con estrategia: iguales / montos / porcentajes / shares) + reglas de seguridad que lo respalden.
**Estado:** ✅ Entregado en **PRs #14** (esquema + migración), **#15** (balance a `resolveSplit`, excluye privados) y **#16** (privados + dual-query + reglas). Reglas desplegadas y privacidad verificada con las 2 cuentas. C2 (selector visual de las 4 estrategias) quedó completado en Sprint 13.

### 🟢 SPRINT 12 — Gastos individuales / privados — ✅ Hecho
**Objetivo:** Que la app también sea un tracker personal; gastos visibles solo para quien los carga.
**Punto crítico:** la privacidad se impone en las **Firestore Security Rules** (`resource.data.ownerId == request.auth.uid`), NUNCA solo ocultando en la UI.
**Hecho:** en Sprint 11 la base (`visibilidad`/`ownerId`, reglas `canSee`/`canOwn`, dual-query, toggle Compartido/Privado) + los fixes de privacidad (borrado y fuga por el feed de actividad, PR #18); y en Sprint 12 la **pestaña "Personal"** ("¿cuánto gasté *yo*?" = privados propios + mi parte de los compartidos vía `resolveSplit`; PR #19).

### 🟢 SPRINT 13 — División entre N personas — ✅ Hecho
**Objetivo:** Repartir gastos entre 1…n personas, no solo Javi/Lali.
**El trabajo real** no es la UI sino la matemática: el saldo deja de ser un número y pasa a ser un **grafo de deudas**.
**Incluye:** algoritmo de **simplificación de deudas** (minimizar transferencias, como Splitwise).
**Decisión de arranque:** las personas extra son **etiquetas** para repartir (no usuarios con cuenta). Cubre el 90% del uso real con una fracción del esfuerzo.
**Estado:** ✅ Entregado en **PRs #21** (núcleo: `computeBalances` + `simplifyDebts`), **#22** (personas en Config + SplitModal N con las 4 estrategias — cierra **C2**) y **#23** (Inicio con saldos por persona + liquidación mínima + PaymentModal generalizado). Cualquier participante puede ser quien pagó.

### 🔵 SPRINT 14 — Lector de facturas (OCR) + ubicación
**Objetivo:** Foto del ticket → la app extrae comercio, total, fecha, CUIT, ítems; el usuario solo corrige lo mal leído (human-in-the-loop).
**Enfoque recomendado:** modelo de **visión multimodal** que devuelve JSON estructurado (mejor que OCR de plantilla para tickets/facturas A-B-C argentinas), validado con **Zod**.
**Seguridad:** la API de IA va detrás de una **función serverless** (Vercel/Cloud Function), nunca con la key en el cliente. Fotos en **Firebase Storage**, no en Firestore.
**Mapa:** Geolocation API (dónde estás al cargar) + Google Places API (resolver el comercio extraído). Autocompletar categoría según el rubro del lugar.

### 🔵 SPRINT 15 — Promociones bancarias
**Objetivo:** Resumir promos vigentes de *nuestras* tarjetas/bancos en una pestaña.
**Realidad técnica:** no existe API unificada de promos en Argentina; la data vive dispersa y en texto legal. Los agregadores (PromoArg, etc.) la mantienen a mano.
**Enfoque recomendado (híbrido):** lista curada de patrones recurrentes de *nuestras* tarjetas + refresco bajo demanda con **IA + web search** que el usuario verifica. Siempre linkear la fuente y mostrar vigencia.
**Ventaja única:** cruzar las promos con el contexto que la app ya tiene (qué tarjetas tenés, en qué día y a cuántos días del cierre estás). Eso ningún agregador genérico lo hace.

---

## Resumen visual

```
HECHO      Sprints 1–8  ██████████ Seguridad → CI/CD            ✅
           Diseño       ██████████ Overhaul visual completo     ✅

PENDIENTE  Sprint 9     ████       Capacitor (nativo)   ⛔ bloqueado (sin Mac)
(original) Sprint 10    ████       Accesibilidad + PWA

FASE 2     Tooling      ██████████ Sentry ✅, TanStack Query+Zod ✅, Storybook…
           Sprint 11    ██████████ Esquema de datos unificado   ✅
           Sprint 12    ██████████ Gastos privados + pestaña Personal   ✅
           Sprint 13    ██████████ División entre N personas         ✅
           Sprint 14    ████████   Lector de facturas (OCR) + mapa
           Sprint 15    ██████     Promociones bancarias
```

---

## Registro de cambios

**05/07/2026 — Sprint 13: división entre N personas (grafo de deudas) (Claude)**
- **Núcleo de saldos** (PR #21): `computeBalances` (saldo neto por participante, excluye privados, filtra por moneda) + `simplifyDebts` (transferencias mínimas estilo Splitwise, ≤ n−1 movimientos que saldan exacto). Tipos ensanchados (`paidBy`/`from`/`to` de `UserName` a `string`), **sin migración de Firestore**. +9 tests.
- **Personas + reparto N** (PR #22): sección "Personas" en Config (etiquetas; `savePeople`/`usePeople` en `settings/main`); `SplitModal` reescrito para N participantes con las 4 estrategias (iguales/montos/porcentajes/shares) — **cierra C2** — con precarga sensata, ayudas por estrategia y la barra de % para el caso de 2 personas.
- **Inicio: saldos + liquidación** (PR #23): la tarjeta de Inicio muestra el saldo por persona y las **transferencias mínimas** ("cómo saldar"), cada una con botón para registrar el pago; `PaymentModal` generalizado (from/to entre cualquier participante). + fix de inputs de fecha en Config.
- Las personas extra son **etiquetas** (no cuentas con login). Cualquier participante puede figurar como quien pagó.

**04/07/2026 — Sprint 12: pestaña Personal + fixes de privacidad (Claude)**
- **Pestaña "Personal"** (PR #19): vista dedicada "¿cuánto gasté *yo* este ciclo?" = gastos privados propios (completos) + mi parte de los compartidos (reparto real vía `resolveSplit`). Titular con total + variación vs. ciclo anterior, desglose privado/compartido y por categoría. Nuevo tab (ícono billetera) en la nav mobile y el sidebar desktop.
- **Fixes de privacidad tras probar con 2 cuentas** (PR #18): (a) el borrado estaba roto para *todos* los gastos —la regla de `delete` invocaba `canOwn(request.resource.data)` que en un delete es null—, ahora `delete` solo exige `canSee`; (b) los privados se filtraban por el feed compartido `activityLog` (el otro veía la *notificación* con descripción/monto), ahora `_logActivity` los omite; (c) se retiró la migración `runSplitMigrationIfNeeded` (lectura sin filtro que las reglas estrictas deniegan).
- **C2 diferido a Sprint 13:** el selector visual de las 4 estrategias de split se hará con N personas, donde 'shares' cobra sentido.

**30/06/2026 — Sprint 11: esquema unificado (split normalizado + gastos privados) (Claude)**
- **Split normalizado:** cada gasto/plan lleva `splitAmong` (estrategias `iguales`/`montos`/`porcentajes`/`shares`, preparado para N personas) + `visibilidad` (`compartido`/`privado`) + `ownerId`. `resolveSplit` reemplaza a `javiAmount`/`laliAmount` como fuente del reparto en toda la capa de cálculo; el balance Javi↔Lali **excluye los privados**.
- **Gastos privados:** toggle Compartido/Privado en el formulario (un privado es 100% del dueño, con `ownerId` = uid real de auth). Privacidad impuesta en **Firestore Security Rules** (`canSee`/`canOwn`): un privado solo lo ve/edita su dueño. Lectura con **dual-query** (compartidos + mis privados) porque, con reglas estrictas, una query sin filtro fallaría entera para el otro usuario.
- **Migración única y aditiva:** backfill idempotente de `splitAmong` + `visibilidad` en los docs existentes; además el parser Zod **sintetiza** `splitAmong` desde los montos viejos para cualquier doc sin migrar.
- Entregado en **PRs #14** (capa de datos + migración), **#15** (balance/displays a `resolveSplit`, excluye privados) y **#16** (privados + dual-query + reglas). **Pendiente C2:** selector visual de las 4 estrategias en el SplitModal. **Acción manual:** desplegar `firestore.rules` y verificar la privacidad con las 2 cuentas.

**30/06/2026 — Migración a TanStack Query + Zod completa (Claude)**
- Las **4 colecciones** de Firestore (`expenses`, `payments`, `plans`, `settings` + `customCats`) migradas a **TanStack Query** (datos remotos) con **validación Zod** en lectura y escritura; Zustand queda solo para estado de UI. Las anomalías de datos quedan visibles en Sentry.
- El `onSnapshot` de Firestore sigue siendo la fuente en vivo: valida con Zod y alimenta la caché con `setQueryData`. Las escrituras son optimistas con guard Zod antes de tocar Firestore.
- Entregado en **PRs #8 y #10** (expenses lectura/escritura), **#11** (payments), **#12** (plans), **#13** (settings); más **#9** que de yapa corrigió el bug de reasignación de períodos (los gastos "Sin período" se reubican solos al definir el período).

**25/06/2026 — Sentry hecho + restauración de docs (Claude)**
- **Sentry integrado** (primer ítem de tooling): `@sentry/react` + `@sentry/vite-plugin`, privacidad-first (sin PII, sin Session Replay, `beforeSend` que limpia, sin datos de gastos). Mergeado en el **PR #4**. Verificación de eventos en el dashboard: pendiente tras el deploy.
- **Restauración de CLAUDE.md y este ROADMAP:** el merge del PR #3 se resolvió contra un punto anterior de la rama y no incluyó los 3 commits de docs (`3b0100a`, `edb0ca3`, `b2d376b`); quedaron fuera de `main`. Se restauraron desde `b2d376b`. Lección: tras un merge, verificar que los archivos esperados realmente quedaron en `main`.

**24/06/2026 — Rediseño Budget Flow + responsive (Claude)**
- **Qué se hizo:** se registró el overhaul *Budget Flow* (3er tema, anillos donut, barra iOS, contraste oscuro con tokens semánticos) mergeado en el **PR #2**, y el **responsive fluido** (`clamp` + `auto-fit`) del **PR #3**. Se corrigió "2 temas → 3 temas".
- **Conflictos saneados en CLAUDE.md:** la app NO usa Tailwind (estilos inline con tokens de tema; Tailwind queda como *plan futuro*, no estado actual). Se corrigieron las rutas de "Dónde está cada cosa" (todo lo de `lib` vive en `helpers.ts`/`useIsDesktop.ts`; `ui.tsx` es archivo, no carpeta). Se suavizó la regla de emojis (los existentes quedan).
- **Detectado:** `vite-plugin-pwa` ya genera service worker + precache, así que el Sprint 10 (PWA) está parcialmente arrancado.

**22/06/2026 — Actualización mayor (Claude)**
- **Qué se hizo:** se marcaron como completados los Sprints 1–8 (el archivo todavía decía "Sprint 1 ← estamos aquí") y se documentó la fase de diseño que no figuraba en el roadmap. Se agregó la **Fase 2** con el tooling senior y cinco nuevas épicas (Sprints 11–15).
- **Por qué:** el roadmap estaba desfasado respecto al avance real. Las épicas 11–15 surgen de la sesión de planificación de nuevas funcionalidades. Se ubicó "Esquema de datos unificado" (11) **antes** de privados (12) y N personas (13) porque ambas reescriben el mismo campo del modelo de gasto: diseñarlo una vez evita migrar Firestore dos veces. Promos (15) quedó al final por ser la de mayor riesgo de mantenimiento (sin API, data dispersa). El tooling se marcó como transversal porque Zod es prerrequisito técnico de los Sprints 11–14.
