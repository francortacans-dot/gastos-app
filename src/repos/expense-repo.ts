import { doc, deleteDoc, setDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import type { LocalStore } from '../db/local-store';
import type { Expense } from '../domain/types';

interface DepsExpenseRepo {
  db: Firestore;
  uid: string;
  localStore: LocalStore;
  estaOnline: () => boolean;
}

export interface ExpenseRepo {
  listar(): Promise<Expense[]>;
  agregar(gasto: Omit<Expense, 'id'>): Promise<Expense>;
  eliminar(id: string): Promise<void>;
  /** Se suscribe a cambios en tiempo real (solo tiene efecto real si hay red). Devuelve función para desuscribirse. */
  suscribir(cb: (gastos: Expense[]) => void): () => void;
}

const COLECCION = 'expenses' as const;

export function crearExpenseRepo(deps: DepsExpenseRepo): ExpenseRepo {
  const { db, uid, localStore, estaOnline } = deps;

  async function leerLocal(): Promise<Expense[]> {
    const datos = await localStore.leerSnapshot(COLECCION);
    return datos as Expense[];
  }

  async function escribirLocal(gastos: Expense[]): Promise<void> {
    await localStore.guardarSnapshot(COLECCION, gastos);
  }

  return {
    async listar(): Promise<Expense[]> {
      return leerLocal();
    },

    async agregar(gastoSinId: Omit<Expense, 'id'>): Promise<Expense> {
      const gasto: Expense = { ...gastoSinId, id: Crypto.randomUUID() };

      const actuales = await leerLocal();
      await escribirLocal([...actuales, gasto]);

      await localStore.guardarPendiente({
        id: gasto.id,
        coleccion: COLECCION,
        operacion: 'set',
        datos: gasto as unknown as Record<string, unknown>,
        creadoEn: Date.now(),
      });

      if (estaOnline()) {
        await setDoc(doc(db, 'users', uid, COLECCION, gasto.id), gasto).catch(() => {
          // si falla, la cola de sincronización (Task 6) la reintenta después
        });
      }

      return gasto;
    },

    async eliminar(id: string): Promise<void> {
      const actuales = await leerLocal();
      await escribirLocal(actuales.filter((g) => g.id !== id));

      await localStore.guardarPendiente({
        id,
        coleccion: COLECCION,
        operacion: 'delete',
        datos: null,
        creadoEn: Date.now(),
      });

      if (estaOnline()) {
        await deleteDoc(doc(db, 'users', uid, COLECCION, id)).catch(() => {});
      }
    },

    suscribir(cb: (gastos: Expense[]) => void): () => void {
      if (!estaOnline()) return () => {};

      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const gastos = snapshot.docs.map((d) => d.data() as Expense);
        escribirLocal(gastos).then(() => cb(gastos));
      });
    },
  };
}
