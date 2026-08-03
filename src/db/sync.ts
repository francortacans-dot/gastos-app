import type { LocalStore, PendingWrite } from './local-store';

interface ParametrosCola {
  store: LocalStore;
  subirAFirestore: (escritura: PendingWrite) => Promise<void>;
  estaOnline: () => boolean;
}

export function crearColaDeSincronizacion(params: ParametrosCola) {
  const { store, subirAFirestore, estaOnline } = params;

  return {
    async encolar(escritura: Omit<PendingWrite, 'creadoEn'>): Promise<void> {
      await store.guardarPendiente({ ...escritura, creadoEn: Date.now() });
    },

    async sincronizar(): Promise<{ subidos: number; fallidos: number }> {
      if (!estaOnline()) {
        return { subidos: 0, fallidos: 0 };
      }

      const pendientes = await store.listarPendientes();
      let subidos = 0;
      let fallidos = 0;

      for (const escritura of pendientes) {
        try {
          await subirAFirestore(escritura);
          await store.borrarPendiente(escritura.id);
          subidos++;
        } catch {
          fallidos++;
        }
      }

      return { subidos, fallidos };
    },
  };
}
