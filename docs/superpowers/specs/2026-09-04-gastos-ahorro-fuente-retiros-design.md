# Gastos con fuente y retiros de ahorro — Design

## Contexto

Hoy la app tiene tres "bolsillos" de plata que no se comunican entre sí:

- **Disponible del mes** (`calcularResumenMes`): presupuesto del mes + arrastre de meses anteriores - gastado.
- **Ahorro general** (`SavingMovement[]`): un ledger de aportes (positivos) y retiros (negativos). Ya soporta `origen: 'ingresos' | 'externo'` en los aportes (feature recién implementada).
- **Inversiones** (`Investment[]` + `BrokerCash`): posiciones abiertas más cash sin invertir en el broker.

Un gasto siempre sale del presupuesto del mes. No hay forma de pagar algo con plata ya ahorrada sin que además cuente como gasto del presupuesto. Tampoco hay forma de sacar plata de ahorro y mandarla a otro lado (inversiones, o de vuelta al disponible del mes).

## Objetivo

1. Un gasto puede elegir su **fuente**: `'disponible'` (como hoy) o `'ahorro'` (se paga con plata ya ahorrada, sin afectar el presupuesto del mes).
2. Se puede **retirar** plata de ahorro con un **destino**: `'disponible'` (vuelve a estar disponible para gastar este mes) o `'inversiones'` (se suma al cash del broker).

## Principio de diseño: el ledger de ahorro es la única fuente de verdad del saldo

Cuando un gasto se paga con ahorro, se crea automáticamente un retiro de ahorro vinculado a ese gasto. El saldo de ahorro siempre es `SavingMovement[].reduce(sum)` — nunca hay que combinar `Expense[]` y `SavingMovement[]` para saber cuánto hay ahorrado. Es el mismo patrón que ya usa `venderInversion` (`src/repos/vender-inversion.ts`): una función de orquestación que escribe en más de un repo como una sola operación lógica.

Por la misma razón, si se borra un gasto pagado con ahorro, se borra también su retiro vinculado (el saldo de ahorro vuelve a como estaba).

## Modelo de datos

### `src/domain/types.ts`

```typescript
export interface Expense {
  id: string;
  centavosArs: number;
  montoOriginal: number;
  monedaOriginal: Currency;
  cotizacionUsada: number | null;
  fecha: string;
  sectorId: string | null;
  lugar: string | null;
  descripcion: string | null;
  metodoPago: PaymentMethod | null;
  /**
   * De dónde sale la plata de este gasto:
   * - 'disponible': sale del presupuesto del mes (comportamiento histórico). Cuenta
   *   para `gastadoEnMes` (y por lo tanto para el `disponible` del mes).
   * - 'ahorro': se paga con plata ya ahorrada. NO cuenta para `gastadoEnMes`. Al
   *   guardarlo se crea automáticamente un retiro de ahorro vinculado (ver
   *   `pagarGasto` en `src/repos/pagar-gasto.ts`).
   * En ambos casos el gasto sigue sumando al total de su Sector y a su límite
   * mensual si tiene — el sector categoriza en qué se gastó, no de dónde salió
   * la plata.
   * Gastos históricos sin este campo cuentan como 'disponible'.
   */
  fuente: 'disponible' | 'ahorro';
}

export interface SavingMovement {
  id: string;
  /** Positivo = aporte a ahorro. Negativo = retiro de ahorro. */
  centavosArs: number;
  fecha: string;
  nota: string | null;
  /**
   * Solo aplica a aportes (centavosArs > 0): de dónde sale esa plata.
   * null en retiros (centavosArs < 0). Aportes históricos sin el campo
   * cuentan como 'ingresos'.
   */
  origen: 'ingresos' | 'externo' | null;
  /**
   * Solo aplica a retiros (centavosArs < 0): a dónde fue esa plata.
   * - 'disponible': vuelve a estar disponible para gastar este mes.
   * - 'inversiones': se suma al cash del broker.
   * - 'gasto': se usó para pagar un gasto con fuente 'ahorro' (ver `gastoId`).
   * null en aportes.
   */
  destino: 'disponible' | 'inversiones' | 'gasto' | null;
  /** Si destino === 'gasto', el id del Expense pagado con este retiro. null en cualquier otro caso. */
  gastoId: string | null;
}
```

