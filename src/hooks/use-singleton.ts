import { useEffect, useState } from 'react';

interface ParametrosUseSingleton<T> {
  obtener(): Promise<T>;
  suscribir(cb: (valor: T) => void): () => void;
  valorInicial: T;
}

/** Como useCollection pero para un documento único (ej. el cash del broker) en vez de una lista. */
export function useSingleton<T>({ obtener, suscribir, valorInicial }: ParametrosUseSingleton<T>): T {
  const [valor, setValor] = useState<T>(valorInicial);

  useEffect(() => {
    let vigente = true;
    obtener().then((v) => {
      if (vigente) setValor(v);
    });
    const desuscribir = suscribir((v) => setValor(v));
    return () => {
      vigente = false;
      desuscribir();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return valor;
}
