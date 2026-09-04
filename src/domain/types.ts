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
  /**
   * De dónde sale la plata de este gasto:
   * - 'disponible': sale del presupuesto del mes (comportamiento histórico). Cuenta
   *   para `gastadoEnMes` (y por lo tanto para el `disponible` del mes).
   * - 'ahorro': se paga con plata ya ahorrada. NO cuenta para `gastadoEnMes`. Al
   *   guardarlo se crea automáticamente un retiro de ahorro vinculado (ver
   *   `pagarGasto` en `src/repos/pagar-gasto.ts`).
   * En ambos casos el gasto sigue sumando al total de su Sector y a su límite
   * mensual si tiene. Gastos históricos sin este campo cuentan como 'disponible'.
   */
  fuente: 'disponible' | 'ahorro';
}

export interface Budget {
  /** 'YYYY-MM' */
  mes: MonthKey;
  /** Presupuesto del mes en centavos de ARS. */
  totalCentavos: number;
}

export interface SavingMovement {
  id: string;
  /** Positivo = aporte a ahorro. Negativo = retiro de ahorro. */
  centavosArs: number;
  /** Fecha ISO 'YYYY-MM-DD'. */
  fecha: string;
  nota: string | null;
  /**
   * Solo aplica a aportes (centavosArs > 0): de dónde sale esa plata.
   * - 'ingresos': salió del presupuesto mensual. Tiene tope igual al disponible del
   *   mes y descuenta ese monto del acumulado que se arrastra al mes siguiente.
   * - 'externo': aporte que nunca pasó por el presupuesto (regalo, aguinaldo, etc.).
   *   No tiene tope y no descuenta nada del acumulado arrastrado.
   * null en retiros (centavosArs < 0). Aportes históricos sin el campo cuentan
   * como 'ingresos'.
   */
  origen: 'ingresos' | 'externo' | null;
  /**
   * Solo aplica a retiros (centavosArs < 0): a dónde fue esa plata.
   * - 'disponible': vuelve a estar disponible para gastar este mes.
   * - 'inversiones': se suma al cash del broker.
   * - 'gasto': se usó para pagar un gasto con fuente 'ahorro' (ver `gastoId`).
   * null en aportes.
   */
  destino: 'disponible' | 'inversiones' | 'gasto' | null;
  /** Si destino === 'gasto', el id del Expense pagado con este retiro. null en cualquier otro caso. */
  gastoId: string | null;
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
