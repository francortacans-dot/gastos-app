import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useSingleton } from '../use-singleton';

// Mismo patrón async de renderHook que src/hooks/__tests__/use-collection.test.tsx
// (@testing-library/react-native 14.x).
describe('useSingleton', () => {
  it('carga el valor inicial con obtener()', async () => {
    const obtener = jest.fn().mockResolvedValue({ id: 'actual', centavosArs: 500 });
    const suscribir = jest.fn().mockReturnValue(() => {});

    const { result } = await renderHook(() =>
      useSingleton({ obtener, suscribir, valorInicial: { id: 'actual', centavosArs: 0 } })
    );

    await waitFor(() => expect(result.current).toEqual({ id: 'actual', centavosArs: 500 }));
  });

  it('devuelve el valorInicial mientras obtener() no resolvió', async () => {
    const obtener = jest.fn(() => new Promise<never>(() => {}));
    const suscribir = jest.fn().mockReturnValue(() => {});

    const { result } = await renderHook(() =>
      useSingleton({ obtener, suscribir, valorInicial: { id: 'actual', centavosArs: 0 } })
    );

    expect(result.current).toEqual({ id: 'actual', centavosArs: 0 });
  });

  it('actualiza cuando suscribir() llama al callback', async () => {
    let callbackGuardado: ((v: { id: string; centavosArs: number }) => void) | null = null;
    const obtener = jest.fn().mockResolvedValue({ id: 'actual', centavosArs: 0 });
    const suscribir = jest.fn((cb) => {
      callbackGuardado = cb;
      return () => {};
    });

    const { result } = await renderHook(() =>
      useSingleton({ obtener, suscribir, valorInicial: { id: 'actual', centavosArs: 0 } })
    );
    await waitFor(() => expect(obtener).toHaveBeenCalled());

    await act(async () => {
      callbackGuardado?.({ id: 'actual', centavosArs: 999 });
    });

    await waitFor(() => expect(result.current).toEqual({ id: 'actual', centavosArs: 999 }));
  });

  it('se desuscribe al desmontar', async () => {
    const desuscribir = jest.fn();
    const obtener = jest.fn().mockResolvedValue({ id: 'actual', centavosArs: 0 });
    const suscribir = jest.fn().mockReturnValue(desuscribir);

    const { unmount } = await renderHook(() =>
      useSingleton({ obtener, suscribir, valorInicial: { id: 'actual', centavosArs: 0 } })
    );
    await unmount();

    expect(desuscribir).toHaveBeenCalled();
  });
});
