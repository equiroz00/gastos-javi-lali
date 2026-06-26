# CLAUDE.md — Gastos Compartidos Javi & Lali

> Contexto permanente del proyecto. Claude Code lo lee automáticamente al iniciar cada sesión.
> Mantener por debajo de ~200 líneas. Las reglas de acá ganan sobre el fraseo casual de un prompt.

## Qué es

App web de finanzas personales para dos personas (Javi y Lali) que registran y dividen
gastos compartidos. Se organiza por **períodos de facturación de tarjeta de crédito**
(NO por meses calendario). Soporta multi-moneda (ARS principal, USD, EUR) y cuotas.
UI en español rioplatense.

## Stack

- React + Vite + TypeScript
- Firebase: Auth (Google Sign-In) + Firestore
- Estado de UI: Zustand (`src/store/useAppStore`)
- Gráficos: Recharts
- Íconos: Lucide React como sistema principal (ej. `CatIcon`). Los emojis existentes (categorías, etiquetas de tema, glifos `✓`/`⚠`) quedan; preferí Lucide para UI nueva
- Estilos: **inline styles** tipados con tokens de tema (objeto `C`, más `FS`/`SHELL_MAXW`) en `src/constants.ts`; responsive con `clamp()` y grillas `auto-fit`. *Plan futuro:* migrar a **Tailwind CSS**
- Deploy: Vercel con CI/CD (push a `main` = deploy automático)

## Arquitectura de datos (Firestore)

Cuatro colecciones separadas (NO un documento monolítico):

- `expenses/{id}` — un doc por gasto
- `plans/{id}` — un doc por plan de cuotas
- `payments/{id}` — un doc por pago entre usuarios
- `settings/main` — único doc de configuración

Razón: escrituras chicas (~500 B en vez de ~200 KB) y queries filtrables del lado del servidor.

## Reglas inviolables

1. **Períodos = ciclos de facturación**, no meses. La lógica de `getPeriod` es crítica;
   tocarla con cuidado. Caso borde conocido: fechas que caen entre períodos configurados
   devuelven `'Sin período'`; no romper la detección de duplicados por esto.
2. **Privacidad en Firestore Security Rules, nunca solo en la UI.** Un dato privado se
   protege con reglas (`resource.data.ownerId == request.auth.uid`), no ocultándolo en el cliente.
3. **El tema "Original" de Lali se preserva siempre**; es su preferencia.
4. **Las cifras monetarias se muestran con JetBrains Mono.**
5. **Auth:** `signInWithPopup` (no `signInWithRedirect`; se eligió tras debuggear cookies de
   terceros en Chrome).
6. Los cambios de modelo de datos se **baten juntos** para no migrar Firestore dos veces
   (ver ROADMAP, Sprint 11).

## Convenciones de herramientas (qué usar cuando aplique)

- **Validación de datos** (montos, monedas, splits, salida del OCR): **Zod**.
  Nada entra a Firestore sin validar.
- **Datos remotos de Firestore** (lectura / caché / refetch): **TanStack Query**.
  Zustand queda para estado de UI, no para datos del servidor.
- **Errores en producción:** **Sentry**.
- **Componentes en aislamiento / sistema de temas:** **Storybook**.
- **Tests E2E** (sobre todo la lógica de períodos): **Playwright**.
- **Lint + formato:** **Biome** (si está configurado).

Si alguna de estas no está instalada todavía, **proponé instalarla antes de usarla**;
no asumas que ya existe.

## Cómo trabajamos

- **Leé el código real antes de proponer cambios.** No asumas rutas ni contenido: este repo
  también se edita desde otra conversación, así que el estado puede haber cambiado. Verificá
  los archivos relevantes primero.
- Para cambios grandes (modelo de datos, arquitectura): **mostrá un plan antes de escribir
  código** y esperá el OK.
- Scope acotado: **una tarea = un sprint del ROADMAP.** No te adelantes a otros sprints sin avisar.
- Después de editar: corré typecheck y lint (y tests si existen). No declares "listo" sin que compile.
- Javi no es dev profesional pero entiende arquitectura: **explicá brevemente el porqué** de cada
  decisión, no solo el qué.
- Commits y PRs en español, descriptivos.

## Dónde está cada cosa

- `src/components/` — UI (AddEditExpense, Dashboard, History, Stats, Settings, LoginScreen, `ui.tsx`)
- `src/lib/helpers.ts` — `fmt`, `getPeriod`, generación/reasignación de cuotas y cálculo de montos/saldos (todo junto, NO en módulos separados)
- `src/lib/useIsDesktop.ts` — `useBreakpoint` / `useIsDesktop` (responsive)
- `src/constants.ts` — THEMES (3: Original, Budget Flow, Oscuro), FS, SHELL_MAXW, DEFAULT_CATS, PAY_METHODS, BANKS
- `src/store/useAppStore.ts` — estado global
- `src/firebase.js` — init y sync
- `firestore.rules` — reglas de seguridad
- `ROADMAP.md` — plan de sprints y decisiones (fuente de verdad del avance)

## Roadmap

El detalle del avance y los próximos sprints vive en `ROADMAP.md`. Consultalo antes de
empezar una tarea nueva.
