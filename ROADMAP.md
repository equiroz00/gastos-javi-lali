# Roadmap — Gastos Compartidos Javi & Lali
> Ordenado por impacto real sobre la experiencia y solidez del producto.
> Cada sprint está pensado para una sesión de trabajo.

---

## ✅ COMPLETADO

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

---

## 🔴 SPRINT 1 — Seguridad (URGENTE) ← estamos aquí

**Objetivo:** Que nadie externo pueda leer ni modificar los datos.

| Tarea | Archivo | Estado |
|-------|---------|--------|
| Firebase Auth con Google Sign-In | `App.jsx` + `firebase.js` | ✅ Entregado |
| Firestore Security Rules con whitelist de UIDs | `firestore.rules` | ✅ Entregado |
| Habilitar Google como proveedor en Firebase Console | Manual | ✅ Completado |
| Obtener UIDs reales y reemplazar placeholders | Manual | ✅ Completado |
| Deploy de reglas con Firebase CLI o Console | Manual | ✅ Completado |

**Pasos manuales para completar este sprint:**
1. Firebase Console → Authentication → Sign-in method → Google → Habilitar
2. Agregar el dominio de tu app en Authentication → Authorized domains
3. Cada uno inicia sesión → copiar UID desde Authentication → Users
4. Reemplazar `UID_DE_JAVI` y `UID_DE_LALI` en `firestore.rules` y `App.jsx` (USER_MAP)
5. Deploy de las reglas

---

## 🟠 SPRINT 2 — Arquitectura Firebase (Alto impacto, antes de escalar)

**Objetivo:** Pasar de "un documento gigante" a colecciones separadas.
Hoy cada acción reescribe ~200KB. Con colecciones, cada acción escribe ~500 bytes.

**Qué cambia:**
```
ANTES (actual)
  appdata/main → { expenses: [...], plans: [...], payments: [...], settings: {...} }

DESPUÉS
  expenses/{id}   → un doc por gasto
  plans/{id}      → un doc por plan
  payments/{id}   → un doc por pago
  settings/main   → un único doc de config
```

**Beneficios concretos:**
- Escrituras ~400x más pequeñas
- Queries filtrables del lado del servidor (ej: "gastos del período X")
- Firebase actualiza solo lo que cambió, no todo
- Menos probabilidad de conflictos si ambos cargan gastos al mismo tiempo
- Base necesaria para notificaciones push en el futuro

**Archivos a modificar:** `firebase.js`, lógica de `saveAll`, `onSnapshot`

---

## 🟠 SPRINT 3 — UX: Formulario en pasos + Toast de confirmación

**Objetivo:** Reducir la fricción en la acción más frecuente de la app.

**Formulario en pasos (Wizard):**
- Paso 1: Descripción + Monto + Moneda + Fecha (campos obligatorios)
- Paso 2: Categoría + Medio de pago + Banco (detalles)
- Paso 3: solo si es en cuotas
- La mayoría de los gastos terminan en el Paso 1 con 4 toques

**Toast de confirmación:**
- Aparece 0.3s después de guardar, dura 2s, desaparece solo
- Muestra: ícono de categoría + descripción + monto
- Reemplaza el syncMsg actual que queda estático hasta que se limpia

**Balance con breakdown al tocar:**
- Tocar la burbuja de balance abre un panel explicativo
- "Javi pagó $X en gastos compartidos, Lali pagó $Y → diferencia $Z → mitad $W"

---

## 🟡 SPRINT 4 — Estado global con Zustand

**Objetivo:** Eliminar el prop-drilling de 3–4 niveles y centralizar la lógica.

**Qué resuelve:**
- Hoy `AddEditExpense` recibe `settings`, `allCats`, `customCats`, `onSaveCats`,
  `onSubmit`, `onSubmitPlan`, `currentUser` — 7 props solo para ese componente.
- Con Zustand: cada componente consume directamente lo que necesita.

```js
// Antes
<AddEditExpense settings={settings} allCats={allCats} customCats={customCats}
  onSaveCats={saveCustomCats} onSubmit={handleAdd} onSubmitPlan={handleAddPlan}
  currentUser={currentUser} onCancel={...} />

// Después
function AddEditExpense() {
  const { settings, allCats, addExpense, addPlan } = useAppStore()
  // ...
}
```

**Instalación:** `npm install zustand`
**Archivos:** nuevo `src/store/useAppStore.js`, todos los componentes simplificados

---

## 🟡 SPRINT 5 — Separación en archivos (Refactoring)

**Objetivo:** Pasar de 1 archivo de ~960 líneas a módulos mantenibles.

