import * as XLSX from 'xlsx';
import { parsearCsvInversiones, type ResultadoParseoCsv } from './import-csv-inversiones';

/**
 * Parsea un .xlsx con las mismas columnas que el CSV de importación
 * (ticker,nominales,precio,moneda,rubro,fecha, en la primera hoja).
 * Convierte la hoja a texto CSV y reutiliza `parsearCsvInversiones` para
 * no duplicar las validaciones.
 */
export function parsearXlsxInversiones(bytes: Uint8Array, fechaHoy: string): ResultadoParseoCsv {
  const libro = XLSX.read(bytes, { type: 'array' });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) return { posiciones: [], errores: [] };

  const csv = XLSX.utils.sheet_to_csv(hoja);
  return parsearCsvInversiones(csv, fechaHoy);
}
