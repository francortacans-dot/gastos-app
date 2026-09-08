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
