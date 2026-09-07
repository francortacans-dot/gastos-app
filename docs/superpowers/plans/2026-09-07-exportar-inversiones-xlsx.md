# Exportar Inversiones a xlsx — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Este plan es independiente de los otros tres** (`gastos-editables`, `reporte-sectores-anual`, `autoasignar-sector`) — no toca ningún archivo que ellos toquen, se puede ejecutar en cualquier orden relativo a esos.

**Goal:** Agregar la opción de exportar el portfolio de Inversiones como archivo `.xlsx` real (columnas separadas), eligiendo el formato (CSV o Excel) al tocar el botón "Exportar" ya existente.

**Architecture:** Librería `xlsx` (SheetJS, JS puro) genera el archivo como string base64; un servicio nuevo (`compartir-xlsx.ts`, hermano de `compartir-csv.ts` ya existente) lo escribe a archivo y lo comparte, mismo patrón multiplataforma (web: descarga por Blob; nativo: `expo-file-system` + `expo-sharing`) que ya usa el CSV.

**Tech Stack:** TypeScript, `xlsx` (SheetJS, nueva dependencia), `expo-file-system`/`expo-sharing` (ya instaladas), Jest.

## Global Constraints

- **Moneda canónica: ARS en centavos enteros** — igual que `generarCsvPortfolio`, los montos se convierten a la unidad (no centavos) recién al armar la fila, para que se vean como plata en la celda.
- **Comentarios en español.** camelCase/kebab-case/PascalCase.
- **TDD** para `src/domain/export-xlsx.ts`. Sin tests para `src/services/compartir-xlsx.ts` (glue de plataforma — mismo criterio que `compartir-csv.ts`, que tampoco tiene test) ni para la pantalla `inversiones.tsx`.
- **Misma estructura que el CSV existente**: fila CASH, encabezado `Ticker,Cantidad,PPC,Total,Sector,Status,Entrada`, una fila por inversión (abierta o cerrada), una sola hoja.
- **API de `expo-file-system` verificada** contra `https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/`: `File.write(contenido, { encoding: 'base64' })` para escribir contenido base64 a archivo.
- **Commits en español, descriptivos, en imperativo.**

---

## Task 1: Dependencia `xlsx` + `generarXlsxPortfolio`

**Files:**
- Modify: `package.json` (agrega `xlsx`)
- Create: `src/domain/export-xlsx.ts`
- Create: `src/domain/__tests__/export-xlsx.test.ts`

**Interfaces:**
- Consumes: `Investment`, `BrokerCash` de `src/domain/types.ts`; `costoTotalPosicion` de `src/domain/investments.ts` (ya existen, sin cambios)
- Produces: `function generarXlsxPortfolio(inversiones: Investment[], brokerCash: BrokerCash): string` (devuelve el archivo como string base64) — usado por Task 3.

- [ ] **Step 1: Instalar la dependencia**

```bash
npm install xlsx@0.18.5
```

Verificar que `package.json` quedó con `"xlsx": "0.18.5"` (o `"^0.18.5"`, según lo que escriba `npm install`) en `dependencies`.

- [ ] **Step 2: Escribir los tests que fallan**

Crear `src/domain/__tests__/export-xlsx.test.ts`:

```typescript
import * as XLSX from 'xlsx';
import { generarXlsxPortfolio } from '../export-xlsx';
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

/** Decodifica el base64 devuelto y lo vuelve a leer como array de filas (array de arrays). */
function filasDelXlsx(base64: string): unknown[][] {
  const libro = XLSX.read(base64, { type: 'base64' });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  return XLSX.utils.sheet_to_json(hoja, { header: 1 });
}

describe('generarXlsxPortfolio', () => {
  it('genera la fila CASH con el saldo del broker', () => {
    const brokerCash: BrokerCash = { id: 'actual', centavosArs: 11336 };
    const filas = filasDelXlsx(generarXlsxPortfolio([], brokerCash));

    expect(filas[0]).toEqual(['CASH', 113.36, '---', 113.36, 'Disponible', 'ACTIVE', '---']);
  });

  it('incluye el encabezado esperado', () => {
    const filas = filasDelXlsx(generarXlsxPortfolio([], { id: 'actual', centavosArs: 0 }));

    expect(filas[1]).toEqual(['Ticker', 'Cantidad', 'PPC', 'Total', 'Sector', 'Status', 'Entrada']);
  });

  it('agrega una fila por cada inversión, con el total calculado como número', () => {
    const inversiones = [inversion({ ticker: 'BMA', nominales: 10, ppc: 9.42, costoCentavosArsUnitario: 942 })];
    const filas = filasDelXlsx(generarXlsxPortfolio(inversiones, { id: 'actual', centavosArs: 0 }));

    expect(filas[2]).toEqual(['BMA', 10, 9.42, 94.2, 'Bancos-ARG', 'OPEN', '2026-08-11']);
  });

  it('usa un string vacío cuando no hay rubro', () => {
    const inversiones = [inversion({ rubro: null })];
    const filas = filasDelXlsx(generarXlsxPortfolio(inversiones, { id: 'actual', centavosArs: 0 }));

    expect(filas[2][4]).toBe('');
  });

  it('incluye posiciones cerradas también', () => {
    const inversiones = [inversion({ status: 'CLOSED', nominales: 0 })];
    const filas = filasDelXlsx(generarXlsxPortfolio(inversiones, { id: 'actual', centavosArs: 0 }));

    expect(filas[2][5]).toBe('CLOSED');
  });
});
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npx jest export-xlsx`
Expected: FAIL — "Cannot find module '../export-xlsx'".

- [ ] **Step 4: Implementar `src/domain/export-xlsx.ts`**

