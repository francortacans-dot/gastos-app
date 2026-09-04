import { crearSavingsRepo } from '../savings-repo';
import type { LocalStore, PendingWrite } from '../../db/local-store';
import type { SavingMovement } from '../../domain/types';

// Ver nota equivalente en expense-repo.test.ts: el mock automático de
// jest-expo para expo-crypto devuelve randomUUID() = undefined, así que lo
// pisamos acá con la implementación real de Node.
jest.mock('expo-crypto', () => ({
  __esModule: true,
  randomUUID: () => require('node:crypto').randomUUID(),
}));

function crearStoreFake(): LocalStore & { pendientes: PendingWrite[] } {
  const pendientes: PendingWrite[] = [];
  const snapshots: Record<string, unknown[]> = { savings: [] };
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

function movimientoParcial(parcial: Partial<Omit<SavingMovement, 'id'>> = {}): Omit<SavingMovement, 'id'> {
  return {
    centavosArs: 5000,
    fecha: '2026-06-01',
    nota: null,
    origen: 'ingresos',
    destino: null,
    gastoId: null,
    ...parcial,
  };
}

describe('crearSavingsRepo sin conexión', () => {
  it('agregar() genera un id, guarda snapshot local y encola la escritura', async () => {
    const store = crearStoreFake();
    const repo = crearSavingsRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    const movimiento = await repo.agregar(movimientoParcial());

    expect(typeof movimiento.id).toBe('string');
    expect(movimiento.id.length).toBeGreaterThan(0);
    expect(store.pendientes).toHaveLength(1);
    expect(store.pendientes[0].coleccion).toBe('savings');
    expect(store.pendientes[0].operacion).toBe('set');
  });

  it('listar() devuelve lo guardado en el snapshot local', async () => {
    const store = crearStoreFake();
    const repo = crearSavingsRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    await repo.agregar(movimientoParcial());
    const lista = await repo.listar();

    expect(lista).toHaveLength(1);
    expect(lista[0].centavosArs).toBe(5000);
  });

  it('eliminar() encola un delete y lo saca de listar()', async () => {
    const store = crearStoreFake();
    const repo = crearSavingsRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    const movimiento = await repo.agregar(movimientoParcial());
    await repo.eliminar(movimiento.id);
    const lista = await repo.listar();

    expect(lista).toHaveLength(0);
    expect(store.pendientes.some((p) => p.operacion === 'delete' && p.id === movimiento.id)).toBe(true);
  });
});
