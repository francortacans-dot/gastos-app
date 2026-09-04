import { eliminarGasto } from '../eliminar-gasto';
import type { Repos } from '../create-repo';
import type { Expense, SavingMovement } from '../../domain/types';

function crearGasto(parcial: Partial<Expense> = {}): Expense {
  return {
    id: 'g1',
    centavosArs: 4000,
    montoOriginal: 40,
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
    centavosArs: -4000,
    fecha: '2026-06-01',
    nota: 'Gasto: Uber',
    origen: null,
    destino: 'gasto',
    gastoId: 'g1',
    ...parcial,
  };
}

function crearReposFake() {
  const idsGastosEliminados: string[] = [];
  const idsMovimientosEliminados: string[] = [];

  const repos = {
    expenses: {
      eliminar: jest.fn(async (id: string) => {
        idsGastosEliminados.push(id);
      }),
    },
    savings: {
      eliminar: jest.fn(async (id: string) => {
        idsMovimientosEliminados.push(id);
      }),
    },
  };

  return { repos: repos as unknown as Repos, idsGastosEliminados, idsMovimientosEliminados };
}

describe('eliminarGasto', () => {
  it('gasto con fuente disponible: borra el gasto y no toca ahorro', async () => {
    const { repos, idsGastosEliminados, idsMovimientosEliminados } = crearReposFake();
    const gasto = crearGasto({ id: 'g1', fuente: 'disponible' });

    await eliminarGasto(repos, gasto, []);

    expect(idsGastosEliminados).toEqual(['g1']);
    expect(idsMovimientosEliminados).toHaveLength(0);
  });

  it('gasto con fuente ahorro: borra el gasto y su retiro vinculado', async () => {
    const { repos, idsGastosEliminados, idsMovimientosEliminados } = crearReposFake();
    const gasto = crearGasto({ id: 'g1', fuente: 'ahorro' });
    const movimientos = [
      crearMovimiento({ id: 'm1', gastoId: 'g1' }),
      crearMovimiento({ id: 'm2', gastoId: 'otro-gasto' }),
    ];

    await eliminarGasto(repos, gasto, movimientos);

    expect(idsGastosEliminados).toEqual(['g1']);
    expect(idsMovimientosEliminados).toEqual(['m1']);
  });

  it('gasto con fuente ahorro sin movimiento vinculado encontrado: borra el gasto igual, sin fallar', async () => {
    const { repos, idsGastosEliminados, idsMovimientosEliminados } = crearReposFake();
    const gasto = crearGasto({ id: 'g1', fuente: 'ahorro' });

    await eliminarGasto(repos, gasto, []);

    expect(idsGastosEliminados).toEqual(['g1']);
    expect(idsMovimientosEliminados).toHaveLength(0);
  });
});