## `src/domain/budget.ts`

```typescript
function fuenteEfectiva(g: Expense): 'disponible' | 'ahorro' {
  return g.fuente ?? 'disponible';
}

export function gastadoEnMes(gastos: Expense[], mes: MonthKey): number {
  return gastos
    .filter((g) => mesDeFecha(g.fecha) === mes && fuenteEfectiva(g) === 'disponible')
    .reduce((acc, g) => acc + g.centavosArs, 0);
}
```

`gastadoPorSector` **no cambia** — sigue sumando todos los gastos sin filtrar por fuente.

```typescript
function origenEfectivo(m: SavingMovement): 'ingresos' | 'externo' {
  return m.origen ?? 'ingresos';
}

/**
 * origen filtra SOLO aportes (centavosArs > 0). Un retiro nunca matchea un
 * filtro de origen, sin importar lo que tenga guardado en `origen` — el
 * campo no aplica a retiros. Sin filtro de origen, suma todo (aportes y
 * retiros), igual que hoy.
 */
export function ahorradoHasta(
  movimientos: SavingMovement[],
  mes: MonthKey,
  origen?: 'ingresos' | 'externo'
): number {
  return movimientos
    .filter((m) => mesDeFecha(m.fecha) <= mes)
    .filter((m) => origen === undefined || (m.centavosArs > 0 && origenEfectivo(m) === origen))
    .reduce((acc, m) => acc + m.centavosArs, 0);
}

/** Suma de los retiros con destino 'disponible' fechados exactamente en `mes`. */
export function retiradoADisponibleEnMes(movimientos: SavingMovement[], mes: MonthKey): number {
  return movimientos
    .filter((m) => m.centavosArs < 0 && m.destino === 'disponible' && mesDeFecha(m.fecha) === mes)
    .reduce((acc, m) => acc + Math.abs(m.centavosArs), 0);
}

/** Saldo total de ahorro (suma de todos los movimientos, sin filtrar por mes). */
export function totalAhorrado(movimientos: SavingMovement[]): number {
  return movimientos.reduce((acc, m) => acc + m.centavosArs, 0);
}
```

`calcularResumenMes` pasa a:

```typescript
export function calcularResumenMes(params: ParametrosResumenMes): ResumenMes {
  const { mes, presupuestos, gastos, ahorros } = params;

  const presupuestoDelMes = presupuestos.find((p) => p.mes === mes)?.totalCentavos ?? 0;
  const gastado = gastadoEnMes(gastos, mes);
  const retiradoAhorro = retiradoADisponibleEnMes(ahorros, mes);

  const mesPrevio = mesAnterior(mes);
  const huboPresupuestoPrevio = presupuestos.some((p) => p.mes === mesPrevio);

  let acumuladoPrevio = 0;
  if (huboPresupuestoPrevio) {
    const resumenPrevio = calcularResumenMes({ mes: mesPrevio, presupuestos, gastos, ahorros });
    const ahorradoHastaPrevio = ahorradoHasta(ahorros, mesPrevio, 'ingresos');
    const ahorradoHastaAntesDePrevio = ahorradoHasta(ahorros, mesAnterior(mesPrevio), 'ingresos');
    const mandadoAAhorroEnMesPrevio = ahorradoHastaPrevio - ahorradoHastaAntesDePrevio;
    acumuladoPrevio = Math.max(0, resumenPrevio.disponible - mandadoAAhorroEnMesPrevio);
  }

  const disponible = presupuestoDelMes + acumuladoPrevio - gastado + retiradoAhorro;

  return { presupuestoDelMes, acumuladoPrevio, gastado, disponible };
}
```

