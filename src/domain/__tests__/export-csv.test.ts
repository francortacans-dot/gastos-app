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
