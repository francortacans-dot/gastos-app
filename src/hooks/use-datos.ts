import { useApp } from '../app-context';
import { useCollection } from './use-collection';
import type { Expense, Sector, Budget, SavingMovement } from '../domain/types';

export function useGastos(): Expense[] {
  const { repos } = useApp();
  return useCollection<Expense>({ listar: () => repos.expenses.listar(), suscribir: (cb) => repos.expenses.suscribir(cb) });
}

export function useSectores(): Sector[] {
  const { repos } = useApp();
  return useCollection<Sector>({ listar: () => repos.sectors.listar(), suscribir: (cb) => repos.sectors.suscribir(cb) });
}

export function usePresupuestos(): Budget[] {
  const { repos } = useApp();
  return useCollection<Budget>({ listar: () => repos.budgets.listar(), suscribir: (cb) => repos.budgets.suscribir(cb) });
}

export function useAhorros(): SavingMovement[] {
  const { repos } = useApp();
  return useCollection<SavingMovement>({ listar: () => repos.savings.listar(), suscribir: (cb) => repos.savings.suscribir(cb) });
}
