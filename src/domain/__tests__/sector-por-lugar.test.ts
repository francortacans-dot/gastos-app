import { sugerirSectorIdPorLugar } from '../sector-por-lugar';
import type { Expense } from '../types';

function gasto(parcial: Partial<Expense> = {}): Expense {
  return {
    id: 'g1',
    centavosArs: 1000,
    montoOriginal: 10,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    fecha: '2026-06-01',
    sectorId: null,
    lugar: null,
    descripcion: null,
    metodoPago: null,
    fuente: 'disponible',
    ...parcial,
  };
}

describe('sugerirSectorIdPorLugar', () => {
  it('sugiere el sector de la última vez que se usó ese lugar exacto', () => {
    const gastos = [gasto({ id: 'g1', lugar: 'Carrefour', sectorId: 'comida', fecha: '2026-05-01' })];
    expect(sugerirSectorIdPorLugar(gastos, 'Carrefour')).toBe('comida');
  });

  it('ignora mayúsculas/minúsculas y espacios al principio/final', () => {
    const gastos = [gasto({ id: 'g1', lugar: 'Carrefour', sectorId: 'comida', fecha: '2026-05-01' })];
    expect(sugerirSectorIdPorLugar(gastos, '  CARREFOUR  ')).toBe('comida');
  });

  it('con varios sectores usados para el mismo lugar, sugiere el más frecuente', () => {
    const gastos = [
      gasto({ id: 'g1', lugar: 'Carrefour', sectorId: 'comida', fecha: '2026-01-01' }),
      gasto({ id: 'g2', lugar: 'Carrefour', sectorId: 'comida', fecha: '2026-02-01' }),
      gasto({ id: 'g3', lugar: 'Carrefour', sectorId: 'limpieza', fecha: '2026-03-01' }),
    ];
    expect(sugerirSectorIdPorLugar(gastos, 'Carrefour')).toBe('comida');
  });

  it('en caso de empate, sugiere el de la coincidencia más reciente', () => {
    const gastos = [
      gasto({ id: 'g1', lugar: 'Carrefour', sectorId: 'comida', fecha: '2026-01-01' }),
      gasto({ id: 'g2', lugar: 'Carrefour', sectorId: 'limpieza', fecha: '2026-03-01' }),
    ];
    expect(sugerirSectorIdPorLugar(gastos, 'Carrefour')).toBe('limpieza');
  });

  it('ignora coincidencias sin sector asignado', () => {
    const gastos = [gasto({ id: 'g1', lugar: 'Carrefour', sectorId: null, fecha: '2026-01-01' })];
    expect(sugerirSectorIdPorLugar(gastos, 'Carrefour')).toBeNull();
  });

  it('no matchea lugares distintos ni parecidos (comparación exacta, no difusa)', () => {
    const gastos = [gasto({ id: 'g1', lugar: 'Carrefour', sectorId: 'comida', fecha: '2026-01-01' })];
    expect(sugerirSectorIdPorLugar(gastos, 'Carrefour Palermo')).toBeNull();
  });

  it('devuelve null si el lugar está vacío', () => {
    const gastos = [gasto({ id: 'g1', lugar: 'Carrefour', sectorId: 'comida', fecha: '2026-01-01' })];
    expect(sugerirSectorIdPorLugar(gastos, '  ')).toBeNull();
  });

  it('devuelve null sin ningún gasto', () => {
    expect(sugerirSectorIdPorLugar([], 'Carrefour')).toBeNull();
  });
});
