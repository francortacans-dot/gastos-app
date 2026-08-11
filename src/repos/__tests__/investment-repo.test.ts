import { crearInvestmentRepo } from '../investment-repo';
import type { LocalStore, PendingWrite } from '../../db/local-store';
import type { Investment } from '../../domain/types';

jest.mock('expo-crypto', () => ({
  __esModule: true,
  randomUUID: () => require('node:crypto').randomUUID(),
}));

function crearStoreFake(): LocalStore & { pendientes: PendingWrite[] } {
  const pendientes: PendingWrite[] = [];
  const snapshots: Record<string, unknown[]> = { investments: [] };
  return {
    pendientes,
    async guardarPendiente(w) {
      pendientes.push(w);
    },
    async listarPendientes() {
      return [...pendientes];
    },
    async borrarPendiente(id) {
      const i = pendientes.findIndex((p) => p.id === id);
      if (i >= 0) pendientes.splice(i, 1);
    },
    async guardarSnapshot(coleccion, datos) {
      snapshots[coleccion] = datos;
    },
    async leerSnapshot(coleccion) {
      return snapshots[coleccion] ?? [];
    },
  };
}

function posicionParcial(): Omit<Investment, 'id'> {
  return {
    ticker: 'BMA',
    nominales: 10,
    ppc: 9.42,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    costoCentavosArsUnitario: 942,
    rubro: null,
    fecha: '2026-08-11',
    status: 'OPEN',
  };
}

describe('crearInvestmentRepo sin conexión', () => {
  it('agregar() genera un id, guarda snapshot local y encola la escritura', async () => {
    const store = crearStoreFake();
    const repo = crearInvestmentRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    const inversion = await repo.agregar(posicionParcial());

    expect(typeof inversion.id).toBe('string');
    expect(inversion.id.length).toBeGreaterThan(0);
    expect(store.pendientes).toHaveLength(1);
    expect(store.pendientes[0].coleccion).toBe('investments');
    expect(store.pendientes[0].operacion).toBe('set');
  });

  it('listar() devuelve lo guardado en el snapshot local', async () => {
    const store = crearStoreFake();
    const repo = crearInvestmentRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    await repo.agregar(posicionParcial());
    const lista = await repo.listar();

    expect(lista).toHaveLength(1);
    expect(lista[0].ticker).toBe('BMA');
  });

  it('actualizar() modifica nominales y status, y encola la escritura', async () => {
    const store = crearStoreFake();
    const repo = crearInvestmentRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    const inversion = await repo.agregar(posicionParcial());
    const actualizada = await repo.actualizar(inversion.id, { nominales: 0, status: 'CLOSED' });

    expect(actualizada.nominales).toBe(0);
    expect(actualizada.status).toBe('CLOSED');
    const lista = await repo.listar();
    expect(lista[0].status).toBe('CLOSED');
    expect(store.pendientes.filter((p) => p.id === inversion.id)).toHaveLength(2); // agregar + actualizar
  });

  it('actualizar() lanza un error si el id no existe', async () => {
    const store = crearStoreFake();
    const repo = crearInvestmentRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    await expect(repo.actualizar('no-existe', { nominales: 0, status: 'CLOSED' })).rejects.toThrow();
  });

  it('eliminar() encola un delete y lo saca de listar()', async () => {
    const store = crearStoreFake();
    const repo = crearInvestmentRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    const inversion = await repo.agregar(posicionParcial());
    await repo.eliminar(inversion.id);
    const lista = await repo.listar();

    expect(lista).toHaveLength(0);
    expect(store.pendientes.some((p) => p.operacion === 'delete' && p.id === inversion.id)).toBe(true);
  });
});
