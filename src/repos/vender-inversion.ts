import { calcularVenta } from '../domain/investments';
import type { Investment, InvestmentSale, BrokerCash } from '../domain/types';
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
 * Recibe la inversión y el cash actuales ya cargados por el llamador (no
 * los vuelve a leer del repo) para funcionar igual en web y en celular.
 */
export async function venderInversion(
  repos: Repos,
  inversion: Investment,
  brokerCashActual: BrokerCash,
  params: ParametrosVenta
): Promise<ResultadoVentaInversion> {
  const { ingresoCentavosArs, gananciaCentavosArs } = calcularVenta(
    inversion,
    params.nominalesVendidos,
    params.precioVenta,
    params.cotizacionUsada
  );

  const nominalesRestantes = inversion.nominales - params.nominalesVendidos;
  const inversionActualizada = await repos.investments.guardar({
    ...inversion,
    nominales: nominalesRestantes,
    status: nominalesRestantes === 0 ? 'CLOSED' : 'OPEN',
  });

  const venta = await repos.investmentSales.agregar({
    investmentId: inversion.id,
    nominalesVendidos: params.nominalesVendidos,
    precioVenta: params.precioVenta,
    cotizacionUsada: params.cotizacionUsada,
    ingresoCentavosArs,
    gananciaCentavosArs,
    fecha: params.fecha,
  });

  await repos.brokerCash.guardar(brokerCashActual.centavosArs + ingresoCentavosArs);

  return { inversion: inversionActualizada, venta };
}
