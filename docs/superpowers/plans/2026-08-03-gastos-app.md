# Gastos App — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una app personal de control de gastos para celular (Android/iOS) y PC (Windows/Mac), con presupuesto mensual, sectores, acumulación de sobrantes, ahorro, cotización del dólar y gráfico de torta.

**Architecture:** Un solo código TypeScript/React con Expo (`react-native` + `react-native-web`), empaquetado a celular vía Expo y a escritorio envolviendo el build web estático con Tauri. Firebase (Firestore + Auth) como backend. La lógica de dominio (aritmética de dinero, cálculo de acumulado) es pura y se testea aislada; encima va una capa de repositorios que abstrae la diferencia de persistencia offline entre celular (SQLite propia) y escritorio (`persistentLocalCache` de Firestore).

**Tech Stack:** TypeScript, Expo SDK 54+, expo-router, React Native Web, Firebase JS SDK v11, expo-sqlite, react-native-svg, Tauri v2, Jest + @testing-library/react-native.

## Global Constraints

- **Moneda canónica: ARS en centavos enteros.** Todo monto se guarda y se calcula como `number` entero de centavos de peso argentino. Nunca usar floats para dinero. El USD es solo una capa de visualización.
- **Comentarios en español.** Nombres de variables y funciones en `camelCase` (convención de TypeScript), nombres de archivos en `kebab-case`, componentes React en `PascalCase`.
- **Commits en español, descriptivos**, en imperativo: `agrega cálculo de acumulado mensual`.
- **Nunca commitear `.env`** ni credenciales de Firebase. Usar `.env.example` como plantilla.
- **Colores**: usar exclusivamente los tokens definidos en `src/theme/colors.ts` (Task 9). No inventar colores sueltos en componentes.
- **Mobile-first**: cada pantalla se diseña primero para celular; el layout de escritorio es una adaptación (Task 18).
- **TDD**: toda lógica no visual se escribe con test que falla primero.
- **Un solo usuario.** No hace falta resolución de conflictos en la sincronización: last-write-wins es correcto.

---

## Estructura de archivos

```
GastosApp/
├── app/                              # rutas (expo-router)
│   ├── _layout.tsx                   # layout raíz: providers + candado de PIN
│   ├── pin.tsx                       # pantalla de desbloqueo
│   ├── (tabs)/
│   │   ├── _layout.tsx               # navegación por tabs
│   │   ├── index.tsx                 # Home
│   │   ├── historial.tsx
│   │   ├── ahorro.tsx
│   │   └── sectores.tsx
│   ├── gasto-nuevo.tsx               # modal: cargar gasto
│   └── config.tsx
├── src/
│   ├── theme/colors.ts               # tokens de color y espaciado
│   ├── domain/
│   │   ├── types.ts                  # Expense, Sector, Budget, SavingMovement
│   │   ├── money.ts                  # centavos, formateo, conversión USD
│   │   └── budget.ts                 # cálculo de acumulado mensual (puro)
│   ├── rates/dolar.ts                # cliente dolarapi + cache
│   ├── db/
│   │   ├── local.ts                  # interfaz LocalStore
│   │   ├── local.native.ts           # implementación SQLite (celular)
│   │   ├── local.web.ts              # implementación no-op (escritorio)
│   │   └── sync.ts                   # cola de sincronización
│   ├── firebase/app.ts               # init de Firebase por plataforma
│   ├── repos/                        # expenses, sectors, budgets, savings
│   ├── auth/pin.ts                   # hash y verificación del PIN
│   └── components/                   # MoneyText, PieChart, SectorProgress...
├── firestore.rules
├── src-tauri/                        # shell de escritorio (Task 19)
└── app.json
```

---

## Task 1: Scaffold del proyecto y repositorio

**Files:**
- Create: `package.json`, `tsconfig.json`, `app.json`, `.gitignore`, `.env.example`, `jest.config.js`, `app/_layout.tsx`, `app/(tabs)/index.tsx`, `src/domain/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nada (primera tarea)
- Produces: proyecto Expo que arranca en celular y web, y `npm test` funcionando con Jest + TypeScript.

- [ ] **Step 1: Crear el proyecto Expo con TypeScript**

Ejecutar desde `C:\Users\Fran\Documents`:

```bash
npx create-expo-app@latest GastosApp --template default
```

Si la carpeta `GastosApp` ya existe con el repo git y la carpeta `docs`, crear el proyecto en una carpeta temporal y mover el contenido adentro conservando `.git` y `docs/`.

- [ ] **Step 2: Instalar las dependencias del proyecto**

```bash
npx expo install firebase expo-sqlite expo-crypto react-native-svg @react-native-async-storage/async-storage expo-router react-native-safe-area-context react-native-screens
```

```bash
npm install --save-dev jest jest-expo @types/jest @testing-library/react-native
```

- [ ] **Step 3: Configurar Jest**

Crear `jest.config.js`:

```javascript
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
```

Crear `jest.setup.js`:

```javascript
// Silencia el warning de act() de React Native en los tests
global.__DEV__ = true;
```

Agregar a `package.json` en `scripts`:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 4: Configurar `app.json` para export web estático**

En `app.json`, dentro de `expo`, asegurar estas claves:

```json
{
  "expo": {
    "name": "Gastos",
    "slug": "gastos-app",
    "scheme": "gastos",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "plugins": ["expo-router", "expo-sqlite"],
    "web": {
      "output": "static",
      "bundler": "metro"
    },
    "android": {
      "package": "com.fran.gastos"
    },
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 5: Crear `.gitignore` y `.env.example`**

`.gitignore`:

```
node_modules/
.expo/
dist/
web-build/
.env
.env.local
*.log
src-tauri/target/
.DS_Store
```

`.env.example`:

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

- [ ] **Step 6: Escribir un test de humo**

Crear `src/domain/__tests__/smoke.test.ts`:

```typescript
describe('configuración de tests', () => {
  it('corre TypeScript correctamente', () => {
    const suma = (a: number, b: number): number => a + b;
    expect(suma(2, 2)).toBe(4);
  });
});
```

- [ ] **Step 7: Correr el test y verificar que pasa**

Run: `npm test`
Expected: PASS — 1 test pasado.

- [ ] **Step 8: Verificar que la app arranca**

Run: `npx expo start --web`
Expected: abre el navegador y muestra la pantalla inicial del template sin errores en consola.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "agrega scaffold de Expo con TypeScript y Jest"
```

- [ ] **Step 10: Crear el repositorio privado en GitHub**

Este paso lo ejecuta la persona usuaria (requiere su cuenta). Crear en github.com un repositorio **privado** llamado `gastos-app`, sin README ni .gitignore inicial. Después:

```bash
git remote add origin https://github.com/<usuario>/gastos-app.git
git branch -M main
git push -u origin main
```

Expected: el código queda en GitHub y `git status` muestra la rama sincronizada.

---

## Task 2: Tipos del dominio y aritmética de dinero

**Files:**
- Create: `src/domain/types.ts`, `src/domain/money.ts`, `src/domain/__tests__/money.test.ts`
- Delete: `src/domain/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type Currency = 'ARS' | 'USD'`
  - `type RateKind = 'oficial' | 'blue'`
  - `interface Expense`, `interface Sector`, `interface Budget`, `interface SavingMovement` (ver código abajo)
  - `parseAmountToCentavos(texto: string): number | null`
  - `formatCentavos(centavos: number): string`
  - `usdToCentavosArs(montoUsd: number, cotizacion: number): number`
  - `centavosArsToUsd(centavos: number, cotizacion: number): number`
  - `formatUsd(monto: number): string`

- [ ] **Step 1: Escribir los tipos del dominio**

Crear `src/domain/types.ts`:

```typescript
export type Currency = 'ARS' | 'USD';
export type RateKind = 'oficial' | 'blue';
export type PaymentMethod = 'efectivo' | 'debito' | 'credito' | 'transferencia';

/** Clave de mes en formato 'YYYY-MM'. */
export type MonthKey = string;

export interface Sector {
  id: string;
  nombre: string;
  color: string;
  /** Límite mensual en centavos de ARS. null = sector sin tope. */
  limiteMensual: number | null;
}

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

export interface Budget {
  /** 'YYYY-MM' */
  mes: MonthKey;
  /** Presupuesto del mes en centavos de ARS. */
  totalCentavos: number;
}

export interface SavingMovement {
  id: string;
  /** Positivo = se manda a ahorro. Negativo = se retira del ahorro. */
  centavosArs: number;
  /** Fecha ISO 'YYYY-MM-DD'. */
  fecha: string;
  nota: string | null;
}
```

- [ ] **Step 2: Escribir los tests de aritmética de dinero que fallan**

Crear `src/domain/__tests__/money.test.ts`:

```typescript
import {
  parseAmountToCentavos,
  formatCentavos,
  usdToCentavosArs,
  centavosArsToUsd,
  formatUsd,
} from '../money';

describe('parseAmountToCentavos', () => {
  it('convierte un entero a centavos', () => {
    expect(parseAmountToCentavos('1500')).toBe(150000);
  });

  it('acepta coma como separador decimal', () => {
    expect(parseAmountToCentavos('1500,50')).toBe(150050);
  });

  it('acepta punto como separador decimal', () => {
    expect(parseAmountToCentavos('1500.50')).toBe(150050);
  });

  it('ignora separadores de miles', () => {
    expect(parseAmountToCentavos('1.500,50')).toBe(150050);
  });

  it('redondea a dos decimales', () => {
    expect(parseAmountToCentavos('10,999')).toBe(1100);
  });

  it('devuelve null si el texto no es un número', () => {
    expect(parseAmountToCentavos('abc')).toBeNull();
  });

  it('devuelve null con texto vacío', () => {
    expect(parseAmountToCentavos('')).toBeNull();
  });

  it('devuelve null con montos negativos', () => {
    expect(parseAmountToCentavos('-100')).toBeNull();
  });
});

describe('formatCentavos', () => {
  it('formatea con separador de miles y dos decimales', () => {
    expect(formatCentavos(150050)).toBe('$ 1.500,50');
  });

  it('formatea el cero', () => {
    expect(formatCentavos(0)).toBe('$ 0,00');
  });

  it('formatea montos negativos', () => {
    expect(formatCentavos(-150050)).toBe('-$ 1.500,50');
  });
});

describe('conversión USD', () => {
  it('convierte dólares a centavos de peso', () => {
    // 10 USD a una cotización de 1500 = 15000 ARS = 1500000 centavos
    expect(usdToCentavosArs(10, 1500)).toBe(1500000);
  });

  it('redondea al centavo más cercano al convertir a pesos', () => {
    expect(usdToCentavosArs(0.015, 1000)).toBe(1500);
  });

  it('convierte centavos de peso a dólares', () => {
    expect(centavosArsToUsd(1500000, 1500)).toBe(10);
  });

  it('devuelve 0 dólares si la cotización es 0, para evitar división por cero', () => {
    expect(centavosArsToUsd(1500000, 0)).toBe(0);
  });
});

describe('formatUsd', () => {
  it('formatea con dos decimales', () => {
    expect(formatUsd(10)).toBe('US$ 10,00');
  });
});
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npm test -- money`
Expected: FAIL — "Cannot find module '../money'".

- [ ] **Step 4: Implementar la aritmética de dinero**

Crear `src/domain/money.ts`:

```typescript
/**
 * Toda la app trabaja en centavos enteros de ARS para evitar errores de
 * redondeo de punto flotante. El USD es solo una capa de visualización.
 */

/**
 * Convierte texto tipeado por la persona a centavos enteros.
 * Acepta '1.500,50' y '1500.50'. Devuelve null si no es un monto válido y positivo.
 */
export function parseAmountToCentavos(texto: string): number | null {
  const limpio = texto.trim();
  if (limpio === '') return null;

  // Si tiene coma, se asume formato argentino: el punto es separador de miles.
  const normalizado = limpio.includes(',')
    ? limpio.replace(/\./g, '').replace(',', '.')
    : limpio;

  const valor = Number(normalizado);
  if (!Number.isFinite(valor) || valor < 0) return null;

  return Math.round(valor * 100);
}

/** Formatea centavos de ARS como '$ 1.500,50'. */
export function formatCentavos(centavos: number): string {
  const negativo = centavos < 0;
  const absoluto = Math.abs(centavos);
  const enteros = Math.floor(absoluto / 100);
  const decimales = absoluto % 100;

  const enterosConSeparador = enteros
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const texto = `$ ${enterosConSeparador},${decimales.toString().padStart(2, '0')}`;
  return negativo ? `-${texto}` : texto;
}

/** Convierte un monto en USD a centavos de ARS usando la cotización dada. */
export function usdToCentavosArs(montoUsd: number, cotizacion: number): number {
  return Math.round(montoUsd * cotizacion * 100);
}

/** Convierte centavos de ARS a un monto en USD usando la cotización dada. */
export function centavosArsToUsd(centavos: number, cotizacion: number): number {
  if (cotizacion === 0) return 0;
  return centavos / 100 / cotizacion;
}

/** Formatea un monto en dólares como 'US$ 10,00'. */
export function formatUsd(monto: number): string {
  const negativo = monto < 0;
  const absoluto = Math.abs(monto);
  const enteros = Math.floor(absoluto);
  const decimales = Math.round((absoluto - enteros) * 100);

  const enterosConSeparador = enteros
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const texto = `US$ ${enterosConSeparador},${decimales.toString().padStart(2, '0')}`;
  return negativo ? `-${texto}` : texto;
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test -- money`
Expected: PASS — todos los tests de money pasan.

- [ ] **Step 6: Borrar el test de humo**

```bash
rm src/domain/__tests__/smoke.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/domain
git commit -m "agrega tipos del dominio y aritmética de dinero en centavos"
```

---

## Task 3: Cálculo puro del acumulado mensual

**Files:**
- Create: `src/domain/budget.ts`, `src/domain/__tests__/budget.test.ts`

**Interfaces:**
- Consumes: `Expense`, `Sector`, `Budget`, `SavingMovement`, `MonthKey` de `src/domain/types.ts`
- Produces:
  - `function gastadoEnMes(gastos: Expense[], mes: MonthKey): number` — suma en centavos
  - `function gastadoPorSector(gastos: Expense[], mes: MonthKey): Map<string, number>`
  - `function ahorradoHasta(movimientos: SavingMovement[], mes: MonthKey): number`
  - `interface ResumenMes { presupuestoDelMes: number; acumuladoPrevio: number; gastado: number; disponible: number }`
  - `function calcularResumenMes(params: { mes: MonthKey; presupuestos: Budget[]; gastos: Expense[]; ahorros: SavingMovement[] }): ResumenMes`
  - `function mesAnterior(mes: MonthKey): MonthKey`
  - `function siguienteMes(mes: MonthKey): MonthKey`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/domain/__tests__/budget.test.ts`:

```typescript
import {
  gastadoEnMes,
  gastadoPorSector,
  ahorradoHasta,
  calcularResumenMes,
  mesAnterior,
  siguienteMes,
} from '../budget';
import type { Expense, Budget, SavingMovement } from '../types';

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

describe('mesAnterior / siguienteMes', () => {
  it('retrocede un mes dentro del mismo año', () => {
    expect(mesAnterior('2026-06')).toBe('2026-05');
  });

  it('retrocede de enero a diciembre del año anterior', () => {
    expect(mesAnterior('2026-01')).toBe('2025-12');
  });

  it('avanza un mes dentro del mismo año', () => {
    expect(siguienteMes('2026-06')).toBe('2026-07');
  });

  it('avanza de diciembre a enero del año siguiente', () => {
    expect(siguienteMes('2026-12')).toBe('2027-01');
  });
});

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

describe('gastadoPorSector', () => {
  it('agrupa los montos por sector, ignorando otros meses', () => {
    const gastos = [
      gasto({ id: 'a', centavosArs: 1000, sectorId: 'ocio', fecha: '2026-06-05' }),
      gasto({ id: 'b', centavosArs: 500, sectorId: 'ocio', fecha: '2026-06-06' }),
      gasto({ id: 'c', centavosArs: 2000, sectorId: 'vacaciones', fecha: '2026-06-07' }),
      gasto({ id: 'd', centavosArs: 9999, sectorId: 'ocio', fecha: '2026-05-01' }),
    ];
    const resultado = gastadoPorSector(gastos, '2026-06');
    expect(resultado.get('ocio')).toBe(1500);
    expect(resultado.get('vacaciones')).toBe(2000);
    expect(resultado.has('sin-datos')).toBe(false);
  });

  it('agrupa los gastos sin sector bajo la clave null', () => {
    const gastos = [gasto({ centavosArs: 700, sectorId: null, fecha: '2026-06-01' })];
    const resultado = gastadoPorSector(gastos, '2026-06');
    expect(resultado.get('sin-sector')).toBe(700);
  });
});

describe('ahorradoHasta', () => {
  it('suma los movimientos de ahorro hasta el mes inclusive', () => {
    const movimientos: SavingMovement[] = [
      { id: 'm1', centavosArs: 5000, fecha: '2026-04-15', nota: null },
      { id: 'm2', centavosArs: 3000, fecha: '2026-06-01', nota: null },
      { id: 'm3', centavosArs: 1000, fecha: '2026-07-01', nota: null },
    ];
    expect(ahorradoHasta(movimientos, '2026-06')).toBe(8000);
  });

  it('resta los retiros de ahorro (montos negativos)', () => {
    const movimientos: SavingMovement[] = [
      { id: 'm1', centavosArs: 5000, fecha: '2026-04-15', nota: null },
      { id: 'm2', centavosArs: -2000, fecha: '2026-05-01', nota: null },
    ];
    expect(ahorradoHasta(movimientos, '2026-06')).toBe(3000);
  });
});

describe('calcularResumenMes', () => {
  it('el disponible es presupuesto del mes menos gastado, sin acumulado previo', () => {
    const presupuestos: Budget[] = [{ mes: '2026-06', totalCentavos: 100000 }];
    const gastos: Expense[] = [gasto({ centavosArs: 30000, fecha: '2026-06-10' })];

    const resumen = calcularResumenMes({
      mes: '2026-06',
      presupuestos,
      gastos,
      ahorros: [],
    });

    expect(resumen.presupuestoDelMes).toBe(100000);
    expect(resumen.acumuladoPrevio).toBe(0);
    expect(resumen.gastado).toBe(30000);
    expect(resumen.disponible).toBe(70000);
  });

  it('arrastra el sobrante de meses anteriores no mandado a ahorro', () => {
    const presupuestos: Budget[] = [
      { mes: '2026-05', totalCentavos: 50000 },
      { mes: '2026-06', totalCentavos: 100000 },
    ];
    // en mayo se gastaron 20000 de 50000: sobran 30000 que arrastran a junio
    const gastos: Expense[] = [
      gasto({ id: 'may', centavosArs: 20000, fecha: '2026-05-10' }),
      gasto({ id: 'jun', centavosArs: 10000, fecha: '2026-06-05' }),
    ];

    const resumen = calcularResumenMes({
      mes: '2026-06',
      presupuestos,
      gastos,
      ahorros: [],
    });

    expect(resumen.acumuladoPrevio).toBe(30000);
    expect(resumen.disponible).toBe(100000 + 30000 - 10000);
  });

  it('no arrastra lo que ya se mandó a ahorro', () => {
    const presupuestos: Budget[] = [
      { mes: '2026-05', totalCentavos: 50000 },
      { mes: '2026-06', totalCentavos: 100000 },
    ];
    const gastos: Expense[] = [gasto({ id: 'may', centavosArs: 20000, fecha: '2026-05-10' })];
    // el sobrante de mayo (30000) se manda entero a ahorro
    const ahorros: SavingMovement[] = [{ id: 's1', centavosArs: 30000, fecha: '2026-05-28', nota: null }];

    const resumen = calcularResumenMes({
      mes: '2026-06',
      presupuestos,
      gastos,
      ahorros,
    });

    expect(resumen.acumuladoPrevio).toBe(0);
    expect(resumen.disponible).toBe(100000);
  });

  it('un mes sin presupuesto definido cuenta como presupuesto 0', () => {
    const resumen = calcularResumenMes({
      mes: '2026-06',
      presupuestos: [],
      gastos: [],
      ahorros: [],
    });

    expect(resumen.presupuestoDelMes).toBe(0);
    expect(resumen.disponible).toBe(0);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- budget`
Expected: FAIL — "Cannot find module '../budget'".

- [ ] **Step 3: Implementar el cálculo**

Crear `src/domain/budget.ts`:

```typescript
import type { Budget, Expense, MonthKey, SavingMovement } from './types';

/** Clave usada en el Map de gastadoPorSector para gastos sin sector asignado. */
export const SIN_SECTOR = 'sin-sector';

export function mesAnterior(mes: MonthKey): MonthKey {
  const [anio, mesNum] = mes.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mesNum - 1 - 1, 1));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function siguienteMes(mes: MonthKey): MonthKey {
  const [anio, mesNum] = mes.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mesNum - 1 + 1, 1));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

function mesDeFecha(fechaIso: string): MonthKey {
  return fechaIso.slice(0, 7);
}

export function gastadoEnMes(gastos: Expense[], mes: MonthKey): number {
  return gastos
    .filter((g) => mesDeFecha(g.fecha) === mes)
    .reduce((acc, g) => acc + g.centavosArs, 0);
}

export function gastadoPorSector(gastos: Expense[], mes: MonthKey): Map<string, number> {
  const resultado = new Map<string, number>();
  for (const g of gastos) {
    if (mesDeFecha(g.fecha) !== mes) continue;
    const clave = g.sectorId ?? SIN_SECTOR;
    resultado.set(clave, (resultado.get(clave) ?? 0) + g.centavosArs);
  }
  return resultado;
}

export function ahorradoHasta(movimientos: SavingMovement[], mes: MonthKey): number {
  return movimientos
    .filter((m) => mesDeFecha(m.fecha) <= mes)
    .reduce((acc, m) => acc + m.centavosArs, 0);
}

export interface ResumenMes {
  presupuestoDelMes: number;
  acumuladoPrevio: number;
  gastado: number;
  disponible: number;
}

interface ParametrosResumenMes {
  mes: MonthKey;
  presupuestos: Budget[];
  gastos: Expense[];
  ahorros: SavingMovement[];
}

/**
 * Calcula, de forma dinámica y sin persistir estado de "cierre de mes":
 *   acumuladoPrevio(mes) = disponible(mesAnterior) - ahorradoEnEseMes
 *   disponible(mes) = presupuestoDelMes + acumuladoPrevio - gastado
 *
 * Recorre hacia atrás desde `mes` hasta el primer mes que tiene presupuesto
 * cargado, para no arrastrar sobrantes de un pasado sin datos.
 */
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
    const ahorradoHastaPrevio = ahorradoHasta(ahorros, mesPrevio);
    const ahorradoHastaAntesDePrevio = ahorradoHasta(ahorros, mesAnterior(mesPrevio));
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

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- budget`
Expected: PASS — todos los tests de budget pasan.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "agrega cálculo puro de resumen y acumulado mensual"
```

---

## Task 4: Cliente de cotización del dólar con cache

**Files:**
- Create: `src/rates/dolar.ts`, `src/rates/__tests__/dolar.test.ts`

**Interfaces:**
- Consumes: nada nuevo (usa `fetch` global)
- Produces:
  - `interface Cotizacion { casa: RateKind; compra: number; venta: number; fechaActualizacion: string }`
  - `function obtenerCotizacion(casa: RateKind): Promise<Cotizacion>` — pega a la API, con timeout
  - `interface RateCache { guardar(c: Cotizacion): Promise<void>; leer(casa: RateKind): Promise<Cotizacion | null> }`
  - `function obtenerCotizacionConCache(casa: RateKind, cache: RateCache): Promise<Cotizacion>` — intenta red, si falla usa la última cacheada

La API real (`https://dolarapi.com/v1/dolares/oficial` y `/blue`) fue verificada manualmente y devuelve:
```json
{"moneda":"USD","casa":"oficial","nombre":"Oficial","compra":1465,"venta":1515,"fechaActualizacion":"2026-08-03T13:00:00.000Z"}
```

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/rates/__tests__/dolar.test.ts`:

```typescript
import { obtenerCotizacion, obtenerCotizacionConCache } from '../dolar';
import type { RateCache } from '../dolar';

const respuestaOficialMock = {
  moneda: 'USD',
  casa: 'oficial',
  nombre: 'Oficial',
  compra: 1465,
  venta: 1515,
  fechaActualizacion: '2026-08-03T13:00:00.000Z',
};

describe('obtenerCotizacion', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('pide la cotización oficial a la URL correcta y la normaliza', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => respuestaOficialMock,
    });

    const resultado = await obtenerCotizacion('oficial');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://dolarapi.com/v1/dolares/oficial',
      expect.objectContaining({ signal: expect.anything() })
    );
    expect(resultado).toEqual({
      casa: 'oficial',
      compra: 1465,
      venta: 1515,
      fechaActualizacion: '2026-08-03T13:00:00.000Z',
    });
  });

  it('pide la cotización blue a la URL correcta', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...respuestaOficialMock, casa: 'blue' }),
    });

    await obtenerCotizacion('blue');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://dolarapi.com/v1/dolares/blue',
      expect.anything()
    );
  });

  it('lanza un error si la respuesta no es ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(obtenerCotizacion('oficial')).rejects.toThrow();
  });
});

