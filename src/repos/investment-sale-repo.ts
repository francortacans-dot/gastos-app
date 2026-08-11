import { doc, setDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import type { LocalStore } from '../db/local-store';
import type { InvestmentSale } from '../domain/types';

interface DepsInvestmentSaleRepo {
  db: Firestore;
  uid: string;
  localStore: LocalStore;
  estaOnline: () => boolean;
}

export interface InvestmentSaleRepo {
  listar(): Promise<InvestmentSale[]>;
  agregar(venta: Omit<InvestmentSale, 'id'>): Promise<InvestmentSale>;
  suscribir(cb: (ventas: InvestmentSale[]) => void): () => void;
}

const COLECCION = 'investment-sales' as const;

export function crearInvestmentSaleRepo(deps: DepsInvestmentSaleRepo): InvestmentSaleRepo {
  const { db, uid, localStore, estaOnline } = deps;

  async function leerLocal(): Promise<InvestmentSale[]> {
    return (await localStore.leerSnapshot(COLECCION)) as InvestmentSale[];
  }

  async function escribirLocal(ventas: InvestmentSale[]): Promise<void> {
    await localStore.guardarSnapshot(COLECCION, ventas);
  }

  return {
    async listar(): Promise<InvestmentSale[]> {
      return leerLocal();
    },

    async agregar(ventaSinId: Omit<InvestmentSale, 'id'>): Promise<InvestmentSale> {
      const venta: InvestmentSale = { ...ventaSinId, id: Crypto.randomUUID() };

      const actuales = await leerLocal();
      await escribirLocal([...actuales, venta]);

      await localStore.guardarPendiente({
        id: venta.id,
        coleccion: COLECCION,
        operacion: 'set',
        datos: venta as unknown as Record<string, unknown>,
        creadoEn: Date.now(),
      });

      if (estaOnline()) {
        await setDoc(doc(db, 'users', uid, COLECCION, venta.id), venta).catch(() => {});
      }

      return venta;
    },

    suscribir(cb: (ventas: InvestmentSale[]) => void): () => void {
      if (!estaOnline()) return () => {};
      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const ventas = snapshot.docs.map((d) => d.data() as InvestmentSale);
        escribirLocal(ventas).then(() => cb(ventas));
      });
    },
  };
}
