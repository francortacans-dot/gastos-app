import type { Currency, Investment } from './types';
import { usdToCentavosArs } from './money';

/** Convierte un precio por nominal en su moneda original a centavos de ARS por nominal. */
export function costoUnitarioCentavosArs(
  precio: number,
  monedaOriginal: Currency,
  cotizacionUsada: number | null
): number {
  if (monedaOriginal === 'ARS') return Math.round(precio * 100);
  return usdToCentavosArs(precio, cotizacionUsada ?? 0);
}

/** Costo total de una posición: nominales actuales * costo unitario. Nunca se guarda, se calcula siempre así. */
export function costoTotalPosicion(inversion: Investment): number {
  return inversion.nominales * inversion.costoCentavosArsUnitario;
}

/** Suma el costo de todas las posiciones abiertas (status OPEN). */
export function costoTotalAbierto(inversiones: Investment[]): number {
  return inversiones
    .filter((i) => i.status === 'OPEN')
    .reduce((acc, i) => acc + costoTotalPosicion(i), 0);
}

/** Patrimonio en inversiones: costo de lo invertido más el cash sin invertir en el broker. */
export function patrimonioInversiones(inversiones: Investment[], brokerCashCentavosArs: number): number {
  return costoTotalAbierto(inversiones) + brokerCashCentavosArs;
}

export interface ResultadoVenta {
  ingresoCentavosArs: number;
  gananciaCentavosArs: number;
}

/**
 * Calcula el resultado de vender `nominalesVendidos` de una posición a `precioVenta`
 * (en la monedaOriginal de la inversión). Lanza si se intenta vender 0, negativo, o
 * más nominales de los que hay disponibles.
 */
export function calcularVenta(
  inversion: Investment,
  nominalesVendidos: number,
  precioVenta: number,
  cotizacionUsada: number | null
): ResultadoVenta {
  if (nominalesVendidos <= 0) {
    throw new Error('nominalesVendidos debe ser mayor a 0');
  }
  if (nominalesVendidos > inversion.nominales) {
    throw new Error('No se pueden vender más nominales de los que hay en la posición');
  }

  const precioVentaCentavosArsUnitario = costoUnitarioCentavosArs(
    precioVenta,
    inversion.monedaOriginal,
    cotizacionUsada
  );
  const ingresoCentavosArs = nominalesVendidos * precioVentaCentavosArsUnitario;
  const costoCentavosArs = nominalesVendidos * inversion.costoCentavosArsUnitario;
  const gananciaCentavosArs = ingresoCentavosArs - costoCentavosArs;

  return { ingresoCentavosArs, gananciaCentavosArs };
}
