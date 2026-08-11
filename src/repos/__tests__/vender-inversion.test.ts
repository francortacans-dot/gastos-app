import { venderInversion } from '../vender-inversion';
import type { Repos } from '../create-repo';
import type { Investment, InvestmentSale, BrokerCash } from '../../domain/types';

function crearInversion(parcial: Partial<Investment> = {}): Investment {
  return {
    id: 'inv1',
    ticker: 'GOOGL',
    nominales: 10,
    ppc: 5.16,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    costoCentavosArsUnitario: 1000,
    rubro: null,
    fecha: '2026-01-01',
    status: 'OPEN',
    ...parcial,
  };
}

function crearReposFake(inversionInicial: Investment) {
  let inversionActual = inversionInicial;
  const ventasCreadas: Omit<InvestmentSale, 'id'>[] = [];
  let brokerCashActual = 0;

  const repos = {
    investments: {
      listar: jest.fn(async () => [inversionActual]),
      actualizar: jest.fn(async (_id: string, cambios: Partial<Investment>) => {
        inversionActual = { ...inversionActual, ...cambios };
        return inversionActual;
      }),
    },
    investmentSales: {
      agregar: jest.fn(async (venta: Omit<InvestmentSale, 'id'>) => {
        ventasCreadas.push(venta);
        return { ...venta, id: 'venta1' };
      }),
    },
    brokerCash: {
      sumar: jest.fn(async (centavos: number) => {
        brokerCashActual += centavos;
        return { id: 'actual', centavosArs: brokerCashActual } as BrokerCash;
      }),
    },
  };

  return { repos: repos as unknown as Repos, ventasCreadas, obtenerBrokerCash: () => brokerCashActual };
}

describe('venderInversion', () => {
  it('venta parcial: reduce nominales, mantiene OPEN, suma el ingreso al cash', async () => {
    const inversion = crearInversion({ nominales: 10, costoCentavosArsUnitario: 1000 });
    const { repos, ventasCreadas, obtenerBrokerCash } = crearReposFake(inversion);

    const resultado = await venderInversion(repos, 'inv1', {
      nominalesVendidos: 4,
      precioVenta: 15,
      cotizacionUsada: null,
      fecha: '2026-06-01',
    });

    expect(resultado.inversion.nominales).toBe(6);
    expect(resultado.inversion.status).toBe('OPEN');
    expect(resultado.venta.ingresoCentavosArs).toBe(6000);
    expect(resultado.venta.gananciaCentavosArs).toBe(2000);
    expect(obtenerBrokerCash()).toBe(6000);
    expect(ventasCreadas).toHaveLength(1);
  });

  it('venta total: cierra la posición (status CLOSED)', async () => {
    const inversion = crearInversion({ nominales: 5, costoCentavosArsUnitario: 1000 });
    const { repos } = crearReposFake(inversion);

    const resultado = await venderInversion(repos, 'inv1', {
      nominalesVendidos: 5,
      precioVenta: 12,
      cotizacionUsada: null,
      fecha: '2026-06-01',
    });

    expect(resultado.inversion.nominales).toBe(0);
    expect(resultado.inversion.status).toBe('CLOSED');
  });

  it('lanza un error si la inversión no existe', async () => {
    const inversion = crearInversion();
    const { repos } = crearReposFake(inversion);

    await expect(
      venderInversion(repos, 'no-existe', {
        nominalesVendidos: 1,
        precioVenta: 10,
        cotizacionUsada: null,
        fecha: '2026-06-01',
      })
    ).rejects.toThrow();
  });
});
