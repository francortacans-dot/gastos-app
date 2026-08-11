# Inversiones — Diseño

Fecha: 2026-08-11

## Propósito

Agregar una sección de inversiones a Gastos App: cargar posiciones (ticker, nominales,
PPC, moneda), venderlas parcial o totalmente, llevar el cash disponible en el broker, y
exportar el portfolio. Las inversiones se tratan como una forma más de ahorro: cuentan
para el patrimonio total de la persona, sin mezclarse con el cálculo de presupuesto
mensual (`disponible`) que ya existe para gastos.

Alcance: valuación a **costo de compra**, no a precio de mercado actual. La app no
integra ninguna API de cotización de acciones — solo la de dólar que ya usa. Mostrar
ganancia/pérdida no realizada (mark-to-market) queda fuera de alcance; solo se calcula
ganancia/pérdida **realizada** al vender.

## 1. Modelo de datos (Firestore, bajo `/users/{uid}/...`)

Sigue el mismo patrón que `expenses`/`savings`: local-first (SQLite/AsyncStorage +
cola de pendientes) con sync a Firestore cuando hay red. Reglas de seguridad ya
cubiertas por la regla existente `users/{userId}/{document=**}`.

- **`investments/{investmentId}`** — una posición/lote. Cada carga es un lote
  independiente: comprar el mismo ticker dos veces a precios distintos son dos filas,
  no se promedian entre sí.
  - `ticker: string`
  - `nominales: number` — cantidad actual restante (baja con ventas parciales)
  - `ppc: number` — precio promedio de compra tal como se tipeó, en `monedaOriginal`
  - `monedaOriginal: 'ARS' | 'USD'`
  - `cotizacionUsada: number | null` — cotización al cargar, si `monedaOriginal` es USD
  - `costoCentavosArsUnitario: number` — costo por nominal en centavos ARS, **fuente de
    verdad**. El costo total de la posición es siempre `nominales *
    costoCentavosArsUnitario`, calculado al vuelo, nunca guardado redundante.
  - `rubro: string | null` — texto libre (ej. "Tech", "Energy-ARG"), sin relación con
    los `Sector` de gastos que ya existen en la app.
  - `fecha: string` — entrada, `'YYYY-MM-DD'`
  - `status: 'OPEN' | 'CLOSED'` — pasa a `CLOSED` automáticamente cuando `nominales`
    llega a 0 por ventas.

- **`investment-sales/{saleId}`** — un registro por cada venta (parcial o total).
  - `investmentId: string`
  - `nominalesVendidos: number`
  - `precioVenta: number` — en `monedaOriginal` de la inversión vendida
  - `cotizacionUsada: number | null`
  - `ingresoCentavosArs: number` — `nominalesVendidos * precioVenta` convertido a ARS.
    Esto es lo que se suma al cash del broker.
  - `gananciaCentavosArs: number` — `ingresoCentavosArs - (nominalesVendidos *
    costoCentavosArsUnitario)`. Dato informativo, no se vuelve a sumar a ningún total
    (ya está reflejado en el ingreso que entra como cash).
  - `fecha: string`

- **`broker-cash/actual`** (documento único, mismo patrón que `settings/preferences`) —
  saldo de efectivo sin invertir en el broker.
  - `centavosArs: number` — fuente de verdad. Editable a mano desde la UI (con input de
    monto + toggle ARS/USD que convierte con la cotización, igual que en Ahorro), y se
    incrementa automáticamente por `ingresoCentavosArs` cada vez que se registra una
    venta.

## 2. Repos

Mismo patrón local-first que `expense-repo.ts` / `savings-repo.ts`
(`localStore.guardarSnapshot` + `guardarPendiente` + `setDoc`, con `suscribir` para
tiempo real cuando hay conexión):

- **`investment-repo.ts`** → `crearInvestmentRepo(deps)`:
  - `listar()`, `agregar(posición)`, `eliminar(id)`, `suscribir(cb)`
  - `venderParcial(id, { nominalesVendidos, precioVenta, cotizacionUsada, fecha })`:
    reduce `nominales`, marca `status = 'CLOSED'` si llega a 0, escribe el
    `InvestmentSale` correspondiente, e incrementa `broker-cash/actual` por
    `ingresoCentavosArs`. Es la única forma de crear un `InvestmentSale` — no tiene
    `agregar()` propio expuesto fuera del repo.
