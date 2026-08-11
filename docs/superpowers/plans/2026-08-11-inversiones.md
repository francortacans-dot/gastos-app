# Inversiones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una sección de inversiones a Gastos App: cargar posiciones (ticker, nominales, PPC, moneda), venderlas parcial o totalmente, llevar el cash del broker, y exportar/compartir el portfolio en CSV. Las inversiones cuentan como patrimonio junto al ahorro, sin tocar el cálculo de presupuesto mensual.

**Architecture:** Mismo patrón local-first que ya usa la app (`expense-repo.ts`/`savings-repo.ts`): tres colecciones nuevas (`investments`, `investment-sales`, `broker-cash`) con repos independientes, una función de orquestación (`venderInversion`) que coordina los tres repos al vender, cálculos puros testeables en `src/domain/investments.ts`, y tres pantallas nuevas siguiendo el estilo visual existente.

**Tech Stack:** TypeScript, Expo SDK 57, expo-router, Firebase JS SDK, expo-sqlite (vía el `LocalStore` ya existente), `expo-file-system` + `expo-sharing` (nuevas, para exportar CSV), Jest + @testing-library/react-native.

## Global Constraints

- **Moneda canónica: ARS en centavos enteros.** Todo monto se guarda y calcula como `number` entero de centavos de ARS. El USD es solo una capa de visualización, igual que en el resto de la app.
- **Comentarios en español.** `camelCase` para variables/funciones, `kebab-case` para nombres de archivo, `PascalCase` para componentes.
- **Commits en español, descriptivos, en imperativo.**
- **Nunca commitear `.env` ni credenciales.**
- **Colores**: usar exclusivamente los tokens de `src/theme/colors.ts`.
- **TDD**: toda lógica no visual (dominio, repos, hooks reutilizables) se escribe con test que falla primero. Las pantallas (`app/**/*.tsx`) se verifican manualmente con `expo start --web`, siguiendo la convención ya establecida en el resto de la app (no hay tests de pantallas en el repo).
- **Un solo usuario.** Sin resolución de conflictos: last-write-wins.
- **Valuación a costo de compra, nunca a precio de mercado.** No se integra ninguna API de cotización de acciones en este alcance.
- **No se modifica `calcularResumenMes` ni nada de `src/domain/budget.ts`.** Las inversiones no participan del rollover mensual de presupuesto; son una foto de patrimonio aparte.
- **Cada carga de inversión es un lote independiente.** Nunca promediar el PPC entre dos cargas del mismo ticker.

---

## Estructura de archivos

```
GastosApp/
├── app/
│   ├── _layout.tsx                   # MODIFICAR: agrega Stack.Screen inversion-nueva / inversion-vender
│   ├── inversion-nueva.tsx           # NUEVO
│   ├── inversion-vender.tsx          # NUEVO
│   └── (tabs)/
│       ├── _layout.tsx               # MODIFICAR: agrega tab Inversiones
│       ├── ahorro.tsx                # MODIFICAR: agrega "Patrimonio total"
│       └── inversiones.tsx           # NUEVO
├── src/
│   ├── domain/
│   │   ├── types.ts                  # MODIFICAR: Investment, InvestmentSale, BrokerCash
│   │   ├── investments.ts            # NUEVO: cálculos puros
│   │   ├── export-csv.ts             # NUEVO: generarCsvPortfolio
│   │   └── __tests__/
│   │       ├── investments.test.ts   # NUEVO
│   │       └── export-csv.test.ts    # NUEVO
│   ├── db/
│   │   └── local-store.ts            # MODIFICAR: union de PendingWrite.coleccion
│   ├── repos/
│   │   ├── investment-repo.ts        # NUEVO
│   │   ├── investment-sale-repo.ts   # NUEVO
│   │   ├── broker-cash-repo.ts       # NUEVO
│   │   ├── vender-inversion.ts       # NUEVO: orquestación de venta
│   │   ├── create-repo.ts            # MODIFICAR: registra los 3 repos nuevos
│   │   └── __tests__/
│   │       ├── investment-repo.test.ts       # NUEVO
│   │       ├── investment-sale-repo.test.ts  # NUEVO
│   │       ├── broker-cash-repo.test.ts      # NUEVO
│   │       └── vender-inversion.test.ts      # NUEVO
│   ├── hooks/
│   │   ├── use-singleton.ts          # NUEVO: como useCollection pero para un doc único
│   │   ├── use-datos.ts              # MODIFICAR: useInversiones, useVentas, useBrokerCash
│   │   └── __tests__/
│   │       └── use-singleton.test.ts # NUEVO
│   └── services/
│       └── compartir-csv.ts          # NUEVO: escribir + compartir/descargar el CSV
└── package.json                      # MODIFICAR: agrega expo-file-system, expo-sharing
```

---

## Task 1: Tipos de dominio y cálculos puros de inversiones

**Files:**
- Modify: `src/domain/types.ts`, `src/db/local-store.ts`
- Create: `src/domain/investments.ts`, `src/domain/__tests__/investments.test.ts`

**Interfaces:**
- Consumes: `Currency` de `src/domain/types.ts`, `usdToCentavosArs` de `src/domain/money.ts`
- Produces:
  - `interface Investment { id, ticker, nominales, ppc, monedaOriginal, cotizacionUsada, costoCentavosArsUnitario, rubro, fecha, status }`
  - `interface InvestmentSale { id, investmentId, nominalesVendidos, precioVenta, cotizacionUsada, ingresoCentavosArs, gananciaCentavosArs, fecha }`
  - `interface BrokerCash { id: 'actual', centavosArs }`
  - `function costoUnitarioCentavosArs(precio: number, monedaOriginal: Currency, cotizacionUsada: number | null): number`
  - `function costoTotalPosicion(inversion: Investment): number`
  - `function costoTotalAbierto(inversiones: Investment[]): number`
  - `function patrimonioInversiones(inversiones: Investment[], brokerCashCentavosArs: number): number`
  - `interface ResultadoVenta { ingresoCentavosArs, gananciaCentavosArs }`
  - `function calcularVenta(inversion: Investment, nominalesVendidos: number, precioVenta: number, cotizacionUsada: number | null): ResultadoVenta`

- [ ] **Step 1: Agregar los tipos a `src/domain/types.ts`**

Agregar al final del archivo (después de `SavingMovement`):

```typescript
export interface Investment {
  id: string;
  ticker: string;
  /** Cantidad actual de nominales. Baja con ventas parciales. */
  nominales: number;
  /** Precio promedio de compra tal como se tipeó, en monedaOriginal. */
  ppc: number;
  monedaOriginal: Currency;
  /** Cotización usada al cargar, si monedaOriginal es USD. null si fue ARS. */
  cotizacionUsada: number | null;
  /** Costo por nominal en centavos de ARS. Única fuente de verdad para el costo total. */
  costoCentavosArsUnitario: number;
  /** Rubro/categoría de texto libre, ej. 'Tech'. Sin relación con los Sector de gastos. */
  rubro: string | null;
  /** Fecha de entrada, ISO 'YYYY-MM-DD'. */
  fecha: string;
  status: 'OPEN' | 'CLOSED';
}

export interface InvestmentSale {
  id: string;
  investmentId: string;
  nominalesVendidos: number;
  /** Precio de venta tal como se tipeó, en la monedaOriginal de la inversión vendida. */
  precioVenta: number;
  cotizacionUsada: number | null;
  /** nominalesVendidos * precioVenta convertido a ARS. Es lo que entra como cash al broker. */
  ingresoCentavosArs: number;
  /** ingresoCentavosArs menos el costo de esos nominales. Dato informativo. */
  gananciaCentavosArs: number;
  /** Fecha ISO 'YYYY-MM-DD'. */
  fecha: string;
}

export interface BrokerCash {
  id: 'actual';
  /** Saldo de efectivo sin invertir en el broker, en centavos de ARS. */
  centavosArs: number;
}
```

- [ ] **Step 2: Extender la unión de colecciones en `src/db/local-store.ts`**

Cambiar la línea 3 de:

```typescript
  coleccion: 'expenses' | 'sectors' | 'budgets' | 'savings';
```

a:

```typescript
  coleccion: 'expenses' | 'sectors' | 'budgets' | 'savings' | 'investments' | 'investment-sales' | 'broker-cash';
```

- [ ] **Step 3: Escribir los tests de `investments.ts` que fallan**

Crear `src/domain/__tests__/investments.test.ts`:

