import * as XLSX from 'xlsx';
import { parsearFilasInversion, type ResultadoParseoCsv } from './import-csv-inversiones';

const ENCABEZADO_GENERICO = ['ticker', 'nominales', 'precio', 'moneda', 'rubro', 'fecha'];

/**
 * Encabezados del export "Mis Instrumentos" de IOL (broker), que trae
 * muchas más columnas que nuestro formato genérico y con otros nombres.
 * Si el .xlsx tiene estas columnas lo remapeamos al layout genérico antes
 * de validar, en vez de pedirle al usuario que edite el archivo del broker.
 */
const COLUMNAS_IOL = ['ticker', 'nominales', 'moneda', 'precio promedio de compra', 'tipo de instrumento'];

function normalizarCelda(valor: unknown): string {
  if (valor === undefined || valor === null) return '';
  return String(valor).trim();
}

function monedaDesdeIol(texto: string): string {
  const normalizado = texto.trim().toLowerCase();
  if (normalizado === 'pesos') return 'ARS';
  if (normalizado === 'dólares' || normalizado === 'dolares') return 'USD';
  return texto.toUpperCase();
}

function esFormatoIol(encabezado: string[]): boolean {
  return COLUMNAS_IOL.every((c) => encabezado.includes(c));
}

/** Remapea las filas del export de IOL al layout genérico ticker,nominales,precio,moneda,rubro,fecha. */
function remapearDesdeIol(filas: string[][]): string[][] {
  const encabezado = filas[0].map((c) => c.toLowerCase());
  const idx = (nombre: string) => encabezado.indexOf(nombre);
  const idxTicker = idx('ticker');
  const idxNominales = idx('nominales');
  const idxPpc = idx('precio promedio de compra');
  const idxMoneda = idx('moneda');
  const idxRubro = idx('tipo de instrumento');

  const filasRemapeadas = filas.slice(1).map((fila) => [
    fila[idxTicker] ?? '',
    fila[idxNominales] ?? '',
    fila[idxPpc] ?? '',
    monedaDesdeIol(fila[idxMoneda] ?? ''),
    fila[idxRubro] ?? '',
    '', // la columna "Fecha" del export de IOL es una hora, no una fecha: se ignora y se usa fechaHoy
  ]);

  return [ENCABEZADO_GENERICO, ...filasRemapeadas];
}

/**
 * Parsea un .xlsx de posiciones. Soporta dos formatos:
 * - el genérico (ticker,nominales,precio,moneda,rubro,fecha), y
 * - el export "Mis Instrumentos" de IOL, remapeado automáticamente.
 */
export function parsearXlsxInversiones(bytes: Uint8Array, fechaHoy: string): ResultadoParseoCsv {
  const libro = XLSX.read(bytes, { type: 'array' });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) return { posiciones: [], errores: [] };

  const filasCrudas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1 });
  const filas = filasCrudas
    .map((fila) => fila.map(normalizarCelda))
    .filter((fila) => fila.some((c) => c.length > 0));

  if (filas.length === 0) return { posiciones: [], errores: [] };

  const encabezado = filas[0].map((c) => c.toLowerCase());
  const filasParaValidar = esFormatoIol(encabezado) ? remapearDesdeIol(filas) : filas;

  return parsearFilasInversion(filasParaValidar, fechaHoy);
}