```
src/
├── components/
│   ├── AddEditExpense.jsx
│   ├── Dashboard.jsx
│   ├── History.jsx
│   ├── Stats.jsx
│   ├── Settings.jsx
│   ├── LoginScreen.jsx
│   └── ui/
│       ├── Card.jsx
│       ├── SearchBox.jsx
│       ├── SegBtn.jsx
│       ├── Toast.jsx
│       └── ConfirmDialog.jsx
├── lib/
│   ├── plans.js          ← generatePlanExpenses, reassignPlanExpenses
│   ├── formatting.js     ← fmt, fmtS, catEm, catLb, getPeriod
│   └── calculations.js  ← calcAmts, safeN, sortByDate
├── constants.js          ← THEMES, DEFAULT_CATS, PAY_METHODS, BANKS, etc.
├── store/
│   └── useAppStore.js
├── firebase.js
└── App.jsx               ← solo router/shell, <100 líneas
```

**Beneficio principal:** Cuando haya un bug en el cálculo de cuotas, buscás en
`lib/plans.js` y no navegás 960 líneas para encontrarlo.

---

## 🟡 SPRINT 6 — Migración a TypeScript

**Objetivo:** Detectar errores antes de correr la app. Documentación viva.

**Estrategia:** Migración incremental — un archivo por sprint, empezando por
`lib/` donde vive la lógica crítica.

```ts
// Ejemplo: expense tipado
interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: 'ARS' | 'USD' | 'EUR' | string;
  date: string;           // 'YYYY-MM-DD'
  period: string;
  paidBy: 'Javi' | 'Lali';
  responsible: 'Javi' | 'Lali' | 'Ambos';
  category: string;
  paymentMethod: string;
  bank: string;
  javiAmount: number;
  laliAmount: number;
  fromPlan?: boolean;
  planId?: string;
  installmentNum?: number;
  numInstallments?: number;
}
```

**Instalación:** `npm install -D typescript @types/react @types/react-dom`

---

## 🟢 SPRINT 7 — Estadísticas avanzadas

**Objetivo:** Que los números cuenten una historia, no solo muestren datos.

**Features:**
- Comparativa por categoría vs período anterior (% de cambio con flecha y color)
- Gráfico de área apilada: evolución del gasto por categoría a lo largo del tiempo
- "Gasto proyectado": si llevás 15 días del período y gastaste $X, la app estima
  el total al cierre basándose en el promedio diario
- Ranking de gastos más frecuentes por categoría

**Herramienta sugerida:** Migrar de Recharts a **Nivo** para estos gráficos
(`npm install @nivo/core @nivo/bar @nivo/line @nivo/pie`)

---

## 🟢 SPRINT 8 — Migración a Vercel + CI/CD

**Objetivo:** Deploy automático en cada push. Eliminar pasos manuales.

**Pasos:**
1. Crear cuenta en vercel.com → conectar repositorio de GitHub
2. Vercel detecta Vite automáticamente
3. Agregar variables de entorno de Firebase en Vercel Dashboard
4. Cada `git push` a `main` → deploy automático en ~30 segundos
5. Cada Pull Request → preview URL única para testear antes de mergear

**Variables de entorno a configurar en Vercel:**
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
```

---

## 🟢 SPRINT 9 — App nativa con Capacitor (opcional)

**Objetivo:** Publicar en App Store y/o Play Store si en algún momento lo deseás.

**Qué es Capacitor:** Envuelve tu app React existente en una shell nativa sin
reescribir nada. Accedés a APIs nativas: notificaciones push, widgets, haptics.

**Instalación:**
```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npx cap init
npx cap add ios
npx cap add android
```

**Cuándo encararlo:** Cuando la app esté estable, los sprints anteriores
completados, y sientan que la usan suficiente como para querer tenerla como
app real en el celular.

---

## 🟢 SPRINT 10 — Accesibilidad y PWA completa

**Objetivo:** App funcional offline y accesible.

**Accesibilidad:**
- `aria-label` en todos los botones icon-only
- `htmlFor` en todos los labels apuntando a su `id`
- Contraste WCAG AA en todos los temas de color
- Navegación por teclado en formularios

**PWA offline:**
- Service Worker con Workbox (viene con Vite PWA plugin)
- Los gastos cargados sin conexión se sincronizan cuando vuelve internet
- Instalable desde el navegador en iOS y Android

---

## Resumen visual

```
URGENTE    Sprint 1  ██████████ Seguridad Firebase       ← HOY
           Sprint 2  ██████████ Arquitectura colecciones
IMPACTO    Sprint 3  ██████████ UX formulario + toast
ALTO       Sprint 4  ████████   Zustand state management
           Sprint 5  ████████   Separación en archivos
           Sprint 6  ██████     TypeScript
IMPACTO    Sprint 7  ██████     Stats avanzadas
MEDIO      Sprint 8  ████       Vercel + CI/CD
           Sprint 9  ████       Capacitor (nativo)
           Sprint 10 ████       Accesibilidad + PWA
```
