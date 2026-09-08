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
