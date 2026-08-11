import { doc, setDoc, collection, onSnapshot, type Firestore } from 'firebase/firestore';
import type { LocalStore } from '../db/local-store';
import type { BrokerCash } from '../domain/types';

interface DepsBrokerCashRepo {
  db: Firestore;
  uid: string;
  localStore: LocalStore;
  estaOnline: () => boolean;
}

export interface BrokerCashRepo {
  obtener(): Promise<BrokerCash>;
  guardar(centavosArs: number): Promise<BrokerCash>;
  suscribir(cb: (valor: BrokerCash) => void): () => void;
}

const COLECCION = 'broker-cash' as const;
const ID_DOC = 'actual' as const;
const VALOR_INICIAL: BrokerCash = { id: ID_DOC, centavosArs: 0 };

export function crearBrokerCashRepo(deps: DepsBrokerCashRepo): BrokerCashRepo {
  const { db, uid, localStore, estaOnline } = deps;

  async function leerLocal(): Promise<BrokerCash> {
    const lista = (await localStore.leerSnapshot(COLECCION)) as BrokerCash[];
    return lista[0] ?? VALOR_INICIAL;
  }

  async function persistir(valor: BrokerCash): Promise<BrokerCash> {
    await localStore.guardarSnapshot(COLECCION, [valor]);

    await localStore.guardarPendiente({
      id: valor.id,
      coleccion: COLECCION,
      operacion: 'set',
      datos: valor as unknown as Record<string, unknown>,
      creadoEn: Date.now(),
    });

    if (estaOnline()) {
      await setDoc(doc(db, 'users', uid, COLECCION, valor.id), valor).catch(() => {});
    }

    return valor;
  }

  return {
    async obtener(): Promise<BrokerCash> {
      return leerLocal();
    },

    async guardar(centavosArs: number): Promise<BrokerCash> {
      return persistir({ id: ID_DOC, centavosArs });
    },

    suscribir(cb: (valor: BrokerCash) => void): () => void {
      if (!estaOnline()) return () => {};
      return onSnapshot(collection(db, 'users', uid, COLECCION), (snapshot) => {
        const doc0 = snapshot.docs.find((d) => d.id === ID_DOC);
        const valor: BrokerCash = doc0 ? (doc0.data() as BrokerCash) : VALOR_INICIAL;
        localStore.guardarSnapshot(COLECCION, [valor]).then(() => cb(valor));
      });
    },
  };
}