describe('obtenerCotizacionConCache', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  function crearCacheFake(inicial: Record<string, any> = {}): RateCache & { datos: Record<string, any> } {
    const datos = { ...inicial };
    return {
      datos,
      async guardar(c) {
        datos[c.casa] = c;
      },
      async leer(casa) {
        return datos[casa] ?? null;
      },
    };
  }

  it('si la red responde, guarda en cache y devuelve el valor fresco', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => respuestaOficialMock,
    });
    const cache = crearCacheFake();

    const resultado = await obtenerCotizacionConCache('oficial', cache);

    expect(resultado.venta).toBe(1515);
    expect(cache.datos.oficial.venta).toBe(1515);
  });

  it('si la red falla, devuelve el último valor cacheado', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('sin conexión'));
    const cache = crearCacheFake({
      oficial: { casa: 'oficial', compra: 1000, venta: 1050, fechaActualizacion: '2026-07-01T00:00:00.000Z' },
    });

    const resultado = await obtenerCotizacionConCache('oficial', cache);

    expect(resultado.venta).toBe(1050);
  });

  it('si la red falla y no hay cache, propaga el error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('sin conexión'));
    const cache = crearCacheFake();

    await expect(obtenerCotizacionConCache('oficial', cache)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- dolar`
Expected: FAIL — "Cannot find module '../dolar'".

- [ ] **Step 3: Implementar el cliente**

Crear `src/rates/dolar.ts`:

```typescript
import type { RateKind } from '../domain/types';

export interface Cotizacion {
  casa: RateKind;
  /** Precio de compra del dólar, en pesos. */
  compra: number;
  /** Precio de venta del dólar, en pesos. Es el que se usa para convertir gastos. */
  venta: number;
  fechaActualizacion: string;
}

interface RespuestaDolarApi {
  casa: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

const TIMEOUT_MS = 8000;

/** Pide la cotización actual a dolarapi.com. Lanza si la red falla o la respuesta no es ok. */
export async function obtenerCotizacion(casa: RateKind): Promise<Cotizacion> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(`https://dolarapi.com/v1/dolares/${casa}`, {
      signal: controller.signal,
    });
    if (!respuesta.ok) {
      throw new Error(`dolarapi respondió ${respuesta.status}`);
    }
    const datos: RespuestaDolarApi = await respuesta.json();
    return {
      casa,
      compra: datos.compra,
      venta: datos.venta,
      fechaActualizacion: datos.fechaActualizacion,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Interfaz de cache que implementan AsyncStorage (celular) y localStorage (escritorio). */
export interface RateCache {
  guardar(cotizacion: Cotizacion): Promise<void>;
  leer(casa: RateKind): Promise<Cotizacion | null>;
}

/**
 * Intenta traer la cotización fresca de la red. Si falla (sin conexión, timeout),
 * devuelve la última guardada en cache. Si tampoco hay cache, propaga el error.
 */
export async function obtenerCotizacionConCache(
  casa: RateKind,
  cache: RateCache
): Promise<Cotizacion> {
  try {
    const fresca = await obtenerCotizacion(casa);
    await cache.guardar(fresca);
    return fresca;
  } catch (error) {
    const cacheada = await cache.leer(casa);
    if (cacheada) return cacheada;
    throw error;
  }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- dolar`
Expected: PASS — todos los tests de dolar pasan.

- [ ] **Step 5: Implementar el `RateCache` real con AsyncStorage**

Crear `src/rates/rate-cache-storage.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Cotizacion, RateCache } from './dolar';
import type { RateKind } from '../domain/types';

const clave = (casa: RateKind) => `cotizacion_${casa}`;

/** Cache respaldada por AsyncStorage. Funciona igual en celular y en web (usa localStorage por debajo). */
export const rateCacheStorage: RateCache = {
  async guardar(cotizacion: Cotizacion): Promise<void> {
    await AsyncStorage.setItem(clave(cotizacion.casa), JSON.stringify(cotizacion));
  },
  async leer(casa: RateKind): Promise<Cotizacion | null> {
    const json = await AsyncStorage.getItem(clave(casa));
    return json ? JSON.parse(json) : null;
  },
};
```

- [ ] **Step 6: Commit**

```bash
git add src/rates
git commit -m "agrega cliente de cotización del dólar con cache offline"
```

---

## Task 5: Inicialización de Firebase por plataforma

**Files:**
- Create: `src/firebase/app.ts`, `src/firebase/__tests__/app.test.ts`

**Interfaces:**
- Consumes: variables de entorno `EXPO_PUBLIC_FIREBASE_*` (Task 1)
- Produces:
  - `function getFirebaseApp(): FirebaseApp`
  - `function getFirestoreDb(): Firestore` — con `persistentLocalCache` en web, cache en memoria en nativo
  - `function getFirebaseAuth(): Auth` — con `getReactNativePersistence` en nativo, persistencia por defecto en web

Nota de diseño: se verificó contra la documentación oficial que `persistentLocalCache` **no está soportado en React Native** (solo web/Node con IndexedDB — y en Node ni siquiera eso). Por eso en nativo Firestore corre en memoria, y la Task 6 agrega la cola local de verdad sobre `expo-sqlite`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/firebase/__tests__/app.test.ts`:

```typescript
describe('getFirebaseApp', () => {
  it('lanza un error descriptivo si faltan variables de entorno', () => {
    const originales = { ...process.env };
    delete process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

    jest.resetModules();
    const { getFirebaseApp } = require('../app');

    expect(() => getFirebaseApp()).toThrow(/EXPO_PUBLIC_FIREBASE_API_KEY/);

    process.env = originales;
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- firebase/app`
Expected: FAIL — "Cannot find module '../app'".

- [ ] **Step 3: Implementar la inicialización**

Crear `src/firebase/app.ts`:

```typescript
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  type Firestore,
} from 'firebase/firestore';
import { initializeAuth, getAuth, getReactNativePersistence, type Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const VARIABLES_REQUERIDAS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
] as const;

function leerConfiguracion() {
  for (const variable of VARIABLES_REQUERIDAS) {
    if (!process.env[variable]) {
      throw new Error(
        `Falta la variable de entorno ${variable}. Copiá .env.example a .env y completá las credenciales de Firebase.`
      );
    }
  }
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
  };
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(leerConfiguracion());
  }
  return app;
}

/**
 * En web, usa cache persistente en IndexedDB (offline real).
 * En nativo, Firestore JS SDK no soporta persistencia en disco: usa cache en
 * memoria y la Task 6 (cola local con expo-sqlite) cubre el offline real ahí.
 */
export function getFirestoreDb(): Firestore {
  if (!db) {
    db = initializeFirestore(getFirebaseApp(), {
      localCache: Platform.OS === 'web' ? persistentLocalCache({}) : memoryLocalCache(),
    });
  }
  return db;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth =
      Platform.OS === 'web'
        ? getAuth(getFirebaseApp())
        : initializeAuth(getFirebaseApp(), {
            persistence: getReactNativePersistence(AsyncStorage),
          });
  }
  return auth;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- firebase/app`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/firebase
git commit -m "agrega inicialización de Firebase con cache según plataforma"
```

---

## Task 6: Persistencia local en celular (SQLite) y cola de sincronización

**Files:**
- Create: `src/db/local.ts`, `src/db/local.native.ts`, `src/db/local.web.ts`, `src/db/sync.ts`, `src/db/__tests__/sync.test.ts`

**Interfaces:**
- Consumes: nada nuevo
- Produces:
  - `interface PendingWrite { id: string; coleccion: 'expenses' | 'sectors' | 'budgets' | 'savings'; operacion: 'set' | 'delete'; datos: Record<string, unknown> | null; creadoEn: number }`
  - `interface LocalStore { guardarPendiente(w: PendingWrite): Promise<void>; listarPendientes(): Promise<PendingWrite[]>; borrarPendiente(id: string): Promise<void>; guardarSnapshot(coleccion: string, datos: unknown[]): Promise<void>; leerSnapshot(coleccion: string): Promise<unknown[]> }`
  - `function crearColaDeSincronizacion(params: { store: LocalStore; subirAFirestore: (w: PendingWrite) => Promise<void>; estaOnline: () => boolean }): { encolar(w: Omit<PendingWrite, 'creadoEn'>): Promise<void>; sincronizar(): Promise<{ subidos: number; fallidos: number }> }`

La cola es el mecanismo que soluciona el hueco que encontramos: en celular, Firestore no persiste en disco, así que cada escritura se guarda primero en SQLite local (vía `LocalStore`) y `sincronizar()` la sube cuando hay red.

- [ ] **Step 1: Escribir la interfaz común**

Crear `src/db/local.ts`:

```typescript
export interface PendingWrite {
  id: string;
  coleccion: 'expenses' | 'sectors' | 'budgets' | 'savings';
  operacion: 'set' | 'delete';
  /** Datos del documento. null si operacion es 'delete'. */
  datos: Record<string, unknown> | null;
  creadoEn: number;
}

/**
 * Persistencia local de un dispositivo: la cola de escrituras pendientes de
 * subir, y un snapshot de la última copia conocida de cada colección (para
 * poder mostrar datos aunque no haya red ni se haya sincronizado nunca).
 */
export interface LocalStore {
  guardarPendiente(escritura: PendingWrite): Promise<void>;
  listarPendientes(): Promise<PendingWrite[]>;
  borrarPendiente(id: string): Promise<void>;
  guardarSnapshot(coleccion: string, datos: unknown[]): Promise<void>;
  leerSnapshot(coleccion: string): Promise<unknown[]>;
}
```

- [ ] **Step 2: Escribir los tests de la cola de sincronización (contra un `LocalStore` fake)**

Crear `src/db/__tests__/sync.test.ts`:

```typescript
import { crearColaDeSincronizacion } from '../sync';
import type { LocalStore, PendingWrite } from '../local';

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

describe('encolar', () => {
  it('guarda la escritura en el store con timestamp', async () => {
    const store = crearStoreFake();
    const cola = crearColaDeSincronizacion({
      store,
      subirAFirestore: jest.fn(),
      estaOnline: () => false,
    });

    await cola.encolar({ id: 'e1', coleccion: 'expenses', operacion: 'set', datos: { monto: 100 } });

    expect(store.pendientes).toHaveLength(1);
    expect(store.pendientes[0].id).toBe('e1');
    expect(typeof store.pendientes[0].creadoEn).toBe('number');
  });
});

describe('sincronizar', () => {
  it('no hace nada si está offline', async () => {
    const store = crearStoreFake();
    const subir = jest.fn();
    const cola = crearColaDeSincronizacion({ store, subirAFirestore: subir, estaOnline: () => false });
    await cola.encolar({ id: 'e1', coleccion: 'expenses', operacion: 'set', datos: {} });

    const resultado = await cola.sincronizar();

    expect(subir).not.toHaveBeenCalled();
    expect(resultado).toEqual({ subidos: 0, fallidos: 0 });
    expect(store.pendientes).toHaveLength(1);
  });

  it('sube cada pendiente y lo borra del store si tiene éxito', async () => {
    const store = crearStoreFake();
    const subir = jest.fn().mockResolvedValue(undefined);
    const cola = crearColaDeSincronizacion({ store, subirAFirestore: subir, estaOnline: () => true });
    await cola.encolar({ id: 'e1', coleccion: 'expenses', operacion: 'set', datos: { monto: 100 } });
    await cola.encolar({ id: 'e2', coleccion: 'sectors', operacion: 'delete', datos: null });

    const resultado = await cola.sincronizar();

    expect(subir).toHaveBeenCalledTimes(2);
    expect(store.pendientes).toHaveLength(0);
    expect(resultado).toEqual({ subidos: 2, fallidos: 0 });
  });

  it('si una escritura falla, la deja en la cola y sigue con las demás', async () => {
    const store = crearStoreFake();
    const subir = jest
      .fn()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValueOnce(undefined);
    const cola = crearColaDeSincronizacion({ store, subirAFirestore: subir, estaOnline: () => true });
    await cola.encolar({ id: 'e1', coleccion: 'expenses', operacion: 'set', datos: {} });
    await cola.encolar({ id: 'e2', coleccion: 'expenses', operacion: 'set', datos: {} });

    const resultado = await cola.sincronizar();

    expect(resultado).toEqual({ subidos: 1, fallidos: 1 });
    expect(store.pendientes).toHaveLength(1);
    expect(store.pendientes[0].id).toBe('e1');
  });
});
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npm test -- sync`
Expected: FAIL — "Cannot find module '../sync'".

- [ ] **Step 4: Implementar la cola de sincronización**

Crear `src/db/sync.ts`:

```typescript
import type { LocalStore, PendingWrite } from './local';

interface ParametrosCola {
  store: LocalStore;
  subirAFirestore: (escritura: PendingWrite) => Promise<void>;
  estaOnline: () => boolean;
}

export function crearColaDeSincronizacion(params: ParametrosCola) {
  const { store, subirAFirestore, estaOnline } = params;

  return {
    async encolar(escritura: Omit<PendingWrite, 'creadoEn'>): Promise<void> {
      await store.guardarPendiente({ ...escritura, creadoEn: Date.now() });
    },

    async sincronizar(): Promise<{ subidos: number; fallidos: number }> {
      if (!estaOnline()) {
        return { subidos: 0, fallidos: 0 };
      }

      const pendientes = await store.listarPendientes();
      let subidos = 0;
      let fallidos = 0;

      for (const escritura of pendientes) {
        try {
          await subirAFirestore(escritura);
          await store.borrarPendiente(escritura.id);
          subidos++;
        } catch {
          fallidos++;
        }
      }

      return { subidos, fallidos };
    },
  };
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npm test -- sync`
Expected: PASS.

- [ ] **Step 6: Implementar el `LocalStore` real con `expo-sqlite` (nativo)**

Crear `src/db/local.native.ts`:

```typescript
import * as SQLite from 'expo-sqlite';
import type { LocalStore, PendingWrite } from './local';

const dbPromise = SQLite.openDatabaseAsync('gastos-local.db');

async function migrar(): Promise<void> {
  const db = await dbPromise;
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pendientes (
      id TEXT PRIMARY KEY,
      coleccion TEXT NOT NULL,
      operacion TEXT NOT NULL,
      datos TEXT,
      creadoEn INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS snapshots (
      coleccion TEXT PRIMARY KEY,
      datos TEXT NOT NULL
    );
  `);
}

let migracionLista: Promise<void> | null = null;
function asegurarMigracion(): Promise<void> {
  if (!migracionLista) migracionLista = migrar();
  return migracionLista;
}

/** Implementación de LocalStore respaldada por SQLite, para celular. */
export const localStoreSqlite: LocalStore = {
  async guardarPendiente(w: PendingWrite): Promise<void> {
    await asegurarMigracion();
    const db = await dbPromise;
    await db.runAsync(
      'INSERT OR REPLACE INTO pendientes (id, coleccion, operacion, datos, creadoEn) VALUES (?, ?, ?, ?, ?)',
      w.id,
      w.coleccion,
      w.operacion,
      w.datos ? JSON.stringify(w.datos) : null,
      w.creadoEn
    );
  },

  async listarPendientes(): Promise<PendingWrite[]> {
    await asegurarMigracion();
    const db = await dbPromise;
    const filas = await db.getAllAsync<{
      id: string;
      coleccion: PendingWrite['coleccion'];
      operacion: PendingWrite['operacion'];
      datos: string | null;
      creadoEn: number;
    }>('SELECT * FROM pendientes ORDER BY creadoEn ASC');

    return filas.map((f) => ({
      id: f.id,
      coleccion: f.coleccion,
      operacion: f.operacion,
      datos: f.datos ? JSON.parse(f.datos) : null,
      creadoEn: f.creadoEn,
    }));
  },

  async borrarPendiente(id: string): Promise<void> {
    await asegurarMigracion();
    const db = await dbPromise;
    await db.runAsync('DELETE FROM pendientes WHERE id = ?', id);
  },

  async guardarSnapshot(coleccion: string, datos: unknown[]): Promise<void> {
    await asegurarMigracion();
    const db = await dbPromise;
    await db.runAsync(
      'INSERT OR REPLACE INTO snapshots (coleccion, datos) VALUES (?, ?)',
      coleccion,
      JSON.stringify(datos)
    );
  },

  async leerSnapshot(coleccion: string): Promise<unknown[]> {
    await asegurarMigracion();
    const db = await dbPromise;
    const fila = await db.getFirstAsync<{ datos: string }>(
      'SELECT datos FROM snapshots WHERE coleccion = ?',
      coleccion
    );
    return fila ? JSON.parse(fila.datos) : [];
  },
};
```

- [ ] **Step 7: Implementar el `LocalStore` para escritorio (no-op)**

En escritorio, Firestore ya tiene `persistentLocalCache` (Task 5), así que no hace falta cola propia: el store es un stub que nunca guarda pendientes.

Crear `src/db/local.web.ts`:

```typescript
import type { LocalStore } from './local';

/**
 * En escritorio/web, Firestore ya persiste en IndexedDB (ver src/firebase/app.ts),
 * así que la cola local no tiene trabajo que hacer: no hay pendientes que
 * acumular ni snapshots que leer aparte de los que da Firestore.
 */
export const localStoreSqlite: LocalStore = {
  async guardarPendiente(): Promise<void> {},
  async listarPendientes(): Promise<[]> {
    return [];
  },
  async borrarPendiente(): Promise<void> {},
  async guardarSnapshot(): Promise<void> {},
  async leerSnapshot(): Promise<[]> {
    return [];
  },
};
```

Metro (el bundler de Expo) resuelve automáticamente `local.native.ts` en iOS/Android y `local.web.ts` en web por la extensión de archivo — no hace falta lógica de `Platform.select` para esto.

- [ ] **Step 8: Commit**

```bash
git add src/db
git commit -m "agrega cola de sincronización offline con SQLite en celular"
```

---

## Task 7: Repositorios (expenses, sectors, budgets, savings)

**Files:**
- Create: `src/repos/expense-repo.ts`, `src/repos/__tests__/expense-repo.test.ts`, `src/repos/sector-repo.ts`, `src/repos/budget-repo.ts`, `src/repos/savings-repo.ts`, `src/repos/create-repo.ts`

**Interfaces:**
- Consumes: `LocalStore`/`crearColaDeSincronizacion` (Task 6), `Firestore` de `getFirestoreDb()` (Task 5), tipos de dominio (Task 2)
- Produces:
  - `interface ExpenseRepo { listar(): Promise<Expense[]>; agregar(gasto: Omit<Expense, 'id'>): Promise<Expense>; eliminar(id: string): Promise<void>; suscribir(cb: (gastos: Expense[]) => void): () => void }`
  - Repos análogos para `Sector`, `Budget` (por `set`, ya que la clave es el mes) y `SavingMovement`.
  - `function crearExpenseRepo(deps: { db: Firestore; uid: string; localStore: LocalStore; estaOnline: () => boolean }): ExpenseRepo`

Todos los repos siguen el mismo patrón: escriben primero en la cola local (offline-safe) y a la vez intentan escribir/leer de Firestore vía `onSnapshot` para reflejar cambios en tiempo real cuando hay red. Se implementa completo el de `expenses` (el más usado) como referencia; los otros tres siguen la misma forma con menos campos.

- [ ] **Step 1: Escribir los tests del repo de gastos**

Crear `src/repos/__tests__/expense-repo.test.ts`:

```typescript
import { crearExpenseRepo } from '../expense-repo';
import type { LocalStore, PendingWrite } from '../../db/local';
import type { Expense } from '../../domain/types';

function crearStoreFake(): LocalStore & { pendientes: PendingWrite[] } {
  const pendientes: PendingWrite[] = [];
  const snapshots: Record<string, unknown[]> = { expenses: [] };
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

function gastoParcial(): Omit<Expense, 'id'> {
  return {
    centavosArs: 1500,
    montoOriginal: 15,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    fecha: '2026-06-01',
    sectorId: null,
    lugar: null,
    descripcion: null,
    metodoPago: null,
  };
}

describe('crearExpenseRepo sin conexión', () => {
  it('agregar() genera un id, guarda snapshot local y encola la escritura', async () => {
    const store = crearStoreFake();
    const repo = crearExpenseRepo({
      db: null as any,
      uid: 'u1',
      localStore: store,
      estaOnline: () => false,
    });

    const gasto = await repo.agregar(gastoParcial());

    expect(typeof gasto.id).toBe('string');
    expect(gasto.id.length).toBeGreaterThan(0);
    expect(store.pendientes).toHaveLength(1);
    expect(store.pendientes[0].coleccion).toBe('expenses');
    expect(store.pendientes[0].operacion).toBe('set');
  });

  it('listar() devuelve lo guardado en el snapshot local', async () => {
    const store = crearStoreFake();
    const repo = crearExpenseRepo({
      db: null as any,
      uid: 'u1',
      localStore: store,
      estaOnline: () => false,
    });

    await repo.agregar(gastoParcial());
    const lista = await repo.listar();

    expect(lista).toHaveLength(1);
    expect(lista[0].centavosArs).toBe(1500);
  });

  it('eliminar() encola un delete y lo saca de listar()', async () => {
    const store = crearStoreFake();
    const repo = crearExpenseRepo({
      db: null as any,
      uid: 'u1',
      localStore: store,
      estaOnline: () => false,
    });

    const gasto = await repo.agregar(gastoParcial());
    await repo.eliminar(gasto.id);
    const lista = await repo.listar();

    expect(lista).toHaveLength(0);
    expect(store.pendientes.some((p) => p.operacion === 'delete' && p.id === gasto.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- expense-repo`
Expected: FAIL — "Cannot find module '../expense-repo'".

- [ ] **Step 3: Implementar el repo de gastos**

Crear `src/repos/expense-repo.ts`:

```typescript
import { doc, deleteDoc, setDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import type { LocalStore } from '../db/local';
import type { Expense } from '../domain/types';

interface DepsExpenseRepo {
  db: Firestore;
  uid: string;
  localStore: LocalStore;
  estaOnline: () => boolean;
}

export interface ExpenseRepo {
  listar(): Promise<Expense[]>;
  agregar(gasto: Omit<Expense, 'id'>): Promise<Expense>;
  eliminar(id: string): Promise<void>;
  /** Se suscribe a cambios en tiempo real (solo tiene efecto real si hay red). Devuelve función para desuscribirse. */
  suscribir(cb: (gastos: Expense[]) => void): () => void;
}

const COLECCION = 'expenses' as const;

export function crearExpenseRepo(deps: DepsExpenseRepo): ExpenseRepo {
  const { db, uid, localStore, estaOnline } = deps;

  async function leerLocal(): Promise<Expense[]> {
    const datos = await localStore.leerSnapshot(COLECCION);
    return datos as Expense[];
  }

  async function escribirLocal(gastos: Expense[]): Promise<void> {
    await localStore.guardarSnapshot(COLECCION, gastos);
  }

  return {
    async listar(): Promise<Expense[]> {
      return leerLocal();
    },

    async agregar(gastoSinId: Omit<Expense, 'id'>): Promise<Expense> {
      const gasto: Expense = { ...gastoSinId, id: Crypto.randomUUID() };

      const actuales = await leerLocal();
      await escribirLocal([...actuales, gasto]);

      await localStore.guardarPendiente({
        id: gasto.id,
        coleccion: COLECCION,
        operacion: 'set',
        datos: gasto as unknown as Record<string, unknown>,
        creadoEn: Date.now(),
      });

      if (estaOnline()) {
        await setDoc(doc(db, 'users', uid, COLECCION, gasto.id), gasto).catch(() => {
          // si falla, la cola de sincronización (Task 6) la reintenta después
        });
      }

      return gasto;
    },

    async eliminar(id: string): Promise<void> {
      const actuales = await leerLocal();
      await escribirLocal(actuales.filter((g) => g.id !== id));

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

    suscribir(cb: (gastos: Expense[]) => void): () => void {
      if (!estaOnline()) return () => {};

      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const gastos = snapshot.docs.map((d) => d.data() as Expense);
        escribirLocal(gastos).then(() => cb(gastos));
      });
    },
  };
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- expense-repo`
Expected: PASS.

- [ ] **Step 5: Implementar los otros tres repos siguiendo el mismo patrón**

Crear `src/repos/sector-repo.ts`:

```typescript
import { doc, deleteDoc, setDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import type { LocalStore } from '../db/local';
import type { Sector } from '../domain/types';

interface DepsSectorRepo {
  db: Firestore;
  uid: string;
  localStore: LocalStore;
  estaOnline: () => boolean;
}

export interface SectorRepo {
  listar(): Promise<Sector[]>;
  guardar(sector: Sector | Omit<Sector, 'id'>): Promise<Sector>;
  eliminar(id: string): Promise<void>;
  suscribir(cb: (sectores: Sector[]) => void): () => void;
}

const COLECCION = 'sectors' as const;

export function crearSectorRepo(deps: DepsSectorRepo): SectorRepo {
  const { db, uid, localStore, estaOnline } = deps;

  async function leerLocal(): Promise<Sector[]> {
    return (await localStore.leerSnapshot(COLECCION)) as Sector[];
  }

  async function escribirLocal(sectores: Sector[]): Promise<void> {
    await localStore.guardarSnapshot(COLECCION, sectores);
  }

  return {
    async listar(): Promise<Sector[]> {
      return leerLocal();
    },

    async guardar(sectorParcial): Promise<Sector> {
      const sector: Sector = 'id' in sectorParcial ? sectorParcial : { ...sectorParcial, id: Crypto.randomUUID() };

      const actuales = await leerLocal();
      const sinEsteId = actuales.filter((s) => s.id !== sector.id);
      await escribirLocal([...sinEsteId, sector]);

      await localStore.guardarPendiente({
        id: sector.id,
        coleccion: COLECCION,
        operacion: 'set',
        datos: sector as unknown as Record<string, unknown>,
        creadoEn: Date.now(),
      });

      if (estaOnline()) {
        await setDoc(doc(db, 'users', uid, COLECCION, sector.id), sector).catch(() => {});
      }

      return sector;
    },

    async eliminar(id: string): Promise<void> {
      const actuales = await leerLocal();
      await escribirLocal(actuales.filter((s) => s.id !== id));

      await localStore.guardarPendiente({ id, coleccion: COLECCION, operacion: 'delete', datos: null, creadoEn: Date.now() });

      if (estaOnline()) {
        await deleteDoc(doc(db, 'users', uid, COLECCION, id)).catch(() => {});
      }
    },

    suscribir(cb: (sectores: Sector[]) => void): () => void {
      if (!estaOnline()) return () => {};
      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const sectores = snapshot.docs.map((d) => d.data() as Sector);
        escribirLocal(sectores).then(() => cb(sectores));
      });
    },
  };
}
```

Crear `src/repos/budget-repo.ts` (misma forma, pero la clave del documento es `Budget.mes` en vez de un id generado, porque solo puede haber un presupuesto por mes):

```typescript
import { doc, setDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
import type { LocalStore } from '../db/local';
import type { Budget } from '../domain/types';

interface DepsBudgetRepo {
  db: Firestore;
  uid: string;
  localStore: LocalStore;
  estaOnline: () => boolean;
}

export interface BudgetRepo {
  listar(): Promise<Budget[]>;
  guardar(presupuesto: Budget): Promise<Budget>;
  suscribir(cb: (presupuestos: Budget[]) => void): () => void;
}

const COLECCION = 'budgets' as const;

export function crearBudgetRepo(deps: DepsBudgetRepo): BudgetRepo {
  const { db, uid, localStore, estaOnline } = deps;

  async function leerLocal(): Promise<Budget[]> {
    return (await localStore.leerSnapshot(COLECCION)) as Budget[];
  }

  async function escribirLocal(presupuestos: Budget[]): Promise<void> {
    await localStore.guardarSnapshot(COLECCION, presupuestos);
  }

  return {
    async listar(): Promise<Budget[]> {
      return leerLocal();
    },

    async guardar(presupuesto: Budget): Promise<Budget> {
      const actuales = await leerLocal();
      const sinEsteMes = actuales.filter((p) => p.mes !== presupuesto.mes);
      await escribirLocal([...sinEsteMes, presupuesto]);

      await localStore.guardarPendiente({
        id: presupuesto.mes,
        coleccion: COLECCION,
        operacion: 'set',
        datos: presupuesto as unknown as Record<string, unknown>,
        creadoEn: Date.now(),
      });

      if (estaOnline()) {
        await setDoc(doc(db, 'users', uid, COLECCION, presupuesto.mes), presupuesto).catch(() => {});
      }

      return presupuesto;
    },

    suscribir(cb: (presupuestos: Budget[]) => void): () => void {
      if (!estaOnline()) return () => {};
      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const presupuestos = snapshot.docs.map((d) => d.data() as Budget);
        escribirLocal(presupuestos).then(() => cb(presupuestos));
      });
    },
  };
}
```

Crear `src/repos/savings-repo.ts` (misma forma que `expense-repo.ts`, cambiando el tipo):

```typescript
import { doc, setDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import type { LocalStore } from '../db/local';
import type { SavingMovement } from '../domain/types';

interface DepsSavingsRepo {
  db: Firestore;
  uid: string;
  localStore: LocalStore;
  estaOnline: () => boolean;
}

export interface SavingsRepo {
  listar(): Promise<SavingMovement[]>;
  agregar(movimiento: Omit<SavingMovement, 'id'>): Promise<SavingMovement>;
  suscribir(cb: (movimientos: SavingMovement[]) => void): () => void;
}

const COLECCION = 'savings' as const;

export function crearSavingsRepo(deps: DepsSavingsRepo): SavingsRepo {
  const { db, uid, localStore, estaOnline } = deps;

  async function leerLocal(): Promise<SavingMovement[]> {
    return (await localStore.leerSnapshot(COLECCION)) as SavingMovement[];
  }

  async function escribirLocal(movimientos: SavingMovement[]): Promise<void> {
    await localStore.guardarSnapshot(COLECCION, movimientos);
  }

  return {
    async listar(): Promise<SavingMovement[]> {
      return leerLocal();
    },

    async agregar(movimientoSinId: Omit<SavingMovement, 'id'>): Promise<SavingMovement> {
      const movimiento: SavingMovement = { ...movimientoSinId, id: Crypto.randomUUID() };

      const actuales = await leerLocal();
      await escribirLocal([...actuales, movimiento]);

      await localStore.guardarPendiente({
        id: movimiento.id,
        coleccion: COLECCION,
        operacion: 'set',
        datos: movimiento as unknown as Record<string, unknown>,
        creadoEn: Date.now(),
      });

      if (estaOnline()) {
        await setDoc(doc(db, 'users', uid, COLECCION, movimiento.id), movimiento).catch(() => {});
      }

      return movimiento;
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

- [ ] **Step 6: Fábrica única que arma los cuatro repos con las dependencias reales**

Crear `src/repos/create-repo.ts`:

```typescript
import NetInfo from '@react-native-community/netinfo';
import { getFirestoreDb } from '../firebase/app';
import { localStoreSqlite } from '../db/local';
import { crearExpenseRepo, type ExpenseRepo } from './expense-repo';
import { crearSectorRepo, type SectorRepo } from './sector-repo';
import { crearBudgetRepo, type BudgetRepo } from './budget-repo';
import { crearSavingsRepo, type SavingsRepo } from './savings-repo';

export interface Repos {
  expenses: ExpenseRepo;
  sectors: SectorRepo;
  budgets: BudgetRepo;
  savings: SavingsRepo;
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
  };
}
```

Instalar la dependencia de red que falta:

```bash
npx expo install @react-native-community/netinfo
```

- [ ] **Step 7: Commit**

```bash
git add src/repos
git commit -m "agrega repositorios offline-first para gastos, sectores, presupuestos y ahorro"
```

---

## Task 8: PIN de acceso

**Files:**
- Create: `src/auth/pin.ts`, `src/auth/__tests__/pin.test.ts`

**Interfaces:**
- Consumes: nada nuevo (usa `expo-crypto`)
- Produces:
  - `function hashPin(pin: string): Promise<string>`
  - `function pinEsValido(pin: string): boolean` — exactamente 4 dígitos
  - `function verificarPin(pin: string, hashGuardado: string): Promise<boolean>`

El PIN nunca se guarda en texto plano: se guarda su hash SHA-256 en `settings/preferences` (Firestore) y se compara hash contra hash al desbloquear.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/auth/__tests__/pin.test.ts`:

```typescript
import { hashPin, pinEsValido, verificarPin } from '../pin';

describe('pinEsValido', () => {
  it('acepta un PIN de 4 dígitos', () => {
    expect(pinEsValido('1234')).toBe(true);
  });

  it('rechaza menos de 4 dígitos', () => {
    expect(pinEsValido('123')).toBe(false);
  });

  it('rechaza más de 4 dígitos', () => {
    expect(pinEsValido('12345')).toBe(false);
  });

  it('rechaza caracteres no numéricos', () => {
    expect(pinEsValido('12ab')).toBe(false);
  });
});

describe('hashPin y verificarPin', () => {
  it('un PIN correcto verifica contra su propio hash', async () => {
    const hash = await hashPin('4269');
    await expect(verificarPin('4269', hash)).resolves.toBe(true);
  });

  it('un PIN incorrecto no verifica', async () => {
    const hash = await hashPin('4269');
    await expect(verificarPin('0000', hash)).resolves.toBe(false);
  });

  it('el hash de PINes distintos es distinto', async () => {
    const hashA = await hashPin('1111');
    const hashB = await hashPin('2222');
    expect(hashA).not.toBe(hashB);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- pin`
Expected: FAIL — "Cannot find module '../pin'".

- [ ] **Step 3: Implementar**

Crear `src/auth/pin.ts`:

```typescript
import * as Crypto from 'expo-crypto';

/** Un PIN válido son exactamente 4 dígitos numéricos. */
export function pinEsValido(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/** Devuelve el hash SHA-256 del PIN, en hexadecimal. Nunca se guarda el PIN en texto plano. */
export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

export async function verificarPin(pin: string, hashGuardado: string): Promise<boolean> {
  const hashIngresado = await hashPin(pin);
  return hashIngresado === hashGuardado;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- pin`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth
git commit -m "agrega hash y verificación del PIN de acceso"
```

---

## Task 9: Tema de colores y espaciado

**Files:**
- Create: `src/theme/colors.ts`, `src/theme/spacing.ts`

**Interfaces:**
- Consumes: nada
- Produces: `export const colors = {...}`, `export const spacing = {...}`, `export const sectorPalette: string[]` — colores rotativos para asignar a sectores nuevos.

Se usa la paleta de colores estándar de FyLabs (`~/.claude/CLAUDE.md`) como base neutra: verde como acento principal de la app personal, con los semánticos de azul/naranja/rojo para estados.

- [ ] **Step 1: Crear los tokens de color**

Crear `src/theme/colors.ts`:

```typescript
/** Paleta de colores de la app. No usar valores de color sueltos fuera de este archivo. */
export const colors = {
  primary: '#16a97e',
  primaryDark: '#0d7a5a',
  primaryLight: '#e6f7f2',

  blue: '#2563eb',
  blueLight: '#eff6ff',

  orange: '#f59e0b',
  orangeLight: '#fffbeb',

  red: '#ef4444',
  redLight: '#fef2f2',

  bg: '#f4f6f9',
  surface: '#ffffff',
  surface2: '#f9fafb',
  border: '#e5e7eb',
  borderDark: '#d1d5db',
  text1: '#111827',
  text2: '#374151',
  text3: '#6b7280',
  text4: '#9ca3af',
} as const;

/** Colores rotativos para asignar automáticamente a sectores nuevos, en orden. */
export const sectorPalette: string[] = [
  '#16a97e',
  '#2563eb',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#0d7a5a',
  '#6d28d9',
  '#d97706',
];
```

- [ ] **Step 2: Crear los tokens de espaciado**

Crear `src/theme/spacing.ts`:

```typescript
/** Escala de espaciado en píxeles, usar siempre estos valores en vez de números sueltos. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
```

- [ ] **Step 3: Commit**

```bash
git add src/theme
git commit -m "agrega tokens de color y espaciado"
```

---

## Task 10: Componentes compartidos (MoneyText, PieChart, SectorProgress)

**Files:**
- Create: `src/components/money-text.tsx`, `src/components/pie-chart.tsx`, `src/components/pie-chart-math.ts`, `src/components/__tests__/pie-chart-math.test.ts`, `src/components/sector-progress.tsx`

**Interfaces:**
- Consumes: `colors`, `spacing` (Task 9), `formatCentavos`/`formatUsd` (Task 2)
- Produces:
  - `function MoneyText(props: { centavos: number; moneda: 'ARS' | 'USD'; cotizacion?: number; style?: TextStyle }): JSX.Element`
  - `interface Porcion { etiqueta: string; valor: number; color: string }`
  - `function calcularAngulos(porciones: Porcion[]): Array<{ etiqueta: string; color: string; porcentaje: number; anguloInicio: number; anguloFin: number }>` (lógica pura, testeada)
  - `function PieChart(props: { porciones: Porcion[]; size?: number }): JSX.Element`
  - `function SectorProgress(props: { nombre: string; color: string; gastado: number; limite: number | null }): JSX.Element`

La matemática del gráfico de torta (qué ángulo le toca a cada porción) se separa en un archivo puro y testeable; el componente `PieChart` solo dibuja lo que esa función calcula.

- [ ] **Step 1: Escribir los tests de la matemática del gráfico que fallan**

Crear `src/components/__tests__/pie-chart-math.test.ts`:

```typescript
import { calcularAngulos } from '../pie-chart-math';

describe('calcularAngulos', () => {
  it('reparte 360 grados proporcionalmente al valor de cada porción', () => {
    const resultado = calcularAngulos([
      { etiqueta: 'Ocio', valor: 50, color: '#16a97e' },
      { etiqueta: 'Vacaciones', valor: 50, color: '#2563eb' },
    ]);

    expect(resultado[0].porcentaje).toBeCloseTo(50);
    expect(resultado[0].anguloInicio).toBe(0);
    expect(resultado[0].anguloFin).toBe(180);
    expect(resultado[1].anguloInicio).toBe(180);
    expect(resultado[1].anguloFin).toBe(360);
  });

  it('ignora las porciones de valor 0', () => {
    const resultado = calcularAngulos([
      { etiqueta: 'Ocio', valor: 100, color: '#16a97e' },
      { etiqueta: 'Vacío', valor: 0, color: '#2563eb' },
    ]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].etiqueta).toBe('Ocio');
  });

  it('devuelve un array vacío si el total es 0', () => {
    expect(calcularAngulos([{ etiqueta: 'Ocio', valor: 0, color: '#16a97e' }])).toEqual([]);
  });

  it('con tres porciones desiguales, los ángulos son consecutivos y suman 360', () => {
    const resultado = calcularAngulos([
      { etiqueta: 'A', valor: 25, color: '#111' },
      { etiqueta: 'B', valor: 25, color: '#222' },
      { etiqueta: 'C', valor: 50, color: '#333' },
    ]);

    expect(resultado[0].anguloInicio).toBe(0);
    expect(resultado[2].anguloFin).toBe(360);
    expect(resultado[1].anguloInicio).toBe(resultado[0].anguloFin);
    expect(resultado[2].anguloInicio).toBe(resultado[1].anguloFin);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- pie-chart-math`
Expected: FAIL — "Cannot find module '../pie-chart-math'".

- [ ] **Step 3: Implementar la matemática del gráfico**

Crear `src/components/pie-chart-math.ts`:

```typescript
export interface Porcion {
  etiqueta: string;
  valor: number;
  color: string;
}

export interface PorcionConAngulo {
  etiqueta: string;
  color: string;
  porcentaje: number;
  anguloInicio: number;
  anguloFin: number;
}

/** Convierte un listado de porciones (con su valor absoluto) en ángulos de 0 a 360. */
export function calcularAngulos(porciones: Porcion[]): PorcionConAngulo[] {
  const total = porciones.reduce((acc, p) => acc + p.valor, 0);
  if (total <= 0) return [];

  let anguloActual = 0;
  const resultado: PorcionConAngulo[] = [];

  for (const porcion of porciones) {
    if (porcion.valor <= 0) continue;
    const porcentaje = (porcion.valor / total) * 100;
    const anguloInicio = anguloActual;
    const anguloFin = anguloActual + (porcion.valor / total) * 360;
    resultado.push({ etiqueta: porcion.etiqueta, color: porcion.color, porcentaje, anguloInicio, anguloFin });
    anguloActual = anguloFin;
  }

  return resultado;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- pie-chart-math`
Expected: PASS.

- [ ] **Step 5: Implementar el componente visual `PieChart`**

Crear `src/components/pie-chart.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { calcularAngulos, type Porcion } from './pie-chart-math';
import { colors } from '../theme/colors';

function puntoEnCirculo(cx: number, cy: number, radio: number, anguloGrados: number) {
  const anguloRad = ((anguloGrados - 90) * Math.PI) / 180;
  return { x: cx + radio * Math.cos(anguloRad), y: cy + radio * Math.sin(anguloRad) };
}

function pathDePorcion(cx: number, cy: number, radio: number, inicio: number, fin: number): string {
  const p1 = puntoEnCirculo(cx, cy, radio, inicio);
  const p2 = puntoEnCirculo(cx, cy, radio, fin);
  const arcoGrande = fin - inicio > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${radio} ${radio} 0 ${arcoGrande} 1 ${p2.x} ${p2.y} Z`;
}

export function PieChart({ porciones, size = 200 }: { porciones: Porcion[]; size?: number }) {
  const radio = size / 2;
  const conAngulos = calcularAngulos(porciones);

  if (conAngulos.length === 0) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <Circle cx={radio} cy={radio} r={radio - 2} fill={colors.surface2} stroke={colors.border} strokeWidth={2} />
        </Svg>
      </View>
    );
  }

  return (
    <Svg width={size} height={size}>
      {conAngulos.map((p) => (
        <Path key={p.etiqueta} d={pathDePorcion(radio, radio, radio - 2, p.anguloInicio, p.anguloFin)} fill={p.color} />
      ))}
    </Svg>
  );
}
```

- [ ] **Step 6: Implementar `MoneyText`**

Crear `src/components/money-text.tsx`:

```tsx
import React from 'react';
import { Text, type TextStyle } from 'react-native';
import { formatCentavos, formatUsd, centavosArsToUsd } from '../domain/money';
import { colors } from '../theme/colors';

interface MoneyTextProps {
  centavos: number;
  moneda: 'ARS' | 'USD';
  /** Cotización de venta a usar si moneda es 'USD'. Requerida en ese caso. */
  cotizacion?: number;
  style?: TextStyle;
}

/** Muestra un monto en centavos de ARS, opcionalmente convertido a USD para visualización. */
export function MoneyText({ centavos, moneda, cotizacion, style }: MoneyTextProps) {
  const texto =
    moneda === 'ARS' ? formatCentavos(centavos) : formatUsd(centavosArsToUsd(centavos, cotizacion ?? 0));

  return <Text style={[{ color: colors.text1, fontVariant: ['tabular-nums'] }, style]}>{texto}</Text>;
}
```

- [ ] **Step 7: Implementar `SectorProgress`**

Crear `src/components/sector-progress.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCentavos } from '../domain/money';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface SectorProgressProps {
  nombre: string;
  color: string;
  gastado: number;
  /** Límite mensual en centavos. null = sector sin tope, se muestra solo el gasto. */
  limite: number | null;
}

export function SectorProgress({ nombre, color, gastado, limite }: SectorProgressProps) {
  const porcentaje = limite && limite > 0 ? Math.min(100, (gastado / limite) * 100) : 0;
  const sobrepasado = limite !== null && gastado > limite;

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.filaTitulo}>
        <View style={[estilos.punto, { backgroundColor: color }]} />
        <Text style={estilos.nombre}>{nombre}</Text>
        <Text style={estilos.monto}>
          {formatCentavos(gastado)}
          {limite !== null ? ` / ${formatCentavos(limite)}` : ''}
        </Text>
      </View>
      {limite !== null && (
        <View style={estilos.barraFondo}>
          <View
            style={[
              estilos.barraRelleno,
              { width: `${porcentaje}%`, backgroundColor: sobrepasado ? colors.red : color },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { marginBottom: spacing.md },
  filaTitulo: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  punto: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.xs },
  nombre: { flex: 1, color: colors.text1, fontWeight: '600' },
  monto: { color: colors.text3, fontSize: 13 },
  barraFondo: { height: 6, borderRadius: 3, backgroundColor: colors.surface2, overflow: 'hidden' },
  barraRelleno: { height: '100%', borderRadius: 3 },
});
```

- [ ] **Step 8: Commit**

```bash
git add src/components
git commit -m "agrega componentes compartidos: MoneyText, PieChart y SectorProgress"
```

---

## Task 11: Contexto de la app, sesión de Firebase y candado de PIN

**Files:**
- Create: `src/app-context.tsx`, `src/app-context/__tests__/pin-gate.test.tsx`, `app/_layout.tsx`, `app/pin.tsx`

**Interfaces:**
- Consumes: `crearRepos` (Task 7), `getFirebaseAuth` (Task 5), `hashPin`/`verificarPin`/`pinEsValido` (Task 8)
- Produces:
  - `function AppProvider(props: { children: React.ReactNode }): JSX.Element` — inicia sesión anónima de Firebase Auth una sola vez, crea los repos, y expone todo vía contexto.
  - `function useApp(): { repos: Repos; uid: string }` — hook para consumir desde cualquier pantalla.
  - `function usePinGate(): { desbloqueado: boolean; pinGuardado: string | null; intentarDesbloquear(pin: string): Promise<boolean>; guardarPin(pin: string): Promise<void> }` — lógica pura de la pantalla de PIN, separada de la UI para poder testearla sin renderizar.

Nota de diseño: como es un único usuario sin registro público, se usa `signInAnonymously()` de Firebase Auth para obtener un `uid` estable y así poder aplicar reglas de seguridad por usuario — no hace falta pantalla de login con email real. El PIN es la barrera de acceso real de cara a la persona usuaria.

- [ ] **Step 1: Escribir los tests de `usePinGate` (lógica, sin renderizar componentes)**

Crear `src/app-context/__tests__/pin-gate.test.tsx`:

```typescript
import { renderHook, act } from '@testing-library/react-native';
import { usePinGate } from '../pin-gate';
import { hashPin } from '../../auth/pin';

describe('usePinGate', () => {
  it('arranca bloqueado', () => {
    const { result } = renderHook(() => usePinGate({ pinHashGuardado: null, guardarHash: jest.fn() }));
    expect(result.current.desbloqueado).toBe(false);
  });

  it('si no hay PIN guardado, cualquier guardarPin lo registra y desbloquea', async () => {
    const guardarHash = jest.fn();
    const { result } = renderHook(() => usePinGate({ pinHashGuardado: null, guardarHash }));

    await act(async () => {
      await result.current.guardarPin('1234');
    });

    expect(guardarHash).toHaveBeenCalled();
    expect(result.current.desbloqueado).toBe(true);
  });

  it('con PIN guardado, intentarDesbloquear con el PIN correcto desbloquea', async () => {
    const hash = await hashPin('4269');
    const { result } = renderHook(() => usePinGate({ pinHashGuardado: hash, guardarHash: jest.fn() }));

    let ok = false;
    await act(async () => {
      ok = await result.current.intentarDesbloquear('4269');
    });

    expect(ok).toBe(true);
    expect(result.current.desbloqueado).toBe(true);
  });

  it('con PIN incorrecto, no desbloquea', async () => {
    const hash = await hashPin('4269');
    const { result } = renderHook(() => usePinGate({ pinHashGuardado: hash, guardarHash: jest.fn() }));

    let ok = true;
    await act(async () => {
      ok = await result.current.intentarDesbloquear('0000');
    });

    expect(ok).toBe(false);
    expect(result.current.desbloqueado).toBe(false);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- pin-gate`
Expected: FAIL — "Cannot find module '../pin-gate'".

- [ ] **Step 3: Implementar `usePinGate`**

Crear `src/app-context/pin-gate.ts`:

```typescript
import { useState } from 'react';
import { hashPin, verificarPin } from '../auth/pin';

interface ParametrosPinGate {
  pinHashGuardado: string | null;
  guardarHash: (hash: string) => void | Promise<void>;
}

export function usePinGate({ pinHashGuardado, guardarHash }: ParametrosPinGate) {
  const [desbloqueado, setDesbloqueado] = useState(false);

  async function intentarDesbloquear(pin: string): Promise<boolean> {
    if (!pinHashGuardado) return false;
    const ok = await verificarPin(pin, pinHashGuardado);
    if (ok) setDesbloqueado(true);
    return ok;
  }

  async function guardarPin(pin: string): Promise<void> {
    const hash = await hashPin(pin);
    await guardarHash(hash);
    setDesbloqueado(true);
  }

  return { desbloqueado, pinGuardado: pinHashGuardado, intentarDesbloquear, guardarPin };
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- pin-gate`
Expected: PASS.

- [ ] **Step 5: Implementar el contexto de la app**

Crear `src/app-context.tsx`:

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from './firebase/app';
import { crearRepos, type Repos } from './repos/create-repo';

interface AppContextValue {
  repos: Repos;
  uid: string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const desuscribir = onAuthStateChanged(auth, (usuario) => {
      if (usuario) {
        setUid(usuario.uid);
      } else {
        signInAnonymously(auth).catch((error) => {
          console.error('No se pudo iniciar sesión anónima en Firebase:', error);
        });
      }
    });
    return desuscribir;
  }, []);

  if (!uid) return null; // la Task 17 agrega un splash mientras esto resuelve

  const repos = crearRepos(uid);

  return <AppContext.Provider value={{ repos, uid }}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const valor = useContext(AppContext);
  if (!valor) throw new Error('useApp() debe usarse dentro de <AppProvider>');
  return valor;
}
```

- [ ] **Step 6: Implementar el layout raíz con el candado de PIN**

Crear `app/_layout.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AppProvider, useApp } from '../src/app-context';
import { usePinGate } from '../src/app-context/pin-gate';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirestoreDb } from '../src/firebase/app';

function CandadoDePin({ children }: { children: React.ReactNode }) {
  const { uid } = useApp();
  const [pinHashGuardado, setPinHashGuardado] = useState<string | null | undefined>(undefined);
  const router = useRouter();
  const segmentos = useSegments();

  useEffect(() => {
    const ref = doc(getFirestoreDb(), 'users', uid, 'settings', 'preferences');
    getDoc(ref).then((snap) => {
      setPinHashGuardado(snap.exists() ? (snap.data().pinHash as string) ?? null : null);
    });
  }, [uid]);

  const gate = usePinGate({
    pinHashGuardado: pinHashGuardado ?? null,
    guardarHash: async (hash) => {
      const ref = doc(getFirestoreDb(), 'users', uid, 'settings', 'preferences');
      await setDoc(ref, { pinHash: hash }, { merge: true });
    },
  });

  useEffect(() => {
    if (pinHashGuardado === undefined) return; // todavía cargando
    const enPantallaDePin = segmentos[0] === 'pin';
    if (!gate.desbloqueado && !enPantallaDePin) {
      router.replace('/pin');
    } else if (gate.desbloqueado && enPantallaDePin) {
      router.replace('/');
    }
  }, [gate.desbloqueado, pinHashGuardado, segmentos]);

  if (pinHashGuardado === undefined) return null;

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AppProvider>
      <CandadoDePin>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pin" />
          <Stack.Screen name="gasto-nuevo" options={{ presentation: 'modal', headerShown: true, title: 'Nuevo gasto' }} />
          <Stack.Screen name="config" options={{ headerShown: true, title: 'Configuración' }} />
        </Stack>
      </CandadoDePin>
    </AppProvider>
  );
}
```

Nota: `usePinGate` vive dentro de `CandadoDePin`, que está dentro de `AppProvider`, así que puede usar `useApp()` — el hook de PIN en sí no depende de Firebase, solo el `guardarHash` que le pasamos lo conecta a Firestore.

- [ ] **Step 7: Implementar la pantalla de PIN**

Crear `app/pin.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useApp } from '../src/app-context';
import { usePinGate } from '../src/app-context/pin-gate';
import { getFirestoreDb } from '../src/firebase/app';
import { pinEsValido } from '../src/auth/pin';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';

export default function PantallaPin() {
  const { uid } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pinExistente, setPinExistente] = useState<string | null | undefined>(undefined);

  React.useEffect(() => {
    const ref = doc(getFirestoreDb(), 'users', uid, 'settings', 'preferences');
    getDoc(ref).then((snap) => setPinExistente(snap.exists() ? (snap.data().pinHash as string) ?? null : null));
  }, [uid]);

  const gate = usePinGate({
    pinHashGuardado: pinExistente ?? null,
    guardarHash: async (hash) => {
      const ref = doc(getFirestoreDb(), 'users', uid, 'settings', 'preferences');
      await setDoc(ref, { pinHash: hash }, { merge: true });
    },
  });

  async function confirmar() {
    if (!pinEsValido(pin)) {
      setError('El PIN tiene que ser de 4 dígitos');
      return;
    }
    if (pinExistente) {
      const ok = await gate.intentarDesbloquear(pin);
      setError(ok ? null : 'PIN incorrecto');
    } else {
      await gate.guardarPin(pin);
    }
    setPin('');
  }

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo}>{pinExistente ? 'Ingresá tu PIN' : 'Creá un PIN de 4 dígitos'}</Text>
      <TextInput
        value={pin}
        onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        style={estilos.input}
        autoFocus
      />
      {error && <Text style={estilos.error}>{error}</Text>}
      <Pressable style={estilos.boton} onPress={confirmar}>
        <Text style={estilos.textoBoton}>{pinExistente ? 'Entrar' : 'Guardar PIN'}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: spacing.lg },
  titulo: { fontSize: 20, fontWeight: '700', color: colors.text1, marginBottom: spacing.lg },
  input: {
    fontSize: 32,
    letterSpacing: 16,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    width: 160,
    marginBottom: spacing.md,
  },
  error: { color: colors.red, marginBottom: spacing.md },
  boton: { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 8 },
  textoBoton: { color: colors.surface, fontWeight: '600' },
});
```

- [ ] **Step 8: Commit**

```bash
git add src/app-context.tsx src/app-context app/_layout.tsx app/pin.tsx
git commit -m "agrega sesión de Firebase, contexto de repos y candado de PIN"
```

---

## Task 12: Hooks de datos reactivos

**Files:**
- Create: `src/hooks/use-collection.ts`, `src/hooks/__tests__/use-collection.test.tsx`, `src/hooks/use-mes-actual.ts`, `src/hooks/use-resumen-mes.ts`, `src/hooks/use-cotizacion-actual.ts`

**Interfaces:**
- Consumes: `useApp()` (Task 11), los cuatro repos (Task 7), `calcularResumenMes` (Task 3), `obtenerCotizacionConCache`/`rateCacheStorage` (Task 4)
- Produces:
  - `function useCollection<T>(params: { listar(): Promise<T[]>; suscribir(cb: (v: T[]) => void): () => void }): T[]` — patrón genérico: carga inicial + se re-suscribe a cambios.
  - `function useGastos(): Expense[]`, `function useSectores(): Sector[]`, `function usePresupuestos(): Budget[]`, `function useAhorros(): SavingMovement[]`
  - `function useMesActual(): { mes: MonthKey; irAMesAnterior(): void; irAMesSiguiente(): void; irAHoy(): void }`
  - `function useResumenMes(mes: MonthKey): ResumenMes`
  - `function useCotizacionActual(casa: RateKind): Cotizacion | null`

- [ ] **Step 1: Escribir el test del hook genérico `useCollection`**

Crear `src/hooks/__tests__/use-collection.test.tsx`:

```typescript
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useCollection } from '../use-collection';

