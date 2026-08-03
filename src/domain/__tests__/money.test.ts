import {
  parseAmountToCentavos,
  formatCentavos,
  usdToCentavosArs,
  centavosArsToUsd,
  formatUsd,
} from '../money';

describe('parseAmountToCentavos', () => {
  it('convierte un entero a centavos', () => {
    expect(parseAmountToCentavos('1500')).toBe(150000);
  });

  it('acepta coma como separador decimal', () => {
    expect(parseAmountToCentavos('1500,50')).toBe(150050);
  });

  it('acepta punto como separador decimal', () => {
    expect(parseAmountToCentavos('1500.50')).toBe(150050);
  });

  it('ignora separadores de miles', () => {
    expect(parseAmountToCentavos('1.500,50')).toBe(150050);
  });

  it('redondea a dos decimales', () => {
    expect(parseAmountToCentavos('10,999')).toBe(1100);
  });

  it('devuelve null si el texto no es un número', () => {
    expect(parseAmountToCentavos('abc')).toBeNull();
  });

  it('devuelve null con texto vacío', () => {
    expect(parseAmountToCentavos('')).toBeNull();
  });

  it('devuelve null con montos negativos', () => {
    expect(parseAmountToCentavos('-100')).toBeNull();
  });
});

describe('formatCentavos', () => {
  it('formatea con separador de miles y dos decimales', () => {
    expect(formatCentavos(150050)).toBe('$ 1.500,50');
  });

  it('formatea el cero', () => {
    expect(formatCentavos(0)).toBe('$ 0,00');
  });

  it('formatea montos negativos', () => {
    expect(formatCentavos(-150050)).toBe('-$ 1.500,50');
  });
});

describe('conversión USD', () => {
  it('convierte dólares a centavos de peso', () => {
    // 10 USD a una cotización de 1500 = 15000 ARS = 1500000 centavos
    expect(usdToCentavosArs(10, 1500)).toBe(1500000);
  });

  it('redondea al centavo más cercano al convertir a pesos', () => {
    expect(usdToCentavosArs(0.015, 1000)).toBe(1500);
  });

  it('convierte centavos de peso a dólares', () => {
    expect(centavosArsToUsd(1500000, 1500)).toBe(10);
  });

  it('devuelve 0 dólares si la cotización es 0, para evitar división por cero', () => {
    expect(centavosArsToUsd(1500000, 0)).toBe(0);
  });
});

describe('formatUsd', () => {
  it('formatea con dos decimales', () => {
    expect(formatUsd(10)).toBe('US$ 10,00');
  });
});
