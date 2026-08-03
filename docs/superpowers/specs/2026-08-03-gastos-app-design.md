# Gastos App — Diseño

Fecha: 2026-08-03

## Propósito

App personal (no web) para controlar gastos propios en celular y PC, con presupuesto
mensual dividido en sectores opcionales, carga rápida de gastos, ahorro de sobrantes,
cotización de dólar y visualización por gráfico de torta.

Uso individual (un solo usuario), sin relación con los proyectos de FyLabs — proyecto
y cuenta de backend completamente separados.

## 1. Arquitectura y stack

- **Frontend único (TypeScript/React)**: React Native + Expo, usando `react-native-web`
  para poder envolver la versión web con **Tauri** y generar el ejecutable de escritorio
  (Windows/Mac). Un solo código de UI para celular y PC.
- **Backend**: **Firebase** (Firestore + Firebase Auth). Proyecto y cuenta 100%
  personales, separados de cualquier cuenta de FyLabs.
- **Offline-first**: nativo de Firestore — persistencia local automática, sin necesidad
  de armar una cola de sincronización a mano. Los cambios hechos sin conexión se guardan
  localmente y se sincronizan solos al recuperar la red.
- **Cotización USD**: se consulta `dolarapi.com` (oficial y blue), se cachea localmente
  para poder mostrar valores en USD aunque no haya conexión en ese momento.
- **Distribución**: `.apk` directo para Android (sin pasar por Google Play), Expo Go
  para probar en iPhone durante desarrollo, ejecutable Tauri (`.exe`/`.dmg`) para PC.
  Sin publicación en tiendas oficiales por ahora (fuera de alcance).
- **Repositorio**: código fuente en un repositorio privado de GitHub, en la cuenta
  personal del usuario (no en la organización de FyLabs).

## 2. Modelo de datos (Firestore)

Todo bajo `/users/{uid}/...`, con reglas de seguridad de Firestore que solo permiten
leer/escribir si `request.auth.uid == uid`.

- **`budgets/{yyyy-mm}`** — `total_amount`, `currency`.
- **`sectors/{sectorId}`** — `name`, `color`, `monthly_limit` (opcional, sin tope si no
  se define).
- **`expenses/{expenseId}`** — `amount`, `currency`, `date`, `sector_id` (opcional),
  `place` (opcional), `description` (opcional), `payment_method` (opcional: efectivo /
  débito / crédito / transferencia).
- **`savings/{movementId}`** — `amount`, `currency`, `moved_at`, `note` (opcional).
  Cada "mandar a ahorro" crea un movimiento acá.
- **`settings/preferences`** (documento único) — cotización preferida (oficial/blue),
  moneda de visualización por defecto, hash del PIN de acceso.

**Cálculo del disponible acumulado**: no se persiste como campo fijo, se calcula de
forma dinámica: `presupuesto del mes + acumulado previo no ahorrado − gastos del mes`.
No hace falta "cerrar" meses manualmente.

## 3. Pantallas y UX (mobile-first)

**Home**
- Arriba: presupuesto del mes, gastado, disponible (lo más importante, primero).
- Toggle rápido ARS ⇄ USD (oficial/blue) en todos los montos.
- Gráfico de torta: % gastado por sector.
- Barra de progreso por sector con `monthly_limit` (si tiene).
- Botón flotante "+" grande para cargar gasto rápido.
- Si hay acumulado de meses anteriores: chip visible "+$X disponible de meses
  anteriores" con acceso directo a "mandar a ahorro".

**Cargar gasto**
- Campo de monto grande, foco automático, teclado numérico.
- Debajo, colapsado/opcional: sector (chips), lugar, descripción, método de pago.
- Guarda con un tap; funciona offline (indicador sutil de "pendiente de sync" sin red).

**Sectores**
- Lista editable: nombre, color, límite mensual opcional. Crear/editar/borrar.

**Historial**
- Selector de mes (swipe o dropdown), mismo resumen + gráfico de torta de ese mes.

**Ahorro**
- Total acumulado, historial de movimientos, botón para mandar más.

**Configuración**
- PIN de acceso, cotización preferida por defecto, moneda de visualización por defecto.

En PC: mismo set de pantallas en layout de 2 columnas (lista de gastos + panel lateral
con resumen/gráfico), aprovechando el espacio horizontal.

## 4. Seguridad / acceso

- Cuenta real de Firebase Auth (email + password), creada una vez, sesión persistida en
  el dispositivo (no se vuelve a pedir login).
- Encima, **lock screen con PIN de 4 dígitos** al abrir la app — acceso rápido diario;
  la sesión de Firebase de fondo es la que realmente protege los datos en la nube.
- Reglas de seguridad de Firestore restringidas por `uid`, aunque haya un solo usuario.

## 5. Fuera de alcance (MVP)

- Multiusuario / presupuesto compartido con otra persona.
- Notificaciones push (alertas de límite superado).
- Foto de ticket adjunta, fecha manual retroactiva del gasto.
- Publicación en Google Play / App Store.
- Tracking de ingresos/sueldo — la app cubre presupuesto y gastos, no ingresos.

Estos puntos quedan anotados para una posible v2, no forman parte del alcance inicial.
