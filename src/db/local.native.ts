import * as SQLite from 'expo-sqlite';
import type { LocalStore, PendingWrite } from './local-store';

const dbPromise = SQLite.openDatabaseAsync('gastos-local.db');

async function migrar(): Promise<void> {
  const db = await dbPromise;
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pendientes (
      id TEXT PRIMARY KEY,
      coleccion TEXT NOT NULL,
      operacion TEXT NOT NULL,
      datos TEXT,
      creadoEn INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS snapshots (
      coleccion TEXT PRIMARY KEY,
      datos TEXT NOT NULL
    );
  `);
}

let migracionLista: Promise<void> | null = null;
function asegurarMigracion(): Promise<void> {
  if (!migracionLista) migracionLista = migrar();
  return migracionLista;
}

/** Implementación de LocalStore respaldada por SQLite, para celular. */
export const localStoreSqlite: LocalStore = {
  async guardarPendiente(w: PendingWrite): Promise<void> {
    await asegurarMigracion();
    const db = await dbPromise;
    await db.runAsync(
      'INSERT OR REPLACE INTO pendientes (id, coleccion, operacion, datos, creadoEn) VALUES (?, ?, ?, ?, ?)',
      w.id,
      w.coleccion,
      w.operacion,
      w.datos ? JSON.stringify(w.datos) : null,
      w.creadoEn
    );
  },

  async listarPendientes(): Promise<PendingWrite[]> {
    await asegurarMigracion();
    const db = await dbPromise;
    const filas = await db.getAllAsync<{
      id: string;
      coleccion: PendingWrite['coleccion'];
      operacion: PendingWrite['operacion'];
      datos: string | null;
      creadoEn: number;
    }>('SELECT * FROM pendientes ORDER BY creadoEn ASC');

    return filas.map((f) => ({
      id: f.id,
      coleccion: f.coleccion,
      operacion: f.operacion,
      datos: f.datos ? JSON.parse(f.datos) : null,
      creadoEn: f.creadoEn,
    }));
  },

  async borrarPendiente(id: string): Promise<void> {
    await asegurarMigracion();
    const db = await dbPromise;
    await db.runAsync('DELETE FROM pendientes WHERE id = ?', id);
  },

  async guardarSnapshot(coleccion: string, datos: unknown[]): Promise<void> {
    await asegurarMigracion();
    const db = await dbPromise;
    await db.runAsync(
      'INSERT OR REPLACE INTO snapshots (coleccion, datos) VALUES (?, ?)',
      coleccion,
      JSON.stringify(datos)
    );
  },

  async leerSnapshot(coleccion: string): Promise<unknown[]> {
    await asegurarMigracion();
    const db = await dbPromise;
    const fila = await db.getFirstAsync<{ datos: string }>(
      'SELECT datos FROM snapshots WHERE coleccion = ?',
      coleccion
    );
    return fila ? JSON.parse(fila.datos) : [];
  },
};
