# Importar CSV y carga rápida en Inversiones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En Inversiones se puede importar un CSV con varias posiciones de una vez, y el alta individual gana un modo "Monto total" para cargar una posición sin desglosar ticker/nominales/PPC.

**Architecture:** Un parser de dominio puro (`parsearCsvInversiones`) separa el texto del CSV en posiciones válidas y errores por fila, sin tocar repos. Una función de orquestación (`importarInversiones`) guarda cada posición válida vía `repos.investments.agregar`, usando la cotización actual para filas en USD (mismo criterio que el alta individual). Un servicio (`seleccionarArchivoCsv`) abre el picker nativo/web y devuelve el texto del archivo. El modo "Monto total" en `inversion-nueva.tsx` es un chip que cambia qué campos se muestran, pero termina en el mismo `repos.investments.agregar` que el modo detallado.

**Tech Stack:** TypeScript, Expo Router, React Native, `expo-document-picker` (nueva dependencia, ya instalada con `npx expo install`), Jest.

## Global Constraints

- El CSV usa columnas propias: `ticker,nominales,precio,moneda,rubro,fecha`. `rubro` y `fecha` son opcionales (fecha vacía = hoy). Filas inválidas se saltean y se reportan, sin abortar el resto de la importación.
- Las filas en USD usan la cotización actual (misma fuente que ya usa `inversion-nueva.tsx`), no una cotización por fila — el CSV no la trae.
- El modo "Monto total" no reemplaza el formulario detallado existente — es un modo alternativo dentro de la misma pantalla.
- No se toca `vender-inversion.ts`, `investment-repo.ts`, `broker-cash-repo.ts` ni ninguna lógica de venta — son un flujo separado.
- Al terminar, correr `npm test` y confirmar que pasa todo, incluyendo el typecheck.

---

### Task 1: Parser de dominio del CSV (TDD)

**Files:**
- Create: `src/domain/import-csv-inversiones.ts`
- Test: `src/domain/__tests__/import-csv-inversiones.test.ts`

**Interfaces:**
- Produces: `PosicionImportada { ticker, nominales, ppc, monedaOriginal: Currency, rubro: string | null, fecha: string }`, `ErrorFilaImportacion { fila: number, motivo: string }`, `parsearCsvInversiones(csv: string, fechaHoy: string): { posiciones: PosicionImportada[]; errores: ErrorFilaImportacion[] }` — consumido por Task 3 (`importar-inversiones.ts`) y Task 4 (UI).

- [ ] **Step 1: Escribir los tests primero**

Crear `src/domain/__tests__/import-csv-inversiones.test.ts`:

