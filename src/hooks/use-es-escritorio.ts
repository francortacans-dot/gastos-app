import { useWindowDimensions } from 'react-native';

const BREAKPOINT_ESCRITORIO = 768;

export function useEsEscritorio(): boolean {
  const { width } = useWindowDimensions();
  return width >= BREAKPOINT_ESCRITORIO;
}
