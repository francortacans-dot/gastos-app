import { useState } from 'react';
import { mesAnterior, siguienteMes } from '../domain/budget';
import type { MonthKey } from '../domain/types';

function mesDeHoy(): MonthKey {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
}

export function useMesActual() {
  const [mes, setMes] = useState<MonthKey>(mesDeHoy());

  return {
    mes,
    irAMesAnterior: () => setMes((m) => mesAnterior(m)),
    irAMesSiguiente: () => setMes((m) => siguienteMes(m)),
    irAHoy: () => setMes(mesDeHoy()),
  };
}