```typescript
import * as XLSX from 'xlsx';
import type { Investment, BrokerCash } from './types';
import { costoTotalPosicion } from './investments';

/**
 * Genera el .xlsx del portfolio (misma estructura que generarCsvPortfolio:
 * fila CASH, encabezado, una fila por inversión abierta o cerrada) como
 * string base64, listo para escribir a archivo o descargar.
 */
export function generarXlsxPortfolio(inversiones: Investment[], brokerCash: BrokerCash): string {
  const montoCash = brokerCash.centavosArs / 100;
  const filas: (string | number)[][] = [
    ['CASH', montoCash, '---', montoCash, 'Disponible', 'ACTIVE', '---'],
    ['Ticker', 'Cantidad', 'PPC', 'Total', 'Sector', 'Status', 'Entrada'],
    ...inversiones.map((i) => [
      i.ticker,
      i.nominales,
      i.ppc,
      costoTotalPosicion(i) / 100,
      i.rubro ?? '',
      i.status,
      i.fecha,
    ]),
  ];

  const hoja = XLSX.utils.aoa_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Portfolio');
  return XLSX.write(libro, { type: 'base64', bookType: 'xlsx' });
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx jest export-xlsx`
Expected: PASS — los 5 tests pasan.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/domain/export-xlsx.ts src/domain/__tests__/export-xlsx.test.ts
git commit -m "agrega generador de xlsx del portfolio de inversiones"
```

---

## Task 2: Servicio `compartir-xlsx.ts`

**Files:**
- Create: `src/services/compartir-xlsx.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores directamente (recibe el base64 ya generado)
- Produces: `function compartirXlsx(base64: string): Promise<void>` — usado por Task 3.

Sin test — mismo criterio que `src/services/compartir-csv.ts`, que tampoco tiene test (glue de plataforma, ver Global Constraints).

- [ ] **Step 1: Implementar `src/services/compartir-xlsx.ts`**

```typescript
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const NOMBRE_ARCHIVO = 'portfolio.xlsx';
const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Igual que compartirCsv (src/services/compartir-csv.ts) pero recibe el
 * contenido del xlsx ya codificado en base64: en web decodifica a bytes
 * para armar el Blob de descarga; en nativo escribe el archivo con
 * encoding 'base64' en vez de texto plano.
 */
export async function compartirXlsx(base64: string): Promise<void> {
  if (Platform.OS === 'web') {
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    const blob = new Blob([bytes], { type: MIME_TYPE });
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
  archivo.write(base64, { encoding: 'base64' });

  const disponible = await Sharing.isAvailableAsync();
  if (disponible) {
    await Sharing.shareAsync(archivo.uri, { mimeType: MIME_TYPE, dialogTitle: 'Compartir portfolio' });
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: misma línea base de errores preexistentes de siempre, nada nuevo.

- [ ] **Step 3: Commit**

```bash
git add src/services/compartir-xlsx.ts
git commit -m "agrega servicio para escribir y compartir el xlsx de inversiones"
```

---

## Task 3: Elegir formato al exportar en `inversiones.tsx`

**Files:**
- Modify: `app/(tabs)/inversiones.tsx`

**Interfaces:**
- Consumes: `generarXlsxPortfolio` (Task 1), `compartirXlsx` (Task 2)
- Produces: nada nuevo — pantalla terminal de este plan.

Sin tests automáticos de pantallas — verificar con `npx tsc --noEmit`.

- [ ] **Step 1: Agregar los imports nuevos**

Agregar, junto a los imports ya existentes de `export-csv`/`compartir-csv`:

```typescript
import { generarXlsxPortfolio } from '../../src/domain/export-xlsx';
import { compartirXlsx } from '../../src/services/compartir-xlsx';
```

- [ ] **Step 2: Reemplazar la función `exportar` por `exportarCsv`/`exportarXlsx`/`elegirFormatoExportar`**

Cambiar:

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

a:

```typescript
  async function exportarCsv() {
    setError(null);
    try {
      const csv = generarCsvPortfolio(inversiones, brokerCash);
      await compartirCsv(csv);
    } catch {
      setError('No se pudo exportar el CSV. Probá de nuevo.');
    }
  }

  async function exportarXlsx() {
    setError(null);
    try {
      const base64 = generarXlsxPortfolio(inversiones, brokerCash);
      await compartirXlsx(base64);
    } catch {
      setError('No se pudo exportar el Excel. Probá de nuevo.');
    }
  }

  function elegirFormatoExportar() {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Aceptar = Excel (.xlsx). Cancelar = CSV.')) {
        exportarXlsx();
      } else {
        exportarCsv();
      }
      return;
    }
    Alert.alert('Exportar portfolio', '¿En qué formato?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'CSV', onPress: exportarCsv },
      { text: 'Excel (.xlsx)', onPress: exportarXlsx },
    ]);
  }
```

(`Platform` y `Alert` ya están importados en este archivo desde `'react-native'`, usados por `eliminarPosicion`.)

- [ ] **Step 3: Cambiar el botón "Exportar" para usar el nuevo selector**

Cambiar:

```tsx
              <Pressable onPress={exportar} style={estilos.botonExportar}>
                <Text style={estilos.textoExportar}>Exportar</Text>
              </Pressable>
```

a:

```tsx
              <Pressable onPress={elegirFormatoExportar} style={estilos.botonExportar}>
                <Text style={estilos.textoExportar}>Exportar</Text>
              </Pressable>
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: misma línea base de errores preexistentes de siempre, nada nuevo.

- [ ] **Step 5: Correr la suite completa**

Run: `npm test`
Expected: PASS — todos los tests, incluidos los de la Task 1.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/inversiones.tsx"
git commit -m "permite elegir CSV o Excel al exportar el portfolio de inversiones"
```
