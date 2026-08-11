import {
  costoUnitarioCentavosArs,
  costoTotalPosicion,
  costoTotalAbierto,
  patrimonioInversiones,
  calcularVenta,
} from '../investments';
import type { Investment } from '../types';

function inversion(parcial: Partial<Investment> = {}): Investment {
  return {
    id: 'i1',
    ticker: 'BMA',
    nominales: 10,
    ppc: 9.42,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    costoCentavosArsUnitario: 942,
    rubro: null,
    fecha: '2026-08-11',
    status: 'OPEN',
    ...parcial,
  };
}

describe('costoUnitarioCentavosArs', () => {
  it('en ARS, redondea el precio a centavos directamente', () => {
    expect(costoUnitarioCentavosArs(9.42, 'ARS', null)).toBe(942);
  });

  it('en USD, convierte con la cotización usada', () => {
    expect(costoUnitarioCentavosArs(11.9, 'USD', 1500)).toBe(1785000);
  });

  it('en USD sin cotización, trata la cotización como 0', () => {
    expect(costoUnitarioCentavosArs(11.9, 'USD', null)).toBe(0);
  });
});

describe('costoTotalPosicion', () => {
  it('multiplica nominales por el costo unitario', () => {
    const i = inversion({ nominales: 10, costoCentavosArsUnitario: 942 });
    expect(costoTotalPosicion(i)).toBe(9420);
  });
});

describe('costoTotalAbierto', () => {
  it('suma solo las posiciones OPEN', () => {
    const inversiones = [
      inversion({ id: 'a', nominales: 10, costoCentavosArsUnitario: 100, status: 'OPEN' }),
      inversion({ id: 'b', nominales: 5, costoCentavosArsUnitario: 200, status: 'OPEN' }),
      inversion({ id: 'c', nominales: 0, costoCentavosArsUnitario: 300, status: 'CLOSED' }),
    ];
    expect(costoTotalAbierto(inversiones)).toBe(10 * 100 + 5 * 200);
  });

  it('devuelve 0 sin inversiones', () => {
    expect(costoTotalAbierto([])).toBe(0);
  });
});

describe('patrimonioInversiones', () => {
  it('suma el costo abierto y el cash del broker', () => {
    const inversiones = [inversion({ nominales: 10, costoCentavosArsUnitario: 100, status: 'OPEN' })];
    expect(patrimonioInversiones(inversiones, 5000)).toBe(1000 + 5000);
  });
});

describe('calcularVenta', () => {
  it('calcula ingreso y ganancia cuando se vende por encima del costo', () => {
    const i = inversion({ nominales: 10, costoCentavosArsUnitario: 1000, monedaOriginal: 'ARS' });
    const resultado = calcularVenta(i, 4, 15, null);
    expect(resultado.ingresoCentavosArs).toBe(6000);
    expect(resultado.gananciaCentavosArs).toBe(2000);
  });

  it('calcula pérdida cuando se vende por debajo del costo', () => {
    const i = inversion({ nominales: 10, costoCentavosArsUnitario: 1000, monedaOriginal: 'ARS' });
    const resultado = calcularVenta(i, 4, 8, null);
    expect(resultado.ingresoCentavosArs).toBe(3200);
    expect(resultado.gananciaCentavosArs).toBe(-800);
  });

  it('convierte el precio de venta con la cotización si la moneda es USD', () => {
    const i = inversion({ nominales: 10, costoCentavosArsUnitario: 1700000, monedaOriginal: 'USD', cotizacionUsada: 1400 });
    const resultado = calcularVenta(i, 2, 12, 1500);
    expect(resultado.ingresoCentavosArs).toBe(3600000);
    expect(resultado.gananciaCentavosArs).toBe(200000);
  });

  it('lanza un error si nominalesVendidos es 0 o negativo', () => {
    const i = inversion({ nominales: 10 });
    expect(() => calcularVenta(i, 0, 10, null)).toThrow();
    expect(() => calcularVenta(i, -1, 10, null)).toThrow();
  });

  it('lanza un error si se intenta vender más de lo que hay', () => {
    const i = inversion({ nominales: 10 });
    expect(() => calcularVenta(i, 11, 10, null)).toThrow();
  });
});
