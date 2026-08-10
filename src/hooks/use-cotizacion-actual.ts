import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
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

    // En el navegador (y al volver del segundo plano en el celular), setInterval se
    // frena o se pausa mientras la pestaña/app no está activa: sin esto, al volver a
    // abrir la app después de un rato se seguía viendo la cotización vieja hasta que
    // tocara el próximo intervalo, que podía tardar minutos de más.
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') refrescar();
    });

    return () => {
      vigente = false;
      clearInterval(intervalo);
      suscripcion.remove();
    };
  }, [casa]);

  return cotizacion;
}
