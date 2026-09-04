# Gastos con fuente y retiros de ahorro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un gasto puede pagarse con el presupuesto del mes o con plata ya ahorrada; se puede retirar plata de ahorro y mandarla al disponible del mes o a inversiones.

**Architecture:** El ledger de `SavingMovement[]` es la única fuente de verdad del saldo de ahorro. Pagar un gasto con ahorro crea automáticamente un retiro vinculado (`destino: 'gasto'`); retirar plata crea un retiro con `destino: 'disponible'` o `'inversiones'`. Tres funciones de orquestación nuevas (`pagarGasto`, `eliminarGasto`, `retirarDeAhorro`) siguen el mismo patrón que `venderInversion`: reciben los repos y el estado ya cargado por el llamador, escriben en más de un repo como una sola operación lógica.

**Tech Stack:** TypeScript, Expo Router, React Native, Jest.

## Global Constraints

- Spec completo en [`docs/superpowers/specs/2026-09-04-gastos-ahorro-fuente-retiros-design.md`](../specs/2026-09-04-gastos-ahorro-fuente-retiros-design.md) — este plan implementa ese diseño ya aprobado.
- `gastadoPorSector` no cambia: sigue sumando todos los gastos sin filtrar por fuente.
- No se toca `goal-repo.ts` ni `objetivo-nuevo.tsx` (Objetivos/cajitas).
- No se agrega edición de fuente/destino en movimientos ya guardados — solo alta y baja.
- No se agrega etiqueta visual de "pagado con ahorro" en Inicio/Historial en esta iteración.
- Al terminar, correr `npm test` y confirmar que pasa todo, incluyendo el typecheck.

---

### Task 1: Modelo de datos — `Expense.fuente` y campos nuevos en `SavingMovement`

**Files:**
- Modify: `src/domain/types.ts:21-36` (interfaz `Expense`) y `src/domain/types.ts:45-52` (interfaz `SavingMovement`)

**Interfaces:**
- Produces: `Expense.fuente: 'disponible' | 'ahorro'`, `SavingMovement.origen: 'ingresos' | 'externo' | null`, `SavingMovement.destino: 'disponible' | 'inversiones' | 'gasto' | null`, `SavingMovement.gastoId: string | null` — consumidos por todas las tasks siguientes.

- [ ] **Step 1: Agregar `fuente` a `Expense`**

Reemplazar:

```typescript
export interface Expense {
  id: string;
  /** Monto normalizado a centavos de ARS. Es la única fuente de verdad para cálculos. */
  centavosArs: number;
  /** Monto tal como lo tipeó la persona, en su moneda original. */
  montoOriginal: number;
  monedaOriginal: Currency;
  /** Cotización usada al convertir, si monedaOriginal es USD. null si fue ARS. */
  cotizacionUsada: number | null;
  /** Fecha del gasto en formato ISO 'YYYY-MM-DD'. */
  fecha: string;
  sectorId: string | null;
  lugar: string | null;
  descripcion: string | null;
  metodoPago: PaymentMethod | null;
}
```

por:

```typescript
export interface Expense {
  id: string;
  /** Monto normalizado a centavos de ARS. Es la única fuente de verdad para cálculos. */
  centavosArs: number;
  /** Monto tal como lo tipeó la persona, en su moneda original. */
  montoOriginal: number;
  monedaOriginal: Currency;
  /** Cotización usada al convertir, si monedaOriginal es USD. null si fue ARS. */
  cotizacionUsada: number | null;
  /** Fecha del gasto en formato ISO 'YYYY-MM-DD'. */
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
   * mensual si tiene. Gastos históricos sin este campo cuentan como 'disponible'.
   */
  fuente: 'disponible' | 'ahorro';
}
```

- [ ] **Step 2: Actualizar `SavingMovement`**

Reemplazar:

```typescript
export interface SavingMovement {
  id: string;
  /** Positivo = se manda a ahorro. Negativo = se retira del ahorro. */
  centavosArs: number;
  /** Fecha ISO 'YYYY-MM-DD'. */
  fecha: string;
  nota: string | null;
  /**
   * De dónde sale la plata que se manda a ahorro:
   * - 'ingresos': salió del presupuesto mensual (comportamiento histórico). Tiene tope
   *   igual al `acumuladoPrevio` y descuenta ese monto del acumulado que se arrastra
   *   al mes siguiente.
   * - 'externo': aporte que nunca pasó por el presupuesto (regalo, aguinaldo, etc.).
   *   No tiene tope y no descuenta nada del acumulado arrastrado.
   * Movimientos históricos guardados antes de este campo no lo tienen: se deben
   * tratar como 'ingresos' en todo cálculo y en la UI.
   */
  origen: 'ingresos' | 'externo';
}
```

por:

```typescript
export interface SavingMovement {
  id: string;
  /** Positivo = aporte a ahorro. Negativo = retiro de ahorro. */
  centavosArs: number;
  /** Fecha ISO 'YYYY-MM-DD'. */
  fecha: string;
  nota: string | null;
  /**
   * Solo aplica a aportes (centavosArs > 0): de dónde sale esa plata.
   * - 'ingresos': salió del presupuesto mensual. Tiene tope igual al disponible del
   *   mes y descuenta ese monto del acumulado que se arrastra al mes siguiente.
   * - 'externo': aporte que nunca pasó por el presupuesto (regalo, aguinaldo, etc.).
   *   No tiene tope y no descuenta nada del acumulado arrastrado.
   * null en retiros (centavosArs < 0). Aportes históricos sin el campo cuentan
   * como 'ingresos'.
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

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "agrega fuente a Expense y destino/gastoId a SavingMovement"
```

---

### Task 2: `budget.ts` — filtrar por fuente/origen, nuevas funciones, fórmula de `disponible`

**Files:**
- Modify: `src/domain/budget.ts`

**Interfaces:**
- Consumes: `Expense.fuente`, `SavingMovement.destino` (Task 1).
- Produces: `gastadoEnMes` (firma sin cambios, comportamiento filtra fuente), `ahorradoHasta` (firma sin cambios, el filtro de origen ahora excluye retiros), `retiradoADisponibleEnMes(movimientos: SavingMovement[], mes: MonthKey): number`, `totalAhorrado(movimientos: SavingMovement[]): number` — consumidos por Task 3 (tests), Task 6/7/8 (repos), Task 9/10 (UI).

- [ ] **Step 1: Filtrar `gastadoEnMes` por fuente**

Reemplazar:

```typescript
export function gastadoEnMes(gastos: Expense[], mes: MonthKey): number {
  return gastos
    .filter((g) => mesDeFecha(g.fecha) === mes)
    .reduce((acc, g) => acc + g.centavosArs, 0);
}
```

por:

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

- [ ] **Step 2: `ahorradoHasta` — el filtro de origen solo matchea aportes**

Reemplazar:

```typescript
/** Movimientos históricos guardados antes de existir el campo `origen` cuentan como 'ingresos'. */
function origenEfectivo(m: SavingMovement): 'ingresos' | 'externo' {
  return m.origen ?? 'ingresos';
}

export function ahorradoHasta(
  movimientos: SavingMovement[],
  mes: MonthKey,
  origen?: 'ingresos' | 'externo'
): number {
  return movimientos
    .filter((m) => mesDeFecha(m.fecha) <= mes)
    .filter((m) => origen === undefined || origenEfectivo(m) === origen)
    .reduce((acc, m) => acc + m.centavosArs, 0);
}
```

por:

