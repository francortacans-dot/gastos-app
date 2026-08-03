import type { LocalStore } from './local-store';

/**
 * En escritorio/web, Firestore ya persiste en IndexedDB (ver src/firebase/app.ts),
 * así que la cola local no tiene trabajo que hacer: no hay pendientes que
 * acumular ni snapshots que leer aparte de los que da Firestore.
 */
export const localStoreSqlite: LocalStore = {
  async guardarPendiente(): Promise<void> {},
  async listarPendientes(): Promise<[]> {
    return [];
  },
  async borrarPendiente(): Promise<void> {},
  async guardarSnapshot(): Promise<void> {},
  async leerSnapshot(): Promise<[]> {
    return [];
  },
};
