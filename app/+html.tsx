import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Este archivo customiza el HTML raíz del export web estático de Expo Router.
 * Solo corre en Node.js durante el renderizado estático (no en el cliente).
 * No importar CSS global acá para no romper la precedencia de estilos.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* PWA: manifest e ícono para "agregar a inicio" */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icons/icon.png" />
        <link rel="apple-touch-icon" href="/icons/icon.png" />
        <meta name="theme-color" content="#374151" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Gastos" />
        <meta name="mobile-web-app-capable" content="yes" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
