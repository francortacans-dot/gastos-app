import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useApp } from '../app-context';
import { usePinGate } from './pin-gate';
import { getFirestoreDb } from '../firebase/app';

interface PinGateContextValue {
  desbloqueado: boolean;
  pinGuardado: string | null;
  intentarDesbloquear: (pin: string) => Promise<boolean>;
  guardarPin: (pin: string) => Promise<void>;
  /** true mientras todavía no se resolvió la lectura de Firestore del hash guardado. */
  cargando: boolean;
}

const PinGateContext = createContext<PinGateContextValue | null>(null);

/**
 * Provee una única instancia compartida del candado de PIN (`usePinGate`) más
 * la lectura de Firestore del hash guardado, para que `CandadoDePin` (en
 * `app/_layout.tsx`) y `PantallaPin` (en `app/pin.tsx`) lean y actualicen el
 * mismo estado en vez de crear cada uno su propia instancia desconectada.
 */
export function PinGateProvider({ children }: { children: React.ReactNode }) {
  const { uid } = useApp();
  const [pinHashGuardado, setPinHashGuardado] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const ref = doc(getFirestoreDb(), 'users', uid, 'settings', 'preferences');
    getDoc(ref).then((snap) => {
      setPinHashGuardado(snap.exists() ? (snap.data().pinHash as string) ?? null : null);
    });
  }, [uid]);

  const gate = usePinGate({
    pinHashGuardado: pinHashGuardado ?? null,
    guardarHash: async (hash) => {
      const ref = doc(getFirestoreDb(), 'users', uid, 'settings', 'preferences');
      await setDoc(ref, { pinHash: hash }, { merge: true });
    },
  });

  const valor: PinGateContextValue = {
    ...gate,
    cargando: pinHashGuardado === undefined,
  };

  return <PinGateContext.Provider value={valor}>{children}</PinGateContext.Provider>;
}

export function usePinGateContext(): PinGateContextValue {
  const valor = useContext(PinGateContext);
  if (!valor) throw new Error('usePinGateContext() debe usarse dentro de <PinGateProvider>');
  return valor;
}
