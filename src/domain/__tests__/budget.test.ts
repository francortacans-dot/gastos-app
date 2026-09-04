import {
  gastadoEnMes,
  gastadoPorSector,
  ahorradoHasta,
  calcularResumenMes,
  mesAnterior,
  siguienteMes,
} from '../budget';
import type { Expense, Budget, SavingMovement } from '../types';

function gasto(parcial: Partial<Expense>): Expense {
  return {
    id: 'e1',
    centavosArs: 0,
    montoOriginal: 0,
    monedaOriginal: 'ARS',
    cotizacionUsada: null,
    fecha: '2026-06-01',
    sectorId: null,
    lugar: null,
    descripcion: null,
    metodoPago: null,
    ...parcial,
  };
}

function movimiento(parcial: Partial<SavingMovement>): SavingMovement {
  return {
    id: 'm1',
    centavosArs: 0,
    fecha: '2026-06-01',
    nota: null,
    origen: 'ingresos',
    ...parcial,
  };
}

describe('mesAnterior / siguienteMes', () => {
  it('retrocede un mes dentro del mismo año', () => {
    expect(mesAnterior('2026-06')).toBe('2026-05');
  });

  it('retrocede de enero a diciembre del año anterior', () => {
    expect(mesAnterior('2026-01')).toBe('2025-12');
  });

  it('avanza un mes dentro del mismo año', () => {
    expect(siguienteMes('2026-06')).toBe('2026-07');
  });

  it('avanza de diciembre a enero del año siguiente', () => {
    expect(siguienteMes('2026-12')).toBe('2027-01');
  });
});

describe('gastadoEnMes', () => {
  it('suma solo los gastos del mes pedido', () => {
    const gastos = [
      gasto({ id: 'a', centavosArs: 1000, fecha: '2026-06-05' }),
      gasto({ id: 'b', centavosArs: 2000, fecha: '2026-06-20' }),
      gasto({ id: 'c', centavosArs: 5000, fecha: '2026-07-01' }),
    ];
    expect(gastadoEnMes(gastos, '2026-06')).toBe(3000);
  });

  it('devuelve 0 si no hay gastos en el mes', () => {
    expect(gastadoEnMes([], '2026-06')).toBe(0);
  });
});

describe('gastadoPorSector', () => {
  it('agrupa los montos por sector, ignorando otros meses', () => {
    const gastos = [
      gasto({ id: 'a', centavosArs: 1000, sectorId: 'ocio', fecha: '2026-06-05' }),
      gasto({ id: 'b', centavosArs: 500, sectorId: 'ocio', fecha: '2026-06-06' }),
      gasto({ id: 'c', centavosArs: 2000, sectorId: 'vacaciones', fecha: '2026-06-07' }),
      gasto({ id: 'd', centavosArs: 9999, sectorId: 'ocio', fecha: '2026-05-01' }),
    ];
    const resultado = gastadoPorSector(gastos, '2026-06');
    expect(resultado.get('ocio')).toBe(1500);
    expect(resultado.get('vacaciones')).toBe(2000);
    expect(resultado.has('sin-datos')).toBe(false);
  });

  it('agrupa los gastos sin sector bajo la clave null', () => {
    const gastos = [gasto({ centavosArs: 700, sectorId: null, fecha: '2026-06-01' })];
    const resultado = gastadoPorSector(gastos, '2026-06');
    expect(resultado.get('sin-sector')).toBe(700);
  });
});

describe('ahorradoHasta', () => {
  it('suma los movimientos de ahorro hasta el mes inclusive', () => {
    const movimientos: SavingMovement[] = [
      movimiento({ id: 'm1', centavosArs: 5000, fecha: '2026-04-15' }),
      movimiento({ id: 'm2', centavosArs: 3000, fecha: '2026-06-01' }),
      movimiento({ id: 'm3', centavosArs: 1000, fecha: '2026-07-01' }),
    ];
    expect(ahorradoHasta(movimientos, '2026-06')).toBe(8000);
  });

  it('resta los retiros de ahorro (montos negativos)', () => {
    const movimientos: SavingMovement[] = [
      movimiento({ id: 'm1', centavosArs: 5000, fecha: '2026-04-15' }),
      movimiento({ id: 'm2', centavosArs: -2000, fecha: '2026-05-01' }),
    ];
    expect(ahorradoHasta(movimientos, '2026-06')).toBe(3000);
  });
});