```typescript
/** Movimientos históricos guardados antes de existir el campo `origen` cuentan como 'ingresos'. */
function origenEfectivo(m: SavingMovement): 'ingresos' | 'externo' {
  return m.origen ?? 'ingresos';
}

/**
 * origen filtra SOLO aportes (centavosArs > 0) — un retiro nunca matchea un
 * filtro de origen, sin importar qué tenga guardado en `origen` (no aplica a
 * retiros). Sin filtro de origen, suma todo (aportes y retiros), como antes.
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

/** Saldo total de ahorro: suma de todos los movimientos, sin filtrar por mes. */
export function totalAhorrado(movimientos: SavingMovement[]): number {
  return movimientos.reduce((acc, m) => acc + m.centavosArs, 0);
}
```

- [ ] **Step 3: Sumar los retiros a disponible en `calcularResumenMes`**

Reemplazar:

```typescript
export function calcularResumenMes(params: ParametrosResumenMes): ResumenMes {
  const { mes, presupuestos, gastos, ahorros } = params;

  const presupuestoDelMes =
    presupuestos.find((p) => p.mes === mes)?.totalCentavos ?? 0;
  const gastado = gastadoEnMes(gastos, mes);

  const mesPrevio = mesAnterior(mes);
  const huboPresupuestoPrevio = presupuestos.some((p) => p.mes === mesPrevio);

  let acumuladoPrevio = 0;
  if (huboPresupuestoPrevio) {
    const resumenPrevio = calcularResumenMes({
      mes: mesPrevio,
      presupuestos,
      gastos,
      ahorros,
    });
    const ahorradoHastaPrevio = ahorradoHasta(ahorros, mesPrevio, 'ingresos');
    const ahorradoHastaAntesDePrevio = ahorradoHasta(ahorros, mesAnterior(mesPrevio), 'ingresos');
    const mandadoAAhorroEnMesPrevio = ahorradoHastaPrevio - ahorradoHastaAntesDePrevio;
    acumuladoPrevio = Math.max(
      0,
      resumenPrevio.disponible - mandadoAAhorroEnMesPrevio
    );
  }

  const disponible = presupuestoDelMes + acumuladoPrevio - gastado;

  return { presupuestoDelMes, acumuladoPrevio, gastado, disponible };
}
```

por:

```typescript
export function calcularResumenMes(params: ParametrosResumenMes): ResumenMes {
  const { mes, presupuestos, gastos, ahorros } = params;

  const presupuestoDelMes =
    presupuestos.find((p) => p.mes === mes)?.totalCentavos ?? 0;
  const gastado = gastadoEnMes(gastos, mes);
  const retiradoAhorro = retiradoADisponibleEnMes(ahorros, mes);

  const mesPrevio = mesAnterior(mes);
  const huboPresupuestoPrevio = presupuestos.some((p) => p.mes === mesPrevio);

  let acumuladoPrevio = 0;
  if (huboPresupuestoPrevio) {
    const resumenPrevio = calcularResumenMes({
      mes: mesPrevio,
      presupuestos,
      gastos,
      ahorros,
    });
    const ahorradoHastaPrevio = ahorradoHasta(ahorros, mesPrevio, 'ingresos');
    const ahorradoHastaAntesDePrevio = ahorradoHasta(ahorros, mesAnterior(mesPrevio), 'ingresos');
    const mandadoAAhorroEnMesPrevio = ahorradoHastaPrevio - ahorradoHastaAntesDePrevio;
    acumuladoPrevio = Math.max(
      0,
      resumenPrevio.disponible - mandadoAAhorroEnMesPrevio
    );
  }

  // Los retiros de ahorro con destino 'disponible' NO se restan de
  // mandadoAAhorroEnMesPrevio: ese término solo mira aportes. El efecto del
  // retiro ya está reflejado acá abajo, en el disponible de este mismo mes.
  // Restarlo también del arrastre duplicaría el efecto del retiro.
  const disponible = presupuestoDelMes + acumuladoPrevio - gastado + retiradoAhorro;

  return { presupuestoDelMes, acumuladoPrevio, gastado, disponible };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/budget.ts
git commit -m "gastadoEnMes filtra por fuente; agrega retiradoADisponibleEnMes y totalAhorrado"
```

---

### Task 3: Actualizar fixtures y agregar tests en `budget.test.ts`

**Files:**
- Modify: `src/domain/__tests__/budget.test.ts`

**Interfaces:**
- Consumes: `gastadoEnMes`, `ahorradoHasta`, `retiradoADisponibleEnMes`, `totalAhorrado`, `calcularResumenMes` (Task 2).

- [ ] **Step 1: Actualizar el helper `gasto()` con `fuente: 'disponible'` por defecto**

Reemplazar:

```typescript
function gasto(parcial: Partial<Expense>): Expense {
  return {
    id: 'e1',
    centavosArs: 0,
    montoOriginal: 0,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    fecha: '2026-06-01',
    sectorId: null,
    lugar: null,
    descripcion: null,
    metodoPago: null,
    ...parcial,
  };
}
```

por:

```typescript
function gasto(parcial: Partial<Expense>): Expense {
  return {
    id: 'e1',
    centavosArs: 0,
    montoOriginal: 0,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    fecha: '2026-06-01',
    sectorId: null,
    lugar: null,
    descripcion: null,
    metodoPago: null,
    fuente: 'disponible',
    ...parcial,
  };
}
```

- [ ] **Step 2: Actualizar el helper `movimiento()` con `destino`/`gastoId` por defecto**

Reemplazar:

```typescript
function movimiento(parcial: Partial<SavingMovement>): SavingMovement {
  return {
    id: 'm1',
    centavosArs: 0,
    fecha: '2026-06-01',
    nota: null,
    origen: 'ingresos',
    ...parcial,
  };
}
```

por:

```typescript
function movimiento(parcial: Partial<SavingMovement>): SavingMovement {
  return {
    id: 'm1',
    centavosArs: 0,
    fecha: '2026-06-01',
    nota: null,
    origen: 'ingresos',
    destino: null,
    gastoId: null,
    ...parcial,
  };
}
```

- [ ] **Step 3: Agregar tests de `gastadoEnMes` con fuente**

Reemplazar:

```typescript
describe('gastadoEnMes', () => {
  it('suma solo los gastos del mes pedido', () => {
    const gastos = [
      gasto({ id: 'a', centavosArs: 1000, fecha: '2026-06-05' }),
      gasto({ id: 'b', centavosArs: 2000, fecha: '2026-06-20' }),
      gasto({ id: 'c', centavosArs: 5000, fecha: '2026-07-01' }),
    ];
    expect(gastadoEnMes(gastos, '2026-06')).toBe(3000);
  });

  it('devuelve 0 si no hay gastos en el mes', () => {
    expect(gastadoEnMes([], '2026-06')).toBe(0);
  });
});
```

por:

```typescript
describe('gastadoEnMes', () => {
  it('suma solo los gastos del mes pedido', () => {
    const gastos = [
      gasto({ id: 'a', centavosArs: 1000, fecha: '2026-06-05' }),
      gasto({ id: 'b', centavosArs: 2000, fecha: '2026-06-20' }),
      gasto({ id: 'c', centavosArs: 5000, fecha: '2026-07-01' }),
    ];
    expect(gastadoEnMes(gastos, '2026-06')).toBe(3000);
  });

  it('devuelve 0 si no hay gastos en el mes', () => {
    expect(gastadoEnMes([], '2026-06')).toBe(0);
  });

  it('excluye los gastos pagados con ahorro (fuente ahorro)', () => {
    const gastos = [
      gasto({ id: 'a', centavosArs: 1000, fecha: '2026-06-05', fuente: 'disponible' }),
      gasto({ id: 'b', centavosArs: 4000, fecha: '2026-06-06', fuente: 'ahorro' }),
    ];
    expect(gastadoEnMes(gastos, '2026-06')).toBe(1000);
  });

  it('trata los gastos históricos sin campo fuente como "disponible"', () => {
    const gastos = [{ id: 'a', centavosArs: 1000, fecha: '2026-06-05' } as Expense];
    expect(gastadoEnMes(gastos, '2026-06')).toBe(1000);
  });
});
```