```typescript
import {
  costoUnitarioCentavosArs,
  costoTotalPosicion,
  costoTotalAbierto,
  patrimonioInversiones,
  calcularVenta,
} from '../investments';
import type { Investment } from '../types';

function inversion(parcial: Partial<Investment> = {}): Investment {
  return {
    id: 'i1',
    ticker: 'BMA',
    nominales: 10,
    ppc: 9.42,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    costoCentavosArsUnitario: 942,
    rubro: null,
    fecha: '2026-08-11',
    status: 'OPEN',
    ...parcial,
  };
}

describe('costoUnitarioCentavosArs', () => {
  it('en ARS, redondea el precio a centavos directamente', () => {
    expect(costoUnitarioCentavosArs(9.42, 'ARS', null)).toBe(942);
  });

  it('en USD, convierte con la cotización usada', () => {
    expect(costoUnitarioCentavosArs(11.9, 'USD', 1500)).toBe(1785000);
  });

  it('en USD sin cotización, trata la cotización como 0', () => {
    expect(costoUnitarioCentavosArs(11.9, 'USD', null)).toBe(0);
  });
});

describe('costoTotalPosicion', () => {
  it('multiplica nominales por el costo unitario', () => {
    const i = inversion({ nominales: 10, costoCentavosArsUnitario: 942 });
    expect(costoTotalPosicion(i)).toBe(9420);
  });
});

describe('costoTotalAbierto', () => {
  it('suma solo las posiciones OPEN', () => {
    const inversiones = [
      inversion({ id: 'a', nominales: 10, costoCentavosArsUnitario: 100, status: 'OPEN' }),
      inversion({ id: 'b', nominales: 5, costoCentavosArsUnitario: 200, status: 'OPEN' }),
      inversion({ id: 'c', nominales: 0, costoCentavosArsUnitario: 300, status: 'CLOSED' }),
    ];
    expect(costoTotalAbierto(inversiones)).toBe(10 * 100 + 5 * 200);
  });

  it('devuelve 0 sin inversiones', () => {
    expect(costoTotalAbierto([])).toBe(0);
  });
});

describe('patrimonioInversiones', () => {
  it('suma el costo abierto y el cash del broker', () => {
    const inversiones = [inversion({ nominales: 10, costoCentavosArsUnitario: 100, status: 'OPEN' })];
    expect(patrimonioInversiones(inversiones, 5000)).toBe(1000 + 5000);
  });
});

describe('calcularVenta', () => {
  it('calcula ingreso y ganancia cuando se vende por encima del costo', () => {
    const i = inversion({ nominales: 10, costoCentavosArsUnitario: 1000, monedaOriginal: 'ARS' });
    const resultado = calcularVenta(i, 4, 15, null);
    expect(resultado.ingresoCentavosArs).toBe(6000);
    expect(resultado.gananciaCentavosArs).toBe(2000);
  });

  it('calcula pérdida cuando se vende por debajo del costo', () => {
    const i = inversion({ nominales: 10, costoCentavosArsUnitario: 1000, monedaOriginal: 'ARS' });
    const resultado = calcularVenta(i, 4, 8, null);
    expect(resultado.ingresoCentavosArs).toBe(3200);
    expect(resultado.gananciaCentavosArs).toBe(-800);
  });

  it('convierte el precio de venta con la cotización si la moneda es USD', () => {
    const i = inversion({ nominales: 10, costoCentavosArsUnitario: 1700000, monedaOriginal: 'USD', cotizacionUsada: 1400 });
    const resultado = calcularVenta(i, 2, 12, 1500);
    expect(resultado.ingresoCentavosArs).toBe(3600000);
    expect(resultado.gananciaCentavosArs).toBe(200000);
  });

  it('lanza un error si nominalesVendidos es 0 o negativo', () => {
    const i = inversion({ nominales: 10 });
    expect(() => calcularVenta(i, 0, 10, null)).toThrow();
    expect(() => calcularVenta(i, -1, 10, null)).toThrow();
  });

  it('lanza un error si se intenta vender más de lo que hay', () => {
    const i = inversion({ nominales: 10 });
    expect(() => calcularVenta(i, 11, 10, null)).toThrow();
  });
});
```

- [ ] **Step 4: Correr los tests y verificar que fallan**

Run: `npm test -- investments`
Expected: FAIL — "Cannot find module '../investments'".

- [ ] **Step 5: Implementar `src/domain/investments.ts`**

```typescript
import type { Currency, Investment } from './types';
import { usdToCentavosArs } from './money';

/** Convierte un precio por nominal en su moneda original a centavos de ARS por nominal. */
export function costoUnitarioCentavosArs(
  precio: number,
  monedaOriginal: Currency,
  cotizacionUsada: number | null
): number {
  if (monedaOriginal === 'ARS') return Math.round(precio * 100);
  return usdToCentavosArs(precio, cotizacionUsada ?? 0);
}

/** Costo total de una posición: nominales actuales * costo unitario. Nunca se guarda, se calcula siempre así. */
export function costoTotalPosicion(inversion: Investment): number {
  return inversion.nominales * inversion.costoCentavosArsUnitario;
}

/** Suma el costo de todas las posiciones abiertas (status OPEN). */
export function costoTotalAbierto(inversiones: Investment[]): number {
  return inversiones
    .filter((i) => i.status === 'OPEN')
    .reduce((acc, i) => acc + costoTotalPosicion(i), 0);
}

/** Patrimonio en inversiones: costo de lo invertido más el cash sin invertir en el broker. */
export function patrimonioInversiones(inversiones: Investment[], brokerCashCentavosArs: number): number {
  return costoTotalAbierto(inversiones) + brokerCashCentavosArs;
}

export interface ResultadoVenta {
  ingresoCentavosArs: number;
  gananciaCentavosArs: number;
}

/**
 * Calcula el resultado de vender `nominalesVendidos` de una posición a `precioVenta`
 * (en la monedaOriginal de la inversión). Lanza si se intenta vender 0, negativo, o
 * más nominales de los que hay disponibles.
 */
export function calcularVenta(
  inversion: Investment,
  nominalesVendidos: number,
  precioVenta: number,
  cotizacionUsada: number | null
): ResultadoVenta {
  if (nominalesVendidos <= 0) {
    throw new Error('nominalesVendidos debe ser mayor a 0');
  }
  if (nominalesVendidos > inversion.nominales) {
    throw new Error('No se pueden vender más nominales de los que hay en la posición');
  }

  const precioVentaCentavosArsUnitario = costoUnitarioCentavosArs(
    precioVenta,
    inversion.monedaOriginal,
    cotizacionUsada
  );
  const ingresoCentavosArs = nominalesVendidos * precioVentaCentavosArsUnitario;
  const costoCentavosArs = nominalesVendidos * inversion.costoCentavosArsUnitario;
  const gananciaCentavosArs = ingresoCentavosArs - costoCentavosArs;

  return { ingresoCentavosArs, gananciaCentavosArs };
}
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `npm test -- investments`
Expected: PASS — todos los tests de investments pasan.

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts src/domain/investments.ts src/domain/__tests__/investments.test.ts src/db/local-store.ts
git commit -m "agrega tipos y cálculos puros del dominio de inversiones"
```

---

## Task 2: Repo de inversiones

**Files:**
- Create: `src/repos/investment-repo.ts`, `src/repos/__tests__/investment-repo.test.ts`

**Interfaces:**
- Consumes: `Investment` de `src/domain/types.ts`, `LocalStore` de `src/db/local-store.ts`
- Produces:
  - `interface InvestmentRepo { listar(), agregar(posicion: Omit<Investment,'id'>), actualizar(id, cambios: Partial<Pick<Investment,'nominales'|'status'>>), eliminar(id), suscribir(cb) }`
  - `function crearInvestmentRepo(deps): InvestmentRepo`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/repos/__tests__/investment-repo.test.ts`:

```typescript
import { crearInvestmentRepo } from '../investment-repo';
import type { LocalStore, PendingWrite } from '../../db/local-store';
import type { Investment } from '../../domain/types';

jest.mock('expo-crypto', () => ({
  __esModule: true,
  randomUUID: () => require('node:crypto').randomUUID(),
}));

