export type Currency = 'ARS' | 'USD';
export type RateKind = 'oficial' | 'blue';
export type PaymentMethod = 'efectivo' | 'debito' | 'credito' | 'transferencia';

/** Clave de mes en formato 'YYYY-MM'. */
export type MonthKey = string;

export interface Sector {
  id: string;
  nombre: string;
  color: string;
  /** Límite mensual en centavos de ARS. null = sector sin tope. */
  limiteMensual: number | null;
}

export interface Expense {
  id: string;
  /** Monto normalizado a centavos de ARS. Es la única fuente de verdad para cálculos. */
  centavosArs: number;
  /** Monto tal como lo tipeó la persona, en su moneda original. */
  montoOriginal: number;
  monedaOriginal: Currency;
  /** Cotización usada al convertir, si monedaOriginal es USD. null si fue ARS. */
  cotizacionUsada: number | null;
  /** Fecha del gasto en formato ISO 'YYYY-MM-DD'. */
  fecha: string;
  sectorId: string | null;
  lugar: string | null;
  descripcion: string | null;
  metodoPago: PaymentMethod | null;
}

export interface Budget {
  /** 'YYYY-MM' */
  mes: MonthKey;
  /** Presupuesto del mes en centavos de ARS. */
  totalCentavos: number;
}

export interface SavingMovement {
  id: string;
  /** Positivo = se manda a ahorro. Negativo = se retira del ahorro. */
  centavosArs: number;
  /** Fecha ISO 'YYYY-MM-DD'. */
  fecha: string;
  nota: string | null;
}

export type TamanoObjetivo = 'chico' | 'mediano' | 'grande';

/** Objetivo de ahorro con nombre propio (tipo "cajitas"), independiente del ahorro general. */
export interface Objetivo {
  id: string;
  nombre: string;
  montoMetaCentavos: number;
  montoActualCentavos: number;
  /** Fecha ISO 'YYYY-MM-DD'. null = sin fecha objetivo. */
  fechaObjetivo: string | null;
  tamano: TamanoObjetivo;
}
