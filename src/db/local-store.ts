export interface PendingWrite {
  id: string;
  coleccion: 'expenses' | 'sectors' | 'budgets' | 'savings' | 'investments' | 'investment-sales' | 'broker-cash';
  operacion: 'set' | 'delete';
  /** Datos del documento. null si operacion es 'delete'. */
  datos: Record<string, unknown> | null;
  creadoEn: number;
}

/**
 * Persistencia local de un dispositivo: la cola de escrituras pendientes de
 * subir, y un snapshot de la última copia conocida de cada colección (para
 * poder mostrar datos aunque no haya red ni se haya sincronizado nunca).
 */
export interface LocalStore {
  guardarPendiente(escritura: PendingWrite): Promise<void>;
  listarPendientes(): Promise<PendingWrite[]>;
  borrarPendiente(id: string): Promise<void>;
  guardarSnapshot(coleccion: string, datos: unknown[]): Promise<void>;
  leerSnapshot(coleccion: string): Promise<unknown[]>;
}
