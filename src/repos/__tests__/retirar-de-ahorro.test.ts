import { retirarDeAhorro } from '../retirar-de-ahorro';
import type { Repos } from '../create-repo';
import type { BrokerCash, SavingMovement } from '../../domain/types';

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
  const movimientosCreados: Omit<SavingMovement, 'id'>[] = [];
  let brokerCashActual = 0;

  const repos = {
    savings: {
      agregar: jest.fn(async (movimiento: Omit<SavingMovement, 'id'>) => {
        movimientosCreados.push(movimiento);
        return { ...movimiento, id: 'retiro1' };
      }),
    },
    brokerCash: {
      guardar: jest.fn(async (centavos: number) => {
        brokerCashActual = centavos;
        return { id: 'actual', centavosArs: brokerCashActual } as BrokerCash;
      }),
    },
  };

  return { repos: repos as unknown as Repos, movimientosCreados, obtenerBrokerCash: () => brokerCashActual };
}

describe('retirarDeAhorro', () => {
  it('destino disponible: crea el retiro y no toca el cash del broker', async () => {
    const { repos, movimientosCreados } = crearReposFake();
    const movimientos = [crearMovimiento({ centavosArs: 10000 })];
    const brokerCash: BrokerCash = { id: 'actual', centavosArs: 0 };

    const movimiento = await retirarDeAhorro(
      repos,
      { centavosArs: 4000, destino: 'disponible', fecha: '2026-06-05' },
      movimientos,
      brokerCash
    );

    expect(movimiento.centavosArs).toBe(-4000);
    expect(movimiento.destino).toBe('disponible');
    expect((repos.brokerCash.guardar as jest.Mock)).not.toHaveBeenCalled();
    expect(movimientosCreados).toHaveLength(1);
  });

  it('destino inversiones: crea el retiro y suma el monto al cash existente del broker', async () => {
    const { repos, obtenerBrokerCash } = crearReposFake();
    const movimientos = [crearMovimiento({ centavosArs: 10000 })];
    const brokerCash: BrokerCash = { id: 'actual', centavosArs: 50000 };

    const movimiento = await retirarDeAhorro(
      repos,
      { centavosArs: 4000, destino: 'inversiones', fecha: '2026-06-05' },
      movimientos,
      brokerCash
    );

    expect(movimiento.destino).toBe('inversiones');
    expect(obtenerBrokerCash()).toBe(54000);
  });

  it('rechaza un retiro con centavosArs <= 0, sin escribir nada', async () => {
    const { repos, movimientosCreados } = crearReposFake();
    const movimientos = [crearMovimiento({ centavosArs: 10000 })];
    const brokerCash: BrokerCash = { id: 'actual', centavosArs: 0 };

    await expect(
      retirarDeAhorro(repos, { centavosArs: 0, destino: 'disponible', fecha: '2026-06-05' }, movimientos, brokerCash)
    ).rejects.toThrow();

    expect(movimientosCreados).toHaveLength(0);
    expect((repos.brokerCash.guardar as jest.Mock)).not.toHaveBeenCalled();
  });

  it('rechaza retirar más de lo que hay ahorrado, sin escribir nada', async () => {
    const { repos, movimientosCreados } = crearReposFake();
    const movimientos = [crearMovimiento({ centavosArs: 3000 })];
    const brokerCash: BrokerCash = { id: 'actual', centavosArs: 0 };

    await expect(
      retirarDeAhorro(repos, { centavosArs: 4000, destino: 'disponible', fecha: '2026-06-05' }, movimientos, brokerCash)
    ).rejects.toThrow();

    expect(movimientosCreados).toHaveLength(0);
    expect((repos.brokerCash.guardar as jest.Mock)).not.toHaveBeenCalled();
  });
});
