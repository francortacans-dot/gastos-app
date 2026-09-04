import { doc, setDoc, deleteDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import type { LocalStore } from '../db/local-store';
import type { SavingMovement } from '../domain/types';

interface DepsSavingsRepo {
  db: Firestore;
  uid: string;
  localStore: LocalStore;
  estaOnline: () => boolean;
}

export interface SavingsRepo {
  listar(): Promise<SavingMovement[]>;
  agregar(movimiento: Omit<SavingMovement, 'id'>): Promise<SavingMovement>;
  eliminar(id: string): Promise<void>;
  suscribir(cb: (movimientos: SavingMovement[]) => void): () => void;
}

const COLECCION = 'savings' as const;

export function crearSavingsRepo(deps: DepsSavingsRepo): SavingsRepo {
  const { db, uid, localStore, estaOnline } = deps;

  async function leerLocal(): Promise<SavingMovement[]> {
    return (await localStore.leerSnapshot(COLECCION)) as SavingMovement[];
  }

  async function escribirLocal(movimientos: SavingMovement[]): Promise<void> {
    await localStore.guardarSnapshot(COLECCION, movimientos);
  }

  return {
    async listar(): Promise<SavingMovement[]> {
      return leerLocal();
    },

    async agregar(movimientoSinId: Omit<SavingMovement, 'id'>): Promise<SavingMovement> {
      const movimiento: SavingMovement = { ...movimientoSinId, id: Crypto.randomUUID() };

      const actuales = await leerLocal();
      await escribirLocal([...actuales, movimiento]);

      await localStore.guardarPendiente({
        id: movimiento.id,
        coleccion: COLECCION,
        operacion: 'set',
        datos: movimiento as unknown as Record<string, unknown>,
        creadoEn: Date.now(),
      });

      if (estaOnline()) {
        await setDoc(doc(db, 'users', uid, COLECCION, movimiento.id), movimiento).catch(() => {});
      }

      return movimiento;
    },

    async eliminar(id: string): Promise<void> {
      const actuales = await leerLocal();
      await escribirLocal(actuales.filter((m) => m.id !== id));

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

    suscribir(cb: (movimientos: SavingMovement[]) => void): () => void {
      if (!estaOnline()) return () => {};
      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const movimientos = snapshot.docs.map((d) => d.data() as SavingMovement);
        escribirLocal(movimientos).then(() => cb(movimientos));
      });
    },
  };
}
