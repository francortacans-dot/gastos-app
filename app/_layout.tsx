import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AppProvider } from '../src/app-context';
import { AuthProvider, useAuth } from '../src/auth/auth-context';
import { PantallaAuth } from '../src/auth/pantalla-auth';
import { PantallaCarga } from '../src/components/pantalla-carga';
import { PinGateProvider, usePinGateContext } from '../src/app-context/pin-gate-context';
import { ThemeProvider, useColors } from '../src/theme/theme-context';
import { palettes } from '../src/theme/palettes';
import { BotonVolver } from '../src/components/boton-volver';

function CandadoDePin({ children }: { children: React.ReactNode }) {
  const gate = usePinGateContext();
  const router = useRouter();
  const segmentos = useSegments();
  const colors = useColors();

  useEffect(() => {
    if (gate.cargando) return; // todavía cargando
    const enPantallaDePin = segmentos[0] === 'pin';
    if (!gate.desbloqueado && !enPantallaDePin) {
      router.replace('/pin');
    } else if (gate.desbloqueado && enPantallaDePin) {
      router.replace('/');
    }
  }, [gate.desbloqueado, gate.cargando, segmentos]);

  if (gate.cargando) return <PantallaCarga colors={colors} />;

  return <>{children}</>;
}

/** Muestra la pantalla de login/registro mientras no haya sesión de Firebase Auth. */
function ConAutenticacion({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useAuth();

  // Todavía no hay uid (y por lo tanto no hay tema personalizado de Firestore):
  // se usa la paleta por defecto, igual que en PantallaAuth.
  if (cargando) return <PantallaCarga colors={palettes.gris} />;
  if (!usuario) return <PantallaAuth />;

  return <AppProvider uid={usuario.uid}>{children}</AppProvider>;
}

function StackConTema() {
  const colors = useColors();

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 180 }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="pin" />
      <Stack.Screen name="gasto-nuevo" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="sector-nuevo" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="objetivo-nuevo" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen
        name="config"
        options={{
          headerShown: true,
          title: 'Configuración',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text1,
          headerLeft: () => <BotonVolver />,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ConAutenticacion>
        <ThemeProvider>
          <PinGateProvider>
            <CandadoDePin>
              <StackConTema />
            </CandadoDePin>
          </PinGateProvider>
        </ThemeProvider>
      </ConAutenticacion>
    </AuthProvider>
  );
}