describe('useCollection', () => {
  it('carga la lista inicial con listar()', async () => {
    const listar = jest.fn().mockResolvedValue([{ id: 'a' }]);
    const suscribir = jest.fn().mockReturnValue(() => {});

    const { result } = renderHook(() => useCollection({ listar, suscribir }));

    await waitFor(() => expect(result.current).toEqual([{ id: 'a' }]));
  });

  it('actualiza cuando suscribir() llama al callback', async () => {
    let callbackGuardado: ((v: unknown[]) => void) | null = null;
    const listar = jest.fn().mockResolvedValue([]);
    const suscribir = jest.fn((cb) => {
      callbackGuardado = cb;
      return () => {};
    });

    const { result } = renderHook(() => useCollection({ listar, suscribir }));
    await waitFor(() => expect(listar).toHaveBeenCalled());

    act(() => {
      callbackGuardado?.([{ id: 'b' }]);
    });

    await waitFor(() => expect(result.current).toEqual([{ id: 'b' }]));
  });

  it('se desuscribe al desmontar', () => {
    const desuscribir = jest.fn();
    const listar = jest.fn().mockResolvedValue([]);
    const suscribir = jest.fn().mockReturnValue(desuscribir);

    const { unmount } = renderHook(() => useCollection({ listar, suscribir }));
    unmount();

    expect(desuscribir).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- use-collection`
Expected: FAIL — "Cannot find module '../use-collection'".

- [ ] **Step 3: Implementar `useCollection`**

Crear `src/hooks/use-collection.ts`:

```typescript
import { useEffect, useState } from 'react';

interface ParametrosUseCollection<T> {
  listar(): Promise<T[]>;
  suscribir(cb: (valores: T[]) => void): () => void;
}

/** Patrón genérico: carga la lista inicial desde el repo y se re-suscribe a cambios en tiempo real. */
export function useCollection<T>({ listar, suscribir }: ParametrosUseCollection<T>): T[] {
  const [valores, setValores] = useState<T[]>([]);

  useEffect(() => {
    let vigente = true;
    listar().then((v) => {
      if (vigente) setValores(v);
    });
    const desuscribir = suscribir((v) => setValores(v));
    return () => {
      vigente = false;
      desuscribir();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return valores;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- use-collection`
Expected: PASS.

- [ ] **Step 5: Implementar los hooks de cada colección**

Crear `src/hooks/use-datos.ts`:

```typescript
import { useApp } from '../app-context';
import { useCollection } from './use-collection';
import type { Expense, Sector, Budget, SavingMovement } from '../domain/types';

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
```

- [ ] **Step 6: Implementar `useMesActual`**

Crear `src/hooks/use-mes-actual.ts`:

```typescript
import { useState } from 'react';
import { mesAnterior, siguienteMes } from '../domain/budget';
import type { MonthKey } from '../domain/types';

function mesDeHoy(): MonthKey {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
}

export function useMesActual() {
  const [mes, setMes] = useState<MonthKey>(mesDeHoy());

  return {
    mes,
    irAMesAnterior: () => setMes((m) => mesAnterior(m)),
    irAMesSiguiente: () => setMes((m) => siguienteMes(m)),
    irAHoy: () => setMes(mesDeHoy()),
  };
}
```

- [ ] **Step 7: Implementar `useResumenMes`**

Crear `src/hooks/use-resumen-mes.ts`:

```typescript
import { useMemo } from 'react';
import { calcularResumenMes, type ResumenMes } from '../domain/budget';
import { useGastos, usePresupuestos, useAhorros } from './use-datos';
import type { MonthKey } from '../domain/types';

export function useResumenMes(mes: MonthKey): ResumenMes {
  const gastos = useGastos();
  const presupuestos = usePresupuestos();
  const ahorros = useAhorros();

  return useMemo(
    () => calcularResumenMes({ mes, presupuestos, gastos, ahorros }),
    [mes, presupuestos, gastos, ahorros]
  );
}
```

- [ ] **Step 8: Implementar `useCotizacionActual`**

Crear `src/hooks/use-cotizacion-actual.ts`:

```typescript
import { useEffect, useState } from 'react';
import { obtenerCotizacionConCache, type Cotizacion } from '../rates/dolar';
import { rateCacheStorage } from '../rates/rate-cache-storage';
import type { RateKind } from '../domain/types';

export function useCotizacionActual(casa: RateKind): Cotizacion | null {
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerCotizacionConCache(casa, rateCacheStorage)
      .then((c) => {
        if (vigente) setCotizacion(c);
      })
      .catch((error) => {
        console.warn('No se pudo obtener la cotización y no hay cache:', error);
      });
    return () => {
      vigente = false;
    };
  }, [casa]);

  return cotizacion;
}
```

- [ ] **Step 9: Commit**

```bash
git add src/hooks
git commit -m "agrega hooks reactivos de datos, mes actual, resumen y cotización"
```

---

## Task 13: Navegación por tabs y pantalla Home

**Files:**
- Create: `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `src/preferences/use-preferences.ts`

**Interfaces:**
- Consumes: `useResumenMes`, `useSectores`, `useGastos`, `useCotizacionActual` (Task 12), `PieChart`, `SectorProgress`, `MoneyText` (Task 10), `gastadoPorSector`, `SIN_SECTOR` (Task 3)
- Produces:
  - `function usePreferences(): { monedaVisualizacion: 'ARS' | 'USD'; cotizacionPreferida: RateKind; setMonedaVisualizacion(m: 'ARS' | 'USD'): void; setCotizacionPreferida(c: RateKind): void }` — preferencias guardadas en `settings/preferences` de Firestore, con default local mientras carga.
  - Pantalla Home montada en `app/(tabs)/index.tsx`.

- [ ] **Step 1: Implementar `usePreferences`**

Crear `src/preferences/use-preferences.ts`:

```typescript
import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useApp } from '../app-context';
import { getFirestoreDb } from '../firebase/app';
import type { RateKind } from '../domain/types';

interface Preferencias {
  monedaVisualizacion: 'ARS' | 'USD';
  cotizacionPreferida: RateKind;
}

const DEFAULT: Preferencias = { monedaVisualizacion: 'ARS', cotizacionPreferida: 'oficial' };

export function usePreferences() {
  const { uid } = useApp();
  const [preferencias, setPreferencias] = useState<Preferencias>(DEFAULT);

  useEffect(() => {
    const ref = doc(getFirestoreDb(), 'users', uid, 'settings', 'preferences');
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const datos = snap.data();
      setPreferencias({
        monedaVisualizacion: (datos.monedaVisualizacion as Preferencias['monedaVisualizacion']) ?? DEFAULT.monedaVisualizacion,
        cotizacionPreferida: (datos.cotizacionPreferida as RateKind) ?? DEFAULT.cotizacionPreferida,
      });
    });
  }, [uid]);

  async function actualizar(parcial: Partial<Preferencias>) {
    const ref = doc(getFirestoreDb(), 'users', uid, 'settings', 'preferences');
    await setDoc(ref, parcial, { merge: true });
  }

  return {
    ...preferencias,
    setMonedaVisualizacion: (m: Preferencias['monedaVisualizacion']) => actualizar({ monedaVisualizacion: m }),
    setCotizacionPreferida: (c: RateKind) => actualizar({ cotizacionPreferida: c }),
  };
}
```

- [ ] **Step 2: Implementar el layout de tabs**

Crear `app/(tabs)/_layout.tsx`:

```tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { colors } from '../../src/theme/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text3,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text1,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="historial" options={{ title: 'Historial' }} />
      <Tabs.Screen name="sectores" options={{ title: 'Sectores' }} />
      <Tabs.Screen name="ahorro" options={{ title: 'Ahorro' }} />
    </Tabs>
  );
}
```

- [ ] **Step 3: Implementar la pantalla Home**

Crear `app/(tabs)/index.tsx`:

```tsx
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useMesActual } from '../../src/hooks/use-mes-actual';
import { useResumenMes } from '../../src/hooks/use-resumen-mes';
import { useSectores } from '../../src/hooks/use-datos';
import { useGastos } from '../../src/hooks/use-datos';
import { useCotizacionActual } from '../../src/hooks/use-cotizacion-actual';
import { usePreferences } from '../../src/preferences/use-preferences';
import { gastadoPorSector, SIN_SECTOR } from '../../src/domain/budget';
import { PieChart } from '../../src/components/pie-chart';
import { SectorProgress } from '../../src/components/sector-progress';
import { MoneyText } from '../../src/components/money-text';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function Home() {
  const router = useRouter();
  const { mes } = useMesActual();
  const resumen = useResumenMes(mes);
  const sectores = useSectores();
  const gastos = useGastos();
  const preferencias = usePreferences();
  const cotizacion = useCotizacionActual(preferencias.cotizacionPreferida);

  const gastoPorSector = gastadoPorSector(gastos, mes);
  const porciones = [
    ...sectores.map((s) => ({ etiqueta: s.nombre, valor: gastoPorSector.get(s.id) ?? 0, color: s.color })),
    { etiqueta: 'Sin sector', valor: gastoPorSector.get(SIN_SECTOR) ?? 0, color: colors.text4 },
  ].filter((p) => p.valor > 0);

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      <View style={estilos.filaMoneda}>
        <Pressable onPress={() => preferencias.setMonedaVisualizacion('ARS')}>
          <Text style={[estilos.toggle, preferencias.monedaVisualizacion === 'ARS' && estilos.toggleActivo]}>ARS</Text>
        </Pressable>
        <Pressable onPress={() => preferencias.setMonedaVisualizacion('USD')}>
          <Text style={[estilos.toggle, preferencias.monedaVisualizacion === 'USD' && estilos.toggleActivo]}>USD</Text>
        </Pressable>
      </View>

      <View style={estilos.tarjetaResumen}>
        <Text style={estilos.etiqueta}>Disponible este mes</Text>
        <MoneyText
          centavos={resumen.disponible}
          moneda={preferencias.monedaVisualizacion}
          cotizacion={cotizacion?.venta}
          style={estilos.montoGrande}
        />
        <View style={estilos.filaDetalle}>
          <Text style={estilos.detalle}>
            Presupuesto: <MoneyText centavos={resumen.presupuestoDelMes} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} />
          </Text>
          <Text style={estilos.detalle}>
            Gastado: <MoneyText centavos={resumen.gastado} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} />
          </Text>
        </View>
        {resumen.acumuladoPrevio > 0 && (
          <Pressable style={estilos.chipAcumulado} onPress={() => router.push('/(tabs)/ahorro')}>
            <Text style={estilos.textoChip}>
              +<MoneyText centavos={resumen.acumuladoPrevio} moneda="ARS" style={estilos.textoChip} /> de meses anteriores
            </Text>
          </Pressable>
        )}
      </View>

      {porciones.length > 0 && (
        <View style={estilos.centrado}>
          <PieChart porciones={porciones} size={220} />
        </View>
      )}

      <View style={estilos.seccion}>
        {sectores.map((s) => (
          <SectorProgress key={s.id} nombre={s.nombre} color={s.color} gastado={gastoPorSector.get(s.id) ?? 0} limite={s.limiteMensual} />
        ))}
      </View>

      <Pressable style={estilos.botonFlotante} onPress={() => router.push('/gasto-nuevo')}>
        <Text style={estilos.textoBotonFlotante}>+</Text>
      </Pressable>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
  filaMoneda: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm },
  toggle: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, color: colors.text3, fontWeight: '600' },
  toggleActivo: { color: colors.primary, textDecorationLine: 'underline' },
  tarjetaResumen: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md },
  etiqueta: { color: colors.text3, marginBottom: spacing.xs },
  montoGrande: { fontSize: 32, fontWeight: '700' },
  filaDetalle: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  detalle: { color: colors.text2 },
  chipAcumulado: { marginTop: spacing.sm, backgroundColor: colors.primaryLight, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
  textoChip: { color: colors.primaryDark, fontWeight: '600' },
  centrado: { alignItems: 'center', marginBottom: spacing.md },
  seccion: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg },
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

- [ ] **Step 4: Verificar que la app arranca sin errores**

Run: `npx expo start --web`
Expected: la Home carga sin errores en consola (sectores y gastos vacíos al principio, ya que todavía no hay datos de prueba — eso se verifica manualmente recién en la Task 21 con el proyecto Firebase real conectado).

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\) src/preferences
git commit -m "agrega navegación por tabs y pantalla Home"
```

---

## Task 14: Pantalla de cargar gasto

**Files:**
- Create: `app/gasto-nuevo.tsx`

**Interfaces:**
- Consumes: `parseAmountToCentavos` (Task 2), `useApp` (Task 11), `useSectores` (Task 12), `Expense`, `PaymentMethod` (Task 2)
- Produces: pantalla modal montada en `app/gasto-nuevo.tsx`, sin exports nuevos para otras pantallas.

- [ ] **Step 1: Implementar la pantalla**

Crear `app/gasto-nuevo.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../src/app-context';
import { useSectores } from '../src/hooks/use-datos';
import { parseAmountToCentavos } from '../src/domain/money';
import type { PaymentMethod } from '../src/domain/types';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';

const METODOS: { valor: PaymentMethod; etiqueta: string }[] = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'debito', etiqueta: 'Débito' },
  { valor: 'credito', etiqueta: 'Crédito' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
];

export default function GastoNuevo() {
  const router = useRouter();
  const { repos } = useApp();
  const sectores = useSectores();

  const [montoTexto, setMontoTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [lugar, setLugar] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [metodoPago, setMetodoPago] = useState<PaymentMethod | null>(null);
  const [mostrarOpcionales, setMostrarOpcionales] = useState(false);
  const [guardando, setGuardando] = useState(false);

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
        metodoPago,
      });
      router.back();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      <TextInput
        value={montoTexto}
        onChangeText={(t) => {
          setMontoTexto(t);
          setError(null);
        }}
        placeholder="0,00"
        keyboardType="decimal-pad"
        style={estilos.inputMonto}
        autoFocus
      />
      {error && <Text style={estilos.error}>{error}</Text>}

      <Pressable onPress={() => setMostrarOpcionales((v) => !v)}>
        <Text style={estilos.linkOpcionales}>{mostrarOpcionales ? 'Ocultar detalles' : 'Agregar detalles (opcional)'}</Text>
      </Pressable>

      {mostrarOpcionales && (
        <View style={estilos.opcionales}>
          <Text style={estilos.etiquetaCampo}>Sector</Text>
          <View style={estilos.filaChips}>
            {sectores.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setSectorId(sectorId === s.id ? null : s.id)}
                style={[estilos.chip, { borderColor: s.color }, sectorId === s.id && { backgroundColor: s.color }]}
              >
                <Text style={[estilos.textoChip, sectorId === s.id && { color: colors.surface }]}>{s.nombre}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={estilos.etiquetaCampo}>Lugar</Text>
          <TextInput value={lugar} onChangeText={setLugar} style={estilos.inputTexto} placeholder="Ej: Supermercado" />

          <Text style={estilos.etiquetaCampo}>Descripción</Text>
          <TextInput value={descripcion} onChangeText={setDescripcion} style={estilos.inputTexto} placeholder="Ej: Compra del mes" />

          <Text style={estilos.etiquetaCampo}>Método de pago</Text>
          <View style={estilos.filaChips}>
            {METODOS.map((m) => (
              <Pressable
                key={m.valor}
                onPress={() => setMetodoPago(metodoPago === m.valor ? null : m.valor)}
                style={[estilos.chip, { borderColor: colors.border }, metodoPago === m.valor && { backgroundColor: colors.primary }]}
              >
                <Text style={[estilos.textoChip, metodoPago === m.valor && { color: colors.surface }]}>{m.etiqueta}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Pressable style={estilos.botonGuardar} onPress={guardar} disabled={guardando}>
        <Text style={estilos.textoBotonGuardar}>{guardando ? 'Guardando...' : 'Guardar gasto'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: spacing.lg },
  inputMonto: { fontSize: 40, fontWeight: '700', color: colors.text1, textAlign: 'center', marginBottom: spacing.sm },
  error: { color: colors.red, textAlign: 'center', marginBottom: spacing.sm },
  linkOpcionales: { color: colors.primary, textAlign: 'center', marginBottom: spacing.md, fontWeight: '600' },
  opcionales: { marginBottom: spacing.lg },
  etiquetaCampo: { color: colors.text2, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
  filaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  textoChip: { color: colors.text2 },
  inputTexto: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: colors.surface },
  botonGuardar: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.md, alignItems: 'center' },
  textoBotonGuardar: { color: colors.surface, fontWeight: '700', fontSize: 16 },
});
```

- [ ] **Step 2: Verificar manualmente el flujo**

Run: `npx expo start --web`, abrir la Home, tocar el botón "+", cargar un monto (ej: `1500,50`) y guardar.
Expected: vuelve a la Home y el monto gastado del resumen sube en `$ 1.500,50`.

- [ ] **Step 3: Commit**

```bash
git add app/gasto-nuevo.tsx
git commit -m "agrega pantalla de carga rápida de gastos"
```

---

## Task 15: Pantalla de Sectores

**Files:**
- Create: `app/(tabs)/sectores.tsx`

**Interfaces:**
- Consumes: `useSectores` (Task 12), `useApp` (Task 11), `sectorPalette` (Task 9), `parseAmountToCentavos`/`formatCentavos` (Task 2)
- Produces: pantalla montada en `app/(tabs)/sectores.tsx`.

- [ ] **Step 1: Implementar la pantalla**

Crear `app/(tabs)/sectores.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useApp } from '../../src/app-context';
import { useSectores } from '../../src/hooks/use-datos';
import { sectorPalette } from '../../src/theme/colors';
import { parseAmountToCentavos, formatCentavos } from '../../src/domain/money';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import type { Sector } from '../../src/domain/types';

export default function Sectores() {
  const { repos } = useApp();
  const sectores = useSectores();

  const [nombre, setNombre] = useState('');
  const [limiteTexto, setLimiteTexto] = useState('');

  async function agregarSector() {
    if (!nombre.trim()) return;
    const color = sectorPalette[sectores.length % sectorPalette.length];
    const limiteMensual = limiteTexto.trim() ? parseAmountToCentavos(limiteTexto) : null;
    await repos.sectors.guardar({ nombre: nombre.trim(), color, limiteMensual });
    setNombre('');
    setLimiteTexto('');
  }

  async function eliminarSector(id: string) {
    await repos.sectors.eliminar(id);
  }

  function renderSector({ item }: { item: Sector }) {
    return (
      <View style={estilos.fila}>
        <View style={[estilos.punto, { backgroundColor: item.color }]} />
        <View style={estilos.info}>
          <Text style={estilos.nombreSector}>{item.nombre}</Text>
          <Text style={estilos.limiteSector}>
            {item.limiteMensual !== null ? `Límite: ${formatCentavos(item.limiteMensual)}` : 'Sin límite'}
          </Text>
        </View>
        <Pressable onPress={() => eliminarSector(item.id)}>
          <Text style={estilos.eliminar}>Borrar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={estilos.contenedor}>
      <FlatList
        data={sectores}
        keyExtractor={(s) => s.id}
        renderItem={renderSector}
        contentContainerStyle={estilos.lista}
        ListEmptyComponent={<Text style={estilos.vacio}>Todavía no cargaste sectores.</Text>}
      />

      <View style={estilos.formulario}>
        <TextInput value={nombre} onChangeText={setNombre} placeholder="Nombre (ej: Ocio)" style={estilos.input} />
        <TextInput
          value={limiteTexto}
          onChangeText={setLimiteTexto}
          placeholder="Límite mensual (opcional)"
          keyboardType="decimal-pad"
          style={estilos.input}
        />
        <Pressable style={estilos.boton} onPress={agregarSector}>
          <Text style={estilos.textoBoton}>Agregar sector</Text>
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.bg },
  lista: { padding: spacing.md },
  vacio: { color: colors.text3, textAlign: 'center', marginTop: spacing.lg },
  fila: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.xs },
  punto: { width: 14, height: 14, borderRadius: 7, marginRight: spacing.sm },
  info: { flex: 1 },
  nombreSector: { color: colors.text1, fontWeight: '600' },
  limiteSector: { color: colors.text3, fontSize: 12 },
  eliminar: { color: colors.red },
  formulario: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm },
  boton: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
  textoBoton: { color: colors.surface, fontWeight: '700' },
});
```

- [ ] **Step 2: Verificar manualmente**

Run: `npx expo start --web`, ir a la tab Sectores, crear "Ocio" sin límite y "Vacaciones" con límite `50000`.
Expected: aparecen en la lista con su color y el límite formateado; en Home, "Ocio" y "Vacaciones" quedan disponibles como chips al cargar un gasto.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/sectores.tsx"
git commit -m "agrega pantalla de gestión de sectores"
```

---

## Task 16: Pantalla de Historial

**Files:**
- Create: `app/(tabs)/historial.tsx`

**Interfaces:**
- Consumes: `useMesActual`, `useResumenMes`, `useSectores`, `useGastos`, `useCotizacionActual` (Task 12), `PieChart` (Task 10), `gastadoPorSector` (Task 3)
- Produces: pantalla montada en `app/(tabs)/historial.tsx`.

- [ ] **Step 1: Implementar la pantalla**

Crear `app/(tabs)/historial.tsx`:

```tsx
import React from 'react';
import { View, Text, ScrollView, Pressable, FlatList, StyleSheet } from 'react-native';
import { useMesActual } from '../../src/hooks/use-mes-actual';
import { useResumenMes } from '../../src/hooks/use-resumen-mes';
import { useSectores, useGastos } from '../../src/hooks/use-datos';
import { gastadoPorSector } from '../../src/domain/budget';
import { PieChart } from '../../src/components/pie-chart';
import { MoneyText } from '../../src/components/money-text';
import { formatCentavos } from '../../src/domain/money';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

function nombreDeMes(mesClave: string): string {
  const [anio, mesNum] = mesClave.split('-').map(Number);
  const fecha = new Date(anio, mesNum - 1, 1);
  const texto = fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function Historial() {
  const { mes, irAMesAnterior, irAMesSiguiente } = useMesActual();
  const resumen = useResumenMes(mes);
  const sectores = useSectores();
  const gastos = useGastos();

  const gastoPorSector = gastadoPorSector(gastos, mes);
  const porciones = sectores
    .map((s) => ({ etiqueta: s.nombre, valor: gastoPorSector.get(s.id) ?? 0, color: s.color }))
    .filter((p) => p.valor > 0);

  const gastosDelMes = gastos
    .filter((g) => g.fecha.slice(0, 7) === mes)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      <View style={estilos.selectorMes}>
        <Pressable onPress={irAMesAnterior}>
          <Text style={estilos.flecha}>{'‹'}</Text>
        </Pressable>
        <Text style={estilos.tituloMes}>{nombreDeMes(mes)}</Text>
        <Pressable onPress={irAMesSiguiente}>
          <Text style={estilos.flecha}>{'›'}</Text>
        </Pressable>
      </View>

      <View style={estilos.tarjetaResumen}>
        <Text style={estilos.etiqueta}>Presupuesto</Text>
        <MoneyText centavos={resumen.presupuestoDelMes} moneda="ARS" style={estilos.monto} />
        <Text style={estilos.etiqueta}>Gastado</Text>
        <MoneyText centavos={resumen.gastado} moneda="ARS" style={estilos.monto} />
      </View>

      {porciones.length > 0 && (
        <View style={estilos.centrado}>
          <PieChart porciones={porciones} size={180} />
        </View>
      )}

      <FlatList
        data={gastosDelMes}
        keyExtractor={(g) => g.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={estilos.filaGasto}>
            <View>
              <Text style={estilos.descripcionGasto}>{item.descripcion ?? item.lugar ?? 'Gasto sin descripción'}</Text>
              <Text style={estilos.fechaGasto}>{item.fecha}</Text>
            </View>
            <Text style={estilos.montoGasto}>{formatCentavos(item.centavosArs)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={estilos.vacio}>Sin gastos este mes.</Text>}
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.bg },
  contenido: { padding: spacing.md },
  selectorMes: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  flecha: { fontSize: 28, color: colors.primary, paddingHorizontal: spacing.md },
  tituloMes: { fontSize: 18, fontWeight: '700', color: colors.text1 },
  tarjetaResumen: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md },
  etiqueta: { color: colors.text3, marginTop: spacing.xs },
  monto: { fontSize: 20, fontWeight: '700' },
  centrado: { alignItems: 'center', marginBottom: spacing.md },
  filaGasto: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.xs },
  descripcionGasto: { color: colors.text1, fontWeight: '600' },
  fechaGasto: { color: colors.text3, fontSize: 12 },
  montoGasto: { color: colors.text1, fontWeight: '700' },
  vacio: { color: colors.text3, textAlign: 'center', marginTop: spacing.md },
});
```

- [ ] **Step 2: Verificar manualmente**

Run: `npx expo start --web`, ir a Historial, navegar con las flechas entre meses.
Expected: cambia el título del mes y la lista de gastos filtra correctamente por mes.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/historial.tsx"
git commit -m "agrega pantalla de historial mensual"
```

---

## Task 17: Pantalla de Ahorro

**Files:**
- Create: `app/(tabs)/ahorro.tsx`

**Interfaces:**
- Consumes: `useAhorros` (Task 12), `useResumenMes`, `useMesActual` (Task 12), `useApp` (Task 11), `parseAmountToCentavos`/`formatCentavos` (Task 2)
- Produces: pantalla montada en `app/(tabs)/ahorro.tsx`.

- [ ] **Step 1: Implementar la pantalla**

Crear `app/(tabs)/ahorro.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useApp } from '../../src/app-context';
import { useAhorros } from '../../src/hooks/use-datos';
import { useMesActual } from '../../src/hooks/use-mes-actual';
import { useResumenMes } from '../../src/hooks/use-resumen-mes';
import { parseAmountToCentavos, formatCentavos } from '../../src/domain/money';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function Ahorro() {
  const { repos } = useApp();
  const movimientos = useAhorros();
  const { mes } = useMesActual();
  const resumen = useResumenMes(mes);

  const [montoTexto, setMontoTexto] = useState('');
  const [error, setError] = useState<string | null>(null);

  const totalAhorrado = movimientos.reduce((acc, m) => acc + m.centavosArs, 0);
  const movimientosOrdenados = [...movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha));

  async function mandarAAhorro() {
    const centavos = parseAmountToCentavos(montoTexto);
    if (centavos === null || centavos <= 0) {
      setError('Ingresá un monto válido');
      return;
    }
    if (centavos > resumen.acumuladoPrevio) {
      setError(`No podés mandar más de ${formatCentavos(resumen.acumuladoPrevio)} (tu acumulado disponible)`);
      return;
    }
    await repos.savings.agregar({
      centavosArs: centavos,
      fecha: new Date().toISOString().slice(0, 10),
      nota: null,
    });
    setMontoTexto('');
    setError(null);
  }

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.tarjetaTotal}>
        <Text style={estilos.etiqueta}>Total ahorrado</Text>
        <Text style={estilos.montoGrande}>{formatCentavos(totalAhorrado)}</Text>
        <Text style={estilos.etiqueta}>Disponible para mandar a ahorro: {formatCentavos(resumen.acumuladoPrevio)}</Text>
      </View>

      <View style={estilos.formulario}>
        <TextInput
          value={montoTexto}
          onChangeText={(t) => {
            setMontoTexto(t);
            setError(null);
          }}
          placeholder="Monto a ahorrar"
          keyboardType="decimal-pad"
          style={estilos.input}
        />
        {error && <Text style={estilos.error}>{error}</Text>}
        <Pressable style={estilos.boton} onPress={mandarAAhorro}>
          <Text style={estilos.textoBoton}>Mandar a ahorro</Text>
        </Pressable>
      </View>

      <FlatList
        data={movimientosOrdenados}
        keyExtractor={(m) => m.id}
        contentContainerStyle={estilos.lista}
        renderItem={({ item }) => (
          <View style={estilos.filaMovimiento}>
            <Text style={estilos.fechaMovimiento}>{item.fecha}</Text>
            <Text style={estilos.montoMovimiento}>{formatCentavos(item.centavosArs)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={estilos.vacio}>Todavía no mandaste nada a ahorro.</Text>}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.bg },
  tarjetaTotal: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, margin: spacing.md },
  etiqueta: { color: colors.text3, marginTop: spacing.xs },
  montoGrande: { fontSize: 28, fontWeight: '700', color: colors.text1 },
  formulario: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm, backgroundColor: colors.surface },
  error: { color: colors.red, marginBottom: spacing.sm },
  boton: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
  textoBoton: { color: colors.surface, fontWeight: '700' },
  lista: { paddingHorizontal: spacing.md },
  filaMovimiento: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.xs },
  fechaMovimiento: { color: colors.text3 },
  montoMovimiento: { color: colors.primaryDark, fontWeight: '700' },
  vacio: { color: colors.text3, textAlign: 'center', marginTop: spacing.md },
});
```

- [ ] **Step 2: Verificar manualmente**

Run: `npx expo start --web`, con acumulado previo > 0 (requiere haber cargado presupuesto y gastos en dos meses distintos), mandar una parte a ahorro.
Expected: el total ahorrado sube, el movimiento aparece en la lista, y en Home el chip de acumulado baja proporcionalmente.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/ahorro.tsx"
git commit -m "agrega pantalla de ahorro"
```

---

## Task 18: Pantalla de Configuración

**Files:**
- Create: `app/config.tsx`

**Interfaces:**
- Consumes: `usePreferences` (Task 13), `useMesActual`, `usePresupuestos` (Task 12), `useApp` (Task 11), `parseAmountToCentavos`/`formatCentavos` (Task 2)
- Produces: pantalla montada en `app/config.tsx` (accesible desde el ícono de header definido en Task 11).

- [ ] **Step 1: Implementar la pantalla**

Crear `app/config.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useApp } from '../src/app-context';
import { usePreferences } from '../src/preferences/use-preferences';
import { useMesActual } from '../src/hooks/use-mes-actual';
import { usePresupuestos } from '../src/hooks/use-datos';
import { parseAmountToCentavos, formatCentavos } from '../src/domain/money';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import type { RateKind } from '../src/domain/types';

export default function Configuracion() {
  const { repos } = useApp();
  const preferencias = usePreferences();
  const { mes } = useMesActual();
  const presupuestos = usePresupuestos();

  const presupuestoActual = presupuestos.find((p) => p.mes === mes)?.totalCentavos ?? 0;
  const [presupuestoTexto, setPresupuestoTexto] = useState(
    presupuestoActual > 0 ? String(presupuestoActual / 100).replace('.', ',') : ''
  );
  const [error, setError] = useState<string | null>(null);

  async function guardarPresupuesto() {
    const centavos = parseAmountToCentavos(presupuestoTexto);
    if (centavos === null) {
      setError('Ingresá un monto válido');
      return;
    }
    await repos.budgets.guardar({ mes, totalCentavos: centavos });
    setError(null);
  }

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.seccionTitulo}>Presupuesto del mes actual</Text>
      <TextInput
        value={presupuestoTexto}
        onChangeText={(t) => {
          setPresupuestoTexto(t);
          setError(null);
        }}
        keyboardType="decimal-pad"
        style={estilos.input}
        placeholder="Ej: 150000"
      />
      {error && <Text style={estilos.error}>{error}</Text>}
      <Pressable style={estilos.boton} onPress={guardarPresupuesto}>
        <Text style={estilos.textoBoton}>Guardar presupuesto</Text>
      </Pressable>
      {presupuestoActual > 0 && (
        <Text style={estilos.actual}>Actual: {formatCentavos(presupuestoActual)}</Text>
      )}

      <Text style={estilos.seccionTitulo}>Cotización preferida</Text>
      <View style={estilos.filaOpciones}>
        {(['oficial', 'blue'] as RateKind[]).map((c) => (
          <Pressable
            key={c}
            onPress={() => preferencias.setCotizacionPreferida(c)}
            style={[estilos.opcion, preferencias.cotizacionPreferida === c && estilos.opcionActiva]}
          >
            <Text style={[estilos.textoOpcion, preferencias.cotizacionPreferida === c && estilos.textoOpcionActiva]}>
              {c === 'oficial' ? 'Oficial' : 'Blue'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={estilos.seccionTitulo}>Moneda de visualización por defecto</Text>
      <View style={estilos.filaOpciones}>
        {(['ARS', 'USD'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => preferencias.setMonedaVisualizacion(m)}
            style={[estilos.opcion, preferencias.monedaVisualizacion === m && estilos.opcionActiva]}
          >
            <Text style={[estilos.textoOpcion, preferencias.monedaVisualizacion === m && estilos.textoOpcionActiva]}>{m}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  seccionTitulo: { color: colors.text2, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, backgroundColor: colors.surface, marginBottom: spacing.sm },
  error: { color: colors.red, marginBottom: spacing.sm },
  boton: { backgroundColor: colors.primary, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
  textoBoton: { color: colors.surface, fontWeight: '700' },
  actual: { color: colors.text3, marginTop: spacing.xs },
  filaOpciones: { flexDirection: 'row', gap: spacing.sm },
  opcion: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  opcionActiva: { backgroundColor: colors.primary, borderColor: colors.primary },
  textoOpcion: { color: colors.text2, fontWeight: '600' },
  textoOpcionActiva: { color: colors.surface },
});
```

- [ ] **Step 2: Agregar el botón de acceso a Configuración desde Home**

En `app/(tabs)/_layout.tsx` (Task 13), agregar un botón de header en la tab `index` que navegue a `/config`. Modificar el `Tabs.Screen name="index"`:

```tsx
import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';

// dentro del componente TabsLayout, antes del return:
const router = useRouter();

// reemplazar la línea <Tabs.Screen name="index" options={{ title: 'Inicio' }} /> por:
<Tabs.Screen
  name="index"
  options={{
    title: 'Inicio',
    headerRight: () => (
      <Pressable onPress={() => router.push('/config')} style={{ marginRight: 16 }}>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>⚙</Text>
      </Pressable>
    ),
  }}
/>
```

- [ ] **Step 3: Verificar manualmente**

Run: `npx expo start --web`, tocar el ícono ⚙ en Home, cambiar el presupuesto del mes y la cotización preferida.
Expected: el presupuesto se refleja en la tarjeta de resumen de Home; el toggle ARS/USD usa la cotización recién elegida.

- [ ] **Step 4: Commit**

```bash
git add app/config.tsx "app/(tabs)/_layout.tsx"
git commit -m "agrega pantalla de configuración"
```

---

## Task 19: Layout adaptado a escritorio

**Files:**
- Create: `src/hooks/use-es-escritorio.ts`, `src/hooks/__tests__/use-es-escritorio.test.ts`
- Modify: `app/(tabs)/index.tsx:1-20` (envolver el `ScrollView` en el layout de dos columnas cuando corresponda)

**Interfaces:**
- Consumes: `useWindowDimensions` de React Native
- Produces: `function useEsEscritorio(): boolean` — true si el ancho de la ventana es mayor al breakpoint.

Se define escritorio como ancho ≥ 768px (el mismo umbral típico de tablet/desktop). Solo se adapta la Home a dos columnas, que es la pantalla con más contenido; el resto de las pantallas ya funcionan bien en una columna ancha porque usan listas verticales.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/hooks/__tests__/use-es-escritorio.test.ts`:

```typescript
import { renderHook } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import { useEsEscritorio } from '../use-es-escritorio';

jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  useWindowDimensions: jest.fn(),
}));

describe('useEsEscritorio', () => {
  it('devuelve false para un ancho de celular', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 390, height: 844 });
    const { result } = renderHook(() => useEsEscritorio());
    expect(result.current).toBe(false);
  });

  it('devuelve true para un ancho de escritorio', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1280, height: 800 });
    const { result } = renderHook(() => useEsEscritorio());
    expect(result.current).toBe(true);
  });

  it('el breakpoint es 768px inclusive', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 768, height: 1024 });
    const { result } = renderHook(() => useEsEscritorio());
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- use-es-escritorio`
Expected: FAIL — "Cannot find module '../use-es-escritorio'".

- [ ] **Step 3: Implementar el hook**

Crear `src/hooks/use-es-escritorio.ts`:

```typescript
import { useWindowDimensions } from 'react-native';

const BREAKPOINT_ESCRITORIO = 768;

export function useEsEscritorio(): boolean {
  const { width } = useWindowDimensions();
  return width >= BREAKPOINT_ESCRITORIO;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- use-es-escritorio`
Expected: PASS.

- [ ] **Step 5: Adaptar la Home a dos columnas en escritorio**

Modificar `app/(tabs)/index.tsx`. Agregar el import:

```tsx
import { useEsEscritorio } from '../../src/hooks/use-es-escritorio';
```

Dentro del componente `Home`, después de las otras llamadas a hooks, agregar:

```tsx
const esEscritorio = useEsEscritorio();
```

Reemplazar el `return (<ScrollView ...> ... </ScrollView>)` completo por una versión que, en escritorio, pone la tarjeta de resumen + gráfico a la izquierda y los sectores a la derecha:

```tsx
  if (esEscritorio) {
    return (
      <View style={estilos.contenedorEscritorio}>
        <ScrollView style={estilos.columnaIzquierda} contentContainerStyle={estilos.contenido}>
          <View style={estilos.filaMoneda}>
            <Pressable onPress={() => preferencias.setMonedaVisualizacion('ARS')}>
              <Text style={[estilos.toggle, preferencias.monedaVisualizacion === 'ARS' && estilos.toggleActivo]}>ARS</Text>
            </Pressable>
            <Pressable onPress={() => preferencias.setMonedaVisualizacion('USD')}>
              <Text style={[estilos.toggle, preferencias.monedaVisualizacion === 'USD' && estilos.toggleActivo]}>USD</Text>
            </Pressable>
          </View>
          <View style={estilos.tarjetaResumen}>
            <Text style={estilos.etiqueta}>Disponible este mes</Text>
            <MoneyText centavos={resumen.disponible} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} style={estilos.montoGrande} />
            <View style={estilos.filaDetalle}>
              <Text style={estilos.detalle}>
                Presupuesto: <MoneyText centavos={resumen.presupuestoDelMes} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} />
              </Text>
              <Text style={estilos.detalle}>
                Gastado: <MoneyText centavos={resumen.gastado} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} />
              </Text>
            </View>
          </View>
          {porciones.length > 0 && (
            <View style={estilos.centrado}>
              <PieChart porciones={porciones} size={260} />
            </View>
          )}
        </ScrollView>
        <ScrollView style={estilos.columnaDerecha} contentContainerStyle={estilos.contenido}>
          <Text style={estilos.seccionTitulo}>Sectores</Text>
          <View style={estilos.seccion}>
            {sectores.map((s) => (
              <SectorProgress key={s.id} nombre={s.nombre} color={s.color} gastado={gastoPorSector.get(s.id) ?? 0} limite={s.limiteMensual} />
            ))}
          </View>
        </ScrollView>
        <Pressable style={estilos.botonFlotante} onPress={() => router.push('/gasto-nuevo')}>
          <Text style={estilos.textoBotonFlotante}>+</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={estilos.contenedor} contentContainerStyle={estilos.contenido}>
      <View style={estilos.filaMoneda}>
        <Pressable onPress={() => preferencias.setMonedaVisualizacion('ARS')}>
          <Text style={[estilos.toggle, preferencias.monedaVisualizacion === 'ARS' && estilos.toggleActivo]}>ARS</Text>
        </Pressable>
        <Pressable onPress={() => preferencias.setMonedaVisualizacion('USD')}>
          <Text style={[estilos.toggle, preferencias.monedaVisualizacion === 'USD' && estilos.toggleActivo]}>USD</Text>
        </Pressable>
      </View>

      <View style={estilos.tarjetaResumen}>
        <Text style={estilos.etiqueta}>Disponible este mes</Text>
        <MoneyText centavos={resumen.disponible} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} style={estilos.montoGrande} />
        <View style={estilos.filaDetalle}>
          <Text style={estilos.detalle}>
            Presupuesto: <MoneyText centavos={resumen.presupuestoDelMes} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} />
          </Text>
          <Text style={estilos.detalle}>
            Gastado: <MoneyText centavos={resumen.gastado} moneda={preferencias.monedaVisualizacion} cotizacion={cotizacion?.venta} />
          </Text>
        </View>
        {resumen.acumuladoPrevio > 0 && (
          <Pressable style={estilos.chipAcumulado} onPress={() => router.push('/(tabs)/ahorro')}>
            <Text style={estilos.textoChip}>
              +<MoneyText centavos={resumen.acumuladoPrevio} moneda="ARS" style={estilos.textoChip} /> de meses anteriores
            </Text>
          </Pressable>
        )}
      </View>

      {porciones.length > 0 && (
        <View style={estilos.centrado}>
          <PieChart porciones={porciones} size={220} />
        </View>
      )}

      <View style={estilos.seccion}>
        {sectores.map((s) => (
          <SectorProgress key={s.id} nombre={s.nombre} color={s.color} gastado={gastoPorSector.get(s.id) ?? 0} limite={s.limiteMensual} />
        ))}
      </View>

      <Pressable style={estilos.botonFlotante} onPress={() => router.push('/gasto-nuevo')}>
        <Text style={estilos.textoBotonFlotante}>+</Text>
      </Pressable>
    </ScrollView>
  );
```

Agregar a `estilos` (el `StyleSheet.create` al final del archivo) las claves nuevas usadas en la rama de escritorio:

```tsx
  contenedorEscritorio: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  columnaIzquierda: { flex: 1, borderRightWidth: 1, borderRightColor: colors.border },
  columnaDerecha: { flex: 1 },
  seccionTitulo: { color: colors.text2, fontWeight: '700', marginBottom: spacing.sm, fontSize: 16 },
```

- [ ] **Step 6: Verificar manualmente en ambos tamaños**

Run: `npx expo start --web`, abrir en el navegador y achicar/agrandar la ventana alrededor de 768px de ancho.
Expected: por debajo de 768px se ve una columna (mobile); por encima, dos columnas lado a lado (resumen+gráfico a la izquierda, sectores a la derecha).

- [ ] **Step 7: Commit**

```bash
git add src/hooks/use-es-escritorio.ts src/hooks/__tests__/use-es-escritorio.test.ts "app/(tabs)/index.tsx"
git commit -m "adapta la Home a un layout de dos columnas en escritorio"
```

---

## Task 20: Shell de escritorio con Tauri

**Files:**
- Create: `src-tauri/` (generado por el CLI de Tauri), `src-tauri/tauri.conf.json` (modificado)

**Interfaces:**
- Consumes: el build web estático de Expo (`dist/`, generado por `npx expo export -p web`, Task 1)
- Produces: ejecutable de escritorio (`.exe` en Windows, `.dmg`/`.app` en Mac) que envuelve `dist/` en una ventana nativa.

Tauri necesita el toolchain de Rust, que no está instalado en esta máquina (se verificó con `rustc --version`). Este es el único paso del plan con una dependencia de sistema que instala la persona usuaria, no `npm`.

- [ ] **Step 1: Instalar Rust**

Este paso lo ejecuta la persona usuaria una sola vez (no se puede scriptear de forma no interactiva de manera confiable en Windows). Instrucciones:

1. Ir a https://rustup.rs/ y descargar `rustup-init.exe`.
2. Ejecutarlo y aceptar la instalación por defecto (opción 1).
3. Cerrar y volver a abrir la terminal.
4. Verificar: `rustc --version` y `cargo --version` deben mostrar un número de versión.

También hace falta el "Desktop development with C++" de Visual Studio Build Tools en Windows (el instalador de `rustup` avisa si falta y da el link).

- [ ] **Step 2: Instalar el CLI de Tauri como dependencia de desarrollo**

```bash
npm install --save-dev @tauri-apps/cli
```

- [ ] **Step 3: Inicializar Tauri en el proyecto**

```bash
npx tauri init
```

Cuando pregunte, responder:
- App name: `Gastos`
- Window title: `Gastos`
- Web assets location (`../dist`): `../dist`
- Dev server URL (`http://localhost:1420`): `http://localhost:8081` (el puerto por defecto de `expo start --web`)
- Dev command (`npm run dev`): `npx expo start --web`
- Build command (`npm run build`): `npx expo export -p web`

- [ ] **Step 4: Verificar/corregir `src-tauri/tauri.conf.json`**

Abrir `src-tauri/tauri.conf.json` y confirmar que la sección `build` quede así:

```json
{
  "build": {
    "beforeDevCommand": "npx expo start --web",
    "devUrl": "http://localhost:8081",
    "beforeBuildCommand": "npx expo export -p web",
    "frontendDist": "../dist"
  }
}
```

- [ ] **Step 5: Agregar scripts de conveniencia**

En `package.json`, agregar a `scripts`:

```json
"desktop:dev": "tauri dev",
"desktop:build": "tauri build"
```

- [ ] **Step 6: Probar el modo desarrollo de escritorio**

Run: `npm run desktop:dev`
Expected: se abre una ventana nativa de Windows mostrando la Home de la app, con hot-reload al guardar cambios (igual que en el navegador).

- [ ] **Step 7: Generar el ejecutable de escritorio**

Run: `npm run desktop:build`
Expected: termina sin errores y deja el instalable en `src-tauri/target/release/bundle/` (en Windows, un `.msi` y/o `.exe` de NSIS). Ejecutarlo instala la app y queda en el menú de inicio como cualquier programa de Windows.

- [ ] **Step 8: Commit**

```bash
git add src-tauri package.json
git commit -m "agrega shell de escritorio con Tauri envolviendo el export web de Expo"
```

---

## Task 21: Proyecto Firebase real, autenticación anónima y reglas de Firestore

**Files:**
- Create: `firestore.rules`, `.env` (no se commitea)

**Interfaces:**
- Consumes: nada nuevo de código
- Produces: proyecto de Firebase funcional conectado a la app, con reglas de seguridad activas.

Este task combina pasos manuales (los ejecuta la persona usuaria, con una cuenta de Google 100% personal, sin ningún vínculo a FyLabs) con la implementación de las reglas de seguridad.

- [ ] **Step 1: Crear el proyecto en Firebase (manual)**

1. Ir a https://console.firebase.google.com con la cuenta de Google personal.
2. "Agregar proyecto" → nombre `gastos-app-personal` (o el que se prefiera) → seguir el asistente (se puede desactivar Google Analytics, no hace falta).
3. Dentro del proyecto, ir a "Compilación" → "Firestore Database" → "Crear base de datos" → modo producción → elegir la región más cercana (ej. `southamerica-east1`).
4. Ir a "Compilación" → "Authentication" → "Comenzar" → habilitar el proveedor "Anónimo".
5. Ir a "Configuración del proyecto" (ícono de engranaje) → "Tus apps" → "Agregar app" → ícono `</>` (Web) → nombre `gastos-web` → **no** marcar Firebase Hosting → "Registrar app".
6. Copiar los valores `apiKey`, `authDomain`, `projectId`, `appId` que muestra la consola.

- [ ] **Step 2: Completar el `.env` local**

Crear `.env` (nunca se commitea, ya está en `.gitignore` desde la Task 1) con los valores copiados:

```
EXPO_PUBLIC_FIREBASE_API_KEY=<valor copiado>
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<valor copiado>
EXPO_PUBLIC_FIREBASE_PROJECT_ID=<valor copiado>
EXPO_PUBLIC_FIREBASE_APP_ID=<valor copiado>
```

- [ ] **Step 3: Escribir las reglas de seguridad de Firestore**

Crear `firestore.rules`:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

- [ ] **Step 4: Publicar las reglas (manual)**

En la consola de Firebase: "Firestore Database" → pestaña "Reglas" → pegar el contenido de `firestore.rules` → "Publicar".

Expected: la consola muestra "Reglas publicadas correctamente" con la fecha/hora actual.

- [ ] **Step 5: Verificar la conexión end-to-end**

Run: `npx expo start --web`, crear el PIN, y desde la pantalla de Sectores agregar un sector de prueba.

Expected: en la consola de Firebase, "Firestore Database" → "Datos", aparece la colección `users/<uid>/sectors` con el documento recién creado.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules
git commit -m "agrega reglas de seguridad de Firestore restringidas por usuario"
```

---

## Task 22: Build del APK de Android para instalación directa

**Files:**
- Modify: `eas.json` (creado por el CLI)

**Interfaces:**
- Consumes: el proyecto Expo completo (Tasks 1-21)
- Produces: un archivo `.apk` instalable directo en el celular Android, sin pasar por Google Play.

Se usa EAS Build (el servicio de build en la nube de Expo, gratuito con límites generosos por mes en el plan free — más que suficiente para builds personales esporádicos) para no tener que instalar Android Studio localmente.

- [ ] **Step 1: Instalar el CLI de EAS**

```bash
npm install --save-dev eas-cli
```

- [ ] **Step 2: Iniciar sesión (manual)**

Este paso lo hace la persona usuaria, con una cuenta de Expo personal (gratis, se crea en https://expo.dev/signup si no existe):

```bash
npx eas login
```

- [ ] **Step 3: Configurar el proyecto para EAS Build**

```bash
npx eas build:configure
```

Esto crea `eas.json`. Confirmar que tenga un perfil `preview` que genere APK en vez de AAB (AAB es el formato que exige Google Play, no sirve para instalación directa):

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

- [ ] **Step 4: Lanzar el build**

```bash
npx eas build --platform android --profile preview
```

Expected: el comando sube el proyecto a los servidores de Expo, corre el build (5-15 minutos) y al final imprime una URL de descarga del `.apk`.

- [ ] **Step 5: Instalar en el celular**

Descargar el `.apk` desde la URL (directo en el navegador del celular, o transferirlo por cable/USB). Al abrirlo, Android va a pedir habilitar "Instalar apps de orígenes desconocidos" para esa fuente — habilitarlo y confirmar la instalación.

Expected: el ícono de "Gastos" aparece en el celular como cualquier otra app instalada, y abre mostrando la pantalla de creación del PIN.

- [ ] **Step 6: Commit**

```bash
git add eas.json
git commit -m "agrega configuración de EAS Build para generar APK instalable directo"
```

---

## Self-review del plan

**Cobertura del spec:**
- Arquitectura RN+Expo+Tauri+Firebase → Tasks 1, 5, 6, 20, 21.
- Modelo de datos Firestore por colección → Tasks 2, 7.
- Offline-first con la corrección de la cola local en celular → Tasks 5, 6, 7.
- Pantallas (Home, cargar gasto, sectores, historial, ahorro, configuración) → Tasks 13, 14, 15, 16, 17, 18.
- Cálculo de acumulado y ahorro → Tasks 3, 17.
- Cotización USD con cache → Tasks 4, 12, 13.
- PIN + Firebase Auth anónimo → Tasks 8, 11, 21.
- Layout mobile-first con adaptación a 2 columnas en escritorio → Task 19.
- Repositorio privado en GitHub → Task 1, Step 10.
- Distribución (.apk directo, Tauri, Expo Go) → Tasks 20, 22.

Todo lo del spec tiene una tarea. Ningún punto de "fuera de alcance" del spec (multiusuario, notificaciones, foto de ticket, tiendas oficiales, ingresos) tiene tarea — correcto, quedan afuera.

**Placeholders:** revisado, no quedan "TBD" ni pasos sin código real, salvo los pasos manuales explícitamente marcados como tales (crear cuenta de Firebase, instalar Rust, etc.), que son inherentemente acciones humanas fuera del editor.

**Consistencia de tipos:** `Expense`, `Sector`, `Budget`, `SavingMovement` (Task 2) se usan con los mismos campos en repos (Task 7), hooks (Task 12) y pantallas (Tasks 13-18). `ResumenMes` (Task 3) tiene los mismos cuatro campos en todos los consumidores. `LocalStore`/`PendingWrite` (Task 6) coinciden entre `sync.ts`, `local.native.ts`, `local.web.ts` y los repos.

**Alcance:** el plan cubre un solo proyecto cohesivo (la app), sin subsistemas independientes que ameriten planes separados.

