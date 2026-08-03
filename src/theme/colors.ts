/** Paleta de colores de la app. No usar valores de color sueltos fuera de este archivo. */
export const colors = {
  primary: '#16a97e',
  primaryDark: '#0d7a5a',
  primaryLight: '#e6f7f2',

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
} as const;

/** Colores rotativos para asignar automáticamente a sectores nuevos, en orden. */
export const sectorPalette: string[] = [
  '#16a97e',
  '#2563eb',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#0d7a5a',
  '#6d28d9',
  '#d97706',
];