- **`investment-sale-repo.ts`** → solo lectura: `listar()`, `suscribir(cb)` — para el
  historial de ventas.
- **`broker-cash-repo.ts`** → `obtener()`, `guardar(centavosArs)` (reemplaza el valor,
  para edición manual), `sumar(centavosArs)` (usado internamente por
  `venderParcial`), `suscribir(cb)`.

Las tres colecciones nuevas se agregan a la interfaz `Repos` en `create-repo.ts`
(`investments`, `investmentSales`, `brokerCash`), igual que `expenses`/`sectors`/
`budgets`/`savings` hoy.

## 3. Dominio (cálculos puros)

Nuevo módulo `src/domain/investments.ts` (paralelo a `budget.ts`), con funciones
puras testeables:

- `costoTotalAbierto(investments: Investment[]): number` — suma de `nominales *
  costoCentavosArsUnitario` de las posiciones `OPEN`.
- `patrimonioInversiones(investments, brokerCash): number` — `costoTotalAbierto +
  brokerCash.centavosArs`.
- `calcularVenta(investment, nominalesVendidos, precioVenta, cotizacionUsada):
  { ingresoCentavosArs, gananciaCentavosArs }` — la conversión y resta que arma el
  `InvestmentSale`. Valida `nominalesVendidos <= investment.nominales`.

## 4. Pantallas y flujo

Nueva pestaña **"Inversiones"** en `app/(tabs)/_layout.tsx`, quinta tab junto a Ahorro:
`app/(tabs)/inversiones.tsx`.

- **Tarjeta superior**: costo total invertido (toggle ARS/USD como en Home), cash en
  broker (editable inline), y patrimonio combinado.
- **Lista de posiciones abiertas** (`FlatList`, mismo estilo visual que
  `ahorro.tsx`/`historial.tsx`): ticker, nominales, PPC, costo total, rubro. Tap abre
  acciones: **Vender** o **Eliminar**.
- **Botón flotante "+"** → `app/inversion-nueva.tsx` (mismo patrón que
  `gasto-nuevo.tsx`): ticker, nominales, PPC, moneda (ARS/USD), rubro (opcional, chip
  de texto libre), fecha (default hoy).
- **Vender**: modal o pantalla simple con nominales a vender (máximo los que quedan) +
  precio de venta. Antes de confirmar, muestra la ganancia/pérdida resultante.
- **Historial de ventas**: sección colapsable en la misma pantalla de Inversiones, con
  `InvestmentSale` listados y ganancia/pérdida coloreada (verde ganancia, rojo
  pérdida), usando los colores `--color-primary`/`--color-red` ya definidos en el
  tema de la app.

## 5. Integración con Ahorro

En `ahorro.tsx`, debajo de "Total ahorrado", se agrega una línea nueva **"Patrimonio
total"** = ahorro (suma de `SavingMovement`) + `patrimonioInversiones()` (costo de
inversiones abiertas + cash en broker).

**No se modifica** `calcularResumenMes` ni `budget.ts` — el cálculo de `disponible`
mes a mes sigue basado solo en presupuesto, gastos y ahorro líquido. Las inversiones
son una foto de patrimonio aparte, no entran al rollover mensual de presupuesto.

## 6. Exportar / compartir CSV

Botón "Exportar" en Inversiones que genera un CSV con la misma estructura que
`Portfolio.txt` (fila `CASH` + filas `Ticker,Cantidad,PPC,Total,Rubro,Status,Entrada`
para posiciones abiertas y cerradas) y lo comparte con `expo-sharing` (share sheet
nativo del celular — WhatsApp, Drive, Mail, etc.), en vez de solo descargar el
archivo.

## 7. Fuera de alcance

- Valuación a precio de mercado actual / ganancia no realizada — requeriría integrar
  una API de cotización de acciones, no está en este alcance.
- Múltiples brokers con cash separado por broker — un solo saldo total alcanza.
- Promediar automáticamente el PPC cuando se compra más del mismo ticker — cada carga
  es un lote independiente.
- Reglas de Firestore nuevas — la regla existente por `uid` ya cubre las colecciones
  nuevas sin cambios.
