import { renderHook, act } from '@testing-library/react-native';
import { usePinGate } from '../pin-gate';
import { hashPin } from '../../auth/pin';

// El mock automático de jest-expo para expo-crypto devuelve valores vacíos/rotos
// para digestStringAsync (no un hash SHA-256 real), así que lo pisamos acá con la
// implementación real de Node. Mismo patrón que src/auth/__tests__/pin.test.ts.
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

describe('usePinGate', () => {
  it('arranca bloqueado', async () => {
    // Nota: en @testing-library/react-native 14.x, renderHook es async y devuelve
    // una Promise (ver dist/render-hook.d.ts), a diferencia de versiones anteriores
    // donde era síncrono. Por eso se agrega `await` acá, distinto del snippet original.
    const { result } = await renderHook(() => usePinGate({ pinHashGuardado: null, guardarHash: jest.fn() }));
    expect(result.current.desbloqueado).toBe(false);
  });

  it('si no hay PIN guardado, cualquier guardarPin lo registra y desbloquea', async () => {
    const guardarHash = jest.fn();
    const { result } = await renderHook(() => usePinGate({ pinHashGuardado: null, guardarHash }));

    await act(async () => {
      await result.current.guardarPin('1234');
    });

    expect(guardarHash).toHaveBeenCalled();
    expect(result.current.desbloqueado).toBe(true);
  });

  it('con PIN guardado, intentarDesbloquear con el PIN correcto desbloquea', async () => {
    const hash = await hashPin('4269');
    const { result } = await renderHook(() => usePinGate({ pinHashGuardado: hash, guardarHash: jest.fn() }));

    let ok = false;
    await act(async () => {
      ok = await result.current.intentarDesbloquear('4269');
    });

    expect(ok).toBe(true);
    expect(result.current.desbloqueado).toBe(true);
  });

  it('con PIN incorrecto, no desbloquea', async () => {
    const hash = await hashPin('4269');
    const { result } = await renderHook(() => usePinGate({ pinHashGuardado: hash, guardarHash: jest.fn() }));

    let ok = true;
    await act(async () => {
      ok = await result.current.intentarDesbloquear('0000');
    });

    expect(ok).toBe(false);
    expect(result.current.desbloqueado).toBe(false);
  });
});