```typescript
import { parsearCsvInversiones } from '../import-csv-inversiones';

describe('parsearCsvInversiones', () => {
  it('parsea filas válidas en ARS y USD', () => {
    const csv = [
      'ticker,nominales,precio,moneda,rubro,fecha',
      'GGAL,10,5500,ARS,Bancos,2026-01-15',
      'AAPL,3,180,USD,Tech,2026-02-01',
    ].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.posiciones).toEqual([
      { ticker: 'GGAL', nominales: 10, ppc: 5500, monedaOriginal: 'ARS', rubro: 'Bancos', fecha: '2026-01-15' },
      { ticker: 'AAPL', nominales: 3, ppc: 180, monedaOriginal: 'USD', rubro: 'Tech', fecha: '2026-02-01' },
    ]);
  });

  it('acepta rubro y fecha vacíos, usando fechaHoy y rubro null', () => {
    const csv = ['ticker,nominales,precio,moneda,rubro,fecha', 'GGAL,10,5500,ARS,,'].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.posiciones[0]).toEqual({
      ticker: 'GGAL',
      nominales: 10,
      ppc: 5500,
      monedaOriginal: 'ARS',
      rubro: null,
      fecha: '2026-06-01',
    });
  });

  it('funciona sin columnas rubro/fecha en el encabezado', () => {
    const csv = ['ticker,nominales,precio,moneda', 'GGAL,10,5500,ARS'].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.posiciones[0]).toEqual({
      ticker: 'GGAL',
      nominales: 10,
      ppc: 5500,
      monedaOriginal: 'ARS',
      rubro: null,
      fecha: '2026-06-01',
    });
  });

  it('reporta fila con ticker faltante sin abortar el resto', () => {
    const csv = [
      'ticker,nominales,precio,moneda',
      ',10,5500,ARS',
      'AAPL,3,180,USD',
    ].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.posiciones).toHaveLength(1);
    expect(resultado.posiciones[0].ticker).toBe('AAPL');
    expect(resultado.errores).toEqual([{ fila: 2, motivo: 'Falta el ticker' }]);
  });

  it('reporta nominales inválidos (cero, negativo o no numérico)', () => {
    const csv = [
      'ticker,nominales,precio,moneda',
      'GGAL,0,5500,ARS',
      'AAPL,abc,180,USD',
    ].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.posiciones).toHaveLength(0);
    expect(resultado.errores).toEqual([
      { fila: 2, motivo: 'Nominales inválidos' },
      { fila: 3, motivo: 'Nominales inválidos' },
    ]);
  });

  it('reporta precio inválido', () => {
    const csv = ['ticker,nominales,precio,moneda', 'GGAL,10,0,ARS'].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.posiciones).toHaveLength(0);
    expect(resultado.errores).toEqual([{ fila: 2, motivo: 'Precio inválido' }]);
  });

  it('reporta moneda inválida', () => {
    const csv = ['ticker,nominales,precio,moneda', 'GGAL,10,5500,EUR'].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.posiciones).toHaveLength(0);
    expect(resultado.errores).toEqual([{ fila: 2, motivo: 'Moneda inválida (debe ser ARS o USD)' }]);
  });

  it('reporta fecha con formato inválido', () => {
    const csv = ['ticker,nominales,precio,moneda,rubro,fecha', 'GGAL,10,5500,ARS,,15/01/2026'].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.posiciones).toHaveLength(0);
    expect(resultado.errores).toEqual([{ fila: 2, motivo: 'Fecha inválida (formato YYYY-MM-DD)' }]);
  });

  it('reporta columnas requeridas faltantes en el encabezado, sin parsear filas', () => {
    const csv = ['ticker,nominales,moneda', 'GGAL,10,ARS'].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.posiciones).toHaveLength(0);
    expect(resultado.errores).toEqual([{ fila: 1, motivo: 'Faltan columnas: precio' }]);
  });

  it('ignora líneas vacías y espacios de más', () => {
    const csv = [
      'ticker,nominales,precio,moneda',
      '',
      '  GGAL , 10 , 5500 , ARS  ',
      '',
    ].join('\n');

    const resultado = parsearCsvInversiones(csv, '2026-06-01');

    expect(resultado.errores).toHaveLength(0);
    expect(resultado.posiciones).toHaveLength(1);
    expect(resultado.posiciones[0].ticker).toBe('GGAL');
  });

  it('csv vacío devuelve listas vacías sin lanzar', () => {
    expect(parsearCsvInversiones('', '2026-06-01')).toEqual({ posiciones: [], errores: [] });
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan (RED)**

Run: `npx jest src/domain/__tests__/import-csv-inversiones.test.ts`
Expected: FAIL con "Cannot find module '../import-csv-inversiones'".

- [ ] **Step 3: Implementar `src/domain/import-csv-inversiones.ts`**

```typescript
import type { Currency } from './types';

export interface PosicionImportada {
  ticker: string;
  nominales: number;
  ppc: number;
  monedaOriginal: Currency;
  rubro: string | null;
  fecha: string;
}

export interface ErrorFilaImportacion {
  fila: number;
  motivo: string;
}

export interface ResultadoParseoCsv {
  posiciones: PosicionImportada[];
  errores: ErrorFilaImportacion[];
}

const COLUMNAS_REQUERIDAS = ['ticker', 'nominales', 'precio', 'moneda'] as const;
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parsea un CSV con columnas ticker,nominales,precio,moneda,rubro,fecha
 * (rubro y fecha son opcionales; fecha vacía usa `fechaHoy`). Las filas
 * inválidas se reportan en `errores` (con el número de fila, contando el
 * encabezado como fila 1) sin interrumpir el resto de la importación.
 */
