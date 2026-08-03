import { doc, deleteDoc, setDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import type { LocalStore } from '../db/local-store';
import type { Sector } from '../domain/types';

interface DepsSectorRepo {
  db: Firestore;
  uid: string;
  localStore: LocalStore;
  estaOnline: () => boolean;
}

export interface SectorRepo {
  listar(): Promise<Sector[]>;
  guardar(sector: Sector | Omit<Sector, 'id'>): Promise<Sector>;
  eliminar(id: string): Promise<void>;
  suscribir(cb: (sectores: Sector[]) => void): () => void;
}

const COLECCION = 'sectors' as const;

export function crearSectorRepo(deps: DepsSectorRepo): SectorRepo {
  const { db, uid, localStore, estaOnline } = deps;

  async function leerLocal(): Promise<Sector[]> {
    return (await localStore.leerSnapshot(COLECCION)) as Sector[];
  }

  async function escribirLocal(sectores: Sector[]): Promise<void> {
    await localStore.guardarSnapshot(COLECCION, sectores);
  }

  return {
    async listar(): Promise<Sector[]> {
      return leerLocal();
    },

    async guardar(sectorParcial): Promise<Sector> {
      const sector: Sector = 'id' in sectorParcial ? sectorParcial : { ...sectorParcial, id: Crypto.randomUUID() };

      const actuales = await leerLocal();
      const sinEsteId = actuales.filter((s) => s.id !== sector.id);
      await escribirLocal([...sinEsteId, sector]);

      await localStore.guardarPendiente({
        id: sector.id,
        coleccion: COLECCION,
        operacion: 'set',
        datos: sector as unknown as Record<string, unknown>,
        creadoEn: Date.now(),
      });

      if (estaOnline()) {
        await setDoc(doc(db, 'users', uid, COLECCION, sector.id), sector).catch(() => {});
      }

      return sector;
    },

    async eliminar(id: string): Promise<void> {
      const actuales = await leerLocal();
      await escribirLocal(actuales.filter((s) => s.id !== id));

      await localStore.guardarPendiente({ id, coleccion: COLECCION, operacion: 'delete', datos: null, creadoEn: Date.now() });

      if (estaOnline()) {
        await deleteDoc(doc(db, 'users', uid, COLECCION, id)).catch(() => {});
      }
    },

    suscribir(cb: (sectores: Sector[]) => void): () => void {
      if (!estaOnline()) return () => {};
      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const sectores = snapshot.docs.map((d) => d.data() as Sector);
        escribirLocal(sectores).then(() => cb(sectores));
      });
    },
  };
}
