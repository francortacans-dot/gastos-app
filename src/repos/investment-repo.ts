import { doc, deleteDoc, setDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import type { LocalStore } from '../db/local-store';
import type { Investment } from '../domain/types';

interface DepsInvestmentRepo {
  db: Firestore;
  uid: string;
  localStore: LocalStore;
  estaOnline: () => boolean;
}

export interface InvestmentRepo {
  listar(): Promise<Investment[]>;
  agregar(posicion: Omit<Investment, 'id'>): Promise<Investment>;
  actualizar(id: string, cambios: Partial<Pick<Investment, 'nominales' | 'status'>>): Promise<Investment>;
  eliminar(id: string): Promise<void>;
  suscribir(cb: (inversiones: Investment[]) => void): () => void;
}

const COLECCION = 'investments' as const;

export function crearInvestmentRepo(deps: DepsInvestmentRepo): InvestmentRepo {
  const { db, uid, localStore, estaOnline } = deps;

  async function leerLocal(): Promise<Investment[]> {
    return (await localStore.leerSnapshot(COLECCION)) as Investment[];
  }

  async function escribirLocal(inversiones: Investment[]): Promise<void> {
    await localStore.guardarSnapshot(COLECCION, inversiones);
  }

  async function persistir(inversion: Investment): Promise<Investment> {
    await localStore.guardarPendiente({
      id: inversion.id,
      coleccion: COLECCION,
      operacion: 'set',
      datos: inversion as unknown as Record<string, unknown>,
      creadoEn: Date.now(),
    });

    if (estaOnline()) {
      await setDoc(doc(db, 'users', uid, COLECCION, inversion.id), inversion).catch(() => {});
    }

    return inversion;
  }

  return {
    async listar(): Promise<Investment[]> {
      return leerLocal();
    },

    async agregar(posicionSinId: Omit<Investment, 'id'>): Promise<Investment> {
      const inversion: Investment = { ...posicionSinId, id: Crypto.randomUUID() };

      const actuales = await leerLocal();
      await escribirLocal([...actuales, inversion]);

      return persistir(inversion);
    },

    async actualizar(
      id: string,
      cambios: Partial<Pick<Investment, 'nominales' | 'status'>>
    ): Promise<Investment> {
      const actuales = await leerLocal();
      const existente = actuales.find((i) => i.id === id);
      if (!existente) {
        throw new Error(`No existe una inversión con id ${id}`);
      }
      const actualizada: Investment = { ...existente, ...cambios };

      await escribirLocal(actuales.map((i) => (i.id === id ? actualizada : i)));

      return persistir(actualizada);
    },

    async eliminar(id: string): Promise<void> {
      const actuales = await leerLocal();
      await escribirLocal(actuales.filter((i) => i.id !== id));

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

    suscribir(cb: (inversiones: Investment[]) => void): () => void {
      if (!estaOnline()) return () => {};
      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const inversiones = snapshot.docs.map((d) => d.data() as Investment);
        escribirLocal(inversiones).then(() => cb(inversiones));
      });
    },
  };
}