export function parsearCsvInversiones(csv: string, fechaHoy: string): ResultadoParseoCsv {
  const lineas = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lineas.length === 0) {
    return { posiciones: [], errores: [] };
  }

  const encabezado = lineas[0].split(',').map((c) => c.trim().toLowerCase());
  const indiceDe = (nombre: string) => encabezado.indexOf(nombre);

  const columnasFaltantes = COLUMNAS_REQUERIDAS.filter((c) => indiceDe(c) === -1);
  if (columnasFaltantes.length > 0) {
    return {
      posiciones: [],
      errores: [{ fila: 1, motivo: `Faltan columnas: ${columnasFaltantes.join(', ')}` }],
    };
  }

  const idxTicker = indiceDe('ticker');
  const idxNominales = indiceDe('nominales');
  const idxPrecio = indiceDe('precio');
  const idxMoneda = indiceDe('moneda');
  const idxRubro = indiceDe('rubro');
  const idxFecha = indiceDe('fecha');

  const posiciones: PosicionImportada[] = [];
  const errores: ErrorFilaImportacion[] = [];

  for (let i = 1; i < lineas.length; i++) {
    const fila = i + 1;
    const columnas = lineas[i].split(',').map((c) => c.trim());

    const ticker = columnas[idxTicker]?.toUpperCase();
    const nominales = Number(columnas[idxNominales]?.replace(',', '.'));
    const precio = Number(columnas[idxPrecio]?.replace(',', '.'));
    const monedaTexto = columnas[idxMoneda]?.toUpperCase();
    const rubro = idxRubro >= 0 ? columnas[idxRubro]?.trim() || null : null;
    const fechaTexto = idxFecha >= 0 ? columnas[idxFecha]?.trim() : '';
    const fecha = fechaTexto || fechaHoy;

    if (!ticker) {
      errores.push({ fila, motivo: 'Falta el ticker' });
      continue;
    }
    if (!Number.isFinite(nominales) || nominales <= 0) {
      errores.push({ fila, motivo: 'Nominales inválidos' });
      continue;
    }
    if (!Number.isFinite(precio) || precio <= 0) {
      errores.push({ fila, motivo: 'Precio inválido' });
      continue;
    }
    if (monedaTexto !== 'ARS' && monedaTexto !== 'USD') {
      errores.push({ fila, motivo: 'Moneda inválida (debe ser ARS o USD)' });
      continue;
    }
    if (!FORMATO_FECHA.test(fecha)) {
      errores.push({ fila, motivo: 'Fecha inválida (formato YYYY-MM-DD)' });
      continue;
    }

    posiciones.push({ ticker, nominales, ppc: precio, monedaOriginal: monedaTexto, rubro, fecha });
  }

  return { posiciones, errores };
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan (GREEN)**

Run: `npx jest src/domain/__tests__/import-csv-inversiones.test.ts`
Expected: 11 tests, todos PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/import-csv-inversiones.ts src/domain/__tests__/import-csv-inversiones.test.ts
git commit -m "agrega parser de CSV de inversiones (dominio puro, TDD)"
```

---

### Task 2: `seleccionarArchivoCsv` — abrir el picker y leer el archivo

**Files:**
- Create: `src/services/importar-csv.ts`

**Interfaces:**
- Produces: `seleccionarArchivoCsv(): Promise<string | null>` (null si el usuario cancela) — consumido por Task 4 (UI).

- [ ] **Step 1: Crear el servicio**

```typescript
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

/**
 * Abre el selector de archivos del sistema (o del navegador en web) y
 * devuelve el contenido del archivo elegido como texto. Devuelve null si el
 * usuario cancela. Mismo patrón que `compartirCsv` (expo-file-system +
 * expo-document-picker), pero en la dirección de lectura en vez de escritura.
 */
