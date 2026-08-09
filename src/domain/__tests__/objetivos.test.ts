import { elegirObjetivoDestacado, porcentajeObjetivo } from '../objetivos';
import type { Objetivo } from '../types';

function objetivo(parcial: Partial<Objetivo>): Objetivo {
  return {
    id: 'o1',
    nombre: 'Test',
    montoMetaCentavos: 100000,
    montoActualCentavos: 0,
    fechaObjetivo: null,
    tamano: 'mediano',
    ...parcial,
  };
}

describe('elegirObjetivoDestacado', () => {
  it('devuelve null si no hay objetivos', () => {
    expect(elegirObjetivoDestacado([])).toBeNull();
  });

  it('prioriza el que tiene fecha más próxima', () => {
    const lejano = objetivo({ id: 'lejano', fechaObjetivo: '2027-01-01' });
    const cercano = objetivo({ id: 'cercano', fechaObjetivo: '2026-09-01' });
    expect(elegirObjetivoDestacado([lejano, cercano])?.id).toBe('cercano');
  });

  it('sin fechas, prioriza el de mayor tamaño', () => {
    const chico = objetivo({ id: 'chico', tamano: 'chico' });
    const grande = objetivo({ id: 'grande', tamano: 'grande' });
    expect(elegirObjetivoDestacado([chico, grande])?.id).toBe('grande');
  });

  it('un objetivo con fecha le gana a uno sin fecha aunque sea más chico', () => {
    const grandeSinFecha = objetivo({ id: 'grande', tamano: 'grande', fechaObjetivo: null });
    const chicoConFecha = objetivo({ id: 'chico', tamano: 'chico', fechaObjetivo: '2026-09-01' });
    expect(elegirObjetivoDestacado([grandeSinFecha, chicoConFecha])?.id).toBe('chico');
  });
});

describe('porcentajeObjetivo', () => {
  it('calcula el porcentaje de avance', () => {
    expect(porcentajeObjetivo(objetivo({ montoMetaCentavos: 100000, montoActualCentavos: 25000 }))).toBe(25);
  });

  it('no supera 100', () => {
    expect(porcentajeObjetivo(objetivo({ montoMetaCentavos: 100000, montoActualCentavos: 999999 }))).toBe(100);
  });

  it('devuelve 0 si la meta es 0', () => {
    expect(porcentajeObjetivo(objetivo({ montoMetaCentavos: 0, montoActualCentavos: 500 }))).toBe(0);
  });
});
