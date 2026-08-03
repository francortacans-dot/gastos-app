import { doc, setDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
import type { LocalStore } from '../db/local-store';
import type { Budget } from '../domain/types';

interface DepsBudgetRepo {
  db: Firestore;
  uid: string;
  localStore: LocalStore;
  estaOnline: () => boolean;
}

export interface BudgetRepo {
  listar(): Promise<Budget[]>;
  guardar(presupuesto: Budget): Promise<Budget>;
  suscribir(cb: (presupuestos: Budget[]) => void): () => void;
}

const COLECCION = 'budgets' as const;

export function crearBudgetRepo(deps: DepsBudgetRepo): BudgetRepo {
  const { db, uid, localStore, estaOnline } = deps;

  async function leerLocal(): Promise<Budget[]> {
    return (await localStore.leerSnapshot(COLECCION)) as Budget[];
  }

  async function escribirLocal(presupuestos: Budget[]): Promise<void> {
    await localStore.guardarSnapshot(COLECCION, presupuestos);
  }

  return {
    async listar(): Promise<Budget[]> {
      return leerLocal();
    },

    async guardar(presupuesto: Budget): Promise<Budget> {
      const actuales = await leerLocal();
      const sinEsteMes = actuales.filter((p) => p.mes !== presupuesto.mes);
      await escribirLocal([...sinEsteMes, presupuesto]);

      await localStore.guardarPendiente({
        id: presupuesto.mes,
        coleccion: COLECCION,
        operacion: 'set',
        datos: presupuesto as unknown as Record<string, unknown>,
        creadoEn: Date.now(),
      });

      if (estaOnline()) {
        await setDoc(doc(db, 'users', uid, COLECCION, presupuesto.mes), presupuesto).catch(() => {});
      }

      return presupuesto;
    },

    suscribir(cb: (presupuestos: Budget[]) => void): () => void {
      if (!estaOnline()) return () => {};
      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const presupuestos = snapshot.docs.map((d) => d.data() as Budget);
        escribirLocal(presupuestos).then(() => cb(presupuestos));
      });
    },
  };
}
