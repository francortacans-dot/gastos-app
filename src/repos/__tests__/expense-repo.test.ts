import { crearExpenseRepo } from '../expense-repo';
import type { LocalStore, PendingWrite } from '../../db/local-store';
import type { Expense } from '../../domain/types';

// El mock automático de jest-expo para expo-crypto devuelve randomUUID() = undefined
// (ver node_modules/expo-crypto/mocks/ExpoCrypto.ts), así que lo pisamos acá con la
// implementación real de Node para que este repo, que genera ids con Crypto.randomUUID(),
// tenga ids reales y únicos en los tests. Mock local (no global) para no afectar otros
// tests que necesiten el resto de las exports de expo-crypto.
jest.mock('expo-crypto', () => ({
  __esModule: true,
  randomUUID: () => require('node:crypto').randomUUID(),
}));

function crearStoreFake(): LocalStore & { pendientes: PendingWrite[] } {
  const pendientes: PendingWrite[] = [];
  const snapshots: Record<string, unknown[]> = { expenses: [] };
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

function gastoParcial(): Omit<Expense, 'id'> {
  return {
    centavosArs: 1500,
    montoOriginal: 15,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    fecha: '2026-06-01',
    sectorId: null,
    lugar: null,
    descripcion: null,
    metodoPago: null,
    fuente: 'disponible',
  };
}

describe('crearExpenseRepo sin conexión', () => {
  it('agregar() genera un id, guarda snapshot local y encola la escritura', async () => {
    const store = crearStoreFake();
    const repo = crearExpenseRepo({
      db: null as any,
      uid: 'u1',
      localStore: store,
      estaOnline: () => false,
    });

    const gasto = await repo.agregar(gastoParcial());

    expect(typeof gasto.id).toBe('string');
    expect(gasto.id.length).toBeGreaterThan(0);
    expect(store.pendientes).toHaveLength(1);
    expect(store.pendientes[0].coleccion).toBe('expenses');
    expect(store.pendientes[0].operacion).toBe('set');
  });

  it('listar() devuelve lo guardado en el snapshot local', async () => {
    const store = crearStoreFake();
    const repo = crearExpenseRepo({
      db: null as any,
      uid: 'u1',
      localStore: store,
      estaOnline: () => false,
    });

    await repo.agregar(gastoParcial());
    const lista = await repo.listar();

    expect(lista).toHaveLength(1);
    expect(lista[0].centavosArs).toBe(1500);
  });

  it('eliminar() encola un delete y lo saca de listar()', async () => {
    const store = crearStoreFake();
    const repo = crearExpenseRepo({
      db: null as any,
      uid: 'u1',
      localStore: store,
      estaOnline: () => false,
    });

    const gasto = await repo.agregar(gastoParcial());
    await repo.eliminar(gasto.id);
    const lista = await repo.listar();

    expect(lista).toHaveLength(0);
    expect(store.pendientes.some((p) => p.operacion === 'delete' && p.id === gasto.id)).toBe(true);
  });
});
