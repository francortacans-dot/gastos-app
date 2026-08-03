import { renderHook } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import { useEsEscritorio } from '../use-es-escritorio';

jest.mock('react-native', () => {
  // No se puede usar spread (`...jest.requireActual('react-native')`) porque eso fuerza
  // la evaluación de TODOS los getters del módulo (incluido DevMenu), lo que rompe
  // en este entorno (RN 0.86 + jest-expo) con un TurboModuleRegistry invariant violation.
  // Copiar los property descriptors preserva la carga perezosa y evita el problema.
  const reactNativeReal = jest.requireActual('react-native');
  return Object.defineProperties(
    {},
    {
      ...Object.getOwnPropertyDescriptors(reactNativeReal),
      useWindowDimensions: { value: jest.fn(), configurable: true, enumerable: true },
    },
  );
});

describe('useEsEscritorio', () => {
  // Nota: en @testing-library/react-native 14.x, renderHook es async y devuelve una
  // Promise (ver dist/render-hook.d.ts), a diferencia del snippet original del brief.
  // Mismo patrón que src/hooks/__tests__/use-collection.test.tsx.
  it('devuelve false para un ancho de celular', async () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 390, height: 844 });
    const { result } = await renderHook(() => useEsEscritorio());
    expect(result.current).toBe(false);
  });

  it('devuelve true para un ancho de escritorio', async () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1280, height: 800 });
    const { result } = await renderHook(() => useEsEscritorio());
    expect(result.current).toBe(true);
  });

  it('el breakpoint es 768px inclusive', async () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 768, height: 1024 });
    const { result } = await renderHook(() => useEsEscritorio());
    expect(result.current).toBe(true);
  });
});