describe('ahorradoHasta con filtro de origen', () => {
  it('filtra solo los movimientos "ingresos" cuando se pide ese origen', () => {
    const movimientos: SavingMovement[] = [
      movimiento({ id: 'm1', centavosArs: 5000, fecha: '2026-06-01', origen: 'ingresos' }),
      movimiento({ id: 'm2', centavosArs: 2000, fecha: '2026-06-02', origen: 'externo' }),
    ];
    expect(ahorradoHasta(movimientos, '2026-06', 'ingresos')).toBe(5000);
  });

  it('filtra solo los movimientos "externo" cuando se pide ese origen', () => {
    const movimientos: SavingMovement[] = [
      movimiento({ id: 'm1', centavosArs: 5000, fecha: '2026-06-01', origen: 'ingresos' }),
      movimiento({ id: 'm2', centavosArs: 2000, fecha: '2026-06-02', origen: 'externo' }),
    ];
    expect(ahorradoHasta(movimientos, '2026-06', 'externo')).toBe(2000);
  });

  it('sin filtro de origen, suma todos los movimientos sin importar el origen', () => {
    const movimientos: SavingMovement[] = [
      movimiento({ id: 'm1', centavosArs: 5000, fecha: '2026-06-01', origen: 'ingresos' }),
      movimiento({ id: 'm2', centavosArs: 2000, fecha: '2026-06-02', origen: 'externo' }),
    ];
    expect(ahorradoHasta(movimientos, '2026-06')).toBe(7000);
  });

  it('trata los movimientos históricos sin campo origen guardado como "ingresos"', () => {
    // simula un doc viejo de Firestore, guardado antes de que existiera el campo `origen`
    const movimientos = [
      { id: 'm1', centavosArs: 4000, fecha: '2026-06-01', nota: null },
    ] as SavingMovement[];
    expect(ahorradoHasta(movimientos, '2026-06', 'ingresos')).toBe(4000);
    expect(ahorradoHasta(movimientos, '2026-06', 'externo')).toBe(0);
  });
});

