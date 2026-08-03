import { doc, setDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
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

    suscribir(cb: (movimientos: SavingMovement[]) => void): () => void {
      if (!estaOnline()) return () => {};
      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const movimientos = snapshot.docs.map((d) => d.data() as SavingMovement);
        escribirLocal(movimientos).then(() => cb(movimientos));
      });
    },
  };
}
