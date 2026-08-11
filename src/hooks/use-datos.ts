import { useApp } from '../app-context';
import { useCollection } from './use-collection';
import { useSingleton } from './use-singleton';
import type { Expense, Sector, Budget, SavingMovement, Investment, InvestmentSale, BrokerCash } from '../domain/types';

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

export function useInversiones(): Investment[] {
  const { repos } = useApp();
  return useCollection<Investment>({
    listar: () => repos.investments.listar(),
    suscribir: (cb) => repos.investments.suscribir(cb),
  });
}

export function useVentas(): InvestmentSale[] {
  const { repos } = useApp();
  return useCollection<InvestmentSale>({
    listar: () => repos.investmentSales.listar(),
    suscribir: (cb) => repos.investmentSales.suscribir(cb),
  });
}

export function useBrokerCash(): BrokerCash {
  const { repos } = useApp();
  return useSingleton<BrokerCash>({
    obtener: () => repos.brokerCash.obtener(),
    suscribir: (cb) => repos.brokerCash.suscribir(cb),
    valorInicial: { id: 'actual', centavosArs: 0 },
  });
}
