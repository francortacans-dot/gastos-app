/** Forma de tokens que debe tener cada paleta de tema. */
export interface Colors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  /** Color de texto/íconos sobre una superficie coloreada con `primary` (botones, tarjeta hero). */
  onPrimary: string;

  blue: string;
  blueLight: string;

  orange: string;
  orangeLight: string;

  red: string;
  redLight: string;

  bg: string;
  surface: string;
  surface2: string;
  border: string;
  borderDark: string;
  text1: string;
  text2: string;
  text3: string;
  text4: string;
}

export type TemaId = 'gris' | 'beige' | 'oliva' | 'pastel' | 'oscuro';

export const temaLabels: Record<TemaId, string> = {
  gris: 'Blanco y gris',
  beige: 'Beige y marrón',
  oliva: 'Verde oliva',
  pastel: 'Pastel',
  oscuro: 'Oscuro',
};

/** Paleta efectiva según el tema elegido y si el modo noche está prendido. */
export function obtenerColores(tema: TemaId, modoOscuro: boolean): Colors {
  if (modoOscuro && tema !== 'oscuro') return paletasOscuras[tema];
  return palettes[tema];
}

/** Color de muestra por tema, para pintar los swatches del selector en Configuración. */
export const temaSwatch: Record<TemaId, string> = {
  gris: '#374151',
  beige: '#8b5e34',
  oliva: '#5c6b2e',
  pastel: '#d98ea0',
  oscuro: '#3b82f6',
};

export const palettes: Record<TemaId, Colors> = {
  gris: {
    primary: '#374151',
    primaryDark: '#1f2937',
    primaryLight: '#f3f4f6',
    onPrimary: '#ffffff',
    blue: '#2563eb',
    blueLight: '#eff6ff',
    orange: '#f59e0b',
    orangeLight: '#fffbeb',
    red: '#ef4444',
    redLight: '#fef2f2',
    bg: '#f4f6f9',
    surface: '#ffffff',
    surface2: '#f9fafb',
    border: '#e5e7eb',
    borderDark: '#d1d5db',
    text1: '#111827',
    text2: '#374151',
    text3: '#6b7280',
    text4: '#9ca3af',
  },
  beige: {
    primary: '#8b5e34',
    primaryDark: '#5f3d1e',
    primaryLight: '#f3e6d8',
    onPrimary: '#ffffff',
    blue: '#5b7c99',
    blueLight: '#eaf1f5',
    orange: '#c17a34',
    orangeLight: '#faf0e3',
    red: '#b5482f',
    redLight: '#f7e6e1',
    bg: '#f7f1e8',
    surface: '#fffdf9',
    surface2: '#efe4d3',
    border: '#e0d1ba',
    borderDark: '#c9b48f',
    text1: '#3b2a1a',
    text2: '#5c4530',
    text3: '#8a7256',
    text4: '#b3a084',
  },
  oliva: {
    primary: '#5c6b2e',
    primaryDark: '#3e4a1c',
    primaryLight: '#eef1e0',
    onPrimary: '#ffffff',
    blue: '#4c6b6b',
    blueLight: '#e7eeed',
    orange: '#a97a2e',
    orangeLight: '#f5eeda',
    red: '#a13f2e',
    redLight: '#f4e3df',
    bg: '#f2f3ea',
    surface: '#fdfdf9',
    surface2: '#e9ebd9',
    border: '#d7dcc0',
    borderDark: '#b9c19a',
    text1: '#2a2e1a',
    text2: '#454b2c',
    text3: '#6b7350',
    text4: '#98a17c',
  },
  pastel: {
    primary: '#d98ea0',
    primaryDark: '#b5677c',
    primaryLight: '#fbeaf0',
    onPrimary: '#ffffff',
    blue: '#7fb2c9',
    blueLight: '#eaf4f8',
    orange: '#c9a06a',
    orangeLight: '#f8f1e6',
    red: '#d9707a',
    redLight: '#faeaec',
    bg: '#fdf6f2',
    surface: '#ffffff',
    surface2: '#f7ecec',
    border: '#f0dde1',
    borderDark: '#e0bfc7',
    text1: '#4a3b3f',
    text2: '#6b5960',
    text3: '#93838a',
    text4: '#c2b3ba',
  },
  oscuro: {
    primary: '#3b82f6',
    primaryDark: '#1d4ed8',
    primaryLight: '#16233a',
    onPrimary: '#ffffff',
    blue: '#60a5fa',
    blueLight: '#16233a',
    orange: '#f0b429',
    orangeLight: '#332a12',
    red: '#f87171',
    redLight: '#3a1a1a',
    bg: '#0b0f17',
    surface: '#131a26',
    surface2: '#1b2432',
    border: '#232c3d',
    borderDark: '#2f3a4f',
    text1: '#f1f5f9',
    text2: '#cbd5e1',
    text3: '#94a3b8',
    text4: '#64748b',
  },
};

