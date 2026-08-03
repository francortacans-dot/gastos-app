import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AppProvider, useApp } from '../src/app-context';
import { usePinGate } from '../src/app-context/pin-gate';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirestoreDb } from '../src/firebase/app';

function CandadoDePin({ children }: { children: React.ReactNode }) {
  const { uid } = useApp();
  const [pinHashGuardado, setPinHashGuardado] = useState<string | null | undefined>(undefined);
  const router = useRouter();
  const segmentos = useSegments();

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

  useEffect(() => {
    if (pinHashGuardado === undefined) return; // todavía cargando
    const enPantallaDePin = segmentos[0] === 'pin';
    if (!gate.desbloqueado && !enPantallaDePin) {
      router.replace('/pin');
    } else if (gate.desbloqueado && enPantallaDePin) {
      router.replace('/');
    }
  }, [gate.desbloqueado, pinHashGuardado, segmentos]);

  if (pinHashGuardado === undefined) return null;

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AppProvider>
      <CandadoDePin>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pin" />
          <Stack.Screen name="gasto-nuevo" options={{ presentation: 'modal', headerShown: true, title: 'Nuevo gasto' }} />
          <Stack.Screen name="config" options={{ headerShown: true, title: 'Configuración' }} />
        </Stack>
      </CandadoDePin>
    </AppProvider>
  );
}