- [ ] **Step 4: Agregar test de que un retiro no matchea un filtro de origen**

Al final de `describe('ahorradoHasta con filtro de origen', ...)` (después del test `'trata los movimientos históricos sin campo origen guardado como "ingresos"'`, antes del `});` que cierra el describe), agregar:

```typescript

  it('un retiro nunca matchea un filtro de origen, aunque tenga origen seteado', () => {
    const movimientos: SavingMovement[] = [
      movimiento({ id: 'm1', centavosArs: 5000, fecha: '2026-06-01', origen: 'ingresos' }),
      movimiento({ id: 'm2', centavosArs: -2000, fecha: '2026-06-02', origen: 'ingresos' }),
    ];
    expect(ahorradoHasta(movimientos, '2026-06', 'ingresos')).toBe(5000);
  });
```

- [ ] **Step 5: Agregar `describe` de `retiradoADisponibleEnMes` y `totalAhorrado`**

Después del `describe('ahorradoHasta con filtro de origen', ...)` completo (antes de `describe('calcularResumenMes', ...)`), agregar:

```typescript
describe('retiradoADisponibleEnMes', () => {
  it('suma solo los retiros con destino disponible de ese mes', () => {
    const movimientos: SavingMovement[] = [
      movimiento({ id: 'm1', centavosArs: -2000, fecha: '2026-06-05', destino: 'disponible' }),
      movimiento({ id: 'm2', centavosArs: -1000, fecha: '2026-06-06', destino: 'inversiones' }),
      movimiento({ id: 'm3', centavosArs: -500, fecha: '2026-05-01', destino: 'disponible' }),
      movimiento({ id: 'm4', centavosArs: 3000, fecha: '2026-06-07', origen: 'ingresos' }),
    ];
    expect(retiradoADisponibleEnMes(movimientos, '2026-06')).toBe(2000);
  });

  it('devuelve 0 si no hay retiros con destino disponible ese mes', () => {
    expect(retiradoADisponibleEnMes([], '2026-06')).toBe(0);
  });
});

describe('totalAhorrado', () => {
  it('suma todos los movimientos sin filtrar por mes', () => {
    const movimientos: SavingMovement[] = [
      movimiento({ id: 'm1', centavosArs: 5000, fecha: '2026-04-01' }),
      movimiento({ id: 'm2', centavosArs: -2000, fecha: '2026-06-01' }),
      movimiento({ id: 'm3', centavosArs: 1000, fecha: '2027-01-01' }),
    ];
    expect(totalAhorrado(movimientos)).toBe(4000);
  });

  it('devuelve 0 sin movimientos', () => {
    expect(totalAhorrado([])).toBe(0);
  });
});
```

Y actualizar el import del principio del archivo: reemplazar

```typescript
import {
  gastadoEnMes,
  gastadoPorSector,
  ahorradoHasta,
  calcularResumenMes,
  mesAnterior,
  siguienteMes,
} from '../budget';
```

por:

```typescript
import {
  gastadoEnMes,
  gastadoPorSector,
  ahorradoHasta,
  retiradoADisponibleEnMes,
  totalAhorrado,
  calcularResumenMes,
  mesAnterior,
  siguienteMes,
} from '../budget';
```

- [ ] **Step 6: Agregar tests de `calcularResumenMes` con retiros a disponible**

Dentro de `describe('calcularResumenMes', ...)`, después del test `'un aporte externo mandado a ahorro no reduce el acumuladoPrevio del mes siguiente'` (antes de `'un mes sin presupuesto definido cuenta como presupuesto 0'`), agregar:

```typescript
  it('un retiro con destino disponible sube el disponible de ese mismo mes', () => {
    const presupuestos: Budget[] = [{ mes: '2026-06', totalCentavos: 100000 }];
    const gastos: Expense[] = [gasto({ centavosArs: 30000, fecha: '2026-06-10' })];
    const ahorros: SavingMovement[] = [
      movimiento({ id: 'r1', centavosArs: -20000, fecha: '2026-06-15', origen: null, destino: 'disponible' }),
    ];

    const resumen = calcularResumenMes({ mes: '2026-06', presupuestos, gastos, ahorros });

    // 100000 (presupuesto) - 30000 (gastado) + 20000 (retirado a disponible)
    expect(resumen.disponible).toBe(90000);
  });

  it('un retiro con destino inversiones NO sube el disponible del mes', () => {
    const presupuestos: Budget[] = [{ mes: '2026-06', totalCentavos: 100000 }];
    const gastos: Expense[] = [gasto({ centavosArs: 30000, fecha: '2026-06-10' })];
    const ahorros: SavingMovement[] = [
      movimiento({ id: 'r1', centavosArs: -20000, fecha: '2026-06-15', origen: null, destino: 'inversiones' }),
    ];

    const resumen = calcularResumenMes({ mes: '2026-06', presupuestos, gastos, ahorros });

    expect(resumen.disponible).toBe(70000);
  });

  it('mandar a ahorro y retirar a disponible el mismo monto en el mismo mes no cambia el arrastre al mes siguiente', () => {
    const presupuestos: Budget[] = [
      { mes: '2026-05', totalCentavos: 50000 },
      { mes: '2026-06', totalCentavos: 100000 },
    ];
    // en mayo se gastaron 20000 de 50000: sobran 30000 que arrastrarían a junio
    const gastos: Expense[] = [gasto({ id: 'may', centavosArs: 20000, fecha: '2026-05-10' })];
    // se manda 15000 a ahorro y se retira ese mismo monto de vuelta a disponible, todo en mayo
    const ahorros: SavingMovement[] = [
      movimiento({ id: 'a1', centavosArs: 15000, fecha: '2026-05-20', origen: 'ingresos', destino: null }),
      movimiento({ id: 'r1', centavosArs: -15000, fecha: '2026-05-25', origen: null, destino: 'disponible' }),
    ];

    const resumen = calcularResumenMes({ mes: '2026-06', presupuestos, gastos, ahorros });

    // el disponible de mayo termina en 30000 igual que si nunca hubiera pasado nada
    // (30000 - 15000 mandado + 15000 retirado), y eso es lo único que se arrastra:
    // mandadoAAhorroEnMesPrevio sigue siendo 15000 (solo mira aportes), así que si
    // el retiro también lo restara, el arrastre quedaría en 45000 en vez de 30000.
    expect(resumen.acumuladoPrevio).toBe(15000);
  });
```

- [ ] **Step 7: Correr la suite completa**

Run: `npm test`
Expected: todos los tests pasan.

- [ ] **Step 8: Commit**

```bash
git add src/domain/__tests__/budget.test.ts
git commit -m "agrega tests de fuente en gastos y retiros de ahorro a budget.ts"
```

---

### Task 4: `savings-repo.ts` — agregar `eliminar()`

**Files:**
- Modify: `src/repos/savings-repo.ts`

**Interfaces:**
- Produces: `SavingsRepo.eliminar(id: string): Promise<void>` — consumido por Task 7 (`eliminarGasto`) y Task 10 (UI, indirectamente vía `eliminarGasto`).

- [ ] **Step 1: Agregar `deleteDoc` al import de Firestore**

Reemplazar:

```typescript
import { doc, setDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
```

por:

```typescript
import { doc, setDoc, deleteDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
```

- [ ] **Step 2: Agregar `eliminar` a la interfaz `SavingsRepo`**

