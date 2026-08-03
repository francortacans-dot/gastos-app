import type { RateKind } from '../domain/types';

export interface Cotizacion {
  casa: RateKind;
  /** Precio de compra del dólar, en pesos. */
  compra: number;
  /** Precio de venta del dólar, en pesos. Es el que se usa para convertir gastos. */
  venta: number;
  fechaActualizacion: string;
}

interface RespuestaDolarApi {
  casa: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

const TIMEOUT_MS = 8000;

/** Pide la cotización actual a dolarapi.com. Lanza si la red falla o la respuesta no es ok. */
export async function obtenerCotizacion(casa: RateKind): Promise<Cotizacion> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(`https://dolarapi.com/v1/dolares/${casa}`, {
      signal: controller.signal,
    });
    if (!respuesta.ok) {
      throw new Error(`dolarapi respondió ${respuesta.status}`);
    }
    const datos: RespuestaDolarApi = await respuesta.json();
    return {
      casa,
      compra: datos.compra,
      venta: datos.venta,
      fechaActualizacion: datos.fechaActualizacion,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Interfaz de cache que implementan AsyncStorage (celular) y localStorage (escritorio). */
export interface RateCache {
  guardar(cotizacion: Cotizacion): Promise<void>;
  leer(casa: RateKind): Promise<Cotizacion | null>;
}

/**
 * Intenta traer la cotización fresca de la red. Si falla (sin conexión, timeout),
 * devuelve la última guardada en cache. Si tampoco hay cache, propaga el error.
 */
export async function obtenerCotizacionConCache(
  casa: RateKind,
  cache: RateCache
): Promise<Cotizacion> {
  try {
    const fresca = await obtenerCotizacion(casa);
    await cache.guardar(fresca);
    return fresca;
  } catch (error) {
    const cacheada = await cache.leer(casa);
    if (cacheada) return cacheada;
    throw error;
  }
}