**Por qué el retiro a disponible no toca `mandadoAAhorroEnMesPrevio`:** ese término solo mira aportes (`ahorradoHasta(..., 'ingresos')`, que con el cambio de arriba excluye retiros). El efecto del retiro ya está reflejado en el `disponible` del mismo mes vía `retiradoAhorro`. Si además se restara del `mandadoAAhorroEnMesPrevio`, el mes siguiente heredaría un arrastre inflado — se estaría contando el mismo retiro dos veces. Ejemplo con números: disponible base $1000, mandás $600 a ahorro (disponible para re-mandar: $400), retirás $200 de vuelta a disponible → `disponible` recalculado = $1000 + $200 = $1200; lo que ya mandaste sigue siendo $600 (no $400), así que te queda $600 más para mandar. Cuadra con la intuición: tenías $1000, mandaste $600, te devolviste $200 → te quedan $600 disponibles ($400 que no habías mandado + $200 que recuperaste).

## `app/(tabs)/ahorro.tsx`

- `disponibleParaAhorro` (el tope de "Mandar a ahorro") sigue calculándose igual que ahora: `resumen.disponible - enviadoEsteMesDesdePresupuesto`, donde `enviadoEsteMesDesdePresupuesto` usa `ahorradoHasta(..., 'ingresos')` (que ya excluye retiros con el cambio de arriba, así que no hace falta tocar esa cuenta).
- Nueva sección **"Retirar de ahorro"**, mismo estilo que "Mandar a ahorro general": input de monto + chips de destino (`Disponible del mes` / `Inversiones`), tope = `totalAhorrado(movimientos)`.
- Al confirmar, usa la nueva función `retirarDeAhorro` (`src/repos/retirar-de-ahorro.ts`):
  - Si destino `'disponible'`: crea el `SavingMovement` negativo con `destino: 'disponible'`.
  - Si destino `'inversiones'`: crea el mismo movimiento y además `repos.brokerCash.guardar(actual + monto)`.
- El historial de movimientos muestra una etiqueta por movimiento:
  - Aporte (`centavosArs >= 0`): `'De presupuesto'` / `'Aporte externo'` (como ahora).
  - Retiro (`centavosArs < 0`): según `destino` → `'Retiro → disponible del mes'` / `'Retiro → inversiones'` / `'Retiro → gasto'`.

## `app/gasto-nuevo.tsx`

- Nuevo chip "Fuente": `Presupuesto` (default) / `Ahorro`.
- Si fuente es `'ahorro'`: valida contra `totalAhorrado(movimientos)` (necesita `useAhorros()`); si el monto supera el saldo, error igual al patrón existente.
- Al guardar, si fuente es `'ahorro'` usa la nueva función `pagarGasto` (`src/repos/pagar-gasto.ts`) en vez de `repos.expenses.agregar` directo. Si fuente es `'disponible'`, sigue usando `repos.expenses.agregar` sin cambios.

## Nuevas funciones de orquestación (`src/repos/`)

Mismo patrón que `vender-inversion.ts`: reciben los repos y el estado ya cargado por el llamador (no vuelven a leer), y devuelven lo que escribieron.

