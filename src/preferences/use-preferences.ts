import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useApp } from '../app-context';
import { getFirestoreDb } from '../firebase/app';
import type { RateKind } from '../domain/types';
import type { TemaId } from '../theme/palettes';

interface Preferencias {
  monedaVisualizacion: 'ARS' | 'USD';
  cotizacionPreferida: RateKind;
  tema: TemaId;
}

const DEFAULT: Preferencias = { monedaVisualizacion: 'ARS', cotizacionPreferida: 'oficial', tema: 'gris' };

export function usePreferences() {
  const { uid } = useApp();
  const [preferencias, setPreferencias] = useState<Preferencias>(DEFAULT);

  useEffect(() => {
    const ref = doc(getFirestoreDb(), 'users', uid, 'settings', 'preferences');
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const datos = snap.data();
      setPreferencias({
        monedaVisualizacion: (datos.monedaVisualizacion as Preferencias['monedaVisualizacion']) ?? DEFAULT.monedaVisualizacion,
        cotizacionPreferida: (datos.cotizacionPreferida as RateKind) ?? DEFAULT.cotizacionPreferida,
        tema: (datos.tema as TemaId) ?? DEFAULT.tema,
      });
    });
  }, [uid]);

  async function actualizar(parcial: Partial<Preferencias>) {
    const ref = doc(getFirestoreDb(), 'users', uid, 'settings', 'preferences');
    await setDoc(ref, parcial, { merge: true });
  }

  return {
    ...preferencias,
    setMonedaVisualizacion: (m: Preferencias['monedaVisualizacion']) => actualizar({ monedaVisualizacion: m }),
    setCotizacionPreferida: (c: RateKind) => actualizar({ cotizacionPreferida: c }),
    setTema: (t: TemaId) => actualizar({ tema: t }),
  };
}
