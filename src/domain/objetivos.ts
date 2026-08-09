import type { Objetivo, TamanoObjetivo } from './types';

const PESO_TAMANO: Record<TamanoObjetivo, number> = { grande: 3, mediano: 2, chico: 1 };

/**
 * Elige el objetivo a destacar en Inicio: el que tiene la fecha más próxima:
 * si ninguno tiene fecha, el de mayor tamaño gana. null si no hay objetivos.
 */
export function elegirObjetivoDestacado(objetivos: Objetivo[]): Objetivo | null {
  if (objetivos.length === 0) return null;

  const ordenados = [...objetivos].sort((a, b) => {
    if (a.fechaObjetivo && b.fechaObjetivo) return a.fechaObjetivo.localeCompare(b.fechaObjetivo);
    if (a.fechaObjetivo) return -1;
    if (b.fechaObjetivo) return 1;
    return PESO_TAMANO[b.tamano] - PESO_TAMANO[a.tamano];
  });

  return ordenados[0];
}

/** Porcentaje 0-100 de avance hacia la meta. 0 si la meta es 0 o negativa. */
export function porcentajeObjetivo(objetivo: Objetivo): number {
  if (objetivo.montoMetaCentavos <= 0) return 0;
  return Math.min(100, Math.round((objetivo.montoActualCentavos / objetivo.montoMetaCentavos) * 100));
}
