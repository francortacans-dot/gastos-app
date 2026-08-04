import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AppProvider } from '../src/app-context';
import { AuthProvider, useAuth } from '../src/auth/auth-context';
import { PantallaAuth } from '../src/auth/pantalla-auth';
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

/** Muestra la pantalla de login/registro mientras no haya sesión de Firebase Auth. */
function ConAutenticacion({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useAuth();

  if (cargando) return null;
  if (!usuario) return <PantallaAuth />;

  return <AppProvider uid={usuario.uid}>{children}</AppProvider>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ConAutenticacion>
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
      </ConAutenticacion>
    </AuthProvider>
  );
}
