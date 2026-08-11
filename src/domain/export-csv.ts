import type { Investment, BrokerCash } from './types';

const ENCABEZADO = 'Ticker,Cantidad,PPC,Total,Sector,Status,Entrada';

function numeroConDosDecimales(valor: number): string {
  return valor.toFixed(2);
}

/**
 * Escapa un campo de texto libre para CSV: lo entrecomilla si contiene coma,
 * comilla o salto de línea (para no correr las columnas siguientes), o si
 * empieza con =, +, - o @ (para que Excel/Sheets no lo interprete como fórmula).
 */
function escaparCampo(valor: string): string {
  if (/[",\n]/.test(valor) || /^[=+\-@]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
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
      escaparCampo(i.ticker),
      i.nominales,
      numeroConDosDecimales(i.ppc),
      numeroConDosDecimales(total),
      escaparCampo(i.rubro ?? ''),
      i.status,
      i.fecha,
    ].join(',');
  });

  return [filaCash, ENCABEZADO, ...filasInversiones].join('\n');
}
