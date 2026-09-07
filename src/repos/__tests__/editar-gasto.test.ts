import { editarGasto } from '../editar-gasto';
import type { Repos } from '../create-repo';
import type { Expense, SavingMovement } from '../../domain/types';

function crearGasto(parcial: Partial<Expense> = {}): Expense {
  return {
    id: 'g1',
    centavosArs: 5000,
    montoOriginal: 50,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    fecha: '2026-06-01',
    sectorId: null,
    lugar: null,
    descripcion: 'Uber',
    metodoPago: null,
    fuente: 'disponible',
    ...parcial,
  };
}

function crearMovimiento(parcial: Partial<SavingMovement> = {}): SavingMovement {
  return {
    id: 'm1',
    centavosArs: -5000,
    fecha: '2026-06-01',
    nota: 'Gasto: Uber',
    origen: null,
    destino: 'gasto',
    gastoId: 'g1',
    ...parcial,
  };
}

function crearReposFake() {
  const gastosGuardados: Expense[] = [];
  const movimientosCreados: Omit<SavingMovement, 'id'>[] = [];
  const idsMovimientosEliminados: string[] = [];
  let contadorId = 0;

  const repos = {
    expenses: {
      guardar: jest.fn(async (gasto: Expense) => {
        gastosGuardados.push(gasto);
        return gasto;
      }),
    },
    savings: {
      agregar: jest.fn(async (movimiento: Omit<SavingMovement, 'id'>) => {
        movimientosCreados.push(movimiento);
        contadorId += 1;
        return { ...movimiento, id: `mov${contadorId}` };
      }),
      eliminar: jest.fn(async (id: string) => {
        idsMovimientosEliminados.push(id);
      }),
    },
  };

  return { repos: repos as unknown as Repos, gastosGuardados, movimientosCreados, idsMovimientosEliminados };
}

describe('editarGasto', () => {
  it('sigue en fuente disponible: guarda el gasto, no toca ahorro', async () => {
    const { repos, gastosGuardados, movimientosCreados, idsMovimientosEliminados } = crearReposFake();
    const gasto = crearGasto({ fuente: 'disponible' });

    const resultado = await editarGasto(repos, gasto, []);

    expect(resultado.movimiento).toBeNull();
    expect(gastosGuardados).toEqual([gasto]);
    expect(movimientosCreados).toHaveLength(0);
    expect(idsMovimientosEliminados).toHaveLength(0);
  });

  it('sigue en fuente ahorro pero cambia el monto: borra el retiro viejo y crea uno nuevo con el monto actual', async () => {
    const { repos, movimientosCreados, idsMovimientosEliminados } = crearReposFake();
    const gasto = crearGasto({ id: 'g1', centavosArs: 3000, fuente: 'ahorro' });
    const movimientoViejo = crearMovimiento({ id: 'm1', gastoId: 'g1', centavosArs: -5000 });
    const movimientos = [movimientoViejo, crearMovimiento({ id: 'base', gastoId: null, destino: null, origen: 'ingresos', centavosArs: 10000 })];

    const resultado = await editarGasto(repos, gasto, movimientos);

    expect(idsMovimientosEliminados).toEqual(['m1']);
    expect(resultado.movimiento?.centavosArs).toBe(-3000);
    expect(movimientosCreados).toHaveLength(1);
  });

  it('pasa de disponible a ahorro: valida saldo y crea el retiro', async () => {
    const { repos, movimientosCreados } = crearReposFake();
    const gasto = crearGasto({ id: 'g1', centavosArs: 4000, fuente: 'ahorro' });
    const movimientos = [crearMovimiento({ id: 'otro', gastoId: null, destino: null, origen: 'ingresos', centavosArs: 10000 })];

    const resultado = await editarGasto(repos, gasto, movimientos);

    expect(resultado.movimiento?.centavosArs).toBe(-4000);
    expect(resultado.movimiento?.destino).toBe('gasto');
    expect(resultado.movimiento?.gastoId).toBe('g1');
    expect(movimientosCreados).toHaveLength(1);
  });

  it('pasa de ahorro a disponible: borra el retiro viejo y no crea uno nuevo', async () => {
    const { repos, movimientosCreados, idsMovimientosEliminados } = crearReposFake();
    const gasto = crearGasto({ id: 'g1', fuente: 'disponible' });
    const movimientoViejo = crearMovimiento({ id: 'm1', gastoId: 'g1' });

    const resultado = await editarGasto(repos, gasto, [movimientoViejo]);

    expect(idsMovimientosEliminados).toEqual(['m1']);
    expect(resultado.movimiento).toBeNull();
    expect(movimientosCreados).toHaveLength(0);
  });

  it('el ahorro liberado al borrar el retiro viejo cuenta a favor del nuevo monto', async () => {
    // totalAhorrado([-5000, 10000]) = 5000. Al borrar el retiro viejo (-5000) se
    // liberan esos 5000: saldoBase = 5000 + 5000 = 10000, alcanza para pedir 5000.
    const { repos } = crearReposFake();
    const gasto = crearGasto({ id: 'g1', centavosArs: 5000, fuente: 'ahorro' });
    const movimientoViejo = crearMovimiento({ id: 'm1', gastoId: 'g1', centavosArs: -5000 });
    const movimientos = [movimientoViejo, crearMovimiento({ id: 'base', gastoId: null, destino: null, origen: 'ingresos', centavosArs: 10000 })];

    const resultado = await editarGasto(repos, gasto, movimientos);

    expect(resultado.movimiento?.centavosArs).toBe(-5000);
  });

  it('rechaza si el nuevo monto con fuente ahorro supera el saldo disponible tras liberar el retiro viejo', async () => {
    // totalAhorrado([-5000, 10000]) = 5000. saldoBase = 5000 + 5000 = 10000. Pide 20000: rechaza.
    // El retiro viejo SÍ se borra antes de validar (orden intencional del brief),
    // así que el rechazo no revierte ese borrado — se deja explícito acá.
    const { repos, gastosGuardados, idsMovimientosEliminados } = crearReposFake();
    const gasto = crearGasto({ id: 'g1', centavosArs: 20000, fuente: 'ahorro' });
    const movimientoViejo = crearMovimiento({ id: 'm1', gastoId: 'g1', centavosArs: -5000 });
    const movimientos = [movimientoViejo, crearMovimiento({ id: 'base', gastoId: null, destino: null, origen: 'ingresos', centavosArs: 10000 })];

    await expect(editarGasto(repos, gasto, movimientos)).rejects.toThrow();
    expect(gastosGuardados).toHaveLength(0);
    expect(idsMovimientosEliminados).toEqual(['m1']);
  });

  it('rechaza un gasto con centavosArs <= 0, sin guardar nada', async () => {
    const { repos, gastosGuardados } = crearReposFake();
    const gasto = crearGasto({ centavosArs: 0 });

    await expect(editarGasto(repos, gasto, [])).rejects.toThrow();
    expect(gastosGuardados).toHaveLength(0);
  });
});
