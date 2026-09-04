import { totalAhorrado } from '../domain/budget';
import { formatCentavos } from '../domain/money';
import type { Expense, SavingMovement } from '../domain/types';
import type { Repos } from './create-repo';

export interface ResultadoPagoGasto {
  gasto: Expense;
  movimiento: SavingMovement | null;
}

/**
 * Guarda un gasto. Si su fuente es 'ahorro', además crea automáticamente el
 * retiro de ahorro vinculado (SavingMovement con destino 'gasto' y gastoId
 * apuntando a este gasto), para que el saldo de ahorro (SavingMovement[])
 * sea siempre la única fuente de verdad. Recibe los movimientos actuales ya
 * cargados por el llamador (no los vuelve a leer del repo).
 */
export async function pagarGasto(
  repos: Repos,
  gasto: Omit<Expense, 'id'>,
  movimientosActuales: SavingMovement[]
): Promise<ResultadoPagoGasto> {
  if (gasto.centavosArs <= 0) {
    throw new Error('El monto del gasto debe ser mayor a 0');
  }
  if (gasto.fuente === 'ahorro') {
    const saldoAhorro = totalAhorrado(movimientosActuales);
    if (gasto.centavosArs > saldoAhorro) {
      throw new Error(`No podés pagar con ahorro más de ${formatCentavos(saldoAhorro)} (tu saldo de ahorro)`);
    }
  }

  const gastoGuardado = await repos.expenses.agregar(gasto);

  if (gasto.fuente !== 'ahorro') {
    return { gasto: gastoGuardado, movimiento: null };
  }

  const movimiento = await repos.savings.agregar({
    centavosArs: -gasto.centavosArs,
    fecha: gasto.fecha,
    nota: `Gasto: ${gasto.descripcion ?? gasto.lugar ?? 'sin descripción'}`,
    origen: null,
    destino: 'gasto',
    gastoId: gastoGuardado.id,
  });

  return { gasto: gastoGuardado, movimiento };
}
