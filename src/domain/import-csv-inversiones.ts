import type { Currency } from './types';

export interface PosicionImportada {
  ticker: string;
  nominales: number;
  ppc: number;
  monedaOriginal: Currency;
  rubro: string | null;
  fecha: string;
}

export interface ErrorFilaImportacion {
  fila: number;
  motivo: string;
}

export interface ResultadoParseoCsv {
  posiciones: PosicionImportada[];
  errores: ErrorFilaImportacion[];
}

const COLUMNAS_REQUERIDAS = ['ticker', 'nominales', 'precio', 'moneda'] as const;
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parsea un CSV con columnas ticker,nominales,precio,moneda,rubro,fecha
 * (rubro y fecha son opcionales; fecha vacía usa `fechaHoy`). Las filas
 * inválidas se reportan en `errores` (con el número de fila, contando el
 * encabezado como fila 1) sin interrumpir el resto de la importación.
 */
export function parsearCsvInversiones(csv: string, fechaHoy: string): ResultadoParseoCsv {
  const lineas = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lineas.length === 0) {
    return { posiciones: [], errores: [] };
  }

  const encabezado = lineas[0].split(',').map((c) => c.trim().toLowerCase());
  const indiceDe = (nombre: string) => encabezado.indexOf(nombre);

  const columnasFaltantes = COLUMNAS_REQUERIDAS.filter((c) => indiceDe(c) === -1);
  if (columnasFaltantes.length > 0) {
    return {
      posiciones: [],
      errores: [{ fila: 1, motivo: `Faltan columnas: ${columnasFaltantes.join(', ')}` }],
    };
  }

  const idxTicker = indiceDe('ticker');
  const idxNominales = indiceDe('nominales');
  const idxPrecio = indiceDe('precio');
  const idxMoneda = indiceDe('moneda');
  const idxRubro = indiceDe('rubro');
  const idxFecha = indiceDe('fecha');

  const posiciones: PosicionImportada[] = [];
  const errores: ErrorFilaImportacion[] = [];

  for (let i = 1; i < lineas.length; i++) {
    const fila = i + 1;
    const columnas = lineas[i].split(',').map((c) => c.trim());

    const ticker = columnas[idxTicker]?.toUpperCase();
    const nominales = Number(columnas[idxNominales]?.replace(',', '.'));
    const precio = Number(columnas[idxPrecio]?.replace(',', '.'));
    const monedaTexto = columnas[idxMoneda]?.toUpperCase();
    const rubro = idxRubro >= 0 ? columnas[idxRubro]?.trim() || null : null;
    const fechaTexto = idxFecha >= 0 ? columnas[idxFecha]?.trim() : '';
    const fecha = fechaTexto || fechaHoy;

    if (!ticker) {
      errores.push({ fila, motivo: 'Falta el ticker' });
      continue;
    }
    if (!Number.isFinite(nominales) || nominales <= 0) {
      errores.push({ fila, motivo: 'Nominales inválidos' });
      continue;
    }
    if (!Number.isFinite(precio) || precio <= 0) {
      errores.push({ fila, motivo: 'Precio inválido' });
      continue;
    }
    if (monedaTexto !== 'ARS' && monedaTexto !== 'USD') {
      errores.push({ fila, motivo: 'Moneda inválida (debe ser ARS o USD)' });
      continue;
    }
    if (!FORMATO_FECHA.test(fecha)) {
      errores.push({ fila, motivo: 'Fecha inválida (formato YYYY-MM-DD)' });
      continue;
    }

    posiciones.push({ ticker, nominales, ppc: precio, monedaOriginal: monedaTexto, rubro, fecha });
  }

  return { posiciones, errores };
}
