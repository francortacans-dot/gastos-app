import { useEffect, useState } from 'react';
import { obtenerCotizacionConCache, type Cotizacion } from '../rates/dolar';
import { rateCacheStorage } from '../rates/rate-cache-storage';
import type { RateKind } from '../domain/types';

export function useCotizacionActual(casa: RateKind): Cotizacion | null {
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerCotizacionConCache(casa, rateCacheStorage)
      .then((c) => {
        if (vigente) setCotizacion(c);
      })
      .catch((error) => {
        console.warn('No se pudo obtener la cotización y no hay cache:', error);
      });
    return () => {
      vigente = false;
    };
  }, [casa]);

  return cotizacion;
}
