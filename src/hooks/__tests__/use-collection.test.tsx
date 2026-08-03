import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useCollection } from '../use-collection';

// Nota: en @testing-library/react-native 14.x, renderHook (y unmount) son async y
// devuelven una Promise (ver dist/render-hook.d.ts), a diferencia del snippet original
// del brief. Mismo patrón que src/app-context/__tests__/pin-gate.test.tsx.
describe('useCollection', () => {
  it('carga la lista inicial con listar()', async () => {
    const listar = jest.fn().mockResolvedValue([{ id: 'a' }]);
    const suscribir = jest.fn().mockReturnValue(() => {});

    const { result } = await renderHook(() => useCollection({ listar, suscribir }));

    await waitFor(() => expect(result.current).toEqual([{ id: 'a' }]));
  });

  it('actualiza cuando suscribir() llama al callback', async () => {
    let callbackGuardado: ((v: unknown[]) => void) | null = null;
    const listar = jest.fn().mockResolvedValue([]);
    const suscribir = jest.fn((cb) => {
      callbackGuardado = cb;
      return () => {};
    });

    const { result } = await renderHook(() => useCollection({ listar, suscribir }));
    await waitFor(() => expect(listar).toHaveBeenCalled());

    await act(async () => {
      callbackGuardado?.([{ id: 'b' }]);
    });

    await waitFor(() => expect(result.current).toEqual([{ id: 'b' }]));
  });

  it('se desuscribe al desmontar', async () => {
    const desuscribir = jest.fn();
    const listar = jest.fn().mockResolvedValue([]);
    const suscribir = jest.fn().mockReturnValue(desuscribir);

    const { unmount } = await renderHook(() => useCollection({ listar, suscribir }));
    await unmount();

    expect(desuscribir).toHaveBeenCalled();
  });
});
