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
