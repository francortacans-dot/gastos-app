import { pagarGasto } from '../pagar-gasto';
import type { Repos } from '../create-repo';
import type { Expense, SavingMovement } from '../../domain/types';

function crearGastoParcial(parcial: Partial<Omit<Expense, 'id'>> = {}): Omit<Expense, 'id'> {
  return {
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
    centavosArs: 10000,
    fecha: '2026-06-01',
    nota: null,
    origen: 'ingresos',
    destino: null,
    gastoId: null,
    ...parcial,
  };
}

function crearReposFake() {
  const gastosCreados: Omit<Expense, 'id'>[] = [];
  const movimientosCreados: Omit<SavingMovement, 'id'>[] = [];
  let contadorId = 0;

  const repos = {
    expenses: {
      agregar: jest.fn(async (gasto: Omit<Expense, 'id'>) => {
        gastosCreados.push(gasto);
        contadorId += 1;
        return { ...gasto, id: `gasto${contadorId}` };
      }),
    },
    savings: {
      agregar: jest.fn(async (movimiento: Omit<SavingMovement, 'id'>) => {
        movimientosCreados.push(movimiento);
        contadorId += 1;
        return { ...movimiento, id: `mov${contadorId}` };
      }),
    },
  };

  return { repos: repos as unknown as Repos, gastosCreados, movimientosCreados };
}

describe('pagarGasto', () => {
  it('fuente disponible: guarda el gasto y no crea ningún movimiento de ahorro', async () => {
    const { repos, movimientosCreados } = crearReposFake();

    const resultado = await pagarGasto(repos, crearGastoParcial({ fuente: 'disponible' }), []);

    expect(resultado.gasto.fuente).toBe('disponible');
    expect(resultado.movimiento).toBeNull();
    expect(movimientosCreados).toHaveLength(0);
  });

  it('fuente ahorro: guarda el gasto y crea un retiro vinculado por el mismo monto', async () => {
    const { repos, movimientosCreados } = crearReposFake();
    const movimientos = [crearMovimiento({ centavosArs: 10000 })];

    const resultado = await pagarGasto(repos, crearGastoParcial({ centavosArs: 4000, fuente: 'ahorro' }), movimientos);

    expect(resultado.movimiento).not.toBeNull();
    expect(resultado.movimiento?.centavosArs).toBe(-4000);
    expect(resultado.movimiento?.destino).toBe('gasto');
    expect(resultado.movimiento?.gastoId).toBe(resultado.gasto.id);
    expect(resultado.movimiento?.origen).toBeNull();
    expect(movimientosCreados).toHaveLength(1);
  });

  it('rechaza un gasto con centavosArs <= 0, sin guardar nada', async () => {
    const { repos, gastosCreados, movimientosCreados } = crearReposFake();

    await expect(
      pagarGasto(repos, crearGastoParcial({ centavosArs: 0 }), [])
    ).rejects.toThrow();

    expect(gastosCreados).toHaveLength(0);
    expect(movimientosCreados).toHaveLength(0);
  });

  it('fuente ahorro: rechaza si el gasto supera el saldo de ahorro, sin guardar nada', async () => {
    const { repos, gastosCreados, movimientosCreados } = crearReposFake();
    const movimientos = [crearMovimiento({ centavosArs: 3000 })];

    await expect(
      pagarGasto(repos, crearGastoParcial({ centavosArs: 4000, fuente: 'ahorro' }), movimientos)
    ).rejects.toThrow();

    expect(gastosCreados).toHaveLength(0);
    expect(movimientosCreados).toHaveLength(0);
  });
});
