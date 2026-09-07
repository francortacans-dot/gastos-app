import { totalAhorrado } from '../domain/budget';
import { formatCentavos } from '../domain/money';
import type { Expense, SavingMovement } from '../domain/types';
import type { Repos } from './create-repo';
import type { ResultadoPagoGasto } from './pagar-gasto';

/**
 * Guarda la edición de un gasto ya existente y recalcula el retiro de ahorro
 * vinculado (si correspondía o pasa a corresponder). Borra el movimiento
 * viejo antes de validar/crear el nuevo, para que el ahorro liberado al
 * cambiar de fuente o de monto cuente a favor del gasto editado, no en contra.
 */
export async function editarGasto(
  repos: Repos,
  gastoActualizado: Expense,
  movimientosActuales: SavingMovement[]
): Promise<ResultadoPagoGasto> {
  if (gastoActualizado.centavosArs <= 0) {
    throw new Error('El monto del gasto debe ser mayor a 0');
  }

  const movimientoViejo = movimientosActuales.find((m) => m.gastoId === gastoActualizado.id);
  if (movimientoViejo) {
    await repos.savings.eliminar(movimientoViejo.id);
  }

  if (gastoActualizado.fuente === 'ahorro') {
    const saldoBase = totalAhorrado(movimientosActuales) + (movimientoViejo ? -movimientoViejo.centavosArs : 0);
    if (gastoActualizado.centavosArs > saldoBase) {
      throw new Error(`No podés pagar con ahorro más de ${formatCentavos(saldoBase)} (tu saldo de ahorro)`);
    }
  }

  const gastoGuardado = await repos.expenses.guardar(gastoActualizado);

  if (gastoActualizado.fuente !== 'ahorro') {
    return { gasto: gastoGuardado, movimiento: null };
  }

  const movimiento = await repos.savings.agregar({
    centavosArs: -gastoActualizado.centavosArs,
    fecha: gastoActualizado.fecha,
    nota: `Gasto: ${gastoActualizado.descripcion ?? gastoActualizado.lugar ?? 'sin descripción'}`,
    origen: null,
    destino: 'gasto',
    gastoId: gastoActualizado.id,
  });

  return { gasto: gastoGuardado, movimiento };
}
