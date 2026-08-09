import { doc, deleteDoc, setDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import type { LocalStore } from '../db/local-store';
import type { Objetivo } from '../domain/types';

interface DepsGoalRepo {
  db: Firestore;
  uid: string;
  localStore: LocalStore;
  estaOnline: () => boolean;
}

export interface GoalRepo {
  listar(): Promise<Objetivo[]>;
  guardar(objetivo: Objetivo | Omit<Objetivo, 'id'>): Promise<Objetivo>;
  eliminar(id: string): Promise<void>;
  suscribir(cb: (objetivos: Objetivo[]) => void): () => void;
}

const COLECCION = 'goals' as const;

export function crearGoalRepo(deps: DepsGoalRepo): GoalRepo {
  const { db, uid, localStore, estaOnline } = deps;

  async function leerLocal(): Promise<Objetivo[]> {
    return (await localStore.leerSnapshot(COLECCION)) as Objetivo[];
  }

  async function escribirLocal(objetivos: Objetivo[]): Promise<void> {
    await localStore.guardarSnapshot(COLECCION, objetivos);
  }

  return {
    async listar(): Promise<Objetivo[]> {
      return leerLocal();
    },

    async guardar(objetivoParcial): Promise<Objetivo> {
      const objetivo: Objetivo = 'id' in objetivoParcial ? objetivoParcial : { ...objetivoParcial, id: Crypto.randomUUID() };

      const actuales = await leerLocal();
      const sinEsteId = actuales.filter((o) => o.id !== objetivo.id);
      await escribirLocal([...sinEsteId, objetivo]);

      await localStore.guardarPendiente({
        id: objetivo.id,
        coleccion: COLECCION,
        operacion: 'set',
        datos: objetivo as unknown as Record<string, unknown>,
        creadoEn: Date.now(),
      });

      if (estaOnline()) {
        await setDoc(doc(db, 'users', uid, COLECCION, objetivo.id), objetivo).catch(() => {});
      }

      return objetivo;
    },

    async eliminar(id: string): Promise<void> {
      const actuales = await leerLocal();
      await escribirLocal(actuales.filter((o) => o.id !== id));

      await localStore.guardarPendiente({ id, coleccion: COLECCION, operacion: 'delete', datos: null, creadoEn: Date.now() });

      if (estaOnline()) {
        await deleteDoc(doc(db, 'users', uid, COLECCION, id)).catch(() => {});
      }
    },

    suscribir(cb: (objetivos: Objetivo[]) => void): () => void {
      if (!estaOnline()) return () => {};
      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const objetivos = snapshot.docs.map((d) => d.data() as Objetivo);
        escribirLocal(objetivos).then(() => cb(objetivos));
      });
    },
  };
}
