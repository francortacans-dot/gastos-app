import { calcularVenta } from '../domain/investments';
import type { Investment, InvestmentSale } from '../domain/types';
import type { Repos } from './create-repo';

export interface ParametrosVenta {
  nominalesVendidos: number;
  precioVenta: number;
  cotizacionUsada: number | null;
  fecha: string;
}

export interface ResultadoVentaInversion {
  inversion: Investment;
  venta: InvestmentSale;
}

/**
 * Orquesta una venta parcial o total: recalcula la posición, registra el
 * movimiento de venta, y suma el ingreso al cash del broker. Es el único
 * punto de entrada para vender — no llamar a los repos por separado.
 */
export async function venderInversion(
  repos: Repos,
  investmentId: string,
  params: ParametrosVenta
): Promise<ResultadoVentaInversion> {
  const inversiones = await repos.investments.listar();
  const inversion = inversiones.find((i) => i.id === investmentId);
  if (!inversion) {
    throw new Error(`No existe una inversión con id ${investmentId}`);
  }

  const { ingresoCentavosArs, gananciaCentavosArs } = calcularVenta(
    inversion,
    params.nominalesVendidos,
    params.precioVenta,
    params.cotizacionUsada
  );

  const nominalesRestantes = inversion.nominales - params.nominalesVendidos;
  const inversionActualizada = await repos.investments.actualizar(investmentId, {
    nominales: nominalesRestantes,
    status: nominalesRestantes === 0 ? 'CLOSED' : 'OPEN',
  });

  const venta = await repos.investmentSales.agregar({
    investmentId,
    nominalesVendidos: params.nominalesVendidos,
    precioVenta: params.precioVenta,
    cotizacionUsada: params.cotizacionUsada,
    ingresoCentavosArs,
    gananciaCentavosArs,
    fecha: params.fecha,
  });

  await repos.brokerCash.sumar(ingresoCentavosArs);

  return { inversion: inversionActualizada, venta };
}
