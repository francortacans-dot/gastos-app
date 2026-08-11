export type Currency = 'ARS' | 'USD';
export type RateKind = 'oficial' | 'blue';
/**
 * Medio de pago del gasto. Texto libre (no un enum cerrado): hay sugerencias
 * comunes (efectivo, débito, Mercado Pago, Brubank, etc.) pero se puede
 * escribir cualquier otro nombre.
 */
export type PaymentMethod = string;

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

export interface Investment {
  id: string;
  ticker: string;
  /** Cantidad actual de nominales. Baja con ventas parciales. */
  nominales: number;
  /** Precio promedio de compra tal como se tipeó, en monedaOriginal. */
  ppc: number;
  monedaOriginal: Currency;
  /** Cotización usada al cargar, si monedaOriginal es USD. null si fue ARS. */
  cotizacionUsada: number | null;
  /** Costo por nominal en centavos de ARS. Única fuente de verdad para el costo total. */
  costoCentavosArsUnitario: number;
  /** Rubro/categoría de texto libre, ej. 'Tech'. Sin relación con los Sector de gastos. */
  rubro: string | null;
  /** Fecha de entrada, ISO 'YYYY-MM-DD'. */
  fecha: string;
  status: 'OPEN' | 'CLOSED';
}

export interface InvestmentSale {
  id: string;
  investmentId: string;
  nominalesVendidos: number;
  /** Precio de venta tal como se tipeó, en la monedaOriginal de la inversión vendida. */
  precioVenta: number;
  cotizacionUsada: number | null;
  /** nominalesVendidos * precioVenta convertido a ARS. Es lo que entra como cash al broker. */
  ingresoCentavosArs: number;
  /** ingresoCentavosArs menos el costo de esos nominales. Dato informativo. */
  gananciaCentavosArs: number;
  /** Fecha ISO 'YYYY-MM-DD'. */
  fecha: string;
}

export interface BrokerCash {
  id: 'actual';
  /** Saldo de efectivo sin invertir en el broker, en centavos de ARS. */
  centavosArs: number;
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
