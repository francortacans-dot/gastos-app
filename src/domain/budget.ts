import type { Budget, Expense, MonthKey, SavingMovement } from './types';

/** Clave usada en el Map de gastadoPorSector para gastos sin sector asignado. */
export const SIN_SECTOR = 'sin-sector';

export function mesAnterior(mes: MonthKey): MonthKey {
  const [anio, mesNum] = mes.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mesNum - 1 - 1, 1));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function siguienteMes(mes: MonthKey): MonthKey {
  const [anio, mesNum] = mes.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mesNum - 1 + 1, 1));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

function mesDeFecha(fechaIso: string): MonthKey {
  return fechaIso.slice(0, 7);
}

export function gastadoEnMes(gastos: Expense[], mes: MonthKey): number {
  return gastos
    .filter((g) => mesDeFecha(g.fecha) === mes)
    .reduce((acc, g) => acc + g.centavosArs, 0);
}

export function gastadoPorSector(gastos: Expense[], mes: MonthKey): Map<string, number> {
  const resultado = new Map<string, number>();
  for (const g of gastos) {
    if (mesDeFecha(g.fecha) !== mes) continue;
    const clave = g.sectorId ?? SIN_SECTOR;
    resultado.set(clave, (resultado.get(clave) ?? 0) + g.centavosArs);
  }
  return resultado;
}

/** Movimientos históricos guardados antes de existir el campo `origen` cuentan como 'ingresos'. */
function origenEfectivo(m: SavingMovement): 'ingresos' | 'externo' {
  return m.origen ?? 'ingresos';
}

export function ahorradoHasta(
  movimientos: SavingMovement[],
  mes: MonthKey,
  origen?: 'ingresos' | 'externo'
): number {
  return movimientos
    .filter((m) => mesDeFecha(m.fecha) <= mes)
    .filter((m) => origen === undefined || origenEfectivo(m) === origen)
    .reduce((acc, m) => acc + m.centavosArs, 0);
}

export interface ResumenMes {
  presupuestoDelMes: number;
  acumuladoPrevio: number;
  gastado: number;
  disponible: number;
}

interface ParametrosResumenMes {
  mes: MonthKey;
  presupuestos: Budget[];
  gastos: Expense[];
  ahorros: SavingMovement[];
}

/**
 * Calcula, de forma dinámica y sin persistir estado de "cierre de mes":
 *   acumuladoPrevio(mes) = disponible(mesAnterior) - ahorradoEnEseMes
 *   disponible(mes) = presupuestoDelMes + acumuladoPrevio - gastado
 *
 * Recorre hacia atrás desde `mes` hasta el primer mes que tiene presupuesto
 * cargado, para no arrastrar sobrantes de un pasado sin datos.
 */
export function calcularResumenMes(params: ParametrosResumenMes): ResumenMes {
  const { mes, presupuestos, gastos, ahorros } = params;

  const presupuestoDelMes =
    presupuestos.find((p) => p.mes === mes)?.totalCentavos ?? 0;
  const gastado = gastadoEnMes(gastos, mes);

  const mesPrevio = mesAnterior(mes);
  const huboPresupuestoPrevio = presupuestos.some((p) => p.mes === mesPrevio);

  let acumuladoPrevio = 0;
  if (huboPresupuestoPrevio) {
    const resumenPrevio = calcularResumenMes({
      mes: mesPrevio,
      presupuestos,
      gastos,
      ahorros,
    });
    const ahorradoHastaPrevio = ahorradoHasta(ahorros, mesPrevio, 'ingresos');
    const ahorradoHastaAntesDePrevio = ahorradoHasta(ahorros, mesAnterior(mesPrevio), 'ingresos');
    const mandadoAAhorroEnMesPrevio = ahorradoHastaPrevio - ahorradoHastaAntesDePrevio;
    acumuladoPrevio = Math.max(
      0,
      resumenPrevio.disponible - mandadoAAhorroEnMesPrevio
    );
  }

  const disponible = presupuestoDelMes + acumuladoPrevio - gastado;

  return { presupuestoDelMes, acumuladoPrevio, gastado, disponible };
}