export async function seleccionarArchivoCsv(): Promise<string | null> {
  const resultado = await DocumentPicker.getDocumentAsync({
    type: 'text/csv',
    copyToCacheDirectory: true,
  });

  if (resultado.canceled || resultado.assets.length === 0) {
    return null;
  }

  const archivo = new File(resultado.assets[0].uri);
  return archivo.textSync();
}
```

- [ ] **Step 2: Verificar que el typecheck no tenga errores nuevos**

Run: `npx tsc --noEmit`
Expected: los mismos 2 errores preexistentes de siempre (firebase/auth, dolar.test.ts), ninguno nuevo referenciando este archivo.

- [ ] **Step 3: Commit**

```bash
git add src/services/importar-csv.ts
git commit -m "agrega seleccionarArchivoCsv: abre el picker y lee el CSV elegido"
```

---

### Task 3: `importarInversiones` — orquestación de guardado

**Files:**
- Create: `src/repos/importar-inversiones.ts`
- Test: `src/repos/__tests__/importar-inversiones.test.ts`

**Interfaces:**
- Consumes: `PosicionImportada` (Task 1), `costoUnitarioCentavosArs` (ya existente en `src/domain/investments.ts`), `Repos.investments.agregar` (ya existente).
- Produces: `importarInversiones(repos: Repos, posiciones: PosicionImportada[], cotizacionActual: number | null): Promise<{ creadas: Investment[]; errores: { posicion: PosicionImportada; motivo: string }[] }>` — consumido por Task 4 (UI).

- [ ] **Step 1: Crear `src/repos/importar-inversiones.ts`**

```typescript
import { costoUnitarioCentavosArs } from '../domain/investments';
import type { PosicionImportada } from '../domain/import-csv-inversiones';
import type { Investment } from '../domain/types';
import type { Repos } from './create-repo';

export interface ErrorImportacion {
  posicion: PosicionImportada;
  motivo: string;
}

export interface ResultadoImportacion {
  creadas: Investment[];
  errores: ErrorImportacion[];
}

/**
 * Guarda cada posición importada como una Investment nueva (siempre status
 * 'OPEN'). Las filas en USD usan `cotizacionActual` — el CSV no trae una
 * cotización por fila, así que se usa la misma que ya usa el alta individual
 * en inversion-nueva.tsx. Si falta la cotización y hay filas en USD, esas
 * filas se reportan como error sin bloquear las filas en ARS.
 */
export async function importarInversiones(
  repos: Repos,
  posiciones: PosicionImportada[],
  cotizacionActual: number | null
): Promise<ResultadoImportacion> {
  const creadas: Investment[] = [];
  const errores: ErrorImportacion[] = [];

  for (const posicion of posiciones) {
    if (posicion.monedaOriginal === 'USD' && cotizacionActual === null) {
      errores.push({ posicion, motivo: 'No se pudo obtener la cotización del dólar' });
      continue;
    }
    const cotizacionUsada = posicion.monedaOriginal === 'USD' ? cotizacionActual : null;
    const inversion = await repos.investments.agregar({
      ticker: posicion.ticker,
      nominales: posicion.nominales,
      ppc: posicion.ppc,
      monedaOriginal: posicion.monedaOriginal,
      cotizacionUsada,
      costoCentavosArsUnitario: costoUnitarioCentavosArs(posicion.ppc, posicion.monedaOriginal, cotizacionUsada),
      rubro: posicion.rubro,
      fecha: posicion.fecha,
      status: 'OPEN',
    });
    creadas.push(inversion);
  }

  return { creadas, errores };
}
```

- [ ] **Step 2: Crear el test**

```typescript
import { importarInversiones } from '../importar-inversiones';
import type { Repos } from '../create-repo';
import type { Investment } from '../../domain/types';
import type { PosicionImportada } from '../../domain/import-csv-inversiones';

function posicion(parcial: Partial<PosicionImportada> = {}): PosicionImportada {
  return {
    ticker: 'GGAL',
    nominales: 10,
    ppc: 5500,
    monedaOriginal: 'ARS',
    rubro: null,
    fecha: '2026-06-01',
    ...parcial,
  };
}

function crearReposFake() {
  const guardadas: Omit<Investment, 'id'>[] = [];
  let contador = 0;

  const repos = {
    investments: {
      agregar: jest.fn(async (inversion: Omit<Investment, 'id'>) => {
        guardadas.push(inversion);
        contador += 1;
        return { ...inversion, id: `inv${contador}` };
      }),
    },
  };

  return { repos: repos as unknown as Repos, guardadas };
}

