/** Forma de tokens que debe tener cada paleta de tema. */
export interface Colors {
  primary: string;
  primaryDark: string;
  primaryLight: string;

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