Reemplazar:

```typescript
export interface SavingsRepo {
  listar(): Promise<SavingMovement[]>;
  agregar(movimiento: Omit<SavingMovement, 'id'>): Promise<SavingMovement>;
  suscribir(cb: (movimientos: SavingMovement[]) => void): () => void;
}
```

por:

```typescript
export interface SavingsRepo {
  listar(): Promise<SavingMovement[]>;
  agregar(movimiento: Omit<SavingMovement, 'id'>): Promise<SavingMovement>;
  eliminar(id: string): Promise<void>;
  suscribir(cb: (movimientos: SavingMovement[]) => void): () => void;
}
```

- [ ] **Step 3: Implementar `eliminar`**

Reemplazar:

```typescript
    suscribir(cb: (movimientos: SavingMovement[]) => void): () => void {
      if (!estaOnline()) return () => {};
      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const movimientos = snapshot.docs.map((d) => d.data() as SavingMovement);
        escribirLocal(movimientos).then(() => cb(movimientos));
      });
    },
  };
}
```

por:

```typescript
    async eliminar(id: string): Promise<void> {
      const actuales = await leerLocal();
      await escribirLocal(actuales.filter((m) => m.id !== id));

      await localStore.guardarPendiente({
        id,
        coleccion: COLECCION,
        operacion: 'delete',
        datos: null,
        creadoEn: Date.now(),
      });

      if (estaOnline()) {
        await deleteDoc(doc(db, 'users', uid, COLECCION, id)).catch(() => {});
      }
    },

    suscribir(cb: (movimientos: SavingMovement[]) => void): () => void {
      if (!estaOnline()) return () => {};
      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const movimientos = snapshot.docs.map((d) => d.data() as SavingMovement);
        escribirLocal(movimientos).then(() => cb(movimientos));
      });
    },
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/repos/savings-repo.ts
git commit -m "agrega eliminar() a SavingsRepo"
```

---

### Task 5: Tests de `savings-repo.ts`

**Files:**
- Test: `src/repos/__tests__/savings-repo.test.ts` (nuevo)

**Interfaces:**
- Consumes: `crearSavingsRepo`, `SavingsRepo.agregar/listar/eliminar` (Task 4).

- [ ] **Step 1: Crear el archivo de test**

```typescript
import { crearSavingsRepo } from '../savings-repo';
import type { LocalStore, PendingWrite } from '../../db/local-store';
import type { SavingMovement } from '../../domain/types';

// Ver nota equivalente en expense-repo.test.ts: el mock automático de
// jest-expo para expo-crypto devuelve randomUUID() = undefined, así que lo
// pisamos acá con la implementación real de Node.
jest.mock('expo-crypto', () => ({
  __esModule: true,
  randomUUID: () => require('node:crypto').randomUUID(),
}));

function crearStoreFake(): LocalStore & { pendientes: PendingWrite[] } {
  const pendientes: PendingWrite[] = [];
  const snapshots: Record<string, unknown[]> = { savings: [] };
  return {
    pendientes,
    async guardarPendiente(w) {
      pendientes.push(w);
    },
    async listarPendientes() {
      return [...pendientes];
    },
    async borrarPendiente(id) {
      const i = pendientes.findIndex((p) => p.id === id);
      if (i >= 0) pendientes.splice(i, 1);
    },
    async guardarSnapshot(coleccion, datos) {
      snapshots[coleccion] = datos;
    },
    async leerSnapshot(coleccion) {
      return snapshots[coleccion] ?? [];
    },
  };
}

function movimientoParcial(parcial: Partial<Omit<SavingMovement, 'id'>> = {}): Omit<SavingMovement, 'id'> {
  return {
    centavosArs: 5000,
    fecha: '2026-06-01',
    nota: null,
    origen: 'ingresos',
    destino: null,
    gastoId: null,
    ...parcial,
  };
}

describe('crearSavingsRepo sin conexión', () => {
  it('agregar() genera un id, guarda snapshot local y encola la escritura', async () => {
    const store = crearStoreFake();
    const repo = crearSavingsRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    const movimiento = await repo.agregar(movimientoParcial());

    expect(typeof movimiento.id).toBe('string');
    expect(movimiento.id.length).toBeGreaterThan(0);
    expect(store.pendientes).toHaveLength(1);
    expect(store.pendientes[0].coleccion).toBe('savings');
    expect(store.pendientes[0].operacion).toBe('set');
  });

  it('listar() devuelve lo guardado en el snapshot local', async () => {
    const store = crearStoreFake();
    const repo = crearSavingsRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    await repo.agregar(movimientoParcial());
    const lista = await repo.listar();

    expect(lista).toHaveLength(1);
    expect(lista[0].centavosArs).toBe(5000);
  });

  it('eliminar() encola un delete y lo saca de listar()', async () => {
    const store = crearStoreFake();
    const repo = crearSavingsRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    const movimiento = await repo.agregar(movimientoParcial());
    await repo.eliminar(movimiento.id);
    const lista = await repo.listar();

    expect(lista).toHaveLength(0);
    expect(store.pendientes.some((p) => p.operacion === 'delete' && p.id === movimiento.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Correr los tests**

Run: `npx jest src/repos/__tests__/savings-repo.test.ts`
Expected: 3 tests, todos PASS.

- [ ] **Step 3: Commit**

```bash
git add src/repos/__tests__/savings-repo.test.ts
git commit -m "agrega tests de savings-repo (agregar, listar, eliminar)"
```

---

### Task 6: `pagarGasto` — orquestación de gasto pagado con ahorro

**Files:**
- Create: `src/repos/pagar-gasto.ts`
- Test: `src/repos/__tests__/pagar-gasto.test.ts`

**Interfaces:**
- Consumes: `totalAhorrado` (Task 2), `Repos.expenses.agregar`, `Repos.savings.agregar` (ya existentes).
- Produces: `pagarGasto(repos: Repos, gasto: Omit<Expense, 'id'>, movimientosActuales: SavingMovement[]): Promise<{ gasto: Expense; movimiento: SavingMovement | null }>` — consumido por Task 9 (`gasto-nuevo.tsx`).

- [ ] **Step 1: Crear `src/repos/pagar-gasto.ts`**

```typescript
import { totalAhorrado } from '../domain/budget';
import { formatCentavos } from '../domain/money';
import type { Expense, SavingMovement } from '../domain/types';
import type { Repos } from './create-repo';

export interface ResultadoPagoGasto {
  gasto: Expense;
  movimiento: SavingMovement | null;
}

/**
 * Guarda un gasto. Si su fuente es 'ahorro', además crea automáticamente el
 * retiro de ahorro vinculado (SavingMovement con destino 'gasto' y gastoId
 * apuntando a este gasto), para que el saldo de ahorro (SavingMovement[])
 * sea siempre la única fuente de verdad. Recibe los movimientos actuales ya
 * cargados por el llamador (no los vuelve a leer del repo).
 */
