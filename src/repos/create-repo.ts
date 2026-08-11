import NetInfo from '@react-native-community/netinfo';
import { getFirestoreDb } from '../firebase/app';
import { localStoreSqlite } from '../db/local';
import { crearExpenseRepo, type ExpenseRepo } from './expense-repo';
import { crearSectorRepo, type SectorRepo } from './sector-repo';
import { crearBudgetRepo, type BudgetRepo } from './budget-repo';
import { crearSavingsRepo, type SavingsRepo } from './savings-repo';
import { crearInvestmentRepo, type InvestmentRepo } from './investment-repo';
import { crearInvestmentSaleRepo, type InvestmentSaleRepo } from './investment-sale-repo';
import { crearBrokerCashRepo, type BrokerCashRepo } from './broker-cash-repo';

export interface Repos {
  expenses: ExpenseRepo;
  sectors: SectorRepo;
  budgets: BudgetRepo;
  savings: SavingsRepo;
  investments: InvestmentRepo;
  investmentSales: InvestmentSaleRepo;
  brokerCash: BrokerCashRepo;
}

let estadoConexion = true;
NetInfo.addEventListener((estado) => {
  estadoConexion = Boolean(estado.isConnected);
});
function estaOnline(): boolean {
  return estadoConexion;
}

export function crearRepos(uid: string): Repos {
  const db = getFirestoreDb();
  const deps = { db, uid, localStore: localStoreSqlite, estaOnline };

  return {
    expenses: crearExpenseRepo(deps),
    sectors: crearSectorRepo(deps),
    budgets: crearBudgetRepo(deps),
    savings: crearSavingsRepo(deps),
    investments: crearInvestmentRepo(deps),
    investmentSales: crearInvestmentSaleRepo(deps),
    brokerCash: crearBrokerCashRepo(deps),
  };
}
