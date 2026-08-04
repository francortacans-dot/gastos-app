import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '../firebase/app';

interface AuthContextValue {
  usuario: User | null;
  /** true mientras todavía no se resolvió el estado inicial de auth. */
  cargando: boolean;
}

const AuthContext = createContext<AuthContextValue>({ usuario: null, cargando: true });

/**
 * Escucha la sesión de Firebase Auth sin crear una sesión anónima
 * automáticamente. Si no hay usuario, `usuario` queda en null y la capa de
 * arriba (app/_layout.tsx) muestra la pantalla de login/registro.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUsuario(u);
      setCargando(false);
    });
  }, []);

  return <AuthContext.Provider value={{ usuario, cargando }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
