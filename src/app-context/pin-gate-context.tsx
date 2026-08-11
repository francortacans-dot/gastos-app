import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const CLAVE_DESBLOQUEO_RECORDADO = 'pin_desbloqueado_hasta';
/** Cuánto tiempo se recuerda el desbloqueo entre recargas, para no pedir el PIN todo el rato. */
const DURACION_DESBLOQUEO_MS = 30 * 60 * 1000;

/**
 * Provee una única instancia compartida del candado de PIN (`usePinGate`) más
 * la lectura de Firestore del hash guardado, para que `CandadoDePin` (en
 * `app/_layout.tsx`) y `PantallaPin` (en `app/pin.tsx`) lean y actualicen el
 * mismo estado en vez de crear cada uno su propia instancia desconectada.
 *
 * Además recuerda el desbloqueo por `DURACION_DESBLOQUEO_MS` en almacenamiento
 * local del dispositivo (no en Firestore: es una comodidad de este navegador,
 * no algo que deba viajar entre dispositivos), para no pedir el PIN en cada
 * recarga de página como si fuera la primera vez.
 */
export function PinGateProvider({ children }: { children: React.ReactNode }) {
  const { uid } = useApp();
  const [pinHashGuardado, setPinHashGuardado] = useState<string | null | undefined>(undefined);
  const [desbloqueoRecordado, setDesbloqueoRecordado] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const ref = doc(getFirestoreDb(), 'users', uid, 'settings', 'preferences');
    getDoc(ref).then((snap) => {
      setPinHashGuardado(snap.exists() ? (snap.data().pinHash as string) ?? null : null);
    });
  }, [uid]);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE_DESBLOQUEO_RECORDADO).then((valor) => {
      const hasta = valor ? Number(valor) : 0;
      setDesbloqueoRecordado(Date.now() < hasta);
    });
  }, []);

  const gate = usePinGate({
    pinHashGuardado: pinHashGuardado ?? null,
    guardarHash: async (hash) => {
      const ref = doc(getFirestoreDb(), 'users', uid, 'settings', 'preferences');
      await setDoc(ref, { pinHash: hash }, { merge: true });
    },
  });

  useEffect(() => {
    if (gate.desbloqueado) {
      AsyncStorage.setItem(CLAVE_DESBLOQUEO_RECORDADO, String(Date.now() + DURACION_DESBLOQUEO_MS));
    }
  }, [gate.desbloqueado]);

  const valor: PinGateContextValue = {
    ...gate,
    desbloqueado: gate.desbloqueado || desbloqueoRecordado === true,
    cargando: pinHashGuardado === undefined || desbloqueoRecordado === undefined,
  };

  return <PinGateContext.Provider value={valor}>{children}</PinGateContext.Provider>;
}

export function usePinGateContext(): PinGateContextValue {
  const valor = useContext(PinGateContext);
  if (!valor) throw new Error('usePinGateContext() debe usarse dentro de <PinGateProvider>');
  return valor;
}
