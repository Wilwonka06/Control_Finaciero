# Documentación técnica — Control Financiero

## 1) Resumen ejecutivo
Control Financiero es una SPA (Single Page Application) construida con **React + TypeScript + Vite**. Su objetivo es permitir a cada usuario autenticado gestionar transacciones, metas de ahorro y análisis asistido por IA.

El frontend se conecta directamente con:
- **Firebase Authentication** para registro/inicio de sesión (Google y correo/contraseña).
- **Cloud Firestore** para persistencia en tiempo real (transacciones, metas y ajustes por usuario).
- **Google Gemini** para análisis financiero conversacional, predicción y parseo inteligente de archivos (CSV/XLSX).

## 2) Stack tecnológico

### Frontend
- React 19
- TypeScript
- Vite 6
- Tailwind CSS v4
- Recharts (gráficas)
- Lucide React (íconos)
- Motion (animaciones)

### Integraciones y utilidades
- Firebase JS SDK (Auth + Firestore)
- @google/genai (Gemini)
- ExcelJS (importación/exportación de Excel)
- react-markdown (render de respuestas de IA)

> Dependencias y scripts del proyecto definidos en `package.json`.

## 3) Arquitectura general

El proyecto sigue una arquitectura centrada en cliente:

1. **Capa de presentación y estado**
   - `src/App.tsx` contiene la mayor parte de la lógica de UI, estado local y handlers.
2. **Capa de integración externa**
   - `src/firebase.ts`: inicializa Auth/Firestore.
   - `src/services/geminiService.ts`: encapsula llamadas a Gemini.
3. **Modelo de dominio y utilidades**
   - `src/types.ts`: contratos de datos (Transaction, Goal, Currency).
   - `src/lib/utils.ts`: helpers de clases CSS y formato monetario.

## 4) Estructura de carpetas y archivos clave

- `src/main.tsx`: bootstrap de React.
- `src/App.tsx`: dashboard principal, autenticación, lógica de negocio y componentes de interfaz.
- `src/services/geminiService.ts`: funciones `analyzeFinances`, `predictFinances`, `parseExcelData`.
- `src/firebase.ts`: configuración de Firebase.
- `src/types.ts`: tipos del dominio.
- `src/firestore.rules`: reglas de seguridad de Firestore.
- `vite.config.ts`: inyección de `GEMINI_API_KEY` y configuración de build/server.
- `firebase.json`: configuración de hosting (rewrite SPA a `index.html`).

## 5) Modelo de datos

### `Transaction`
- `id: string`
- `description: string`
- `amount: number`
- `type: 'income' | 'expense'`
- `category: string`
- `date: string`

### `Goal`
- `id: string`
- `name: string`
- `targetAmount: number`
- `contributions: Contribution[]`
- `deadline?: string`
- `createdAt: string`

### `Currency`
- `code: string`
- `name: string`

## 6) Modelo de persistencia (Firestore)

Ruta por usuario:
- `users/{userId}/transactions/{transactionId}`
- `users/{userId}/goals/{goalId}`
- `users/{userId}/settings/main`

Características:
- Lectura en tiempo real con `onSnapshot` para transacciones, metas y settings.
- Ordenamiento descendente por fecha para transacciones.
- Separación total de datos por `uid`.

## 7) Seguridad

Las reglas en `src/firestore.rules` aplican:
- **Control de acceso por propiedad** (`request.auth.uid == userId`).
- **Validaciones de esquema** para transacciones, metas y settings.
- **Default deny** para cualquier ruta no contemplada.

Esto reduce riesgo de escrituras arbitrarias y lectura entre usuarios.

## 8) Autenticación

Métodos implementados:
- Google Sign-In (`signInWithPopup`).
- Correo/contraseña (`createUserWithEmailAndPassword`, `signInWithEmailAndPassword`).
- Recuperación de contraseña (`sendPasswordResetEmail`).
- Cierre de sesión (`signOut`).

El estado de sesión se escucha con `onAuthStateChanged`.

## 9) Integración con IA (Gemini)

