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

function crearBrokerCash(centavosArs: number): BrokerCash {
  return { id: 'actual', centavosArs };
}

/**
 * Fake de Repos sin `investments.listar` en absoluto: si venderInversion
 * intentara leer el estado previo desde el repo (el bug que se está
 * arreglando), esto rompería con un TypeError en tiempo de ejecución en vez
 * de simplemente no encontrar el método.
 */
function crearReposFakeSinListar() {
  const ventasCreadas: Omit<InvestmentSale, 'id'>[] = [];
  let brokerCashActual = 0;
  let inversionGuardada: Investment | null = null;

  const repos = {
    investments: {
      guardar: jest.fn(async (inversion: Investment) => {
        inversionGuardada = inversion;
        return inversion;
      }),
    },
    investmentSales: {
      agregar: jest.fn(async (venta: Omit<InvestmentSale, 'id'>) => {
        ventasCreadas.push(venta);
        return { ...venta, id: 'venta1' };
      }),
    },
    brokerCash: {
      guardar: jest.fn(async (centavos: number) => {
        brokerCashActual = centavos;
        return { id: 'actual', centavosArs: brokerCashActual } as BrokerCash;
      }),
    },
  };

  return {
    repos: repos as unknown as Repos,
    ventasCreadas,
    obtenerBrokerCash: () => brokerCashActual,
    obtenerInversionGuardada: () => inversionGuardada,
  };
}

describe('venderInversion', () => {
  it('venta parcial: reduce nominales, mantiene OPEN, suma el ingreso al cash', async () => {
    const inversion = crearInversion({ nominales: 10, costoCentavosArsUnitario: 1000 });
    const brokerCash = crearBrokerCash(0);
    const { repos, ventasCreadas, obtenerBrokerCash } = crearReposFakeSinListar();

    const resultado = await venderInversion(repos, inversion, brokerCash, {
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
    const brokerCash = crearBrokerCash(0);
    const { repos } = crearReposFakeSinListar();

    const resultado = await venderInversion(repos, inversion, brokerCash, {
      nominalesVendidos: 5,
      precioVenta: 12,
      cotizacionUsada: null,
      fecha: '2026-06-01',
    });

    expect(resultado.inversion.nominales).toBe(0);
    expect(resultado.inversion.status).toBe('CLOSED');
  });

  it('suma el ingreso de la venta al cash existente del broker, sin depender de investments.listar()', async () => {
    // Prueba directa del bug: el fake no implementa listar() en absoluto.
    // Si venderInversion intentara leer el estado previo vía el repo, esto
    // fallaría con un TypeError en vez de simplemente ignorar el método.
    const inversion = crearInversion({ nominales: 10, costoCentavosArsUnitario: 1000 });
    const brokerCash = crearBrokerCash(50000);
    const { repos, obtenerBrokerCash, obtenerInversionGuardada } = crearReposFakeSinListar();
    expect((repos.investments as any).listar).toBeUndefined();

    const resultado = await venderInversion(repos, inversion, brokerCash, {
      nominalesVendidos: 4,
      precioVenta: 15,
      cotizacionUsada: null,
      fecha: '2026-06-01',
    });

    expect(obtenerBrokerCash()).toBe(56000); // 50000 (cash previo pasado por el llamador) + 6000
    expect(obtenerInversionGuardada()).toEqual(resultado.inversion);
  });

  it('venta en USD: convierte con la cotización usada y arrastra la moneda original', async () => {
    const inversion = crearInversion({
      nominales: 10,
      monedaOriginal: 'USD',
      costoCentavosArsUnitario: 170000, // costo unitario ya en centavos ARS
    });
    const brokerCash = crearBrokerCash(0);
    const { repos, obtenerBrokerCash } = crearReposFakeSinListar();

    const resultado = await venderInversion(repos, inversion, brokerCash, {
      nominalesVendidos: 2,
      precioVenta: 12, // USD
      cotizacionUsada: 1500,
      fecha: '2026-06-01',
    });

    // precioVenta 12 USD * 1500 cotización * 100 = 1.800.000 centavos ARS por nominal
    expect(resultado.venta.ingresoCentavosArs).toBe(2 * 1800000);
    expect(resultado.venta.cotizacionUsada).toBe(1500);
    expect(resultado.inversion.nominales).toBe(8);
    expect(obtenerBrokerCash()).toBe(2 * 1800000);
  });

  it('rechaza vender más nominales de los que hay, sin mutar nada', async () => {
    const inversion = crearInversion({ nominales: 10, costoCentavosArsUnitario: 1000 });
    const brokerCash = crearBrokerCash(5000);
    const { repos, ventasCreadas, obtenerBrokerCash } = crearReposFakeSinListar();

    await expect(
      venderInversion(repos, inversion, brokerCash, {
        nominalesVendidos: 11,
        precioVenta: 15,
        cotizacionUsada: null,
        fecha: '2026-06-01',
      })
    ).rejects.toThrow();

    expect((repos.investments.guardar as jest.Mock)).not.toHaveBeenCalled();
    expect((repos.investmentSales.agregar as jest.Mock)).not.toHaveBeenCalled();
    expect((repos.brokerCash.guardar as jest.Mock)).not.toHaveBeenCalled();
    expect(ventasCreadas).toHaveLength(0);
    expect(obtenerBrokerCash()).toBe(0);
  });
});
