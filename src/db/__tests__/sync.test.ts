import { crearColaDeSincronizacion } from '../sync';
import type { LocalStore, PendingWrite } from '../local';

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

describe('encolar', () => {
  it('guarda la escritura en el store con timestamp', async () => {
    const store = crearStoreFake();
    const cola = crearColaDeSincronizacion({
      store,
      subirAFirestore: jest.fn(),
      estaOnline: () => false,
    });

    await cola.encolar({ id: 'e1', coleccion: 'expenses', operacion: 'set', datos: { monto: 100 } });

    expect(store.pendientes).toHaveLength(1);
    expect(store.pendientes[0].id).toBe('e1');
    expect(typeof store.pendientes[0].creadoEn).toBe('number');
  });
});

describe('sincronizar', () => {
  it('no hace nada si está offline', async () => {
    const store = crearStoreFake();
    const subir = jest.fn();
    const cola = crearColaDeSincronizacion({ store, subirAFirestore: subir, estaOnline: () => false });
    await cola.encolar({ id: 'e1', coleccion: 'expenses', operacion: 'set', datos: {} });

    const resultado = await cola.sincronizar();

    expect(subir).not.toHaveBeenCalled();
    expect(resultado).toEqual({ subidos: 0, fallidos: 0 });
    expect(store.pendientes).toHaveLength(1);
  });

  it('sube cada pendiente y lo borra del store si tiene éxito', async () => {
    const store = crearStoreFake();
    const subir = jest.fn().mockResolvedValue(undefined);
    const cola = crearColaDeSincronizacion({ store, subirAFirestore: subir, estaOnline: () => true });
    await cola.encolar({ id: 'e1', coleccion: 'expenses', operacion: 'set', datos: { monto: 100 } });
    await cola.encolar({ id: 'e2', coleccion: 'sectors', operacion: 'delete', datos: null });

    const resultado = await cola.sincronizar();

    expect(subir).toHaveBeenCalledTimes(2);
    expect(store.pendientes).toHaveLength(0);
    expect(resultado).toEqual({ subidos: 2, fallidos: 0 });
  });

  it('si una escritura falla, la deja en la cola y sigue con las demás', async () => {
    const store = crearStoreFake();
    const subir = jest
      .fn()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValueOnce(undefined);
    const cola = crearColaDeSincronizacion({ store, subirAFirestore: subir, estaOnline: () => true });
    await cola.encolar({ id: 'e1', coleccion: 'expenses', operacion: 'set', datos: {} });
    await cola.encolar({ id: 'e2', coleccion: 'expenses', operacion: 'set', datos: {} });

    const resultado = await cola.sincronizar();

    expect(resultado).toEqual({ subidos: 1, fallidos: 1 });
    expect(store.pendientes).toHaveLength(1);
    expect(store.pendientes[0].id).toBe('e1');
  });
});
