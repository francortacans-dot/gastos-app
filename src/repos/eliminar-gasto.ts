import type { Expense, SavingMovement } from '../domain/types';
import type { Repos } from './create-repo';

/**
 * Borra un gasto y, si estaba pagado con ahorro, borra también el retiro de
 * ahorro vinculado (así el saldo de ahorro vuelve a como estaba antes de
 * ese gasto). Recibe los movimientos actuales ya cargados por el llamador.
 */
export async function eliminarGasto(
  repos: Repos,
  gasto: Expense,
  movimientosActuales: SavingMovement[]
): Promise<void> {
  await repos.expenses.eliminar(gasto.id);

  const movimientoVinculado = movimientosActuales.find((m) => m.gastoId === gasto.id);
  if (movimientoVinculado) {
    await repos.savings.eliminar(movimientoVinculado.id);
  }
}
