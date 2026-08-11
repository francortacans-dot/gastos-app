import { crearInvestmentSaleRepo } from '../investment-sale-repo';
import type { LocalStore, PendingWrite } from '../../db/local-store';
import type { InvestmentSale } from '../../domain/types';

jest.mock('expo-crypto', () => ({
  __esModule: true,
  randomUUID: () => require('node:crypto').randomUUID(),
}));

function crearStoreFake(): LocalStore & { pendientes: PendingWrite[] } {
  const pendientes: PendingWrite[] = [];
  const snapshots: Record<string, unknown[]> = { 'investment-sales': [] };
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

function ventaParcial(): Omit<InvestmentSale, 'id'> {
  return {
    investmentId: 'inv1',
    nominalesVendidos: 4,
    precioVenta: 15,
    cotizacionUsada: null,
    ingresoCentavosArs: 6000,
    gananciaCentavosArs: 2000,
    fecha: '2026-08-11',
  };
}

describe('crearInvestmentSaleRepo sin conexión', () => {
  it('agregar() genera un id, guarda snapshot local y encola la escritura', async () => {
    const store = crearStoreFake();
    const repo = crearInvestmentSaleRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    const venta = await repo.agregar(ventaParcial());

    expect(typeof venta.id).toBe('string');
    expect(venta.id.length).toBeGreaterThan(0);
    expect(store.pendientes).toHaveLength(1);
    expect(store.pendientes[0].coleccion).toBe('investment-sales');
  });

  it('listar() devuelve lo guardado en el snapshot local', async () => {
    const store = crearStoreFake();
    const repo = crearInvestmentSaleRepo({ db: null as any, uid: 'u1', localStore: store, estaOnline: () => false });

    await repo.agregar(ventaParcial());
    const lista = await repo.listar();

    expect(lista).toHaveLength(1);
    expect(lista[0].ingresoCentavosArs).toBe(6000);
  });
});
