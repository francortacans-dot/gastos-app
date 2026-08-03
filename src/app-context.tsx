import React, { createContext, useContext, useEffect, useState } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from './firebase/app';
import { crearRepos, type Repos } from './repos/create-repo';

interface AppContextValue {
  repos: Repos;
  uid: string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const desuscribir = onAuthStateChanged(auth, (usuario) => {
      if (usuario) {
        setUid(usuario.uid);
      } else {
        signInAnonymously(auth).catch((error) => {
          console.error('No se pudo iniciar sesión anónima en Firebase:', error);
        });
      }
    });
    return desuscribir;
  }, []);

  if (!uid) return null; // la Task 17 agrega un splash mientras esto resuelve

  const repos = crearRepos(uid);

  return <AppContext.Provider value={{ repos, uid }}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const valor = useContext(AppContext);
  if (!valor) throw new Error('useApp() debe usarse dentro de <AppProvider>');
  return valor;
}
