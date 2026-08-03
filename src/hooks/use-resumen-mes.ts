import { useMemo } from 'react';
import { calcularResumenMes, type ResumenMes } from '../domain/budget';
import { useGastos, usePresupuestos, useAhorros } from './use-datos';
import type { MonthKey } from '../domain/types';

export function useResumenMes(mes: MonthKey): ResumenMes {
  const gastos = useGastos();
  const presupuestos = usePresupuestos();
  const ahorros = useAhorros();

  return useMemo(
    () => calcularResumenMes({ mes, presupuestos, gastos, ahorros }),
    [mes, presupuestos, gastos, ahorros]
  );
}
