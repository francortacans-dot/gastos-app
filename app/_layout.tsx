import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AppProvider } from '../src/app-context';
import { PinGateProvider, usePinGateContext } from '../src/app-context/pin-gate-context';
import { ThemeProvider } from '../src/theme/theme-context';

function CandadoDePin({ children }: { children: React.ReactNode }) {
  const gate = usePinGateContext();
  const router = useRouter();
  const segmentos = useSegments();

  useEffect(() => {
    if (gate.cargando) return; // todavía cargando
    const enPantallaDePin = segmentos[0] === 'pin';
    if (!gate.desbloqueado && !enPantallaDePin) {
      router.replace('/pin');
    } else if (gate.desbloqueado && enPantallaDePin) {
      router.replace('/');
    }
  }, [gate.desbloqueado, gate.cargando, segmentos]);

  if (gate.cargando) return null;

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AppProvider>
      <ThemeProvider>
        <PinGateProvider>
          <CandadoDePin>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="pin" />
              <Stack.Screen name="gasto-nuevo" options={{ presentation: 'modal', headerShown: true, title: 'Nuevo gasto' }} />
              <Stack.Screen name="config" options={{ headerShown: true, title: 'Configuración' }} />
            </Stack>
          </CandadoDePin>
        </PinGateProvider>
      </ThemeProvider>
    </AppProvider>
  );
}
