import { crearBrokerCashRepo } from '../broker-cash-repo';
import type { LocalStore, PendingWrite } from '../../db/local-store';

function crearStoreFake(): LocalStore & { pendientes: PendingWrite[] } {
  const pendientes: PendingWrite[] = [];
  const snapshots: Record<string, unknown[]> = {};
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

describe('crearBrokerCashRepo sin conexión', () => {
  it('obtener() devuelve centavosArs 0 si nunca se guardó nada', async () => {
    const store = crearStoreFake();
    const repo = crearBrokerCashRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    const valor = await repo.obtener();

    expect(valor).toEqual({ id: 'actual', centavosArs: 0 });
  });

  it('guardar() reemplaza el valor y encola la escritura', async () => {
    const store = crearStoreFake();
    const repo = crearBrokerCashRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    await repo.guardar(50000);
    const valor = await repo.obtener();

    expect(valor.centavosArs).toBe(50000);
    expect(store.pendientes).toHaveLength(1);
    expect(store.pendientes[0].coleccion).toBe('broker-cash');
    expect(store.pendientes[0].id).toBe('actual');
  });
});
