import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Cotizacion, RateCache } from './dolar';
import type { RateKind } from '../domain/types';

const clave = (casa: RateKind) => `cotizacion_${casa}`;

/** Cache respaldada por AsyncStorage. Funciona igual en celular y en web (usa localStorage por debajo). */
export const rateCacheStorage: RateCache = {
  async guardar(cotizacion: Cotizacion): Promise<void> {
    await AsyncStorage.setItem(clave(cotizacion.casa), JSON.stringify(cotizacion));
  },
  async leer(casa: RateKind): Promise<Cotizacion | null> {
    const json = await AsyncStorage.getItem(clave(casa));
    return json ? JSON.parse(json) : null;
  },
};