/**
 * Versión oscura de cada tema (salvo 'oscuro', que ya es oscuro de por sí):
 * mantiene el color de acento de esa familia (más claro, para que siga
 * contrastando sobre fondo oscuro) en vez de forzar un azul genérico.
 * La usa ThemeProvider cuando el modo noche está prendido.
 */
export const paletasOscuras: Record<Exclude<TemaId, 'oscuro'>, Colors> = {
  gris: {
    primary: '#cbd5e1',
    primaryDark: '#94a3b8',
    primaryLight: '#1f2937',
    onPrimary: '#111827',
    blue: '#60a5fa',
    blueLight: '#16233a',
    orange: '#f0b429',
    orangeLight: '#332a12',
    red: '#f87171',
    redLight: '#3a1a1a',
    bg: '#101114',
    surface: '#1a1b1f',
    surface2: '#232428',
    border: '#2c2d33',
    borderDark: '#3a3b42',
    text1: '#f4f4f5',
    text2: '#d4d4d8',
    text3: '#a1a1aa',
    text4: '#71717a',
  },
  beige: {
    primary: '#d9a066',
    primaryDark: '#b5793d',
    primaryLight: '#2c2013',
    onPrimary: '#2c1c0d',
    blue: '#7c9cb5',
    blueLight: '#16202a',
    orange: '#e0a052',
    orangeLight: '#332714',
    red: '#e08a6b',
    redLight: '#3a2018',
    bg: '#161210',
    surface: '#201b17',
    surface2: '#2a231e',
    border: '#3a3128',
    borderDark: '#4a3f33',
    text1: '#f5eee6',
    text2: '#d9c8b8',
    text3: '#a8927d',
    text4: '#786553',
  },
  oliva: {
    primary: '#a8b878',
    primaryDark: '#87975a',
    primaryLight: '#242a17',
    onPrimary: '#1f2412',
    blue: '#7fa3a3',
    blueLight: '#182222',
    orange: '#cf9f52',
    orangeLight: '#302510',
    red: '#c67a5f',
    redLight: '#331f16',
    bg: '#14160f',
    surface: '#1c1f16',
    surface2: '#262a1c',
    border: '#343824',
    borderDark: '#454b30',
    text1: '#f1f3e8',
    text2: '#d5dac2',
    text3: '#a3aa8a',
    text4: '#767c5f',
  },
  pastel: {
    primary: '#e3a3b3',
    primaryDark: '#c47f92',
    primaryLight: '#2e1e22',
    onPrimary: '#2c161c',
    blue: '#9dc6d8',
    blueLight: '#182428',
    orange: '#dbb98a',
    orangeLight: '#2e2517',
    red: '#e08f97',
    redLight: '#331e21',
    bg: '#171213',
    surface: '#211a1c',
    surface2: '#2b2224',
    border: '#3b2f32',
    borderDark: '#4c3d41',
    text1: '#f6ecee',
    text2: '#dcc6cb',
    text3: '#ab8f95',
    text4: '#7c6469',
  },
};
