import { useEffect, useState } from 'react';

interface ParametrosUseCollection<T> {
  listar(): Promise<T[]>;
  suscribir(cb: (valores: T[]) => void): () => void;
}

/** Patrón genérico: carga la lista inicial desde el repo y se re-suscribe a cambios en tiempo real. */
export function useCollection<T>({ listar, suscribir }: ParametrosUseCollection<T>): T[] {
  const [valores, setValores] = useState<T[]>([]);

  useEffect(() => {
    let vigente = true;
    listar().then((v) => {
      if (vigente) setValores(v);
    });
    const desuscribir = suscribir((v) => setValores(v));
    return () => {
      vigente = false;
      desuscribir();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return valores;
}
