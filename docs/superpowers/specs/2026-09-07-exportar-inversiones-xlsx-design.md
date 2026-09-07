# Exportar Inversiones también a xlsx — Diseño

Fecha: 2026-09-07

## Propósito

Cuarta y última de las cuatro piezas independientes. Hoy el botón
"Exportar" de la pestaña Inversiones solo genera CSV
(`generarCsvPortfolio` + `compartirCsv`). Se agrega la opción de exportar el
mismo contenido como archivo `.xlsx` real (columnas separadas, abre directo
en Excel/Sheets con formato de tabla), eligiendo el formato al tocar el
mismo botón.

## 1. Dependencia nueva: `xlsx` (SheetJS)

Librería pura JS (sin módulos nativos), funciona igual en Expo/React Native
y en web. Se instala con `npm install xlsx` (no es un paquete Expo, así que
no lleva `npx expo install`, pero sí hay que fijar una versión exacta en
`package.json` como ya se hace con el resto de dependencias).

## 2. Dominio: `generarXlsxPortfolio`

Nuevo archivo `src/domain/export-xlsx.ts`, misma estructura de datos que ya
arma `generarCsvPortfolio` (`src/domain/export-csv.ts`) — fila CASH, encabezado,
una fila por inversión — pero como filas de una sola hoja de cálculo, sin
texto/comas/escapado (cada valor va en su propia celda, no hace falta la
lógica de `escaparCampo` que sí necesita el CSV):

```ts
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

Se testea con Jest igual que `export-csv.test.ts` (mismos casos: fila CASH,
encabezado, fila por inversión, `rubro` null, incluye cerradas) — comparando
el contenido de las celdas vía `XLSX.read` sobre el base64 devuelto, no el
string crudo (a diferencia del CSV, acá no hay un string de texto plano para
comparar directo).

## 3. Servicio: escribir y compartir el xlsx

Nuevo archivo `src/services/compartir-xlsx.ts`, mismo patrón que
`src/services/compartir-csv.ts` (rama `Platform.OS === 'web'` con
Blob+descarga, rama nativa con `expo-file-system` + `expo-sharing`), con la
única diferencia real: el contenido ya viene en base64 (no texto plano), así
que la escritura a archivo usa `{ encoding: 'base64' }` (API verificada
contra `https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/`: `File.write(contenido,
{ encoding: 'base64' })`), y en web el `Blob` se arma decodificando ese
base64 a bytes en vez de pasarle un string:

```ts
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const NOMBRE_ARCHIVO = 'portfolio.xlsx';
const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Igual que compartirCsv, pero recibe el contenido del xlsx ya en base64. */
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

## 4. UI: elegir formato al exportar

En `app/(tabs)/inversiones.tsx`, el botón "Exportar" pasa de llamar
directamente a `exportar()` (que hoy solo hace CSV) a abrir un `Alert.alert`
con dos opciones (mismo patrón multiplataforma ya usado para la confirmación
de "Eliminar inversión": `Alert.alert` en nativo, `window.confirm`-equivalente
en web — acá con más de una opción real, en web se resuelve con un
`window.confirm` de "¿Exportar como Excel? Cancelar = CSV" dado que
`window.confirm` solo tiene dos botones):

```ts
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

El botón "Exportar" pasa a llamar `elegirFormatoExportar` en vez de
`exportar` directo (se elimina la función `exportar` vieja, reemplazada por
`exportarCsv`/`exportarXlsx`/`elegirFormatoExportar`).

## Fuera de alcance

- Exportar el historial de ventas en una hoja aparte — se pidió mantener la
  misma estructura de una sola hoja que ya tiene el CSV.
- Exportar Gastos/Ahorro/Sectores a xlsx — solo se pidió para Inversiones.
