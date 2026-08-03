import React, { useEffect } from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { PinGateProvider, usePinGateContext } from '../pin-gate-context';

// El mock automático de jest-expo para expo-crypto devuelve valores vacíos/rotos
// para digestStringAsync. Mismo mock local que usan pin.test.ts y pin-gate.test.tsx.
jest.mock('expo-crypto', () => ({
  __esModule: true,
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
  digestStringAsync: (algorithm: string, str: string) => {
    if (algorithm !== 'SHA256') {
      throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
    return Promise.resolve(
      require('node:crypto')
        .createHash('sha256')
        .update(str)
        .digest('hex')
    );
  },
}));

// No necesitamos Firebase Auth real acá: solo un uid fijo para armar la ref del documento.
jest.mock('../../app-context', () => ({
  useApp: () => ({ uid: 'uid-de-prueba', repos: {} }),
}));

// Simula el documento 'users/uid-de-prueba/settings/preferences' en memoria,
// para no depender de una instancia real de Firestore en este test.
// Nota: el nombre debe empezar con "mock" para que Jest permita referenciarla
// dentro del factory de jest.mock (regla de jest.mock fuera de scope).
let mockDocumentoGuardado: Record<string, unknown> | undefined;
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(() =>
    Promise.resolve({
      exists: () => mockDocumentoGuardado !== undefined,
      data: () => mockDocumentoGuardado,
    })
  ),
  setDoc: jest.fn((_ref: unknown, datos: Record<string, unknown>) => {
    mockDocumentoGuardado = { ...(mockDocumentoGuardado ?? {}), ...datos };
    return Promise.resolve();
  }),
}));

jest.mock('../../firebase/app', () => ({
  getFirestoreDb: () => ({}),
}));

// Simula `CandadoDePin` (app/_layout.tsx): solo lee el gate compartido y reporta
// cada cambio de `desbloqueado`, igual que haría el efecto de ruteo real.
function Candado({ onCambio }: { onCambio: (desbloqueado: boolean) => void }) {
  const gate = usePinGateContext();
  useEffect(() => {
    onCambio(gate.desbloqueado);
  }, [gate.desbloqueado]);
  return null;
}

// Simula `PantallaPin` (app/pin.tsx): expone su instancia del gate compartido
// para que el test pueda invocar `guardarPin`/`intentarDesbloquear` desde acá.
let gateDeLaPantalla: ReturnType<typeof usePinGateContext> | null = null;
function Pantalla() {
  gateDeLaPantalla = usePinGateContext();
  return null;
}

describe('PinGateProvider (integración CandadoDePin + PantallaPin)', () => {
  beforeEach(() => {
    mockDocumentoGuardado = undefined;
    gateDeLaPantalla = null;
  });

  it('guardarPin en la pantalla de PIN desbloquea también al candado del layout', async () => {
    const valoresDeDesbloqueo: boolean[] = [];

    await render(
      <PinGateProvider>
        <Candado onCambio={(v) => valoresDeDesbloqueo.push(v)} />
        <Pantalla />
      </PinGateProvider>
    );

    await waitFor(() => expect(gateDeLaPantalla?.cargando).toBe(false));
    expect(valoresDeDesbloqueo[valoresDeDesbloqueo.length - 1]).toBe(false);

    await act(async () => {
      await gateDeLaPantalla!.guardarPin('1234');
    });

    // Antes del fix, esto habría sido `false`: cada componente tenía su propia
    // instancia de usePinGate y `CandadoDePin` nunca se enteraba del desbloqueo
    // ocurrido en `PantallaPin`. Ahora ambos leen el mismo PinGateProvider.
    expect(valoresDeDesbloqueo[valoresDeDesbloqueo.length - 1]).toBe(true);
  });

  it('intentarDesbloquear con el PIN correcto en la pantalla también desbloquea al candado', async () => {
    // Precarga un PIN ya guardado en el "Firestore" simulado.
    const { hashPin } = require('../../auth/pin');
    mockDocumentoGuardado = { pinHash: await hashPin('4269') };

    const valoresDeDesbloqueo: boolean[] = [];

    await render(
      <PinGateProvider>
        <Candado onCambio={(v) => valoresDeDesbloqueo.push(v)} />
        <Pantalla />
      </PinGateProvider>
    );

    await waitFor(() => expect(gateDeLaPantalla?.cargando).toBe(false));
    expect(valoresDeDesbloqueo[valoresDeDesbloqueo.length - 1]).toBe(false);

    let ok = false;
    await act(async () => {
      ok = await gateDeLaPantalla!.intentarDesbloquear('4269');
    });

    expect(ok).toBe(true);
    expect(valoresDeDesbloqueo[valoresDeDesbloqueo.length - 1]).toBe(true);
  });
});