describe('importarInversiones', () => {
  it('guarda cada posición en ARS como Investment OPEN, sin cotización', async () => {
    const { repos, guardadas } = crearReposFake();

    const resultado = await importarInversiones(repos, [posicion({ ticker: 'GGAL' })], null);

    expect(resultado.creadas).toHaveLength(1);
    expect(resultado.errores).toHaveLength(0);
    expect(guardadas[0]).toMatchObject({ ticker: 'GGAL', monedaOriginal: 'ARS', cotizacionUsada: null, status: 'OPEN' });
  });

  it('guarda posiciones en USD usando la cotización actual', async () => {
    const { repos, guardadas } = crearReposFake();
    const posiciones = [posicion({ ticker: 'AAPL', ppc: 180, monedaOriginal: 'USD' })];

    const resultado = await importarInversiones(repos, posiciones, 1500);

    expect(resultado.creadas).toHaveLength(1);
    expect(guardadas[0].cotizacionUsada).toBe(1500);
    // 180 USD * 1500 * 100 centavos = 27000000 centavos ARS por nominal
    expect(guardadas[0].costoCentavosArsUnitario).toBe(27000000);
  });

  it('reporta como error las filas en USD si no hay cotización disponible, sin bloquear las de ARS', async () => {
    const { repos, guardadas } = crearReposFake();
    const posiciones = [
      posicion({ ticker: 'GGAL', monedaOriginal: 'ARS' }),
      posicion({ ticker: 'AAPL', monedaOriginal: 'USD' }),
    ];

    const resultado = await importarInversiones(repos, posiciones, null);

    expect(resultado.creadas).toHaveLength(1);
    expect(guardadas).toHaveLength(1);
    expect(resultado.errores).toHaveLength(1);
    expect(resultado.errores[0].posicion.ticker).toBe('AAPL');
  });

  it('lista vacía no llama al repo y devuelve resultado vacío', async () => {
    const { repos, guardadas } = crearReposFake();

    const resultado = await importarInversiones(repos, [], null);

    expect(resultado.creadas).toHaveLength(0);
    expect(resultado.errores).toHaveLength(0);
    expect(guardadas).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Correr los tests**

Run: `npx jest src/repos/__tests__/importar-inversiones.test.ts`
Expected: 4 tests, todos PASS.

- [ ] **Step 4: Commit**

```bash
git add src/repos/importar-inversiones.ts src/repos/__tests__/importar-inversiones.test.ts
git commit -m "agrega importarInversiones: guarda cada posicion del CSV parseado"
```

---

### Task 4: UI — botón "Importar CSV" en Inversiones

**Files:**
- Modify: `app/(tabs)/inversiones.tsx`

**Interfaces:**
- Consumes: `seleccionarArchivoCsv` (Task 2), `parsearCsvInversiones` (Task 1), `importarInversiones` (Task 3).

- [ ] **Step 1: Agregar imports**

Reemplazar:

```typescript
import { generarCsvPortfolio } from '../../src/domain/export-csv';
import { compartirCsv } from '../../src/services/compartir-csv';
```

por:

```typescript
import { generarCsvPortfolio } from '../../src/domain/export-csv';
import { compartirCsv } from '../../src/services/compartir-csv';
import { parsearCsvInversiones } from '../../src/domain/import-csv-inversiones';
import { seleccionarArchivoCsv } from '../../src/services/importar-csv';
import { importarInversiones } from '../../src/repos/importar-inversiones';
```

- [ ] **Step 2: Agregar estado de importación**

Reemplazar:

```typescript
  const [editandoCash, setEditandoCash] = useState(false);
  const [cashTexto, setCashTexto] = useState('');
  const [monedaEdicion, setMonedaEdicion] = useState<'ARS' | 'USD'>('ARS');
  const [error, setError] = useState<string | null>(null);
```

por:

```typescript
  const [editandoCash, setEditandoCash] = useState(false);
  const [cashTexto, setCashTexto] = useState('');
  const [monedaEdicion, setMonedaEdicion] = useState<'ARS' | 'USD'>('ARS');
  const [error, setError] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
```

- [ ] **Step 3: Agregar la función `importarCsv`**

Buscar la función `exportar` existente:

```typescript
  async function exportar() {
    setError(null);
    try {
      const csv = generarCsvPortfolio(inversiones, brokerCash);
      await compartirCsv(csv);
    } catch {
      setError('No se pudo exportar el CSV. Probá de nuevo.');
    }
  }
```

Agregar inmediatamente después:

```typescript

  async function importarCsv() {
    if (importando) return;
    setError(null);
    setImportando(true);
    try {
      const texto = await seleccionarArchivoCsv();
      if (texto === null) return;

      const fechaHoy = new Date().toISOString().slice(0, 10);
      const { posiciones, errores: erroresParseo } = parsearCsvInversiones(texto, fechaHoy);

      if (posiciones.length === 0 && erroresParseo.length > 0) {
        setError(`No se pudo importar: ${erroresParseo[0].motivo}`);
        return;
      }

      const { creadas, errores: erroresImportacion } = await importarInversiones(
        repos,
        posiciones,
        cotizacion?.venta ?? null
      );

      const totalErrores = erroresParseo.length + erroresImportacion.length;
      if (totalErrores === 0) {
        setError(null);
      } else {
        setError(`${creadas.length} posiciones importadas, ${totalErrores} con errores (fila ${erroresParseo[0]?.fila ?? '?'}: revisá el CSV)`);
      }
    } catch {
      setError('No se pudo importar el CSV. Probá de nuevo.');
    } finally {
      setImportando(false);
    }
  }
```

- [ ] **Step 4: Agregar el botón "Importar CSV" al lado de "Exportar"**

Reemplazar:

```typescript
            <View style={estilos.filaMoneda}>
              <Pressable onPress={exportar} style={estilos.botonExportar}>
                <Text style={estilos.textoExportar}>Exportar</Text>
              </Pressable>
              <View style={estilos.grupoChip}>
```

por:

```typescript
            <View style={estilos.filaMoneda}>
              <Pressable onPress={exportar} style={estilos.botonExportar}>
                <Text style={estilos.textoExportar}>Exportar</Text>
              </Pressable>
              <Pressable onPress={importarCsv} style={estilos.botonExportar} disabled={importando}>
                <Text style={estilos.textoExportar}>{importando ? 'Importando...' : 'Importar CSV'}</Text>
              </Pressable>
              <View style={estilos.grupoChip}>
```

- [ ] **Step 5: Verificar tests y typecheck**

Run: `npm test`
Expected: pasa igual que antes (esta pantalla no tiene test unitario propio).

Run: `npx tsc --noEmit`
Expected: los mismos 2 errores preexistentes, ninguno nuevo.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/inversiones.tsx"
git commit -m "agrega boton Importar CSV en Inversiones"
```

---

### Task 5: UI — modo "Monto total" en Nueva inversión

**Files:**
- Modify: `app/inversion-nueva.tsx`

**Interfaces:**
- Consumes: `costoUnitarioCentavosArs` (ya existente, ya importado en este archivo), `Repos.investments.agregar` (ya existente).

- [ ] **Step 1: Agregar estado de modo y campos del monto total**

Reemplazar:

```typescript
  const [ticker, setTicker] = useState('');
  const [nominalesTexto, setNominalesTexto] = useState('');
  const [ppcTexto, setPpcTexto] = useState('');
  const [moneda, setMoneda] = useState<Currency>('ARS');
  const [rubro, setRubro] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
```

por:

```typescript
  const [modo, setModo] = useState<'detallado' | 'montoTotal'>('detallado');
  const [ticker, setTicker] = useState('');
  const [nominalesTexto, setNominalesTexto] = useState('');
  const [ppcTexto, setPpcTexto] = useState('');
  const [moneda, setMoneda] = useState<Currency>('ARS');
  const [rubro, setRubro] = useState('');
  const [etiquetaMonto, setEtiquetaMonto] = useState('');
  const [montoTotalTexto, setMontoTotalTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
```

- [ ] **Step 2: Separar `guardar()` en dos caminos según el modo**

Reemplazar:

```typescript
  async function guardar() {
    const nominales = Number(nominalesTexto.replace(',', '.'));
    const ppc = Number(ppcTexto.replace(',', '.'));

    if (!ticker.trim()) {
      setError('Ingresá un ticker');
      return;
    }
    if (!Number.isFinite(nominales) || nominales <= 0 || !Number.isInteger(nominales)) {
      setError('Ingresá una cantidad entera de nominales');
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
    } catch {
      setError('No se pudo guardar la inversión. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }
```

por:

```typescript
  async function guardarDetallado() {
    const nominales = Number(nominalesTexto.replace(',', '.'));
    const ppc = Number(ppcTexto.replace(',', '.'));

    if (!ticker.trim()) {
      setError('Ingresá un ticker');
      return;
    }
    if (!Number.isFinite(nominales) || nominales <= 0 || !Number.isInteger(nominales)) {
      setError('Ingresá una cantidad entera de nominales');
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
  }

  async function guardarMontoTotal() {
    const monto = Number(montoTotalTexto.replace(',', '.'));
    if (!Number.isFinite(monto) || monto <= 0) {
      setError('Ingresá un monto válido');
      return;
    }

    await repos.investments.agregar({
      ticker: etiquetaMonto.trim() || 'Cartera',
      nominales: 1,
      ppc: monto,
      monedaOriginal: 'ARS',
      cotizacionUsada: null,
      costoCentavosArsUnitario: costoUnitarioCentavosArs(monto, 'ARS', null),
      rubro: null,
      fecha: new Date().toISOString().slice(0, 10),
      status: 'OPEN',
    });
  }

  async function guardar() {
    setGuardando(true);
    try {
      if (modo === 'detallado') {
        await guardarDetallado();
      } else {
        await guardarMontoTotal();
      }
      router.back();
    } catch {
      setError('No se pudo guardar la inversión. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }
```

**Nota:** `guardarDetallado`/`guardarMontoTotal` llaman `setError(...)` y hacen `return` (sin `throw`) cuando la validación falla — `guardar()` no debe navegar (`router.back()`) en ese caso. Para lograrlo, cada validación fallida debe cortar el flujo antes de `repos.investments.agregar`; como ambas funciones son `async` y `guardar()` las espera con `await`, agregar al final de cada bloque de validación fallida (después de `setError(...)`) también un `return` que la función ya tiene. **El problema real:** `guardar()` como está arriba llamaría `router.back()` incluso si `guardarDetallado()` retornó temprano por un error de validación, porque un `return` sin `throw` no interrumpe el `try`. Corregir agregando un flag: reemplazar los `async function guardarDetallado()` / `async function guardarMontoTotal()` de arriba para que devuelvan `Promise<boolean>` (`true` si guardó, `false` si cortó por validación), y ajustar `guardar()`:

```typescript
  async function guardarDetallado(): Promise<boolean> {
    const nominales = Number(nominalesTexto.replace(',', '.'));
    const ppc = Number(ppcTexto.replace(',', '.'));

    if (!ticker.trim()) {
      setError('Ingresá un ticker');
      return false;
    }
    if (!Number.isFinite(nominales) || nominales <= 0 || !Number.isInteger(nominales)) {
      setError('Ingresá una cantidad entera de nominales');
      return false;
    }
    if (!Number.isFinite(ppc) || ppc <= 0) {
      setError('Ingresá un PPC válido');
      return false;
    }
    if (moneda === 'USD' && !cotizacion) {
      setError('No se pudo obtener la cotización del dólar, probá de nuevo');
      return false;
    }

    const cotizacionUsada = moneda === 'USD' ? cotizacion!.venta : null;

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
    return true;
  }

  async function guardarMontoTotal(): Promise<boolean> {
    const monto = Number(montoTotalTexto.replace(',', '.'));
    if (!Number.isFinite(monto) || monto <= 0) {
      setError('Ingresá un monto válido');
      return false;
    }

    await repos.investments.agregar({
      ticker: etiquetaMonto.trim() || 'Cartera',
      nominales: 1,
      ppc: monto,
      monedaOriginal: 'ARS',
      cotizacionUsada: null,
      costoCentavosArsUnitario: costoUnitarioCentavosArs(monto, 'ARS', null),
      rubro: null,
      fecha: new Date().toISOString().slice(0, 10),
      status: 'OPEN',
    });
    return true;
  }

  async function guardar() {
    setGuardando(true);
    try {
      const guardado = modo === 'detallado' ? await guardarDetallado() : await guardarMontoTotal();
      if (guardado) router.back();
    } catch {
      setError('No se pudo guardar la inversión. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }
```

(Usar directamente esta segunda versión — la primera versión de arriba, sin `boolean`, queda solo como explicación del problema a evitar; no la transcribas.)

- [ ] **Step 3: Agregar el chip de modo y los campos condicionales**

Reemplazar:

```typescript
  return (
    <BottomSheet titulo="Nueva inversión" onCerrar={() => router.back()}>
      <Text style={estilos.etiquetaCampo}>Ticker</Text>
      <TextInput value={ticker} onChangeText={setTicker} style={estilos.inputTexto} placeholder="Ej: GOOGL" autoCapitalize="characters" />

      <Text style={estilos.etiquetaCampo}>Nominales</Text>
      <TextInput
        value={nominalesTexto}
        onChangeText={setNominalesTexto}
        style={estilos.inputTexto}
        placeholder="Ej: 10"
        keyboardType="number-pad"
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

      <Toast texto={error} tipo="error" colors={colors} />

      <Pressable style={estilos.botonGuardar} onPress={guardar} disabled={guardando}>
        <Text style={estilos.textoBotonGuardar}>{guardando ? 'Guardando...' : 'Guardar inversión'}</Text>
      </Pressable>
    </BottomSheet>
  );
```

por:

```typescript
  return (
    <BottomSheet titulo="Nueva inversión" onCerrar={() => router.back()}>
      <View style={estilos.filaChips}>
        <Pressable
          onPress={() => {
            setModo('detallado');
            setError(null);
          }}
          style={[estilos.chip, modo === 'detallado' && estilos.chipActivo]}
        >
          <Text style={[estilos.textoChip, modo === 'detallado' && estilos.textoChipActivo]}>Detallado</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setModo('montoTotal');
            setError(null);
          }}
          style={[estilos.chip, modo === 'montoTotal' && estilos.chipActivo]}
        >
          <Text style={[estilos.textoChip, modo === 'montoTotal' && estilos.textoChipActivo]}>Monto total</Text>
        </Pressable>
      </View>

      {modo === 'detallado' ? (
        <>
          <Text style={estilos.etiquetaCampo}>Ticker</Text>
          <TextInput value={ticker} onChangeText={setTicker} style={estilos.inputTexto} placeholder="Ej: GOOGL" autoCapitalize="characters" />

          <Text style={estilos.etiquetaCampo}>Nominales</Text>
          <TextInput
            value={nominalesTexto}
            onChangeText={setNominalesTexto}
            style={estilos.inputTexto}
            placeholder="Ej: 10"
            keyboardType="number-pad"
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
        </>
      ) : (
        <>
          <Text style={estilos.etiquetaCampo}>Etiqueta (opcional)</Text>
          <TextInput value={etiquetaMonto} onChangeText={setEtiquetaMonto} style={estilos.inputTexto} placeholder="Ej: Cartera ByMA" />

          <Text style={estilos.etiquetaCampo}>Monto total (ARS)</Text>
          <TextInput
            value={montoTotalTexto}
            onChangeText={setMontoTotalTexto}
            style={estilos.inputTexto}
            placeholder="Ej: 500000"
            keyboardType="decimal-pad"
          />
        </>
      )}

      <Toast texto={error} tipo="error" colors={colors} />

      <Pressable style={estilos.botonGuardar} onPress={guardar} disabled={guardando}>
        <Text style={estilos.textoBotonGuardar}>{guardando ? 'Guardando...' : 'Guardar inversión'}</Text>
      </Pressable>
    </BottomSheet>
  );
```

- [ ] **Step 4: Verificar tests y typecheck**

Run: `npm test`
Expected: pasa igual que antes (esta pantalla no tiene test unitario propio).

Run: `npx tsc --noEmit`
Expected: los mismos 2 errores preexistentes, ninguno nuevo.

- [ ] **Step 5: Commit**

```bash
git add app/inversion-nueva.tsx
git commit -m "agrega modo Monto total en Nueva inversion"
```

---

### Task 6: Verificación final

- [ ] **Step 1: Correr toda la suite**

Run: `npm test`
Expected: 0 failing, incluye los tests nuevos de Tasks 1 y 3.

- [ ] **Step 2: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: los mismos 2 errores preexistentes de siempre, ninguno nuevo.

- [ ] **Step 3: Export web**

Run: `npx expo export -p web --clear`
Expected: build exitoso, sin errores de bundling. Confirmar que `expo-document-picker` no rompe el bundle web (usa el picker de archivos nativo del navegador).