export async function pagarGasto(
  repos: Repos,
  gasto: Omit<Expense, 'id'>,
  movimientosActuales: SavingMovement[]
): Promise<ResultadoPagoGasto> {
  if (gasto.fuente === 'ahorro') {
    const saldoAhorro = totalAhorrado(movimientosActuales);
    if (gasto.centavosArs > saldoAhorro) {
      throw new Error(`No podés pagar con ahorro más de ${formatCentavos(saldoAhorro)} (tu saldo de ahorro)`);
    }
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
```

- [ ] **Step 2: Crear el test**

```typescript
import { pagarGasto } from '../pagar-gasto';
import type { Repos } from '../create-repo';
import type { Expense, SavingMovement } from '../../domain/types';

function crearGastoParcial(parcial: Partial<Omit<Expense, 'id'>> = {}): Omit<Expense, 'id'> {
  return {
    centavosArs: 5000,
    montoOriginal: 50,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    fecha: '2026-06-01',
    sectorId: null,
    lugar: null,
    descripcion: 'Uber',
    metodoPago: null,
    fuente: 'disponible',
    ...parcial,
  };
}

function crearMovimiento(parcial: Partial<SavingMovement> = {}): SavingMovement {
  return {
    id: 'm1',
    centavosArs: 10000,
    fecha: '2026-06-01',
    nota: null,
    origen: 'ingresos',
    destino: null,
    gastoId: null,
    ...parcial,
  };
}

function crearReposFake() {
  const gastosCreados: Omit<Expense, 'id'>[] = [];
  const movimientosCreados: Omit<SavingMovement, 'id'>[] = [];
  let contadorId = 0;

  const repos = {
    expenses: {
      agregar: jest.fn(async (gasto: Omit<Expense, 'id'>) => {
        gastosCreados.push(gasto);
        contadorId += 1;
        return { ...gasto, id: `gasto${contadorId}` };
      }),
    },
    savings: {
      agregar: jest.fn(async (movimiento: Omit<SavingMovement, 'id'>) => {
        movimientosCreados.push(movimiento);
        contadorId += 1;
        return { ...movimiento, id: `mov${contadorId}` };
      }),
    },
  };

  return { repos: repos as unknown as Repos, gastosCreados, movimientosCreados };
}

describe('pagarGasto', () => {
  it('fuente disponible: guarda el gasto y no crea ningún movimiento de ahorro', async () => {
    const { repos, movimientosCreados } = crearReposFake();

    const resultado = await pagarGasto(repos, crearGastoParcial({ fuente: 'disponible' }), []);

    expect(resultado.gasto.fuente).toBe('disponible');
    expect(resultado.movimiento).toBeNull();
    expect(movimientosCreados).toHaveLength(0);
  });

  it('fuente ahorro: guarda el gasto y crea un retiro vinculado por el mismo monto', async () => {
    const { repos, movimientosCreados } = crearReposFake();
    const movimientos = [crearMovimiento({ centavosArs: 10000 })];

    const resultado = await pagarGasto(repos, crearGastoParcial({ centavosArs: 4000, fuente: 'ahorro' }), movimientos);

    expect(resultado.movimiento).not.toBeNull();
    expect(resultado.movimiento?.centavosArs).toBe(-4000);
    expect(resultado.movimiento?.destino).toBe('gasto');
    expect(resultado.movimiento?.gastoId).toBe(resultado.gasto.id);
    expect(resultado.movimiento?.origen).toBeNull();
    expect(movimientosCreados).toHaveLength(1);
  });

  it('fuente ahorro: rechaza si el gasto supera el saldo de ahorro, sin guardar nada', async () => {
    const { repos, gastosCreados, movimientosCreados } = crearReposFake();
    const movimientos = [crearMovimiento({ centavosArs: 3000 })];

    await expect(
      pagarGasto(repos, crearGastoParcial({ centavosArs: 4000, fuente: 'ahorro' }), movimientos)
    ).rejects.toThrow();

    expect(gastosCreados).toHaveLength(0);
    expect(movimientosCreados).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Correr los tests**

Run: `npx jest src/repos/__tests__/pagar-gasto.test.ts`
Expected: 3 tests, todos PASS.

- [ ] **Step 4: Commit**

```bash
git add src/repos/pagar-gasto.ts src/repos/__tests__/pagar-gasto.test.ts
git commit -m "agrega pagarGasto: orquesta gasto + retiro de ahorro vinculado"
```

---

### Task 7: `eliminarGasto` — borra el gasto y su retiro vinculado

**Files:**
- Create: `src/repos/eliminar-gasto.ts`
- Test: `src/repos/__tests__/eliminar-gasto.test.ts`

**Interfaces:**
- Consumes: `Repos.expenses.eliminar`, `Repos.savings.eliminar` (Task 4).
- Produces: `eliminarGasto(repos: Repos, gasto: Expense, movimientosActuales: SavingMovement[]): Promise<void>` — consumido por Task 11 (`index.tsx`, `historial.tsx`).

- [ ] **Step 1: Crear `src/repos/eliminar-gasto.ts`**

```typescript
import type { Expense, SavingMovement } from '../domain/types';
import type { Repos } from './create-repo';

/**
 * Borra un gasto y, si estaba pagado con ahorro, borra también el retiro de
 * ahorro vinculado (así el saldo de ahorro vuelve a como estaba antes de
 * ese gasto). Recibe los movimientos actuales ya cargados por el llamador.
 */
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
```

- [ ] **Step 2: Crear el test**

```typescript
import { eliminarGasto } from '../eliminar-gasto';
import type { Repos } from '../create-repo';
import type { Expense, SavingMovement } from '../../domain/types';

function crearGasto(parcial: Partial<Expense> = {}): Expense {
  return {
    id: 'g1',
    centavosArs: 4000,
    montoOriginal: 40,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    fecha: '2026-06-01',
    sectorId: null,
    lugar: null,
    descripcion: 'Uber',
    metodoPago: null,
    fuente: 'disponible',
    ...parcial,
  };
}

function crearMovimiento(parcial: Partial<SavingMovement> = {}): SavingMovement {
  return {
    id: 'm1',
    centavosArs: -4000,
    fecha: '2026-06-01',
    nota: 'Gasto: Uber',
    origen: null,
    destino: 'gasto',
    gastoId: 'g1',
    ...parcial,
  };
}

function crearReposFake() {
  const idsGastosEliminados: string[] = [];
  const idsMovimientosEliminados: string[] = [];

  const repos = {
    expenses: {
      eliminar: jest.fn(async (id: string) => {
        idsGastosEliminados.push(id);
      }),
    },
    savings: {
      eliminar: jest.fn(async (id: string) => {
        idsMovimientosEliminados.push(id);
      }),
    },
  };

  return { repos: repos as unknown as Repos, idsGastosEliminados, idsMovimientosEliminados };
}

describe('eliminarGasto', () => {
  it('gasto con fuente disponible: borra el gasto y no toca ahorro', async () => {
    const { repos, idsGastosEliminados, idsMovimientosEliminados } = crearReposFake();
    const gasto = crearGasto({ id: 'g1', fuente: 'disponible' });

    await eliminarGasto(repos, gasto, []);

    expect(idsGastosEliminados).toEqual(['g1']);
    expect(idsMovimientosEliminados).toHaveLength(0);
  });

  it('gasto con fuente ahorro: borra el gasto y su retiro vinculado', async () => {
    const { repos, idsGastosEliminados, idsMovimientosEliminados } = crearReposFake();
    const gasto = crearGasto({ id: 'g1', fuente: 'ahorro' });
    const movimientos = [
      crearMovimiento({ id: 'm1', gastoId: 'g1' }),
      crearMovimiento({ id: 'm2', gastoId: 'otro-gasto' }),
    ];

    await eliminarGasto(repos, gasto, movimientos);

    expect(idsGastosEliminados).toEqual(['g1']);
    expect(idsMovimientosEliminados).toEqual(['m1']);
  });

  it('gasto con fuente ahorro sin movimiento vinculado encontrado: borra el gasto igual, sin fallar', async () => {
    const { repos, idsGastosEliminados, idsMovimientosEliminados } = crearReposFake();
    const gasto = crearGasto({ id: 'g1', fuente: 'ahorro' });

    await eliminarGasto(repos, gasto, []);

    expect(idsGastosEliminados).toEqual(['g1']);
    expect(idsMovimientosEliminados).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Correr los tests**

Run: `npx jest src/repos/__tests__/eliminar-gasto.test.ts`
Expected: 3 tests, todos PASS.

- [ ] **Step 4: Commit**

```bash
git add src/repos/eliminar-gasto.ts src/repos/__tests__/eliminar-gasto.test.ts
git commit -m "agrega eliminarGasto: borra el gasto y su retiro de ahorro vinculado"
```

---

### Task 8: `retirarDeAhorro` — orquestación de retiros con destino

**Files:**
- Create: `src/repos/retirar-de-ahorro.ts`
- Test: `src/repos/__tests__/retirar-de-ahorro.test.ts`

**Interfaces:**
- Consumes: `totalAhorrado` (Task 2), `Repos.savings.agregar`, `Repos.brokerCash.guardar` (ya existentes).
- Produces: `retirarDeAhorro(repos: Repos, params: ParametrosRetiro, movimientosActuales: SavingMovement[], brokerCashActual: BrokerCash): Promise<SavingMovement>` — consumido por Task 10 (`ahorro.tsx`).

- [ ] **Step 1: Crear `src/repos/retirar-de-ahorro.ts`**

```typescript
import { totalAhorrado } from '../domain/budget';
import { formatCentavos } from '../domain/money';
import type { BrokerCash, SavingMovement } from '../domain/types';
import type { Repos } from './create-repo';

export interface ParametrosRetiro {
  centavosArs: number; // positivo
  destino: 'disponible' | 'inversiones';
  fecha: string;
}

/**
 * Retira plata de ahorro. Si el destino es 'inversiones', además suma el
 * monto al cash del broker (mismo patrón que venderInversion). Si el
 * destino es 'disponible', no hace falta ninguna otra escritura:
 * calcularResumenMes ya suma los retiros con destino 'disponible' al
 * disponible del mes. Recibe el estado actual ya cargado por el llamador.
 */
export async function retirarDeAhorro(
  repos: Repos,
  params: ParametrosRetiro,
  movimientosActuales: SavingMovement[],
  brokerCashActual: BrokerCash
): Promise<SavingMovement> {
  const saldoAhorro = totalAhorrado(movimientosActuales);
  if (params.centavosArs > saldoAhorro) {
    throw new Error(`No podés retirar más de ${formatCentavos(saldoAhorro)} (tu saldo de ahorro)`);
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

- [ ] **Step 2: Crear el test**

```typescript
import { retirarDeAhorro } from '../retirar-de-ahorro';
import type { Repos } from '../create-repo';
import type { BrokerCash, SavingMovement } from '../../domain/types';

function crearMovimiento(parcial: Partial<SavingMovement> = {}): SavingMovement {
  return {
    id: 'm1',
    centavosArs: 10000,
    fecha: '2026-06-01',
    nota: null,
    origen: 'ingresos',
    destino: null,
    gastoId: null,
    ...parcial,
  };
}

function crearReposFake() {
  const movimientosCreados: Omit<SavingMovement, 'id'>[] = [];
  let brokerCashActual = 0;

  const repos = {
    savings: {
      agregar: jest.fn(async (movimiento: Omit<SavingMovement, 'id'>) => {
        movimientosCreados.push(movimiento);
        return { ...movimiento, id: 'retiro1' };
      }),
    },
    brokerCash: {
      guardar: jest.fn(async (centavos: number) => {
        brokerCashActual = centavos;
        return { id: 'actual', centavosArs: brokerCashActual } as BrokerCash;
      }),
    },
  };

  return { repos: repos as unknown as Repos, movimientosCreados, obtenerBrokerCash: () => brokerCashActual };
}

describe('retirarDeAhorro', () => {
  it('destino disponible: crea el retiro y no toca el cash del broker', async () => {
    const { repos, movimientosCreados } = crearReposFake();
    const movimientos = [crearMovimiento({ centavosArs: 10000 })];
    const brokerCash: BrokerCash = { id: 'actual', centavosArs: 0 };

    const movimiento = await retirarDeAhorro(
      repos,
      { centavosArs: 4000, destino: 'disponible', fecha: '2026-06-05' },
      movimientos,
      brokerCash
    );

    expect(movimiento.centavosArs).toBe(-4000);
    expect(movimiento.destino).toBe('disponible');
    expect((repos.brokerCash.guardar as jest.Mock)).not.toHaveBeenCalled();
    expect(movimientosCreados).toHaveLength(1);
  });

  it('destino inversiones: crea el retiro y suma el monto al cash existente del broker', async () => {
    const { repos, obtenerBrokerCash } = crearReposFake();
    const movimientos = [crearMovimiento({ centavosArs: 10000 })];
    const brokerCash: BrokerCash = { id: 'actual', centavosArs: 50000 };

    const movimiento = await retirarDeAhorro(
      repos,
      { centavosArs: 4000, destino: 'inversiones', fecha: '2026-06-05' },
      movimientos,
      brokerCash
    );

    expect(movimiento.destino).toBe('inversiones');
    expect(obtenerBrokerCash()).toBe(54000);
  });

  it('rechaza retirar más de lo que hay ahorrado, sin escribir nada', async () => {
    const { repos, movimientosCreados } = crearReposFake();
    const movimientos = [crearMovimiento({ centavosArs: 3000 })];
    const brokerCash: BrokerCash = { id: 'actual', centavosArs: 0 };

    await expect(
      retirarDeAhorro(repos, { centavosArs: 4000, destino: 'disponible', fecha: '2026-06-05' }, movimientos, brokerCash)
    ).rejects.toThrow();

    expect(movimientosCreados).toHaveLength(0);
    expect((repos.brokerCash.guardar as jest.Mock)).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Correr los tests**

Run: `npx jest src/repos/__tests__/retirar-de-ahorro.test.ts`
Expected: 3 tests, todos PASS.

- [ ] **Step 4: Commit**

```bash
git add src/repos/retirar-de-ahorro.ts src/repos/__tests__/retirar-de-ahorro.test.ts
git commit -m "agrega retirarDeAhorro: retiro con destino disponible o inversiones"
```

---

### Task 9: `gasto-nuevo.tsx` — chip de fuente y `pagarGasto`

**Files:**
- Modify: `app/gasto-nuevo.tsx`

**Interfaces:**
- Consumes: `pagarGasto` (Task 6), `totalAhorrado` (Task 2), `useAhorros` (ya existente en `src/hooks/use-datos.ts`).

- [ ] **Step 1: Agregar imports**

Reemplazar:

```typescript
import { useSectores } from '../src/hooks/use-datos';
import { parseAmountToCentavos } from '../src/domain/money';
```

por:

```typescript
import { useSectores, useAhorros } from '../src/hooks/use-datos';
import { parseAmountToCentavos, formatCentavos } from '../src/domain/money';
import { totalAhorrado } from '../src/domain/budget';
import { pagarGasto } from '../src/repos/pagar-gasto';
```

- [ ] **Step 2: Agregar estado de `fuente` y el hook de movimientos**

Reemplazar:

```typescript
  const { repos } = useApp();
  const sectores = useSectores();
  const colors = useColors();
```

por:

```typescript
  const { repos } = useApp();
  const sectores = useSectores();
  const movimientos = useAhorros();
  const colors = useColors();
```

Y reemplazar:

```typescript
  const [metodoPersonalizado, setMetodoPersonalizado] = useState('');
  const [guardando, setGuardando] = useState(false);
```

por:

```typescript
  const [metodoPersonalizado, setMetodoPersonalizado] = useState('');
  const [fuente, setFuente] = useState<'disponible' | 'ahorro'>('disponible');
  const [guardando, setGuardando] = useState(false);
```

- [ ] **Step 3: Usar `pagarGasto` en `guardar()`, con validación de tope y manejo de error**

Reemplazar:

```typescript
  async function guardar() {
    const centavos = parseAmountToCentavos(montoTexto);
    if (centavos === null || centavos === 0) {
      setError('Ingresá un monto válido');
      return;
    }

    setGuardando(true);
    try {
      await repos.expenses.agregar({
        centavosArs: centavos,
        montoOriginal: centavos / 100,
        monedaOriginal: 'ARS',
        cotizacionUsada: null,
        fecha: new Date().toISOString().slice(0, 10),
        sectorId,
        lugar: lugar.trim() || null,
        descripcion: descripcion.trim() || null,
        metodoPago: metodoPersonalizado.trim() || metodoPago,
      });
      router.back();
    } finally {
      setGuardando(false);
    }
  }
```

por:

```typescript
  async function guardar() {
    const centavos = parseAmountToCentavos(montoTexto);
    if (centavos === null || centavos === 0) {
      setError('Ingresá un monto válido');
      return;
    }

    setGuardando(true);
    try {
      await pagarGasto(
        repos,
        {
          centavosArs: centavos,
          montoOriginal: centavos / 100,
          monedaOriginal: 'ARS',
          cotizacionUsada: null,
          fecha: new Date().toISOString().slice(0, 10),
          sectorId,
          lugar: lugar.trim() || null,
          descripcion: descripcion.trim() || null,
          metodoPago: metodoPersonalizado.trim() || metodoPago,
          fuente,
        },
        movimientos
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el gasto');
    } finally {
      setGuardando(false);
    }
  }
```

- [ ] **Step 4: Agregar el chip de "Fuente" antes de "Sector"**

Reemplazar:

```typescript
      <View style={estilos.opcionales}>
        <Text style={estilos.etiquetaCampo}>Sector</Text>
```

por:

```typescript
      <View style={estilos.opcionales}>
        <Text style={estilos.etiquetaCampo}>Fuente</Text>
        <View style={estilos.filaChips}>
          <Pressable
            onPress={() => setFuente('disponible')}
            style={[estilos.chip, { borderColor: colors.border }, fuente === 'disponible' && { backgroundColor: colors.primary }]}
          >
            <Text style={[estilos.textoChip, fuente === 'disponible' && { color: colors.onPrimary }]}>Presupuesto</Text>
          </Pressable>
          <Pressable
            onPress={() => setFuente('ahorro')}
            style={[estilos.chip, { borderColor: colors.border }, fuente === 'ahorro' && { backgroundColor: colors.primary }]}
          >
            <Text style={[estilos.textoChip, fuente === 'ahorro' && { color: colors.onPrimary }]}>Ahorro</Text>
          </Pressable>
        </View>
        {fuente === 'ahorro' && (
          <Text style={estilos.ayudaFuente}>Saldo de ahorro disponible: {formatCentavos(totalAhorrado(movimientos))}</Text>
        )}

        <Text style={estilos.etiquetaCampo}>Sector</Text>
```

- [ ] **Step 5: Agregar el estilo `ayudaFuente`**

Reemplazar:

```typescript
    etiquetaCampo: { color: colors.text2, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
```

por:

```typescript
    etiquetaCampo: { color: colors.text2, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
    ayudaFuente: { color: colors.text3, fontSize: 12, marginTop: -spacing.xs, marginBottom: spacing.xs },
```

- [ ] **Step 6: Verificar tests (no debería haber tests directos de esta pantalla, pero confirmar que no rompió nada)**

Run: `npm test`
Expected: pasa igual que antes (esta pantalla no tiene test unitario propio).

- [ ] **Step 7: Commit**

```bash
git add app/gasto-nuevo.tsx
git commit -m "agrega selector de fuente (presupuesto/ahorro) en Nuevo gasto"
```

---

### Task 10: `ahorro.tsx` — sección "Retirar de ahorro" y etiquetas del historial

**Files:**
- Modify: `app/(tabs)/ahorro.tsx`

**Interfaces:**
- Consumes: `retirarDeAhorro` (Task 8), `totalAhorrado` (Task 2).

- [ ] **Step 1: Agregar imports**

Reemplazar:

```typescript
import { ahorradoHasta, mesAnterior } from '../../src/domain/budget';
```

por:

```typescript
import { ahorradoHasta, mesAnterior, totalAhorrado } from '../../src/domain/budget';
import { retirarDeAhorro } from '../../src/repos/retirar-de-ahorro';
import type { SavingMovement } from '../../src/domain/types';
```

- [ ] **Step 2: Reemplazar el cálculo local de `totalAhorrado` por la función del dominio**

Reemplazar:

```typescript
  const totalAhorrado = movimientos.reduce((acc, m) => acc + m.centavosArs, 0);
  const inversiones = useInversiones();
  const brokerCash = useBrokerCash();
  const patrimonioTotal = totalAhorrado + patrimonioInversiones(inversiones, brokerCash.centavosArs);
```

por:

```typescript
  const totalAhorradoActual = totalAhorrado(movimientos);
  const inversiones = useInversiones();
  const brokerCash = useBrokerCash();
  const patrimonioTotal = totalAhorradoActual + patrimonioInversiones(inversiones, brokerCash.centavosArs);
```

Y reemplazar el único otro uso de la variable local:

```typescript
          <Text style={estilos.montoGrande}>{formatCentavos(totalAhorrado)}</Text>
```

por:

```typescript
          <Text style={estilos.montoGrande}>{formatCentavos(totalAhorradoActual)}</Text>
```

- [ ] **Step 3: Completar `destino`/`gastoId` en el aporte que ya crea `mandarAAhorro`**

`SavingMovement.destino` y `.gastoId` pasaron a ser campos obligatorios (aunque nullable) en Task 1. El `repos.savings.agregar(...)` que ya existe en `mandarAAhorro` para crear aportes necesita incluirlos.

Reemplazar:

```typescript
      await repos.savings.agregar({
        centavosArs: centavos,
        fecha: new Date().toISOString().slice(0, 10),
        nota: null,
        origen,
      });
```

por:

```typescript
      await repos.savings.agregar({
        centavosArs: centavos,
        fecha: new Date().toISOString().slice(0, 10),
        nota: null,
        origen,
        destino: null,
        gastoId: null,
      });
```

- [ ] **Step 4: Agregar estado y función de retiro**

Reemplazar:

```typescript
  const [montoTexto, setMontoTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [origen, setOrigen] = useState<'ingresos' | 'externo'>('ingresos');
```

por:

```typescript
  const [montoTexto, setMontoTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [origen, setOrigen] = useState<'ingresos' | 'externo'>('ingresos');

  const [montoRetiroTexto, setMontoRetiroTexto] = useState('');
  const [errorRetiro, setErrorRetiro] = useState<string | null>(null);
  const [retirando, setRetirando] = useState(false);
  const [destinoRetiro, setDestinoRetiro] = useState<'disponible' | 'inversiones'>('disponible');
```

Y, después de la función `mandarAAhorro` (después de su llave de cierre `}`), agregar:

```typescript

  async function retirar() {
    if (retirando) return;
    const centavos = parseAmountToCentavos(montoRetiroTexto);
    if (centavos === null || centavos <= 0) {
      setErrorRetiro('Ingresá un monto válido');
      return;
    }
    setRetirando(true);
    try {
      await retirarDeAhorro(
        repos,
        { centavosArs: centavos, destino: destinoRetiro, fecha: new Date().toISOString().slice(0, 10) },
        movimientos,
        brokerCash
      );
      setMontoRetiroTexto('');
      setErrorRetiro(null);
    } catch (e) {
      setErrorRetiro(e instanceof Error ? e.message : 'No se pudo retirar');
    } finally {
      setRetirando(false);
    }
  }
```

- [ ] **Step 5: Agregar la sección "Retirar de ahorro" antes del `FlatList`**

Reemplazar:

```typescript
        <FlatList
          data={movimientosOrdenados}
          keyExtractor={(m) => m.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={estilos.filaMovimiento}>
              <View>
                <Text style={estilos.fechaMovimiento}>{item.fecha}</Text>
                <Text style={estilos.etiquetaOrigen}>
                  {(item.origen ?? 'ingresos') === 'ingresos' ? 'De presupuesto' : 'Aporte externo'}
                </Text>
              </View>
              <Text style={estilos.montoMovimiento}>{formatCentavos(item.centavosArs)}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={estilos.vacio}>Todavía no mandaste nada a ahorro.</Text>}
        />
```

por:

```typescript
        <Text style={estilos.tituloSeccion}>Retirar de ahorro</Text>
        <View style={estilos.formulario}>
          <View style={estilos.filaChips}>
            <Pressable
              onPress={() => setDestinoRetiro('disponible')}
              style={[estilos.chip, destinoRetiro === 'disponible' && estilos.chipActivo]}
            >
              <Text style={[estilos.textoChip, destinoRetiro === 'disponible' && estilos.textoChipActivo]}>
                Disponible del mes
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setDestinoRetiro('inversiones')}
              style={[estilos.chip, destinoRetiro === 'inversiones' && estilos.chipActivo]}
            >
              <Text style={[estilos.textoChip, destinoRetiro === 'inversiones' && estilos.textoChipActivo]}>
                Inversiones
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={montoRetiroTexto}
            onChangeText={(t) => {
              setMontoRetiroTexto(t);
              setErrorRetiro(null);
            }}
            placeholder="Monto a retirar"
            keyboardType="decimal-pad"
            style={estilos.input}
          />
          <Toast texto={errorRetiro} tipo="error" colors={colors} />
          <Pressable style={[estilos.boton, retirando && estilos.botonDeshabilitado]} onPress={retirar} disabled={retirando}>
            <Text style={estilos.textoBoton}>{retirando ? 'Retirando...' : 'Retirar de ahorro'}</Text>
          </Pressable>
        </View>

        <FlatList
          data={movimientosOrdenados}
          keyExtractor={(m) => m.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={estilos.filaMovimiento}>
              <View>
                <Text style={estilos.fechaMovimiento}>{item.fecha}</Text>
                <Text style={estilos.etiquetaOrigen}>{etiquetaMovimiento(item)}</Text>
              </View>
              <Text style={estilos.montoMovimiento}>{formatCentavos(item.centavosArs)}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={estilos.vacio}>Todavía no mandaste nada a ahorro.</Text>}
        />
```

- [ ] **Step 6: Agregar la función `etiquetaMovimiento`**

Al final del archivo, antes de `function crearEstilos(colors: Colors) {`, agregar:

```typescript
function etiquetaMovimiento(m: SavingMovement): string {
  if (m.centavosArs >= 0) {
    return (m.origen ?? 'ingresos') === 'ingresos' ? 'De presupuesto' : 'Aporte externo';
  }
  if (m.destino === 'inversiones') return 'Retiro → inversiones';
  if (m.destino === 'gasto') return 'Retiro → gasto';
  return 'Retiro → disponible del mes';
}

```

- [ ] **Step 7: Verificar tests**

Run: `npm test`
Expected: pasa igual que antes (esta pantalla no tiene test unitario propio; los estilos `chip`/`chipActivo`/`textoChip`/`textoChipActivo`/`formulario`/`input`/`boton`/`botonDeshabilitado`/`textoBoton` ya existen en `crearEstilos`, no hace falta agregar ninguno nuevo).

- [ ] **Step 8: Commit**

```bash
git add "app/(tabs)/ahorro.tsx"
git commit -m "agrega seccion Retirar de ahorro y etiquetas de retiro en el historial"
```

---

### Task 11: Borrado de gastos usa `eliminarGasto`

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/historial.tsx`

**Interfaces:**
- Consumes: `eliminarGasto` (Task 7), `useAhorros` (ya existente).

- [ ] **Step 1: `index.tsx` — agregar imports y el hook de movimientos**

Reemplazar:

```typescript
import { useSectores, useObjetivos } from '../../src/hooks/use-datos';
import { useGastos } from '../../src/hooks/use-datos';
```

por:

```typescript
import { useSectores, useObjetivos, useAhorros } from '../../src/hooks/use-datos';
import { useGastos } from '../../src/hooks/use-datos';
import { eliminarGasto } from '../../src/repos/eliminar-gasto';
```

Reemplazar:

```typescript
  const gastos = useGastos();
  const preferencias = usePreferences();
```

por:

```typescript
  const gastos = useGastos();
  const movimientos = useAhorros();
  const preferencias = usePreferences();
```

- [ ] **Step 2: `index.tsx` — usar `eliminarGasto` en el botón de borrar**

Reemplazar:

```typescript
                  <Pressable onPress={() => repos.expenses.eliminar(g.id)} hitSlop={8} style={estilos.botonBorrarGasto}>
```

por:

```typescript
                  <Pressable onPress={() => eliminarGasto(repos, g, movimientos)} hitSlop={8} style={estilos.botonBorrarGasto}>
```

- [ ] **Step 3: `historial.tsx` — agregar imports y el hook de movimientos**

Reemplazar:

```typescript
import { useSectores, useGastos } from '../../src/hooks/use-datos';
```

por:

```typescript
import { useSectores, useGastos, useAhorros } from '../../src/hooks/use-datos';
import { eliminarGasto } from '../../src/repos/eliminar-gasto';
```

Reemplazar:

```typescript
  const sectores = useSectores();
  const gastos = useGastos();
```

por:

```typescript
  const sectores = useSectores();
  const gastos = useGastos();
  const movimientos = useAhorros();
```

- [ ] **Step 4: `historial.tsx` — usar `eliminarGasto` en el botón de borrar**

Reemplazar:

```typescript
            <Pressable onPress={() => repos.expenses.eliminar(item.id)} hitSlop={8} style={estilos.botonBorrar}>
```

por:

```typescript
            <Pressable onPress={() => eliminarGasto(repos, item, movimientos)} hitSlop={8} style={estilos.botonBorrar}>
```

- [ ] **Step 5: Verificar tests**

Run: `npm test`
Expected: pasa igual que antes (estas pantallas no tienen test unitario propio).

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/index.tsx" "app/(tabs)/historial.tsx"
git commit -m "borrar un gasto pagado con ahorro borra tambien su retiro vinculado"
```

---

### Task 12: Verificación final

- [ ] **Step 1: Correr toda la suite**

Run: `npm test`
Expected: 0 failing, incluyendo los tests nuevos de Tasks 3, 5, 6, 7, 8.

- [ ] **Step 2: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en los archivos tocados por este plan (los errores preexistentes de `firebase/auth` y `dolar.test.ts` con `global` ya estaban en `main` antes de este plan — no son de esta feature).

- [ ] **Step 3: Export web y verificación visual manual**

Run: `npx expo export -p web --clear`
Expected: build exitoso, sin errores de bundling.

Verificar manualmente en el navegador (o pedirle al usuario que lo pruebe):
- Nuevo gasto: aparece el chip Fuente, "Ahorro" muestra el saldo disponible, y falla con mensaje claro si se supera.
- Ahorro: aparece "Retirar de ahorro" con los dos destinos, y el historial muestra las etiquetas de retiro correctas.
- Borrar un gasto pagado con ahorro devuelve la plata al saldo de ahorro (visible en la pantalla de Ahorro).