describe('calcularResumenMes', () => {
  it('el disponible es presupuesto del mes menos gastado, sin acumulado previo', () => {
    const presupuestos: Budget[] = [{ mes: '2026-06', totalCentavos: 100000 }];
    const gastos: Expense[] = [gasto({ centavosArs: 30000, fecha: '2026-06-10' })];

    const resumen = calcularResumenMes({
      mes: '2026-06',
      presupuestos,
      gastos,
      ahorros: [],
    });

    expect(resumen.presupuestoDelMes).toBe(100000);
    expect(resumen.acumuladoPrevio).toBe(0);
    expect(resumen.gastado).toBe(30000);
    expect(resumen.disponible).toBe(70000);
  });

  it('arrastra el sobrante de meses anteriores no mandado a ahorro', () => {
    const presupuestos: Budget[] = [
      { mes: '2026-05', totalCentavos: 50000 },
      { mes: '2026-06', totalCentavos: 100000 },
    ];
    // en mayo se gastaron 20000 de 50000: sobran 30000 que arrastran a junio
    const gastos: Expense[] = [
      gasto({ id: 'may', centavosArs: 20000, fecha: '2026-05-10' }),
      gasto({ id: 'jun', centavosArs: 10000, fecha: '2026-06-05' }),
    ];

    const resumen = calcularResumenMes({
      mes: '2026-06',
      presupuestos,
      gastos,
      ahorros: [],
    });

    expect(resumen.acumuladoPrevio).toBe(30000);
    expect(resumen.disponible).toBe(100000 + 30000 - 10000);
  });

  it('no arrastra lo que ya se mandó a ahorro', () => {
    const presupuestos: Budget[] = [
      { mes: '2026-05', totalCentavos: 50000 },
      { mes: '2026-06', totalCentavos: 100000 },
    ];
    const gastos: Expense[] = [gasto({ id: 'may', centavosArs: 20000, fecha: '2026-05-10' })];
    // el sobrante de mayo (30000) se manda entero a ahorro
    const ahorros: SavingMovement[] = [movimiento({ id: 's1', centavosArs: 30000, fecha: '2026-05-28', origen: 'ingresos' })];

    const resumen = calcularResumenMes({
      mes: '2026-06',
      presupuestos,
      gastos,
      ahorros,
    });

    expect(resumen.acumuladoPrevio).toBe(0);
    expect(resumen.disponible).toBe(100000);
  });

  it('un aporte externo mandado a ahorro no reduce el acumuladoPrevio del mes siguiente', () => {
    const presupuestos: Budget[] = [
      { mes: '2026-05', totalCentavos: 50000 },
      { mes: '2026-06', totalCentavos: 100000 },
    ];
    // en mayo se gastaron 20000 de 50000: sobran 30000 que deberían arrastrar a junio
    const gastos: Expense[] = [gasto({ id: 'may', centavosArs: 20000, fecha: '2026-05-10' })];
    // aporte externo (ej. regalo) mandado en mayo: nunca salió del presupuesto, no debe descontar el arrastre
    const ahorros: SavingMovement[] = [
      movimiento({ id: 's1', centavosArs: 15000, fecha: '2026-05-28', origen: 'externo' }),
    ];

    const resumen = calcularResumenMes({
      mes: '2026-06',
      presupuestos,
      gastos,
      ahorros,
    });

    expect(resumen.acumuladoPrevio).toBe(30000);
    expect(resumen.disponible).toBe(100000 + 30000);
  });

  it('un mes sin presupuesto definido cuenta como presupuesto 0', () => {
    const resumen = calcularResumenMes({
      mes: '2026-06',
      presupuestos: [],
      gastos: [],
      ahorros: [],
    });

    expect(resumen.presupuestoDelMes).toBe(0);
    expect(resumen.disponible).toBe(0);
  });

  // Decisión de producto deliberada (no un efecto colateral accidental):
  // si un mes se pasa del presupuesto, el déficit se "perdona" y no se
  // arrastra como saldo negativo al mes siguiente (Math.max(0, ...) en
  // calcularResumenMes). El mes que se pasó SÍ puede mostrar su propio
  // `disponible` negativo; lo que no ocurre es que ese negativo reste del
  // presupuesto del mes siguiente.
  it('si un mes se pasó del presupuesto, el déficit no se arrastra al mes siguiente (se perdona)', () => {
    const presupuestos: Budget[] = [
      { mes: '2026-05', totalCentavos: 50000 },
      { mes: '2026-06', totalCentavos: 100000 },
    ];
    // en mayo se gastaron 80000 de un presupuesto de 50000: disponible de mayo = -30000
    const gastos: Expense[] = [
      gasto({ id: 'may', centavosArs: 80000, fecha: '2026-05-10' }),
      gasto({ id: 'jun', centavosArs: 10000, fecha: '2026-06-05' }),
    ];

    const resumenJunio = calcularResumenMes({
      mes: '2026-06',
      presupuestos,
      gastos,
      ahorros: [],
    });

    // el acumuladoPrevio se pisa en 0 en vez de ser -30000
    expect(resumenJunio.acumuladoPrevio).toBe(0);
    expect(resumenJunio.disponible).toBe(100000 + 0 - 10000);
  });

  it('un mes que se pasó del presupuesto puede tener disponible negativo en su propio resumen', () => {
    const presupuestos: Budget[] = [{ mes: '2026-05', totalCentavos: 50000 }];
    const gastos: Expense[] = [gasto({ id: 'may', centavosArs: 80000, fecha: '2026-05-10' })];

    const resumenMayo = calcularResumenMes({
      mes: '2026-05',
      presupuestos,
      gastos,
      ahorros: [],
    });

    // el propio mes SÍ refleja el rojo: acá no hay Math.max de por medio
    expect(resumenMayo.disponible).toBe(-30000);
  });
});