function crearStoreFake(): LocalStore & { pendientes: PendingWrite[] } {
  const pendientes: PendingWrite[] = [];
  const snapshots: Record<string, unknown[]> = { investments: [] };
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

function posicionParcial(): Omit<Investment, 'id'> {
  return {
    ticker: 'BMA',
    nominales: 10,
    ppc: 9.42,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    costoCentavosArsUnitario: 942,
    rubro: null,
    fecha: '2026-08-11',
    status: 'OPEN',
  };
}

describe('crearInvestmentRepo sin conexión', () => {
  it('agregar() genera un id, guarda snapshot local y encola la escritura', async () => {
    const store = crearStoreFake();
    const repo = crearInvestmentRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    const inversion = await repo.agregar(posicionParcial());

    expect(typeof inversion.id).toBe('string');
    expect(inversion.id.length).toBeGreaterThan(0);
    expect(store.pendientes).toHaveLength(1);
    expect(store.pendientes[0].coleccion).toBe('investments');
    expect(store.pendientes[0].operacion).toBe('set');
  });

  it('listar() devuelve lo guardado en el snapshot local', async () => {
    const store = crearStoreFake();
    const repo = crearInvestmentRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    await repo.agregar(posicionParcial());
    const lista = await repo.listar();

    expect(lista).toHaveLength(1);
    expect(lista[0].ticker).toBe('BMA');
  });

  it('actualizar() modifica nominales y status, y encola la escritura', async () => {
    const store = crearStoreFake();
    const repo = crearInvestmentRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    const inversion = await repo.agregar(posicionParcial());
    const actualizada = await repo.actualizar(inversion.id, { nominales: 0, status: 'CLOSED' });

    expect(actualizada.nominales).toBe(0);
    expect(actualizada.status).toBe('CLOSED');
    const lista = await repo.listar();
    expect(lista[0].status).toBe('CLOSED');
    expect(store.pendientes.filter((p) => p.id === inversion.id)).toHaveLength(2); // agregar + actualizar
  });

  it('actualizar() lanza un error si el id no existe', async () => {
    const store = crearStoreFake();
    const repo = crearInvestmentRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    await expect(repo.actualizar('no-existe', { nominales: 0, status: 'CLOSED' })).rejects.toThrow();
  });

  it('eliminar() encola un delete y lo saca de listar()', async () => {
    const store = crearStoreFake();
    const repo = crearInvestmentRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    const inversion = await repo.agregar(posicionParcial());
    await repo.eliminar(inversion.id);
    const lista = await repo.listar();

    expect(lista).toHaveLength(0);
    expect(store.pendientes.some((p) => p.operacion === 'delete' && p.id === inversion.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- investment-repo`
Expected: FAIL — "Cannot find module '../investment-repo'".

- [ ] **Step 3: Implementar `src/repos/investment-repo.ts`**

```typescript
import { doc, deleteDoc, setDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import type { LocalStore } from '../db/local-store';
import type { Investment } from '../domain/types';

interface DepsInvestmentRepo {
  db: Firestore;
  uid: string;
  localStore: LocalStore;
  estaOnline: () => boolean;
}

export interface InvestmentRepo {
  listar(): Promise<Investment[]>;
  agregar(posicion: Omit<Investment, 'id'>): Promise<Investment>;
  actualizar(id: string, cambios: Partial<Pick<Investment, 'nominales' | 'status'>>): Promise<Investment>;
  eliminar(id: string): Promise<void>;
  suscribir(cb: (inversiones: Investment[]) => void): () => void;
}

const COLECCION = 'investments' as const;

export function crearInvestmentRepo(deps: DepsInvestmentRepo): InvestmentRepo {
  const { db, uid, localStore, estaOnline } = deps;

  async function leerLocal(): Promise<Investment[]> {
    return (await localStore.leerSnapshot(COLECCION)) as Investment[];
  }

  async function escribirLocal(inversiones: Investment[]): Promise<void> {
    await localStore.guardarSnapshot(COLECCION, inversiones);
  }

  async function persistir(inversion: Investment): Promise<Investment> {
    await localStore.guardarPendiente({
      id: inversion.id,
      coleccion: COLECCION,
      operacion: 'set',
      datos: inversion as unknown as Record<string, unknown>,
      creadoEn: Date.now(),
    });

    if (estaOnline()) {
      await setDoc(doc(db, 'users', uid, COLECCION, inversion.id), inversion).catch(() => {});
    }

    return inversion;
  }

  return {
    async listar(): Promise<Investment[]> {
      return leerLocal();
    },

    async agregar(posicionSinId: Omit<Investment, 'id'>): Promise<Investment> {
      const inversion: Investment = { ...posicionSinId, id: Crypto.randomUUID() };

      const actuales = await leerLocal();
      await escribirLocal([...actuales, inversion]);

      return persistir(inversion);
    },

    async actualizar(
      id: string,
      cambios: Partial<Pick<Investment, 'nominales' | 'status'>>
    ): Promise<Investment> {
      const actuales = await leerLocal();
      const existente = actuales.find((i) => i.id === id);
      if (!existente) {
        throw new Error(`No existe una inversión con id ${id}`);
      }
      const actualizada: Investment = { ...existente, ...cambios };

      await escribirLocal(actuales.map((i) => (i.id === id ? actualizada : i)));

      return persistir(actualizada);
    },

    async eliminar(id: string): Promise<void> {
      const actuales = await leerLocal();
      await escribirLocal(actuales.filter((i) => i.id !== id));

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

    suscribir(cb: (inversiones: Investment[]) => void): () => void {
      if (!estaOnline()) return () => {};
      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const inversiones = snapshot.docs.map((d) => d.data() as Investment);
        escribirLocal(inversiones).then(() => cb(inversiones));
      });
    },
  };
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- investment-repo`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repos/investment-repo.ts src/repos/__tests__/investment-repo.test.ts
git commit -m "agrega repo de inversiones"
```

---

## Task 3: Repo de ventas de inversiones

**Files:**
- Create: `src/repos/investment-sale-repo.ts`, `src/repos/__tests__/investment-sale-repo.test.ts`

**Interfaces:**
- Consumes: `InvestmentSale` de `src/domain/types.ts`, `LocalStore`
- Produces:
  - `interface InvestmentSaleRepo { listar(), agregar(venta: Omit<InvestmentSale,'id'>), suscribir(cb) }`
  - `function crearInvestmentSaleRepo(deps): InvestmentSaleRepo`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/repos/__tests__/investment-sale-repo.test.ts`:

```typescript
import { crearInvestmentSaleRepo } from '../investment-sale-repo';
import type { LocalStore, PendingWrite } from '../../db/local-store';
import type { InvestmentSale } from '../../domain/types';

jest.mock('expo-crypto', () => ({
  __esModule: true,
  randomUUID: () => require('node:crypto').randomUUID(),
}));

function crearStoreFake(): LocalStore & { pendientes: PendingWrite[] } {
  const pendientes: PendingWrite[] = [];
  const snapshots: Record<string, unknown[]> = { 'investment-sales': [] };
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

function ventaParcial(): Omit<InvestmentSale, 'id'> {
  return {
    investmentId: 'inv1',
    nominalesVendidos: 4,
    precioVenta: 15,
    cotizacionUsada: null,
    ingresoCentavosArs: 6000,
    gananciaCentavosArs: 2000,
    fecha: '2026-08-11',
  };
}

describe('crearInvestmentSaleRepo sin conexión', () => {
  it('agregar() genera un id, guarda snapshot local y encola la escritura', async () => {
    const store = crearStoreFake();
    const repo = crearInvestmentSaleRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    const venta = await repo.agregar(ventaParcial());

    expect(typeof venta.id).toBe('string');
    expect(venta.id.length).toBeGreaterThan(0);
    expect(store.pendientes).toHaveLength(1);
    expect(store.pendientes[0].coleccion).toBe('investment-sales');
  });

  it('listar() devuelve lo guardado en el snapshot local', async () => {
    const store = crearStoreFake();
    const repo = crearInvestmentSaleRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    await repo.agregar(ventaParcial());
    const lista = await repo.listar();

    expect(lista).toHaveLength(1);
    expect(lista[0].ingresoCentavosArs).toBe(6000);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- investment-sale-repo`
Expected: FAIL — "Cannot find module '../investment-sale-repo'".

- [ ] **Step 3: Implementar `src/repos/investment-sale-repo.ts`**

```typescript
import { doc, setDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import type { LocalStore } from '../db/local-store';
import type { InvestmentSale } from '../domain/types';

interface DepsInvestmentSaleRepo {
  db: Firestore;
  uid: string;
  localStore: LocalStore;
  estaOnline: () => boolean;
}

export interface InvestmentSaleRepo {
  listar(): Promise<InvestmentSale[]>;
  agregar(venta: Omit<InvestmentSale, 'id'>): Promise<InvestmentSale>;
  suscribir(cb: (ventas: InvestmentSale[]) => void): () => void;
}

const COLECCION = 'investment-sales' as const;

export function crearInvestmentSaleRepo(deps: DepsInvestmentSaleRepo): InvestmentSaleRepo {
  const { db, uid, localStore, estaOnline } = deps;

  async function leerLocal(): Promise<InvestmentSale[]> {
    return (await localStore.leerSnapshot(COLECCION)) as InvestmentSale[];
  }

  async function escribirLocal(ventas: InvestmentSale[]): Promise<void> {
    await localStore.guardarSnapshot(COLECCION, ventas);
  }

  return {
    async listar(): Promise<InvestmentSale[]> {
      return leerLocal();
    },

    async agregar(ventaSinId: Omit<InvestmentSale, 'id'>): Promise<InvestmentSale> {
      const venta: InvestmentSale = { ...ventaSinId, id: Crypto.randomUUID() };

      const actuales = await leerLocal();
      await escribirLocal([...actuales, venta]);

      await localStore.guardarPendiente({
        id: venta.id,
        coleccion: COLECCION,
        operacion: 'set',
        datos: venta as unknown as Record<string, unknown>,
        creadoEn: Date.now(),
      });

      if (estaOnline()) {
        await setDoc(doc(db, 'users', uid, COLECCION, venta.id), venta).catch(() => {});
      }

      return venta;
    },

    suscribir(cb: (ventas: InvestmentSale[]) => void): () => void {
      if (!estaOnline()) return () => {};
      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const ventas = snapshot.docs.map((d) => d.data() as InvestmentSale);
        escribirLocal(ventas).then(() => cb(ventas));
      });
    },
  };
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- investment-sale-repo`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repos/investment-sale-repo.ts src/repos/__tests__/investment-sale-repo.test.ts
git commit -m "agrega repo de ventas de inversiones"
```

---

## Task 4: Repo de cash del broker

**Files:**
- Create: `src/repos/broker-cash-repo.ts`, `src/repos/__tests__/broker-cash-repo.test.ts`

**Interfaces:**
- Consumes: `BrokerCash` de `src/domain/types.ts`, `LocalStore`
- Produces:
  - `interface BrokerCashRepo { obtener(), guardar(centavosArs: number), sumar(centavosArs: number), suscribir(cb) }`
  - `function crearBrokerCashRepo(deps): BrokerCashRepo`

Guarda un único documento de id fijo `'actual'`, igual filosofía que `settings/preferences` pero pasando por el mismo `LocalStore` que el resto (offline-first real, no solo Firestore).

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/repos/__tests__/broker-cash-repo.test.ts`:

```typescript
import { crearBrokerCashRepo } from '../broker-cash-repo';
import type { LocalStore, PendingWrite } from '../../db/local-store';

function crearStoreFake(): LocalStore & { pendientes: PendingWrite[] } {
  const pendientes: PendingWrite[] = [];
  const snapshots: Record<string, unknown[]> = {};
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

describe('crearBrokerCashRepo sin conexión', () => {
  it('obtener() devuelve centavosArs 0 si nunca se guardó nada', async () => {
    const store = crearStoreFake();
    const repo = crearBrokerCashRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    const valor = await repo.obtener();

    expect(valor).toEqual({ id: 'actual', centavosArs: 0 });
  });

  it('guardar() reemplaza el valor y encola la escritura', async () => {
    const store = crearStoreFake();
    const repo = crearBrokerCashRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    await repo.guardar(50000);
    const valor = await repo.obtener();

    expect(valor.centavosArs).toBe(50000);
    expect(store.pendientes).toHaveLength(1);
    expect(store.pendientes[0].coleccion).toBe('broker-cash');
    expect(store.pendientes[0].id).toBe('actual');
  });

  it('sumar() incrementa el valor existente', async () => {
    const store = crearStoreFake();
    const repo = crearBrokerCashRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    await repo.guardar(10000);
    await repo.sumar(2500);
    const valor = await repo.obtener();

    expect(valor.centavosArs).toBe(12500);
  });

  it('sumar() sin valor previo parte de 0', async () => {
    const store = crearStoreFake();
    const repo = crearBrokerCashRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    await repo.sumar(3000);
    const valor = await repo.obtener();

    expect(valor.centavosArs).toBe(3000);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- broker-cash-repo`
Expected: FAIL — "Cannot find module '../broker-cash-repo'".

- [ ] **Step 3: Implementar `src/repos/broker-cash-repo.ts`**

```typescript
import { doc, setDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
import type { LocalStore } from '../db/local-store';
import type { BrokerCash } from '../domain/types';

interface DepsBrokerCashRepo {
  db: Firestore;
  uid: string;
  localStore: LocalStore;
  estaOnline: () => boolean;
}

export interface BrokerCashRepo {
  obtener(): Promise<BrokerCash>;
  guardar(centavosArs: number): Promise<BrokerCash>;
  sumar(centavosArs: number): Promise<BrokerCash>;
  suscribir(cb: (valor: BrokerCash) => void): () => void;
}

const COLECCION = 'broker-cash' as const;
const ID_DOC = 'actual' as const;
const VALOR_INICIAL: BrokerCash = { id: ID_DOC, centavosArs: 0 };

export function crearBrokerCashRepo(deps: DepsBrokerCashRepo): BrokerCashRepo {
  const { db, uid, localStore, estaOnline } = deps;

  async function leerLocal(): Promise<BrokerCash> {
    const lista = (await localStore.leerSnapshot(COLECCION)) as BrokerCash[];
    return lista[0] ?? VALOR_INICIAL;
  }

  async function persistir(valor: BrokerCash): Promise<BrokerCash> {
    await localStore.guardarSnapshot(COLECCION, [valor]);

    await localStore.guardarPendiente({
      id: valor.id,
      coleccion: COLECCION,
      operacion: 'set',
      datos: valor as unknown as Record<string, unknown>,
      creadoEn: Date.now(),
    });

    if (estaOnline()) {
      await setDoc(doc(db, 'users', uid, COLECCION, valor.id), valor).catch(() => {});
    }

    return valor;
  }

  return {
    async obtener(): Promise<BrokerCash> {
      return leerLocal();
    },

    async guardar(centavosArs: number): Promise<BrokerCash> {
      return persistir({ id: ID_DOC, centavosArs });
    },

    async sumar(centavosArs: number): Promise<BrokerCash> {
      const actual = await leerLocal();
      return persistir({ id: ID_DOC, centavosArs: actual.centavosArs + centavosArs });
    },

    suscribir(cb: (valor: BrokerCash) => void): () => void {
      if (!estaOnline()) return () => {};
      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const doc0 = snapshot.docs.find((d) => d.id === ID_DOC);
        const valor: BrokerCash = doc0 ? (doc0.data() as BrokerCash) : VALOR_INICIAL;
        localStore.guardarSnapshot(COLECCION, [valor]).then(() => cb(valor));
      });
    },
  };
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- broker-cash-repo`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repos/broker-cash-repo.ts src/repos/__tests__/broker-cash-repo.test.ts
git commit -m "agrega repo de cash del broker"
```

---

## Task 5: Registrar los repos nuevos y orquestar la venta

**Files:**
- Modify: `src/repos/create-repo.ts`
- Create: `src/repos/vender-inversion.ts`, `src/repos/__tests__/vender-inversion.test.ts`

**Interfaces:**
- Consumes: `InvestmentRepo`, `InvestmentSaleRepo`, `BrokerCashRepo` (Tasks 2-4), `calcularVenta` de `src/domain/investments.ts`
- Produces:
  - `Repos` (extendida con `investments`, `investmentSales`, `brokerCash`)
  - `interface ParametrosVenta { nominalesVendidos, precioVenta, cotizacionUsada, fecha }`
  - `interface ResultadoVentaInversion { inversion: Investment, venta: InvestmentSale }`
  - `function venderInversion(repos: Repos, investmentId: string, params: ParametrosVenta): Promise<ResultadoVentaInversion>`

- [ ] **Step 1: Registrar los 3 repos nuevos en `create-repo.ts`**

Reemplazar todo el contenido de `src/repos/create-repo.ts`:

```typescript
import NetInfo from '@react-native-community/netinfo';
import { getFirestoreDb } from '../firebase/app';
import { localStoreSqlite } from '../db/local';
import { crearExpenseRepo, type ExpenseRepo } from './expense-repo';
import { crearSectorRepo, type SectorRepo } from './sector-repo';
import { crearBudgetRepo, type BudgetRepo } from './budget-repo';
import { crearSavingsRepo, type SavingsRepo } from './savings-repo';
import { crearInvestmentRepo, type InvestmentRepo } from './investment-repo';
import { crearInvestmentSaleRepo, type InvestmentSaleRepo } from './investment-sale-repo';
import { crearBrokerCashRepo, type BrokerCashRepo } from './broker-cash-repo';

export interface Repos {
  expenses: ExpenseRepo;
  sectors: SectorRepo;
  budgets: BudgetRepo;
  savings: SavingsRepo;
  investments: InvestmentRepo;
  investmentSales: InvestmentSaleRepo;
  brokerCash: BrokerCashRepo;
}

let estadoConexion = true;
NetInfo.addEventListener((estado) => {
  estadoConexion = Boolean(estado.isConnected);
});
function estaOnline(): boolean {
  return estadoConexion;
}

export function crearRepos(uid: string): Repos {
  const db = getFirestoreDb();
  const deps = { db, uid, localStore: localStoreSqlite, estaOnline };

  return {
    expenses: crearExpenseRepo(deps),
    sectors: crearSectorRepo(deps),
    budgets: crearBudgetRepo(deps),
    savings: crearSavingsRepo(deps),
    investments: crearInvestmentRepo(deps),
    investmentSales: crearInvestmentSaleRepo(deps),
    brokerCash: crearBrokerCashRepo(deps),
  };
}
```

- [ ] **Step 2: Escribir los tests de `vender-inversion.ts` que fallan**

Crear `src/repos/__tests__/vender-inversion.test.ts`:

```typescript
import { venderInversion } from '../vender-inversion';
import type { Repos } from '../create-repo';
import type { Investment, InvestmentSale, BrokerCash } from '../../domain/types';

function crearInversion(parcial: Partial<Investment> = {}): Investment {
  return {
    id: 'inv1',
    ticker: 'GOOGL',
    nominales: 10,
    ppc: 5.16,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    costoCentavosArsUnitario: 1000,
    rubro: null,
    fecha: '2026-01-01',
    status: 'OPEN',
    ...parcial,
  };
}

function crearReposFake(inversionInicial: Investment) {
  let inversionActual = inversionInicial;
  const ventasCreadas: Omit<InvestmentSale, 'id'>[] = [];
  let brokerCashActual = 0;

  const repos = {
    investments: {
      listar: jest.fn(async () => [inversionActual]),
      actualizar: jest.fn(async (_id: string, cambios: Partial<Investment>) => {
        inversionActual = { ...inversionActual, ...cambios };
        return inversionActual;
      }),
    },
    investmentSales: {
      agregar: jest.fn(async (venta: Omit<InvestmentSale, 'id'>) => {
        ventasCreadas.push(venta);
        return { ...venta, id: 'venta1' };
      }),
    },
    brokerCash: {
      sumar: jest.fn(async (centavos: number) => {
        brokerCashActual += centavos;
        return { id: 'actual', centavosArs: brokerCashActual } as BrokerCash;
      }),
    },
  };

  return { repos: repos as unknown as Repos, ventasCreadas, obtenerBrokerCash: () => brokerCashActual };
}

describe('venderInversion', () => {
  it('venta parcial: reduce nominales, mantiene OPEN, suma el ingreso al cash', async () => {
    const inversion = crearInversion({ nominales: 10, costoCentavosArsUnitario: 1000 });
    const { repos, ventasCreadas, obtenerBrokerCash } = crearReposFake(inversion);

    const resultado = await venderInversion(repos, 'inv1', {
      nominalesVendidos: 4,
      precioVenta: 15,
      cotizacionUsada: null,
      fecha: '2026-06-01',
    });

    expect(resultado.inversion.nominales).toBe(6);
    expect(resultado.inversion.status).toBe('OPEN');
    expect(resultado.venta.ingresoCentavosArs).toBe(6000);
    expect(resultado.venta.gananciaCentavosArs).toBe(2000);
    expect(obtenerBrokerCash()).toBe(6000);
    expect(ventasCreadas).toHaveLength(1);
  });

  it('venta total: cierra la posición (status CLOSED)', async () => {
    const inversion = crearInversion({ nominales: 5, costoCentavosArsUnitario: 1000 });
    const { repos } = crearReposFake(inversion);

    const resultado = await venderInversion(repos, 'inv1', {
      nominalesVendidos: 5,
      precioVenta: 12,
      cotizacionUsada: null,
      fecha: '2026-06-01',
    });

    expect(resultado.inversion.nominales).toBe(0);
    expect(resultado.inversion.status).toBe('CLOSED');
  });

  it('lanza un error si la inversión no existe', async () => {
    const inversion = crearInversion();
    const { repos } = crearReposFake(inversion);

    await expect(
      venderInversion(repos, 'no-existe', {
        nominalesVendidos: 1,
        precioVenta: 10,
        cotizacionUsada: null,
        fecha: '2026-06-01',
      })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npm test -- vender-inversion`
Expected: FAIL — "Cannot find module '../vender-inversion'".

- [ ] **Step 4: Implementar `src/repos/vender-inversion.ts`**

```typescript
import { calcularVenta } from '../domain/investments';
import type { Investment, InvestmentSale } from '../domain/types';
import type { Repos } from './create-repo';

export interface ParametrosVenta {
  nominalesVendidos: number;
  precioVenta: number;
  cotizacionUsada: number | null;
  fecha: string;
}

export interface ResultadoVentaInversion {
  inversion: Investment;
  venta: InvestmentSale;
}

/**
 * Orquesta una venta parcial o total: recalcula la posición, registra el
 * movimiento de venta, y suma el ingreso al cash del broker. Es el único
 * punto de entrada para vender — no llamar a los repos por separado.
 */
export async function venderInversion(
  repos: Repos,
  investmentId: string,
  params: ParametrosVenta
): Promise<ResultadoVentaInversion> {
  const inversiones = await repos.investments.listar();
  const inversion = inversiones.find((i) => i.id === investmentId);
  if (!inversion) {
    throw new Error(`No existe una inversión con id ${investmentId}`);
  }

  const { ingresoCentavosArs, gananciaCentavosArs } = calcularVenta(
    inversion,
    params.nominalesVendidos,
    params.precioVenta,
    params.cotizacionUsada
  );

  const nominalesRestantes = inversion.nominales - params.nominalesVendidos;
  const inversionActualizada = await repos.investments.actualizar(investmentId, {
    nominales: nominalesRestantes,
    status: nominalesRestantes === 0 ? 'CLOSED' : 'OPEN',
  });

  const venta = await repos.investmentSales.agregar({
    investmentId,
    nominalesVendidos: params.nominalesVendidos,
    precioVenta: params.precioVenta,
    cotizacionUsada: params.cotizacionUsada,
    ingresoCentavosArs,
    gananciaCentavosArs,
    fecha: params.fecha,
  });

  await repos.brokerCash.sumar(ingresoCentavosArs);

  return { inversion: inversionActualizada, venta };
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test -- vender-inversion`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/repos/create-repo.ts src/repos/vender-inversion.ts src/repos/__tests__/vender-inversion.test.ts
git commit -m "registra los repos de inversiones y agrega la orquestación de venta"
```

---

## Task 6: Hooks de datos (posiciones, ventas, cash del broker)

**Files:**
- Create: `src/hooks/use-singleton.ts`, `src/hooks/__tests__/use-singleton.test.ts`
- Modify: `src/hooks/use-datos.ts`

**Interfaces:**
- Consumes: `Repos` (vía `useApp()`), `Investment`, `InvestmentSale`, `BrokerCash`
- Produces:
  - `function useSingleton<T>(params: { obtener(): Promise<T>; suscribir(cb: (v: T) => void): () => void; valorInicial: T }): T`
  - `function useInversiones(): Investment[]`
  - `function useVentas(): InvestmentSale[]`
  - `function useBrokerCash(): BrokerCash`

- [ ] **Step 1: Escribir los tests de `use-singleton.ts` que fallan**

Crear `src/hooks/__tests__/use-singleton.test.ts`:

```typescript
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useSingleton } from '../use-singleton';

// Mismo patrón async de renderHook que src/hooks/__tests__/use-collection.test.tsx
// (@testing-library/react-native 14.x).
describe('useSingleton', () => {
  it('carga el valor inicial con obtener()', async () => {
    const obtener = jest.fn().mockResolvedValue({ id: 'actual', centavosArs: 500 });
    const suscribir = jest.fn().mockReturnValue(() => {});

    const { result } = await renderHook(() =>
      useSingleton({ obtener, suscribir, valorInicial: { id: 'actual', centavosArs: 0 } })
    );

    await waitFor(() => expect(result.current).toEqual({ id: 'actual', centavosArs: 500 }));
  });

  it('devuelve el valorInicial mientras obtener() no resolvió', async () => {
    const obtener = jest.fn(() => new Promise<never>(() => {}));
    const suscribir = jest.fn().mockReturnValue(() => {});

    const { result } = await renderHook(() =>
      useSingleton({ obtener, suscribir, valorInicial: { id: 'actual', centavosArs: 0 } })
    );

    expect(result.current).toEqual({ id: 'actual', centavosArs: 0 });
  });

  it('actualiza cuando suscribir() llama al callback', async () => {
    let callbackGuardado: ((v: { id: string; centavosArs: number }) => void) | null = null;
    const obtener = jest.fn().mockResolvedValue({ id: 'actual', centavosArs: 0 });
    const suscribir = jest.fn((cb) => {
      callbackGuardado = cb;
      return () => {};
    });

    const { result } = await renderHook(() =>
      useSingleton({ obtener, suscribir, valorInicial: { id: 'actual', centavosArs: 0 } })
    );
    await waitFor(() => expect(obtener).toHaveBeenCalled());

    await act(async () => {
      callbackGuardado?.({ id: 'actual', centavosArs: 999 });
    });

    await waitFor(() => expect(result.current).toEqual({ id: 'actual', centavosArs: 999 }));
  });

  it('se desuscribe al desmontar', async () => {
    const desuscribir = jest.fn();
    const obtener = jest.fn().mockResolvedValue({ id: 'actual', centavosArs: 0 });
    const suscribir = jest.fn().mockReturnValue(desuscribir);

    const { unmount } = await renderHook(() =>
      useSingleton({ obtener, suscribir, valorInicial: { id: 'actual', centavosArs: 0 } })
    );
    await unmount();

    expect(desuscribir).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- use-singleton`
Expected: FAIL — "Cannot find module '../use-singleton'".

- [ ] **Step 3: Implementar `src/hooks/use-singleton.ts`**

```typescript
import { useEffect, useState } from 'react';

interface ParametrosUseSingleton<T> {
  obtener(): Promise<T>;
  suscribir(cb: (valor: T) => void): () => void;
  valorInicial: T;
}

/** Como useCollection pero para un documento único (ej. el cash del broker) en vez de una lista. */
export function useSingleton<T>({ obtener, suscribir, valorInicial }: ParametrosUseSingleton<T>): T {
  const [valor, setValor] = useState<T>(valorInicial);

  useEffect(() => {
    let vigente = true;
    obtener().then((v) => {
      if (vigente) setValor(v);
    });
    const desuscribir = suscribir((v) => setValor(v));
    return () => {
      vigente = false;
      desuscribir();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return valor;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- use-singleton`
Expected: PASS.

- [ ] **Step 5: Agregar los hooks de inversiones a `src/hooks/use-datos.ts`**

Reemplazar todo el contenido de `src/hooks/use-datos.ts`:

```typescript
import { useApp } from '../app-context';
import { useCollection } from './use-collection';
import { useSingleton } from './use-singleton';
import type { Expense, Sector, Budget, SavingMovement, Investment, InvestmentSale, BrokerCash } from '../domain/types';

export function useGastos(): Expense[] {
  const { repos } = useApp();
  return useCollection<Expense>({ listar: () => repos.expenses.listar(), suscribir: (cb) => repos.expenses.suscribir(cb) });
}

export function useSectores(): Sector[] {
  const { repos } = useApp();
  return useCollection<Sector>({ listar: () => repos.sectors.listar(), suscribir: (cb) => repos.sectors.suscribir(cb) });
}

export function usePresupuestos(): Budget[] {
  const { repos } = useApp();
  return useCollection<Budget>({ listar: () => repos.budgets.listar(), suscribir: (cb) => repos.budgets.suscribir(cb) });
}

export function useAhorros(): SavingMovement[] {
  const { repos } = useApp();
  return useCollection<SavingMovement>({ listar: () => repos.savings.listar(), suscribir: (cb) => repos.savings.suscribir(cb) });
}

export function useInversiones(): Investment[] {
  const { repos } = useApp();
  return useCollection<Investment>({
    listar: () => repos.investments.listar(),
    suscribir: (cb) => repos.investments.suscribir(cb),
  });
}

export function useVentas(): InvestmentSale[] {
  const { repos } = useApp();
  return useCollection<InvestmentSale>({
    listar: () => repos.investmentSales.listar(),
    suscribir: (cb) => repos.investmentSales.suscribir(cb),
  });
}

export function useBrokerCash(): BrokerCash {
  const { repos } = useApp();
  return useSingleton<BrokerCash>({
    obtener: () => repos.brokerCash.obtener(),
    suscribir: (cb) => repos.brokerCash.suscribir(cb),
    valorInicial: { id: 'actual', centavosArs: 0 },
  });
}
```

- [ ] **Step 6: Correr toda la suite y verificar que nada se rompió**

Run: `npm test`
Expected: PASS — todos los tests, incluidos los existentes.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/use-singleton.ts src/hooks/__tests__/use-singleton.test.ts src/hooks/use-datos.ts
git commit -m "agrega hooks de inversiones, ventas y cash del broker"
```

---

## Task 7: Generador de CSV del portfolio

**Files:**
- Create: `src/domain/export-csv.ts`, `src/domain/__tests__/export-csv.test.ts`

**Interfaces:**
- Consumes: `Investment`, `BrokerCash` de `src/domain/types.ts`
- Produces: `function generarCsvPortfolio(inversiones: Investment[], brokerCash: BrokerCash): string`

Replica exactamente la estructura de `Portfolio.txt` del usuario: fila `CASH` (con el mismo monto repetido en la columna 2 y 4, tal como en el archivo original), encabezado, y una fila por inversión (abiertas y cerradas).

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/domain/__tests__/export-csv.test.ts`:

```typescript
import { generarCsvPortfolio } from '../export-csv';
import type { Investment, BrokerCash } from '../types';

function inversion(parcial: Partial<Investment> = {}): Investment {
  return {
    id: 'i1',
    ticker: 'BMA',
    nominales: 10,
    ppc: 9.42,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    costoCentavosArsUnitario: 942,
    rubro: 'Bancos-ARG',
    fecha: '2026-08-11',
    status: 'OPEN',
    ...parcial,
  };
}

describe('generarCsvPortfolio', () => {
  it('genera la fila CASH con el saldo del broker, igual al formato de Portfolio.txt', () => {
    const brokerCash: BrokerCash = { id: 'actual', centavosArs: 11336 };
    const csv = generarCsvPortfolio([], brokerCash);
    const filas = csv.split('\n');

    expect(filas[0]).toBe('CASH,113.36,---,113.36,Disponible,ACTIVE,---');
  });

  it('incluye el encabezado esperado', () => {
    const csv = generarCsvPortfolio([], { id: 'actual', centavosArs: 0 });
    const filas = csv.split('\n');

    expect(filas[1]).toBe('Ticker,Cantidad,PPC,Total,Sector,Status,Entrada');
  });

  it('agrega una fila por cada inversión, con el total calculado', () => {
    const inversiones = [inversion({ ticker: 'BMA', nominales: 10, ppc: 9.42, costoCentavosArsUnitario: 942 })];
    const csv = generarCsvPortfolio(inversiones, { id: 'actual', centavosArs: 0 });
    const filas = csv.split('\n');

    expect(filas[2]).toBe('BMA,10,9.42,94.20,Bancos-ARG,OPEN,2026-08-11');
  });

  it('usa un campo vacío cuando no hay rubro', () => {
    const inversiones = [inversion({ rubro: null })];
    const csv = generarCsvPortfolio(inversiones, { id: 'actual', centavosArs: 0 });
    const filas = csv.split('\n');

    expect(filas[2]).toBe('BMA,10,9.42,94.20,,OPEN,2026-08-11');
  });

  it('incluye posiciones cerradas también', () => {
    const inversiones = [inversion({ status: 'CLOSED', nominales: 0 })];
    const csv = generarCsvPortfolio(inversiones, { id: 'actual', centavosArs: 0 });
    const filas = csv.split('\n');

    expect(filas[2]).toContain(',CLOSED,');
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- export-csv`
Expected: FAIL — "Cannot find module '../export-csv'".

- [ ] **Step 3: Implementar `src/domain/export-csv.ts`**

```typescript
import type { Investment, BrokerCash } from './types';

const ENCABEZADO = 'Ticker,Cantidad,PPC,Total,Sector,Status,Entrada';

function numeroConDosDecimales(valor: number): string {
  return valor.toFixed(2);
}

/**
 * Genera el CSV del portfolio con la misma estructura que Portfolio.txt:
 * una fila CASH con el saldo del broker, el encabezado, y una fila por cada
 * inversión (abierta o cerrada).
 */
export function generarCsvPortfolio(inversiones: Investment[], brokerCash: BrokerCash): string {
  const montoCash = numeroConDosDecimales(brokerCash.centavosArs / 100);
  const filaCash = `CASH,${montoCash},---,${montoCash},Disponible,ACTIVE,---`;

  const filasInversiones = inversiones.map((i) => {
    const total = (i.nominales * i.costoCentavosArsUnitario) / 100;
    return [
      i.ticker,
      i.nominales,
      numeroConDosDecimales(i.ppc),
      numeroConDosDecimales(total),
      i.rubro ?? '',
      i.status,
      i.fecha,
    ].join(',');
  });

  return [filaCash, ENCABEZADO, ...filasInversiones].join('\n');
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- export-csv`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/export-csv.ts src/domain/__tests__/export-csv.test.ts
git commit -m "agrega generador de CSV del portfolio"
```

---

## Task 8: Pantalla "Inversiones" — tab, resumen y alta de posición

**Files:**
- Modify: `app/(tabs)/_layout.tsx`, `app/_layout.tsx`
- Create: `app/(tabs)/inversiones.tsx`, `app/inversion-nueva.tsx`

**Interfaces:**
- Consumes: `useInversiones`, `useBrokerCash` (Task 6), `costoTotalPosicion`, `costoTotalAbierto`, `patrimonioInversiones`, `costoUnitarioCentavosArs` (Task 1), `usePreferences`, `useCotizacionActual`, `MoneyText`, `parseAmountToCentavos`, `formatCentavos`
- Produces: pantallas nuevas navegables desde la tab bar; sin exports de código para otras tasks.

No hay tests automáticos de pantallas en este repo (ver Global Constraints) — la verificación es manual con `expo start --web`.

- [ ] **Step 1: Agregar la tab "Inversiones" en `app/(tabs)/_layout.tsx`**

Agregar, después de la línea del `Tabs.Screen name="ahorro"`:

```typescript
      <Tabs.Screen name="inversiones" options={{ title: 'Inversiones' }} />
```

- [ ] **Step 2: Registrar la pantalla modal `inversion-nueva` en `app/_layout.tsx`**

Agregar, después de la línea `<Stack.Screen name="gasto-nuevo" .../>`:

```typescript
            <Stack.Screen
              name="inversion-nueva"
              options={{ presentation: 'modal', headerShown: true, title: 'Nueva inversión' }}
            />
```

- [ ] **Step 3: Crear `app/inversion-nueva.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../src/app-context';
import { usePreferences } from '../src/preferences/use-preferences';
import { useCotizacionActual } from '../src/hooks/use-cotizacion-actual';
import { costoUnitarioCentavosArs } from '../src/domain/investments';
import type { Currency } from '../src/domain/types';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';

export default function InversionNueva() {
  const router = useRouter();
  const { repos } = useApp();
  const preferencias = usePreferences();
  const cotizacion = useCotizacionActual(preferencias.cotizacionPreferida);

  const [ticker, setTicker] = useState('');
  const [nominalesTexto, setNominalesTexto] = useState('');
  const [ppcTexto, setPpcTexto] = useState('');
  const [moneda, setMoneda] = useState<Currency>('ARS');
  const [rubro, setRubro] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const nominales = Number(nominalesTexto.replace(',', '.'));
    const ppc = Number(ppcTexto.replace(',', '.'));

    if (!ticker.trim()) {
      setError('Ingresá un ticker');
      return;
    }
    if (!Number.isFinite(nominales) || nominales <= 0) {
      setError('Ingresá nominales válidos');
      return;
    }
    if (!Number.isFinite(ppc) || ppc <= 0) {
      setError('Ingresá un PPC válido');
      return;
    }
    if (moneda === 'USD' && !cotizacion) {
      setError('No se pudo obtener la cotización del dólar, probá de nuevo');
      return;
    }

    const cotizacionUsada = moneda === 'USD' ? cotizacion!.venta : null;

    setGuardando(true);
    try {
      await repos.investments.agregar({
        ticker: ticker.trim().toUpperCase(),
        nominales,
        ppc,
        monedaOriginal: moneda,
        cotizacionUsada,
        costoCentavosArsUnitario: costoUnitarioCentavosArs(ppc, moneda, cotizacionUsada),
        rubro: rubro.trim() || null,
        fecha: new Date().toISOString().slice(0, 10),
        status: 'OPEN',
      });
      router.back();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      <Text style={estilos.etiquetaCampo}>Ticker</Text>
      <TextInput value={ticker} onChangeText={setTicker} style={estilos.inputTexto} placeholder="Ej: GOOGL" autoCapitalize="characters" />

      <Text style={estilos.etiquetaCampo}>Nominales</Text>
      <TextInput
        value={nominalesTexto}
        onChangeText={setNominalesTexto}
        style={estilos.inputTexto}
        placeholder="Ej: 10"
        keyboardType="decimal-pad"
      />

      <Text style={estilos.etiquetaCampo}>PPC (precio promedio de compra)</Text>
      <TextInput
        value={ppcTexto}
        onChangeText={setPpcTexto}
        style={estilos.inputTexto}
        placeholder="Ej: 9,42"
        keyboardType="decimal-pad"
      />

      <Text style={estilos.etiquetaCampo}>Moneda</Text>
      <View style={estilos.filaChips}>
        {(['ARS', 'USD'] as Currency[]).map((m) => (
          <Pressable key={m} onPress={() => setMoneda(m)} style={[estilos.chip, moneda === m && estilos.chipActivo]}>
            <Text style={[estilos.textoChip, moneda === m && estilos.textoChipActivo]}>{m}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={estilos.etiquetaCampo}>Rubro (opcional)</Text>
      <TextInput value={rubro} onChangeText={setRubro} style={estilos.inputTexto} placeholder="Ej: Tech" />

      {error && <Text style={estilos.error}>{error}</Text>}

      <Pressable style={estilos.botonGuardar} onPress={guardar} disabled={guardando}>
        <Text style={estilos.textoBotonGuardar}>{guardando ? 'Guardando...' : 'Guardar inversión'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: spacing.lg },
  etiquetaCampo: { color: colors.text2, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
  inputTexto: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: colors.surface },
  filaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  chipActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  textoChip: { color: colors.text2 },
  textoChipActivo: { color: colors.surface },
  error: { color: colors.red, marginTop: spacing.sm },
  botonGuardar: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  textoBotonGuardar: { color: colors.surface, fontWeight: '700', fontSize: 16 },
});
```

- [ ] **Step 4: Crear `app/(tabs)/inversiones.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/app-context';
import { useInversiones, useBrokerCash } from '../../src/hooks/use-datos';
import { usePreferences } from '../../src/preferences/use-preferences';
import { useCotizacionActual } from '../../src/hooks/use-cotizacion-actual';
import { parseAmountToCentavos } from '../../src/domain/money';
import { costoTotalPosicion, costoTotalAbierto, patrimonioInversiones } from '../../src/domain/investments';
import { MoneyText } from '../../src/components/money-text';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import type { Investment } from '../../src/domain/types';

export default function Inversiones() {
  const router = useRouter();
  const { repos } = useApp();
  const inversiones = useInversiones();
  const brokerCash = useBrokerCash();
  const preferencias = usePreferences();
  const cotizacion = useCotizacionActual(preferencias.cotizacionPreferida);

  const [editandoCash, setEditandoCash] = useState(false);
  const [cashTexto, setCashTexto] = useState('');

  const abiertas = inversiones.filter((i) => i.status === 'OPEN').sort((a, b) => b.fecha.localeCompare(a.fecha));
  const costoAbierto = costoTotalAbierto(inversiones);
  const patrimonio = patrimonioInversiones(inversiones, brokerCash.centavosArs);

  async function guardarCash() {
    const centavos = parseAmountToCentavos(cashTexto);
    if (centavos === null) return;
    await repos.brokerCash.guardar(centavos);
    setEditandoCash(false);
  }

  async function eliminarPosicion(id: string) {
    await repos.investments.eliminar(id);
  }

  function renderPosicion({ item }: { item: Investment }) {
    return (
      <View style={estilos.filaPosicion}>
        <View style={estilos.infoPosicion}>
          <Text style={estilos.ticker}>{item.ticker}</Text>
          <Text style={estilos.detalle}>
            {item.nominales} nominales · PPC {item.ppc} {item.monedaOriginal}
            {item.rubro ? ` · ${item.rubro}` : ''}
          </Text>
        </View>
        <View style={estilos.accionesPosicion}>
          <MoneyText
            centavos={costoTotalPosicion(item)}
            moneda={preferencias.monedaVisualizacion}
            cotizacion={cotizacion?.venta}
            style={estilos.costoPosicion}
          />
          <View style={estilos.filaBotones}>
            <Pressable onPress={() => router.push({ pathname: '/inversion-vender', params: { id: item.id } })}>
              <Text style={estilos.linkVender}>Vender</Text>
            </Pressable>
            <Pressable onPress={() => eliminarPosicion(item.id)}>
              <Text style={estilos.linkEliminar}>Eliminar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={estilos.contenedor}>
      <FlatList
        data={abiertas}
        keyExtractor={(i) => i.id}
        renderItem={renderPosicion}
        contentContainerStyle={estilos.lista}
        ListHeaderComponent={
          <View>
            <View style={estilos.filaMoneda}>
              <Pressable onPress={() => preferencias.setMonedaVisualizacion('ARS')}>
                <Text style={[estilos.toggle, preferencias.monedaVisualizacion === 'ARS' && estilos.toggleActivo]}>ARS</Text>
              </Pressable>
              <Pressable onPress={() => preferencias.setMonedaVisualizacion('USD')}>
                <Text style={[estilos.toggle, preferencias.monedaVisualizacion === 'USD' && estilos.toggleActivo]}>USD</Text>
              </Pressable>
            </View>

            <View style={estilos.tarjetaResumen}>
              <Text style={estilos.etiqueta}>Costo invertido</Text>
              <MoneyText
                centavos={costoAbierto}
                moneda={preferencias.monedaVisualizacion}
                cotizacion={cotizacion?.venta}
                style={estilos.montoGrande}
              />

              <Text style={estilos.etiqueta}>Cash en el broker</Text>
              {editandoCash ? (
                <View style={estilos.filaEdicionCash}>
                  <TextInput
                    value={cashTexto}
                    onChangeText={setCashTexto}
                    keyboardType="decimal-pad"
                    style={estilos.inputCash}
                    placeholder="0,00"
                    autoFocus
                  />
                  <Pressable onPress={guardarCash}>
                    <Text style={estilos.linkGuardarCash}>Guardar</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    setCashTexto(String(brokerCash.centavosArs / 100).replace('.', ','));
                    setEditandoCash(true);
                  }}
                >
                  <MoneyText
                    centavos={brokerCash.centavosArs}
                    moneda={preferencias.monedaVisualizacion}
                    cotizacion={cotizacion?.venta}
                    style={estilos.montoCash}
                  />
                </Pressable>
              )}

              <Text style={estilos.etiqueta}>Patrimonio en inversiones</Text>
              <MoneyText
                centavos={patrimonio}
                moneda={preferencias.monedaVisualizacion}
                cotizacion={cotizacion?.venta}
                style={estilos.montoGrande}
              />
            </View>

            <Text style={estilos.seccionTitulo}>Posiciones abiertas</Text>
          </View>
        }
        ListEmptyComponent={<Text style={estilos.vacio}>Todavía no cargaste inversiones.</Text>}
      />

      <Pressable style={estilos.botonFlotante} onPress={() => router.push('/inversion-nueva')}>
        <Text style={estilos.textoBotonFlotante}>+</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.bg },
  lista: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
  filaMoneda: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm },
  toggle: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, color: colors.text3, fontWeight: '600' },
  toggleActivo: { color: colors.primary, textDecorationLine: 'underline' },
  tarjetaResumen: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md },
  etiqueta: { color: colors.text3, marginTop: spacing.sm },
  montoGrande: { fontSize: 24, fontWeight: '700', color: colors.text1 },
  montoCash: { fontSize: 18, fontWeight: '700', color: colors.primaryDark, textDecorationLine: 'underline' },
  filaEdicionCash: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inputCash: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.xs, backgroundColor: colors.bg },
  linkGuardarCash: { color: colors.primary, fontWeight: '700' },
  seccionTitulo: { color: colors.text2, fontWeight: '700', marginBottom: spacing.sm, fontSize: 16 },
  vacio: { color: colors.text3, textAlign: 'center', marginTop: spacing.md },
  filaPosicion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  infoPosicion: { flex: 1 },
  ticker: { color: colors.text1, fontWeight: '700' },
  detalle: { color: colors.text3, fontSize: 12, marginTop: spacing.xs },
  accionesPosicion: { alignItems: 'flex-end' },
  costoPosicion: { fontWeight: '700' },
  filaBotones: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  linkVender: { color: colors.primary, fontWeight: '600' },
  linkEliminar: { color: colors.red, fontWeight: '600' },
  botonFlotante: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  textoBotonFlotante: { color: colors.surface, fontSize: 28, lineHeight: 30 },
});
```

Nota: el link "Vender" navega a `/inversion-vender`, que todavía no existe — se crea en la Task 9. Hasta entonces expo-router muestra un error de ruta no encontrada si se lo toca; no afecta al resto de la pantalla.

- [ ] **Step 5: Verificar manualmente**

Run: `npx expo start --web`

Expected: la tab "Inversiones" aparece en la barra. Al entrar, se ve la tarjeta de resumen en $0 y la lista vacía. Tocar "+" abre el modal, cargar un ticker/nominales/PPC en ARS y guardar vuelve a la lista mostrando la posición con el costo total correcto (nominales × PPC).

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/_layout.tsx app/_layout.tsx app/(tabs)/inversiones.tsx app/inversion-nueva.tsx
git commit -m "agrega la pantalla de Inversiones con alta de posiciones"
```

---

## Task 9: Pantalla "Vender inversión" e historial de ventas

**Files:**
- Modify: `app/_layout.tsx`, `app/(tabs)/inversiones.tsx`
- Create: `app/inversion-vender.tsx`

**Interfaces:**
- Consumes: `venderInversion` (Task 5), `calcularVenta` (Task 1), `useInversiones`, `useVentas` (Task 6)
- Produces: pantalla `inversion-vender` navegable con `?id=<investmentId>`; sección de historial en Inversiones.

- [ ] **Step 1: Registrar la pantalla modal `inversion-vender` en `app/_layout.tsx`**

Agregar, después del `Stack.Screen name="inversion-nueva"` agregado en la Task 8:

```typescript
            <Stack.Screen
              name="inversion-vender"
              options={{ presentation: 'modal', headerShown: true, title: 'Vender inversión' }}
            />
```

- [ ] **Step 2: Crear `app/inversion-vender.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useApp } from '../src/app-context';
import { useInversiones } from '../src/hooks/use-datos';
import { usePreferences } from '../src/preferences/use-preferences';
import { useCotizacionActual } from '../src/hooks/use-cotizacion-actual';
import { calcularVenta } from '../src/domain/investments';
import { venderInversion } from '../src/repos/vender-inversion';
import { formatCentavos } from '../src/domain/money';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';

export default function InversionVender() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repos } = useApp();
  const inversiones = useInversiones();
  const preferencias = usePreferences();
  const cotizacion = useCotizacionActual(preferencias.cotizacionPreferida);

  const inversion = inversiones.find((i) => i.id === id);

  const [nominalesTexto, setNominalesTexto] = useState('');
  const [precioTexto, setPrecioTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  if (!inversion) {
    return (
      <View style={estilos.contenedor}>
        <Text style={estilos.error}>No se encontró la inversión.</Text>
      </View>
    );
  }

  const nominalesVendidos = Number(nominalesTexto.replace(',', '.'));
  const precioVenta = Number(precioTexto.replace(',', '.'));
  const datosValidos =
    Number.isFinite(nominalesVendidos) &&
    nominalesVendidos > 0 &&
    nominalesVendidos <= inversion.nominales &&
    Number.isFinite(precioVenta) &&
    precioVenta > 0 &&
    (inversion.monedaOriginal === 'ARS' || Boolean(cotizacion));

  const previa = datosValidos
    ? calcularVenta(inversion, nominalesVendidos, precioVenta, inversion.monedaOriginal === 'USD' ? cotizacion!.venta : null)
    : null;

  async function confirmarVenta() {
    if (!inversion) return;
    if (!Number.isFinite(nominalesVendidos) || nominalesVendidos <= 0) {
      setError('Ingresá nominales válidos');
      return;
    }
    if (nominalesVendidos > inversion.nominales) {
      setError(`No podés vender más de ${inversion.nominales} nominales`);
      return;
    }
    if (!Number.isFinite(precioVenta) || precioVenta <= 0) {
      setError('Ingresá un precio de venta válido');
      return;
    }
    if (inversion.monedaOriginal === 'USD' && !cotizacion) {
      setError('No se pudo obtener la cotización del dólar, probá de nuevo');
      return;
    }

    setGuardando(true);
    try {
      await venderInversion(repos, inversion.id, {
        nominalesVendidos,
        precioVenta,
        cotizacionUsada: inversion.monedaOriginal === 'USD' ? cotizacion!.venta : null,
        fecha: new Date().toISOString().slice(0, 10),
      });
      router.back();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo}>{inversion.ticker}</Text>
      <Text style={estilos.subtitulo}>Tenés {inversion.nominales} nominales</Text>

      <Text style={estilos.etiquetaCampo}>Nominales a vender</Text>
      <TextInput
        value={nominalesTexto}
        onChangeText={(t) => {
          setNominalesTexto(t);
          setError(null);
        }}
        keyboardType="decimal-pad"
        style={estilos.inputTexto}
        placeholder={`Máximo ${inversion.nominales}`}
      />

      <Text style={estilos.etiquetaCampo}>Precio de venta ({inversion.monedaOriginal})</Text>
      <TextInput
        value={precioTexto}
        onChangeText={(t) => {
          setPrecioTexto(t);
          setError(null);
        }}
        keyboardType="decimal-pad"
        style={estilos.inputTexto}
        placeholder="Ej: 12,50"
      />

      {previa && (
        <View style={estilos.tarjetaPrevia}>
          <Text style={estilos.etiqueta}>Ingreso</Text>
          <Text style={estilos.montoPrevia}>{formatCentavos(previa.ingresoCentavosArs)}</Text>
          <Text style={estilos.etiqueta}>{previa.gananciaCentavosArs >= 0 ? 'Ganancia' : 'Pérdida'}</Text>
          <Text
            style={[
              estilos.montoPrevia,
              { color: previa.gananciaCentavosArs >= 0 ? colors.primaryDark : colors.red },
            ]}
          >
            {formatCentavos(previa.gananciaCentavosArs)}
          </Text>
        </View>
      )}

      {error && <Text style={estilos.error}>{error}</Text>}

      <Pressable style={estilos.botonGuardar} onPress={confirmarVenta} disabled={guardando}>
        <Text style={estilos.textoBotonGuardar}>{guardando ? 'Vendiendo...' : 'Confirmar venta'}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  titulo: { fontSize: 22, fontWeight: '700', color: colors.text1 },
  subtitulo: { color: colors.text3, marginBottom: spacing.md },
  etiquetaCampo: { color: colors.text2, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
  inputTexto: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: colors.surface },
  tarjetaPrevia: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginTop: spacing.md },
  etiqueta: { color: colors.text3, marginTop: spacing.xs },
  montoPrevia: { fontSize: 18, fontWeight: '700', color: colors.text1 },
  error: { color: colors.red, marginTop: spacing.sm },
  botonGuardar: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  textoBotonGuardar: { color: colors.surface, fontWeight: '700', fontSize: 16 },
});
```

- [ ] **Step 3: Agregar el historial de ventas a `app/(tabs)/inversiones.tsx`**

En `app/(tabs)/inversiones.tsx` (Task 8), agregar el import de `useVentas` junto a los demás:

```typescript
import { useInversiones, useBrokerCash, useVentas } from '../../src/hooks/use-datos';
```

y un import de tipo:

```typescript
import type { Investment, InvestmentSale } from '../../src/domain/types';
```

Dentro del componente, después de `const brokerCash = useBrokerCash();`, agregar:

```typescript
  const ventas = useVentas();
  const ventasOrdenadas = [...ventas].sort((a, b) => b.fecha.localeCompare(a.fecha));

  function tickerDeVenta(venta: InvestmentSale): string {
    return inversiones.find((i) => i.id === venta.investmentId)?.ticker ?? '—';
  }
```

Y agregar `ListFooterComponent` al `FlatList` (junto a `ListHeaderComponent`/`ListEmptyComponent`):

```typescript
        ListFooterComponent={
          ventasOrdenadas.length > 0 ? (
            <View style={estilos.historial}>
              <Text style={estilos.seccionTitulo}>Historial de ventas</Text>
              {ventasOrdenadas.map((v) => (
                <View key={v.id} style={estilos.filaVenta}>
                  <View>
                    <Text style={estilos.tickerVenta}>{tickerDeVenta(v)}</Text>
                    <Text style={estilos.detalle}>
                      {v.nominalesVendidos} nominales · {v.fecha}
                    </Text>
                  </View>
                  <Text style={[estilos.gananciaVenta, { color: v.gananciaCentavosArs >= 0 ? colors.primaryDark : colors.red }]}>
                    {v.gananciaCentavosArs >= 0 ? '+' : ''}
                    {formatCentavos(v.gananciaCentavosArs)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null
        }
```

Agregar el import de `formatCentavos` (junto a `parseAmountToCentavos`):

```typescript
import { parseAmountToCentavos, formatCentavos } from '../../src/domain/money';
```

Y agregar los estilos nuevos al `StyleSheet.create` existente:

```typescript
  historial: { marginTop: spacing.lg },
  filaVenta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  tickerVenta: { color: colors.text1, fontWeight: '700' },
  gananciaVenta: { fontWeight: '700' },
```

- [ ] **Step 4: Verificar manualmente**

Run: `npx expo start --web`

Expected: tocar "Vender" en una posición abre el modal, muestra ganancia/pérdida en vivo mientras se tipea, y al confirmar vuelve a la lista de Inversiones con los nominales reducidos (o la posición desaparece de "abiertas" si se vendió todo), el cash del broker sube en el monto del ingreso, y la venta aparece en "Historial de ventas".

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx app/inversion-vender.tsx app/(tabs)/inversiones.tsx
git commit -m "agrega la pantalla de vender inversión y el historial de ventas"
```

---

## Task 10: Exportar / compartir el CSV desde la UI

**Files:**
- Modify: `package.json`, `app/(tabs)/inversiones.tsx`
- Create: `src/services/compartir-csv.ts`

**Interfaces:**
- Consumes: `generarCsvPortfolio` (Task 7)
- Produces: `function compartirCsv(csv: string): Promise<void>`

`compartir-csv.ts` es glue de plataforma (como `src/db/local.native.ts`/`local.web.ts`, que tampoco tienen test dedicado en este repo) — sin test automático, se verifica manualmente en el Step 4.

- [ ] **Step 1: Instalar las dependencias**

```bash
npx expo install expo-sharing expo-file-system
```

- [ ] **Step 2: Implementar `src/services/compartir-csv.ts`**

API verificada contra `https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/` y
`https://docs.expo.dev/versions/v57.0.0/sdk/sharing/`.

```typescript
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const NOMBRE_ARCHIVO = 'portfolio.csv';

/**
 * En web/escritorio dispara la descarga del navegador. En celular escribe el
 * archivo en cache y abre el share sheet nativo (WhatsApp, Drive, Mail, etc.).
 */
export async function compartirCsv(csv: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = NOMBRE_ARCHIVO;
    enlace.click();
    URL.revokeObjectURL(url);
    return;
  }

  const archivo = new File(Paths.cache, NOMBRE_ARCHIVO);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(csv);

  const disponible = await Sharing.isAvailableAsync();
  if (disponible) {
    await Sharing.shareAsync(archivo.uri, { mimeType: 'text/csv', dialogTitle: 'Compartir portfolio' });
  }
}
```

- [ ] **Step 3: Agregar el botón "Exportar" en `app/(tabs)/inversiones.tsx`**

Agregar los imports:

```typescript
import { generarCsvPortfolio } from '../../src/domain/export-csv';
import { compartirCsv } from '../../src/services/compartir-csv';
```

Dentro del componente, agregar la función:

```typescript
  async function exportar() {
    const csv = generarCsvPortfolio(inversiones, brokerCash);
    await compartirCsv(csv);
  }
```

Y agregar el botón dentro de `estilos.filaMoneda` (antes del toggle ARS/USD), cambiando esa vista de:

```typescript
            <View style={estilos.filaMoneda}>
              <Pressable onPress={() => preferencias.setMonedaVisualizacion('ARS')}>
```

a:

```typescript
            <View style={estilos.filaMoneda}>
              <Pressable onPress={exportar} style={estilos.botonExportar}>
                <Text style={estilos.textoExportar}>Exportar</Text>
              </Pressable>
              <Pressable onPress={() => preferencias.setMonedaVisualizacion('ARS')}>
```

Y agregar los estilos nuevos al `StyleSheet.create`:

```typescript
  botonExportar: { marginRight: 'auto', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  textoExportar: { color: colors.blue, fontWeight: '600' },
```

- [ ] **Step 4: Verificar manualmente**

Run: `npx expo start --web`

Expected: con al menos una inversión cargada, tocar "Exportar" descarga `portfolio.csv` en el navegador; abrirlo confirma la fila CASH, el encabezado y las filas de inversiones con el mismo formato que `Portfolio.txt`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/services/compartir-csv.ts app/(tabs)/inversiones.tsx
git commit -m "agrega exportar/compartir el portfolio como CSV"
```

---

## Task 11: Integración con Ahorro — Patrimonio total

**Files:**
- Modify: `app/(tabs)/ahorro.tsx`

**Interfaces:**
- Consumes: `useInversiones`, `useBrokerCash` (Task 6), `patrimonioInversiones` (Task 1)
- Produces: nada nuevo — solo agrega una línea visual a una pantalla existente.

- [ ] **Step 1: Agregar los imports en `app/(tabs)/ahorro.tsx`**

Cambiar:

```typescript
import { useAhorros } from '../../src/hooks/use-datos';
```

a:

```typescript
import { useAhorros, useInversiones, useBrokerCash } from '../../src/hooks/use-datos';
import { patrimonioInversiones } from '../../src/domain/investments';
```

- [ ] **Step 2: Calcular y mostrar el patrimonio total**

Dentro del componente `Ahorro`, después de `const totalAhorrado = ...`, agregar:

```typescript
  const inversiones = useInversiones();
  const brokerCash = useBrokerCash();
  const patrimonioTotal = totalAhorrado + patrimonioInversiones(inversiones, brokerCash.centavosArs);
```

Y en el JSX, dentro de `estilos.tarjetaTotal`, agregar después de la línea de "Disponible para mandar a ahorro":

```tsx
        <Text style={estilos.etiqueta}>Patrimonio total (ahorro + inversiones)</Text>
        <Text style={estilos.montoGrande}>{formatCentavos(patrimonioTotal)}</Text>
```

- [ ] **Step 3: Verificar manualmente**

Run: `npx expo start --web`

Expected: en la tab Ahorro, debajo del total ahorrado aparece "Patrimonio total" = ahorro + costo de inversiones abiertas + cash del broker. Cargar una inversión nueva en la tab Inversiones y volver a Ahorro debe reflejar el cambio sin recargar la app (los hooks se re-suscriben solos).

- [ ] **Step 4: Correr toda la suite una última vez**

Run: `npm test`
Expected: PASS — todos los tests del proyecto, incluidos los de inversiones.

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/ahorro.tsx
git commit -m "integra el patrimonio de inversiones en la pantalla de Ahorro"
```
