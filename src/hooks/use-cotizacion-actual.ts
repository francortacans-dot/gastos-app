import { useEffect, useState } from 'react';
import { obtenerCotizacionConCache, type Cotizacion } from '../rates/dolar';
import { rateCacheStorage } from '../rates/rate-cache-storage';
import type { RateKind } from '../domain/types';

/** Cada cuánto se refresca la cotización mientras la app sigue abierta. */
const INTERVALO_REFRESCO_MS = 5 * 60 * 1000;

export function useCotizacionActual(casa: RateKind): Cotizacion | null {
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);

  useEffect(() => {
    let vigente = true;

    function refrescar() {
      obtenerCotizacionConCache(casa, rateCacheStorage)
        .then((c) => {
          if (vigente) setCotizacion(c);
        })
        .catch((error) => {
          console.warn('No se pudo obtener la cotización y no hay cache:', error);
        });
    }

    refrescar();
    const intervalo = setInterval(refrescar, INTERVALO_REFRESCO_MS);

    return () => {
      vigente = false;
      clearInterval(intervalo);
    };
  }, [casa]);

  return cotizacion;
}
