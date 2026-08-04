import React, { createContext, useContext } from 'react';
import { crearRepos, type Repos } from './repos/create-repo';

interface AppContextValue {
  repos: Repos;
  uid: string;
}

const AppContext = createContext<AppContextValue | null>(null);

/** Solo se monta una vez que hay una sesión de Firebase Auth activa (ver AuthProvider). */
export function AppProvider({ uid, children }: { uid: string; children: React.ReactNode }) {
  const repos = crearRepos(uid);
  return <AppContext.Provider value={{ repos, uid }}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const valor = useContext(AppContext);
  if (!valor) throw new Error('useApp() debe usarse dentro de <AppProvider>');
  return valor;
}