### Funciones actuales
- `analyzeFinances(...)`: chat contextual usando transacciones/metas recientes.
- `predictFinances(...)`: estimación del siguiente mes.
- `parseExcelData(...)`: convierte CSV a transacciones estructuradas.

### Consideraciones técnicas
- Si `GEMINI_API_KEY` no está disponible, se retorna mensaje de error controlado.
- Se usan modelos `gemini-flash-latest` y `gemini-1.5-flash` según caso.
- `parseExcelData` exige respuesta JSON tipada vía `responseSchema`.

## 10) Flujo funcional principal

1. Usuario se autentica.
2. Se activan listeners de Firestore para cargar datos del usuario.
3. Usuario registra ingresos/gastos y metas.
4. Dashboard recalcula KPIs y gráficas.
5. Usuario puede:
   - importar datos (CSV/XLSX) con ayuda de Gemini,
   - exportar reporte a Excel,
   - usar chat IA para recomendaciones.

## 11) Gestión de moneda y tasas de cambio

- Moneda base interna: COP para algunos cálculos y consultas.
- Tasas de cambio: `https://open.er-api.com/v6/latest/COP`.
- Catálogo de monedas: `https://api.frankfurter.app/currencies`.
- TRM (Colombia): `https://trm-colombia.vercel.app/api/trm/current`.

El sistema implementa fallback y warnings en consola cuando no hay respuesta de APIs externas.

## 12) Build, ejecución y despliegue

### Scripts NPM
- `npm run dev`: servidor local (puerto 3000).
- `npm run build`: build de producción.
- `npm run preview`: vista local del build.
- `npm run lint`: chequeo de TypeScript sin emisión.

### Variables de entorno
- `GEMINI_API_KEY` (obligatoria para funciones IA).
- `APP_URL` (descrita en `.env.example`, útil para entornos de despliegue).

### Hosting
- Firebase Hosting configurado para servir `dist` y reescribir rutas a `index.html`.

## 13) Riesgos técnicos y deuda observada

1. **Archivo monolítico en `App.tsx`**
   - Mezcla UI, estado, lógica de negocio e integración.
   - Recomendación: dividir por módulos (features + hooks + components).

2. **Acoplamiento directo del cliente a servicios externos**
   - Llamadas a APIs públicas desde el navegador.
   - Recomendación: capa backend/BFF para control de errores, caché y observabilidad.

3. **Dependencia de IA para importación semántica**
   - Si Gemini falla o cambia respuesta, la importación se degrada.
   - Recomendación: parser determinista previo + IA como fallback.

4. **Validaciones principalmente en frontend/reglas**
   - Recomendación: validación adicional en capa backend si se introduce API propia.

## 14) Propuesta de evolución (roadmap técnico)

### Corto plazo (1–2 sprints)
- Extraer `App.tsx` en módulos:
  - `features/auth`
  - `features/transactions`
  - `features/goals`
  - `features/ai-assistant`
- Incorporar pruebas unitarias en utilidades y hooks críticos.
- Estandarizar manejo de errores con un sistema de notificaciones central.

### Mediano plazo
- Añadir backend ligero (Cloud Functions o servicio Node) para:
  - proxy seguro de IA,
  - normalización de importación,
  - auditoría y trazabilidad.
- Implementar observabilidad (errores cliente + métricas de uso).

### Largo plazo
- Motor de reglas de presupuesto.
- Alertas proactivas inteligentes.
- Multi-tenant / roles (familiar, asesor, etc.).

## 15) Guía rápida para nuevos desarrolladores

1. Instalar dependencias: `npm install`.
2. Configurar `.env.local` con `GEMINI_API_KEY`.
3. Verificar que el archivo `firebase-applet-config.json` sea válido para el proyecto Firebase objetivo.
4. Ejecutar `npm run dev`.
5. Validar tipos con `npm run lint` antes de cambios relevantes.

---

Si quieres, en el siguiente paso puedo convertir esta documentación en una versión **"arquitectura + diagramas"** (C4: Contexto, Contenedores, Componentes) para que quede lista para auditorías técnicas o handoff de equipo.
