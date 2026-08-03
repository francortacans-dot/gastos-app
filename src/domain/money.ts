/**
 * Toda la app trabaja en centavos enteros de ARS para evitar errores de
 * redondeo de punto flotante. El USD es solo una capa de visualización.
 */

/**
 * Convierte texto tipeado por la persona a centavos enteros.
 * Acepta '1.500,50' y '1500.50'. Devuelve null si no es un monto válido y positivo.
 */
export function parseAmountToCentavos(texto: string): number | null {
  const limpio = texto.trim();
  if (limpio === '') return null;

  // Si tiene coma, se asume formato argentino: el punto es separador de miles.
  const normalizado = limpio.includes(',')
    ? limpio.replace(/\./g, '').replace(',', '.')
    : limpio;

  const valor = Number(normalizado);
  if (!Number.isFinite(valor) || valor < 0) return null;

  return Math.round(valor * 100);
}

/** Formatea centavos de ARS como '$ 1.500,50'. */
export function formatCentavos(centavos: number): string {
  const negativo = centavos < 0;
  const absoluto = Math.abs(centavos);
  const enteros = Math.floor(absoluto / 100);
  const decimales = absoluto % 100;

  const enterosConSeparador = enteros
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const texto = `$ ${enterosConSeparador},${decimales.toString().padStart(2, '0')}`;
  return negativo ? `-${texto}` : texto;
}

/** Convierte un monto en USD a centavos de ARS usando la cotización dada. */
export function usdToCentavosArs(montoUsd: number, cotizacion: number): number {
  return Math.round(montoUsd * cotizacion * 100);
}

/** Convierte centavos de ARS a un monto en USD usando la cotización dada. */
export function centavosArsToUsd(centavos: number, cotizacion: number): number {
  if (cotizacion === 0) return 0;
  return centavos / 100 / cotizacion;
}

/** Formatea un monto en dólares como 'US$ 10,00'. */
export function formatUsd(monto: number): string {
  const negativo = monto < 0;
  const absoluto = Math.abs(monto);
  const enteros = Math.floor(absoluto);
  const decimales = Math.round((absoluto - enteros) * 100);

  const enterosConSeparador = enteros
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const texto = `US$ ${enterosConSeparador},${decimales.toString().padStart(2, '0')}`;
  return negativo ? `-${texto}` : texto;
}
