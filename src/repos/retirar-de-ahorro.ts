import { totalAhorrado } from '../domain/budget';
import { formatCentavos } from '../domain/money';
import type { BrokerCash, SavingMovement } from '../domain/types';
import type { Repos } from './create-repo';

export interface ParametrosRetiro {
  centavosArs: number; // positivo
  destino: 'disponible' | 'inversiones';
  fecha: string;
}

/**
 * Retira plata de ahorro. Si el destino es 'inversiones', además suma el
 * monto al cash del broker (mismo patrón que venderInversion). Si el
 * destino es 'disponible', no hace falta ninguna otra escritura:
 * calcularResumenMes ya suma los retiros con destino 'disponible' al
 * disponible del mes. Recibe el estado actual ya cargado por el llamador.
 */
export async function retirarDeAhorro(
  repos: Repos,
  params: ParametrosRetiro,
  movimientosActuales: SavingMovement[],
  brokerCashActual: BrokerCash
): Promise<SavingMovement> {
  const saldoAhorro = totalAhorrado(movimientosActuales);
  if (params.centavosArs > saldoAhorro) {
    throw new Error(`No podés retirar más de ${formatCentavos(saldoAhorro)} (tu saldo de ahorro)`);
  }

  const movimiento = await repos.savings.agregar({
    centavosArs: -params.centavosArs,
    fecha: params.fecha,
    nota: null,
    origen: null,
    destino: params.destino,
    gastoId: null,
  });

  if (params.destino === 'inversiones') {
    await repos.brokerCash.guardar(brokerCashActual.centavosArs + params.centavosArs);
  }

  return movimiento;
}