```typescript
// src/repos/pagar-gasto.ts
export async function pagarGasto(
  repos: Repos,
  gasto: Omit<Expense, 'id'>,
  movimientosActuales: SavingMovement[]
): Promise<{ gasto: Expense; movimiento: SavingMovement | null }> {
  if (gasto.fuente === 'ahorro' && gasto.centavosArs > totalAhorrado(movimientosActuales)) {
    throw new Error('No hay suficiente ahorro para pagar este gasto');
  }

  const gastoGuardado = await repos.expenses.agregar(gasto);

  if (gasto.fuente !== 'ahorro') {
    return { gasto: gastoGuardado, movimiento: null };
  }

  const movimiento = await repos.savings.agregar({
    centavosArs: -gasto.centavosArs,
    fecha: gasto.fecha,
    nota: `Gasto: ${gasto.descripcion ?? gasto.lugar ?? 'sin descripción'}`,
    origen: null,
    destino: 'gasto',
    gastoId: gastoGuardado.id,
  });

  return { gasto: gastoGuardado, movimiento };
}

// src/repos/eliminar-gasto.ts
export async function eliminarGasto(
  repos: Repos,
  gasto: Expense,
  movimientosActuales: SavingMovement[]
): Promise<void> {
  await repos.expenses.eliminar(gasto.id);
  const movimientoVinculado = movimientosActuales.find((m) => m.gastoId === gasto.id);
  if (movimientoVinculado) {
    await repos.savings.eliminar(movimientoVinculado.id);
  }
}

// src/repos/retirar-de-ahorro.ts
export interface ParametrosRetiro {
  centavosArs: number; // positivo
  destino: 'disponible' | 'inversiones';
  fecha: string;
}

export async function retirarDeAhorro(
  repos: Repos,
  params: ParametrosRetiro,
  movimientosActuales: SavingMovement[],
  brokerCashActual: BrokerCash
): Promise<SavingMovement> {
  if (params.centavosArs > totalAhorrado(movimientosActuales)) {
    throw new Error('No hay suficiente ahorro para retirar ese monto');
  }

  const movimiento = await repos.savings.agregar({
    centavosArs: -params.centavosArs,
    fecha: params.fecha,
    nota: null,
    origen: null,
    destino: params.destino,
    gastoId: null,
  });

  if (params.destino === 'inversiones') {
    await repos.brokerCash.guardar(brokerCashActual.centavosArs + params.centavosArs);
  }

  return movimiento;
}
```

## `src/repos/savings-repo.ts`

Se agrega `eliminar(id: string): Promise<void>` a la interfaz `SavingsRepo`, implementado igual que `expense-repo.ts::eliminar` (mismo patrón local + cola de pendientes + Firestore).

## Puntos de borrado de gastos

`app/(tabs)/index.tsx:211` y `app/(tabs)/historial.tsx:103` pasan de `repos.expenses.eliminar(id)` a `eliminarGasto(repos, gasto, movimientos)` (necesitan el objeto `Expense` completo, no solo el id, y la lista de `movimientos` vía `useAhorros()`).

## Fuera de alcance (a pedido explícito o por YAGNI)

- No se agrega una etiqueta visual de "pagado con ahorro" en las listas de Inicio/Historial — si hace falta después, se agrega aparte.
- No se toca `goal-repo.ts` ni `objetivo-nuevo.tsx` (Objetivos/cajitas) — sistema separado, ya excluido en la feature anterior.
- No se permite editar la fuente de un gasto ya guardado ni el destino de un retiro ya hecho — solo alta y baja, igual que el resto de la app.

## Testing

- `src/domain/__tests__/budget.test.ts`: actualizar fixtures de `Expense` y `SavingMovement` para incluir `fuente`/`origen`/`destino`/`gastoId`. Nuevos tests:
  - `gastadoEnMes` excluye gastos con `fuente: 'ahorro'`.
  - `gastadoEnMes` trata gastos históricos sin `fuente` como `'disponible'`.
  - `ahorradoHasta` con filtro de origen ignora retiros aunque tengan `origen` seteado (no debería poder pasar con el tipo nuevo, pero cubre el caso de datos históricos raros).
  - `retiradoADisponibleEnMes` suma solo retiros con destino `'disponible'` de ese mes.
  - `totalAhorrado` suma todos los movimientos.
  - `calcularResumenMes`: un retiro a disponible dentro del mismo mes sube el `disponible` de ese mes.
  - `calcularResumenMes`: aportar y retirar (a disponible) el mismo monto en el mismo mes no cambia el arrastre al mes siguiente (verifica que no se duplica el efecto).
- Nuevos archivos de test para `pagar-gasto.ts`, `eliminar-gasto.ts`, `retirar-de-ahorro.ts`, siguiendo el patrón de `src/repos/__tests__/vender-inversion.test.ts` (repos mockeados con `jest.fn()`).
- `src/repos/__tests__/savings-repo.test.ts` (si no existe, crear): cubrir el nuevo `eliminar`.
