import React, { createContext, useContext } from 'react';
import { usePreferences } from '../preferences/use-preferences';
import { obtenerColores, type Colors } from './palettes';

const ColorsContext = createContext<Colors | null>(null);

/** Provee la paleta de colores activa según el tema y el modo noche elegidos en Configuración. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { tema, modoOscuro } = usePreferences();
  return <ColorsContext.Provider value={obtenerColores(tema, modoOscuro)}>{children}</ColorsContext.Provider>;
}

export function useColors(): Colors {
  const colors = useContext(ColorsContext);
  if (!colors) throw new Error('useColors() debe usarse dentro de <ThemeProvider>');
  return colors;
}
